"""
Base Agent Interface
Defines the contract all specialized agents must implement.
Provides common retry logic, output parsing, and trace integration.
"""

import asyncio
import json
import re
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
        # Check trace metadata for preferred provider or model
        pref_provider = kwargs.pop("preferred_provider", None) or trace.metadata.get("preferred_provider")
        model = kwargs.pop("model", None) or trace.metadata.get("preferred_model")

        print(f"\n[BASE_AGENT.get_llm] Agent: {self.agent_name}")
        print(f"[BASE_AGENT.get_llm] Trace metadata: {trace.metadata}")
        print(f"[BASE_AGENT.get_llm] Preferred provider: {pref_provider}")
        print(f"[BASE_AGENT.get_llm] Model: {model}")

        return self.router.get_model(
            task_type=self.task_type,
            trace=trace,
            preferred_provider=pref_provider,
            model=model,
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
        Handles transient failures, rate limits, and tracks retries in the trace.
        """
        last_error = None
        ignored_providers = []
        print(f"\n[INVOKE_LLM] Agent: {self.agent_name}, max_retries: {max_retries}")
        print(f"[INVOKE_LLM] Input vars keys: {list(input_vars.keys())}")

        for attempt in range(max_retries):
            print(f"\n[INVOKE_LLM] Attempt {attempt + 1}/{max_retries}")
            try:
                result = await chain.ainvoke(input_vars)
                print(f"[INVOKE_LLM] Chain invoked successfully!")
                print(f"[INVOKE_LLM] Result type: {type(result).__name__}")

                # Extract text from AIMessage or string result
                content = result
                if isinstance(result, AIMessage):
                    print(f"[INVOKE_LLM] Result is AIMessage")
                    content = result.content
                elif hasattr(result, "content"):
                    print(f"[INVOKE_LLM] Result has .content attribute")
                    content = result.content
                else:
                    print(f"[INVOKE_LLM] Result is plain {type(result).__name__}")

                if isinstance(content, list):
                    print(f"[INVOKE_LLM] Content is a list with {len(content)} items")
                    text_parts = []
                    for part in content:
                        if isinstance(part, str):
                            text_parts.append(part)
                        elif isinstance(part, dict):
                            text_parts.append(part.get("text", ""))
                    result_text = "".join(text_parts)
                else:
                    result_text = str(content)

                print(f"[INVOKE_LLM] Final result length: {len(result_text)}")
                print(f"[INVOKE_LLM] First 300 chars: {result_text[:300]}")
                return result_text

            except Exception as e:
                last_error = e
                trace.retries = attempt + 1
                print(f"[INVOKE_LLM] ERROR on attempt {attempt + 1}: {type(e).__name__}: {str(e)}")
                logger.warning(
                    "llm_invocation_retry",
                    agent=self.agent_name,
                    attempt=attempt + 1,
                    error=str(e),
                )

                # Classify error type
                is_ollama_mem_err = "requires more system memory" in str(e) and trace.provider_used == "ollama"
                is_rate_limit = "429" in str(e) or "quota" in str(e).lower() or "rate limit" in str(e).lower() or "exhausted" in str(e).lower()

                if is_ollama_mem_err:
                    old_model = self.router.ollama.default_model
                    self.router.ollama.fallback_to_smaller_model()
                    if self.router.ollama.default_model == old_model:
                        logger.warning("ollama_no_smaller_model_available", agent=self.agent_name)
                        ignored_providers.append("ollama")
                    else:
                        logger.warning(
                            "ollama_insufficient_memory_switched_model",
                            agent=self.agent_name,
                            old_model=old_model,
                            new_model=self.router.ollama.default_model
                        )
                elif is_rate_limit:
                    logger.info("rate_limit_detected_will_retry_after_wait", provider=trace.provider_used, agent=self.agent_name)
                    if trace.provider_used:
                        ignored_providers.append(trace.provider_used)
                elif trace.provider_used:
                    ignored_providers.append(trace.provider_used)

                # On failure, try refreshing the provider and switching to fallback
                if attempt < max_retries - 1:
                    await self.router.refresh_health(trace.provider_used)

                    # Exponential backoff: default wait 2s, 4s, 6s between retries
                    wait_seconds = 2 * (attempt + 1)

                    # Dynamic rate limit detection for Gemini / other APIs
                    err_str = str(e)
                    match = re.search(r"Please retry in\s*([\d.]+)\s*s", err_str)
                    if match:
                        wait_seconds = float(match.group(1)) + 1.5
                        logger.info("rate_limit_parsed_retry_delay", seconds=wait_seconds, agent=self.agent_name)
                    else:
                        match2 = re.search(r"retry_delay\s*{\s*seconds:\s*(\d+)", err_str)
                        if match2:
                            wait_seconds = float(match2.group(1)) + 1.5
                            logger.info("rate_limit_parsed_retry_delay", seconds=wait_seconds, agent=self.agent_name)

                    logger.info("retry_backoff_wait", seconds=wait_seconds, agent=self.agent_name)
                    await asyncio.sleep(wait_seconds)

                    # Dynamically rebuild the chain with a new model/provider
                    prompt = chain.steps[0] if hasattr(chain, "steps") and len(chain.steps) > 0 else None
                    old_llm = chain.steps[-1] if hasattr(chain, "steps") and len(chain.steps) > 0 else None

                    if prompt and old_llm:
                        temp = getattr(old_llm, "temperature", 0.3)
                        max_tok = getattr(old_llm, "max_tokens", 4096) or getattr(old_llm, "num_predict", 4096)

                        new_llm = self.get_llm(
                            trace,
                            ignored_providers=ignored_providers,
                            temperature=temp,
                            max_tokens=max_tok
                        )
                        chain = prompt | new_llm

        logger.error(
            f"Agent {self.agent_name} failed after {max_retries} attempts. Last error: {last_error}",
            agent=self.agent_name,
            attempts=max_retries,
            last_error=str(last_error),
            error_type=type(last_error).__name__,
        )
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
        Handles common LLM output issues (markdown fences, extra text, truncation).
        """
        print(f"\n[PARSE_JSON_OUTPUT] Agent: {self.agent_name}")
        print(f"[PARSE_JSON_OUTPUT] Raw output length: {len(raw_output)}")
        print(f"[PARSE_JSON_OUTPUT] Raw output (first 500 chars): {raw_output[:500]}")

        if not raw_output or not raw_output.strip():
            print("[PARSE_JSON_OUTPUT] ERROR: Empty raw output!")
            raise ValueError(f"{self.agent_name} returned empty output")

        cleaned = self._clean_json_output(raw_output)
        print(f"[PARSE_JSON_OUTPUT] Cleaned output length: {len(cleaned)}")
        print(f"[PARSE_JSON_OUTPUT] Cleaned output (first 300 chars): {cleaned[:300]}")

        try:
            data = json.loads(cleaned)
            print(f"[PARSE_JSON_OUTPUT] JSON parsed successfully. Keys: {list(data.keys())}")
            result = schema.model_validate(data)
            print(f"[PARSE_JSON_OUTPUT] Schema validation succeeded!")
            return result
        except (json.JSONDecodeError, ValidationError) as first_error:
            print(f"[PARSE_JSON_OUTPUT] First error: {type(first_error).__name__}: {str(first_error)}")

            # Attempt to repair truncated JSON before giving up
            # IMPORTANT: repair on the RAW output, not the cleaned one,
            # because _clean_json_output uses rfind('}') which picks up
            # a nested brace in truncated JSON and mangles the structure.
            logger.warning(
                "output_parse_attempting_repair",
                agent=self.agent_name,
                first_error=str(first_error),
            )
            print(f"[PARSE_JSON_OUTPUT] Attempting JSON repair...")

            try:
                repaired = self._repair_truncated_json(raw_output)
                print(f"[PARSE_JSON_OUTPUT] Repaired JSON length: {len(repaired)}")
                data = json.loads(repaired)
                print(f"[PARSE_JSON_OUTPUT] Repaired JSON parsed. Keys: {list(data.keys())}")
                # Post-process repaired data: fill in missing computed fields
                # that can be derived from existing data. This handles the case
                # where Gemini truncates the JSON mid-schedule and repair closes
                # brackets but leaves out fields like total_study_minutes.
                data = self._fill_missing_defaults(data)
                result = schema.model_validate(data)
                logger.info("output_parse_repaired", agent=self.agent_name)
                print(f"[PARSE_JSON_OUTPUT] Repaired JSON validation succeeded!")
                return result
            except (json.JSONDecodeError, ValidationError, Exception) as repair_error:
                print(f"[PARSE_JSON_OUTPUT] Repair failed: {type(repair_error).__name__}: {str(repair_error)}")
                print(f"[PARSE_JSON_OUTPUT] Raw output tail: {raw_output[-500:]}")
                logger.error(
                    "output_parse_failed",
                    agent=self.agent_name,
                    error=str(first_error),
                    repair_error=str(repair_error),
                    raw_output=raw_output[:500],
                )
                trace.error = f"Output parse error: {str(first_error)}"
                raise ValueError(f"Failed to parse {self.agent_name} output: {first_error} | Repair error: {repair_error}")

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

    def _fill_missing_defaults(self, data: dict) -> dict:
        """
        Fill in missing computed fields for repaired/truncated LLM output.
        E.g., total_study_minutes and subjects_covered can be computed from blocks.
        """
        if "daily_schedules" in data and isinstance(data["daily_schedules"], list):
            for schedule in data["daily_schedules"]:
                if not isinstance(schedule, dict):
                    continue
                blocks = schedule.get("blocks", [])
                # Compute total_study_minutes from blocks if missing
                if "total_study_minutes" not in schedule or not schedule["total_study_minutes"]:
                    total = sum(
                        b.get("duration_minutes", 0)
                        for b in blocks
                        if isinstance(b, dict) and b.get("block_type") != "break"
                    )
                    schedule["total_study_minutes"] = total
                # Compute subjects_covered from blocks if missing
                if "subjects_covered" not in schedule or not schedule["subjects_covered"]:
                    subjects = list({
                        b.get("subject", "Unknown")
                        for b in blocks
                        if isinstance(b, dict) and b.get("block_type") != "break"
                    })
                    schedule["subjects_covered"] = subjects
        return data

    def _repair_truncated_json(self, raw: str) -> str:
        """
        Attempt to repair truncated JSON from LLM output.
        Gemini free tier sometimes truncates responses mid-JSON.

        Strategy:
        1. Strip markdown fences
        2. Find the outermost opening brace
        3. Strip trailing incomplete key-value pairs / partial values
        4. Balance all unclosed brackets and braces
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

        # Find the outermost opening brace
        start = text.find("{")
        if start == -1:
            raise ValueError("No JSON object found")

        text = text[start:]

        # Remove trailing incomplete constructs (apply repeatedly for nested truncation)
        for _ in range(5):
            original = text
            # Remove trailing key with no value: , "key":
            text = re.sub(r',\s*"[^"]*"\s*:\s*$', '', text)
            # Remove trailing comma
            text = re.sub(r',\s*$', '', text)
            # Remove trailing incomplete string value: , "key": "incomplete text
            text = re.sub(r',\s*"[^"]*"\s*:\s*"[^"]*$', '', text)
            # Remove trailing incomplete number value: , "key": 12
            text = re.sub(r',\s*"[^"]*"\s*:\s*\d+\s*$', '', text)
            # Remove trailing incomplete object start: , {
            text = re.sub(r',\s*\{\s*$', '', text)
            # Remove trailing incomplete array start: , [
            text = re.sub(r',\s*\[\s*$', '', text)
            # Remove trailing incomplete object with partial key: , { "key":
            text = re.sub(r',\s*\{\s*"[^"]*"\s*:\s*$', '', text)
            # Remove trailing incomplete object with partial string value
            text = re.sub(r',\s*\{\s*"[^"]*"\s*:\s*"[^"]*$', '', text)
            if text == original:
                break

        # Track open brackets/braces and close them
        stack = []
        in_string = False
        escape_next = False

        for char in text:
            if escape_next:
                escape_next = False
                continue
            if char == '\\' and in_string:
                escape_next = True
                continue
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            if char in '{[':
                stack.append(char)
            elif char == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
            elif char == ']':
                if stack and stack[-1] == '[':
                    stack.pop()

        # If we're still inside a string (unclosed quote), close it
        if in_string:
            text += '"'

        # Close any remaining open brackets/braces
        closers = {'[': ']', '{': '}'}
        for opener in reversed(stack):
            text += closers.get(opener, '')

        return text
