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
from app.models.openrouter_provider import OpenRouterProvider
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
        self.openrouter = OpenRouterProvider()

        self._providers: dict[str, LLMProvider] = {
            "ollama": self.ollama,
            "gemini": self.gemini,
            "openai": self.openai,
            "openrouter": self.openrouter,
        }

        # Health status cache (updated periodically)
        self._health: dict[str, bool] = {
            "ollama": False,
            "gemini": False,
            "openai": False,
            "openrouter": False,
        }

        # Fallback chain: try providers in this order
        self._fallback_chain = ["openrouter", "gemini", "openai", "ollama"]

    async def initialize(self) -> None:
        """Run health checks on all providers at startup."""
        logger.info("=== Model Router Initialization ===")
        logger.info(f"Default Provider: {settings.default_provider}")

        # Log which API keys are configured
        configured = []
        if settings.gemini_api_key:
            configured.append("[OK] Gemini API Key configured")
        if settings.openai_api_key:
            configured.append("[OK] OpenAI API Key configured")
        if settings.openrouter_api_key:
            configured.append("[OK] OpenRouter API Key configured")

        if configured:
            for msg in configured:
                logger.info(msg)
        else:
            logger.warning("[WARN] No LLM provider API keys configured!")

        # Run health checks with timeout
        logger.info("Running provider health checks...")
        import asyncio
        for name, provider in self._providers.items():
            try:
                # Add timeout to prevent hanging
                self._health[name] = await asyncio.wait_for(provider.health_check(), timeout=10.0)
                status = "available" if self._health[name] else "unavailable"
                logger.info(f"  {name}: {status}")
            except asyncio.TimeoutError:
                logger.warning(f"  {name}: health check timed out")
                self._health[name] = False
            except Exception as e:
                logger.warning(f"  {name}: health check failed - {str(e)}")
                self._health[name] = False

        available = [n for n, h in self._health.items() if h]
        if not available:
            logger.warning("No providers currently available - will attempt on first request")
        else:
            logger.info(f"Ready with providers: {', '.join(available)}")

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
        max_tokens: int = 8192,
        preferred_provider: Optional[str] = None,
        trace: Optional[AgentTrace] = None,
        model: Optional[str] = None,
        **kwargs,
    ) -> BaseChatModel:
        """
        Get the optimal LLM for a given task.

        Routing logic:
        1. If preferred_provider is specified, TRY IT FIRST (even if health check failed).
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

        # Filter out ignored providers (used during retries/fallback)
        ignored_providers = kwargs.pop("ignored_providers", [])
        if ignored_providers:
            provider_order = [p for p in provider_order if p not in ignored_providers]

        for provider_name in provider_order:
            # If explicitly requested, ALWAYS try it first (don't skip based on health check)
            # Health checks can be stale; we should try the explicit request
            if preferred_provider and provider_name == preferred_provider:
                pass
            elif not self._health.get(provider_name, False):
                continue

            provider = self._providers[provider_name]

            # Select the right model within the provider
            model_name = model if model else self._select_model(provider_name, task_type)

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
        logger.error("All configured providers failed")

        if settings.has_gemini:
            logger.info("Attempting last-resort Gemini connection...")
            try:
                return self.gemini.get_chat_model(temperature=temperature, max_tokens=max_tokens)
            except Exception as e:
                logger.error(f"Last-resort Gemini also failed: {str(e)}")

        # Build detailed error message
        configured_providers = []
        if settings.gemini_api_key:
            configured_providers.append("Gemini (API key set)")
        if settings.openai_api_key:
            configured_providers.append("OpenAI (API key set)")
        if settings.openrouter_api_key:
            configured_providers.append("OpenRouter (API key set)")

        error_msg = (
            "No LLM providers available! "
            f"Configured: {', '.join(configured_providers) if configured_providers else 'NONE'}. "
            "Please check your .env file and ensure at least one API key is valid."
        )

        logger.error(error_msg)
        raise RuntimeError(error_msg)

    def _get_provider_order(
        self,
        task_type: TaskType,
        complexity: TaskComplexity,
        preferred: Optional[str],
    ) -> list[str]:
        """Determine the provider priority order based on task requirements."""

        if preferred and preferred in self._providers:
            others = [p for p in self._fallback_chain if p != preferred]
            result = [preferred] + others
            return result

        if complexity == TaskComplexity.COMPLEX:
            # Complex reasoning → cloud-first
            default_complex = settings.complex_reasoning_provider.value
            others = [p for p in ["openrouter", "gemini", "openai", "ollama"] if p != default_complex]
            result = [default_complex] + others
            return result

        if task_type == TaskType.CODE:
            # Code → default provider first, then others
            default = settings.default_provider.value
            others = [p for p in ["ollama", "gemini", "openai", "openrouter"] if p != default]
            result = [default] + others
            return result

        # Respect the configured DEFAULT_PROVIDER for all other tasks
        # In production (DEFAULT_PROVIDER=gemini): gemini leads
        # In local dev (DEFAULT_PROVIDER=ollama): ollama leads
        default = settings.default_provider.value
        others = [p for p in ["openrouter", "ollama", "gemini", "openai"] if p != default]
        result = [default] + others
        return result

    def _select_model(self, provider_name: str, task_type: TaskType) -> Optional[str]:
        """Select the best model within a provider for the given task."""
        if provider_name == "ollama":
            model_map = {
                TaskType.CODE: settings.ollama_default_model,
                TaskType.PLANNING: settings.ollama_default_model,
                TaskType.CHAT: settings.ollama_default_model,
                TaskType.SUMMARIZATION: settings.ollama_default_model,
                TaskType.QUIZ_GENERATION: settings.ollama_default_model,
                TaskType.RAG_RESPONSE: settings.ollama_default_model,
                TaskType.FLASHCARD: settings.ollama_default_model,
                TaskType.VALIDATION: settings.ollama_default_model,
                TaskType.INTENT_CLASSIFICATION: settings.ollama_default_model,
                TaskType.WEAK_ANALYSIS: settings.ollama_default_model,
                TaskType.REVISION: settings.ollama_default_model,
            }
            return model_map.get(task_type, settings.ollama_default_model)

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
