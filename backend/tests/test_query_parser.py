"""Unit tests for the free-text query parser (first RAG stage)."""
from __future__ import annotations

from app.rag.query_parser import parse


def test_recommend_intent_with_rank_branch_location(index):
    pq = parse("Which CSE colleges can I get with 25,000 rank in Hyderabad?", index)
    assert pq.branch == "CSE"
    assert pq.rank == 25000
    assert pq.location == "Hyderabad"
    assert pq.intent == "recommend"


def test_rank_suffix_k_is_expanded(index):
    assert parse("colleges for 25k rank", index).rank == 25000


def test_bare_year_is_not_treated_as_rank(index):
    # No comma, no 'k', no 'rank' keyword → ignored.
    assert parse("placements in 2024", index).rank is None


def test_category_and_gender_detection(index):
    pq = parse("BC-B girls cutoff for ECE", index)
    assert pq.category == "BC_B"
    assert pq.gender == "Girls"
    assert pq.branch == "ECE"


def test_compare_intent_and_codes(index):
    pq = parse("compare CBIT and VASA", index)
    assert set(pq.collegeCodes) == {"CBIT", "VASA"}
    assert pq.intent == "compare"


def test_predict_intent(index):
    pq = parse("what are my chances for CSE at 9000 rank", index)
    assert pq.intent == "predict"


def test_distinctive_name_token_resolves_college(index):
    pq = parse("tell me about vasavi", index)
    assert "VASA" in pq.collegeCodes


def test_fee_parsing_in_lakhs(index):
    pq = parse("CSE colleges under 1 lakh fee", index)
    assert pq.maxFee == 100000


def test_defaults_when_unspecified(index):
    pq = parse("best engineering colleges", index)
    assert pq.category == "OC"
    assert pq.gender == "Boys"
    assert pq.categorySpecified is False
    assert pq.genderSpecified is False
    assert pq.intent == "top"  # "best" → top intent
