"""
AI API Router
Exposes all AI agent capabilities through FastAPI endpoints.
Each endpoint delegates to the Master Orchestrator.
"""

import os
import uuid
import shutil
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel, Field
from typing import List

from app.agents.orchestrator import orchestrator
from app.schemas.ai_schemas import (
    StudyPlanRequest,
    ChatRequest,
    QuizGenerationRequest,
    DocumentQueryRequest,
    WeakTopicAnalysisRequest,
    ProductivityAnalysisRequest,
)
from app.utils.logging import get_logger

logger = get_logger("ai_router")

router = APIRouter(prefix="/ai", tags=["AI"])

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# Study Plan Generation
# ============================================================

@router.post("/generate-plan")
async def generate_study_plan(request: StudyPlanRequest):
    """
    Generate a personalized AI study plan.
    Multi-agent workflow: WeakTopicAnalyzer → Planner → Validator
    """
    result = await orchestrator.process_request(
        request_type="generate_plan",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Plan generation failed"))

    return result


# ============================================================
# AI Chat / Tutoring
# ============================================================

@router.post("/chat")
async def ai_chat(request: ChatRequest):
    """
    Conversational AI tutoring with memory.
    Supports optional RAG integration for document-grounded answers.
    """
    result = await orchestrator.process_request(
        request_type="chat",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Chat failed"))

    return result


# ============================================================
# Auto-Route (Intent Classification + Routing)
# ============================================================

class AutoRouteRequest(BaseModel):
    user_id: str
    message: str
    session_id: Optional[str] = None
    document_ids: List[str] = []


@router.post("/auto")
async def auto_route(request: AutoRouteRequest):
    """
    Automatically classify intent and route to the appropriate agent.
    Use this when the user sends a free-form message.
    """
    result = await orchestrator.process_request(
        request_type="auto",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Processing failed"))

    return result


# ============================================================
# Quiz Generation
# ============================================================

@router.post("/generate-quiz")
async def generate_quiz(request: QuizGenerationRequest):
    """Generate an AI-powered quiz on a subject/topic."""
    result = await orchestrator.process_request(
        request_type="generate_quiz",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Quiz generation failed"))

    return result


# ============================================================
# Flashcard Generation
# ============================================================

class FlashcardRequest(BaseModel):
    user_id: str
    subject: str
    topic: Optional[str] = None
    num_cards: int = Field(ge=1, le=30, default=10)
    document_ids: List[str] = []


@router.post("/generate-flashcards")
async def generate_flashcards(request: FlashcardRequest):
    """Generate AI flashcards for revision."""
    result = await orchestrator.process_request(
        request_type="generate_flashcards",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Flashcard generation failed"))

    return result


# ============================================================
# Document Upload & Processing
# ============================================================

@router.post("/upload-note")
async def upload_note(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    subject: str = Form(""),
    title: str = Form(""),
):
    """
    Upload a document (PDF, text, image) for RAG processing.
    The document will be chunked, embedded, and stored in ChromaDB.
    """
    # Validate file type
    allowed_types = {
        "application/pdf", "text/plain", "text/markdown",
        "image/png", "image/jpeg", "image/tiff",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, TXT, PNG, JPG"
        )

    # Generate unique document ID and save file
    document_id = str(uuid.uuid4())[:12]
    file_ext = os.path.splitext(file.filename or "doc.pdf")[1]
    file_path = os.path.join(UPLOAD_DIR, f"{document_id}{file_ext}")

    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        result = await orchestrator.process_request(
            request_type="upload_document",
            data={
                "file_path": file_path,
                "document_id": document_id,
                "user_id": user_id,
                "title": title or file.filename,
                "subject": subject,
            },
            user_id=user_id,
        )

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Upload processing failed"))

        return result

    except Exception as e:
        # Clean up file on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Document Query (RAG)
# ============================================================

@router.post("/query-documents")
async def query_documents(request: DocumentQueryRequest):
    """Query uploaded documents using RAG retrieval."""
    result = await orchestrator.process_request(
        request_type="document_query",
        data={
            "user_id": request.user_id,
            "query": request.query,
            "document_ids": request.document_ids,
        },
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Document query failed"))

    return result


# ============================================================
# Summarization
# ============================================================

class SummarizeRequest(BaseModel):
    user_id: str
    content: Optional[str] = None
    document_ids: List[str] = []


@router.post("/summarize")
async def summarize(request: SummarizeRequest):
    """Summarize provided content or uploaded documents."""
    result = await orchestrator.process_request(
        request_type="summarize",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Summarization failed"))

    return result


# ============================================================
# Performance Analysis
# ============================================================

@router.post("/analyze-performance")
async def analyze_performance(request: ProductivityAnalysisRequest):
    """
    Multi-agent performance analysis.
    Runs productivity + weak topic analysis.
    """
    result = await orchestrator.process_request(
        request_type="analyze_performance",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))

    return result


# ============================================================
# Weak Topic Analysis
# ============================================================

@router.post("/analyze-weak-topics")
async def analyze_weak_topics(request: WeakTopicAnalysisRequest):
    """Identify weak topics from quiz scores and study patterns."""
    result = await orchestrator.process_request(
        request_type="weak_analysis",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Weak analysis failed"))

    return result


# ============================================================
# Revision Schedule
# ============================================================

class RevisionRequest(BaseModel):
    user_id: str
    topics_studied: List[dict] = []
    study_history: List[dict] = []
    weak_topics: List[str] = []
    daily_capacity_minutes: int = 120


@router.post("/revision-schedule")
async def generate_revision_schedule(request: RevisionRequest):
    """Generate a spaced repetition revision schedule."""
    result = await orchestrator.process_request(
        request_type="revision_schedule",
        data=request.model_dump(),
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Revision schedule failed"))

    return result
