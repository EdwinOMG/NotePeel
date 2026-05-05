from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

# Many-to-many association table for notes and notebooks
note_notebooks = Table(
    'note_notebooks',
    Base.metadata,
    Column('note_id', Integer, ForeignKey('notes.id', ondelete='CASCADE'), primary_key=True),
    Column('notebook_id', Integer, ForeignKey('notebooks.id', ondelete='CASCADE'), primary_key=True)
)


class CollaboratorRole(str, enum.Enum):
    VIEWER = "viewer"
    EDITOR = "editor"


class NotebookCollaborator(Base):
    """Tracks users who have been invited to collaborate on a notebook."""
    __tablename__ = "notebook_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(CollaboratorRole), default=CollaboratorRole.VIEWER, nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    notebook = relationship("Notebook", back_populates="collaborators")
    user = relationship("User", back_populates="shared_notebooks")


class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(7), default="#FFC107")  # Hex color code
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="notebooks")
    notes = relationship("Note", secondary=note_notebooks, back_populates="notebooks")
    collaborators = relationship("NotebookCollaborator", back_populates="notebook", cascade="all, delete-orphan")
