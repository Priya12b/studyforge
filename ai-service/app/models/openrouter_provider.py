"""
OpenRouter Cloud LLM Provider
Unified access to open-source and proprietary models.
"""

from typing import Optional
import httpx
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.models.base_provider import LLMProvider
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("openrouter_provider")


class OpenRouterProvider(LLMProvider):
    """Provider for OpenRouter API models."""

    name = "openrouter"

    def __init__(self):
        self.api_key = settings.openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"

    def get_chat_model(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Create a ChatOpenAI instance pointing to OpenRouter."""
        model_name = model or self.get_default_model()

        return ChatOpenAI(
            model=model_name,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=temperature,
            max_tokens=max_tokens,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://studyforge.dev",
                "X-Title": "StudyForge AI Planner",
            }
        )

    async def health_check(self) -> bool:
        """Verify the OpenRouter API key is valid."""
        if not self.api_key:
            logger.warning("openrouter_no_api_key")
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                ok = response.status_code == 200
                logger.info("openrouter_health_check", available=ok)
                return ok
        except Exception as e:
            logger.warning("openrouter_health_failed", error=str(e))
            return False

    def get_default_model(self) -> str:
        return "google/gemini-2.5-flash"
