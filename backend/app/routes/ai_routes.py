from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.models.ai_models import FlashcardSet, Flashcard, AISummary, AIExplanation
from app.controllers.auth_controller import get_current_user
from app.services import workers_ai
from app.services.usage_service import usage_service

router = APIRouter(prefix="/api/ai", tags=["AI"])


def _get_user_note(db: Session, note_id: int, user: User) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id).first()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    if not note.raw_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Note has no text content")
    return note


# ── Flashcard Generation ──────────────────────────────────────────────────────

@router.post("/flashcards/{note_id}")
async def generate_flashcards(
    note_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Feature gate — free users cannot access flashcards
    usage_service.assert_feature_allowed(current_user, "flashcards")

    note = _get_user_note(db, note_id, current_user)

    # 2. Return cache (no token cost)
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

    # 3. Budget check before hitting AI
    usage_service.assert_budget_available(db, current_user, "flashcards")

    # 4. Call AI
    try:
        cards_data, tokens_used = await workers_ai.generate_flashcards(note.raw_text[:4000])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    # 5. Record usage (0.5 request weight)
    usage_service.record_usage(db, current_user, "flashcards", tokens_used, weight=0.5)

    # 6. Persist results
    if regenerate:
        db.query(FlashcardSet).filter(
            FlashcardSet.note_id == note_id,
            FlashcardSet.owner_id == current_user.id
        ).delete()

    fc_set = FlashcardSet(
        note_id=note_id,
        title=f"Flashcards for {note.title}",
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


# ── Summarize ─────────────────────────────────────────────────────────────────

@router.post("/summarize/{note_id}")
async def summarize_note(
    note_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Feature gate
    usage_service.assert_feature_allowed(current_user, "summarize")

    note = _get_user_note(db, note_id, current_user)

    # 2. Return cache
    if not regenerate:
        existing = db.query(AISummary).filter(
            AISummary.note_id == note_id,
            AISummary.owner_id == current_user.id
        ).first()
        if existing:
            return {"summary": existing.summary, "cached": True}

    # 3. Budget check
    usage_service.assert_budget_available(db, current_user, "summarize")

    # 4. Call AI
    try:
        summary_text, tokens_used = await workers_ai.summarize_note(note.raw_text[:4000])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI summarization failed: {str(e)}")

    # 5. Record usage (0.5 request weight)
    usage_service.record_usage(db, current_user, "summarize", tokens_used, weight=0.5)

    # 6. Cache result
    db.query(AISummary).filter(
        AISummary.note_id == note_id,
        AISummary.owner_id == current_user.id
    ).delete()
    db.add(AISummary(note_id=note_id, owner_id=current_user.id, summary=summary_text))
    db.commit()

    return {"summary": summary_text, "cached": False}


# ── Explain ───────────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    text: str
    note_id: int | None = None


@router.post("/explain")
async def explain_text(
    request: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Feature gate
    usage_service.assert_feature_allowed(current_user, "explain")

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    text_to_explain = request.text.strip()

    # 2. Return cache
    query = db.query(AIExplanation).filter(
        AIExplanation.owner_id == current_user.id,
        AIExplanation.highlighted_text == text_to_explain
    )
    if request.note_id:
        query = query.filter(AIExplanation.note_id == request.note_id)
    existing = query.first()
    if existing:
        return {
            "explanation": existing.explanation,
            "highlighted_text": existing.highlighted_text,
            "cached": True
        }

    # 3. Budget check
    usage_service.assert_budget_available(db, current_user, "explain")

    # 4. Build context
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

    # 5. Call AI
    try:
        explanation_text, tokens_used = await workers_ai.explain_highlight(text_to_explain[:500], context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI explanation failed: {str(e)}")

    # 6. Record usage (0.5 request weight)
    usage_service.record_usage(db, current_user, "explain", tokens_used, weight=0.5)

    # 7. Cache result
    if request.note_id:
        db.add(AIExplanation(
            note_id=request.note_id,
            owner_id=current_user.id,
            highlighted_text=text_to_explain,
            explanation=explanation_text
        ))
        db.commit()

    return {"explanation": explanation_text, "highlighted_text": text_to_explain, "cached": False}


@router.get("/explanations/{note_id}")
def get_explanations(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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


# ── Categorize ────────────────────────────────────────────────────────────────

@router.post("/categorize/{note_id}")
async def categorize_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = _get_user_note(db, note_id, current_user)

    if note.subject and note.topic and note.tags:
        return {
            "subject": note.subject,
            "topic": note.topic,
            "tags": note.tags.split(",") if note.tags else [],
            "cached": True
        }

    try:
        result = await workers_ai.categorize_note(note.raw_text[:4000])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI categorization failed: {str(e)}")

    note.subject = result.get("subject", "")
    note.topic = result.get("topic", "")
    tags = result.get("tags", [])
    note.tags = ",".join(tags) if isinstance(tags, list) else str(tags)
    db.commit()

    return {"subject": note.subject, "topic": note.topic, "tags": tags, "cached": False}