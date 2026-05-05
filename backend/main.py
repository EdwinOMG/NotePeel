from dotenv import load_dotenv
import os
from contextlib import asynccontextmanager

# Load environment variables from .env
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import create_tables, get_db
from app.routes.auth_routes import router as auth_router
from app.routes.note_routes import router as note_router
from app.routes.notebook_routes import router as notebook_router
from app.routes.ai_routes import router as ai_router
from app.routes.usage_router import router as usage_router
from app.routes.stripe_routes import router as stripe_router
from app.routes.chat_routes import router as chat_router
from app.controllers.auth_controller import get_current_user
from app.models.user import User

# Import OCR service (now using Gemini)
from ocr_service import extract_structured_text


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup and run security checks."""
    # ── Security checks ──────────────────────────────────────────
    from app.config import get_settings
    _settings = get_settings()

    if "change" in _settings.secret_key.lower() or len(_settings.secret_key) < 32:
        print("⚠️  WARNING: Your SECRET_KEY is weak or still set to a default value!")
        print("⚠️  Generate a strong key with: python -c \"import secrets; print(secrets.token_hex(32))\"")
        print("⚠️  Set it in your .env file as SECRET_KEY=<your-generated-key>")

    if not _settings.stripe_webhook_secret and _settings.stripe_secret_key:
        print("⚠️  WARNING: STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will fail.")

    create_tables()
    yield


is_debug = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI(
    title="NotePeel",
    description="Peel back the layers of your handwritten notes 🐵🍌",
    version="2.0.0",
    lifespan=lifespan,
    # Disable interactive API docs in production
    docs_url="/docs" if is_debug else None,
    redoc_url="/redoc" if is_debug else None,
)

# CORS middleware
# IMPORTANT: Never use allow_origins=["*"] with allow_credentials=True.
# In dev, we list local origins. In production, set CORS_ORIGINS env var.
default_origins = [
    "https://notepeel.net",
    "https://www.notepeel.net",
    "https://notepeelfrontend.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Allow adding extra origins via env var (comma-separated)
extra_origins = os.getenv("CORS_ORIGINS", "")
cors_origins = default_origins + [o.strip() for o in extra_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(note_router)
app.include_router(notebook_router)
app.include_router(ai_router)
app.include_router(usage_router, prefix="/api")
app.include_router(stripe_router, prefix="/api")
app.include_router(chat_router)


# OCR endpoint — requires authentication, uses AI quota
@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    note_type: str = Query(default="default", enum=["default", "lecture", "meeting"]),
    current_user: User = Depends(get_current_user),
):
    """
    Process an image with Gemini AI.
    
    note_type options:
    - default: General handwritten notes
    - lecture: Optimized for lecture notes with equations and diagrams
    - meeting: Optimized for meeting notes with checkboxes and action items
    """
    contents = await file.read()
    if not contents:
        return {"error": "Uploaded file is empty"}
    
    try:
        structured_data = extract_structured_text(contents, note_type=note_type)
    except Exception as e:
        return {"error": str(e)}

    return structured_data


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Welcome to NotePeel API 🐵🍌",
        "version": "2.0.0",
        "ai": "Gemini",
        "docs": "/docs"
    }
