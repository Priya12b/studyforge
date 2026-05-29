"""
Base Agent Interface
Defines the contract all specialized agents must implement.
Provides common retry logic, output parsing, and trace integration.
"""

import asyncio
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, TypeVar, Type

from pydantic import BaseModel, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage

from app.models.router import ModelRouter, TaskType
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("base_agent")

T = TypeVar("T", bound=BaseModel)


class BaseAgent(ABC):
    """
    Abstract base agent with built-in:
    - Model routing integration
    - Output parsing with Pydantic validation
    - Retry logic with exponential backoff
    - Trace/observability integration
    - Error handling and graceful degradation
    """

    # Subclasses must set these
    agent_name: str = "base"
    task_type: TaskType = TaskType.CHAT

    def __init__(self, model_router: ModelRouter):
        self.router = model_router

    @abstractmethod
    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """
        Execute the agent's core logic.
        Must be implemented by every agent subclass.

        Args:
            input_data: Agent-specific input parameters
            trace: AgentTrace for observability

        Returns:
            Agent-specific output dictionary
        """
        ...

    def get_llm(self, trace: AgentTrace, **kwargs) -> BaseChatModel:
        """Get the appropriate LLM for this agent's task type."""
        return self.router.get_model(
            task_type=self.task_type,
            trace=trace,
            **kwargs,
        )

    async def invoke_llm_with_retry(
        self,
        chain: Any,
        input_vars: Dict[str, Any],
        trace: AgentTrace,
        max_retries: int = 3,
    ) -> str:
        """
        Invoke a LangChain chain with retry logic.
        Handles transient failures and tracks retries in the trace.
        """
        last_error = None

        for attempt in range(max_retries):
            try:
                result = await chain.ainvoke(input_vars)

                # Extract text from AIMessage or string result
                if isinstance(result, AIMessage):
                    return result.content
                elif hasattr(result, "content"):
                    return result.content
                return str(result)

            except Exception as e:
                last_error = e
                trace.retries = attempt + 1
                logger.warning(
                    "llm_invocation_retry",
                    agent=self.agent_name,
                    attempt=attempt + 1,
                    error=str(e),
                )

                # On failure, try refreshing the provider and switching to fallback
                if attempt < max_retries - 1:
                    await self.router.refresh_health(trace.provider_used)
                    # Exponential backoff: wait 2s, 4s, 6s between retries
                    # This handles Gemini free-tier 429 rate limit errors gracefully
                    wait_seconds = 2 * (attempt + 1)
                    logger.info("retry_backoff_wait", seconds=wait_seconds, agent=self.agent_name)
                    await asyncio.sleep(wait_seconds)

        raise RuntimeError(
            f"Agent {self.agent_name} failed after {max_retries} retries: {last_error}"
        )

    def parse_json_output(
        self,
        raw_output: str,
        schema: Type[T],
        trace: AgentTrace,
    ) -> T:
        """
        Parse LLM output into a Pydantic model.
        Handles common LLM output issues (markdown fences, extra text).
        """
        cleaned = self._clean_json_output(raw_output)

        try:
            data = json.loads(cleaned)
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(
                "output_parse_failed",
                agent=self.agent_name,
                error=str(e),
                raw_output=raw_output[:500],
            )
            trace.error = f"Output parse error: {str(e)}"
            raise ValueError(f"Failed to parse {self.agent_name} output: {e}")

    def _clean_json_output(self, raw: str) -> str:
        """
        Clean LLM output to extract valid JSON.
        Handles markdown code fences, leading/trailing text, etc.
        """
        text = raw.strip()

        # Remove markdown code fences
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        # Try to find JSON object boundaries
        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1 and end > start:
            text = text[start:end + 1]

        return text
