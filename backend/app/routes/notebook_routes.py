from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.controllers.auth_controller import get_current_user
from app.controllers.notebook_controller import notebook_controller
from app.schemas.notebook_schema import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    AddNoteToNotebook
)

router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_notebook(
    data: NotebookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new notebook."""
    notebook = notebook_controller.create_notebook(db, data, current_user)
    return {
        "id": notebook.id,
        "name": notebook.name,
        "color": notebook.color,
        "owner_id": notebook.owner_id,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "note_count": 0
    }


@router.get("/", response_model=List[dict])
def get_notebooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all notebooks for current user."""
    return notebook_controller.get_notebooks(db, current_user)


@router.get("/{notebook_id}", response_model=dict)
def get_notebook(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a notebook with its notes."""
    return notebook_controller.get_notebook_with_notes(db, notebook_id, current_user)


@router.put("/{notebook_id}", response_model=dict)
def update_notebook(
    notebook_id: int,
    data: NotebookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a notebook."""
    notebook = notebook_controller.update_notebook(db, notebook_id, data, current_user)
    return {
        "id": notebook.id,
        "name": notebook.name,
        "color": notebook.color,
        "owner_id": notebook.owner_id,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "note_count": len(notebook.notes) if notebook.notes else 0
    }


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notebook (notes are NOT deleted)."""
    notebook_controller.delete_notebook(db, notebook_id, current_user)


@router.post("/{notebook_id}/notes", response_model=dict)
def add_note_to_notebook(
    notebook_id: int,
    data: AddNoteToNotebook,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a note to a notebook."""
    return notebook_controller.add_note_to_notebook(db, notebook_id, data.note_id, current_user)


@router.delete("/{notebook_id}/notes/{note_id}", response_model=dict)
def remove_note_from_notebook(
    notebook_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a note from a notebook."""
    return notebook_controller.remove_note_from_notebook(db, notebook_id, note_id, current_user)


@router.get("/{notebook_id}/available-notes", response_model=List[dict])
def get_available_notes(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notes not in this notebook (for adding notes UI)."""
    return notebook_controller.get_notes_not_in_notebook(db, notebook_id, current_user)
