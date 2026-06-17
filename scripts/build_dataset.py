"""
Build the normalized frontend dataset for College Kurchi.

Joins the two real source files:
  - TGEAPCET_2025_FINALPHASE_LASTRANKS.json  (branch-wise last ranks, the master
    list of colleges + branches + per category/gender closing ranks for 2025)
  - table-eapcet.json                         (per-college fees + placements)

Output:
  - college-kurchi/src/data/eamcet.json       (consumed by src/data/collegeData.ts)

The cutoff file is treated as the master source of colleges and branches.
Fees/placements are merged in by college code where available.

Usage:
    python3 build_dataset.py
"""

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CUTOFF_FILE = ROOT / "TGEAPCET_2025_FINALPHASE_LASTRANKS.json"
TABLE_FILE = ROOT / "table-eapcet.json"
OUT_FILE = ROOT / "college-kurchi" / "src" / "data" / "eamcet.json"

# ── Telangana district codes -> readable names ────────────────────────────────
DISTRICT_NAMES = {
    "HNK": "Hanumakonda",
    "HYD": "Hyderabad",
    "JTL": "Jagtial",
    "KGM": "Bhadradri Kothagudem",
    "KHM": "Khammam",
    "KMR": "Kamareddy",
    "KRM": "Karimnagar",
    "MBN": "Mahabubnagar",
    "MDL": "Medchal-Malkajgiri",
    "MED": "Medak",
    "MHB": "Mahabubabad",
    "NLG": "Nalgonda",
    "NPT": "Narayanpet",
    "NZB": "Nizamabad",
    "PDL": "Peddapalli",
    "RR": "Ranga Reddy",
    "SDP": "Siddipet",
    "SRC": "Rajanna Sircilla",
    "SRD": "Sangareddy",
    "SRP": "Suryapet",
    "WGL": "Warangal",
    "WNP": "Wanaparthy",
    "YBG": "Yadadri Bhuvanagiri",
}

# ── college_type codes -> readable labels ─────────────────────────────────────
COLLEGE_TYPES = {
    "GOV": "Government",
    "PVT": "Private",
    "SF": "Self-Finance",
    "UNIV": "University",
}

# ── category column prefixes -> (value, label) used across the UI ─────────────
# Each category reads from "<prefix>_boys" / "<prefix>_girls" columns.
CATEGORY_COLUMNS = [
    ("oc", "OC", "OC"),
    ("ews", "EWS", "EWS"),
    ("bca", "BC_A", "BC-A"),
    ("bcb", "BC_B", "BC-B"),
    ("bcc", "BC_C", "BC-C"),
    ("bcd", "BC_D", "BC-D"),
    ("bce", "BC_E", "BC-E"),
    ("sc1", "SC_1", "SC-1"),
    ("sc2", "SC_2", "SC-2"),
    ("sc3", "SC_3", "SC-3"),
    ("st", "ST", "ST"),
]

GENDERS = ["Boys", "Girls"]


def clean_int(value):
    """Coerce a cell to a positive int, or None when missing/blank/zero."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value) if value > 0 else None
    s = str(value).strip().replace(",", "")
    if not s or not s.lstrip("-").isdigit():
        return None
    n = int(s)
    return n if n > 0 else None


def clean_place(value):
    """Source places sometimes contain stray spaces from PDF extraction."""
    if not value:
        return ""
    return " ".join(str(value).split())


def clean_name(value):
    """Tidy institute names from PDF extraction (stray spaces, duplicated
    leading '(AUTONOMOUS)' tokens)."""
    name = " ".join(str(value or "").split())
    if name.upper().startswith("(AUTONOMOUS) ") and name.upper().count("(AUTONOMOUS)") > 1:
        name = name[len("(AUTONOMOUS) "):].strip()
    return name


def split_recruiters(value):
    if not value:
        return []
    return [r.strip() for r in str(value).split(",") if r.strip()]


def main():
    cutoff = json.loads(CUTOFF_FILE.read_text())
    table = json.loads(TABLE_FILE.read_text())

    # Index fees/placements by college code.
    fees_by_code = {row["college_code"]: row for row in table["data"]}

    # Group cutoff rows by college code (each row is one branch).
    colleges = {}
    branch_name_by_code = {}
    branch_counter = Counter()

    for row in cutoff["data"]:
        code = row["inst_code"]
        if code not in colleges:
            dist_code = row.get("dist_code", "")
            university = (row.get("affiliated_to") or "").strip() or "—"
            fees = fees_by_code.get(code)
            colleges[code] = {
                "id": code.lower(),
                "code": code,
                "name": clean_name(row.get("institute_name")),
                "place": clean_place(row.get("place")),
                "distCode": dist_code,
                "district": DISTRICT_NAMES.get(dist_code, dist_code or "—"),
                "university": university,
                "type": COLLEGE_TYPES.get(row.get("college_type", ""), row.get("college_type", "")),
                "coEducation": row.get("co_education", ""),
                "feePerYear": fees.get("fee_per_year") if fees else None,
                "totalFees": fees.get("total_fees") if fees else None,
                "highestPackageLpa": fees.get("highest_package_lpa") if fees else None,
                "averagePackageLpa": fees.get("average_package_lpa") if fees else None,
                "topRecruiters": split_recruiters(fees.get("top_recruiters")) if fees else [],
                "branches": [],
            }

        branch_code = row["branch_code"]
        branch_name = (row.get("branch_name") or "").strip()
        branch_name_by_code[branch_code] = branch_name
        branch_counter[branch_code] += 1

        ranks = {}
        for prefix, value, _label in CATEGORY_COLUMNS:
            for gender in GENDERS:
                col = f"{prefix}_{gender.lower()}"
                rank = clean_int(row.get(col))
                if rank is not None:
                    ranks[f"{value}|{gender}"] = rank

        colleges[code]["branches"].append(
            {
                "code": branch_code,
                "name": branch_name,
                "ranks": ranks,
            }
        )

    college_list = sorted(colleges.values(), key=lambda c: c["name"])

    # Sort branches within each college by their best (lowest) OC Boys rank, then code.
    for c in college_list:
        c["branches"].sort(
            key=lambda b: (b["ranks"].get("OC|Boys", 10**9), b["code"])
        )

    branches = [
        {"code": code, "name": branch_name_by_code[code], "count": count}
        for code, count in branch_counter.most_common()
    ]

    districts = sorted(
        {c["district"] for c in college_list if c["district"] and c["district"] != "—"}
    )
    universities = sorted({c["university"] for c in college_list if c["university"] != "—"})
    college_types = sorted({c["type"] for c in college_list if c["type"]})

    categories = [{"value": value, "label": label} for _p, value, label in CATEGORY_COLUMNS]

    enriched = sum(1 for c in college_list if c["feePerYear"] is not None)

    out = {
        "year": cutoff.get("year", 2025),
        "phase": cutoff.get("phase", "final"),
        "source": {
            "cutoffs": CUTOFF_FILE.name,
            "feesPlacements": TABLE_FILE.name,
        },
        "categories": categories,
        "genders": GENDERS,
        "branches": branches,
        "districts": districts,
        "universities": universities,
        "collegeTypes": college_types,
        "colleges": college_list,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2))

    print(f"Wrote {OUT_FILE.relative_to(ROOT)}")
    print(f"  colleges          : {len(college_list)}")
    print(f"  with fees/placement: {enriched}")
    print(f"  distinct branches : {len(branches)}")
    print(f"  distinct districts: {len(districts)}")
    print(f"  categories        : {len(categories)} x {len(GENDERS)} genders")
    total_branch_rows = sum(len(c['branches']) for c in college_list)
    print(f"  branch rows       : {total_branch_rows}")


if __name__ == "__main__":
    main()
