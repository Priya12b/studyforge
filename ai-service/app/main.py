"""
StudyForge AI Service — FastAPI Application
Production-grade multi-agent AI orchestration engine for academic intelligence.

Architecture:
  FastAPI → Router → Orchestrator → Agent(s) → Model Router → LLM Provider
                                              → RAG Pipeline → ChromaDB
                                              → Memory Manager
                                              → Validation Agent
"""

from dotenv import load_dotenv
load_dotenv()  # Load .env file for local development (no effect in production)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.utils.logging import setup_logging, get_logger
from app.agents.orchestrator import orchestrator
from app.routers.ai_router import router as ai_router
from app.routers.system_router import router as system_router


# Setup logging before anything else
setup_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle management.
    - Startup: Initialize model router, verify providers
    - Shutdown: Clean up resources
    """
    # === STARTUP ===
    logger.info(
        "starting_ai_service",
        environment=settings.environment,
        default_provider=settings.default_provider,
    )

    # Initialize the orchestrator (which initializes the model router)
    await orchestrator.initialize()

    logger.info("ai_service_ready", port=settings.port)

    yield

    # === SHUTDOWN ===
    logger.info("shutting_down_ai_service")


# Create the FastAPI application
app = FastAPI(
    title="StudyForge AI Service",
    description=(
        "Production-grade multi-agent AI orchestration engine for personalized "
        "academic intelligence. Provides study planning, tutoring, RAG document Q&A, "
        "quiz generation, weak topic analysis, and productivity insights."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(ai_router)
app.include_router(system_router)


@app.get("/")
async def root():
    """Service root — confirms the AI service is running."""
    return {
        "service": "StudyForge AI Service",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "agents": [
            "orchestrator",
            "planner",
            "revision",
            "weak_topic_analyzer",
            "tutor",
            "rag_knowledge",
            "productivity",
            "validation",
        ],
    }
