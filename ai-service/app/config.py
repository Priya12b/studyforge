"""
StudyForge AI Service — Central Configuration
Settings are loaded from environment variables for security.
Locally: create a .env file (see .env.example) and run with python-dotenv.
Production: set environment variables in your hosting dashboard (e.g., Render).
"""

import os
from typing import Optional
from enum import Enum

# Load .env file FIRST before any os.getenv() calls below.
# This ensures the .env file is read whether running locally or via uvicorn.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — rely on system env vars (production)


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class ModelProvider(str, Enum):
    OLLAMA = "ollama"
    GEMINI = "gemini"
    OPENAI = "openai"


class Settings:
    """Application-wide settings — all values hardcoded directly."""

    # --- Server ---
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    environment: Environment = Environment.DEVELOPMENT

    # --- LLM Providers ---
    # Gemini (Get free key: https://aistudio.google.com/apikey)
    # Set GEMINI_API_KEY environment variable — never hardcode your key here!
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")

    # OpenAI (Optional - paid: https://platform.openai.com/api-keys)
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")

    # Ollama (Local - just run 'ollama serve' and pull models)
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_default_model: str = os.getenv("OLLAMA_DEFAULT_MODEL", "llama3.1:8b")

    # --- Model Routing ---
    # DEFAULT_PROVIDER: set to 'gemini' in production, 'ollama' locally
    default_provider: ModelProvider = ModelProvider(os.getenv("DEFAULT_PROVIDER", "ollama"))
    fallback_provider: ModelProvider = ModelProvider(os.getenv("FALLBACK_PROVIDER", "gemini"))
    complex_reasoning_provider: ModelProvider = ModelProvider(os.getenv("COMPLEX_REASONING_PROVIDER", "gemini"))
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

    # --- Vector Database ---
    chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
    chroma_collection_prefix: str = os.getenv("CHROMA_COLLECTION_PREFIX", "studyforge_")

    # --- Memory ---
    redis_url: Optional[str] = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    memory_backend: str = os.getenv("MEMORY_BACKEND", "local")  # "local" (in-memory) or "redis"

    # --- Rate Limits & Timeouts ---
    max_tokens_per_request: int = int(os.getenv("MAX_TOKENS_PER_REQUEST", "4096"))
    model_timeout_seconds: int = int(os.getenv("MODEL_TIMEOUT_SECONDS", "60"))
    max_retries: int = int(os.getenv("MAX_RETRIES", "3"))

    # --- RAG Configuration ---
    chunk_size: int = 1000
    chunk_overlap: int = 200
    retrieval_top_k: int = 5
    min_relevance_score: float = 0.3

    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT

    @property
    def has_gemini(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)


# Singleton settings instance
settings = Settings()
