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
