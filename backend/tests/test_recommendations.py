"""Tests for the Dream / Moderate / Safe recommendation bucketing."""
from __future__ import annotations

from app.models import RecommendationRequest
from app.services.recommendations import recommend


def _codes(items):
    return {i.college.code for i in items}


def test_bucketing_for_mid_rank(seeded_db):
    req = RecommendationRequest(rank=5000, category="OC", gender="Boys", branch="CSE")
    res = recommend(req)
    # CBIT (2053) and VASA (3500) close below the rank → competitive "dream".
    assert _codes(res.dream) == {"CBIT", "VASA"}
    # MGIT (6000) is within +7000 above the rank → "moderate".
    assert _codes(res.moderate) == {"MGIT"}
    assert res.safe == []


def test_safe_bucket_for_low_rank(seeded_db):
    # On ECE (cutoffs 8000/12000/15000) a rank of 100 clears every cutoff by far
    # more than the 7000 SAFE_MARGIN → everything is comfortably "safe".
    req = RecommendationRequest(rank=100, category="OC", gender="Boys", branch="ECE")
    res = recommend(req)
    assert _codes(res.safe) == {"CBIT", "VASA", "MGIT"}
    assert res.dream == [] and res.moderate == []


def test_unrealistic_colleges_are_dropped(seeded_db):
    # Rank far worse than all cutoffs → beyond DREAM_MARGIN, nothing returned.
    req = RecommendationRequest(rank=80000, category="OC", gender="Boys", branch="CSE")
    res = recommend(req)
    assert res.dream == [] and res.moderate == [] and res.safe == []


def test_location_filter(seeded_db):
    req = RecommendationRequest(rank=100, category="OC", gender="Boys", branch="CSE",
                               location="Hyderabad")
    res = recommend(req)
    all_codes = _codes(res.safe) | _codes(res.moderate) | _codes(res.dream)
    assert all_codes == {"VASA", "MGIT"}  # CBIT (Ranga Reddy) excluded
