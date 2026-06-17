"""Unit tests for the in-memory cosine vector store."""
from __future__ import annotations

import numpy as np

from app.rag.vector_store import VectorStore


def _store():
    vs = VectorStore()
    vectors = np.array(
        [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.9, 0.1, 0.0],
        ],
        dtype=np.float32,
    )
    vs.build(["a", "b", "c"], vectors)
    return vs


def test_empty_store_returns_no_results():
    vs = VectorStore()
    vs.build([], np.zeros((0, 3), dtype=np.float32))
    assert vs.size == 0
    assert vs.search(np.array([1.0, 0.0, 0.0]), k=3) == []


def test_search_ranks_by_cosine_similarity():
    vs = _store()
    results = vs.search(np.array([1.0, 0.0, 0.0], dtype=np.float32), k=3)
    codes = [code for code, _ in results]
    # 'a' is identical, 'c' is close, 'b' is orthogonal.
    assert codes[0] == "a"
    assert codes[1] == "c"
    assert codes[2] == "b"


def test_search_scores_are_descending_and_normalized():
    vs = _store()
    results = vs.search(np.array([2.0, 0.0, 0.0], dtype=np.float32), k=3)
    scores = [s for _, s in results]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] <= 1.0 + 1e-6


def test_k_larger_than_corpus_is_clamped():
    vs = _store()
    assert len(vs.search(np.array([1.0, 0.0, 0.0], dtype=np.float32), k=99)) == 3


def test_rows_are_l2_normalized_on_build():
    vs = _store()
    norms = np.linalg.norm(vs.matrix, axis=1)
    assert np.allclose(norms, 1.0)
