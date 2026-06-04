"""
Ollama Local LLM Provider
Manages connections to locally-running Ollama models with health checking.
"""

from typing import Optional
import httpx
from langchain_core.language_models import BaseChatModel
from langchain_ollama import ChatOllama

from app.models.base_provider import LLMProvider
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("ollama_provider")


class OllamaProvider(LLMProvider):
    """Provider for locally-hosted Ollama models."""

    name = "ollama"

    # Map of task types to recommended Ollama models
    MODEL_MAP = {
        "general": "llama3.1:8b",
        "reasoning": "llama3.1:8b",
        "coding": "llama3.1:8b",
        "fast": "llama3.1:8b",
        "creative": "llama3.1:8b",
    }

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.default_model = settings.ollama_default_model
        self._available_models: list[str] = []

    def get_chat_model(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 8192,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Create a ChatOllama instance with the specified configuration."""
        model_name = model or self.default_model

        return ChatOllama(
            model=model_name,
            base_url=self.base_url,
            temperature=temperature,
            num_predict=max_tokens,
            # Keep_alive keeps model in memory for faster subsequent calls
            keep_alive="10m",
        )

    def get_model_for_task(self, task_type: str = "general") -> str:
        """Select the best Ollama model for a given task type."""
        return self.MODEL_MAP.get(task_type, self.default_model)

    async def health_check(self) -> bool:
        """Verify Ollama is running and at least one model is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    self._available_models = [
                        m["name"] for m in data.get("models", [])
                    ]
                    logger.info(
                        "ollama_health_ok",
                        models_available=len(self._available_models),
                    )
                    return len(self._available_models) > 0
        except Exception as e:
            logger.warning("ollama_health_failed", error=str(e))
        return False

    def get_default_model(self) -> str:
        return self.default_model

    @property
    def available_models(self) -> list[str]:
        return self._available_models

    def fallback_to_smaller_model(self) -> None:
        """Fallback to a smaller model if the default model fails due to memory."""
        smaller_candidates = ["tinyllama", "phi3", "phi-3", "gemma:2b", "qwen2:1.5b", "qwen", "llama3.2:1b", "llama3.2:3b"]
        
        # Check if we have any smaller candidates pulled
        for candidate in smaller_candidates:
            for model in self._available_models:
                if candidate in model.lower():
                    logger.info("ollama_switching_to_smaller_model", from_model=self.default_model, to_model=model)
                    self.default_model = model
                    return
                    
        # Fallback to the first available model that is not the current default and not an embedding model
        for model in self._available_models:
            if model != self.default_model and "embed" not in model.lower():
                logger.info("ollama_switching_to_smaller_model_fallback", from_model=self.default_model, to_model=model)
                self.default_model = model
                return
