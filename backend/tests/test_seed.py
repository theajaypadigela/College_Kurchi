"""Tests for data preparation: cleaning helpers, document building, and the
row-skipping resilience of normalize()."""
from __future__ import annotations

import json

from app.rag.chunking import chunk_document
from app.seed import (
    build_document,
    clean_int,
    clean_name,
    clean_place,
    normalize,
    split_recruiters,
)


def test_clean_int_variants():
    assert clean_int("1,234") == 1234
    assert clean_int(2053) == 2053
    assert clean_int("0") is None      # zero treated as missing
    assert clean_int("") is None
    assert clean_int(None) is None
    assert clean_int("abc") is None


def test_clean_place_collapses_whitespace():
    assert clean_place("  GANDI   PET ") == "GANDI PET"
    assert clean_place(None) == ""


def test_clean_name_dedupes_autonomous_prefix():
    assert clean_name("(AUTONOMOUS)  CBIT (AUTONOMOUS)") == "CBIT (AUTONOMOUS)"
    assert clean_name("  Vasavi   College ") == "Vasavi College"


def test_split_recruiters():
    assert split_recruiters("Microsoft, Amazon ,TCS") == ["Microsoft", "Amazon", "TCS"]
    assert split_recruiters(None) == []


def test_build_document_is_multi_section_and_chunkable():
    college = {
        "name": "TEST COLLEGE", "code": "TEST", "place": "PLACE", "district": "Hyderabad",
        "university": "OU", "type": "Private", "coEducation": "COED",
        "feePerYear": 100000, "totalFees": 400000,
        "averagePackageLpa": 8.0, "highestPackageLpa": 20.0,
        "topRecruiters": ["A", "B"],
        "branches": [
            {"code": "CSE", "name": "COMPUTER SCIENCE", "ranks": {"OC|Boys": 1000, "OC|Girls": 1100}},
            {"code": "ECE", "name": "ELECTRONICS", "ranks": {"OC|Boys": 5000}},
        ],
    }
    doc = build_document(college)
    assert "TEST COLLEGE" in doc and "CSE" in doc and "recruiters" in doc.lower()
    # Rich enough to produce more than one chunk under the default budget.
    chunks = chunk_document(doc, max_words=20, overlap_words=5)
    assert len(chunks) >= 2


def test_normalize_skips_malformed_rows(tmp_path):
    cutoff = {
        "year": 2025, "phase": "final",
        "data": [
            {"inst_code": "AAA", "institute_name": "ALPHA", "dist_code": "HYD",
             "branch_code": "CSE", "branch_name": "CSE", "oc_boys": 1000},
            {"institute_name": "NO CODE", "branch_code": "CSE"},  # missing inst_code → skipped
        ],
    }
    (tmp_path / "TGEAPCET_2025_FINALPHASE_LASTRANKS.json").write_text(json.dumps(cutoff))
    (tmp_path / "table-eapcet.json").write_text(json.dumps({"data": []}))

    college_list, meta = normalize(tmp_path)
    assert len(college_list) == 1
    assert college_list[0]["code"] == "AAA"
    assert meta["collegeCount"] == 1


def test_normalize_handles_missing_fees_gracefully(data_dir):
    college_list, meta = normalize(data_dir)
    by_code = {c["code"]: c for c in college_list}
    # MGIT has no fees/placement row in the fixture → null fields, empty recruiters.
    assert by_code["MGIT"]["feePerYear"] is None
    assert by_code["MGIT"]["topRecruiters"] == []
    assert by_code["CBIT"]["feePerYear"] == 183000
    assert meta["collegeCount"] == 3
