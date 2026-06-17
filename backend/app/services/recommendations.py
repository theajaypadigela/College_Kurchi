"""Personalized recommendations: classify colleges into Dream / Moderate / Safe
for a student's rank, category, gender and branch, honoring location & budget."""
from __future__ import annotations

from typing import List

from ..db import COLLEGES, get_db
from ..models import (
    College,
    RecommendationItem,
    RecommendationRequest,
    RecommendationResponse,
)
from .colleges import PUBLIC_PROJECTION

# Thresholds on diff = closingRank - studentRank
SAFE_MARGIN = 7000      # closing well above your rank -> very likely
DREAM_MARGIN = -7000    # closing this far below your rank -> unrealistic, drop


def _reason(bucket: str, diff: int, closing: int, c: dict, req: RecommendationRequest) -> str:
    loc = f" in {c.get('district')}" if req.location else ""
    pkg = f" Avg package {c['averagePackageLpa']} LPA." if c.get("averagePackageLpa") else ""
    if bucket == "safe":
        return f"Closing rank {closing:,} is ~{diff:,} above your rank{loc}, so admission is very likely.{pkg}"
    if bucket == "moderate":
        return f"Closing rank {closing:,} is close to your rank — a strong, realistic match{loc}.{pkg}"
    return f"Closing rank {closing:,} is just below your rank — a competitive stretch worth listing high.{pkg}"


def recommend(req: RecommendationRequest) -> RecommendationResponse:
    filt: dict = {"branches.code": req.branch}
    if req.location:
        filt["district"] = req.location
    if req.maxFee:
        # include colleges with unknown fee (null) so we don't hide options
        filt["$or"] = [{"feePerYear": {"$lte": req.maxFee}}, {"feePerYear": None}]

    docs = list(get_db()[COLLEGES].find(filt, PUBLIC_PROJECTION))
    key = f"{req.category}|{req.gender}"

    dream: List[RecommendationItem] = []
    moderate: List[RecommendationItem] = []
    safe: List[RecommendationItem] = []

    for c in docs:
        b = next((x for x in c["branches"] if x["code"] == req.branch), None)
        if not b:
            continue
        closing = b.get("ranks", {}).get(key)
        if closing is None:
            continue
        diff = closing - req.rank

        if diff < DREAM_MARGIN:
            continue  # no realistic chance
        if diff >= SAFE_MARGIN:
            bucket = "safe"
        elif diff >= 0:
            bucket = "moderate"
        else:
            bucket = "dream"

        item = RecommendationItem(
            college=College(**c),
            branchCode=req.branch,
            branchName=b["name"],
            closingRank=closing,
            bucket=bucket,
            reason=_reason(bucket, diff, closing, c, req),
        )
        {"dream": dream, "moderate": moderate, "safe": safe}[bucket].append(item)

    # Best (most competitive) first within each bucket; cap to keep payloads sane.
    for lst in (dream, moderate, safe):
        lst.sort(key=lambda x: x.closingRank)
    return RecommendationResponse(
        dream=dream[:20], moderate=moderate[:20], safe=safe[:20]
    )
