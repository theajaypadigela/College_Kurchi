"""Application settings, loaded from environment / .env."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("college_kurchi.config")

# Default dev secret. Refused in production by the validator below so it can never
# silently sign tokens in a real deployment.
_DEV_JWT_SECRET = "college-kurchi-dev-secret-change-in-prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Deployment environment — drives prod-only safety checks.
    environment: str = "development"  # development | staging | production
    log_level: str = "INFO"

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    db_name: str = "college_kurchi"
    mongo_max_pool_size: int = 50
    mongo_timeout_ms: int = 5000

    # Auth / JWT
    jwt_secret: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Groq LLM
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    llm_temperature: float = 0.3
    llm_max_tokens: int = 900
    llm_timeout_s: float = 30.0
    llm_max_retries: int = 2

    # Embeddings
    embedding_backend: str = "hashing"  # "hashing" | "st"
    embedding_dim: int = 512
    st_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Chunking (RAG pre-processing) — see app/rag/chunking.py
    chunk_max_words: int = 60
    chunk_overlap_words: int = 15

    # CORS — comma-separated origins
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000"

    # Seed data location (relative to the backend working dir)
    data_dir: str = "../data"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")

    @model_validator(mode="after")
    def _guard_production(self) -> "Settings":
        """Refuse to boot a production deployment with insecure defaults."""
        if self.is_production:
            if self.jwt_secret == _DEV_JWT_SECRET:
                raise ValueError(
                    "JWT_SECRET must be set to a strong value in production "
                    "(the built-in dev secret is not allowed)."
                )
            if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origin_list):
                logger.warning("CORS_ORIGINS contains localhost while ENVIRONMENT=production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
