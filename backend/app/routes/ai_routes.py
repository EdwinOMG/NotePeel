import json
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.models.flashcard import FlashcardSet, Flashcard, AISummary, AIExplanation
from app.controllers.auth_controller import get_current_user
from app.services.workers_ai import (
    summarize_note as workers_summarize,
    explain_highlight as workers_explain,
    generate_flashcards as workers_flashcards,
)

router = APIRouter(prefix="/api/ai", tags=["AI"])


def _get_user_note(db: Session, note_id: int, user: User) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    if not note.raw_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Note has no text content")
    return note


# ── Flashcard Generation ───────────────────────────────────────────────────────

@router.post("/flashcards/{note_id}")
async def generate_flashcards(
    note_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = _get_user_note(db, note_id, current_user)

    # Return cached set if exists and not regenerating
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

    # Generate via Workers AI (Llama)
    try:
        cards_data = await workers_flashcards(note.raw_text[:4000])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # Delete old set if regenerating
    if regenerate:
        db.query(FlashcardSet).filter(
            FlashcardSet.note_id == note_id,
            FlashcardSet.owner_id == current_user.id
        ).delete()

    # Save new set to DB
    fc_set = FlashcardSet(
        note_id=note_id,
        title=f"Flashcards: {note.title or 'Untitled'}",
        owner_id=current_user.id,
    )
    db.add(fc_set)
    db.flush()

    for card in cards_data:
        db.add(Flashcard(
            set_id=fc_set.id,
            question=card.get("question", ""),
            answer=card.get("answer", ""),
        ))

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


# ── Summarize ──────────────────────────────────────────────────────────────────

@router.post("/summarize/{note_id}")
async def summarize_note(
    note_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = _get_user_note(db, note_id, current_user)

    # Return cached summary if exists and not regenerating
    if not regenerate and note.ai_summary:
        return {"summary": note.ai_summary, "cached": True}

    # Generate via Workers AI (Llama)
    try:
        summary = await workers_summarize(note.raw_text[:4000])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI summarization failed: {str(e)}")

    # Cache on the note
    note.ai_summary = summary
    db.commit()

    return {"summary": summary, "cached": False}


# ── Explain ────────────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    text: str
    note_id: int | None = None


@router.post("/explain")
async def explain_text(
    request: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    text_to_explain = request.text.strip()

    # Check cache first
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

    # Get surrounding context from note if available
    context = ""
    if request.note_id:
        note = db.query(Note).filter(
            Note.id == request.note_id,
            Note.owner_id == current_user.id
        ).first()
        if note and note.raw_text:
            raw = note.raw_text
            idx = raw.lower().find(text_to_explain.lower())
            if idx != -1:
                start = max(0, idx - 300)
                end = min(len(raw), idx + len(text_to_explain) + 300)
                context = raw[start:end]
            else:
                context = raw[:600]

    # Generate via Workers AI (Llama)
    try:
        explanation = await workers_explain(text_to_explain, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI explanation failed: {str(e)}")

    # Cache it if note_id was provided
    if request.note_id:
        db.add(AIExplanation(
            note_id=request.note_id,
            owner_id=current_user.id,
            highlighted_text=text_to_explain,
            explanation=explanation
        ))
        db.commit()

    return {
        "explanation": explanation,
        "highlighted_text": text_to_explain,
        "cached": False
    }


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