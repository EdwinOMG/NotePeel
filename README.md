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
- Organize notes into **Notebooks** with color-coded covers
- Search and filter notes by subject, topic, and tags
- AI-powered **Summarize**, **Flashcard generation**, and **Explain selection** features
- Free/Pro usage tiers with per-day request limits and a live usage banner
- Sign in with Google or Microsoft (OAuth only — no passwords)
- Dark mode support across all views
- Mobile-optimized interface for uploading and reviewing notes on the go
- Persistent note storage with per-user authentication

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  React Frontend (TypeScript)              │
│  Auth │ Notebooks │ Dashboard Editor │ Mobile Views │ AI  │
└───────────────────────┬──────────────────────────────────┘
                        │ REST API (HTTP/JSON)
┌───────────────────────▼──────────────────────────────────┐
│                  FastAPI Backend (Python)                 │
│  Auth │ Notes │ Notebooks │ AI │ Usage / Feature Gates   │
└───────────────────────┬──────────────────────────────────┘
                        │
           ┌────────────┼────────────────┐
           │            │                │
┌──────────▼──────┐  ┌──▼────────────┐  ┌▼──────────────────────┐
│   PostgreSQL    │  │ Cloudflare R2 │  │   Google Gemini API    │
│  (SQLAlchemy)   │  │ Image Storage │  │ gemini-2.5-flash-lite  │
└─────────────────┘  └───────────────┘  └────────────────────────┘
                                         ┌────────────────────────┐
                                         │  Cloudflare Workers AI │
                                         │  summarize / flashcards│
                                         │  explain / categorize  │
                                         └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite) |
| Backend | Python 3.11+ + FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL (SQLite for local dev) |
| AI / OCR | Google Gemini 2.5 Flash Lite |
| AI Features | Workers AI / Claude (summarize, flashcards, explain) |
| Auth | JWT (PyJWT) + Google OAuth 2.0 + Microsoft OAuth 2.0 |
| Image Storage | Cloudflare R2 (object storage) |
| AI Workers | Cloudflare Workers AI |

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
- **container** — box, underlined, circled, arrow, or none
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

## Screenshots

> _Add screenshots here — e.g. Dashboard editor, Notebooks grid, Mobile view, Flashcard modal_

| Dashboard Editor | Notebooks |
|---|---|
| ![Dashboard](screenshots/dashboard.png) | ![Notebooks](screenshots/notebooks.png) |

| Mobile Home | Flashcards |
|---|---|
| ![Mobile](screenshots/mobile.png) | ![Flashcards](screenshots/flashcards.png) |

---

## API Reference

All endpoints that require authentication expect an `Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/google` | None | Google OAuth login / register |
| POST | `/api/auth/microsoft` | None | Microsoft OAuth login / register |
| GET | `/api/auth/me` | Bearer | Get current authenticated user info |

### Notes — `/api/notes`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/notes/upload` | Bearer | Upload image, run Gemini OCR, save note |
| GET | `/api/notes/` | Bearer | List all notes for the current user |
| GET | `/api/notes/search` | Bearer | Full-text search across notes |
| GET | `/api/notes/categories` | Bearer | Get subjects, topics, and tags for filters |
| GET | `/api/notes/{id}` | Bearer | Get note metadata and structured text |
| GET | `/api/notes/{id}/full` | Bearer | Get note with base64 original image |
| PUT | `/api/notes/{id}` | Bearer | Update note (title, text, subject, tags, etc.) |
| DELETE | `/api/notes/{id}` | Bearer | Delete a note |

### Notebooks — `/api/notebooks`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/notebooks/` | Bearer | Create a new notebook |
| GET | `/api/notebooks/` | Bearer | List all notebooks for the current user |
| GET | `/api/notebooks/{id}` | Bearer | Get a notebook with its notes |
| PUT | `/api/notebooks/{id}` | Bearer | Update notebook name or color |
| DELETE | `/api/notebooks/{id}` | Bearer | Delete a notebook |
| POST | `/api/notebooks/{id}/notes` | Bearer | Add a note to a notebook |
| DELETE | `/api/notebooks/{id}/notes/{note_id}` | Bearer | Remove a note from a notebook |
| GET | `/api/notebooks/{id}/available-notes` | Bearer | List notes not yet in this notebook |

### AI — `/api/ai`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/flashcards/{note_id}` | Bearer | Generate flashcards from a note |
| GET | `/api/ai/flashcards/{note_id}` | Bearer | Retrieve cached flashcards for a note |
| POST | `/api/ai/summarize/{note_id}` | Bearer | Generate a summary of a note |
| POST | `/api/ai/explain` | Bearer | Explain a highlighted text selection |
| GET | `/api/ai/explanations/{note_id}` | Bearer | Retrieve cached explanations for a note |
| POST | `/api/ai/categorize/{note_id}` | Bearer | Auto-categorize a note (subject/topic/tags) |

### Utility

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/ocr` | None | Direct OCR test endpoint (dev use) |
| GET | `/health` | None | Health check |

---

## Data Models

### User
| Field | Type | Description |
|---|---|---|
| id | Integer | Primary key |
| email | String | Unique, indexed |
| username | String | Unique, indexed |
| hashed_password | String | null for OAuth-only users |
| is_active | Boolean | Account status |
| created_at | DateTime | Registration timestamp |

### Note
| Field | Type | Description |
|---|---|---|
| id | Integer | Primary key |
| title | String | Note title (defaults to filename) |
| original_image | String | Cloudflare R2 object URL |
| image_filename | String | Original filename |
| image_mimetype | String | e.g. `image/jpeg` |
| raw_text | Text | Full verbatim transcription |
| structured_text | Text | Generated HTML for the editor |
| subject | String | Optional folder/category |
| topic | String | Optional sub-category |
| tags | String | Comma-separated tags |
| status | Enum | `pending` / `processing` / `completed` / `failed` |
| error_message | Text | Set on failure |
| owner_id | ForeignKey | References `User.id` |
| created_at | DateTime | Upload timestamp |
| processed_at | DateTime | Completion timestamp |

### Notebook
| Field | Type | Description |
|---|---|---|
| id | Integer | Primary key |
| name | String | Notebook name |
| color | String | Hex color for the cover |
| owner_id | ForeignKey | References `User.id` |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last modified timestamp |

---

## Frontend

### Views

| View | Description |
|---|---|
| `Login` / `Register` | Email/password auth and Google OAuth sign-in |
| `NotebooksPage` | Desktop notebook grid with color-coded covers |
| `NotebookView` | Notes list within a notebook; upload or add existing notes |
| `Dashboard` | Full rich-text editor with menu bar, toolbar, AI panel, and notes sidebar |
| `MobileHome` | Mobile notebook list with bottom-sheet create/edit |
| `MobileNoteViewer` | Read-only mobile note viewer with AI actions bar |
| `SettingsPage` | Account info, dark mode toggle, sign out |

### Dashboard Editor

The Dashboard is a full document editor built in React without any UI framework.

- **Rich text editing** via a `contentEditable` div — supports bold, italic, underline, strikethrough, highlight, text color, font family, font size, and line spacing
- **Menu bar** simulates a desktop app (File, Edit, Insert, View, Format, 🧠 AI) with click-outside dismissal
- **Zoom** — 50% to 150% via CSS `scale()`
- **Export** — PDF via browser print dialog; TXT and HTML via Blob URL download
- **Notes panel** — search, folder filter, tag filter, and inline folder assignment
- **Note Info panel** — edit subject, topic, and tags without leaving the editor
- **AI panel** — Summarize, Flashcard generation, and Explain Selection (with highlight picker and explanation cache)
- **Free/Pro gates** — `FeatureGate` component blurs Pro features for free users; `UsageBanner` shows a live progress bar of daily request usage

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save note |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+H` | Highlight |
| `Ctrl+Enter` | Insert page break |
| `Ctrl+Shift+L` | Bullet list |
| `Ctrl+Shift+N` | Numbered list |
| `Tab` | Indent (or insert spaces outside list) |
| `Shift+Tab` | Outdent |

---

## Authentication Flow

1. User signs in via Google or Microsoft OAuth — no passwords are stored
2. OAuth token is verified server-side → JWT signed with secret key → returned to client
3. Client stores token in `localStorage`
4. Every API request attaches `Authorization: Bearer <token>` header
5. FastAPI's `get_current_user` dependency decodes the JWT, looks up the user, and injects them into route handlers
6. On app load, `App.tsx` checks `localStorage` for a saved token to restore the session without re-login
7. On session expiry, a `sessionExpired` flag in `sessionStorage` triggers an expiry message on the login page

---

## Live Site

**[notepeel.net](http://notepeel.net)**

Sign in with your Google or Microsoft account to get started — no account creation required.

---

## Current Limitations & Future Work

- **Collaborative notebooks** — notes and notebooks are currently single-user only; real-time sharing and collaboration is a planned future direction.

---
