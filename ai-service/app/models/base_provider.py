"""
LLM Provider Abstraction Layer
Unified interface for Ollama, Gemini, and OpenAI with automatic health checks.
"""

from abc import ABC, abstractmethod
from typing import Optional, AsyncIterator
from langchain_core.language_models import BaseChatModel
from app.utils.logging import get_logger

logger = get_logger("providers")


class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    name: str = "base"

    @abstractmethod
    def get_chat_model(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Return a LangChain chat model instance."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is available and responding."""
        ...

    @abstractmethod
    def get_default_model(self) -> str:
        """Return the default model name for this provider."""
        ...
