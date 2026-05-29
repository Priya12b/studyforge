"""
RAG Retriever
Combines vector search with context formatting for LLM consumption.
Implements retrieval validation and context compression.
"""

from typing import List, Optional, Dict, Any

from app.rag.vector_store import vector_store
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("retriever")


class RAGRetriever:
    """
    High-level retrieval interface for RAG queries.

    Performs:
    1. Vector similarity search
    2. Relevance filtering
    3. Context assembly with source tracking
    4. Context compression for token efficiency
    """

    def __init__(self):
        self.max_context_chars = 6000  # Prevent context overflow
        self.min_chunks_required = 1   # Minimum chunks to form an answer

    async def retrieve(
        self,
        user_id: str,
        query: str,
        document_ids: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Retrieve relevant context from the user's documents.

        Returns:
            {
                "context": formatted context string for LLM,
                "sources": list of source metadata,
                "has_relevant_context": bool,
                "total_chunks": int
            }
        """
        results = await vector_store.query(
            user_id=user_id,
            query=query,
            top_k=top_k,
            document_ids=document_ids,
            min_score=settings.min_relevance_score,
        )

        if len(results) < self.min_chunks_required:
            logger.info("insufficient_context", user_id=user_id, results=len(results))
            return {
                "context": "",
                "sources": [],
                "has_relevant_context": False,
                "total_chunks": 0,
            }

        # Build context string with source citations
        context_parts = []
        sources = []
        total_chars = 0

        for i, result in enumerate(results):
            chunk_text = result["content"]

            # Prevent context overflow
            if total_chars + len(chunk_text) > self.max_context_chars:
                break

            source_label = f"[Source {i+1}]"
            doc_title = result["metadata"].get("title", "Unknown")
            page = result["metadata"].get("page", "N/A")

            context_parts.append(
                f"{source_label} (From: {doc_title}, Page: {page})\n{chunk_text}"
            )

            sources.append({
                "index": i + 1,
                "title": doc_title,
                "page": page,
                "relevance_score": result["relevance_score"],
                "document_id": result["metadata"].get("document_id", ""),
                "preview": chunk_text[:200],
            })

            total_chars += len(chunk_text)

        context = "\n\n---\n\n".join(context_parts)

        logger.info(
            "context_retrieved",
            user_id=user_id,
            chunks_used=len(context_parts),
            context_chars=total_chars,
        )

        return {
            "context": context,
            "sources": sources,
            "has_relevant_context": True,
            "total_chunks": len(context_parts),
        }


# Singleton retriever
rag_retriever = RAGRetriever()
