"""Tests for the admission-probability predictor service."""
from __future__ import annotations

from app.models import PredictRequest
from app.services.predictor import _probability, predict


def test_probability_monotonic_in_margin():
    # Larger (cutoff - rank) margin → higher probability.
    probs = [_probability(cutoff, rank=10000) for cutoff in (5000, 10000, 15000, 25000)]
    assert probs == sorted(probs)
    assert probs[0] >= 5 and probs[-1] <= 98


def test_probability_neutral_prior_without_college():
    assert _probability(None, rank=10000) == 60


def test_predict_for_specific_college(seeded_db):
    req = PredictRequest(rank=1000, category="OC", gender="Boys", branch="CSE", collegeCode="CBIT")
    res = predict(req)
    assert res.collegeName == "CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY"
    assert res.cutoffRank == 2053
    assert res.classification in {"HIGH", "MEDIUM", "LOW"}
    # CBIT closing (2053) is above the rank (1000) → admission feasible.
    assert "above your rank" in res.reasoning
    # Safe alternatives = same branch with closing >= rank + 5000, excluding CBIT.
    alt_codes = {a.code for a in res.safeAlternatives}
    assert "MGIT" in alt_codes
    assert "CBIT" not in alt_codes


def test_predict_without_college_uses_prior(seeded_db):
    req = PredictRequest(rank=12000, category="OC", gender="Boys", branch="CSE")
    res = predict(req)
    assert res.collegeName is None
    assert res.cutoffRank is None
    assert res.probability == 60
