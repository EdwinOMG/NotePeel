from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException, status

from app.models.notebook import Notebook, note_notebooks, NotebookCollaborator, CollaboratorRole
from app.models.note import Note
from app.models.user import User
from app.schemas.notebook_schema import NotebookCreate, NotebookUpdate


class NotebookController:
    """Controller for notebook operations."""

    # ── Helpers ────────────────────────────────────────────────

    @staticmethod
    def _get_owned_notebook(db: Session, notebook_id: int, user: User) -> Notebook:
        """Get a notebook that the user OWNS (not just collaborates on)."""
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
    def _get_accessible_notebook(db: Session, notebook_id: int, user: User) -> Notebook:
        """Get a notebook the user can access (owner OR collaborator)."""
        notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
        if not notebook:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")

        if notebook.owner_id == user.id:
            return notebook

        collab = db.query(NotebookCollaborator).filter(
            NotebookCollaborator.notebook_id == notebook_id,
            NotebookCollaborator.user_id == user.id
        ).first()
        if not collab:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")

        return notebook

    @staticmethod
    def _get_user_role(db: Session, notebook: Notebook, user: User) -> Optional[str]:
        """Return 'owner', 'editor', 'viewer', or None."""
        if notebook.owner_id == user.id:
            return "owner"
        collab = db.query(NotebookCollaborator).filter(
            NotebookCollaborator.notebook_id == notebook.id,
            NotebookCollaborator.user_id == user.id
        ).first()
        if collab:
            return collab.role.value
        return None

    @staticmethod
    def _require_editor(db: Session, notebook: Notebook, user: User):
        """Raise 403 unless user is owner or editor."""
        role = NotebookController._get_user_role(db, notebook, user)
        if role not in ("owner", "editor"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have edit access")

    @staticmethod
    def _notebook_to_dict(db: Session, notebook: Notebook, user: User) -> dict:
        """Serialize a notebook with note count and role info."""
        note_count = db.query(func.count(note_notebooks.c.note_id)).filter(
            note_notebooks.c.notebook_id == notebook.id
        ).scalar() or 0

        collab_count = db.query(func.count(NotebookCollaborator.id)).filter(
            NotebookCollaborator.notebook_id == notebook.id
        ).scalar() or 0

        role = NotebookController._get_user_role(db, notebook, user)

        owner = db.query(User).filter(User.id == notebook.owner_id).first()

        return {
            "id": notebook.id,
            "name": notebook.name,
            "color": notebook.color,
            "owner_id": notebook.owner_id,
            "owner_email": owner.email if owner else None,
            "owner_username": owner.username if owner else None,
            "created_at": notebook.created_at,
            "updated_at": notebook.updated_at,
            "note_count": note_count,
            "collaborator_count": collab_count,
            "role": role,
            "is_shared": collab_count > 0,
        }

    # ── CRUD ──────────────────────────────────────────────────

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
        """Get all notebooks the user owns OR collaborates on."""
        owned = db.query(Notebook).filter(Notebook.owner_id == user.id).all()

        shared_ids = db.query(NotebookCollaborator.notebook_id).filter(
            NotebookCollaborator.user_id == user.id
        ).subquery()
        shared = db.query(Notebook).filter(Notebook.id.in_(shared_ids)).all()

        all_notebooks = {nb.id: nb for nb in owned}
        for nb in shared:
            all_notebooks[nb.id] = nb

        result = [
            NotebookController._notebook_to_dict(db, nb, user)
            for nb in sorted(all_notebooks.values(), key=lambda n: n.updated_at or n.created_at, reverse=True)
        ]
        return result

    @staticmethod
    def get_notebook(db: Session, notebook_id: int, user: User) -> Notebook:
        """Get a specific notebook by ID (owner or collaborator)."""
        return NotebookController._get_accessible_notebook(db, notebook_id, user)

    @staticmethod
    def get_notebook_with_notes(db: Session, notebook_id: int, user: User) -> dict:
        """Get a notebook with its notes."""
        notebook = NotebookController._get_accessible_notebook(db, notebook_id, user)
        role = NotebookController._get_user_role(db, notebook, user)

        notes = db.query(Note).join(note_notebooks).filter(
            note_notebooks.c.notebook_id == notebook_id,
        ).order_by(Note.created_at.desc()).all()

        collabs = db.query(NotebookCollaborator, User).join(
            User, NotebookCollaborator.user_id == User.id
        ).filter(
            NotebookCollaborator.notebook_id == notebook_id
        ).all()

        owner = db.query(User).filter(User.id == notebook.owner_id).first()

        return {
            "id": notebook.id,
            "name": notebook.name,
            "color": notebook.color,
            "owner_id": notebook.owner_id,
            "owner_email": owner.email if owner else None,
            "owner_username": owner.username if owner else None,
            "created_at": notebook.created_at,
            "updated_at": notebook.updated_at,
            "note_count": len(notes),
            "role": role,
            "is_shared": len(collabs) > 0,
            "collaborators": [
                {
                    "id": collab.id,
                    "user_id": u.id,
                    "email": u.email,
                    "username": u.username,
                    "profile_picture": u.profile_picture,
                    "role": collab.role.value,
                    "added_at": collab.added_at,
                }
                for collab, u in collabs
            ],
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
        """Update a notebook (owner or editor)."""
        notebook = NotebookController._get_accessible_notebook(db, notebook_id, user)
        NotebookController._require_editor(db, notebook, user)

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
        """Delete a notebook (owner only)."""
        notebook = NotebookController._get_owned_notebook(db, notebook_id, user)
        db.delete(notebook)
        db.commit()

    # ── Notes in notebooks ────────────────────────────────────

    @staticmethod
    def add_note_to_notebook(db: Session, notebook_id: int, note_id: int, user: User) -> dict:
        """Add a note to a notebook (owner or editor)."""
        notebook = NotebookController._get_accessible_notebook(db, notebook_id, user)
        NotebookController._require_editor(db, notebook, user)

        note = db.query(Note).filter(
            Note.id == note_id,
            Note.owner_id == user.id
        ).first()
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        existing = db.execute(
            note_notebooks.select().where(
                note_notebooks.c.note_id == note_id,
                note_notebooks.c.notebook_id == notebook_id
            )
        ).first()
        if existing:
            return {"message": "Note already in notebook"}

        db.execute(note_notebooks.insert().values(note_id=note_id, notebook_id=notebook_id))
        notebook.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Note added to notebook"}

    @staticmethod
    def remove_note_from_notebook(db: Session, notebook_id: int, note_id: int, user: User) -> dict:
        """Remove a note from a notebook (owner or editor)."""
        notebook = NotebookController._get_accessible_notebook(db, notebook_id, user)
        NotebookController._require_editor(db, notebook, user)

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
        NotebookController._get_accessible_notebook(db, notebook_id, user)

        in_notebook = db.query(note_notebooks.c.note_id).filter(
            note_notebooks.c.notebook_id == notebook_id
        ).subquery()

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

    # ── Collaboration ─────────────────────────────────────────

    @staticmethod
    def add_collaborator(db: Session, notebook_id: int, email: str, role: str, user: User) -> dict:
        """Add a collaborator to a notebook (owner only)."""
        notebook = NotebookController._get_owned_notebook(db, notebook_id, user)

        target_user = db.query(User).filter(User.email == email).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user found with that email. They need to sign up first."
            )
        if target_user.id == user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't add yourself as a collaborator")

        existing = db.query(NotebookCollaborator).filter(
            NotebookCollaborator.notebook_id == notebook_id,
            NotebookCollaborator.user_id == target_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a collaborator")

        collab_role = CollaboratorRole.EDITOR if role == "editor" else CollaboratorRole.VIEWER
        collab = NotebookCollaborator(
            notebook_id=notebook_id,
            user_id=target_user.id,
            role=collab_role
        )
        db.add(collab)
        notebook.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(collab)

        return {
            "id": collab.id,
            "user_id": target_user.id,
            "email": target_user.email,
            "username": target_user.username,
            "profile_picture": target_user.profile_picture,
            "role": collab.role.value,
            "added_at": collab.added_at,
        }

    @staticmethod
    def update_collaborator_role(db: Session, notebook_id: int, collaborator_id: int, role: str, user: User) -> dict:
        """Update a collaborator's role (owner only)."""
        NotebookController._get_owned_notebook(db, notebook_id, user)

        collab = db.query(NotebookCollaborator).filter(
            NotebookCollaborator.id == collaborator_id,
            NotebookCollaborator.notebook_id == notebook_id
        ).first()
        if not collab:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")

        collab.role = CollaboratorRole.EDITOR if role == "editor" else CollaboratorRole.VIEWER
        db.commit()
        db.refresh(collab)

        target = db.query(User).filter(User.id == collab.user_id).first()
        return {
            "id": collab.id,
            "user_id": collab.user_id,
            "email": target.email if target else "",
            "username": target.username if target else "",
            "profile_picture": target.profile_picture if target else None,
            "role": collab.role.value,
            "added_at": collab.added_at,
        }

    @staticmethod
    def remove_collaborator(db: Session, notebook_id: int, collaborator_id: int, user: User) -> dict:
        """Remove a collaborator (owner only) or leave a notebook (collaborator themselves)."""
        notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
        if not notebook:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")

        collab = db.query(NotebookCollaborator).filter(
            NotebookCollaborator.id == collaborator_id,
            NotebookCollaborator.notebook_id == notebook_id
        ).first()
        if not collab:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")

        if notebook.owner_id != user.id and collab.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can remove collaborators")

        db.delete(collab)
        db.commit()
        return {"message": "Collaborator removed"}

    @staticmethod
    def get_collaborators(db: Session, notebook_id: int, user: User) -> List[dict]:
        """Get all collaborators for a notebook."""
        NotebookController._get_accessible_notebook(db, notebook_id, user)

        collabs = db.query(NotebookCollaborator, User).join(
            User, NotebookCollaborator.user_id == User.id
        ).filter(
            NotebookCollaborator.notebook_id == notebook_id
        ).all()

        return [
            {
                "id": collab.id,
                "user_id": u.id,
                "email": u.email,
                "username": u.username,
                "profile_picture": u.profile_picture,
                "role": collab.role.value,
                "added_at": collab.added_at,
            }
            for collab, u in collabs
        ]


notebook_controller = NotebookController()
