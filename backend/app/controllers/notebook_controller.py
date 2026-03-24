from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.notebook import Notebook, note_notebooks
from app.models.note import Note
from app.models.user import User
from app.schemas.notebook_schema import NotebookCreate, NotebookUpdate


class NotebookController:
    """Controller for notebook operations."""

    @staticmethod
    def create_notebook(db: Session, data: NotebookCreate, user: User) -> Notebook:
        """Create a new notebook."""
        notebook = Notebook(
            name=data.name,
            color=data.color or "#FFC107",
            owner_id=user.id
        )
        db.add(notebook)
        db.commit()
        db.refresh(notebook)
        return notebook

    @staticmethod
    def get_notebooks(db: Session, user: User) -> List[dict]:
        """Get all notebooks for a user with note counts."""
        notebooks = db.query(Notebook).filter(
            Notebook.owner_id == user.id
        ).order_by(Notebook.updated_at.desc()).all()

        result = []
        for notebook in notebooks:
            # Get note count
            note_count = db.query(func.count(note_notebooks.c.note_id)).filter(
                note_notebooks.c.notebook_id == notebook.id
            ).scalar()

            result.append({
                "id": notebook.id,
                "name": notebook.name,
                "color": notebook.color,
                "owner_id": notebook.owner_id,
                "created_at": notebook.created_at,
                "updated_at": notebook.updated_at,
                "note_count": note_count or 0
            })

        return result

    @staticmethod
    def get_notebook(db: Session, notebook_id: int, user: User) -> Notebook:
        """Get a specific notebook by ID."""
        notebook = db.query(Notebook).filter(
            Notebook.id == notebook_id,
            Notebook.owner_id == user.id
        ).first()

        if not notebook:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notebook not found"
            )

        return notebook

    @staticmethod
    def get_notebook_with_notes(db: Session, notebook_id: int, user: User) -> dict:
        """Get a notebook with its notes."""
        notebook = NotebookController.get_notebook(db, notebook_id, user)

        # Get notes in this notebook (without image data for list view)
        notes = db.query(Note).join(note_notebooks).filter(
            note_notebooks.c.notebook_id == notebook_id,
            Note.owner_id == user.id
        ).order_by(Note.created_at.desc()).all()

        return {
            "id": notebook.id,
            "name": notebook.name,
            "color": notebook.color,
            "owner_id": notebook.owner_id,
            "created_at": notebook.created_at,
            "updated_at": notebook.updated_at,
            "note_count": len(notes),
            "notes": [
                {
                    "id": note.id,
                    "title": note.title,
                    "status": note.status.value if hasattr(note.status, 'value') else str(note.status),
                    "created_at": note.created_at,
                    "processed_at": note.processed_at,
                }
                for note in notes
            ]
        }

    @staticmethod
    def update_notebook(db: Session, notebook_id: int, data: NotebookUpdate, user: User) -> Notebook:
        """Update a notebook."""
        notebook = NotebookController.get_notebook(db, notebook_id, user)

        if data.name is not None:
            notebook.name = data.name
        if data.color is not None:
            notebook.color = data.color

        notebook.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(notebook)
        return notebook

    @staticmethod
    def delete_notebook(db: Session, notebook_id: int, user: User) -> None:
        """Delete a notebook (notes are NOT deleted, just unlinked)."""
        notebook = NotebookController.get_notebook(db, notebook_id, user)
        db.delete(notebook)
        db.commit()

    @staticmethod
    def add_note_to_notebook(db: Session, notebook_id: int, note_id: int, user: User) -> dict:
        """Add a note to a notebook."""
        notebook = NotebookController.get_notebook(db, notebook_id, user)

        # Verify note exists and belongs to user
        note = db.query(Note).filter(
            Note.id == note_id,
            Note.owner_id == user.id
        ).first()

        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )

        # Check if already in notebook
        existing = db.execute(
            note_notebooks.select().where(
                note_notebooks.c.note_id == note_id,
                note_notebooks.c.notebook_id == notebook_id
            )
        ).first()

        if existing:
            return {"message": "Note already in notebook"}

        # Add to notebook
        db.execute(
            note_notebooks.insert().values(note_id=note_id, notebook_id=notebook_id)
        )
        notebook.updated_at = datetime.utcnow()
        db.commit()

        return {"message": "Note added to notebook"}

    @staticmethod
    def remove_note_from_notebook(db: Session, notebook_id: int, note_id: int, user: User) -> dict:
        """Remove a note from a notebook."""
        notebook = NotebookController.get_notebook(db, notebook_id, user)

        # Remove from association table
        db.execute(
            note_notebooks.delete().where(
                note_notebooks.c.note_id == note_id,
                note_notebooks.c.notebook_id == notebook_id
            )
        )
        notebook.updated_at = datetime.utcnow()
        db.commit()

        return {"message": "Note removed from notebook"}

    @staticmethod
    def get_notes_not_in_notebook(db: Session, notebook_id: int, user: User) -> List[dict]:
        """Get all notes NOT in a specific notebook (for adding notes UI)."""
        # Get note IDs already in this notebook
        in_notebook = db.query(note_notebooks.c.note_id).filter(
            note_notebooks.c.notebook_id == notebook_id
        ).subquery()

        # Get notes not in this notebook
        notes = db.query(Note).filter(
            Note.owner_id == user.id,
            ~Note.id.in_(in_notebook)
        ).order_by(Note.created_at.desc()).all()

        return [
            {
                "id": note.id,
                "title": note.title,
                "status": note.status.value if hasattr(note.status, 'value') else str(note.status),
                "created_at": note.created_at,
            }
            for note in notes
        ]


notebook_controller = NotebookController()
