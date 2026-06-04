"""
Master Orchestrator
The central coordination engine that:
1. Receives user requests
2. Classifies intent
3. Routes to appropriate agent(s)
4. Coordinates multi-agent workflows
5. Validates outputs
6. Assembles final responses

This is the ONLY entry point for all AI operations.
"""

import json
import time
import traceback
from typing import Any, Dict, Optional

from langchain_core.messages import AIMessage

from app.agents.planner_agent import PlannerAgent
from app.agents.revision_agent import RevisionAgent
from app.agents.weak_topic_agent import WeakTopicAnalyzerAgent
from app.agents.tutor_agent import TutorAgent
from app.agents.rag_agent import RAGKnowledgeAgent
from app.agents.productivity_agent import ProductivityAgent
from app.agents.validation_agent import ValidationAgent
from app.models.router import ModelRouter, TaskType, router as model_router
from app.prompts.templates import INTENT_CLASSIFIER_PROMPT
from app.schemas.ai_schemas import IntentType, IntentClassification
from app.memory.manager import memory_manager
from app.utils.observability import AgentTrace, PipelineTrace
from app.utils.logging import get_logger

logger = get_logger("orchestrator")


class MasterOrchestrator:
    """
    Central AI orchestration engine.

    Workflow:
    1. Intent Classification → Determine what the user wants
    2. Agent Routing → Select and invoke the right agent(s)
    3. Multi-Agent Coordination → For complex tasks, chain multiple agents
    4. Validation → Check output quality
    5. Response Assembly → Format and return

    Multi-agent workflows:
    - Study Plan: PlannerAgent → WeakTopicAgent → RevisionAgent → ValidationAgent
    - Performance: ProductivityAgent → WeakTopicAgent → Recommendations
    - Document Q&A: RAGAgent → TutorAgent (if clarification needed)
    """

    def __init__(self):
        self.router = model_router

        # Initialize all agents
        self.planner = PlannerAgent(self.router)
        self.revision = RevisionAgent(self.router)
        self.weak_analyzer = WeakTopicAnalyzerAgent(self.router)
        self.tutor = TutorAgent(self.router)
        self.rag = RAGKnowledgeAgent(self.router)
        self.productivity = ProductivityAgent(self.router)
        self.validator = ValidationAgent(self.router)

    async def initialize(self) -> None:
        """Initialize the model router and verify provider health."""
        await self.router.initialize()
        logger.info("orchestrator_initialized", providers=self.router.available_providers)

    def _create_trace(self, agent_name: str, data: dict) -> AgentTrace:
        trace = AgentTrace(agent_name=agent_name)
        if isinstance(data, dict):
            if "model" in data and data["model"]:
                trace.metadata["preferred_model"] = data["model"]
                print(f"[ORCHESTRATOR._create_trace] Set preferred_model: {data['model']}")
            if "provider" in data and data["provider"]:
                trace.metadata["preferred_provider"] = data["provider"]
                print(f"[ORCHESTRATOR._create_trace] Set preferred_provider: {data['provider']}")
        print(f"[ORCHESTRATOR._create_trace] Agent: {agent_name}, metadata: {trace.metadata}")
        return trace

    # ================================================================
    # Primary Entry Point
    # ================================================================

    async def process_request(
        self,
        request_type: str,
        data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process any AI request through the orchestration pipeline.

        Args:
            request_type: The type of request (matches IntentType values,
                          or explicit API route names like "generate_plan")
            data: Request-specific input data
            user_id: The requesting user's ID

        Returns:
            Structured response from the appropriate agent(s)
        """
        pipeline = PipelineTrace(request_type=request_type)

        try:
            logger.info(
                "processing_request",
                request_type=request_type,
                user_id=user_id,
            )

            # Route to the appropriate handler
            result = await self._route_request(request_type, data, user_id, pipeline)

            pipeline.finish()
            pipeline.log_summary()

            return {
                "success": True,
                "data": result,
                "trace": {
                    "pipeline_id": pipeline.pipeline_id,
                    "latency_ms": pipeline.total_latency_ms,
                    "agents_used": len(pipeline.agent_traces),
                },
            }

        except Exception as e:
            pipeline.finish()
            error_str = str(e)
            
            # Log with full context for debugging
            logger.error(
                "request_failed",
                request_type=request_type,
                error=error_str,
                pipeline_id=pipeline.pipeline_id,
                error_type=type(e).__name__,
                exc_info=True,
            )

            # Return error with context - don't hide the actual error!
            return {
                "success": False,
                "error": error_str,  # Pass actual error so backend can log it
                "request_type": request_type,  # Helps identify what failed
                "trace": {
                    "pipeline_id": pipeline.pipeline_id,
                    "latency_ms": pipeline.total_latency_ms,
                },
            }

    # ================================================================
    # Intent Classification
    # ================================================================

    async def classify_intent(self, message: str, pipeline: PipelineTrace) -> IntentClassification:
        """
        Classify the user's intent from a natural language message.
        Used for the chat endpoint when the intent isn't explicit.
        """
        trace = self._create_trace("intent_classifier", {})
        pipeline.add_trace(trace)

        try:
            llm = self.router.get_model(
                task_type=TaskType.INTENT_CLASSIFICATION,
                trace=trace,
                temperature=0,
            )

            chain = INTENT_CLASSIFIER_PROMPT | llm
            raw_output = await chain.ainvoke({"message": message})

            content = raw_output.content if isinstance(raw_output, AIMessage) else str(raw_output)
            cleaned = self._clean_json(content)
            data = json.loads(cleaned)

            classification = IntentClassification.model_validate(data)

            trace.finish(success=True)

            logger.info(
                "intent_classified",
                intent=classification.intent,
                confidence=classification.confidence,
            )

            return classification

        except Exception as e:
            trace.finish(success=False, error=str(e))
            logger.warning("intent_classification_failed", error=str(e))
            # Default to general chat on classification failure
            return IntentClassification(
                intent=IntentType.CHAT,
                confidence=0.5,
            )

    # ================================================================
    # Request Routing
    # ================================================================

    async def _route_request(
        self,
        request_type: str,
        data: Dict[str, Any],
        user_id: Optional[str],
        pipeline: PipelineTrace,
    ) -> Dict[str, Any]:
        """Route a request to the appropriate agent workflow."""

        if user_id:
            data["user_id"] = user_id

        handlers = {
            "generate_plan": self._handle_generate_plan,
            "chat": self._handle_chat,
            "generate_quiz": self._handle_generate_quiz,
            "generate_flashcards": self._handle_generate_flashcards,
            "analyze_performance": self._handle_analyze_performance,
            "document_query": self._handle_document_query,
            "upload_document": self._handle_upload_document,
            "summarize": self._handle_summarize,
            "revision_schedule": self._handle_revision_schedule,
            "weak_analysis": self._handle_weak_analysis,
            "auto": self._handle_auto_route,  # Auto-classify + route
        }

        handler = handlers.get(request_type)
        if not handler:
            raise ValueError(f"Unknown request type: {request_type}")

        return await handler(data, pipeline)

    # ================================================================
    # Handler Implementations
    # ================================================================

    async def _handle_generate_plan(self, data: dict, pipeline: PipelineTrace) -> dict:
        """
        Multi-agent study plan generation workflow:
        1. Analyze weak topics (if data available)
        2. Generate the study plan
        3. Validate the plan
        """
        # Step 1: Get weak topic analysis if quiz data is available
        weak_topics = []
        if data.get("quiz_scores") or data.get("study_history"):
            weak_trace = self._create_trace("weak_analyzer", data)
            pipeline.add_trace(weak_trace)
            try:
                weak_result = await self.weak_analyzer.execute(data, weak_trace)
                weak_topics = [t["topic"] for t in weak_result.get("weak_topics", [])]
                data["weak_subjects"] = list(set(data.get("weak_subjects", []) + weak_topics))
            except Exception as e:
                logger.warning("weak_analysis_in_plan_failed", error=str(e))

        # Step 2: Generate the study plan
        plan_trace = self._create_trace("planner", data)
        pipeline.add_trace(plan_trace)
        plan = await self.planner.execute(data, plan_trace)

        # Step 3: Validate the plan
        val_trace = self._create_trace("validation", data)
        pipeline.add_trace(val_trace)
        validation = await self.validator.execute(
            {"output_type": "study_plan", "content": plan},
            val_trace,
        )

        plan["validation"] = validation

        if not validation.get("valid", True):
            logger.warning(
                "plan_validation_issues",
                issues=validation.get("issues", []),
            )

        return plan

    async def _handle_chat(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Handle a conversational chat message."""
        trace = self._create_trace("tutor", data)
        pipeline.add_trace(trace)
        return await self.tutor.execute(data, trace)

    async def _handle_generate_quiz(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Generate a quiz."""
        trace = self._create_trace("tutor_quiz", data)
        pipeline.add_trace(trace)
        quiz = await self.tutor.generate_quiz(data, trace)

        # Validate quiz
        val_trace = self._create_trace("validation", data)
        pipeline.add_trace(val_trace)
        validation = await self.validator.execute(
            {"output_type": "quiz", "content": quiz},
            val_trace,
        )
        quiz["validation"] = validation

        return quiz

    async def _handle_generate_flashcards(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Generate flashcards."""
        trace = self._create_trace("tutor_flashcards", data)
        pipeline.add_trace(trace)
        return await self.tutor.generate_flashcards(data, trace)

    async def _handle_analyze_performance(self, data: dict, pipeline: PipelineTrace) -> dict:
        """
        Multi-agent performance analysis:
        1. Run productivity analysis
        2. Run weak topic analysis
        3. Generate revision recommendations
        """
        # Step 1: Productivity analysis
        prod_trace = self._create_trace("productivity", data)
        pipeline.add_trace(prod_trace)
        productivity = await self.productivity.execute(data, prod_trace)

        # Step 2: Weak topic analysis
        weak_result = {}
        if data.get("quiz_scores") or data.get("subjects"):
            weak_trace = self._create_trace("weak_analyzer", data)
            pipeline.add_trace(weak_trace)
            try:
                weak_result = await self.weak_analyzer.execute(data, weak_trace)
            except Exception as e:
                logger.warning("weak_analysis_in_perf_failed", error=str(e))

        return {
            "productivity": productivity,
            "weak_topics": weak_result,
        }

    async def _handle_document_query(self, data: dict, pipeline: PipelineTrace) -> dict:
        """RAG-based document query."""
        trace = self._create_trace("rag", data)
        pipeline.add_trace(trace)
        return await self.rag.execute(data, trace)

    async def _handle_upload_document(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Process an uploaded document into the RAG pipeline."""
        return await self.rag.process_document(
            file_path=data.get("file_path", ""),
            document_id=data.get("document_id", ""),
            user_id=data.get("user_id", ""),
            title=data.get("title", ""),
            subject=data.get("subject", ""),
        )

    async def _handle_summarize(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Summarize content."""
        trace = self._create_trace("tutor_summary", data)
        pipeline.add_trace(trace)
        return await self.tutor.summarize(data, trace)

    async def _handle_revision_schedule(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Generate a revision schedule."""
        trace = self._create_trace("revision", data)
        pipeline.add_trace(trace)
        schedule = await self.revision.execute(data, trace)

        # Validate
        val_trace = self._create_trace("validation", data)
        pipeline.add_trace(val_trace)
        validation = await self.validator.execute(
            {"output_type": "revision_schedule", "content": schedule},
            val_trace,
        )
        schedule["validation"] = validation

        return schedule

    async def _handle_weak_analysis(self, data: dict, pipeline: PipelineTrace) -> dict:
        """Run standalone weak topic analysis."""
        trace = self._create_trace("weak_analyzer", data)
        pipeline.add_trace(trace)
        return await self.weak_analyzer.execute(data, trace)

    async def _handle_auto_route(self, data: dict, pipeline: PipelineTrace) -> dict:
        """
        Auto-classify the user's message and route to the appropriate handler.
        Used when the client sends a natural language message without specifying intent.
        """
        message = data.get("message", "")
        if not message:
            return {"response": "Please provide a message.", "confidence": 0}

        # Classify intent
        classification = await self.classify_intent(message, pipeline)

        # Route based on classified intent
        intent_to_handler = {
            IntentType.GENERATE_PLAN: "generate_plan",
            IntentType.CHAT: "chat",
            IntentType.GENERATE_QUIZ: "generate_quiz",
            IntentType.GENERATE_FLASHCARDS: "generate_flashcards",
            IntentType.ANALYZE_PERFORMANCE: "analyze_performance",
            IntentType.DOCUMENT_QUERY: "document_query",
            IntentType.SUMMARIZE: "summarize",
            IntentType.REVISION_SCHEDULE: "revision_schedule",
            IntentType.WEAK_ANALYSIS: "weak_analysis",
            IntentType.GENERAL: "chat",
        }

        handler_name = intent_to_handler.get(classification.intent, "chat")
        handler = {
            "generate_plan": self._handle_generate_plan,
            "chat": self._handle_chat,
            "generate_quiz": self._handle_generate_quiz,
            "generate_flashcards": self._handle_generate_flashcards,
            "analyze_performance": self._handle_analyze_performance,
            "document_query": self._handle_document_query,
            "summarize": self._handle_summarize,
            "revision_schedule": self._handle_revision_schedule,
            "weak_analysis": self._handle_weak_analysis,
        }.get(handler_name, self._handle_chat)

        result = await handler(data, pipeline)
        result["classified_intent"] = classification.intent.value
        result["intent_confidence"] = classification.confidence

        return result

    # ================================================================
    # Utility
    # ================================================================

    def _clean_json(self, text: str) -> str:
        """Clean LLM output to extract JSON."""
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end + 1]

        return text

    @property
    def health_status(self) -> dict:
        """Get the health status of the orchestrator and all providers."""
        return {
            "orchestrator": "healthy",
            "providers": self.router.health_status,
            "active_sessions": memory_manager.get_session_count(),
        }


# Singleton orchestrator
orchestrator = MasterOrchestrator()
