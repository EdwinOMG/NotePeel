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
        # 1. Feature gate — free users cannot access flashcards at all
        usage_service.assert_feature_allowed(user, "flashcards")

        note = db.query(Note).filter(
            Note.id == note_id,
            Note.owner_id == user.id
        ).first()
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        if not note.raw_text:
            raise HTTPException(status_code=400, detail="Note has no text content to generate flashcards from")

        # 2. Return cached result — no token cost
        if not regenerate:
            existing = db.query(FlashcardSet).filter(
                FlashcardSet.note_id == note_id,
                FlashcardSet.owner_id == user.id
            ).first()
            if existing:
                return {
                    "title": existing.title,
                    "cards": [{"question": c.question, "answer": c.answer} for c in existing.cards],
                    "cached": True
                }

        # 3. Token budget check — before hitting Workers AI
        usage_service.assert_budget_available(db, user, "flashcards")

        # 4. Call Workers AI
        cards_data, tokens_used = await generate_flashcards(note.raw_text)

        # 5. Record real usage
        usage_service.record_usage(db, user, "flashcards", tokens_used, weight=0.5)

        # 6. Persist results
        db.query(FlashcardSet).filter(
            FlashcardSet.note_id == note_id,
            FlashcardSet.owner_id == user.id
        ).delete()
        db.commit()

        flashcard_set = FlashcardSet(
            note_id=note_id,
            owner_id=user.id,
            title=f"Flashcards: {note.title or 'Untitled'}"
        )
        db.add(flashcard_set)
        db.flush()

        for card in cards_data:
            db.add(Flashcard(
                set_id=flashcard_set.id,
                question=card.get("question", ""),
                answer=card.get("answer", "")
            ))

        db.commit()
        db.refresh(flashcard_set)

        return {
            "title": flashcard_set.title,
            "cards": [{"question": c.question, "answer": c.answer} for c in flashcard_set.cards],
            "cached": False
        }

    # ── Summaries ──────────────────────────────────────────────────────────────

    @staticmethod
    async def get_or_generate_summary(
        db: Session,
        note_id: int,
        user: User,
        regenerate: bool = False
    ) -> dict:
        # 1. Feature gate
        usage_service.assert_feature_allowed(user, "summarize")

        note = db.query(Note).filter(
            Note.id == note_id,
            Note.owner_id == user.id
        ).first()
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        if not note.raw_text:
            raise HTTPException(status_code=400, detail="Note has no text content to summarize")

        # 2. Return cache — free
        if not regenerate:
            existing = db.query(AISummary).filter(
                AISummary.note_id == note_id,
                AISummary.owner_id == user.id
            ).first()
            if existing:
                return {"summary": existing.summary, "cached": True}

        # 3. Budget check
        usage_service.assert_budget_available(db, user, "summarize")

        # 4. Call Workers AI
        summary_text, tokens_used = await summarize_note(note.raw_text)

        # 5. Record usage
        usage_service.record_usage(db, user, "summarize", tokens_used, weight=0.5)

        # 6. Upsert cache
        db.query(AISummary).filter(
            AISummary.note_id == note_id,
            AISummary.owner_id == user.id
        ).delete()

        db.add(AISummary(
            note_id=note_id,
            owner_id=user.id,
            summary=summary_text
        ))
        db.commit()

        return {"summary": summary_text, "cached": False}

    # ── Explanations ───────────────────────────────────────────────────────────

    @staticmethod
    async def explain(
        db: Session,
        highlighted_text: str,
        user: User,
        note_id: Optional[int] = None
    ) -> dict:
        # 1. Feature gate
        usage_service.assert_feature_allowed(user, "explain")

        # 2. Return cache — free
        query = db.query(AIExplanation).filter(
            AIExplanation.owner_id == user.id,
            AIExplanation.highlighted_text == highlighted_text
        )
        if note_id:
            query = query.filter(AIExplanation.note_id == note_id)

        existing = query.first()
        if existing:
            return {
                "highlighted_text": existing.highlighted_text,
                "explanation": existing.explanation,
                "cached": True
            }

        # 3. Budget check
        usage_service.assert_budget_available(db, user, "explain")

        # 4. Build context window
        context = ""
        if note_id:
            note = db.query(Note).filter(
                Note.id == note_id,
                Note.owner_id == user.id
            ).first()
            if note and note.raw_text:
                raw = note.raw_text
                idx = raw.lower().find(highlighted_text.lower())
                if idx != -1:
                    start = max(0, idx - 300)
                    end = min(len(raw), idx + len(highlighted_text) + 300)
                    context = raw[start:end]
                else:
                    context = raw[:600]

        # 5. Call Workers AI
        explanation_text, tokens_used = await explain_highlight(highlighted_text, context)

        # 6. Record usage
        usage_service.record_usage(db, user, "explain", tokens_used)

        # 7. Cache result
        db.add(AIExplanation(
            note_id=note_id,
            owner_id=user.id,
            highlighted_text=highlighted_text,
            explanation=explanation_text
        ))
        db.commit()

        return {
            "highlighted_text": highlighted_text,
            "explanation": explanation_text,
            "cached": False
        }

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