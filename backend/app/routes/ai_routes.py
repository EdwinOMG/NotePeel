import json
import re
import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google import genai

from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.models.flashcard import FlashcardSet, Flashcard, AISummary, AIExplanation
from app.controllers.auth_controller import get_current_user

router = APIRouter(prefix="/api/ai", tags=["AI"])

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))


def _call_gemini(prompt: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=[prompt]
    )
    raw = (response.text or "").strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw


def _get_user_note(db: Session, note_id: int, user: User) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    if not note.raw_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Note has no text content")
    return note


# ── Flashcard Generation ──

@router.post("/flashcards/{note_id}")
def generate_flashcards(
    note_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = _get_user_note(db, note_id, current_user)

    # Check if flashcards already exist (unless regenerate=True)
    if not regenerate:
        existing = db.query(FlashcardSet).filter(
            FlashcardSet.note_id == note_id,
            FlashcardSet.owner_id == current_user.id
        ).order_by(FlashcardSet.created_at.desc()).first()
        
        if existing:
            return {
                "id": existing.id,
                "note_id": existing.note_id,
                "title": existing.title,
                "created_at": existing.created_at,
                "cards": [{"id": c.id, "question": c.question, "answer": c.answer} for c in existing.cards],
                "cached": True
            }

    prompt = f"""Based on the following study notes, generate flashcards for studying.
Create 8-12 flashcards that cover the key concepts, definitions, and facts.

Return ONLY a valid JSON object with this structure:
{{
  "title": "Flashcards: <brief topic>",
  "cards": [
    {{"question": "...", "answer": "..."}},
    ...
  ]
}}

Notes content:
{note.raw_text[:4000]}
"""

    try:
        raw = _call_gemini(prompt)
        data = json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Delete old flashcards for this note if regenerating
    if regenerate:
        db.query(FlashcardSet).filter(
            FlashcardSet.note_id == note_id,
            FlashcardSet.owner_id == current_user.id
        ).delete()

    # Save to database
    fc_set = FlashcardSet(
        note_id=note_id,
        title=data.get("title", f"Flashcards for {note.title}"),
        owner_id=current_user.id,
    )
    db.add(fc_set)
    db.flush()

    cards_data = data.get("cards", [])
    for card in cards_data:
        fc = Flashcard(
            set_id=fc_set.id,
            question=card.get("question", ""),
            answer=card.get("answer", ""),
        )
        db.add(fc)

    db.commit()
    db.refresh(fc_set)

    return {
        "id": fc_set.id,
        "note_id": fc_set.note_id,
        "title": fc_set.title,
        "created_at": fc_set.created_at,
        "cards": [{"id": c.id, "question": c.question, "answer": c.answer} for c in fc_set.cards],
        "cached": False
    }


@router.get("/flashcards/{note_id}")
def get_flashcards(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sets = db.query(FlashcardSet).filter(
        FlashcardSet.note_id == note_id,
        FlashcardSet.owner_id == current_user.id
    ).order_by(FlashcardSet.created_at.desc()).all()

    return [
        {
            "id": s.id,
            "note_id": s.note_id,
            "title": s.title,
            "created_at": s.created_at,
            "cards": [{"id": c.id, "question": c.question, "answer": c.answer} for c in s.cards],
        }
        for s in sets
    ]


# ── Summarize ──

@router.post("/summarize/{note_id}")
def summarize_note(
    note_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = _get_user_note(db, note_id, current_user)

    # Return cached summary if exists (unless regenerate=True)
    if not regenerate and note.ai_summary:
        return {"summary": note.ai_summary, "cached": True}

    prompt = f"""Summarize the following study notes into a concise, well-structured summary.
Use bullet points for key ideas. Keep it under 200 words.

Notes content:
{note.raw_text[:4000]}
"""

    try:
        summary = _call_gemini(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI summarization failed: {str(e)}")

    # Cache the summary on the note
    note.ai_summary = summary
    db.commit()

    return {"summary": summary, "cached": False}


# ── Explain ──

class ExplainRequest(BaseModel):
    text: str
    note_id: int | None = None


@router.post("/explain")
def explain_text(
    request: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    text_to_explain = request.text.strip()
    
    # Check cache if note_id provided - look for exact or similar match
    if request.note_id:
        existing = db.query(AIExplanation).filter(
            AIExplanation.note_id == request.note_id,
            AIExplanation.owner_id == current_user.id,
            AIExplanation.highlighted_text == text_to_explain
        ).first()
        
        if existing:
            return {
                "explanation": existing.explanation,
                "highlighted_text": existing.highlighted_text,
                "cached": True
            }

    prompt = f"""Explain the following concept or text in a clear, educational way.
Assume the reader is a student. Keep the explanation concise but thorough (under 150 words).

Text to explain:
{text_to_explain[:2000]}
"""

    try:
        explanation = _call_gemini(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI explanation failed: {str(e)}")

    # Save to cache if note_id provided
    if request.note_id:
        ai_exp = AIExplanation(
            note_id=request.note_id,
            owner_id=current_user.id,
            highlighted_text=text_to_explain,
            explanation=explanation
        )
        db.add(ai_exp)
        db.commit()

    return {"explanation": explanation, "highlighted_text": text_to_explain, "cached": False}


@router.get("/explanations/{note_id}")
def get_explanations(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all cached explanations for a note."""
    explanations = db.query(AIExplanation).filter(
        AIExplanation.note_id == note_id,
        AIExplanation.owner_id == current_user.id
    ).order_by(AIExplanation.created_at.desc()).all()

    return [
        {
            "id": e.id,
            "highlighted_text": e.highlighted_text,
            "explanation": e.explanation,
            "created_at": e.created_at
        }
        for e in explanations
    ]
