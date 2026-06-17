"""In-memory snapshot of the college corpus used by the RAG pipeline.

Built once at startup from MongoDB: holds all college docs, a code lookup, the
vector store (loaded from persisted embeddings), the query-time embedder (chosen
to match the backend the data was seeded with), and small lookups used by the
query parser (districts, branch codes, distinctive name tokens).
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple

import numpy as np

from ..config import settings
from ..db import COLLEGES, META, META_ID, get_db
from .embeddings import Embedder, get_embedder
from .vector_store import VectorStore

_NAME_STOP = {
    "the", "and", "for", "with", "college", "engineering", "institute", "institution",
    "technology", "technologies", "science", "sciences", "autonomous", "of", "an",
    "research", "studies", "management", "group", "school",
}
_WORD_RE = re.compile(r"[a-z0-9]+")


def distinctive_tokens(name: str) -> Set[str]:
    return {w for w in _WORD_RE.findall(name.lower()) if len(w) >= 5 and w not in _NAME_STOP}


class RagIndex:
    def __init__(self) -> None:
        self.colleges: List[dict] = []
        self.by_code: Dict[str, dict] = {}
        self.vector_store = VectorStore()
        self.embedder: Optional[Embedder] = None
        self.meta: dict = {}
        self.districts: List[str] = []
        self.branch_codes: Set[str] = set()
        self.name_tokens: List[Tuple[str, Set[str]]] = []

    def build(self) -> None:
        db = get_db()
        self.meta = db[META].find_one({"_id": META_ID}) or {}
        backend = self.meta.get("embeddingBackend", settings.embedding_backend)
        dim = int(self.meta.get("embeddingDim", settings.embedding_dim))
        self.embedder = get_embedder(backend, dim, settings.st_model)

        docs = list(db[COLLEGES].find({}))
        self.colleges = docs
        self.by_code = {d["code"]: d for d in docs}

        codes: List[str] = []
        vecs: List[list] = []
        for d in docs:
            emb = d.get("embedding")
            if emb:
                codes.append(d["code"])
                vecs.append(emb)
        matrix = np.asarray(vecs, dtype=np.float32) if vecs else np.zeros((0, dim), dtype=np.float32)
        self.vector_store.build(codes, matrix)

        self.districts = list(self.meta.get("districts", []))
        self.branch_codes = {b["code"] for b in self.meta.get("branches", [])}
        self.name_tokens = [(d["code"], distinctive_tokens(d.get("name", ""))) for d in docs]

    @property
    def ready(self) -> bool:
        return bool(self.colleges)

    @property
    def year(self) -> int:
        return int(self.meta.get("year", 2025))


_index: Optional[RagIndex] = None


def get_index() -> RagIndex:
    global _index
    if _index is None:
        _index = RagIndex()
    return _index


def build_index() -> RagIndex:
    idx = get_index()
    idx.build()
    return idx
