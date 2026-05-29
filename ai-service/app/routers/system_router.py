"""
Health & System Router
Provides health checks, model status, and system info endpoints.
"""

from fastapi import APIRouter
from app.agents.orchestrator import orchestrator
from app.models.router import router as model_router
from app.memory.manager import memory_manager

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/health")
async def health_check():
    """Overall system health check."""
    return {
        "status": "healthy",
        "service": "StudyForge AI Service",
        "version": "1.0.0",
    }


@router.get("/status")
async def system_status():
    """Detailed system status including provider health."""
    return {
        "orchestrator": orchestrator.health_status,
        "providers": model_router.health_status,
        "available_providers": model_router.available_providers,
        "active_sessions": memory_manager.get_session_count(),
    }


@router.post("/refresh-providers")
async def refresh_providers():
    """Manually refresh provider health checks."""
    await model_router.refresh_health()
    return {
        "message": "Provider health refreshed",
        "providers": model_router.health_status,
    }
