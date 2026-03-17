from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NoteUpdate(BaseModel):
    """Schema for updating a note."""
    title: Optional[str] = None
    structured_text: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    tags: Optional[str] = None


class NoteResponse(BaseModel):
    """Schema for note response."""
    id: int
    title: Optional[str]
    image_filename: Optional[str]
    status: str
    created_at: datetime
    subject: Optional[str] = None
    topic: Optional[str] = None
    
    class Config:
        from_attributes = True


class NoteWithText(BaseModel):
    """Schema for note with text content."""
    id: int
    title: Optional[str]
    raw_text: Optional[str]
    structured_text: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class NoteWithImage(BaseModel):
    """Schema for note with image."""
    id: int
    title: Optional[str]
    image_filename: Optional[str]
    image_mimetype: Optional[str]
    image_base64: str
    raw_text: Optional[str]
    structured_text: Optional[str]
    subject: Optional[str] = None
    topic: Optional[str] = None
    tags: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
