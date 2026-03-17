# NotePeel 🐵🍌
**Authors:** Edwin Morales Jr, Karim Elneshili, Tyler Long
**Institution:** SUNY New Paltz

---

## Overview

NotePeel is a full-stack web app that turns handwritten notes into smart digital study tools using Google's Gemini AI. You take a photo of your notes, upload it, and the app reads your handwriting and converts it into clean, formatted text that actually preserves the layout of your original notes — things like two-column sections, headers, bullet points, boxed content, and diagrams all come through properly.

From there you can edit the note in a full rich-text editor, organize it by subject and tags, search across all your notes, and use AI features to generate flashcards, get a summary, or highlight any text to get an explanation of it.

**Features:**
- Upload a handwritten note image and get back structured, layout-aware digital text
- Formatting is preserved — headers, bullet lists, boxed sections, two-column layouts, diagrams
- Full rich-text editor with formatting toolbar (bold, italic, highlight, font size, alignment, etc.)
- Export notes as PDF, TXT, or HTML
- View original image side by side with the digitized version
- User accounts with JWT authentication — notes are saved per user
- Three processing modes: Default, Lecture (equations/diagrams), and Meeting (checkboxes/action items)
- Search and filter notes by keyword, subject, or topic
- Organize notes with subjects, topics, and tags
- AI flashcard generation — generates 8-12 Q&A cards from any note
- AI summary — one-click bullet point summary of a note
- AI explain — highlight any text and get a plain-English explanation of it
- Health check endpoint for monitoring (`GET /health`)
- Docker setup for running the full stack in containers

---

## Architecture

The app is split into three layers — a React frontend, a FastAPI backend, and a PostgreSQL database. The backend handles all the AI processing through the Gemini API.

```
┌─────────────────────────────────────────────┐
│              React Frontend (TypeScript)     │
│   Auth  │  Dashboard Editor  │  Notes Panel  │
└──────────────────┬──────────────────────────┘
                   │ REST API (HTTP/JSON)
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend (Python)        │
│   Auth Routes  │  Note Routes  │  AI Routes  │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐    ┌─────────▼────────────────┐
│  PostgreSQL  │    │     Google Gemini API     │
│  (SQLAlchemy)│    │  gemini-2.5-flash-lite    │
└──────────────┘    └──────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite) |
| Backend | Python 3.11+ + FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| AI / OCR | Google Gemini 2.5 Flash Lite |
| Auth | JWT (PyJWT) + bcrypt password hashing |
| Image Storage | Binary storage in PostgreSQL (LargeBinary) |

---

## How It Works

### End-to-End Note Processing Flow

```
User uploads image
        │
        ▼
FastAPI receives file → saves Note record (status: PROCESSING)
        │
        ▼
ocr_service.py sends image + structured prompt to Gemini API
        │
        ▼
Gemini returns JSON: list of elements with type, content,
position (x/y %), container style, and layout metadata
        │
        ▼
NoteController._clean_elements()
  → removes decorative triangle/arrow shapes
  → removes duplicate-region diagram elements
        │
        ▼
NoteController._build_html()
  → groups elements into horizontal bands by y-position overlap
  → single-element bands → full-width HTML
  → left+right elements in same band → CSS grid with proportional columns
        │
        ▼
Structured HTML saved to DB (status: COMPLETED)
        │
        ▼
Frontend loads HTML into contentEditable editor div
```

### Gemini Prompt Design

The OCR service sends each image to Gemini with a carefully structured prompt that tells it to return a JSON description of every visual region on the page. Each element includes:

- **type** — header, paragraph, bullet_list, key_value, diagram, label
- **content** — the transcribed text (never visual descriptions)
- **container** — box, underlined, circled, arrow, or none
- **position** — x_percent, y_percent, width_percent, height_percent, and a named region
- **style** — is_bold, is_large, is_underlined
- **children** — bullet strings for list elements
- **diagram** — shape, description, and labels for actual drawn diagrams

Three prompt variants handle different note types:
- **Default** — general handwritten notes
- **Lecture** — emphasizes equations and labeled diagrams
- **Meeting** — handles checkboxes (`[x]`/`[ ]`) and action items

### AI Features

Beyond OCR, the app has three additional AI features powered by Gemini:

- **Flashcard generation** — sends the note's text to Gemini and gets back 8-12 question/answer pairs, which are saved to the database and displayed in an interactive card-flip UI
- **Summarization** — generates a concise bullet-point summary of the note (under 200 words)
- **Text explanation** — user highlights any text in the editor, clicks Explain, and gets a plain-English breakdown of it

---

## API Endpoints

### Authentication — `/api/auth`

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | POST | None | Create a new user account |
| `/api/auth/login` | POST | None | Login, returns JWT access token |
| `/api/auth/me` | GET | Bearer | Get current user info |

### Notes — `/api/notes`

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/notes/upload` | POST | Bearer | Upload image, run Gemini OCR, save note |
| `/api/notes/` | GET | Bearer | List all notes for current user |
| `/api/notes/search` | GET | Bearer | Search notes by keyword, subject, or topic |
| `/api/notes/categories` | GET | Bearer | Get all subjects, topics, and tags for current user |
| `/api/notes/{id}` | GET | Bearer | Get note metadata and structured text |
| `/api/notes/{id}/full` | GET | Bearer | Get note with base64 original image |
| `/api/notes/{id}` | PUT | Bearer | Update note (title, subject, topic, tags, text) |
| `/api/notes/{id}` | DELETE | Bearer | Delete a note |

### AI — `/api/ai`

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/ai/flashcards/{id}` | POST | Bearer | Generate flashcards from a note |
| `/api/ai/flashcards/{id}` | GET | Bearer | Get saved flashcard sets for a note |
| `/api/ai/summarize/{id}` | POST | Bearer | Generate a summary of a note |
| `/api/ai/explain` | POST | Bearer | Explain a piece of selected text |

### Utility

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/ocr` | POST | None | Direct OCR test endpoint (dev use) |
| `/health` | GET | None | Health check — returns `{"status": "ok"}` |

All note and AI endpoints require a `Bearer` JWT token in the `Authorization` header.

---

## Data Models

### User
| Field | Type | Description |
|---|---|---|
| id | Integer | Primary key |
| email | String | Unique, indexed |
| username | String | Unique, indexed |
| hashed_password | String | bcrypt hash |
| is_active | Boolean | Account status |
| created_at | DateTime | Registration timestamp |

### Note
| Field | Type | Description |
|---|---|---|
| id | Integer | Primary key |
| title | String | Note title (defaults to filename) |
| original_image | LargeBinary | Raw image bytes |
| image_filename | String | Original filename |
| image_mimetype | String | e.g. image/jpeg |
| raw_text | Text | Full verbatim transcription |
| structured_text | Text | Generated HTML for the editor |
| subject | String | Optional subject label |
| topic | String | Optional topic label |
| tags | String | Comma-separated tags |
| status | Enum | pending / processing / completed / failed |
| error_message | Text | Set on failure |
| owner_id | ForeignKey | References User.id |
| created_at | DateTime | Upload timestamp |
| processed_at | DateTime | Completion timestamp |

### FlashcardSet / Flashcard
| Field | Type | Description |
|---|---|---|
| id | Integer | Primary key |
| note_id | ForeignKey | References Note.id (cascade delete) |
| title | String | Set title generated by AI |
| cards | Relationship | List of Flashcard objects |

Each Flashcard has a `question` and `answer` field stored as Text.

---

## Frontend — Dashboard Editor

The dashboard is built entirely in React without any UI framework. A few things worth noting about how it's put together:

- Rich text editing uses a `contentEditable` div instead of a textarea, which lets us do inline HTML formatting (bold, italic, highlights, font changes, lists)
- Formatting commands go through the browser's `execCommand` API
- The menu bar (File, Edit, Insert, View, Format, AI Tools) works like a desktop app with keyboard shortcuts and click-outside dismissal
- Two-column layouts from the original note are reconstructed using CSS grid, with column widths based on the x_percent positions Gemini returns
- Export works via the browser print dialog for PDF, and Blob URL downloads for TXT and HTML
- The Notes Panel sidebar has search, category filters, and per-note subject/topic/tag editing

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+S | Save note |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+U | Underline |
| Ctrl+H | Highlight |
| Ctrl+Enter | Insert page break |
| Ctrl+Shift+L | Bullet list |
| Ctrl+Shift+N | Numbered list |
| Tab | Indent |
| Shift+Tab | Outdent |

---

## Authentication Flow

1. User registers → password hashed with bcrypt → stored in DB
2. User logs in → credentials verified → JWT signed with secret key → returned to client
3. Client stores token in `localStorage`
4. Every API request sends `Authorization: Bearer <token>`
5. FastAPI's `get_current_user` dependency decodes the JWT and injects the user into route handlers
6. On app load, `App.tsx` checks `localStorage` for a saved token so users stay logged in

---

## Setup & Running Locally

You'll need PostgreSQL running locally and a Gemini API key (free at aistudio.google.com).

### Backend

```bash
cd backend

# Create a virtual environment and install dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create a .env file with the following:
# GEMINI_API_KEY=your_key_here
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notepeel

# Run the server
uvicorn main:app --reload
# API available at http://127.0.0.1:8000
# Auto-generated docs at http://127.0.0.1:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

---

## Current Limitations & Future Work

- **Image storage** — right now images are stored as binary blobs in the database. For a production deployment this should move to something like S3.
- **Synchronous OCR** — Gemini processing happens during the upload request, so uploads block until OCR finishes. A task queue (like Celery + Redis) would fix this for heavier usage.
- **Auto-categorization** — the subject/topic fields exist on the Note model but aren't filled in automatically. A future version could have Gemini classify the note during processing.
- **Mobile** — the app is web-only right now. A React Native version is a possible future direction.
