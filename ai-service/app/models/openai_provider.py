"""
OpenAI Cloud LLM Provider
Secondary cloud fallback for maximum reliability.
"""

from typing import Optional
import httpx
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.models.base_provider import LLMProvider
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("openai_provider")


class OpenAIProvider(LLMProvider):
    """Provider for OpenAI API models."""

    name = "openai"

    def __init__(self):
        self.api_key = settings.openai_api_key

    def get_chat_model(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        streaming: bool = False,
    ) -> BaseChatModel:
        """Create a ChatOpenAI instance."""
        model_name = model or self.get_default_model()

        return ChatOpenAI(
            model=model_name,
            api_key=self.api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            streaming=streaming,
        )

    async def health_check(self) -> bool:
        """Verify the OpenAI API key is valid."""
        if not self.api_key:
            logger.warning("openai_no_api_key")
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                ok = response.status_code == 200
                logger.info("openai_health_check", available=ok)
                return ok
        except Exception as e:
            logger.warning("openai_health_failed", error=str(e))
            return False

    def get_default_model(self) -> str:
        return "gpt-4o-mini"
