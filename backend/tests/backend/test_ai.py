"""
Tests for workers_ai.py (clean_json, _call, generate_flashcards, etc.)
and AIController.
Run with: pytest tests/backend/test_ai.py -v
"""
import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import HTTPException

from app.services.workers_ai import _clean_json, generate_flashcards, categorize_note, summarize_note
from app.controllers.ai_controller import AIController
from app.models.note import Note, ProcessingStatus
from app.models.ai_models import FlashcardSet, Flashcard, AISummary, AIExplanation
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
    note.title = "Biology Notes"
    note.raw_text = "Mitosis is cell division. The phases are prophase, metaphase, anaphase, telophase."
    note.status = ProcessingStatus.COMPLETED
    note.owner_id = 1
    return note


# ── _clean_json ───────────────────────────────────────────────────────────────

class TestCleanJson:
    def test_strips_markdown_fences(self):
        raw = "```json\n[{\"question\": \"Q\", \"answer\": \"A\"}]\n```"
        result = _clean_json(raw)
        assert result == '[{"question": "Q", "answer": "A"}]'

    def test_strips_plain_code_fence(self):
        raw = "```\n{\"key\": \"value\"}\n```"
        result = _clean_json(raw)
        assert result == '{"key": "value"}'

    def test_valid_array_unchanged(self):
        raw = '[{"question": "Q", "answer": "A"}]'
        result = _clean_json(raw)
        assert result == raw

    def test_truncated_array_repaired(self):
        # Simulates Llama cutting off mid-generation
        raw = '[{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2'
        result = _clean_json(raw)
        # Should end with ] and be valid enough to at least start with [
        assert result.startswith("[")
        assert result.endswith("]")

    def test_truncated_array_no_complete_object_returns_empty(self):
        raw = '[{"question": "incomplete'
        result = _clean_json(raw)
        assert result == "[]"

    def test_truncated_object_repaired(self):
        raw = '{"subject": "Biology", "topic": "Cell Division"'
        result = _clean_json(raw)
        assert result.endswith("}")

    def test_complete_object_unchanged(self):
        raw = '{"subject": "Biology", "topic": "Cells"}'
        result = _clean_json(raw)
        assert json.loads(result) == {"subject": "Biology", "topic": "Cells"}

    def test_whitespace_trimmed(self):
        raw = "  \n  [{}]  \n  "
        result = _clean_json(raw)
        assert result == "[{}]"


# ── _call list handling ───────────────────────────────────────────────────────

class TestCallFunction:
    @pytest.mark.asyncio
    async def test_call_handles_string_token_list(self):
        """Cloudflare sometimes returns list of string tokens."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "result": {"response": ["Hello", " ", "World"]}
        }

        with patch("app.services.workers_ai.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            from app.services.workers_ai import _call
            result = await _call("system", "user")
            assert result == "Hello World"

    @pytest.mark.asyncio
    async def test_call_handles_dict_list(self):
        """The bug we fixed: Cloudflare returning list of dicts."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "result": {"response": [{"question": "Q1", "answer": "A1"}]}
        }

        with patch("app.services.workers_ai.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            from app.services.workers_ai import _call
            result = await _call("system", "user")
            # Should serialize to JSON string, not crash
            assert isinstance(result, str)
            parsed = json.loads(result)
            assert parsed[0]["question"] == "Q1"

    @pytest.mark.asyncio
    async def test_call_raises_on_api_error(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": False, "errors": [{"message": "Invalid token"}]}

        with patch("app.services.workers_ai.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            from app.services.workers_ai import _call
            with pytest.raises(Exception) as exc:
                await _call("system", "user")
            assert "Workers AI error" in str(exc.value)


# ── generate_flashcards ───────────────────────────────────────────────────────

class TestGenerateFlashcards:
    @pytest.mark.asyncio
    async def test_returns_list_of_dicts(self):
        cards = [{"question": "What is mitosis?", "answer": "Cell division"}]
        with patch("app.services.workers_ai._call", return_value=json.dumps(cards)):
            result = await generate_flashcards("some note text")
            assert isinstance(result, list)
            assert result[0]["question"] == "What is mitosis?"
            assert result[0]["answer"] == "Cell division"

    @pytest.mark.asyncio
    async def test_handles_wrapped_dict_response(self):
        """Model returns {cards: [...]} instead of [...]"""
        cards = {"cards": [{"question": "Q", "answer": "A"}]}
        with patch("app.services.workers_ai._call", return_value=json.dumps(cards)):
            result = await generate_flashcards("some note text")
            assert result == [{"question": "Q", "answer": "A"}]

    @pytest.mark.asyncio
    async def test_retries_on_failure_and_raises(self):
        with patch("app.services.workers_ai._call", side_effect=Exception("API down")):
            with patch("app.services.workers_ai.asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(Exception) as exc:
                    await generate_flashcards("some note text")
                assert "Failed after 3 attempts" in str(exc.value)

    @pytest.mark.asyncio
    async def test_raises_on_empty_list(self):
        with patch("app.services.workers_ai._call", return_value="[]"):
            with patch("app.services.workers_ai.asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(Exception) as exc:
                    await generate_flashcards("some text")
                assert "Failed after 3 attempts" in str(exc.value)

    @pytest.mark.asyncio
    async def test_handles_markdown_fenced_response(self):
        raw = '```json\n[{"question": "Q1", "answer": "A1"}]\n```'
        with patch("app.services.workers_ai._call", return_value=raw):
            result = await generate_flashcards("some note text")
            assert result == [{"question": "Q1", "answer": "A1"}]


# ── categorize_note ───────────────────────────────────────────────────────────

class TestCategorizeNote:
    @pytest.mark.asyncio
    async def test_returns_dict_with_expected_keys(self):
        response = '{"subject": "Biology", "topic": "Mitosis", "tags": ["cells", "division"]}'
        with patch("app.services.workers_ai._call", return_value=response):
            result = await categorize_note("cell division notes")
            assert result["subject"] == "Biology"
            assert result["topic"] == "Mitosis"
            assert "cells" in result["tags"]

    @pytest.mark.asyncio
    async def test_handles_truncated_json(self):
        response = '{"subject": "Biology", "topic": "Mitosis"'  # truncated
        with patch("app.services.workers_ai._call", return_value=response):
            result = await categorize_note("some notes")
            assert isinstance(result, dict)


# ── AIController.get_or_generate_flashcards ───────────────────────────────────

class TestAIControllerFlashcards:
    @pytest.mark.asyncio
    async def test_returns_cached_flashcards(self, db, user, sample_note):
        existing_set = FlashcardSet()
        existing_set.id = 1
        existing_set.title = "Flashcards: Biology Notes"
        existing_set.note_id = 1
        existing_set.owner_id = 1

        card = Flashcard()
        card.question = "What is mitosis?"
        card.answer = "Cell division"
        existing_set.cards = [card]

        # Note found, existing set found
        db.query.return_value.filter.return_value.first.side_effect = [sample_note, existing_set]

        result = await AIController.get_or_generate_flashcards(db, 1, user, regenerate=False)
        assert result["cached"] is True
        assert len(result["cards"]) == 1

    @pytest.mark.asyncio
    async def test_raises_404_when_note_not_found(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            await AIController.get_or_generate_flashcards(db, 999, user)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_raises_400_when_no_raw_text(self, db, user, sample_note):
        sample_note.raw_text = None
        db.query.return_value.filter.return_value.first.return_value = sample_note
        with pytest.raises(HTTPException) as exc:
            await AIController.get_or_generate_flashcards(db, 1, user)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_generates_new_flashcards(self, db, user, sample_note):
        db.query.return_value.filter.return_value.first.side_effect = [sample_note, None]
        db.flush.return_value = None
        db.refresh.side_effect = lambda obj: setattr(obj, 'cards', [
            MagicMock(question="Q1", answer="A1")
        ])

        cards_data = [{"question": "Q1", "answer": "A1"}]
        with patch("app.controllers.ai_controller.generate_flashcards", return_value=cards_data):
            result = await AIController.get_or_generate_flashcards(db, 1, user, regenerate=False)
            assert result["cached"] is False
            assert db.add.called
            assert db.commit.called

    @pytest.mark.asyncio
    async def test_regenerate_deletes_old_set(self, db, user, sample_note):
        db.query.return_value.filter.return_value.first.return_value = sample_note
        db.query.return_value.filter.return_value.delete.return_value = None
        db.flush.return_value = None
        db.refresh.side_effect = lambda obj: setattr(obj, 'cards', [])

        with patch("app.controllers.ai_controller.generate_flashcards", return_value=[{"question": "Q", "answer": "A"}]):
            await AIController.get_or_generate_flashcards(db, 1, user, regenerate=True)
            # Should have deleted old set
            assert db.query.return_value.filter.return_value.delete.called


# ── AIController.get_or_generate_summary ─────────────────────────────────────

class TestAIControllerSummary:
    @pytest.mark.asyncio
    async def test_returns_cached_summary(self, db, user, sample_note):
        existing = AISummary()
        existing.summary = "This is a cached summary."

        db.query.return_value.filter.return_value.first.side_effect = [sample_note, existing]

        result = await AIController.get_or_generate_summary(db, 1, user, regenerate=False)
        assert result["cached"] is True
        assert result["summary"] == "This is a cached summary."

    @pytest.mark.asyncio
    async def test_generates_new_summary(self, db, user, sample_note):
        db.query.return_value.filter.return_value.first.side_effect = [sample_note, None]

        with patch("app.controllers.ai_controller.summarize_note", return_value="Generated summary."):
            result = await AIController.get_or_generate_summary(db, 1, user)
            assert result["cached"] is False
            assert result["summary"] == "Generated summary."

    @pytest.mark.asyncio
    async def test_raises_404_when_note_not_found(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            await AIController.get_or_generate_summary(db, 999, user)
        assert exc.value.status_code == 404


# ── AIController.explain ──────────────────────────────────────────────────────

class TestAIControllerExplain:
    @pytest.mark.asyncio
    async def test_returns_cached_explanation(self, db, user):
        existing = AIExplanation()
        existing.highlighted_text = "mitosis"
        existing.explanation = "Mitosis is the process of cell division."

        db.query.return_value.filter.return_value.first.return_value = existing

        result = await AIController.explain(db, "mitosis", user)
        assert result["cached"] is True
        assert result["explanation"] == "Mitosis is the process of cell division."

    @pytest.mark.asyncio
    async def test_generates_explanation_with_context(self, db, user, sample_note):
        db.query.return_value.filter.return_value = db.query.return_value
        
        # 2. Now we set the side_effect on the final '.first()' call
        db.query.return_value.first.side_effect = [None, sample_note]
        
        with patch("app.controllers.ai_controller.explain_highlight", return_value="Mitosis means cell division."):
            db.add.return_value = None
            db.commit.return_value = None
            
            result = await AIController.explain(db, "mitosis", user, note_id=1)
            
            assert result["cached"] is False
            assert result["explanation"] == "Mitosis means cell division."
    @pytest.mark.asyncio
    async def test_explain_without_note_id(self, db, user):
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.controllers.ai_controller.explain_highlight", return_value="An explanation."):
            result = await AIController.explain(db, "some term", user)
            assert result["explanation"] == "An explanation."


# ── AIController.auto_categorize ──────────────────────────────────────────────

class TestAutoCategorize:
    @pytest.mark.asyncio
    async def test_categorizes_note_successfully(self, db, sample_note):
        cats = {"subject": "Biology", "topic": "Mitosis", "tags": ["cells", "division"]}
        with patch("app.controllers.ai_controller.categorize_note", return_value=cats):
            await AIController.auto_categorize(db, sample_note)
            assert sample_note.subject == "Biology"
            assert sample_note.topic == "Mitosis"
            assert "cells" in sample_note.tags
            assert db.commit.called

    @pytest.mark.asyncio
    async def test_skips_when_no_raw_text(self, db, sample_note):
        sample_note.raw_text = None
        with patch("app.controllers.ai_controller.categorize_note") as mock_cat:
            await AIController.auto_categorize(db, sample_note)
            mock_cat.assert_not_called()

    @pytest.mark.asyncio
    async def test_silently_fails_on_exception(self, db, sample_note):
        """auto_categorize should never raise — it swallows errors."""
        with patch("app.controllers.ai_controller.categorize_note", side_effect=Exception("API down")):
            # Should NOT raise
            await AIController.auto_categorize(db, sample_note)