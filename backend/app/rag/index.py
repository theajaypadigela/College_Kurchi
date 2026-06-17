"""In-memory snapshot of the college corpus used by the RAG pipeline.

Built once at startup from MongoDB: holds all college docs, a code lookup, the
vector store (loaded from persisted **chunk** embeddings), the query-time embedder
(chosen to match the backend the data was seeded with), and small lookups used by
the query parser (districts, branch codes, distinctive name tokens).

Chunk-level retrieval: each college's document is split into overlapping chunks at
seed time (see app/rag/chunking.py) and every chunk is embedded separately. The
vector store therefore holds one row per *chunk*, keyed `"{code}#{chunk_index}"`,
and `chunk_owner` maps each chunk id back to its college code so the retriever can
aggregate chunk hits into colleges. Older data seeded without chunks falls back to
the single per-college `embedding` (keyed by the bare code).
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Set, Tuple

import numpy as np

from ..config import settings
from ..db import COLLEGES, META, META_ID, get_db
from ..logging_config import get_logger
from .embeddings import Embedder, get_embedder
from .vector_store import VectorStore

logger = get_logger("rag.index")

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
        self.chunk_owner: Dict[str, str] = {}  # "{code}#{i}" -> college code
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

        chunk_ids: List[str] = []
        vecs: List[list] = []
        self.chunk_owner = {}
        for d in docs:
            code = d["code"]
            chunks = d.get("chunks") or []
            if chunks:
                for ch in chunks:
                    emb = ch.get("embedding")
                    if not emb:
                        continue
                    cid = f"{code}#{ch.get('index', len(chunk_ids))}"
                    chunk_ids.append(cid)
                    vecs.append(emb)
                    self.chunk_owner[cid] = code
            elif d.get("embedding"):  # backward-compat: one vector per college
                chunk_ids.append(code)
                vecs.append(d["embedding"])
                self.chunk_owner[code] = code

        matrix = np.asarray(vecs, dtype=np.float32) if vecs else np.zeros((0, dim), dtype=np.float32)
        self.vector_store.build(chunk_ids, matrix)

        self.districts = list(self.meta.get("districts", []))
        self.branch_codes = {b["code"] for b in self.meta.get("branches", [])}
        self.name_tokens = [(d["code"], distinctive_tokens(d.get("name", ""))) for d in docs]
        logger.info(
            "index built: %d colleges, %d chunk vectors (backend=%s, dim=%d)",
            len(docs), self.vector_store.size, backend, dim,
        )

    def semantic_colleges(self, query_vec: np.ndarray, k: int = 20) -> List[Tuple[str, float]]:
        """Search the chunk vector store and aggregate hits to colleges.

        A college's score is the best (max) cosine similarity of any of its chunks
        against the query, so a query that strongly matches one section of a
        document surfaces the college even if its other chunks are unrelated.
        Returns college codes ordered by descending score.
        """
        best: Dict[str, float] = {}
        for chunk_id, score in self.vector_store.search(query_vec, k=k):
            if score <= 0:
                continue
            owner = self.chunk_owner.get(chunk_id)
            if owner is None:
                continue
            if owner not in best or score > best[owner]:
                best[owner] = score
        return sorted(best.items(), key=lambda x: -x[1])

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
