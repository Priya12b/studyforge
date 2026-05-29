"""
Intelligent Model Router
Routes AI tasks to the optimal model/provider based on task complexity,
with automatic fallback chains and health-aware routing.

Routing Strategy:
  - Simple Q&A / fast tasks → Ollama (local, zero-cost)
  - Complex reasoning / planning → Gemini (cloud, high-quality)
  - Code tasks → deepseek-coder via Ollama
  - Fallback chain: Ollama → Gemini → OpenAI
"""

from enum import Enum
from typing import Optional
from langchain_core.language_models import BaseChatModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.models.ollama_provider import OllamaProvider
from app.models.gemini_provider import GeminiProvider
from app.models.openai_provider import OpenAIProvider
from app.models.base_provider import LLMProvider
from app.config import settings
from app.utils.logging import get_logger
from app.utils.observability import AgentTrace

logger = get_logger("model_router")


class TaskComplexity(str, Enum):
    """Classification of task complexity for routing decisions."""
    SIMPLE = "simple"           # FAQ, greetings, simple lookups
    MODERATE = "moderate"       # Summarization, basic Q&A
    COMPLEX = "complex"         # Planning, multi-step reasoning
    SPECIALIZED = "specialized" # Code generation, domain-specific


class TaskType(str, Enum):
    """Classification of AI task types for model selection."""
    CHAT = "chat"
    PLANNING = "planning"
    SUMMARIZATION = "summarization"
    QUIZ_GENERATION = "quiz_generation"
    RAG_RESPONSE = "rag_response"
    WEAK_ANALYSIS = "weak_analysis"
    REVISION = "revision"
    CODE = "code"
    FLASHCARD = "flashcard"
    VALIDATION = "validation"
    INTENT_CLASSIFICATION = "intent_classification"


# Task → recommended complexity mapping
TASK_COMPLEXITY_MAP: dict[TaskType, TaskComplexity] = {
    TaskType.CHAT: TaskComplexity.MODERATE,
    TaskType.PLANNING: TaskComplexity.COMPLEX,
    TaskType.SUMMARIZATION: TaskComplexity.MODERATE,
    TaskType.QUIZ_GENERATION: TaskComplexity.MODERATE,
    TaskType.RAG_RESPONSE: TaskComplexity.MODERATE,
    TaskType.WEAK_ANALYSIS: TaskComplexity.COMPLEX,
    TaskType.REVISION: TaskComplexity.COMPLEX,
    TaskType.CODE: TaskComplexity.SPECIALIZED,
    TaskType.FLASHCARD: TaskComplexity.SIMPLE,
    TaskType.VALIDATION: TaskComplexity.SIMPLE,
    TaskType.INTENT_CLASSIFICATION: TaskComplexity.SIMPLE,
}


class ModelRouter:
    """
    Intelligent model routing engine.

    Maintains provider health state and routes tasks to the optimal
    model based on task type, complexity, and provider availability.
    Implements automatic fallback chains for reliability.
    """

    def __init__(self):
        self.ollama = OllamaProvider()
        self.gemini = GeminiProvider()
        self.openai = OpenAIProvider()

        self._providers: dict[str, LLMProvider] = {
            "ollama": self.ollama,
            "gemini": self.gemini,
            "openai": self.openai,
        }

        # Health status cache (updated periodically)
        self._health: dict[str, bool] = {
            "ollama": False,
            "gemini": False,
            "openai": False,
        }

        # Fallback chain: try providers in this order
        self._fallback_chain = ["ollama", "gemini", "openai"]

    async def initialize(self) -> None:
        """Run health checks on all providers at startup."""
        logger.info("initializing_model_router")
        for name, provider in self._providers.items():
            self._health[name] = await provider.health_check()
            status = "available" if self._health[name] else "unavailable"
            logger.info("provider_status", provider=name, status=status)

        available = [n for n, h in self._health.items() if h]
        if not available:
            logger.error("no_providers_available", message="All LLM providers are offline!")
        else:
            logger.info("router_ready", available_providers=available)

    async def refresh_health(self, provider_name: Optional[str] = None) -> None:
        """Refresh health status for one or all providers."""
        if provider_name:
            if provider_name in self._providers:
                self._health[provider_name] = await self._providers[provider_name].health_check()
        else:
            for name, provider in self._providers.items():
                self._health[name] = await provider.health_check()

    def get_model(
        self,
        task_type: TaskType = TaskType.CHAT,
        complexity: Optional[TaskComplexity] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        preferred_provider: Optional[str] = None,
        trace: Optional[AgentTrace] = None,
    ) -> BaseChatModel:
        """
        Get the optimal LLM for a given task.

        Routing logic:
        1. If preferred_provider is specified and healthy, use it.
        2. For COMPLEX tasks, prefer cloud providers (Gemini > OpenAI).
        3. For SIMPLE/MODERATE tasks, prefer local (Ollama).
        4. For SPECIALIZED (code), use deepseek-coder on Ollama.
        5. Walk the fallback chain if the preferred provider is unhealthy.

        Returns a ready-to-use LangChain ChatModel.
        """
        if complexity is None:
            complexity = TASK_COMPLEXITY_MAP.get(task_type, TaskComplexity.MODERATE)

        # Determine the ideal provider order for this task
        provider_order = self._get_provider_order(task_type, complexity, preferred_provider)

        for provider_name in provider_order:
            if not self._health.get(provider_name, False):
                continue

            provider = self._providers[provider_name]

            # Select the right model within the provider
            model_name = self._select_model(provider_name, task_type)

            try:
                llm = provider.get_chat_model(
                    model=model_name,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                if trace:
                    trace.provider_used = provider_name
                    trace.model_used = model_name
                    if provider_name != provider_order[0]:
                        trace.fallback_used = True

                logger.info(
                    "model_selected",
                    provider=provider_name,
                    model=model_name,
                    task_type=task_type,
                    complexity=complexity,
                )
                return llm

            except Exception as e:
                logger.warning(
                    "provider_failed",
                    provider=provider_name,
                    error=str(e),
                )
                # Mark as unhealthy and try next
                self._health[provider_name] = False
                continue

        # Last resort: try Gemini even if health check failed
        logger.error("all_providers_exhausted", task_type=task_type)
        if settings.has_gemini:
            return self.gemini.get_chat_model(temperature=temperature, max_tokens=max_tokens)
        raise RuntimeError("No LLM providers available. Check your configuration.")

    def _get_provider_order(
        self,
        task_type: TaskType,
        complexity: TaskComplexity,
        preferred: Optional[str],
    ) -> list[str]:
        """Determine the provider priority order based on task requirements."""
        if preferred and preferred in self._providers:
            others = [p for p in self._fallback_chain if p != preferred]
            return [preferred] + others

        if complexity == TaskComplexity.COMPLEX:
            # Complex reasoning → cloud-first
            return [settings.complex_reasoning_provider.value, "gemini", "openai", "ollama"]

        if task_type == TaskType.CODE:
            # Code → default provider first, then others
            return [settings.default_provider.value, "ollama", "gemini", "openai"]

        # Respect the configured DEFAULT_PROVIDER for all other tasks
        # In production (DEFAULT_PROVIDER=gemini): gemini leads
        # In local dev (DEFAULT_PROVIDER=ollama): ollama leads
        default = settings.default_provider.value
        others = [p for p in ["ollama", "gemini", "openai"] if p != default]
        return [default] + others

    def _select_model(self, provider_name: str, task_type: TaskType) -> Optional[str]:
        """Select the best model within a provider for the given task."""
        if provider_name == "ollama":
            model_map = {
                TaskType.CODE: "llama3.1:8b",
                TaskType.PLANNING: "llama3.1:8b",
                TaskType.CHAT: "llama3.1:8b",
                TaskType.SUMMARIZATION: "llama3.1:8b",
                TaskType.QUIZ_GENERATION: "llama3.1:8b",
                TaskType.RAG_RESPONSE: "llama3.1:8b",
                TaskType.FLASHCARD: "llama3.1:8b",
                TaskType.VALIDATION: "llama3.1:8b",
                TaskType.INTENT_CLASSIFICATION: "llama3.1:8b",
                TaskType.WEAK_ANALYSIS: "llama3.1:8b",
                TaskType.REVISION: "llama3.1:8b",
            }
            return model_map.get(task_type, "llama3.1:8b")

        # Cloud providers use their defaults
        return None

    @property
    def health_status(self) -> dict[str, bool]:
        """Current health status of all providers."""
        return dict(self._health)

    @property
    def available_providers(self) -> list[str]:
        """List of currently healthy providers."""
        return [n for n, h in self._health.items() if h]


# Singleton router instance
router = ModelRouter()
