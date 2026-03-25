from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.note_schema import NoteUpdate
from app.models.user import User
from app.controllers.note_controller import note_controller
from app.controllers.auth_controller import get_current_user

router = APIRouter(prefix="/api/notes", tags=["Notes"])


@router.post("/upload")
async def upload_note(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    note_type: str = Query(default="default", enum=["default", "lecture", "meeting"]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload and process a note with Gemini AI."""
    note = await note_controller.create_note(db, file, current_user, title, note_type)
    return {
        "id": note.id,
        "title": note.title,
        "image_filename": note.image_filename,
        "status": note_controller._get_public_status(note),
        "created_at": note.created_at,
        "processed_at": note.processed_at,
        "raw_text": note.raw_text,
        "structured_text": note.structured_text,
        "error_message": note.error_message,
    }


@router.get("/")
def get_notes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all notes for current user."""
    notes = note_controller.get_notes(db, current_user, skip, limit)
    return [
        {
            "id": n.id,
            "title": n.title,
            "image_filename": n.image_filename,
            "status": note_controller._get_public_status(n),
            "created_at": n.created_at,
            "subject": n.subject,
            "topic": n.topic,
            "tags": n.tags
        }
        for n in notes
    ]


@router.get("/search")
def search_notes(
    q: str = Query(default="", description="Search query"),
    subject: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search notes by text, subject, topic, or tags."""
    notes = note_controller.search_notes(db, current_user, q, subject, topic)
    return [
        {
            "id": n.id,
            "title": n.title,
            "image_filename": n.image_filename,
            "status": note_controller._get_public_status(n),
            "created_at": n.created_at,
            "subject": n.subject,
            "topic": n.topic,
            "tags": n.tags
        }
        for n in notes
    ]


@router.get("/categories")
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all subjects, topics, and tags for the current user."""
    return note_controller.get_subjects_and_topics(db, current_user)


@router.get("/{note_id}")
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific note."""
    note = note_controller.get_note(db, note_id, current_user)
    return {
        "id": note.id,
        "title": note.title,
        "raw_text": note.raw_text,
        "structured_text": note.structured_text,
        "status": note_controller._get_public_status(note),
        "created_at": note.created_at
    }


@router.get("/{note_id}/full")
def get_note_full(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a note with image."""
    return note_controller.get_note_with_image(db, note_id, current_user)


@router.put("/{note_id}")
def update_note(
    note_id: int,
    update_data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a note."""
    note = note_controller.update_note(db, note_id, update_data, current_user)
    return {"message": "Note updated", "id": note.id}


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a note."""
    note_controller.delete_note(db, note_id, current_user)
    return {"message": "Note deleted"}


@router.post("/{note_id}/reprocess")
def reprocess_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Re-run OCR on the stored image and return the result without saving.
    The client decides whether to apply or discard it."""
    return note_controller.reprocess_note(db, note_id, current_user)
