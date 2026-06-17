"""Parse a free-text counseling question into structured intent + filters.

This is the first step of the RAG pipeline: turning "Which CSE colleges can I get
with 25,000 rank in Hyderabad?" into {intent: recommend, rank: 25000, branch: CSE,
category: OC, gender: Boys, location: Hyderabad}.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import List, Optional

# (regex, branch_code) — order matters: specific before generic.
BRANCH_PATTERNS = [
    (re.compile(r"\bcse\b|computer science(?! and (business|design))|comp sci"), "CSE"),
    (re.compile(r"aiml|ai\s*&?\s*ml|machine learning|artificial intelligence and machine"), "CSM"),
    (re.compile(r"data science|\bai\s*&?\s*ds\b|\baids\b"), "CSD"),
    (re.compile(r"cyber security|cyber\b"), "CSC"),
    (re.compile(r"\bece\b|electronics and communication"), "ECE"),
    (re.compile(r"information technology|\bit\b(?= branch| course| college| seat)"), "INF"),
    (re.compile(r"\beee\b|electrical"), "EEE"),
    (re.compile(r"\bmech(anical)?\b"), "MEC"),
    (re.compile(r"\bcivil\b"), "CIV"),
    (re.compile(r"aero(nautical)?"), "ANE"),
    (re.compile(r"\bbiotech|bio-?technology"), "BIO"),
    (re.compile(r"chemical"), "CHE"),
]

# (regex, category_value) — specific before generic.
CATEGORY_PATTERNS = [
    (re.compile(r"\bews\b|economically weaker"), "EWS"),
    (re.compile(r"\bbc[-\s]?a\b|\bbca\b"), "BC_A"),
    (re.compile(r"\bbc[-\s]?b\b|\bbcb\b"), "BC_B"),
    (re.compile(r"\bbc[-\s]?c\b|\bbcc\b"), "BC_C"),
    (re.compile(r"\bbc[-\s]?d\b|\bbcd\b"), "BC_D"),
    (re.compile(r"\bbc[-\s]?e\b|\bbce\b"), "BC_E"),
    (re.compile(r"\bsc[-\s]?1\b|\bsc1\b"), "SC_1"),
    (re.compile(r"\bsc[-\s]?2\b|\bsc2\b"), "SC_2"),
    (re.compile(r"\bsc[-\s]?3\b|\bsc3\b"), "SC_3"),
    (re.compile(r"\bst\b|scheduled tribe"), "ST"),
    (re.compile(r"\bbc\b|backward class"), "BC_B"),
    (re.compile(r"\bsc\b|scheduled caste"), "SC_1"),
    (re.compile(r"\boc\b|open category|general category"), "OC"),
]

RANK_RE = re.compile(r"\b(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(k|thousand)?\b", re.IGNORECASE)
FEE_RE = re.compile(r"(?:under|below|less than|max|budget|upto|up to)\s*(?:rs\.?|₹)?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(k|l|lakh|lakhs|lpa)?", re.IGNORECASE)


@dataclass
class ParsedQuery:
    intent: str = "general"
    rank: Optional[int] = None
    branch: Optional[str] = None
    branchSpecified: bool = False
    category: str = "OC"
    categorySpecified: bool = False
    gender: str = "Boys"
    genderSpecified: bool = False
    location: Optional[str] = None
    collegeCodes: List[str] = field(default_factory=list)
    maxFee: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _parse_rank(q: str) -> Optional[int]:
    for m in RANK_RE.finditer(q):
        raw, suffix = m.group(1), m.group(2)
        has_comma = "," in raw
        if not has_comma and not suffix and "rank" not in q:
            continue  # a bare number that isn't clearly a rank (e.g. a year)
        n = int(raw.replace(",", ""))
        if suffix and suffix.lower() in ("k", "thousand"):
            n *= 1000
        if 0 < n <= 500000:
            return n
    return None


def _parse_fee(q: str) -> Optional[int]:
    m = FEE_RE.search(q)
    if not m:
        return None
    n = int(m.group(1).replace(",", ""))
    unit = (m.group(2) or "").lower()
    if unit in ("l", "lakh", "lakhs"):
        n *= 100000
    elif unit == "k":
        n *= 1000
    # ignore "lpa" matches (those describe packages, not fees)
    if unit == "lpa":
        return None
    return n if n >= 1000 else None


def _detect_colleges(q: str, index) -> List[str]:
    tokens = set(re.findall(r"[a-z0-9]+", q))
    found: List[str] = []
    # exact code tokens
    for code in index.by_code:
        if len(code) >= 3 and code.lower() in tokens:
            found.append(code)
    # distinctive name tokens (e.g. "vasavi")
    for code, name_toks in index.name_tokens:
        if code in found:
            continue
        if name_toks & tokens:
            found.append(code)
    # de-dupe preserving order, cap
    seen, out = set(), []
    for c in found:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out[:4]


def parse(message: str, index) -> ParsedQuery:
    q = " " + message.lower().strip() + " "
    pq = ParsedQuery()

    pq.rank = _parse_rank(q)
    pq.maxFee = _parse_fee(q)

    for pat, code in BRANCH_PATTERNS:
        if pat.search(q):
            pq.branch, pq.branchSpecified = code, True
            break

    for pat, value in CATEGORY_PATTERNS:
        if pat.search(q):
            pq.category, pq.categorySpecified = value, True
            break

    if re.search(r"\bgirl|female|women|ladies\b", q):
        pq.gender, pq.genderSpecified = "Girls", True
    elif re.search(r"\bboy|male|men\b", q):
        pq.gender, pq.genderSpecified = "Boys", True

    for d in index.districts:
        if d.lower() in q:
            pq.location = d
            break

    pq.collegeCodes = _detect_colleges(q, index)

    # Intent
    if "compare" in q or " vs " in q or "versus" in q or len(pq.collegeCodes) >= 2:
        pq.intent = "compare"
    elif re.search(r"chance|predict|will i get|can i get into|my chances", q):
        pq.intent = "predict"
    elif pq.rank is not None:
        pq.intent = "recommend"
    elif "top" in q or "best" in q or "good colleges" in q:
        pq.intent = "top"
    else:
        pq.intent = "general"

    return pq
