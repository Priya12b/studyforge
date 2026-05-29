"""
Validation & Safety Agent
Validates AI outputs for logical consistency, schema conformance,
and scheduling impossibilities before they reach the user.
"""

import json
from typing import Any, Dict, Optional

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import VALIDATION_PROMPT
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("validation_agent")


class ValidationAgent(BaseAgent):
    """
    Quality assurance agent that validates AI outputs.

    Performs both:
    1. Deterministic validation (schema checks, logic checks)
    2. AI-powered validation (semantic consistency, hallucination detection)

    Use the deterministic checks for speed; invoke AI validation
    only for complex outputs (study plans, analytics).
    """

    agent_name = "validation"
    task_type = TaskType.VALIDATION

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Validate an AI output using both deterministic and AI checks."""
        trace.agent_name = self.agent_name

        output_type = input_data.get("output_type", "unknown")
        content = input_data.get("content", {})

        # Step 1: Fast deterministic validation
        det_result = self._deterministic_validate(output_type, content)

        if not det_result["valid"]:
            trace.finish(success=True)
            return det_result

        # Step 2: AI-powered validation (only for complex outputs)
        if output_type in ("study_plan", "analytics", "revision_schedule"):
            ai_result = await self._ai_validate(output_type, content, trace)
            return self._merge_validations(det_result, ai_result)

        trace.finish(success=True)
        return det_result

    def _deterministic_validate(self, output_type: str, content: Any) -> Dict[str, Any]:
        """
        Fast, deterministic validation checks.
        No LLM — pure logic.
        """
        issues = []

        if output_type == "study_plan":
            issues.extend(self._validate_study_plan(content))
        elif output_type == "revision_schedule":
            issues.extend(self._validate_revision_schedule(content))
        elif output_type == "quiz":
            issues.extend(self._validate_quiz(content))

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "validation_type": "deterministic",
        }

    def _validate_study_plan(self, plan: dict) -> list:
        """Validate study plan logical consistency."""
        issues = []

        schedules = plan.get("daily_schedules", [])
        if not schedules:
            issues.append("Study plan has no daily schedules")
            return issues

        for day in schedules:
            date = day.get("date", "unknown")
            blocks = day.get("blocks", [])

            # Check for overlapping time blocks
            times = []
            for block in blocks:
                start = block.get("start_time", "")
                end = block.get("end_time", "")
                if start and end:
                    times.append((start, end, block.get("subject", "")))

            times.sort()
            for i in range(1, len(times)):
                if times[i][0] < times[i-1][1]:
                    issues.append(
                        f"Overlapping blocks on {date}: "
                        f"{times[i-1][2]} ({times[i-1][0]}-{times[i-1][1]}) and "
                        f"{times[i][2]} ({times[i][0]}-{times[i][1]})"
                    )

            # Check for unreasonable durations
            total = day.get("total_study_minutes", 0)
            if total > 960:  # >16 hours
                issues.append(f"Day {date} has {total} minutes of study — physically impossible")

        return issues

    def _validate_revision_schedule(self, schedule: dict) -> list:
        """Validate revision schedule."""
        issues = []

        entries = schedule.get("entries", [])
        for entry in entries:
            if entry.get("interval_days", 0) < 0:
                issues.append(f"Negative interval for {entry.get('topic', 'unknown')}")
            if entry.get("estimated_minutes", 0) > 180:
                issues.append(f"Unreasonable revision duration for {entry.get('topic', 'unknown')}: {entry.get('estimated_minutes')} minutes")

        return issues

    def _validate_quiz(self, quiz: dict) -> list:
        """Validate quiz structure."""
        issues = []

        questions = quiz.get("questions", [])
        for i, q in enumerate(questions):
            if not q.get("question"):
                issues.append(f"Question {i+1} has no text")
            options = q.get("options", [])
            if len(options) < 2:
                issues.append(f"Question {i+1} has fewer than 2 options")
            correct = q.get("correct_answer", "")
            if not correct:
                issues.append(f"Question {i+1} has no correct answer specified")

        return issues

    async def _ai_validate(
        self,
        output_type: str,
        content: Any,
        trace: AgentTrace,
    ) -> Dict[str, Any]:
        """AI-powered validation for complex outputs."""
        try:
            llm = self.get_llm(trace, temperature=0)
            chain = VALIDATION_PROMPT | llm

            content_str = json.dumps(content, indent=2)[:4000]  # Limit size

            raw_output = await self.invoke_llm_with_retry(
                chain,
                {"output_type": output_type, "content": content_str},
                trace,
                max_retries=2,
            )

            # Parse validation result
            cleaned = self._clean_json_output(raw_output)
            result = json.loads(cleaned)

            return {
                "valid": result.get("valid", True),
                "issues": result.get("issues", []),
                "validation_type": "ai",
            }

        except Exception as e:
            logger.warning("ai_validation_failed", error=str(e))
            # If AI validation fails, don't block — return as valid
            return {"valid": True, "issues": [], "validation_type": "ai_fallback"}

    def _merge_validations(self, det: dict, ai: dict) -> dict:
        """Merge deterministic and AI validation results."""
        all_issues = det.get("issues", []) + ai.get("issues", [])
        return {
            "valid": len(all_issues) == 0,
            "issues": all_issues,
            "validation_type": "combined",
        }
