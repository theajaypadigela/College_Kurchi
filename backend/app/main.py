"""College Kurchi API — FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import close_client, ensure_indexes, ping
from .logging_config import configure_logging, get_logger
from .rag.index import build_index, get_index
from .rag.llm import get_llm
from .routers import (
    auth,
    colleges,
    comparison,
    counselor,
    meta,
    predictor,
    recommendations,
)

configure_logging()
logger = get_logger("main")

API_PREFIX = "/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if ping():
        try:
            ensure_indexes()
            idx = build_index()
            logger.info(
                "startup: index ready — %d colleges, %d chunk vectors (%s)",
                len(idx.colleges), idx.vector_store.size,
                idx.embedder.backend if idx.embedder else "?",
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("startup: index build failed: %s", exc)
    else:
        logger.warning(
            "startup: MongoDB not reachable at %s. Start mongod and run `python -m app.seed`.",
            settings.mongodb_uri,
        )
    yield
    close_client()


app = FastAPI(title="College Kurchi API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, meta, colleges, recommendations, predictor, comparison, counselor):
    app.include_router(module.router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health")
def health() -> dict:
    """Detailed status — liveness plus dependency state for dashboards."""
    idx = get_index()
    return {
        "status": "ok",
        "environment": settings.environment,
        "mongo": ping(),
        "llm": get_llm().available,
        "llmModel": settings.groq_model,
        "indexReady": idx.ready,
        "vectorCount": idx.vector_store.size,
        "embeddingBackend": idx.embedder.backend if idx.embedder else None,
        "year": idx.meta.get("year"),
        "collegeCount": len(idx.colleges),
    }


@app.get(f"{API_PREFIX}/readiness")
def readiness(response: Response) -> dict:
    """Readiness probe: 200 only when MongoDB is reachable and the index is built;
    503 otherwise. Suitable for a Kubernetes readinessProbe / load-balancer check."""
    mongo_ok = ping()
    index_ok = get_index().ready
    ready = mongo_ok and index_ok
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"ready": ready, "mongo": mongo_ok, "indexReady": index_ok}


@app.get("/")
def root() -> dict:
    return {"name": "College Kurchi API", "docs": "/docs", "health": f"{API_PREFIX}/health"}
