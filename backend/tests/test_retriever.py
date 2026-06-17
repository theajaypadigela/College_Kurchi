"""Tests for hybrid retrieval (structured + chunk-level semantic) and the
chunk-aggregating semantic search on the index."""
from __future__ import annotations

from app.rag.query_parser import ParsedQuery, parse
from app.rag.retriever import retrieve


def test_structured_retrieval_prioritises_gettable_then_reach(index):
    parsed = ParsedQuery(intent="recommend", rank=5000, branch="CSE",
                         category="OC", gender="Boys")
    picked = retrieve(parsed, "CSE colleges for 5000 rank", index, limit=10)
    codes = [c["code"] for c in picked]
    assert set(codes) == {"MGIT", "VASA", "CBIT"}
    # MGIT closes at 6000 (>= 5000) so it's gettable and ranks ahead of the
    # reach colleges (CBIT 2053, VASA 3500) whose cutoffs are below the rank.
    assert codes[0] == "MGIT"


def test_named_college_is_retrieved_first(index):
    parsed = parse("tell me about vasavi college", index)
    picked = retrieve(parsed, "tell me about vasavi college", index, limit=10)
    assert picked
    assert picked[0]["code"] == "VASA"


def test_semantic_colleges_aggregates_chunks_to_unique_colleges(index):
    # Embed CBIT's own document; its chunks should make CBIT the top owner.
    doc = index.by_code["CBIT"]["document"]
    qv = index.embedder.embed(doc)
    ranked = index.semantic_colleges(qv, k=20)
    codes = [code for code, _ in ranked]
    assert codes, "expected at least one semantic hit"
    assert len(codes) == len(set(codes)), "each college must appear at most once"
    assert codes[0] == "CBIT"


def test_location_filter_in_structured_retrieval(index):
    parsed = ParsedQuery(intent="recommend", rank=50000, branch="CSE",
                         category="OC", gender="Boys", location="Hyderabad")
    # limit=2 is filled entirely by the structured stage (the two Hyderabad CSE
    # colleges), so the location-agnostic semantic fallback doesn't run. CBIT is
    # in Ranga Reddy and must be excluded by the structured location filter.
    picked = retrieve(parsed, "CSE in Hyderabad", index, limit=2)
    codes = {c["code"] for c in picked}
    assert codes == {"VASA", "MGIT"}
    assert "CBIT" not in codes
