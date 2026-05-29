"""
Google Gemini Cloud LLM Provider
Primary cloud fallback with production-grade configuration.
"""

from typing import Optional
import httpx
from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI

from app.models.base_provider import LLMProvider
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("gemini_provider")


class GeminiProvider(LLMProvider):
    """Provider for Google Gemini API models."""

    name = "gemini"

    def __init__(self):
        self.api_key = settings.gemini_api_key

    def get_chat_model(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Create a ChatGoogleGenerativeAI instance."""
        model_name = model or self.get_default_model()

        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=self.api_key,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

    async def health_check(self) -> bool:
        """Verify the Gemini API key is valid by making a lightweight request."""
        if not self.api_key:
            logger.warning("gemini_no_api_key")
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={self.api_key}"
                )
                ok = response.status_code == 200
                logger.info("gemini_health_check", available=ok)
                return ok
        except Exception as e:
            logger.warning("gemini_health_failed", error=str(e))
            return False

    def get_default_model(self) -> str:
        return "gemini-2.5-flash"
