from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import create_tables, get_db
from app.routes.auth_routes import router as auth_router
from app.routes.note_routes import router as note_router
from app.routes.ai_routes import router as ai_router
from app.controllers.auth_controller import get_current_user
from app.models.user import User

# Import OCR service (now using Gemini)
from ocr_service import extract_structured_text


app = FastAPI(
    title="NotePeel",
    description="Peel back the layers of your handwritten notes 🐵🍌",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(note_router)
app.include_router(ai_router)


@app.on_event("startup")
def startup_event():
    """Create database tables on startup."""
    create_tables()


# OCR endpoint (no auth - for testing)
@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    note_type: str = Query(default="default", enum=["default", "lecture", "meeting"])
):
    """
    Process an image with Gemini AI.
    
    note_type options:
    - default: General handwritten notes
    - lecture: Optimized for lecture notes with equations and diagrams
    - meeting: Optimized for meeting notes with checkboxes and action items
    """
    if file.content_type not in {"application/pdf", "image/png", "image/jpeg", "image/jpg"}:
        return {"error": f"Unsupported content type: {file.content_type}"}
    contents = await file.read()
    if not contents:
        return {"error": "Uploaded file is empty"}
    
    try:
        structured_data = extract_structured_text(contents, note_type=note_type)
    except Exception as e:
        return {"error": str(e)}

    return structured_data

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Welcome to NotePeel API 🐵🍌",
        "version": "2.0.0",
        "ai": "Gemini",
        "docs": "/docs",
        "health": "/health"

    }
