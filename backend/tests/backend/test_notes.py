"""
Tests for NoteController.
Run with: pytest tests/backend/test_notes.py -v
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import HTTPException

from app.controllers.note_controller import NoteController, compress_image
from app.models.note import Note, ProcessingStatus
from app.models.user import User


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
def sample_note():
    note = Note()
    note.id = 1
    note.title = "Test Note"
    note.raw_text = "Sample note content for testing"
    note.structured_text = "<p>Sample note content for testing</p>"
    note.status = ProcessingStatus.COMPLETED
    note.owner_id = 1
    note.image_key = "notes/test-uuid.jpg"
    note.image_url = "https://r2.example.com/notes/test-uuid.jpg"
    note.image_filename = "test.jpg"
    note.image_mimetype = "image/jpeg"
    note.subject = "Biology"
    note.topic = "Cell Division"
    note.tags = "midterm, chapter3"
    return note


# ── Image Compression ─────────────────────────────────────────────────────────

class TestCompressImage:
    def test_small_image_skipped(self):
        # Under 200KB should be returned as-is
        small_bytes = b"x" * (100 * 1024)  # 100KB
        result_bytes, mimetype = compress_image(small_bytes)
        assert result_bytes == small_bytes

    def test_compression_returns_bytes_and_mimetype(self):
        from PIL import Image
        import io
        # Create a real 400x400 test image (larger than 200KB when raw)
        img = Image.new("RGB", (400, 400), color=(255, 0, 0))
        buf = io.BytesIO()
        # Save as high-quality JPEG to get a big-ish file
        img.save(buf, format="JPEG", quality=100)
        image_bytes = buf.getvalue()

        result_bytes, mimetype = compress_image(image_bytes)
        assert isinstance(result_bytes, bytes)
        assert mimetype == "image/jpeg"

    def test_invalid_image_returns_original(self):
        bad_bytes = b"this is not an image" * 15000  # >200KB of junk
        result_bytes, mimetype = compress_image(bad_bytes)
        assert result_bytes == bad_bytes


# ── get_note ──────────────────────────────────────────────────────────────────

class TestGetNote:
    def test_get_note_found(self, db, user, sample_note):
        db.query.return_value.filter.return_value.first.return_value = sample_note
        result = NoteController.get_note(db, 1, user)
        assert result == sample_note

    def test_get_note_not_found_raises(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            NoteController.get_note(db, 999, user)
        assert exc.value.status_code == 404

    def test_get_note_wrong_owner_raises(self, db, sample_note):
        # Simulate different user
        other_user = User()
        other_user.id = 99
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            NoteController.get_note(db, 1, other_user)
        assert exc.value.status_code == 404


# ── get_notes ─────────────────────────────────────────────────────────────────

class TestGetNotes:
    def test_get_notes_returns_list(self, db, user, sample_note):
        db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [sample_note]
        result = NoteController.get_notes(db, user)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_get_notes_empty(self, db, user):
        db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
        result = NoteController.get_notes(db, user)
        assert result == []


# ── update_note ───────────────────────────────────────────────────────────────

class TestUpdateNote:
    def test_update_note_title(self, db, user, sample_note):
        from app.schemas.note_schema import NoteUpdate
        db.query.return_value.filter.return_value.first.return_value = sample_note
        db.refresh.side_effect = lambda n: None

        update_data = NoteUpdate(title="New Title")
        result = NoteController.update_note(db, 1, update_data, user)
        assert result.title == "New Title"
        assert db.commit.called

    def test_update_note_structured_text(self, db, user, sample_note):
        from app.schemas.note_schema import NoteUpdate
        db.query.return_value.filter.return_value.first.return_value = sample_note
        db.refresh.side_effect = lambda n: None

        new_text = "<p>Updated content</p>"
        update_data = NoteUpdate(structured_text=new_text)
        result = NoteController.update_note(db, 1, update_data, user)
        assert result.structured_text == new_text

    def test_update_note_tags(self, db, user, sample_note):
        from app.schemas.note_schema import NoteUpdate
        db.query.return_value.filter.return_value.first.return_value = sample_note
        db.refresh.side_effect = lambda n: None

        update_data = NoteUpdate(tags="exam, important")
        result = NoteController.update_note(db, 1, update_data, user)
        assert result.tags == "exam, important"


# ── delete_note ───────────────────────────────────────────────────────────────

class TestDeleteNote:
    def test_delete_note_removes_from_db_and_r2(self, db, user, sample_note):
        db.query.return_value.filter.return_value.first.return_value = sample_note

        with patch("app.controllers.note_controller.delete_image") as mock_delete:
            NoteController.delete_note(db, 1, user)
            mock_delete.assert_called_once_with(sample_note.image_key)
            db.delete.assert_called_once_with(sample_note)
            db.commit.assert_called()

    def test_delete_note_not_found_raises(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            NoteController.delete_note(db, 999, user)
        assert exc.value.status_code == 404


# ── search_notes ──────────────────────────────────────────────────────────────

class TestSearchNotes:
    def test_search_by_title(self, db, user, sample_note):
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value.all.return_value = [sample_note]
        db.query.return_value.filter.return_value = mock_query

        results = NoteController.search_notes(db, user, "Test")
        assert isinstance(results, list)

    def test_search_empty_query(self, db, user, sample_note):
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value.all.return_value = [sample_note]
        db.query.return_value.filter.return_value = mock_query

        results = NoteController.search_notes(db, user, "")
        assert isinstance(results, list)


# ── get_subjects_and_topics ───────────────────────────────────────────────────

class TestGetSubjectsAndTopics:
    def test_returns_correct_structure(self, db, user, sample_note):
        db.query.return_value.filter.return_value.all.return_value = [sample_note]
        result = NoteController.get_subjects_and_topics(db, user)

        assert "subjects" in result
        assert "topics" in result
        assert "tags" in result
        assert "Biology" in result["subjects"]
        assert "Cell Division" in result["topics"]
        assert "midterm" in result["tags"]

    def test_returns_empty_lists_when_no_notes(self, db, user):
        db.query.return_value.filter.return_value.all.return_value = []
        result = NoteController.get_subjects_and_topics(db, user)
        assert result == {"subjects": [], "topics": [], "tags": []}


# ── get_note_with_image ───────────────────────────────────────────────────────

class TestGetNoteWithImage:
    def test_returns_fresh_url(self, db, user, sample_note):
        db.query.return_value.filter.return_value.first.return_value = sample_note

        fresh_url = "https://r2.example.com/notes/test-uuid.jpg?refreshed=true"
        with patch("app.controllers.note_controller.get_fresh_url", return_value=fresh_url):
            result = NoteController.get_note_with_image(db, 1, user)

        assert result["image_url"] == fresh_url
        assert result["id"] == sample_note.id
        assert result["title"] == sample_note.title
        assert result["raw_text"] == sample_note.raw_text


# ── _build_html ───────────────────────────────────────────────────────────────

class TestBuildHtml:
    def test_empty_elements_returns_empty_string(self):
        result = NoteController._build_html([])
        assert result == ""

    def test_single_paragraph_element(self):
        elements = [{
            "type": "paragraph",
            "content": "Hello world",
            "container": "none",
            "style": {"is_bold": False},
            "children": [],
            "position": {"region": "top-left", "x_percent": 5, "y_percent": 5, "width_percent": 90, "height_percent": 10}
        }]
        result = NoteController._build_html(elements)
        assert "Hello world" in result

    def test_header_element_uses_h2(self):
        elements = [{
            "type": "header",
            "content": "Chapter 1",
            "container": "none",
            "style": {"is_bold": True, "is_large": True},
            "children": [],
            "position": {"region": "top-center", "x_percent": 10, "y_percent": 5, "width_percent": 80, "height_percent": 10}
        }]
        result = NoteController._build_html(elements)
        assert "<h2" in result
        assert "Chapter 1" in result

    def test_bullet_list_element(self):
        elements = [{
            "type": "bullet_list",
            "content": "",
            "container": "none",
            "style": {"is_bold": False},
            "children": ["Item one", "Item two"],
            "position": {"region": "middle-left", "x_percent": 5, "y_percent": 30, "width_percent": 45, "height_percent": 20}
        }]
        result = NoteController._build_html(elements)
        assert "Item one" in result
        assert "Item two" in result