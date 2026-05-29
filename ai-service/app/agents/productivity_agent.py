"""
Productivity Analytics Agent
Analyzes study patterns, detects burnout risk, identifies peak productivity hours,
and generates actionable recommendations using a mix of deterministic analytics and AI insights.
"""

from typing import Any, Dict, List
from datetime import datetime, timedelta

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import PRODUCTIVITY_ANALYSIS_PROMPT
from app.schemas.ai_schemas import ProductivityAnalysisResponse
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("productivity_agent")


class ProductivityAgent(BaseAgent):
    """
    Combines deterministic analytics with AI-powered insights:

    Deterministic layer (no LLM):
    - Total study hours calculation
    - Consistency scoring (std deviation of daily hours)
    - Burnout risk calculation (overwork detection)
    - Peak hours identification

    AI layer (LLM):
    - Trend interpretation
    - Personalized recommendations
    - Behavioral pattern analysis
    """

    agent_name = "productivity"
    task_type = TaskType.WEAK_ANALYSIS  # Uses complex reasoning

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Run full productivity analysis."""
        trace.agent_name = self.agent_name

        study_logs = input_data.get("study_logs", [])
        quiz_scores = input_data.get("quiz_scores", [])
        days = input_data.get("days_to_analyze", 7)

        # Step 1: Deterministic pre-analysis
        deterministic = self._deterministic_analysis(study_logs, quiz_scores, days)

        # Step 2: AI-powered interpretation
        llm = self.get_llm(trace, temperature=0.3)
        chain = PRODUCTIVITY_ANALYSIS_PROMPT | llm

        input_vars = {
            "study_logs": str(study_logs[:30]),
            "quiz_scores": str(quiz_scores[:20]),
            "days": days,
        }

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)
        ai_analysis = self.parse_json_output(raw_output, ProductivityAnalysisResponse, trace)

        # Step 3: Merge deterministic + AI results (deterministic takes priority for metrics)
        merged = self._merge_results(deterministic, ai_analysis)

        trace.finish(success=True)

        logger.info(
            "productivity_analyzed",
            productivity_score=merged.productivity_score,
            burnout_risk=merged.burnout_risk,
            consistency=merged.consistency_score,
        )

        return merged.model_dump()

    def _deterministic_analysis(
        self,
        study_logs: List[dict],
        quiz_scores: List[dict],
        days: int,
    ) -> dict:
        """
        Pure deterministic analytics — no LLM, fully reproducible.
        """
        if not study_logs:
            return {
                "productivity_score": 0,
                "burnout_risk": 0,
                "consistency_score": 0,
                "peak_hours": [],
                "daily_hours": [],
            }

        # Calculate daily study hours
        daily_hours = {}
        hour_distribution = {}

        for log in study_logs:
            date = log.get("date", "")
            minutes = log.get("minutes", 0)
            hour = log.get("start_hour", 12)

            daily_hours[date] = daily_hours.get(date, 0) + minutes
            hour_distribution[hour] = hour_distribution.get(hour, 0) + minutes

        hours_list = list(daily_hours.values())

        if not hours_list:
            return {
                "productivity_score": 0,
                "burnout_risk": 0,
                "consistency_score": 0,
                "peak_hours": [],
                "daily_hours": [],
            }

        # Productivity score: based on average daily minutes
        avg_minutes = sum(hours_list) / len(hours_list)
        target_minutes = 240  # 4 hours target
        productivity = min(100, (avg_minutes / target_minutes) * 100)

        # Consistency score: inverse of coefficient of variation
        import statistics
        if len(hours_list) > 1:
            std_dev = statistics.stdev(hours_list)
            mean = statistics.mean(hours_list)
            cv = std_dev / mean if mean > 0 else 1
            consistency = max(0, min(100, 100 * (1 - cv)))
        else:
            consistency = 50

        # Burnout risk: based on overwork patterns
        overwork_days = sum(1 for h in hours_list if h > 480)  # >8 hours
        consecutive_high = self._count_consecutive_high_days(hours_list)
        burnout_risk = min(100, (overwork_days / max(len(hours_list), 1)) * 50 + consecutive_high * 10)

        # Quiz score trend
        if quiz_scores and len(quiz_scores) > 2:
            recent_avg = sum(q.get("score", 0) for q in quiz_scores[-3:]) / 3
            old_avg = sum(q.get("score", 0) for q in quiz_scores[:3]) / 3
            if recent_avg < old_avg * 0.8 and avg_minutes > target_minutes:
                burnout_risk = min(100, burnout_risk + 20)  # Declining scores + high study = burnout

        # Peak hours: top 3 most productive hours
        sorted_hours = sorted(hour_distribution.items(), key=lambda x: x[1], reverse=True)
        peak_hours = [f"{h:02d}:00" for h, _ in sorted_hours[:3]]

        return {
            "productivity_score": round(productivity, 1),
            "burnout_risk": round(burnout_risk, 1),
            "consistency_score": round(consistency, 1),
            "peak_hours": peak_hours,
            "daily_hours": hours_list,
        }

    def _count_consecutive_high_days(self, hours_list: list) -> int:
        """Count the longest streak of high-study days (>6 hours)."""
        max_streak = 0
        current = 0
        for h in hours_list:
            if h > 360:  # >6 hours
                current += 1
                max_streak = max(max_streak, current)
            else:
                current = 0
        return max_streak

    def _merge_results(
        self,
        deterministic: dict,
        ai_analysis: ProductivityAnalysisResponse,
    ) -> ProductivityAnalysisResponse:
        """
        Merge deterministic metrics (higher trust) with AI insights (recommendations).
        Deterministic values override AI-generated metrics for accuracy.
        """
        # Use deterministic metrics (more reliable than LLM-estimated numbers)
        if deterministic["productivity_score"] > 0:
            ai_analysis.productivity_score = deterministic["productivity_score"]
        if deterministic["burnout_risk"] > 0:
            ai_analysis.burnout_risk = deterministic["burnout_risk"]
        if deterministic["consistency_score"] > 0:
            ai_analysis.consistency_score = deterministic["consistency_score"]
        if deterministic["peak_hours"]:
            ai_analysis.peak_hours = deterministic["peak_hours"]

        return ai_analysis
