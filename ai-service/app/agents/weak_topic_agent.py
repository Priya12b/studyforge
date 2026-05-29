"""
Weak Topic Analyzer Agent
Analyzes student performance data to identify knowledge gaps
using quiz scores, study consistency, and semantic similarity.
"""

from typing import Any, Dict, List

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import WEAK_TOPIC_ANALYZER_PROMPT
from app.schemas.ai_schemas import WeakTopicAnalysisResponse
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("weak_topic_agent")


class WeakTopicAnalyzerAgent(BaseAgent):
    """
    Identifies weak topics through multi-signal analysis:
    1. Quiz score analysis (topics with <60% scores)
    2. Study consistency tracking (topics not reviewed in 7+ days)
    3. Skip detection (topics the student avoids)
    4. Confidence-performance gap analysis
    """

    agent_name = "weak_topic_analyzer"
    task_type = TaskType.WEAK_ANALYSIS

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Analyze student performance and identify weak topics."""
        trace.agent_name = self.agent_name

        # First, do deterministic pre-analysis
        pre_analysis = self._pre_analyze(input_data)

        llm = self.get_llm(trace, temperature=0.2)
        chain = WEAK_TOPIC_ANALYZER_PROMPT | llm

        input_vars = {
            "quiz_scores": str(input_data.get("quiz_scores", [])[:20]),
            "study_history": str(input_data.get("study_history", [])[:20]),
            "subjects": self._format_subjects(input_data.get("subjects", [])),
            "skipped_topics": ", ".join(input_data.get("skipped_topics", [])),
        }

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)
        analysis = self.parse_json_output(raw_output, WeakTopicAnalysisResponse, trace)

        # Merge deterministic pre-analysis with AI analysis
        analysis = self._merge_analysis(analysis, pre_analysis)

        trace.finish(success=True)

        logger.info(
            "weak_analysis_completed",
            weak_topics_found=len(analysis.weak_topics),
            priority_improvements=len(analysis.priority_improvements),
        )

        return analysis.model_dump()

    def _pre_analyze(self, input_data: dict) -> dict:
        """
        Deterministic pre-analysis of quiz scores and study patterns.
        This runs WITHOUT the LLM for reliable, fast insights.
        """
        weak_from_quizzes = []
        quiz_scores = input_data.get("quiz_scores", [])

        for quiz in quiz_scores:
            score = quiz.get("score", 0)
            total = quiz.get("total", 100)
            percentage = (score / total * 100) if total > 0 else 0

            if percentage < 60:
                weak_from_quizzes.append({
                    "subject": quiz.get("subject", ""),
                    "topic": quiz.get("topic", ""),
                    "score_percentage": percentage,
                })

        return {
            "weak_from_quizzes": weak_from_quizzes,
            "total_quizzes_analyzed": len(quiz_scores),
        }

    def _format_subjects(self, subjects: list) -> str:
        """Format subjects for the prompt."""
        if not subjects:
            return "No subject data available"

        lines = []
        for s in subjects:
            name = s.get("name", "Unknown")
            confidence = s.get("confidence_level", 50)
            topics = s.get("syllabus_topics", [])
            lines.append(
                f"- {name} (Confidence: {confidence}%, "
                f"Topics: {', '.join(topics[:5]) if topics else 'Not specified'})"
            )
        return "\n".join(lines)

    def _merge_analysis(
        self,
        ai_analysis: WeakTopicAnalysisResponse,
        pre_analysis: dict,
    ) -> WeakTopicAnalysisResponse:
        """
        Merge deterministic pre-analysis with AI analysis.
        Ensures quiz-score-detected weaknesses are always included.
        """
        existing_keys = {
            (t.subject, t.topic) for t in ai_analysis.weak_topics
        }

        for weak in pre_analysis.get("weak_from_quizzes", []):
            key = (weak["subject"], weak["topic"])
            if key not in existing_keys:
                from app.schemas.ai_schemas import TopicWeakness
                ai_analysis.weak_topics.append(TopicWeakness(
                    subject=weak["subject"],
                    topic=weak["topic"],
                    weakness_score=max(0.6, 1.0 - weak["score_percentage"] / 100),
                    confidence=0.95,  # High confidence from actual quiz data
                    evidence=[f"Quiz score: {weak['score_percentage']:.0f}%"],
                    recommendation=f"Focus on reviewing {weak['topic']} with practice problems",
                ))

        # Sort by weakness score (most weak first)
        ai_analysis.weak_topics.sort(key=lambda t: t.weakness_score, reverse=True)

        return ai_analysis
