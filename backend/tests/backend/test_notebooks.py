"""
Tests for NotebookController.
Run with: pytest tests/backend/test_notebooks.py -v
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.controllers.notebook_controller import NotebookController
from app.models.notebook import Notebook
from app.models.note import Note, ProcessingStatus
from app.models.user import User
from app.schemas.notebook_schema import NotebookCreate, NotebookUpdate


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def db():
    return MagicMock()

@pytest.fixture
def user():
    u = User()
    u.id = 1
    u.email = "test@example.com"
    return u

@pytest.fixture
def sample_notebook():
    nb = Notebook()
    nb.id = 1
    nb.name = "Biology Notes"
    nb.color = "#1a1a2e"
    nb.owner_id = 1
    return nb

@pytest.fixture
def sample_note():
    note = Note()
    note.id = 1
    note.title = "Mitosis Notes"
    note.status = ProcessingStatus.COMPLETED
    note.owner_id = 1
    return note


# ── create_notebook ───────────────────────────────────────────────────────────

class TestCreateNotebook:
    def test_create_notebook_success(self, db, user):
        db.refresh.side_effect = lambda n: setattr(n, 'id', 1)
        data = NotebookCreate(name="My Notebook", color="#533483")
        result = NotebookController.create_notebook(db, data, user)
        assert db.add.called
        assert db.commit.called
        assert result.name == "My Notebook"
        assert result.color == "#533483"
        assert result.owner_id == user.id

    def test_create_notebook_default_color(self, db, user):
        db.refresh.side_effect = lambda n: None
        data = NotebookCreate(name="My Notebook")
        result = NotebookController.create_notebook(db, data, user)
        assert result.color == "#FFC107"


# ── get_notebook ──────────────────────────────────────────────────────────────

class TestGetNotebook:
    def test_get_notebook_found(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.first.return_value = sample_notebook
        result = NotebookController.get_notebook(db, 1, user)
        assert result == sample_notebook

    def test_get_notebook_not_found_raises(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            NotebookController.get_notebook(db, 999, user)
        assert exc.value.status_code == 404

    def test_get_notebook_wrong_owner_raises(self, db, sample_notebook):
        other_user = User()
        other_user.id = 99
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            NotebookController.get_notebook(db, 1, other_user)
        assert exc.value.status_code == 404


# ── get_notebooks ─────────────────────────────────────────────────────────────

class TestGetNotebooks:
    def test_returns_list_with_note_counts(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_notebook]
        db.query.return_value.filter.return_value.scalar.return_value = 3

        results = NotebookController.get_notebooks(db, user)
        assert isinstance(results, list)
        assert len(results) == 1
        assert "note_count" in results[0]
        assert results[0]["name"] == "Biology Notes"

    def test_returns_empty_list_when_none(self, db, user):
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        results = NotebookController.get_notebooks(db, user)
        assert results == []


# ── update_notebook ───────────────────────────────────────────────────────────

class TestUpdateNotebook:
    def test_update_name(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.first.return_value = sample_notebook
        db.refresh.side_effect = lambda n: None

        data = NotebookUpdate(name="Updated Name")
        result = NotebookController.update_notebook(db, 1, data, user)
        assert result.name == "Updated Name"
        assert db.commit.called

    def test_update_color(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.first.return_value = sample_notebook
        db.refresh.side_effect = lambda n: None

        data = NotebookUpdate(color="#e94560")
        result = NotebookController.update_notebook(db, 1, data, user)
        assert result.color == "#e94560"

    def test_update_nonexistent_notebook_raises(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        data = NotebookUpdate(name="Won't work")
        with pytest.raises(HTTPException) as exc:
            NotebookController.update_notebook(db, 999, data, user)
        assert exc.value.status_code == 404


# ── delete_notebook ───────────────────────────────────────────────────────────

class TestDeleteNotebook:
    def test_delete_notebook_success(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.first.return_value = sample_notebook
        NotebookController.delete_notebook(db, 1, user)
        db.delete.assert_called_once_with(sample_notebook)
        db.commit.assert_called()

    def test_delete_notebook_not_found_raises(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            NotebookController.delete_notebook(db, 999, user)
        assert exc.value.status_code == 404


# ── add_note_to_notebook ──────────────────────────────────────────────────────

class TestAddNoteToNotebook:
    def test_add_note_success(self, db, user, sample_notebook, sample_note):
        db.query.return_value.filter.return_value.first.side_effect = [sample_notebook, sample_note]
        db.execute.return_value.first.return_value = None  # Not already in notebook

        result = NotebookController.add_note_to_notebook(db, 1, 1, user)
        assert "message" in result
        assert db.commit.called

    def test_add_note_already_in_notebook(self, db, user, sample_notebook, sample_note):
        db.query.return_value.filter.return_value.first.side_effect = [sample_notebook, sample_note]
        db.execute.return_value.first.return_value = MagicMock()  # Already in notebook

        result = NotebookController.add_note_to_notebook(db, 1, 1, user)
        assert "already" in result["message"].lower()

    def test_add_nonexistent_note_raises(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.first.side_effect = [sample_notebook, None]
        db.execute.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            NotebookController.add_note_to_notebook(db, 1, 999, user)
        assert exc.value.status_code == 404


# ── remove_note_from_notebook ─────────────────────────────────────────────────

class TestRemoveNoteFromNotebook:
    def test_remove_note_success(self, db, user, sample_notebook):
        db.query.return_value.filter.return_value.first.return_value = sample_notebook
        result = NotebookController.remove_note_from_notebook(db, 1, 1, user)
        assert "message" in result
        assert db.execute.called
        assert db.commit.called


# ── get_notes_not_in_notebook ─────────────────────────────────────────────────

class TestGetAvailableNotes:
    def test_returns_notes_not_in_notebook(self, db, user, sample_note):
        # Simulate subquery + filter returning one available note
        mock_subquery = MagicMock()
        db.query.return_value.filter.return_value.subquery.return_value = mock_subquery
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_note]

        results = NotebookController.get_notes_not_in_notebook(db, 1, user)
        assert isinstance(results, list)

    def test_returns_empty_when_all_notes_in_notebook(self, db, user):
        mock_subquery = MagicMock()
        db.query.return_value.filter.return_value.subquery.return_value = mock_subquery
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        results = NotebookController.get_notes_not_in_notebook(db, 1, user)
        assert results == []