"""Unit tests for the embedding backends."""
from __future__ import annotations

import numpy as np

from app.rag.embeddings import HashingEmbedder, get_embedder


def test_hashing_embedder_dimension_and_norm():
    emb = HashingEmbedder(dim=256)
    v = emb.embed("computer science engineering college")
    assert v.shape == (256,)
    # Non-empty text is L2-normalized.
    assert abs(float(np.linalg.norm(v)) - 1.0) < 1e-5


def test_hashing_embedder_is_deterministic():
    emb = HashingEmbedder(dim=128)
    a = emb.embed("vasavi college hyderabad")
    b = emb.embed("vasavi college hyderabad")
    assert np.array_equal(a, b)


def test_similar_text_scores_higher_than_unrelated():
    emb = HashingEmbedder(dim=512)
    q = emb.embed("computer science engineering cutoff rank")
    near = emb.embed("computer science engineering closing rank for CSE")
    far = emb.embed("biotechnology fees and hostel facilities")
    assert float(q @ near) > float(q @ far)


def test_embed_many_matches_embed_rows():
    emb = HashingEmbedder(dim=64)
    texts = ["alpha beta", "gamma delta", "epsilon zeta"]
    matrix = emb.embed_many(texts)
    assert matrix.shape == (3, 64)
    for i, t in enumerate(texts):
        assert np.allclose(matrix[i], emb.embed(t))


def test_embed_many_empty():
    emb = HashingEmbedder(dim=32)
    assert emb.embed_many([]).shape == (0, 32)


def test_get_embedder_defaults_to_hashing():
    emb = get_embedder("hashing", dim=100)
    assert emb.backend == "hashing"
    assert emb.dim == 100


def test_get_embedder_st_falls_back_when_unavailable():
    # sentence-transformers is not installed in the test env → graceful fallback.
    emb = get_embedder("st", dim=77)
    assert emb.backend == "hashing"
    assert emb.dim == 77
