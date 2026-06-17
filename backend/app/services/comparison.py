"""Side-by-side comparison with an LLM-generated (or templated) summary."""
from __future__ import annotations

from typing import List, Optional

from ..models import College, CompareRequest, CompareResponse
from ..rag.llm import get_llm
from .colleges import get_college

SUMMARY_SYSTEM = (
    "You are College Kurchi. Compare the given TS EAMCET colleges using ONLY the facts "
    "provided. Write 3-5 short markdown bullets covering the meaningful differences in "
    "cutoff ranks, fees, placements, location and branches, then a one-line takeaway "
    "('Best for ...'). Never invent numbers. Refer to colleges by name with code."
)

_PREFERRED_BRANCHES = ["CSE", "ECE", "INF", "EEE", "CSM", "MEC", "CIV"]


def _branch_rank(college: College, branch_code: str, category: str, gender: str) -> Optional[int]:
    b = next((x for x in college.branches if x.code == branch_code), None)
    if not b:
        return None
    return b.ranks.get(f"{category}|{gender}")


def _facts(colleges: List[College], req: CompareRequest) -> str:
    lines: List[str] = []
    for c in colleges:
        bits = [f"{c.name} ({c.code}): {c.district}, {c.type}, {c.university}"]
        if c.feePerYear:
            bits.append(f"fee/yr Rs {c.feePerYear:,}")
        if c.totalFees:
            bits.append(f"total Rs {c.totalFees:,}")
        if c.averagePackageLpa:
            bits.append(f"avg package {c.averagePackageLpa} LPA")
        if c.highestPackageLpa:
            bits.append(f"highest {c.highestPackageLpa} LPA")
        cutoffs = []
        for bc in _PREFERRED_BRANCHES:
            r = _branch_rank(c, bc, req.category, req.gender)
            if r is not None:
                cutoffs.append(f"{bc} {r:,}")
        if cutoffs:
            bits.append(f"{req.category} {req.gender} closing: " + ", ".join(cutoffs))
        if c.topRecruiters:
            bits.append("recruiters: " + ", ".join(c.topRecruiters[:5]))
        lines.append("- " + " | ".join(bits))
    return "\n".join(lines)


def _template_summary(colleges: List[College], req: CompareRequest) -> str:
    if len(colleges) < 2:
        return "Add at least two colleges to see a comparison summary."
    out: List[str] = []

    fee_known = [c for c in colleges if c.feePerYear]
    if fee_known:
        cheapest = min(fee_known, key=lambda c: c.feePerYear or 0)
        out.append(f"• **Lowest fee:** {cheapest.name} ({cheapest.code}) at Rs {cheapest.feePerYear:,}/yr.")

    pkg_known = [c for c in colleges if c.averagePackageLpa]
    if pkg_known:
        best = max(pkg_known, key=lambda c: c.averagePackageLpa or 0)
        out.append(f"• **Best average placement:** {best.name} ({best.code}) at {best.averagePackageLpa} LPA.")

    cse = [(c, _branch_rank(c, "CSE", req.category, req.gender)) for c in colleges]
    cse = [(c, r) for c, r in cse if r is not None]
    if cse:
        most = min(cse, key=lambda x: x[1])
        out.append(
            f"• **Most competitive CSE ({req.category} {req.gender}):** {most[0].name} "
            f"({most[0].code}) closing at {most[1]:,} — toughest to get into."
        )

    districts = {c.district for c in colleges if c.district}
    if len(districts) > 1:
        out.append("• **Location varies:** " + ", ".join(sorted(districts)) + ".")

    out.append("• **Takeaway:** weigh a tougher cutoff/better placements against fee and location for your rank.")
    return "\n".join(out)


def compare(req: CompareRequest) -> CompareResponse:
    docs = [get_college(code.upper()) for code in req.codes]
    colleges = [College(**d) for d in docs if d]

    if not colleges:
        return CompareResponse(colleges=[], aiSummary="No matching colleges found.")

    llm = get_llm()
    summary: str
    if llm.available and len(colleges) >= 2:
        try:
            context = _facts(colleges, req)
            summary = llm.chat(
                SUMMARY_SYSTEM,
                [{"role": "user", "content": f"Colleges:\n{context}\n\nCompare them for a {req.category} {req.gender} student."}],
                max_tokens=600,
            )
            if not summary:
                summary = _template_summary(colleges, req)
        except Exception as exc:  # noqa: BLE001
            print(f"[compare] LLM error, using template: {exc}")
            summary = _template_summary(colleges, req)
    else:
        summary = _template_summary(colleges, req)

    return CompareResponse(colleges=colleges, aiSummary=summary)
