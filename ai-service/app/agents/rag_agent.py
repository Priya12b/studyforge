"""
RAG Knowledge Agent
Processes uploaded documents and answers questions using ONLY
the content from the student's uploaded notes via RAG retrieval.
"""

from typing import Any, Dict

from langchain_core.messages import HumanMessage, AIMessage

from app.agents.base_agent import BaseAgent
from app.models.router import TaskType
from app.prompts.templates import AI_TUTOR_WITH_RAG_PROMPT
from app.rag.document_processor import document_processor
from app.rag.vector_store import vector_store
from app.rag.retriever import rag_retriever
from app.memory.manager import memory_manager
from app.utils.observability import AgentTrace
from app.utils.logging import get_logger

logger = get_logger("rag_agent")


class RAGKnowledgeAgent(BaseAgent):
    """
    Document-grounded Q&A agent.

    Pipeline:
    1. User uploads PDF/notes → process → chunk → embed → store in ChromaDB
    2. User asks question → retrieve relevant chunks → generate answer
    3. Answer is grounded ONLY in retrieved content
    4. Sources are cited for transparency
    """

    agent_name = "rag_knowledge"
    task_type = TaskType.RAG_RESPONSE

    async def process_document(
        self,
        file_path: str,
        document_id: str,
        user_id: str,
        title: str = "",
        subject: str = "",
    ) -> Dict[str, Any]:
        """
        Process an uploaded document into the RAG pipeline.

        Steps:
        1. Parse document (PDF/text/image)
        2. Chunk into segments
        3. Generate embeddings
        4. Store in ChromaDB
        """
        # Process the file
        processed = await document_processor.process_file(
            file_path=file_path,
            document_id=document_id,
            title=title,
            subject=subject,
            user_id=user_id,
        )

        # Store chunks in vector DB
        chunks_stored = await vector_store.add_documents(
            user_id=user_id,
            documents=processed.chunks,
            document_id=document_id,
        )

        logger.info(
            "document_ingested",
            document_id=document_id,
            user_id=user_id,
            pages=processed.total_pages,
            chunks=chunks_stored,
        )

        return {
            "document_id": document_id,
            "title": processed.title,
            "pages": processed.total_pages,
            "chunks_stored": chunks_stored,
            "file_type": processed.file_type,
            "text_preview": processed.extracted_text[:500],
        }

    async def execute(self, input_data: Dict[str, Any], trace: AgentTrace) -> Dict[str, Any]:
        """
        Answer a question using RAG retrieval from uploaded documents.
        """
        trace.agent_name = self.agent_name

        user_id = input_data.get("user_id", "")
        query = input_data.get("query", "")
        document_ids = input_data.get("document_ids", [])
        session_id = input_data.get("session_id")

        # Step 1: Retrieve relevant context
        retrieval_result = await rag_retriever.retrieve(
            user_id=user_id,
            query=query,
            document_ids=document_ids if document_ids else None,
        )

        if not retrieval_result["has_relevant_context"]:
            trace.finish(success=True)
            return {
                "answer": "I couldn't find relevant information in your uploaded documents for this question. "
                          "Please make sure you've uploaded the relevant notes or try rephrasing your question.",
                "sources": [],
                "confidence": 0.1,
                "source_count": 0,
            }

        # Step 2: Build the LLM chain with RAG context
        llm = self.get_llm(trace, temperature=0.2)

        # Get conversation history for context
        session_id, history = memory_manager.get_or_create_session(session_id, user_id)
        chat_history = history.messages[-6:]  # Last 3 exchanges

        # Step 3: Generate answer grounded in retrieved context
        chain = AI_TUTOR_WITH_RAG_PROMPT | llm

        input_vars = {
            "context": retrieval_result["context"],
            "chat_history": chat_history,
            "message": query,
        }

        raw_output = await self.invoke_llm_with_retry(chain, input_vars, trace)

        # Step 4: Update conversation memory
        memory_manager.add_message(session_id, HumanMessage(content=query))
        memory_manager.add_message(session_id, AIMessage(content=raw_output))

        trace.finish(success=True)

        logger.info(
            "rag_query_answered",
            user_id=user_id,
            sources_used=retrieval_result["total_chunks"],
        )

        return {
            "answer": raw_output,
            "sources": retrieval_result["sources"],
            "confidence": 0.85 if retrieval_result["total_chunks"] >= 2 else 0.6,
            "source_count": retrieval_result["total_chunks"],
            "session_id": session_id,
        }

    async def delete_document(self, user_id: str, document_id: str) -> bool:
        """Remove a document from the RAG pipeline."""
        return await vector_store.delete_document(user_id, document_id)
