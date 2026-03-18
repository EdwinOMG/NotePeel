from sqlalchemy import Column, Integer, String, Text, LargeBinary, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class ProcessingStatus(enum.Enum):
    """Status of note processing."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Note(Base):
    """Note model for storing handwritten notes."""
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    
    # Original image
    original_image = Column(LargeBinary, nullable=False)
    image_filename = Column(String(255), nullable=True)
    image_mimetype = Column(String(100), nullable=True)
    
    # Extracted text
    raw_text = Column(Text, nullable=True)
    structured_text = Column(Text, nullable=True)
    
    # AI-generated content (cached)
    ai_summary = Column(Text, nullable=True)
    
    # Organization
    subject = Column(String(100), nullable=True)
    topic = Column(String(100), nullable=True)
    tags = Column(String(500), nullable=True)
    
    # Processing status
    status = Column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    # Foreign key
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationship
    owner = relationship("User", back_populates="notes")
    
    # Relationship to notebooks (many-to-many)
    notebooks = relationship("Notebook", secondary="note_notebooks", back_populates="notes")
