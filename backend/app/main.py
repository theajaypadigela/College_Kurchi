"""College Kurchi API — FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import ensure_indexes, ping
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

API_PREFIX = "/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if ping():
        try:
            ensure_indexes()
            idx = build_index()
            print(f"[startup] index ready: {len(idx.colleges)} colleges, "
                  f"{idx.vector_store.size} vectors ({idx.embedder.backend if idx.embedder else '?'}).")
        except Exception as exc:  # noqa: BLE001
            print(f"[startup] index build failed: {exc}")
    else:
        print(f"[startup] WARNING: MongoDB not reachable at {settings.mongodb_uri}. "
              f"Start mongod and run `python -m app.seed`.")
    yield


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
    idx = get_index()
    return {
        "status": "ok",
        "mongo": ping(),
        "llm": get_llm().available,
        "llmModel": settings.groq_model,
        "indexReady": idx.ready,
        "vectorCount": idx.vector_store.size,
        "embeddingBackend": idx.embedder.backend if idx.embedder else None,
        "year": idx.meta.get("year"),
        "collegeCount": len(idx.colleges),
    }


@app.get("/")
def root() -> dict:
    return {"name": "College Kurchi API", "docs": "/docs", "health": f"{API_PREFIX}/health"}
