from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class NotebookCreate(BaseModel):
    name: str
    color: Optional[str] = "#FFC107"


class NotebookUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class NotebookResponse(BaseModel):
    id: int
    name: str
    color: str
    owner_id: int
    created_at: datetime
    updated_at: datetime
    note_count: int = 0

    class Config:
        from_attributes = True


class NotebookWithNotes(NotebookResponse):
    note_ids: List[int] = []


class AddNoteToNotebook(BaseModel):
    note_id: int


class AddNotesToNotebook(BaseModel):
    note_ids: List[int]


# ── Collaboration schemas ──────────────────────────────────────

class AddCollaborator(BaseModel):
    email: str
    role: str = "viewer"  # "viewer" or "editor"


class UpdateCollaboratorRole(BaseModel):
    role: str  # "viewer" or "editor"


class CollaboratorResponse(BaseModel):
    id: int
    user_id: int
    email: str
    username: str
    profile_picture: Optional[str] = None
    role: str
    added_at: datetime

    class Config:
        from_attributes = True
