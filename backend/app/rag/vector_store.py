"""In-memory cosine-similarity vector store.

Embeddings are persisted in MongoDB; at startup we load them into a single
NumPy matrix and search with a dot product (vectors are L2-normalized, so the
dot product is cosine similarity). For ~160 documents this is instant and works
against any MongoDB (no Atlas Vector Search required).
"""
from __future__ import annotations

from typing import List, Tuple

import numpy as np


class VectorStore:
    def __init__(self) -> None:
        self.codes: List[str] = []
        self.matrix: np.ndarray | None = None  # shape (N, dim), L2-normalized rows

    def build(self, codes: List[str], vectors: np.ndarray) -> None:
        self.codes = list(codes)
        if vectors is None or len(vectors) == 0:
            self.matrix = None
            return
        mat = np.asarray(vectors, dtype=np.float32)
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self.matrix = mat / norms

    @property
    def size(self) -> int:
        return 0 if self.matrix is None else self.matrix.shape[0]

    def search(self, query_vec: np.ndarray, k: int = 8) -> List[Tuple[str, float]]:
        if self.matrix is None or self.size == 0:
            return []
        q = np.asarray(query_vec, dtype=np.float32)
        n = float(np.linalg.norm(q))
        if n > 0:
            q = q / n
        sims = self.matrix @ q  # (N,)
        k = min(k, sims.shape[0])
        top = np.argpartition(-sims, k - 1)[:k]
        top = top[np.argsort(-sims[top])]
        return [(self.codes[i], float(sims[i])) for i in top]
