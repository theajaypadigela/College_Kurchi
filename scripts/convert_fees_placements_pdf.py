"""
Convert EAPCET college fees & placements PDF to JSON.

Usage:
    python3 convert_fees_placements_pdf.py                    # process all matching PDFs
    python3 convert_fees_placements_pdf.py table-eapcet.pdf   # specific file

Output columns per record:
    college_code, college_name, location,
    cutoff_rank_oc, fee_per_year, total_fees,
    highest_package_lpa, average_package_lpa,
    top_recruiters
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pdfplumber

# ── Column x-boundaries (from word-position analysis) ─────────────────────────
# Each entry: col_name -> (x_min, x_max)
COL_BOUNDS = {
    "college_code":         (0,    50),
    "college_name":         (50,   295),
    "location":             (295,  425),
    "cutoff_rank_oc":       (425,  510),
    "fee_per_year":         (510,  565),
    "total_fees":           (565,  650),
    "highest_package_lpa":  (650,  720),
    "average_package_lpa":  (720,  800),
    "top_recruiters":       (800,  9999),
}

HEADER_Y_CUTOFF = 45   # ignore header rows above this y-coordinate
Y_TOLERANCE = 3        # words within 3pt of each other are on the same line


# ── Helpers ───────────────────────────────────────────────────────────────────

def _col_for(x):
    for name, (lo, hi) in COL_BOUNDS.items():
        if lo <= x < hi:
            return name
    return None


def _is_code(text):
    """College codes are 3–5 uppercase letters."""
    return bool(re.match(r"^[A-Z]{3,5}$", text))


def _group_rows(words):
    """Group word dicts into lines by proximity of their top-y coordinate."""
    buckets = {}
    for w in words:
        key = round(w["top"] / Y_TOLERANCE) * Y_TOLERANCE
        buckets.setdefault(key, []).append(w)
    return sorted(buckets.items())          # [(y, [words…]), …]


def _parse_int(s):
    if not s:
        return None
    try:
        return int(s.replace(",", ""))
    except ValueError:
        return None


def _parse_float(s):
    if not s:
        return None
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


# ── Core parsing ──────────────────────────────────────────────────────────────

def _build_records(words):
    rows = _group_rows(words)
    # Drop header rows
    rows = [(y, ws) for y, ws in rows if y > HEADER_Y_CUTOFF]

    # Identify rows that contain a college code at x < 50
    code_indices = [
        i for i, (_, ws) in enumerate(rows)
        if any(w["x0"] < 50 and _is_code(w["text"]) for w in ws)
    ]

    records = []
    for rank, ci in enumerate(code_indices):
        code_y = rows[ci][0]

        # y boundaries: midpoint between adjacent code rows
        prev_y = rows[code_indices[rank - 1]][0] if rank > 0 else 0
        next_y = rows[code_indices[rank + 1]][0] if rank < len(code_indices) - 1 else float("inf")
        y_lo = (prev_y + code_y) / 2 if rank > 0 else 0
        y_hi = (code_y + next_y) / 2 if rank < len(code_indices) - 1 else float("inf")

        # Collect all words within this record's y range
        col_words = defaultdict(list)
        for y, ws in rows:
            if y_lo < y <= y_hi:
                for w in ws:
                    col = _col_for(w["x0"])
                    if col:
                        col_words[col].append(w["text"])

        def _join(col):
            txt = " ".join(col_words.get(col, [])).strip()
            return txt if txt else None

        records.append({
            "college_code":         _join("college_code"),
            "college_name":         _join("college_name"),
            "location":             _join("location"),
            "cutoff_rank_oc":       _parse_int(_join("cutoff_rank_oc")),
            "fee_per_year":         _parse_int(_join("fee_per_year")),
            "total_fees":           _parse_int(_join("total_fees")),
            "highest_package_lpa":  _parse_float(_join("highest_package_lpa")),
            "average_package_lpa":  _parse_float(_join("average_package_lpa")),
            "top_recruiters":       _join("top_recruiters"),
        })

    return records


# ── Main conversion ───────────────────────────────────────────────────────────

def convert(pdf_path, output_path=None):
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        print(f"ERROR: {pdf_path} not found")
        return None

    if output_path is None:
        output_path = pdf_path.with_suffix(".json")

    print(f"\nConverting: {pdf_path.name}")

    all_words = []
    with pdfplumber.open(pdf_path) as pdf:
        print(f"  Pages: {len(pdf.pages)}")
        for page in pdf.pages:
            all_words.extend(page.extract_words(keep_blank_chars=False))

    records = _build_records(all_words)
    print(f"  Extracted {len(records)} records")

    output = {
        "source_file": pdf_path.name,
        "total_records": len(records),
        "columns": list(COL_BOUNDS.keys()),
        "data": records,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  Saved → {output_path}\n")
    return output_path


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(Path(".").glob("*.pdf"))
    # Only pick up fees/placements PDFs when running without args
    if not sys.argv[1:]:
        targets = [p for p in targets if "eapcet" in p.name.lower() or "fee" in p.name.lower() or "placement" in p.name.lower()]

    if not targets:
        print("No matching PDF files found.")
        sys.exit(1)

    for t in targets:
        convert(t)
