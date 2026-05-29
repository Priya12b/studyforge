"""
Embedding Manager
Manages the sentence-transformers embedding model for vector generation.
Uses HuggingFace's all-MiniLM-L6-v2 for local, zero-cost embeddings.
"""

from typing import List
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("embeddings")

# Global embedding model instance (loaded once, reused everywhere)
_embedding_model = None


def get_embedding_model() -> HuggingFaceEmbeddings:
    """
    Get or initialize the embedding model.
    Uses lazy loading to avoid slowing down startup.
    """
    global _embedding_model

    if _embedding_model is None:
        logger.info("loading_embedding_model", model=settings.embedding_model)
        _embedding_model = HuggingFaceEmbeddings(
            model_name=settings.embedding_model,
            model_kwargs={"device": "cpu"},
            encode_kwargs={
                "normalize_embeddings": True,
                "batch_size": 32,
            },
        )
        logger.info("embedding_model_loaded")

    return _embedding_model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts."""
    model = get_embedding_model()
    return model.embed_documents(texts)


def embed_query(query: str) -> List[float]:
    """Generate embedding for a single query string."""
    model = get_embedding_model()
    return model.embed_query(query)
