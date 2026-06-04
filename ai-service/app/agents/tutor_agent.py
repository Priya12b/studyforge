"""
AI Tutor Agent
Conversational academic tutor with memory, personalization,
and optional RAG integration for document-grounded answers.
"""

from typing import Any, Dict

from langchain_core.messages import HumanMessage, AIMessage

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import (
    AI_TUTOR_PROMPT,
    QUIZ_GENERATOR_PROMPT,
    FLASHCARD_GENERATOR_PROMPT,
    SUMMARIZE_PROMPT,
)
from app.schemas.ai_schemas import (
    ChatResponse,
    QuizResponse,
    FlashcardResponse,
)
from app.memory.manager import memory_manager
from app.rag.retriever import rag_retriever
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("tutor_agent")


class TutorAgent(BaseAgent):
    """
    Multi-capability academic tutor that can:
    - Answer questions conversationally
    - Generate quizzes on any topic
    - Create flashcards for revision
    - Summarize content
    - Optionally use RAG for document-grounded answers

    Maintains conversation memory for contextual tutoring.
    """

    agent_name = "tutor"
    task_type = TaskType.CHAT

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Handle a conversational tutoring request."""
        trace.agent_name = self.agent_name

        user_id = input_data.get("user_id", "")
        message = input_data.get("message", "")
        session_id = input_data.get("session_id")
        subject_context = input_data.get("subject_context", "")
        use_rag = input_data.get("use_rag", False)
        document_ids = input_data.get("document_ids", [])

        # Get or create session
        session_id, history = memory_manager.get_or_create_session(session_id, user_id)
        chat_history = history.messages[-10:]  # Last 5 exchanges

        # Get user profile for personalization
        profile = memory_manager.get_user_profile(user_id)
        profile.record_interaction()

        # Build context
        context_parts = []
        if subject_context:
            context_parts.append(f"Current subject: {subject_context}")
        context_parts.append(profile.to_context_string())

        # If RAG is requested, retrieve document context
        rag_sources = []
        if use_rag and document_ids:
            retrieval = await rag_retriever.retrieve(user_id, message, document_ids)
            if retrieval["has_relevant_context"]:
                context_parts.append(f"\nRelevant notes:\n{retrieval['context']}")
                rag_sources = retrieval["sources"]

        context = "\n".join(context_parts)

        # Build and invoke chain
        llm = self.get_llm(trace, temperature=0.5)  # Slightly creative for tutoring
        chain = AI_TUTOR_PROMPT | llm

        input_vars = {
            "context": context,
            "chat_history": chat_history,
            "message": message,
        }

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)

        # Update memory
        memory_manager.add_message(session_id, HumanMessage(content=message))
        memory_manager.add_message(session_id, AIMessage(content=raw_output))

        trace.finish(success=True)

        return {
            "response": raw_output,
            "session_id": session_id,
            "sources": rag_sources,
            "suggested_followups": self._generate_followups(message, subject_context),
            "confidence": 0.85,
        }

    async def generate_quiz(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Generate a quiz on a given subject/topic."""
        trace.agent_name = f"{self.agent_name}_quiz"
        
        logger.info(
            "quiz_generation_started",
            subject=input_data.get("subject"),
            topic=input_data.get("topic"),
            num_questions=input_data.get("num_questions", 5),
            difficulty=input_data.get("difficulty", "mixed"),
        )

        try:
            llm = self.get_llm(trace, temperature=0.4, task_type_override=TaskType.QUIZ_GENERATION)
            chain = QUIZ_GENERATOR_PROMPT | llm

            # Optional: get RAG context for document-based quizzes
            context = ""
            if input_data.get("use_notes") and input_data.get("document_ids"):
                retrieval = await rag_retriever.retrieve(
                    input_data["user_id"],
                    f"Key concepts in {input_data.get('topic', input_data.get('subject', ''))}",
                    input_data.get("document_ids", []),
                )
                if retrieval["has_relevant_context"]:
                    context = retrieval["context"]

            input_vars = {
                "subject": input_data.get("subject", "General"),
                "topic": input_data.get("topic", "Various topics"),
                "num_questions": input_data.get("num_questions", 5),
                "difficulty": input_data.get("difficulty", "mixed"),
                "context": context or "Generate from general knowledge of the subject.",
            }

            raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)
            quiz = self.parse_json_output(raw_output, QuizResponse, trace)

            trace.finish(success=True)

            logger.info(
                "quiz_generated",
                subject=input_data.get("subject"),
                questions=quiz.total_questions,
            )

            return quiz.model_dump()
        except Exception as e:
            logger.error(
                "quiz_generation_failed",
                subject=input_data.get("subject"),
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    async def generate_flashcards(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Generate flashcards for revision."""
        trace.agent_name = f"{self.agent_name}_flashcards"

        llm = self.get_llm(trace, temperature=0.4)
        chain = FLASHCARD_GENERATOR_PROMPT | llm

        # Optional RAG context
        context = ""
        if input_data.get("document_ids"):
            retrieval = await rag_retriever.retrieve(
                input_data["user_id"],
                f"Important concepts in {input_data.get('topic', input_data.get('subject', ''))}",
                input_data.get("document_ids", []),
            )
            if retrieval["has_relevant_context"]:
                context = retrieval["context"]

        input_vars = {
            "subject": input_data.get("subject", "General"),
            "topic": input_data.get("topic", "Various"),
            "num_cards": input_data.get("num_cards", 10),
            "context": context or "Generate from general knowledge.",
        }

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)
        cards = self.parse_json_output(raw_output, FlashcardResponse, trace)

        trace.finish(success=True)

        return cards.model_dump()

    async def summarize(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """Summarize provided content or retrieved document content."""
        trace.agent_name = f"{self.agent_name}_summarize"

        content = input_data.get("content", "")

        # If no direct content, try RAG retrieval
        if not content and input_data.get("document_ids"):
            retrieval = await rag_retriever.retrieve(
                input_data["user_id"],
                "Complete summary of the document content",
                input_data.get("document_ids", []),
                top_k=10,
            )
            if retrieval["has_relevant_context"]:
                content = retrieval["context"]

        if not content:
            return {"summary": "No content provided to summarize.", "confidence": 0}

        llm = self.get_llm(trace, temperature=0.2)
        chain = SUMMARIZE_PROMPT | llm

        raw_output = await self.invoke_llm_with_retry(
            chain, {"content": content[:8000]}, trace
        )

        trace.finish(success=True)

        return {
            "summary": raw_output,
            "original_length": len(content),
            "summary_length": len(raw_output),
            "compression_ratio": round(len(raw_output) / max(len(content), 1), 2),
        }

    def get_llm(self, trace: AgentTrace, task_type_override: TaskType = None, **kwargs):
        """Override to allow task type overrides for sub-capabilities."""
        task = task_type_override or self.task_type
        pref_provider = kwargs.pop("preferred_provider", None) or trace.metadata.get("preferred_provider")
        model = kwargs.pop("model", None) or trace.metadata.get("preferred_model")
        return self.router.get_model(
            task_type=task,
            trace=trace,
            preferred_provider=pref_provider,
            model=model,
            **kwargs,
        )

    def _generate_followups(self, message: str, subject: str) -> list:
        """Generate suggested follow-up questions (deterministic, no LLM needed)."""
        followups = []
        if subject:
            followups.append(f"Can you explain another concept in {subject}?")
            followups.append(f"Give me a practice problem for {subject}")
        followups.append("Can you explain that in simpler terms?")
        followups.append("Generate a quiz on this topic")
        return followups[:3]
