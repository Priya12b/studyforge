"""
Revision Intelligence Agent
Implements spaced repetition scheduling based on the forgetting curve.
Generates optimized revision schedules to maximize memory retention.
"""

from typing import Any, Dict
from datetime import datetime

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import REVISION_AGENT_PROMPT
from app.schemas.ai_schemas import RevisionScheduleResponse
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("revision_agent")

# Spaced repetition intervals (in days) based on the Ebbinghaus forgetting curve
SPACED_INTERVALS = [1, 3, 7, 14, 30, 60]


class RevisionAgent(BaseAgent):
    """
    Revision scheduling agent using spaced repetition principles.

    Combines AI reasoning with deterministic interval logic
    to produce revision schedules that optimize long-term retention.
    """

    agent_name = "revision"
    task_type = TaskType.REVISION

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Generate a revision schedule using spaced repetition."""
        trace.agent_name = self.agent_name

        llm = self.get_llm(trace, temperature=0.2)
        chain = REVISION_AGENT_PROMPT | llm

        # Prepare input
        topics = input_data.get("topics_studied", [])
        study_history = input_data.get("study_history", [])
        weak_topics = input_data.get("weak_topics", [])
        daily_capacity = input_data.get("daily_capacity_minutes", 120)
        current_date = input_data.get("current_date", datetime.now().strftime("%Y-%m-%d"))

        input_vars = {
            "topics_studied": self._format_topics(topics),
            "study_history": str(study_history[:20]),  # Limit history size
            "current_date": current_date,
            "daily_capacity": daily_capacity,
            "weak_topics": ", ".join(weak_topics) if weak_topics else "None identified",
        }

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)

        # Parse and validate
        schedule = self.parse_json_output(raw_output, RevisionScheduleResponse, trace)

        # Apply deterministic interval validation
        schedule = self._validate_intervals(schedule)

        trace.finish(success=True)

        logger.info(
            "revision_schedule_generated",
            total_entries=len(schedule.entries),
            total_topics=schedule.total_topics,
        )

        return schedule.model_dump()

    def _format_topics(self, topics: list) -> str:
        """Format topics list for the prompt."""
        if not topics:
            return "No topics recorded yet"

        lines = []
        for t in topics:
            if isinstance(t, dict):
                name = t.get("topic", t.get("name", "Unknown"))
                subject = t.get("subject", "")
                last_studied = t.get("last_studied", "Unknown")
                lines.append(f"- {subject}: {name} (Last studied: {last_studied})")
            else:
                lines.append(f"- {t}")

        return "\n".join(lines)

    def _validate_intervals(self, schedule: RevisionScheduleResponse) -> RevisionScheduleResponse:
        """
        Validate that revision intervals follow spaced repetition logic.
        Fix any intervals that are too short or too long.
        """
        for entry in schedule.entries:
            rep_num = entry.repetition_number

            # Clamp repetition number
            if rep_num < 1:
                entry.repetition_number = 1

            # Validate interval matches the repetition number
            expected_interval = SPACED_INTERVALS[min(rep_num - 1, len(SPACED_INTERVALS) - 1)]
            if entry.interval_days < expected_interval * 0.5:
                logger.debug(
                    "interval_adjusted",
                    topic=entry.topic,
                    original=entry.interval_days,
                    adjusted=expected_interval,
                )
                entry.interval_days = expected_interval

        return schedule

    @staticmethod
    def calculate_next_review(last_reviewed: str, repetition: int) -> str:
        """
        Calculate the next review date based on spaced repetition.

        Pure deterministic function — no LLM involved.
        Can be called independently for precise scheduling.
        """
        from datetime import timedelta

        last_date = datetime.strptime(last_reviewed, "%Y-%m-%d")
        interval = SPACED_INTERVALS[min(repetition - 1, len(SPACED_INTERVALS) - 1)]
        next_date = last_date + timedelta(days=interval)
        return next_date.strftime("%Y-%m-%d")
