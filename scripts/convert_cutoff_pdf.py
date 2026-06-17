"""
Convert TGEAPCET/EAPCET cutoff rank PDFs to JSON.

Usage:
    python3 convert_cutoff_pdf.py                        # process all PDFs in current directory
    python3 convert_cutoff_pdf.py file1.pdf file2.pdf    # process specific files

Output JSON structure per record:
    inst_code, institute_name, place, dist_code, co_education, college_type,
    branch_code, branch_name, + one field per category (oc_boys, oc_girls,
    bca_boys, bca_girls, bcb_boys, bcb_girls, bcc_boys, bcc_girls,
    bcd_boys, bcd_girls, bce_boys, bce_girls, sc1_boys, sc1_girls,
    sc2_boys, sc2_girls, sc3_boys, sc3_girls, st_boys, st_girls,
    ews_boys, ews_girls, affiliated_to)
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

# ── Column definitions ────────────────────────────────────────────────────────
# The PDF has a 2-row header; we flatten it into these snake_case keys.
# Order must match the PDF column order exactly.
COLUMNS = [
    "inst_code",
    "institute_name",
    "place",
    "dist_code",
    "co_education",
    "college_type",
    "branch_code",
    "branch_name",
    "oc_boys",
    "oc_girls",
    "bca_boys",
    "bca_girls",
    "bcb_boys",
    "bcb_girls",
    "bcc_boys",
    "bcc_girls",
    "bcd_boys",
    "bcd_girls",
    "bce_boys",
    "bce_girls",
    "sc1_boys",
    "sc1_girls",
    "sc2_boys",
    "sc2_girls",
    "sc3_boys",
    "sc3_girls",
    "st_boys",
    "st_girls",
    "ews_boys",
    "ews_girls",
    "affiliated_to",
]

RANK_COLUMNS = {c for c in COLUMNS if c.endswith("_boys") or c.endswith("_girls")}

# Tokens that indicate a header row (not data)
HEADER_TOKENS = {
    "inst", "inst code", "code", "institute name", "place", "dist", "dist code",
    "branch", "branch name", "branch code", "boys", "girls", "oc", "bca", "bcb",
    "bcc", "bcd", "bce", "sc", "sc.i", "sc.ii", "sc.iii", "st", "ews",
    "co", "co education", "college", "college type", "affiliated", "affiliated to",
    "education", "type",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean(val):
    if val is None:
        return None
    return " ".join(str(val).split())  # collapse whitespace


def _parse_rank(val):
    if val is None:
        return None
    s = str(val).strip().replace(",", "")
    if s in ("", "-", "NA", "N/A", "NIL", "0"):
        return None
    try:
        n = int(s)
        return n if n > 0 else None
    except ValueError:
        return None


def _is_header_row(row):
    """Return True if this row looks like a column-header row (not data)."""
    first = _clean(row[0]) if row else ""
    if not first:
        return True
    if first.lower() in HEADER_TOKENS:
        return True
    # Header rows often have many None/empty cells at the start
    non_empty = sum(1 for c in row if _clean(c))
    if non_empty < 3:
        return True
    return False


def _row_to_record(raw_row):
    """Map a raw list of cell values → dict using COLUMNS."""
    # Pad short rows; trim oversized ones
    row = list(raw_row)
    while len(row) < len(COLUMNS):
        row.append(None)
    row = row[: len(COLUMNS)]

    record = {}
    for col, val in zip(COLUMNS, row):
        cleaned = _clean(val)
        if col in RANK_COLUMNS:
            record[col] = _parse_rank(cleaned)
        else:
            record[col] = cleaned if cleaned else None
    return record


def _extract_year(name):
    m = re.search(r"(20\d{2})", name)
    return int(m.group(1)) if m else None


def _extract_phase(name):
    n = name.upper()
    if "FINAL" in n:
        return "final"
    for tag, label in (("PHASE1", "phase1"), ("1STPHASE", "phase1"),
                       ("PHASE2", "phase2"), ("2NDPHASE", "phase2"),
                       ("PHASE3", "phase3"), ("3RDPHASE", "phase3")):
        if tag in n.replace("_", "").replace("-", "").replace(" ", ""):
            return label
    return "unknown"


# ── Core extraction ───────────────────────────────────────────────────────────

def extract_records(pdf_path):
    """Return a list of record dicts extracted from every page of the PDF."""
    records = []
    skipped = 0

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"  Page {page_num}/{total_pages} …", end="\r", flush=True)

            # Use tighter vertical tolerance to avoid row merging
            tables = page.extract_tables(
                table_settings={
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "intersection_tolerance": 5,
                }
            )

            if not tables:
                # Fallback: looser strategy for pages without clear grid lines
                tables = page.extract_tables(
                    table_settings={
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 3,
                    }
                )

            for table in tables:
                for row in table:
                    if _is_header_row(row):
                        skipped += 1
                        continue
                    record = _row_to_record(row)
                    inst = record.get("inst_code")
                    if inst and len(inst) >= 2 and inst.isalnum():
                        records.append(record)
                    else:
                        skipped += 1

    print(f"  Extracted {len(records)} records  ({skipped} header/blank rows skipped)")
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
    records = extract_records(pdf_path)

    output = {
        "source_file": pdf_path.name,
        "year": _extract_year(pdf_path.name),
        "phase": _extract_phase(pdf_path.name),
        "total_records": len(records),
        "columns": COLUMNS,
        "data": records,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  Saved → {output_path}\n")
    return output_path


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(Path(".").glob("*.pdf"))

    if not targets:
        print("No PDF files found.")
        sys.exit(1)

    for t in targets:
        convert(t)
