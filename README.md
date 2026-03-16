# NotePeel 🐵🍌
**Authors:** Edwin Morales Jr, Karim Elneshili, Tyler Long  
**Institution:** SUNY New Paltz  

---

## Overview

NotePeel is a full-stack web application that converts handwritten notes into structured, editable digital documents using Google's Gemini AI. Users upload a photo of their handwritten notes and receive a clean, formatted digital version that preserves the original layout — columns, headers, bullet points, boxed sections, and more — rendered in a rich in-browser editor.

**Key features include:**
- Convert handwritten note images into structured, layout-aware digital text
- Preserve original note formatting: headers, bullet lists, boxed sections, two-column layouts, key-value pairs, and diagrams
- Edit, format, highlight, and annotate converted notes in a full-featured rich text editor
- Export notes as PDF, TXT, or HTML
- View the original image alongside the digitized version
- Persistent note storage with per-user authentication
- Three note-type processing modes: Default, Lecture, and Meeting

---

## Architecture

The system follows a layered architecture separating the AI processing, backend API, database, and frontend client.

```
┌─────────────────────────────────────────────┐
│              React Frontend (TypeScript)     │
│   Auth  │  Dashboard Editor  │  Notes Panel  │
└──────────────────┬──────────────────────────┘
                   │ REST API (HTTP/JSON)
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend (Python)        │
│   Auth Routes  │  Note Routes  │  OCR Route  │
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
| Database | PostgreSQL (SQLite for local dev) |
| AI / OCR | Google Gemini 2.5 Flash Lite  |
| Auth | JWT (PyJWT) + bcrypt password hashing |
| Image Storage | Binary storage in database (LargeBinary) |

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

The OCR service uses a carefully engineered prompt (`LAYOUT_PROMPT`) that instructs Gemini to return a JSON object describing each visual region of the page. Each element includes:

- **type** — header, paragraph, bullet_list, key_value, diagram, label
- **content** — the transcribed text only (never visual descriptions)
- **container** — box, underlined, circled, arrow, or none (border drawn around the element)
- **position** — x_percent, y_percent, width_percent, height_percent, and a named region
- **style** — is_bold, is_large, is_underlined
- **children** — bullet strings for list elements
- **connected_to** — IDs of elements linked by arrows
- **diagram** — shape, description, and labels (only for actual drawings with no readable text)

Three prompt variants support different note contexts:
- **Default** — general handwritten notes
- **Lecture** — emphasizes equation transcription and labeled diagrams
- **Meeting** — handles checkboxes (`[x]`/`[ ]`) and action items

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
| `/api/notes/{id}` | GET | Bearer | Get note metadata and structured text |
| `/api/notes/{id}/full` | GET | Bearer | Get note with base64 original image |
| `/api/notes/{id}` | PUT | Bearer | Update note (title, structured_text, etc.) |
| `/api/notes/{id}` | DELETE | Bearer | Delete a note |

### Utility

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/ocr` | POST | None | Direct OCR test endpoint (dev use) |
| `/health` | GET | None | Health check |

All note endpoints require a `Bearer` JWT token in the `Authorization` header.

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
| subject | String | Optional categorization |
| topic | String | Optional categorization |
| tags | String | Optional tags |
| status | Enum | pending / processing / completed / failed |
| error_message | Text | Set on failure |
| owner_id | ForeignKey | References User.id |
| created_at | DateTime | Upload timestamp |
| processed_at | DateTime | Completion timestamp |

---

## Frontend — Dashboard Editor

The Dashboard is a full document editor built in React without any UI framework. Key design decisions:

- **Rich text editing** uses a `contentEditable` div rather than a `<textarea>`, enabling inline HTML formatting (bold, italic, lists, highlights, colors)
- **Formatting commands** use the browser's `execCommand` API
- **Menu bar** simulates a desktop application (File, Edit, Insert, View, Format) with click-outside dismissal
- **Two-column layout reconstruction** uses CSS grid with column widths derived from the original x_percent positions returned by Gemini
- **Export** — PDF via browser print dialog, TXT and HTML via Blob URL download

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
| Tab | Indent (or insert spaces outside list) |
| Shift+Tab | Outdent |

---

## Authentication Flow

1. User registers → password hashed with bcrypt → stored in DB
2. User logs in → credentials verified → JWT signed with secret key → returned to client
3. Client stores token in `localStorage`
4. Every API request attaches `Authorization: Bearer <token>` header
5. FastAPI's `get_current_user` dependency decodes the JWT, looks up the user, and injects them into route handlers
6. On app load, `App.tsx` checks `localStorage` for a saved token to restore session without re-login

---

## Setup & Running Locally

### Backend

```bash
# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-jose bcrypt python-multipart google-generativeai python-dotenv

# Create .env file
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:PASSWORD_HERE@localhost:5432/notepeel


# Run
cd backend
uvicorn main:app --reload
# API available at http://127.0.0.1:8000
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

- **Image storage** — images are stored as binary blobs directly in the database. When in production, it should go to an object storage such as S3.
- **Synchronous OCR** — Gemini processing happens inline during the upload request. For heavier loads, this should be moved to a background task queue so it is async.
- **Subject/topic auto-categorization** — the Note model has `subject` and `topic` fields, but these are not yet populated automatically. A planned feature would prompt Gemini to classify the note during processing.
- **Highlight + Explain** — In the future, a highlight ai tutor will be impleemented to aid the user.
- **Mobile** — the frontend is web-only. React Native migration is a planned future direction.
