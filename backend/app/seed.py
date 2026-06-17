"""Seed MongoDB from the source JSON files.

Reads the two raw datasets, normalizes them into the `colleges` collection
(branches + per category/gender closing ranks + fees + placements), computes a
text `document` and an `embedding` per college for RAG, and writes the `meta`
document used by the frontend's filters.

Run from the backend/ directory:
    python -m app.seed
    python -m app.seed --data-dir ../data --drop
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import List, Optional

import numpy as np
from pymongo import UpdateOne

from .config import settings
from .db import COLLEGES, META, META_ID, ensure_indexes, get_db
from .rag.embeddings import get_embedder

CUTOFF_FILE = "TGEAPCET_2025_FINALPHASE_LASTRANKS.json"
TABLE_FILE = "table-eapcet.json"

DISTRICT_NAMES = {
    "HNK": "Hanumakonda", "HYD": "Hyderabad", "JTL": "Jagtial",
    "KGM": "Bhadradri Kothagudem", "KHM": "Khammam", "KMR": "Kamareddy",
    "KRM": "Karimnagar", "MBN": "Mahabubnagar", "MDL": "Medchal-Malkajgiri",
    "MED": "Medak", "MHB": "Mahabubabad", "NLG": "Nalgonda", "NPT": "Narayanpet",
    "NZB": "Nizamabad", "PDL": "Peddapalli", "RR": "Ranga Reddy", "SDP": "Siddipet",
    "SRC": "Rajanna Sircilla", "SRD": "Sangareddy", "SRP": "Suryapet",
    "WGL": "Warangal", "WNP": "Wanaparthy", "YBG": "Yadadri Bhuvanagiri",
}

COLLEGE_TYPES = {"GOV": "Government", "PVT": "Private", "SF": "Self-Finance", "UNIV": "University"}

# (column prefix, category value, label)
CATEGORY_COLUMNS = [
    ("oc", "OC", "OC"), ("ews", "EWS", "EWS"),
    ("bca", "BC_A", "BC-A"), ("bcb", "BC_B", "BC-B"), ("bcc", "BC_C", "BC-C"),
    ("bcd", "BC_D", "BC-D"), ("bce", "BC_E", "BC-E"),
    ("sc1", "SC_1", "SC-1"), ("sc2", "SC_2", "SC-2"), ("sc3", "SC_3", "SC-3"),
    ("st", "ST", "ST"),
]
GENDERS = ["Boys", "Girls"]


def clean_int(value) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value) if value > 0 else None
    s = str(value).strip().replace(",", "")
    if not s or not s.lstrip("-").isdigit():
        return None
    n = int(s)
    return n if n > 0 else None


def clean_place(value) -> str:
    return " ".join(str(value or "").split())


def clean_name(value) -> str:
    name = " ".join(str(value or "").split())
    if name.upper().startswith("(AUTONOMOUS) ") and name.upper().count("(AUTONOMOUS)") > 1:
        name = name[len("(AUTONOMOUS) "):].strip()
    return name


def split_recruiters(value) -> List[str]:
    if not value:
        return []
    return [r.strip() for r in str(value).split(",") if r.strip()]


def build_document(college: dict) -> str:
    """Readable text used for embedding + as human-facing retrieval context."""
    parts = [
        f"{college['name']} (code {college['code']}).",
        f"Located in {college['place']}, {college['district']} district, Telangana." if college["place"]
        else f"Located in {college['district']} district, Telangana.",
        f"Affiliated to {college['university']}. {college['type']} college, {college['coEducation'].lower()}.",
    ]
    branch_names = [b["name"] for b in college["branches"]]
    if branch_names:
        parts.append("Branches offered: " + ", ".join(branch_names) + ".")
    for b in college["branches"]:
        oc = b["ranks"].get("OC|Boys")
        if oc is not None:
            parts.append(f"{b['name']} ({b['code']}) OC boys closing rank {oc}.")
    if college.get("feePerYear"):
        parts.append(f"Tuition fee {college['feePerYear']} per year, total {college.get('totalFees')}.")
    if college.get("averagePackageLpa"):
        parts.append(f"Average placement package {college['averagePackageLpa']} LPA, "
                     f"highest {college.get('highestPackageLpa')} LPA.")
    if college.get("topRecruiters"):
        parts.append("Top recruiters: " + ", ".join(college["topRecruiters"]) + ".")
    return " ".join(parts)


def normalize(data_dir: Path):
    cutoff = json.loads((data_dir / CUTOFF_FILE).read_text())
    table = json.loads((data_dir / TABLE_FILE).read_text())
    fees_by_code = {r["college_code"]: r for r in table["data"]}

    colleges: dict = {}
    branch_names: dict = {}
    branch_counter: Counter = Counter()

    for row in cutoff["data"]:
        code = row["inst_code"]
        if code not in colleges:
            dist_code = row.get("dist_code", "")
            fees = fees_by_code.get(code)
            colleges[code] = {
                "_id": code,
                "code": code,
                "name": clean_name(row.get("institute_name")),
                "place": clean_place(row.get("place")),
                "distCode": dist_code,
                "district": DISTRICT_NAMES.get(dist_code, dist_code or ""),
                "university": (row.get("affiliated_to") or "").strip() or "-",
                "type": COLLEGE_TYPES.get(row.get("college_type", ""), row.get("college_type", "")),
                "coEducation": row.get("co_education", ""),
                "feePerYear": fees.get("fee_per_year") if fees else None,
                "totalFees": fees.get("total_fees") if fees else None,
                "highestPackageLpa": fees.get("highest_package_lpa") if fees else None,
                "averagePackageLpa": fees.get("average_package_lpa") if fees else None,
                "topRecruiters": split_recruiters(fees.get("top_recruiters")) if fees else [],
                "branches": [],
            }

        bcode = row["branch_code"]
        bname = (row.get("branch_name") or "").strip()
        branch_names[bcode] = bname
        branch_counter[bcode] += 1

        ranks = {}
        for prefix, value, _label in CATEGORY_COLUMNS:
            for gender in GENDERS:
                r = clean_int(row.get(f"{prefix}_{gender.lower()}"))
                if r is not None:
                    ranks[f"{value}|{gender}"] = r
        colleges[code]["branches"].append({"code": bcode, "name": bname, "ranks": ranks})

    college_list = sorted(colleges.values(), key=lambda c: c["name"])
    for c in college_list:
        c["branches"].sort(key=lambda b: (b["ranks"].get("OC|Boys", 10**9), b["code"]))

    meta = {
        "_id": META_ID,
        "year": cutoff.get("year", 2025),
        "phase": cutoff.get("phase", "final"),
        "categories": [{"value": v, "label": l} for _p, v, l in CATEGORY_COLUMNS],
        "genders": GENDERS,
        "branches": [
            {"code": code, "name": branch_names[code], "count": count}
            for code, count in branch_counter.most_common()
        ],
        "districts": sorted({c["district"] for c in college_list if c["district"]}),
        "universities": sorted({c["university"] for c in college_list if c["university"] != "-"}),
        "collegeTypes": sorted({c["type"] for c in college_list if c["type"]}),
        "collegeCount": len(college_list),
    }
    return college_list, meta


def run(data_dir: str, drop: bool = False) -> None:
    path = Path(data_dir).resolve()
    print(f"[seed] reading source data from {path}")
    college_list, meta = normalize(path)

    embedder = get_embedder(settings.embedding_backend, settings.embedding_dim, settings.st_model)
    print(f"[seed] embedding {len(college_list)} colleges with backend='{embedder.backend}' dim={embedder.dim} ...")
    docs_text = [build_document(c) for c in college_list]
    vectors = embedder.embed_many(docs_text)
    for c, text, vec in zip(college_list, docs_text, vectors):
        c["document"] = text
        c["embedding"] = [round(float(x), 6) for x in np.asarray(vec).tolist()]

    meta["embeddingBackend"] = embedder.backend
    meta["embeddingDim"] = int(embedder.dim)

    db = get_db()
    if drop:
        db[COLLEGES].drop()
    db[COLLEGES].bulk_write(
        [UpdateOne({"_id": c["_id"]}, {"$set": c}, upsert=True) for c in college_list]
    )
    db[META].replace_one({"_id": META_ID}, meta, upsert=True)
    ensure_indexes()

    enriched = sum(1 for c in college_list if c.get("feePerYear") is not None)
    print(f"[seed] done: {len(college_list)} colleges ({enriched} with fees/placements), "
          f"{len(meta['branches'])} branches, {len(meta['districts'])} districts, "
          f"vector dim {meta['embeddingDim']}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed MongoDB for College Kurchi")
    parser.add_argument("--data-dir", default=settings.data_dir, help="folder with the source JSON files")
    parser.add_argument("--drop", action="store_true", help="drop the colleges collection first")
    args = parser.parse_args()
    run(args.data_dir, drop=args.drop)


if __name__ == "__main__":
    main()
