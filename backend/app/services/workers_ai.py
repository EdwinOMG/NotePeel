import httpx
import json
import re
import asyncio

from app.config import get_settings

settings = get_settings()

BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{settings.cf_account_id}/ai/run"
MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
HEADERS = {"Authorization": f"Bearer {settings.cf_api_token}"}


def _estimate_tokens(text: str) -> int:
    """
    Cloudflare Workers AI doesn't return token counts in the response,
    so we estimate: ~4 characters per token is a standard approximation.
    We count both the input prompt and output response.
    """
    return max(1, len(text) // 4)


async def _call(system: str, user: str) -> tuple[str, int]:
    """
    Base function — all Workers AI calls go through here.
    Returns (response_text, estimated_tokens_used).
    Tokens = estimate of input + output combined.
    """
    prompt = system + user  # used for input token estimate
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/{MODEL}",
            headers=HEADERS,
            json={
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ]
            }
        )
        data = response.json()
        if not data.get("success"):
            raise Exception(f"Workers AI error: {data}")
        
        result = data["result"]["response"]
        
        if isinstance(result, list):
            if all(isinstance(item, str) for item in result):
                result = "".join(result)
            else:
                result = json.dumps(result)
        
        # Estimate total tokens: input prompt + output response
        tokens_used = _estimate_tokens(prompt) + _estimate_tokens(result)
        
        return result, tokens_used


def _clean_json(raw: str) -> str:
    """Strip markdown fences and repair common Llama JSON truncation issues."""
    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    if raw.startswith("["):
        if not raw.endswith("]"):
            last_complete = raw.rfind("}")
            if last_complete != -1:
                raw = raw[:last_complete + 1]
                raw = raw.rstrip().rstrip(",")
                raw = raw + "]"
            else:
                raw = "[]"

    elif raw.startswith("{"):
        if not raw.endswith("}"):
            raw = raw.rstrip().rstrip(",")
            raw = raw + "}"

    return raw


async def summarize_note(raw_text: str) -> tuple[str, int]:
    """Returns (summary_text, tokens_used)."""
    system = (
        "You are a helpful study assistant. Summarize the student's notes "
        "clearly and concisely in plain English. Keep it under 200 words. "
        "Do not use markdown formatting."
    )
    user = f"Summarize these notes:\n\n{raw_text}"
    result, tokens = await _call(system, user)
    return result, tokens


async def explain_highlight(highlighted_text: str, context: str) -> tuple[str, int]:
    """Returns (explanation_text, tokens_used)."""
    system = (
        "You are a helpful study assistant. Explain the highlighted term or "
        "concept from the student's notes in simple, clear language. "
        "Use the surrounding context to make the explanation relevant. "
        "Keep it concise — 2 to 4 sentences."
    )
    user = (
        f"Explain this: '{highlighted_text}'\n\n"
        f"Context from the note:\n{context}"
    )
    result, tokens = await _call(system, user)
    return result, tokens


async def generate_flashcards(raw_text: str) -> tuple[list[dict], int]:
    """Returns (cards_list, tokens_used)."""
    last_error = None
    total_tokens = 0

    for attempt in range(3):
        try:
            system = (
                "You are a helpful study assistant. Generate flashcards from the "
                "student's notes. Return ONLY a valid JSON array, no markdown, "
                "no explanation, no preamble. "
                'Format: [{"question": "...", "answer": "..."}]'
            )
            user = f"Generate 8 to 10 flashcards from these notes:\n\n{raw_text}"

            result, tokens = await _call(system, user)
            total_tokens = tokens  # use tokens from the successful attempt

            cleaned = _clean_json(result)
            parsed = json.loads(cleaned)

            if isinstance(parsed, dict):
                for key in ("cards", "flashcards", "data", "results"):
                    if key in parsed and isinstance(parsed[key], list):
                        return parsed[key], total_tokens
                for value in parsed.values():
                    if isinstance(value, list):
                        return value, total_tokens
                raise Exception(f"Unexpected response format: {parsed}")

            if not parsed:
                raise Exception("Empty flashcard list returned")

            return parsed, total_tokens

        except Exception as e:
            last_error = e
            if attempt < 2:
                await asyncio.sleep(1)
            continue

    raise Exception(f"Failed after 3 attempts: {last_error}")


async def categorize_note(raw_text: str) -> dict:
    """
    Called server-side during upload — not user-triggered so we don't
    track tokens here. Returns just the dict, no tuple needed.
    """
    system = (
        "You are a helpful study assistant. Categorize the student's notes. "
        "Return ONLY a valid JSON object, no markdown, no explanation. "
        'Format: {"subject": "...", "topic": "...", "tags": ["...", "..."]}'
    )
    user = f"Categorize these notes by subject, topic, and tags:\n\n{raw_text}"
    result, _ = await _call(system, user)  # discard tokens — server-side call
    return json.loads(_clean_json(result))


async def chat_with_note(messages: list[dict], note_context: str) -> tuple[str, int]:
    """
    Stateful study chat grounded in a note's content.

    messages: full conversation history in OpenAI format
              [{"role": "user"/"assistant", "content": "..."}]
    note_context: the note's raw_text, injected as system context

    Returns (assistant_reply, estimated_tokens_used).
    """
    system = (
        "You are a helpful study assistant. The student is asking questions about "
        "their notes. Use the note content below as your primary source. "
        "Be concise, clear, and stay focused on what's in the notes. "
        "If something isn't covered in the notes, say so rather than guessing.\n\n"
        f"--- NOTE CONTENT ---\n{note_context[:3000]}\n--- END NOTE ---"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/{CHAT_MODEL}",
            headers=HEADERS,
            json={
                "messages": [
                    {"role": "system", "content": system},
                    *messages  # full history passed in by the route
                ]
            }
        )
        data = response.json()
        if not data.get("success"):
            raise Exception(f"Workers AI chat error: {data}")

        result = data["result"]["response"]
        if isinstance(result, list):
            result = "".join(result) if all(isinstance(i, str) for i in result) else json.dumps(result)

        # Estimate tokens: system + all messages + response
        all_text = system + "".join(m["content"] for m in messages) + result
        tokens_used = _estimate_tokens(all_text)

        return result, tokens_used