from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.controllers.auth_controller import get_current_user
from app.services import workers_ai
from app.services.usage_service import usage_service

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    role: str       # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    note_id: int
    messages: list[ChatMessage]  # full conversation history including the new user message


@router.post("/{note_id}")
async def chat(
    note_id: int,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Feature gate — Premium only
    usage_service.assert_feature_allowed(current_user, "chat")

    # 2. Budget check
    usage_service.assert_budget_available(db, current_user, "chat")

    # 3. Fetch the note for context
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.owner_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if not note.raw_text:
        raise HTTPException(status_code=400, detail="Note has no text content")

    # 4. Validate message list — must end with a user message
    if not body.messages or body.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from the user")

    # 5. Cap history to last 20 turns to control token growth
    history = [{"role": m.role, "content": m.content} for m in body.messages[-20:]]

    # 6. Call AI
    try:
        reply, tokens_used = await workers_ai.chat_with_note(history, note.raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

    # 7. Record usage — each chat turn counts as 1 full request
    usage_service.record_usage(db, current_user, "chat", tokens_used, weight=1.0)

    return {
        "role": "assistant",
        "content": reply,
        "note_id": note_id,
    }
