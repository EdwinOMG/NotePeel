from sqlalchemy import Column, Integer, String, Text, LargeBinary, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class ProcessingStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)

    # REMOVED: original_image = Column(LargeBinary, nullable=False)

    # R2 blob storage
    image_key = Column(String(500), nullable=True)    # R2 object key
    image_url = Column(String(1000), nullable=True)   # presigned URL (refreshed on access)

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

    # Sharing
    share_token = Column(String(36), unique=True, index=True, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    # Foreign key
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="notes")
    
    # Relationship to notebooks (many-to-many)
    notebooks = relationship("Notebook", secondary="note_notebooks", back_populates="notes")
