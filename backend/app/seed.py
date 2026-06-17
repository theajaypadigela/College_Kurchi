"""Seed MongoDB from the source JSON files.

Reads the two raw datasets, normalizes them into the `colleges` collection
(branches + per category/gender closing ranks + fees + placements), splits each
college's text `document` into overlapping **chunks**, embeds every chunk for RAG,
and writes the `meta` document used by the frontend's filters.

Robustness: each source row is normalized inside a try/except so one malformed
record is logged and skipped rather than aborting the whole load. A summary of
skipped rows is printed at the end.

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
from .logging_config import configure_logging, get_logger
from .rag.chunking import chunk_document
from .rag.embeddings import get_embedder

logger = get_logger("seed")

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

# Categories surfaced verbosely in the embedded document so chunks carry the
# closing ranks most queries ask about.
_DOC_RANK_KEYS = ["OC|Boys", "OC|Girls", "BC_B|Boys", "SC_1|Boys"]


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
    """Readable text used for chunking + embedding + as human-facing context.

    Kept fact-dense and multi-section (overview, branches, per-branch cutoffs,
    fees, placements) so the chunker produces several distinct, retrievable
    passages per college.
    """
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
        ranks = b["ranks"]
        bits = []
        for key in _DOC_RANK_KEYS:
            r = ranks.get(key)
            if r is not None:
                cat, gen = key.split("|")
                bits.append(f"{cat} {gen.lower()} {r}")
        if bits:
            parts.append(f"{b['name']} ({b['code']}) closing ranks: " + ", ".join(bits) + ".")
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
    fees_by_code = {r.get("college_code"): r for r in table.get("data", []) if r.get("college_code")}

    colleges: dict = {}
    branch_names: dict = {}
    branch_counter: Counter = Counter()
    skipped = 0

    for i, row in enumerate(cutoff.get("data", [])):
        try:
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
        except (KeyError, TypeError, ValueError) as exc:
            skipped += 1
            logger.warning("skipping malformed cutoff row %d (%s): %s", i, exc, _row_preview(row))

    if skipped:
        logger.warning("normalize: skipped %d malformed row(s) of %d", skipped, len(cutoff.get("data", [])))

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


def _row_preview(row) -> str:
    try:
        return json.dumps({k: row.get(k) for k in ("inst_code", "branch_code")}, ensure_ascii=False)
    except Exception:  # noqa: BLE001
        return "<unprintable row>"


def _round_vec(vec) -> List[float]:
    return [round(float(x), 6) for x in np.asarray(vec).tolist()]


def run(data_dir: str, drop: bool = False) -> dict:
    path = Path(data_dir).resolve()
    logger.info("reading source data from %s", path)
    college_list, meta = normalize(path)

    embedder = get_embedder(settings.embedding_backend, settings.embedding_dim, settings.st_model)
    logger.info(
        "chunking + embedding %d colleges (backend=%s, dim=%d, chunk=%d/%d words) ...",
        len(college_list), embedder.backend, embedder.dim,
        settings.chunk_max_words, settings.chunk_overlap_words,
    )

    # Build documents, chunk them, then embed all chunks in one batched call.
    docs_text = [build_document(c) for c in college_list]
    per_college_chunks = [
        chunk_document(text, settings.chunk_max_words, settings.chunk_overlap_words)
        for text in docs_text
    ]
    flat_texts = [ch.text for chunks in per_college_chunks for ch in chunks]
    flat_vecs = embedder.embed_many(flat_texts)

    cursor = 0
    total_chunks = 0
    for c, text, chunks in zip(college_list, docs_text, per_college_chunks):
        c["document"] = text
        chunk_vecs = []
        records = []
        for ch in chunks:
            vec = flat_vecs[cursor]
            cursor += 1
            records.append({"text": ch.text, "index": ch.index, "embedding": _round_vec(vec)})
            chunk_vecs.append(np.asarray(vec, dtype=np.float32))
        c["chunks"] = records
        total_chunks += len(records)
        # Per-college embedding = normalized mean of its chunk vectors (kept for
        # backward-compatible single-vector consumers / fallback).
        if chunk_vecs:
            mean = np.mean(np.vstack(chunk_vecs), axis=0)
            norm = float(np.linalg.norm(mean))
            c["embedding"] = _round_vec(mean / norm if norm > 0 else mean)
        else:
            c["embedding"] = _round_vec(embedder.embed(text))

    meta["embeddingBackend"] = embedder.backend
    meta["embeddingDim"] = int(embedder.dim)
    meta["chunkMaxWords"] = settings.chunk_max_words
    meta["chunkOverlapWords"] = settings.chunk_overlap_words
    meta["chunkCount"] = total_chunks

    db = get_db()
    if drop:
        db[COLLEGES].drop()
    db[COLLEGES].bulk_write(
        [UpdateOne({"_id": c["_id"]}, {"$set": c}, upsert=True) for c in college_list]
    )
    db[META].replace_one({"_id": META_ID}, meta, upsert=True)
    ensure_indexes()

    enriched = sum(1 for c in college_list if c.get("feePerYear") is not None)
    logger.info(
        "done: %d colleges (%d with fees/placements), %d branches, %d districts, "
        "%d chunks, vector dim %d.",
        len(college_list), enriched, len(meta["branches"]), len(meta["districts"]),
        total_chunks, meta["embeddingDim"],
    )
    return meta


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Seed MongoDB for College Kurchi")
    parser.add_argument("--data-dir", default=settings.data_dir, help="folder with the source JSON files")
    parser.add_argument("--drop", action="store_true", help="drop the colleges collection first")
    args = parser.parse_args()
    run(args.data_dir, drop=args.drop)


if __name__ == "__main__":
    main()
