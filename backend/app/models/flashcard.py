from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class FlashcardSet(Base):
    """A set of flashcards generated from a note."""
    __tablename__ = "flashcard_sets"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    cards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")
    note = relationship("Note")
    owner = relationship("User")


class Flashcard(Base):
    """Individual flashcard with question and answer."""
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(Integer, ForeignKey("flashcard_sets.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)

    flashcard_set = relationship("FlashcardSet", back_populates="cards")


class AISummary(Base):
    """Cached AI summary for a note."""
    __tablename__ = "ai_summaries"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, unique=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    summary = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    note = relationship("Note")
    owner = relationship("User")


class AIExplanation(Base):
    """Cached AI explanation for highlighted text."""
    __tablename__ = "ai_explanations"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    highlighted_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    note = relationship("Note")
    owner = relationship("User")
