import os
import json
import re
import io

from google import genai
from PIL import Image, ImageFilter, ImageOps

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
STRUCTURED_MODEL = "gemini-2.5-flash"
PLAIN_TEXT_MODEL = "gemini-2.5-flash-lite"


def detect_image_type(image_bytes: bytes) -> str:
    """Detect image type from bytes without imghdr."""
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif image_bytes[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "image/webp"
    else:
        return "image/jpeg"  # Default fallback


LAYOUT_PROMPT = """
Analyze this handwritten note image and return ONLY a valid JSON object describing both the content AND the physical layout.

The JSON must have an "elements" array where each element represents a distinct visual region on the page.

Each element must have:
- "id": unique number starting from 1
- "type": one of ["header", "paragraph", "bullet_list", "key_value", "diagram", "table", "label"]
- "content": the transcribed text (or diagram description if type is diagram)
- "container": one of ["box", "underlined", "circled", "arrow", "none"]
    - "box" = a rectangular border is drawn AROUND this text block
    - "underlined" = the text has a line drawn underneath it
    - "circled" = a circle is drawn around this text block
    - "none" = no border around this text block
- "position": object with:
    - "region": rough location e.g. "top-left", "top-right", "top-center", "middle-left", "middle-right", "middle-center", "bottom-left", "bottom-right", "bottom-center"
    - "x_percent": left edge as % of page width (0-100)
    - "y_percent": top edge as % of page height (0-100). CRITICAL: y_percent = 0 is the very TOP of the page. y_percent = 100 is the very BOTTOM. An element that appears higher on the page MUST have a lower y_percent than one below it. This value is used to determine reading order — get it wrong and the entire note will be scrambled.
    - "width_percent": width as % of page width (0-100)
    - "height_percent": height as % of page height (0-100)
- "style": object with:
    - "is_bold": true/false
    - "is_large": true/false
    - "is_underlined": true/false
- "children": for bullet_list, array of bullet strings. Empty array otherwise.
- "connected_to": array of element ids this element points to via arrows. Empty array otherwise.
- "diagram": ONLY include this field when type is "diagram". It must be an object with:
    - "description": plain text description of what is drawn
    - "location": where on the page (e.g. "bottom-left")
    - "shape": one of ["rectangle", "circle", "triangle", "diamond", "arrow", "none"]
        - Pick the single most dominant shape in the diagram
        - Use "none" only if no clear geometric shape exists
    - "labels": list of ALL text strings found inside or directly labeling the shape

Also include at the top level:
- "page_layout": one of ["single_column", "two_column", "mixed"]
- "raw_text": full verbatim transcription in reading order

IMPORTANT rules:
- "container" refers to a border drawn around a TEXT element — not the shape of a diagram
- If a text section has a rectangle drawn around it, set container to "box" (not type "diagram")
- If you see a hand-drawn rectangle/box with TEXT inside it, do NOT set type to "diagram".
  Set type to "paragraph" (or "bullet_list" etc) and set container to "box".
  The "diagram" type is ONLY for drawings or illustrations that contain NO readable text.
- A triangle or arrow pointing to or sitting above a text box is NOT a diagram. Ignore it entirely. Do NOT create any element for it at all — no diagram element, no labels, nothing.
- Only create a "diagram" type element if the shape contains meaningful visual information that cannot be represented as text (e.g. a labeled scientific drawing, a graph, a flow chart with multiple nodes).
- NEVER describe what you see visually. Never write "A hand-drawn box containing..." or "A triangular shape is above..." or "The image shows..." or "There is a...". The content field must ONLY contain the actual written text from the note, transcribed exactly.
- The "labels" field of a diagram must ONLY contain actual text labels written inside or next to the diagram. Never put descriptive sentences in labels.
- A header physically above only ONE column belongs to that column only. Set its x_percent, region, and width_percent to match that column, not the full page. Do NOT set width_percent above 80 for a header that sits above only one section.
- Only set width_percent above 80 if the text literally spans the full width of the page.
- Return ONLY the JSON object, no markdown, no explanation
"""

PROMPTS = {
    "default": LAYOUT_PROMPT,
    "lecture": LAYOUT_PROMPT + """
\nExtra instructions for lecture notes:
- Transcribe equations exactly as written
- Labeled diagrams should capture every label in diagram.labels
- Defined terms should be type "key_value"
""",
    "meeting": LAYOUT_PROMPT + """
\nExtra instructions for meeting notes:
- Checkboxes: prefix content with [x] or [ ]
- Action items should be type "bullet_list"
- Capture names next to action items in content
"""
}

PLAIN_TEXT_PROMPTS = {
    "default": """
Transcribe every visible word from this handwritten note in natural reading order.
Return ONLY plain text.

Rules:
- Do not summarize or rewrite
- Preserve headings, bullets, and line breaks when possible
- If a word is unclear, make your best guess instead of omitting nearby readable text
- Focus on transcription completeness over layout analysis
""",
    "lecture": """
Transcribe every visible word from this lecture note in natural reading order.
Return ONLY plain text.

Rules:
- Do not summarize or rewrite
- Preserve headings, bullets, equations, and line breaks when possible
- If a word is unclear, make your best guess instead of omitting nearby readable text
- Focus on transcription completeness over layout analysis
""",
    "meeting": """
Transcribe every visible word from this meeting note in natural reading order.
Return ONLY plain text.

Rules:
- Do not summarize or rewrite
- Preserve headings, bullets, checkboxes, and line breaks when possible
- If a word is unclear, make your best guess instead of omitting nearby readable text
- Focus on transcription completeness over layout analysis
""",
}

STRUCTURED_GENERATION_CONFIG = {
    "temperature": 0,
    "top_p": 0.1,
    "top_k": 1,
    "candidate_count": 1,
    "max_output_tokens": 8192,
    "response_mime_type": "application/json",
}

PLAIN_TEXT_GENERATION_CONFIG = {
    "temperature": 0,
    "top_p": 0.1,
    "top_k": 1,
    "candidate_count": 1,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}


def _count_words(text: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", text or ""))


def _normalize_json_response(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw


def _generate_content(prompt: str, image_bytes: bytes, mime: str, config: dict, model: str = STRUCTURED_MODEL) -> str:
    response = client.models.generate_content(
        model=model,
        contents=[
            prompt,
            {"inline_data": {"mime_type": mime, "data": image_bytes}}
        ],
        config=config,
    )

    raw = response.text
    if raw:
        return raw

    reason = "empty response"
    try:
        reason = str(response.prompt_feedback) or reason
    except Exception:
        pass
    raise ValueError(f"Gemini returned no response ({reason})")


def _preprocess_image(image_bytes: bytes) -> tuple[bytes, str]:
    """Light preprocessing applied to all passes: EXIF fix, white background, JPEG conversion."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            alpha = image.getchannel('A') if 'A' in image.getbands() else None
            background.paste(image, mask=alpha)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=92, optimize=True)
        return output.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, detect_image_type(image_bytes)


def _normalize_image_for_retry(image_bytes: bytes) -> tuple[bytes, str]:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)

        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            alpha = image.getchannel('A') if 'A' in image.getbands() else None
            background.paste(image, mask=alpha)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        if image.width > 2200:
            ratio = 2200 / image.width
            image = image.resize(
                (2200, max(1, int(image.height * ratio))),
                Image.LANCZOS,
            )

        image = ImageOps.autocontrast(image, cutoff=1)
        image = image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=130, threshold=3))

        output = io.BytesIO()
        image.save(output, format='JPEG', quality=92, optimize=True)
        return output.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, detect_image_type(image_bytes)


def _run_structured_pass(image_bytes: bytes, note_type: str = "default") -> dict:
    image_bytes, mime = _preprocess_image(image_bytes)
    prompt = PROMPTS.get(note_type, PROMPTS["default"])

    try:
        raw = _generate_content(prompt, image_bytes, mime, STRUCTURED_GENERATION_CONFIG, model=STRUCTURED_MODEL)
    except Exception as exc:
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": "",
            "error": str(exc),
        }

    try:
        structured = json.loads(_normalize_json_response(raw))
    except json.JSONDecodeError as exc:
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": raw.strip(),
            "error": f"JSON parse failed: {str(exc)}"
        }

    structured["metadata"] = {
        "model": STRUCTURED_MODEL,
        "note_type": note_type,
        "strategy": "structured_layout",
    }

    return structured


def _run_plain_text_fallback(image_bytes: bytes, note_type: str = "default") -> dict:
    mime = detect_image_type(image_bytes)
    prompt = PLAIN_TEXT_PROMPTS.get(note_type, PLAIN_TEXT_PROMPTS["default"])

    try:
        raw_text = _generate_content(prompt, image_bytes, mime, PLAIN_TEXT_GENERATION_CONFIG, model=PLAIN_TEXT_MODEL).strip()
    except Exception as exc:
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": "",
            "error": str(exc),
        }

    return {
        "elements": [],
        "page_layout": "unknown",
        "raw_text": raw_text,
        "metadata": {
            "model": PLAIN_TEXT_MODEL,
            "note_type": note_type,
            "strategy": "plain_text_fallback",
        }
    }


def _should_try_plain_text_fallback(result: dict) -> bool:
    if result.get("error"):
        return True

    raw_text = (result.get("raw_text") or "").strip()
    if not raw_text:
        return True

    word_count = _count_words(raw_text)
    element_count = len(result.get("elements") or [])
    return word_count < 25 or (word_count < 45 and element_count <= 2)


def _fallback_is_better(primary: dict, fallback: dict) -> bool:
    if fallback.get("error"):
        return False

    primary_words = _count_words(primary.get("raw_text") or "")
    fallback_words = _count_words(fallback.get("raw_text") or "")

    if primary.get("error") or primary_words == 0:
        return fallback_words > 0

    return fallback_words >= max(primary_words + 5, int(primary_words * 1.2))


def _tag_pass(result: dict, pass_number: int) -> dict:
    if "metadata" not in result:
        result["metadata"] = {}
    result["metadata"]["pass"] = pass_number
    return result


def extract_structured_text(image_bytes: bytes, note_type: str = "default") -> dict:
    # Pass 1: structured extraction on lightly preprocessed image
    primary_result = _run_structured_pass(image_bytes, note_type=note_type)

    if not _should_try_plain_text_fallback(primary_result):
        return _tag_pass(primary_result, 1)

    # Pass 2: structured extraction again on heavily normalized image
    retry_image_bytes, _ = _normalize_image_for_retry(image_bytes)
    structured_retry = _run_structured_pass(retry_image_bytes, note_type=note_type)

    if not _should_try_plain_text_fallback(structured_retry):
        return _tag_pass(structured_retry, 2)

    # Pass 3: plain text fallback on normalized image (last resort)
    fallback_result = _run_plain_text_fallback(retry_image_bytes, note_type=note_type)

    best = max(
        [structured_retry, fallback_result],
        key=lambda r: _count_words(r.get("raw_text") or "") if not r.get("error") else 0
    )

    if _fallback_is_better(primary_result, best):
        return _tag_pass(best, 3)

    return _tag_pass(primary_result, 1)
