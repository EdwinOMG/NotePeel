import os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables FIRST
load_dotenv()

# Import the database function
from app.database import create_tables
from app.routes.auth_routes import router as auth_router
from app.routes.note_routes import router as note_router
from app.routes.notebook_routes import router as notebook_router
from app.routes.ai_routes import router as ai_router
from ocr_service import extract_structured_text
from app.routes.usage_router import router as usage_router

app = FastAPI(
    title="NotePeel",
    description="Peel back the layers of your handwritten notes 🐵🍌",
    version="2.0.0"
)

# CORS middleware
cors_origins = [
    "https://notepeelfrontend.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if os.getenv("DEBUG", "true").lower() == "true" else cors_origins,
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
