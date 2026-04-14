import os
import json
import re

from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


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


def extract_structured_text(image_bytes: bytes, note_type: str = "default") -> dict:
    mime = detect_image_type(image_bytes)
    prompt = PROMPTS.get(note_type, PROMPTS["default"])

    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=[
            prompt,
            {"inline_data": {"mime_type": mime, "data": image_bytes}}
        ]
    )

    raw = response.text
    if not raw:
        reason = "empty response"
        try:
            reason = str(response.prompt_feedback) or reason
        except Exception:
            pass
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": "",
            "error": f"Gemini returned no response ({reason})"
        }

    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        structured = json.loads(raw)
    except json.JSONDecodeError as e:
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": raw,
            "error": f"JSON parse failed: {str(e)}"
        }

    structured["metadata"] = {
        "model": "gemini-2.5-flash-lite",
        "note_type": note_type,
    }

    return structured
