"""
Observability utilities: tracing, token counting, latency tracking.
Wraps LangChain callbacks for production-grade monitoring.
"""

import time
import uuid
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime

from app.utils.logging import get_logger

logger = get_logger("observability")


@dataclass
class AgentTrace:
    """Captures a single agent execution trace for monitoring."""

    trace_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    agent_name: str = ""
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    model_used: str = ""
    provider_used: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0
    success: bool = True
    error: Optional[str] = None
    retries: int = 0
    fallback_used: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def finish(self, success: bool = True, error: Optional[str] = None) -> None:
        self.ended_at = time.time()
        self.latency_ms = round((self.ended_at - self.started_at) * 1000, 2)
        self.success = success
        self.error = error
        self.total_tokens = self.input_tokens + self.output_tokens

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "agent_name": self.agent_name,
            "model_used": self.model_used,
            "provider_used": self.provider_used,
            "latency_ms": self.latency_ms,
            "total_tokens": self.total_tokens,
            "success": self.success,
            "error": self.error,
            "retries": self.retries,
            "fallback_used": self.fallback_used,
            "timestamp": datetime.utcnow().isoformat(),
        }


@dataclass
class PipelineTrace:
    """Captures the full orchestration pipeline trace."""

    pipeline_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    request_type: str = ""
    agent_traces: List[AgentTrace] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    total_latency_ms: float = 0
    success: bool = True

    def add_trace(self, trace: AgentTrace) -> None:
        self.agent_traces.append(trace)

    def finish(self) -> None:
        self.ended_at = time.time()
        self.total_latency_ms = round((self.ended_at - self.started_at) * 1000, 2)
        self.success = all(t.success for t in self.agent_traces)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pipeline_id": self.pipeline_id,
            "request_type": self.request_type,
            "total_latency_ms": self.total_latency_ms,
            "agents_executed": len(self.agent_traces),
            "success": self.success,
            "agents": [t.to_dict() for t in self.agent_traces],
        }

    def log_summary(self) -> None:
        """Log a concise summary of the pipeline execution."""
        logger.info(
            "pipeline_completed",
            pipeline_id=self.pipeline_id,
            request_type=self.request_type,
            total_latency_ms=self.total_latency_ms,
            agents_executed=len(self.agent_traces),
            total_tokens=sum(t.total_tokens for t in self.agent_traces),
            success=self.success,
            fallbacks_used=sum(1 for t in self.agent_traces if t.fallback_used),
        )
