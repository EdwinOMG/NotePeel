import httpx
import json
import re
import asyncio

from app.config import get_settings

settings = get_settings()

BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{settings.cf_account_id}/ai/run"
MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
HEADERS = {"Authorization": f"Bearer {settings.cf_api_token}"}


async def _call(system: str, user: str) -> str:
    """Base function — all Workers AI calls go through here."""
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
            # cloudflare might return token strings or a structured list
            if all(isinstance(item, str) for item in result):
                result = "".join(result)
            else:
                # Already structured data, re-serialize for consistent handling
                result = json.dumps(result)
        
        return result

def _clean_json(raw: str) -> str:
    """Strip markdown fences and repair common Llama JSON truncation issues."""
    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    # If it's an array that got cut off mid-string
    if raw.startswith("["):
        if not raw.endswith("]"):
            # Find the last complete object — ends with }
            last_complete = raw.rfind("}")
            if last_complete != -1:
                raw = raw[:last_complete + 1]  # trim everything after last }
                raw = raw.rstrip().rstrip(",")  # remove trailing comma
                raw = raw + "]"                 # close the array
            else:
                raw = "[]"  # nothing valid, return empty array

    # If it's an object that got cut off
    elif raw.startswith("{"):
        if not raw.endswith("}"):
            raw = raw.rstrip().rstrip(",")
            raw = raw + "}"

    return raw


async def summarize_note(raw_text: str) -> str:
    return await _call(
        system=(
            "You are a helpful study assistant. Summarize the student's notes "
            "clearly and concisely in plain English. Keep it under 200 words. "
            "Do not use markdown formatting."
        ),
        user=f"Summarize these notes:\n\n{raw_text}"
    )


async def explain_highlight(highlighted_text: str, context: str) -> str:
    return await _call(
        system=(
            "You are a helpful study assistant. Explain the highlighted term or "
            "concept from the student's notes in simple, clear language. "
            "Use the surrounding context to make the explanation relevant. "
            "Keep it concise — 2 to 4 sentences."
        ),
        user=(
            f"Explain this: '{highlighted_text}'\n\n"
            f"Context from the note:\n{context}"
        )
    )


async def generate_flashcards(raw_text: str) -> list[dict]:
    last_error = None

    for attempt in range(3):  # try up to 3 times
        try:
            result = await _call(
                system=(
                    "You are a helpful study assistant. Generate flashcards from the "
                    "student's notes. Return ONLY a valid JSON array, no markdown, "
                    "no explanation, no preamble. "
                    'Format: [{"question": "...", "answer": "..."}]'
                ),
                user=f"Generate 8 to 10 flashcards from these notes:\n\n{raw_text}"
            )

            cleaned = _clean_json(result)
            parsed = json.loads(cleaned)

            if isinstance(parsed, dict):
                for key in ("cards", "flashcards", "data", "results"):
                    if key in parsed and isinstance(parsed[key], list):
                        return parsed[key]
                for value in parsed.values():
                    if isinstance(value, list):
                        return value
                raise Exception(f"Unexpected response format: {parsed}")

            if not parsed:
                raise Exception("Empty flashcard list returned")

            return parsed

        except Exception as e:
            last_error = e
            if attempt < 2:
                await asyncio.sleep(1)  # wait 1 second before retrying
            continue

    raise Exception(f"Failed after 3 attempts: {last_error}")


async def categorize_note(raw_text: str) -> dict:
    result = await _call(
        system=(
            "You are a helpful study assistant. Categorize the student's notes. "
            "Return ONLY a valid JSON object, no markdown, no explanation. "
            'Format: {"subject": "...", "topic": "...", "tags": ["...", "..."]}'
        ),
        user=f"Categorize these notes by subject, topic, and tags:\n\n{raw_text}"
    )
    return json.loads(_clean_json(result))