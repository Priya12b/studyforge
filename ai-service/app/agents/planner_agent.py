"""
Study Planner Agent
Generates personalized, deterministic study schedules with intelligent
time allocation, subject prioritization, and revision integration.
"""

import json
from typing import Any, Dict

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import STUDY_PLANNER_PROMPT
from app.schemas.ai_schemas import StudyPlanResponse
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("planner_agent")


class PlannerAgent(BaseAgent):
    """
    Generates AI-powered study plans.

    Uses weighted scheduling logic:
    - Weak subjects get 1.5-2x time allocation
    - Critical priority subjects get scheduling priority
    - Exam proximity increases subject urgency
    - Break periods enforce Pomodoro-style work/rest cycles
    """

    agent_name = "planner"
    task_type = TaskType.PLANNING

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Generate a complete study plan."""
        trace.agent_name = self.agent_name

        print(f"\n[PLANNER_AGENT] ===== EXECUTING PLANNER =====")
        print(f"[PLANNER_AGENT] Input data keys: {list(input_data.keys())}")
        print(f"[PLANNER_AGENT] Num subjects: {len(input_data.get('subjects', []))}")
        print(f"[PLANNER_AGENT] Available hours: {input_data.get('available_hours_per_day', 4)}")

        logger.info(
            "study_plan_generation_started",
            num_subjects=len(input_data.get("subjects", [])),
            available_hours=input_data.get("available_hours_per_day", 4),
            start_date=input_data.get("start_date"),
            end_date=input_data.get("end_date"),
        )

        try:
            # Get a complex-reasoning capable model for planning
            # REDUCED from 16384 to 8192 - planner doesn't need 16k tokens
            print(f"[PLANNER_AGENT] Getting LLM with max_tokens=8192...")
            llm = self.get_llm(trace, temperature=0.2, max_tokens=8192)
            print(f"[PLANNER_AGENT] LLM obtained: {type(llm).__name__}")

            # Build the chain
            print(f"[PLANNER_AGENT] Building prompt chain...")
            chain = STUDY_PLANNER_PROMPT | llm

            # Prepare input variables
            subjects_info = self._format_subjects(input_data.get("subjects", []))
            weak_subjects = input_data.get("weak_subjects", [])

            input_vars = {
                "subjects": subjects_info,
                "available_hours": input_data.get("available_hours_per_day", 4),
                "start_date": input_data.get("start_date", ""),
                "end_date": input_data.get("end_date", ""),
                "start_time": input_data.get("preferred_start_time", "09:00"),
                "end_time": input_data.get("preferred_end_time", "21:00"),
                "break_minutes": input_data.get("break_duration_minutes", 15),
                "weak_subjects": ", ".join(weak_subjects) if weak_subjects else "None specified",
                "goals": input_data.get("goals", "Prepare thoroughly for exams"),
            }

            print(f"[PLANNER_AGENT] Input variables prepared. Keys: {list(input_vars.keys())}")

            # Invoke with retry
            print(f"[PLANNER_AGENT] Invoking LLM with retry...")
            raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)

            print(f"[PLANNER_AGENT] Raw LLM output received, length: {len(raw_output)}")

            # Parse into structured output
            print(f"[PLANNER_AGENT] Parsing JSON output...")
            plan = self.parse_json_output(raw_output, StudyPlanResponse, trace)

            print(f"[PLANNER_AGENT] Plan parsed successfully!")
            print(f"[PLANNER_AGENT] Plan has {len(plan.daily_schedules)} daily schedules")

            # Post-processing: validate the plan
            print(f"[PLANNER_AGENT] Validating plan...")
            validated_plan = self._validate_plan(plan, input_data)

            trace.finish(success=True)

            logger.info(
                "study_plan_generated",
                days=len(validated_plan.daily_schedules),
                subjects=len(input_data.get("subjects", [])),
                confidence=validated_plan.confidence_score,
            )

            print(f"[PLANNER_AGENT] ===== PLANNER COMPLETE =====\n")
            return validated_plan.model_dump()
        except Exception as e:
            print(f"\n[PLANNER_AGENT] ===== PLANNER FAILED =====")
            print(f"[PLANNER_AGENT] Error type: {type(e).__name__}")
            print(f"[PLANNER_AGENT] Error message: {str(e)}")
            import traceback
            print(f"[PLANNER_AGENT] Full traceback:")
            traceback.print_exc()
            print(f"[PLANNER_AGENT] ===== END TRACEBACK =====\n")

            logger.error(
                "study_plan_generation_failed",
                num_subjects=len(input_data.get("subjects", [])),
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    def _format_subjects(self, subjects: list) -> str:
        """Format subjects list into a structured string for the prompt."""
        if not subjects:
            return "No subjects provided"

        lines = []
        for s in subjects:
            name = s.get("name", "Unknown")
            confidence = s.get("confidence_level", 50)
            priority = s.get("priority", "medium")
            topics = s.get("syllabus_topics", [])
            exam = s.get("exam_date", "Not set")

            lines.append(
                f"- {name} (Confidence: {confidence}%, Priority: {priority}, "
                f"Exam: {exam}, Topics: {', '.join(topics[:5]) if topics else 'General study'})"
            )

        return "\n".join(lines)

    def _validate_plan(self, plan: StudyPlanResponse, input_data: dict) -> StudyPlanResponse:
        """
        Post-processing validation to catch impossible schedules.
        Fixes common LLM scheduling errors.
        """
        available_minutes = int(input_data.get("available_hours_per_day", 4) * 60)

        for day in plan.daily_schedules:
            # Cap daily study time at available hours
            if day.total_study_minutes > available_minutes * 1.1:
                logger.warning(
                    "plan_exceeds_capacity",
                    date=day.date,
                    planned=day.total_study_minutes,
                    available=available_minutes,
                )
                # Don't modify — let the validation agent catch it

            # Ensure no blocks exceed 90 minutes
            for block in day.blocks:
                if block.duration_minutes > 90 and block.block_type != "break":
                    block.duration_minutes = 90
                    block.notes = "(Adjusted: max 90 min per block)"

        return plan
