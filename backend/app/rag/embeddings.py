"""Text embeddings.

Two backends:
- "hashing"  : pure-NumPy feature-hashing bag-of-ngrams. Free, deterministic,
               no heavy deps. Default. Good enough because retrieval is combined
               with structured filtering on a small, well-structured dataset.
- "st"       : sentence-transformers (real semantic embeddings). Optional upgrade;
               install sentence-transformers and set EMBEDDING_BACKEND=st.
"""
from __future__ import annotations

import hashlib
import re
from typing import List, Sequence

import numpy as np

from ..logging_config import get_logger

logger = get_logger("rag.embeddings")

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOP = {"the", "and", "for", "with", "college", "engineering", "institute",
         "technology", "science", "sciences", "of", "in", "a", "an"}


def _tokenize(text: str) -> List[str]:
    words = _TOKEN_RE.findall(text.lower())
    grams: List[str] = []
    for w in words:
        grams.append(w)
        if len(w) >= 4:  # char 3-grams help with codes / partial matches
            for i in range(len(w) - 2):
                grams.append("#" + w[i:i + 3])
    for i in range(len(words) - 1):  # word bigrams capture phrases
        grams.append(words[i] + "_" + words[i + 1])
    return grams


def _stable_hash(token: str) -> int:
    return int.from_bytes(hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest(), "big")


class Embedder:
    dim: int = 0
    backend: str = "base"

    def embed(self, text: str) -> np.ndarray:  # pragma: no cover - interface
        raise NotImplementedError

    def embed_many(self, texts: Sequence[str]) -> np.ndarray:
        return np.vstack([self.embed(t) for t in texts]) if texts else np.zeros((0, self.dim), dtype=np.float32)


class HashingEmbedder(Embedder):
    backend = "hashing"

    def __init__(self, dim: int = 512) -> None:
        self.dim = dim

    def embed(self, text: str) -> np.ndarray:
        vec = np.zeros(self.dim, dtype=np.float32)
        for tok in _tokenize(text):
            h = _stable_hash(tok)
            idx = h % self.dim
            sign = 1.0 if (h >> 17) & 1 else -1.0
            vec[idx] += sign
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec /= norm
        return vec


class SentenceTransformerEmbedder(Embedder):
    backend = "st"

    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer  # lazy, optional dep

        self.model = SentenceTransformer(model_name)
        self.dim = int(self.model.get_sentence_embedding_dimension())

    def embed(self, text: str) -> np.ndarray:
        v = self.model.encode([text], normalize_embeddings=True)[0]
        return np.asarray(v, dtype=np.float32)

    def embed_many(self, texts: Sequence[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        return np.asarray(self.model.encode(list(texts), normalize_embeddings=True), dtype=np.float32)


def get_embedder(backend: str = "hashing", dim: int = 512,
                 st_model: str = "sentence-transformers/all-MiniLM-L6-v2") -> Embedder:
    """Build an embedder. Falls back to hashing if sentence-transformers is
    requested but unavailable."""
    if backend == "st":
        try:
            return SentenceTransformerEmbedder(st_model)
        except Exception as exc:  # ImportError or model download failure
            logger.warning("sentence-transformers unavailable (%s); falling back to hashing.", exc)
            return HashingEmbedder(dim=dim)
    return HashingEmbedder(dim=dim)
