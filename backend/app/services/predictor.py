"""Admission probability estimator for a (rank, category, gender, branch[, college])."""
from __future__ import annotations

from typing import List, Optional

from ..db import COLLEGES, get_db
from ..models import PredictRequest, PredictResponse, SafeAlternative
from .colleges import PUBLIC_PROJECTION


def _probability(cutoff_rank: Optional[int], rank: int) -> int:
    if cutoff_rank is None:
        return 60  # no specific college -> neutral prior
    diff = cutoff_rank - rank  # positive => your rank beats the closing rank
    if diff >= 10000:
        prob = 95
    elif diff >= 5000:
        prob = round(70 + ((diff - 5000) / 1000) * 5)
    elif diff >= 0:
        prob = round(50 + (diff / 5000) * 20)
    elif diff >= -5000:
        prob = round(50 + (diff / 5000) * 30)  # 20–50
    else:
        prob = round(20 + (diff / 1000) * 3)
    return max(5, min(98, prob))


def predict(req: PredictRequest) -> PredictResponse:
    db = get_db()
    key = f"{req.category}|{req.gender}"
    cutoff_rank: Optional[int] = None
    college_name: Optional[str] = None

    if req.collegeCode:
        c = db[COLLEGES].find_one({"code": req.collegeCode.upper()}, PUBLIC_PROJECTION)
        if c:
            college_name = c["name"]
            b = next((x for x in c["branches"] if x["code"] == req.branch), None)
            if b:
                cutoff_rank = b.get("ranks", {}).get(key)

    prob = _probability(cutoff_rank, req.rank)
    classification = "HIGH" if prob >= 70 else "MEDIUM" if prob >= 40 else "LOW"

    if cutoff_rank is not None:
        if cutoff_rank >= req.rank:
            reasoning = (
                f"The {req.branch} closing rank was {cutoff_rank:,}, which is above your rank "
                f"({req.rank:,}). You have a {classification.lower()} chance of admission."
            )
        else:
            reasoning = (
                f"The {req.branch} closing rank was {cutoff_rank:,}, better than your rank "
                f"({req.rank:,}). Admission would be challenging."
            )
    else:
        reasoning = (
            f"Estimated from your rank ({req.rank:,}) in {req.category}. Pick a target college "
            f"for a precise, cutoff-based prediction."
        )

    # Safe alternatives: same branch, closing rank comfortably above the student's rank.
    alts: List[SafeAlternative] = []
    docs = list(db[COLLEGES].find({"branches.code": req.branch}, PUBLIC_PROJECTION))
    pool = []
    for c in docs:
        if req.collegeCode and c["code"] == req.collegeCode.upper():
            continue
        b = next((x for x in c["branches"] if x["code"] == req.branch), None)
        if not b:
            continue
        r = b.get("ranks", {}).get(key)
        if r is not None and r >= req.rank + 5000:
            pool.append((c, r))
    pool.sort(key=lambda x: x[1])
    for c, r in pool[:4]:
        alts.append(SafeAlternative(code=c["code"], name=c["name"], closingRank=r))

    return PredictResponse(
        collegeName=college_name,
        branch=req.branch,
        cutoffRank=cutoff_rank,
        probability=prob,
        classification=classification,
        reasoning=reasoning,
        safeAlternatives=alts,
    )
