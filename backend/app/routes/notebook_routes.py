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
    AddNoteToNotebook,
    AddCollaborator,
    UpdateCollaboratorRole,
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
        "owner_email": current_user.email,
        "owner_username": current_user.username,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "note_count": 0,
        "collaborator_count": 0,
        "role": "owner",
        "is_shared": False,
    }


@router.get("/", response_model=List[dict])
def get_notebooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all notebooks for current user (owned + shared)."""
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
    """Update a notebook (owner or editor)."""
    notebook = notebook_controller.update_notebook(db, notebook_id, data, current_user)
    return {
        "id": notebook.id,
        "name": notebook.name,
        "color": notebook.color,
        "owner_id": notebook.owner_id,
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at,
        "note_count": len(notebook.notes) if notebook.notes else 0,
    }


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notebook (owner only — notes are NOT deleted)."""
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


# ── Collaboration endpoints ──────────────────────────────────

@router.get("/{notebook_id}/collaborators", response_model=List[dict])
def get_collaborators(
    notebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all collaborators for a notebook."""
    return notebook_controller.get_collaborators(db, notebook_id, current_user)


@router.post("/{notebook_id}/collaborators", response_model=dict, status_code=status.HTTP_201_CREATED)
def add_collaborator(
    notebook_id: int,
    data: AddCollaborator,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a collaborator by email (owner only)."""
    return notebook_controller.add_collaborator(db, notebook_id, data.email, data.role, current_user)


@router.put("/{notebook_id}/collaborators/{collaborator_id}", response_model=dict)
def update_collaborator_role(
    notebook_id: int,
    collaborator_id: int,
    data: UpdateCollaboratorRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a collaborator's role (owner only)."""
    return notebook_controller.update_collaborator_role(db, notebook_id, collaborator_id, data.role, current_user)


@router.delete("/{notebook_id}/collaborators/{collaborator_id}", response_model=dict)
def remove_collaborator(
    notebook_id: int,
    collaborator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a collaborator (owner) or leave notebook (self)."""
    return notebook_controller.remove_collaborator(db, notebook_id, collaborator_id, current_user)
