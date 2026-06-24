"""
AI Study Coach Agent
Analyzes user performance data (analytics, quiz scores, task workloads, and weak topics)
and generates a structured, highly actionable coaching report.
"""

from typing import Any, Dict

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import STUDY_COACH_PROMPT
from app.schemas.ai_schemas import StudyCoachResponse
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("study_coach_agent")


class StudyCoachAgent(BaseAgent):
    """
    Synthesizes multiple academic signals into a friendly,
    actionable study coaching advice message with action steps and tips.
    """

    agent_name = "study_coach"
    task_type = TaskType.WEAK_ANALYSIS  # Uses complex reasoning/analysis model

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Run study coaching analysis."""
        trace.agent_name = self.agent_name

        analytics = input_data.get("analytics") or {}
        quiz_history = input_data.get("quiz_history") or []
        task_history = input_data.get("task_history") or []
        weak_topics = input_data.get("weak_topics") or []

        llm = self.get_llm(trace, temperature=0.3)
        chain = STUDY_COACH_PROMPT | llm

        input_vars = {
            "analytics": str(analytics),
            "quiz_history": str(quiz_history[:15]),
            "task_history": str(task_history[:15]),
            "weak_topics": ", ".join(weak_topics),
        }

        logger.info(
            "study_coach_analysis_started",
            user_id=input_data.get("user_id"),
            weak_topics_count=len(weak_topics),
            quizzes_count=len(quiz_history),
        )

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)
        coach_advice = self.parse_json_output(raw_output, StudyCoachResponse, trace)

        trace.finish(success=True)

        logger.info(
            "study_coach_analysis_completed",
            user_id=input_data.get("user_id"),
        )

        return coach_advice.model_dump()
