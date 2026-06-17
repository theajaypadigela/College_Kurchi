"""AI Counselor: orchestrates the RAG pipeline (parse → retrieve → ground → LLM),
with a deterministic template fallback when no LLM key is configured.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .index import RagIndex, get_index
from .llm import LLMClient, get_llm
from .query_parser import ParsedQuery, parse
from .retriever import find_branch, rank_of, retrieve

SYSTEM_PROMPT = (
    "You are College Kurchi, a friendly, precise counseling assistant for TS EAMCET "
    "(Telangana engineering admissions). Answer the student's question using ONLY the "
    "facts in the provided CONTEXT, which comes from the official last-ranks dataset. "
    "Rules:\n"
    "- If a STUDENT PROFILE is provided, use that rank, category, and gender to "
    "personalise your answer. Do NOT ask the student for their rank or preferences "
    "when the profile is already given.\n"
    "- Never invent colleges, ranks, fees, or packages. If the answer is not in the "
    "CONTEXT, say you don't have that data.\n"
    "- A college is 'gettable' for a rank when its closing rank is greater than or equal "
    "to the student's rank (lower closing rank = more competitive).\n"
    "- Refer to colleges by name with their code in brackets, e.g. CBIT (CBIT).\n"
    "- Be concise. Use short markdown bullets. Explain the reasoning briefly.\n"
    "- All cutoffs are from the final phase; mention the year when relevant."
)


def _category_label(index: RagIndex, value: str) -> str:
    for c in index.meta.get("categories", []):
        if c.get("value") == value:
            return c.get("label", value)
    return value


def _fmt_money(v: Optional[int]) -> str:
    return f"Rs {v:,}" if v else "n/a"


def _college_context(c: dict, parsed: ParsedQuery, index: RagIndex) -> str:
    cat, gen = parsed.category, parsed.gender
    label = _category_label(index, cat)
    parts = [f"{c['name']} ({c['code']}) — {c.get('district', '')}, {c.get('university', '')}, {c.get('type', '')}"]

    if parsed.branch:
        b = find_branch(c, parsed.branch)
        if b:
            r = rank_of(b, cat, gen)
            parts.append(
                f"{b['code']} closing rank ({label} {gen}): {r if r is not None else 'not offered'}"
            )
    else:
        # show the 3 most competitive branches by OC Boys
        brs = [(b, rank_of(b, "OC", "Boys")) for b in c.get("branches", [])]
        brs = [x for x in brs if x[1] is not None]
        brs.sort(key=lambda x: x[1])
        if brs:
            parts.append(
                "branches (OC Boys closing): "
                + ", ".join(f"{b['code']} {r}" for b, r in brs[:3])
            )

    fee = c.get("feePerYear")
    avg = c.get("averagePackageLpa")
    high = c.get("highestPackageLpa")
    extra = []
    if fee:
        extra.append(f"fee/yr {_fmt_money(fee)}")
    if avg:
        extra.append(f"avg package {avg} LPA")
    if high:
        extra.append(f"highest {high} LPA")
    if c.get("topRecruiters"):
        extra.append("recruiters: " + ", ".join(c["topRecruiters"][:5]))
    if extra:
        parts.append("; ".join(extra))
    return "- " + " | ".join(parts)


def build_context(colleges: List[dict], parsed: ParsedQuery, index: RagIndex) -> str:
    if not colleges:
        return "(no matching colleges found in the dataset)"
    return "\n".join(_college_context(c, parsed, index) for c in colleges)


def _template_answer(parsed: ParsedQuery, colleges: List[dict], index: RagIndex) -> str:
    year = index.year
    label = _category_label(index, parsed.category)
    if not colleges:
        return (
            "I couldn't find colleges matching that in the TS EAMCET "
            f"{year} dataset. Try naming a branch (e.g. CSE), a rank, or a location."
        )

    if parsed.intent == "compare" and len(parsed.collegeCodes) >= 2:
        lines = [f"**Comparing {len(colleges)} colleges (TS EAMCET {year}):**", ""]
        for c in colleges:
            bits = [f"**{c['name']} ({c['code']})** — {c.get('district','')}, {c.get('type','')}"]
            if parsed.branch:
                b = find_branch(c, parsed.branch)
                if b:
                    r = rank_of(b, parsed.category, parsed.gender)
                    bits.append(f"{parsed.branch} {label} {parsed.gender} closing: {r if r is not None else 'n/a'}")
            if c.get("feePerYear"):
                bits.append(f"fee/yr Rs {c['feePerYear']:,}")
            if c.get("averagePackageLpa"):
                bits.append(f"avg {c['averagePackageLpa']} LPA")
            lines.append("• " + " · ".join(bits))
        return "\n".join(lines)

    if parsed.intent in ("recommend", "predict") and parsed.rank and parsed.branch:
        branch = parsed.branch
        gettable = []
        for c in colleges:
            b = find_branch(c, branch)
            if not b:
                continue
            r = rank_of(b, parsed.category, parsed.gender)
            if r is not None and r >= parsed.rank:
                gettable.append((c, r))
        gettable.sort(key=lambda x: x[1])
        header = (
            f"**{branch} colleges for rank {parsed.rank:,} ({label} {parsed.gender}, {year})"
            + (f" in {parsed.location}" if parsed.location else "")
            + ":**"
        )
        if not gettable:
            return header + "\n\nNo colleges in the dataset had a closing rank at or above your rank for this branch/category. Consider a less competitive branch or removing the location filter."
        lines = [header, ""]
        for c, r in gettable[:6]:
            extra = f" · avg {c['averagePackageLpa']} LPA" if c.get("averagePackageLpa") else ""
            lines.append(f"• {c['name']} ({c['code']}) — closing {r:,}{extra}")
        lines.append("\nThese closing ranks are at or above your rank, so you have a good chance.")
        return "\n".join(lines)

    # general / top
    lines = [f"**Relevant colleges (TS EAMCET {year}):**", ""]
    for c in colleges[:6]:
        bits = [f"{c['name']} ({c['code']})", c.get("district", "")]
        b = find_branch(c, parsed.branch) if parsed.branch else None
        if b:
            r = rank_of(b, parsed.category, parsed.gender)
            if r is not None:
                bits.append(f"{parsed.branch} closing {r:,}")
        if c.get("averagePackageLpa"):
            bits.append(f"avg {c['averagePackageLpa']} LPA")
        lines.append("• " + " · ".join(x for x in bits if x))
    return "\n".join(lines)


def _history_messages(history) -> List[dict]:
    msgs: List[dict] = []
    for m in (history or [])[-6:]:
        role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else None)
        content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else None)
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    return msgs


def chat(
    message: str,
    history=None,
    index: Optional[RagIndex] = None,
    llm: Optional[LLMClient] = None,
    user_rank: Optional[int] = None,
    user_category: Optional[str] = None,
    user_gender: Optional[str] = None,
) -> Dict:
    index = index or get_index()
    llm = llm or get_llm()

    parsed = parse(message, index)

    # ── Merge logged-in user profile as defaults ──────────────────────
    # If the query parser didn't extract a rank/category/gender from the
    # message text, fill them in from the user's profile so vague
    # questions like "which college best suits me?" still get
    # personalised answers.
    if parsed.rank is None and user_rank is not None:
        parsed.rank = user_rank
        # If user gave a rank (from profile) but no branch, default to
        # CSE — the most commonly-asked branch.
        if not parsed.branchSpecified:
            parsed.branch = "CSE"
        # When rank was filled from the profile the intent is implicitly
        # a recommendation (the user wants colleges suitable for *them*).
        if parsed.intent == "general":
            parsed.intent = "recommend"
    if not parsed.categorySpecified and user_category:
        parsed.category = user_category
    if not parsed.genderSpecified and user_gender:
        parsed.gender = user_gender

    print(
        f"[counselor] parsed: rank={parsed.rank}, branch={parsed.branch}, "
        f"cat={parsed.category}, gender={parsed.gender}, intent={parsed.intent}"
    )

    colleges = retrieve(parsed, message, index, limit=8)
    context = build_context(colleges, parsed, index)
    sources = [{"code": c["code"], "name": c["name"]} for c in colleges]

    print(f"[counselor] retrieved {len(colleges)} colleges")

    # ── Build a student-profile preamble for the LLM ──────────────────
    profile_parts: List[str] = []
    if parsed.rank is not None:
        profile_parts.append(f"rank {parsed.rank:,}")
    if parsed.category:
        label = _category_label(index, parsed.category)
        profile_parts.append(f"category {label}")
    if parsed.gender:
        profile_parts.append(parsed.gender)
    profile_line = (
        "STUDENT PROFILE: " + ", ".join(profile_parts) + "\n\n"
        if profile_parts
        else ""
    )

    used_llm = False
    answer: str
    if llm.available and colleges:
        try:
            msgs = _history_messages(history)
            msgs.append(
                {
                    "role": "user",
                    "content": (
                        f"{profile_line}"
                        f"CONTEXT (TS EAMCET {index.year} final phase):\n{context}\n\n"
                        f"QUESTION: {message}"
                    ),
                }
            )
            answer = llm.chat(SYSTEM_PROMPT, msgs)
            used_llm = bool(answer)
            if not answer:
                answer = _template_answer(parsed, colleges, index)
        except Exception as exc:  # noqa: BLE001 — any LLM/network failure → fallback
            print(f"[counselor] LLM error, using fallback: {exc}")
            answer = _template_answer(parsed, colleges, index)
    else:
        answer = _template_answer(parsed, colleges, index)

    return {"answer": answer, "sources": sources, "parsed": parsed.to_dict(), "usedLlm": used_llm}
