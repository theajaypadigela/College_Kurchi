"""College / cutoff queries against MongoDB."""
from __future__ import annotations

from typing import List, Optional

from ..db import COLLEGES, get_db

PUBLIC_PROJECTION = {"embedding": 0, "document": 0, "_id": 0}


def list_colleges(
    q: Optional[str] = None,
    branch: Optional[str] = None,
    district: Optional[str] = None,
    type_: Optional[str] = None,
    university: Optional[str] = None,
    min_fee: Optional[int] = None,
    max_fee: Optional[int] = None,
    min_avg_package: Optional[float] = None,
    codes: Optional[List[str]] = None,
    sort: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[dict]:
    filt: dict = {}
    if codes:
        filt["code"] = {"$in": codes}
    if branch:
        filt["branches.code"] = branch
    if district:
        filt["district"] = district
    if type_:
        filt["type"] = type_
    if university:
        filt["university"] = university
    fee: dict = {}
    if min_fee is not None:
        fee["$gte"] = min_fee
    if max_fee is not None:
        fee["$lte"] = max_fee
    if fee:
        filt["feePerYear"] = fee
    if min_avg_package is not None:
        filt["averagePackageLpa"] = {"$gte": min_avg_package}

    docs = list(get_db()[COLLEGES].find(filt, PUBLIC_PROJECTION))

    if q:
        ql = q.lower()
        docs = [
            d for d in docs
            if ql in d["name"].lower()
            or ql in d["code"].lower()
            or ql in (d.get("district") or "").lower()
        ]

    if sort == "fee":
        docs.sort(key=lambda d: (d.get("feePerYear") or 10**12))
    elif sort == "package":
        docs.sort(key=lambda d: -(d.get("averagePackageLpa") or 0))
    else:
        docs.sort(key=lambda d: d["name"])

    if limit:
        docs = docs[:limit]
    return docs


def get_college(code: str) -> Optional[dict]:
    return get_db()[COLLEGES].find_one({"code": code.upper()}, PUBLIC_PROJECTION)


def list_cutoffs(
    branch: Optional[str] = None,
    category: str = "OC",
    gender: str = "Boys",
    district: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 400,
) -> List[dict]:
    filt: dict = {}
    if branch:
        filt["branches.code"] = branch
    if district:
        filt["district"] = district
    docs = list(get_db()[COLLEGES].find(filt, PUBLIC_PROJECTION))

    key = f"{category}|{gender}"
    ql = q.lower() if q else None
    rows: List[dict] = []
    for c in docs:
        if ql and not (ql in c["name"].lower() or ql in c["code"].lower()):
            continue
        for b in c["branches"]:
            if branch and b["code"] != branch:
                continue
            r = b.get("ranks", {}).get(key)
            if r is None:
                continue
            rows.append(
                {
                    "collegeCode": c["code"],
                    "collegeName": c["name"],
                    "district": c.get("district", ""),
                    "university": c.get("university", ""),
                    "type": c.get("type", ""),
                    "branchCode": b["code"],
                    "branchName": b["name"],
                    "closingRank": r,
                }
            )
    rows.sort(key=lambda x: x["closingRank"])
    return rows[:limit]
