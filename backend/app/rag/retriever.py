"""Hybrid retrieval: structured DB filtering + semantic vector search.

Returns an ordered, de-duplicated list of college documents to ground the answer.
"""
from __future__ import annotations

from typing import List, Optional

from .index import RagIndex
from .query_parser import ParsedQuery


def rank_of(branch: dict, category: str, gender: str) -> Optional[int]:
    return branch.get("ranks", {}).get(f"{category}|{gender}")


def find_branch(college: dict, branch_code: str) -> Optional[dict]:
    return next((b for b in college.get("branches", []) if b["code"] == branch_code), None)


def retrieve(parsed: ParsedQuery, query_text: str, index: RagIndex, limit: int = 10) -> List[dict]:
    picked: List[dict] = []
    seen = set()

    def add(college: Optional[dict]) -> None:
        if college and college["code"] not in seen:
            seen.add(college["code"])
            picked.append(college)

    # 1) Explicitly named colleges (compare / "tell me about X")
    for code in parsed.collegeCodes:
        add(index.by_code.get(code))

    # 2) Structured retrieval by branch + rank + filters
    if parsed.branch:
        cat, gen = parsed.category, parsed.gender
        rows = []
        for c in index.colleges:
            b = find_branch(c, parsed.branch)
            if not b:
                continue
            r = rank_of(b, cat, gen)
            if r is None:
                continue
            if parsed.location and parsed.location.lower() not in (c.get("district") or "").lower():
                continue
            if parsed.maxFee and c.get("feePerYear") and c["feePerYear"] > parsed.maxFee:
                continue
            rows.append((c, r))

        if parsed.rank is not None:
            gettable = sorted([x for x in rows if x[1] >= parsed.rank], key=lambda x: x[1])
            reach = sorted([x for x in rows if x[1] < parsed.rank], key=lambda x: -x[1])
            for c, _ in gettable[:6]:
                add(c)
            for c, _ in reach[:2]:
                add(c)
        else:
            for c, _ in sorted(rows, key=lambda x: x[1])[:8]:
                add(c)

    # 3) Semantic retrieval (fills gaps / handles fuzzy questions).
    #    Searches the chunk-level vector store and aggregates chunk hits back to
    #    their parent colleges (best-chunk score per college).
    if index.embedder is not None and index.vector_store.size and len(picked) < limit:
        qv = index.embedder.embed(query_text)
        for code, _score in index.semantic_colleges(qv, k=20):
            add(index.by_code.get(code))
            if len(picked) >= limit:
                break

    return picked[:limit]
