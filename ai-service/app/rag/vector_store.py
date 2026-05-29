"""
Vector Store Manager
Manages ChromaDB collections for per-user document storage.
Handles storing, querying, and managing document embeddings.
"""

from typing import List, Optional, Dict, Any
from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.rag.embeddings import get_embedding_model
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("vector_store")


class VectorStoreManager:
    """
    Manages ChromaDB vector collections.

    Each user gets their own namespace to isolate documents.
    Supports per-document querying, full-user querying, and deletion.
    """

    def __init__(self):
        self.persist_dir = settings.chroma_persist_dir
        self.prefix = settings.chroma_collection_prefix
        self._stores: Dict[str, Chroma] = {}

    def _get_collection_name(self, user_id: str) -> str:
        """Generate a namespaced collection name for a user."""
        # ChromaDB collection names must be 3-63 chars, alphanumeric + underscores
        safe_id = user_id.replace("-", "_")[:40]
        return f"{self.prefix}{safe_id}"

    def _get_store(self, user_id: str) -> Chroma:
        """Get or create a ChromaDB collection for a user."""
        collection_name = self._get_collection_name(user_id)

        if collection_name not in self._stores:
            self._stores[collection_name] = Chroma(
                collection_name=collection_name,
                embedding_function=get_embedding_model(),
                persist_directory=self.persist_dir,
            )
            logger.info("vector_store_initialized", collection=collection_name)

        return self._stores[collection_name]

    async def add_documents(
        self,
        user_id: str,
        documents: List[Document],
        document_id: str,
    ) -> int:
        """
        Add document chunks to the user's vector store.

        Args:
            user_id: The document owner
            documents: List of chunked documents with metadata
            document_id: Unique document identifier

        Returns:
            Number of chunks added
        """
        store = self._get_store(user_id)

        # Generate unique IDs for each chunk
        ids = [f"{document_id}_chunk_{i}" for i in range(len(documents))]

        store.add_documents(documents=documents, ids=ids)

        logger.info(
            "documents_added",
            user_id=user_id,
            document_id=document_id,
            chunks_added=len(documents),
        )

        return len(documents)

    async def query(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[str]] = None,
        min_score: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query the user's vector store for relevant document chunks.

        Args:
            user_id: The user whose documents to search
            query: The search query
            top_k: Number of results to return
            document_ids: Optional filter to specific documents
            min_score: Minimum relevance score threshold

        Returns:
            List of results with content, metadata, and relevance scores
        """
        store = self._get_store(user_id)
        min_score = min_score or settings.min_relevance_score

        # Build metadata filter for specific documents
        search_kwargs: Dict[str, Any] = {"k": top_k}

        if document_ids:
            search_kwargs["filter"] = {
                "document_id": {"$in": document_ids}
            }

        results = store.similarity_search_with_relevance_scores(
            query=query,
            **search_kwargs,
        )

        # Filter by minimum score and format results
        formatted = []
        for doc, score in results:
            if score >= min_score:
                formatted.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "relevance_score": round(score, 4),
                })

        logger.info(
            "vector_query_completed",
            user_id=user_id,
            query_length=len(query),
            results_found=len(formatted),
            top_score=formatted[0]["relevance_score"] if formatted else 0,
        )

        return formatted

    async def delete_document(self, user_id: str, document_id: str) -> bool:
        """Delete all chunks for a specific document."""
        store = self._get_store(user_id)

        try:
            # Get all chunk IDs for this document
            collection = store._collection
            results = collection.get(
                where={"document_id": document_id},
            )

            if results and results["ids"]:
                collection.delete(ids=results["ids"])
                logger.info(
                    "document_deleted",
                    user_id=user_id,
                    document_id=document_id,
                    chunks_deleted=len(results["ids"]),
                )
                return True

            return False

        except Exception as e:
            logger.error("delete_failed", error=str(e))
            return False

    async def get_document_count(self, user_id: str) -> int:
        """Get total number of chunks in a user's collection."""
        store = self._get_store(user_id)
        try:
            return store._collection.count()
        except Exception:
            return 0


# Singleton vector store manager
vector_store = VectorStoreManager()
