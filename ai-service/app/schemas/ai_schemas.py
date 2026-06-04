"""
Pydantic schemas for all AI agent inputs and outputs.
These enforce structured, deterministic outputs from LLMs.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ============================================================
# Study Planner Schemas
# ============================================================

class SubjectInput(BaseModel):
    """A subject the student is studying."""
    name: str
    confidence_level: int = Field(ge=0, le=100, description="Student's self-assessed confidence 0-100")
    priority: str = Field(default="medium", description="low, medium, high, critical")
    exam_date: Optional[str] = None
    syllabus_topics: List[str] = []
    credits: int = 3


class StudyPlanRequest(BaseModel):
    """Request to generate a personalized study plan."""
    user_id: str
    subjects: List[SubjectInput]
    available_hours_per_day: float = Field(ge=1, le=16, default=4)
    start_date: str
    end_date: str
    preferred_start_time: str = "09:00"
    preferred_end_time: str = "21:00"
    break_duration_minutes: int = 15
    weak_subjects: List[str] = []
    goals: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None


class StudyBlock(BaseModel):
    """A single scheduled study block."""
    subject: str
    topic: str
    start_time: str
    end_time: str
    duration_minutes: int
    block_type: str = Field(description="study, revision, practice, or break")
    priority: str = "medium"
    notes: str = ""


class DailySchedule(BaseModel):
    """One day's complete study schedule."""
    date: str
    blocks: List[StudyBlock] = []
    total_study_minutes: int = 0
    subjects_covered: List[str] = []
    daily_goal: str = ""


class StudyPlanResponse(BaseModel):
    """Complete AI-generated study plan."""
    title: str = "Study Plan"
    description: str = ""
    daily_schedules: List[DailySchedule] = []
    revision_dates: List[dict] = []
    recommendations: List[str] = []
    estimated_completion: str = ""
    confidence_score: float = Field(ge=0, le=1, default=0.7, description="AI confidence in the plan quality")


# ============================================================
# Revision Schemas
# ============================================================

class RevisionEntry(BaseModel):
    """A single revision schedule entry following spaced repetition."""
    subject: str
    topic: str
    revision_date: str
    repetition_number: int = Field(ge=1, description="Which repetition cycle (1st, 2nd, 3rd...)")
    interval_days: int = Field(description="Days since last review")
    priority: str = "medium"
    estimated_minutes: int = 30


class RevisionScheduleResponse(BaseModel):
    """Complete revision schedule using spaced repetition."""
    entries: List[RevisionEntry]
    total_topics: int
    revision_strategy: str
    next_review_summary: str = ""


# ============================================================
# Weak Topic Analysis Schemas
# ============================================================

class TopicWeakness(BaseModel):
    """Analysis of a single weak topic."""
    subject: str
    topic: str
    weakness_score: float = Field(ge=0, le=1, description="0=strong, 1=very weak")
    confidence: float = Field(ge=0, le=1, description="Confidence in this assessment")
    evidence: List[str] = Field(description="Reasons this topic is flagged")
    recommendation: str = ""


class WeakTopicAnalysisRequest(BaseModel):
    """Request to analyze student weak topics."""
    user_id: str
    quiz_scores: List[dict] = []
    study_history: List[dict] = []
    subjects: List[SubjectInput] = []
    skipped_topics: List[str] = []
    model: Optional[str] = None
    provider: Optional[str] = None


class WeakTopicAnalysisResponse(BaseModel):
    """Complete weak topic analysis result."""
    weak_topics: List[TopicWeakness]
    overall_assessment: str
    priority_improvements: List[str]
    heatmap_data: List[dict] = Field(
        default=[],
        description="Subject → topic weakness scores for visualization"
    )


# ============================================================
# AI Tutor Schemas
# ============================================================

class ChatRequest(BaseModel):
    """Request to the AI tutor."""
    user_id: str
    message: str
    session_id: Optional[str] = None
    subject_context: Optional[str] = None
    use_rag: bool = False
    document_ids: List[str] = []
    model: Optional[str] = None
    provider: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from the AI tutor."""
    response: str
    session_id: str
    sources: List[dict] = Field(default=[], description="RAG source citations")
    suggested_followups: List[str] = []
    confidence: float = Field(ge=0, le=1, default=0.8)


# ============================================================
# Quiz & Flashcard Schemas
# ============================================================

class QuizQuestion(BaseModel):
    """A single quiz question."""
    question: str
    options: List[str] = Field(min_length=2, max_length=6)
    correct_answer: str
    explanation: str
    difficulty: str = "medium"


class QuizGenerationRequest(BaseModel):
    """Request to generate a quiz."""
    user_id: str
    subject: str
    topic: Optional[str] = None
    num_questions: int = Field(ge=1, le=20, default=5)
    difficulty: str = "mixed"
    use_notes: bool = False
    document_ids: List[str] = []
    model: Optional[str] = None
    provider: Optional[str] = None


class QuizResponse(BaseModel):
    """AI-generated quiz."""
    title: str
    subject: str
    topic: str
    questions: List[QuizQuestion]
    total_questions: int
    estimated_time_minutes: int


class Flashcard(BaseModel):
    """A single flashcard."""
    front: str
    back: str
    subject: str
    topic: str
    difficulty: str = "medium"


class FlashcardResponse(BaseModel):
    """AI-generated flashcards."""
    subject: str
    topic: str
    flashcards: List[Flashcard]
    total_cards: int


# ============================================================
# RAG / Document Schemas
# ============================================================

class DocumentUploadRequest(BaseModel):
    """Request to process an uploaded document."""
    user_id: str
    document_id: str
    file_path: str
    file_type: str = "pdf"
    subject: Optional[str] = None
    title: Optional[str] = None


class DocumentQueryRequest(BaseModel):
    """Request to query uploaded documents via RAG."""
    user_id: str
    query: str
    document_ids: List[str] = []
    top_k: int = 5
    model: Optional[str] = None
    provider: Optional[str] = None


class RAGResponse(BaseModel):
    """Response from RAG document query."""
    answer: str
    sources: List[dict] = Field(description="Retrieved source chunks with metadata")
    confidence: float = Field(ge=0, le=1)
    source_count: int


# ============================================================
# Analytics Schemas
# ============================================================

class ProductivityAnalysisRequest(BaseModel):
    """Request for productivity analysis."""
    user_id: str
    study_logs: List[dict] = []
    quiz_scores: List[dict] = []
    days_to_analyze: int = 7
    model: Optional[str] = None
    provider: Optional[str] = None


class ProductivityAnalysisResponse(BaseModel):
    """AI-generated productivity analysis."""
    productivity_score: float = Field(ge=0, le=100)
    burnout_risk: float = Field(ge=0, le=100)
    consistency_score: float = Field(ge=0, le=100)
    peak_hours: List[str] = []
    trends: List[dict] = []
    recommendations: List[str] = []
    focus_areas: List[str] = []


# ============================================================
# Orchestrator Schemas
# ============================================================

class IntentType(str, Enum):
    """Classification of user request intent."""
    GENERATE_PLAN = "generate_plan"
    CHAT = "chat"
    GENERATE_QUIZ = "generate_quiz"
    GENERATE_FLASHCARDS = "generate_flashcards"
    ANALYZE_PERFORMANCE = "analyze_performance"
    DOCUMENT_QUERY = "document_query"
    SUMMARIZE = "summarize"
    REVISION_SCHEDULE = "revision_schedule"
    WEAK_ANALYSIS = "weak_analysis"
    GENERAL = "general"


class IntentClassification(BaseModel):
    """Result of intent classification."""
    intent: IntentType
    confidence: float = Field(ge=0, le=1)
    extracted_entities: dict = {}
    requires_rag: bool = False
