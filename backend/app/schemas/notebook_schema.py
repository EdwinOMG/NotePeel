from pydantic import BaseModel, ConfigDict # Added ConfigDict
from typing import Optional, List
from datetime import datetime

class NotebookCreate(BaseModel):
    name: str
    color: Optional[str] = "#FFC107"

class NotebookUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class NotebookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True) # Updated

    id: int
    name: str
    color: str
    owner_id: int
    created_at: datetime
    updated_at: datetime
    note_count: int = 0

class NotebookWithNotes(NotebookResponse):
    # This inherits from NotebookResponse, so it's already "Configured",
    # but adding it again explicitly is fine for clarity.
    model_config = ConfigDict(from_attributes=True)
    
    note_ids: List[int] = []

class AddNoteToNotebook(BaseModel):
    note_id: int

class AddNotesToNotebook(BaseModel):
    note_ids: List[int]