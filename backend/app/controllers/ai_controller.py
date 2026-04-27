from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.note import Note
from app.models.ai_models import FlashcardSet, Flashcard, AISummary, AIExplanation
from app.models.user import User
from app.services.workers_ai import (
    summarize_note,
    explain_highlight,
    generate_flashcards,
    categorize_note,
)
from app.services.usage_service import usage_service


class AIController:

    # ── Flashcards ─────────────────────────────────────────────────────────────

    @staticmethod
    async def get_or_generate_flashcards(
        db: Session,
        note_id: int,
        user: User,
        regenerate: bool = False
    ) -> dict:
        usage_service.assert_feature_allowed(user, "flashcards")

        note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id).first()
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
        if not note.raw_text:
            raise HTTPException(status_code=400, detail="Note has no text content")

        if not regenerate:
            existing = db.query(FlashcardSet).filter(FlashcardSet.note_id == note_id).first()
            if existing:
                return {"title": existing.title, "cards": [{"question": c.question, "answer": c.answer} for c in existing.cards], "cached": True}

        usage_service.assert_budget_available(db, user, "flashcards")
        cards_data, tokens_used = await generate_flashcards(note.raw_text)

        # 1. Update Usage (This internal logic should ideally use db.flush() instead of commit)
        usage_service.record_usage(db, user, "flashcards", tokens_used, weight=0.5)

        # 2. Clear old set
        db.query(FlashcardSet).filter(FlashcardSet.note_id == note_id).delete()

        # 3. Create new set
        flashcard_set = FlashcardSet(
            note_id=note_id,
            owner_id=user.id,
            title=f"Flashcards: {note.title or 'Untitled'}"
        )
        db.add(flashcard_set)
        db.flush() # Get the flashcard_set.id without committing yet

        for card in cards_data:
            db.add(Flashcard(set_id=flashcard_set.id, question=card.get("question", ""), answer=card.get("answer", "")))

        # 4. Final Atomic Commit (Saves usage + flashcards at once)
        db.commit()
        db.refresh(flashcard_set)

        return {"title": flashcard_set.title, "cards": [{"question": c.question, "answer": c.answer} for c in flashcard_set.cards], "cached": False}
   
    @staticmethod
    async def get_or_generate_summary(db: Session, note_id: int, user: User, regenerate: bool = False) -> dict:
        usage_service.assert_feature_allowed(user, "summarize")

        note = db.query(Note).filter(Note.id == note_id, Note.owner_id == user.id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        if not regenerate:
            existing = db.query(AISummary).filter(AISummary.note_id == note_id).first()
            if existing:
                return {"summary": existing.summary, "cached": True}

        usage_service.assert_budget_available(db, user, "summarize")
        summary_text, tokens_used = await summarize_note(note.raw_text)

        # Record usage and then update cache in one transaction
        usage_service.record_usage(db, user, "summarize", tokens_used, weight=0.5)

        db.query(AISummary).filter(AISummary.note_id == note_id).delete()
        db.add(AISummary(note_id=note_id, owner_id=user.id, summary=summary_text))
        
        db.commit()
        return {"summary": summary_text, "cached": False}

    # ── Explanations ───────────────────────────────────────────────────────────

    @staticmethod
    async def explain(db: Session, highlighted_text: str, user: User, note_id: Optional[int] = None) -> dict:
        usage_service.assert_feature_allowed(user, "explain")

        # Check Cache
        existing = db.query(AIExplanation).filter(
            AIExplanation.owner_id == user.id, 
            AIExplanation.highlighted_text == highlighted_text
        ).first()
        if existing:
            return {"highlighted_text": existing.highlighted_text, "explanation": existing.explanation, "cached": True}

        usage_service.assert_budget_available(db, user, "explain")

        # Build Context logic...
        context = ""
        if note_id:
            note = db.query(Note).filter(Note.id == note_id).first()
            if note and note.raw_text:
                # ... (keep your context extraction logic here) ...
                context = note.raw_text[:600] 

        explanation_text, tokens_used = await explain_highlight(highlighted_text, context)

        # 🟢 THE FIX: Call usage service
        usage_service.record_usage(db, user, "explain", tokens_used, weight=0.5)
        
        # Cache Result
        db.add(AIExplanation(
            note_id=note_id,
            owner_id=user.id,
            highlighted_text=highlighted_text,
            explanation=explanation_text
        ))
        
        # Commit everything
        db.commit()

        return {"highlighted_text": highlighted_text, "explanation": explanation_text, "cached": False}

    @staticmethod
    def get_explanations(db: Session, note_id: int, user: User) -> list:
        explanations = db.query(AIExplanation).filter(
            AIExplanation.note_id == note_id,
            AIExplanation.owner_id == user.id
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

    # ── Auto-categorize (called during note upload) ────────────────────────────

    @staticmethod
    async def auto_categorize(db: Session, note: Note) -> None:
        """
        Called after OCR completes. No user-facing rate limit applied here
        because it's server-triggered, not user-triggered. Silently fails
        so it never breaks upload.
        """
        if not note.raw_text:
            return
        try:
            cats = await categorize_note(note.raw_text)
            note.subject = cats.get("subject")
            note.topic = cats.get("topic")
            tags = cats.get("tags", [])
            note.tags = ", ".join(tags) if isinstance(tags, list) else str(tags)
            db.commit()
        except Exception:
            pass


ai_controller = AIController()