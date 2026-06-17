"""Shared pytest fixtures.

The whole suite runs against an in-memory MongoDB (mongomock) seeded through the
*real* `app.seed.run` path, so seeding + chunking + embedding + indexing are
exercised end-to-end without a live mongod or any network/LLM calls.
"""
from __future__ import annotations

import json
from pathlib import Path

import mongomock
import mongomock.collection as _mmc
import pytest
from fastapi.testclient import TestClient

# ── mongomock ↔ pymongo compatibility shim ─────────────────────────────────────
# pymongo >= 4.10 passes a `sort` kwarg to the bulk builder's add_update, which
# mongomock 4.3.0 doesn't accept. Swallow it (and any future extras) so
# bulk_write(UpdateOne(...)) works under the mock. Test-only; prod code untouched.
_orig_add_update = _mmc.BulkOperationBuilder.add_update


def _compat_add_update(self, selector, doc, multi=False, upsert=False, collation=None,
                       array_filters=None, hint=None, **_ignored):
    return _orig_add_update(self, selector, doc, multi=multi, upsert=upsert,
                            collation=collation, array_filters=array_filters, hint=hint)


_mmc.BulkOperationBuilder.add_update = _compat_add_update

from app import db as db_mod  # noqa: E402
from app import main as main_mod
from app import seed as seed_mod
from app.config import settings
from app.rag import index as index_mod
from app.rag.llm import get_llm

# ── Tiny but realistic source dataset ──────────────────────────────────────────
# Three colleges, two branches each, mirroring the real source JSON column names.
_CUTOFF = {
    "year": 2025,
    "phase": "final",
    "data": [
        # CBIT (Ranga Reddy)
        {"inst_code": "CBIT", "institute_name": "CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY",
         "place": "GANDIPET", "dist_code": "RR", "affiliated_to": "OU", "college_type": "PVT",
         "co_education": "COED", "branch_code": "CSE", "branch_name": "COMPUTER SCIENCE AND ENGINEERING",
         "oc_boys": 2053, "oc_girls": 2089, "bcb_boys": 4120, "sc1_boys": 30000, "ews_boys": 2500},
        {"inst_code": "CBIT", "institute_name": "CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY",
         "place": "GANDIPET", "dist_code": "RR", "affiliated_to": "OU", "college_type": "PVT",
         "co_education": "COED", "branch_code": "ECE", "branch_name": "ELECTRONICS AND COMMUNICATION ENGINEERING",
         "oc_boys": 8000, "oc_girls": 8200, "bcb_boys": 11000},
        # VASAVI (Hyderabad)
        {"inst_code": "VASA", "institute_name": "VASAVI COLLEGE OF ENGINEERING",
         "place": "IBRAHIMBAGH", "dist_code": "HYD", "affiliated_to": "OU", "college_type": "PVT",
         "co_education": "COED", "branch_code": "CSE", "branch_name": "COMPUTER SCIENCE AND ENGINEERING",
         "oc_boys": 3500, "oc_girls": 3600, "bcb_boys": 6000},
        {"inst_code": "VASA", "institute_name": "VASAVI COLLEGE OF ENGINEERING",
         "place": "IBRAHIMBAGH", "dist_code": "HYD", "affiliated_to": "OU", "college_type": "PVT",
         "co_education": "COED", "branch_code": "ECE", "branch_name": "ELECTRONICS AND COMMUNICATION ENGINEERING",
         "oc_boys": 12000, "oc_girls": 12500},
        # MGIT (Hyderabad)
        {"inst_code": "MGIT", "institute_name": "MAHATMA GANDHI INSTITUTE OF TECHNOLOGY",
         "place": "GANDIPET", "dist_code": "HYD", "affiliated_to": "JNTUH", "college_type": "PVT",
         "co_education": "COED", "branch_code": "CSE", "branch_name": "COMPUTER SCIENCE AND ENGINEERING",
         "oc_boys": 6000, "oc_girls": 6100, "bcb_boys": 9000},
        {"inst_code": "MGIT", "institute_name": "MAHATMA GANDHI INSTITUTE OF TECHNOLOGY",
         "place": "GANDIPET", "dist_code": "HYD", "affiliated_to": "JNTUH", "college_type": "PVT",
         "co_education": "COED", "branch_code": "ECE", "branch_name": "ELECTRONICS AND COMMUNICATION ENGINEERING",
         "oc_boys": 15000},
    ],
}

_TABLE = {
    "data": [
        {"college_code": "CBIT", "fee_per_year": 183000, "total_fees": 732000,
         "highest_package_lpa": 41.0, "average_package_lpa": 9.9,
         "top_recruiters": "Microsoft, Amazon, TCS, Infosys"},
        {"college_code": "VASA", "fee_per_year": 140000, "total_fees": 560000,
         "highest_package_lpa": 38.0, "average_package_lpa": 8.5,
         "top_recruiters": "Google, Deloitte, Wipro"},
        # MGIT intentionally has no fees/placement row → exercises the null path.
    ],
}


@pytest.fixture(autouse=True)
def _no_llm():
    """Force the template (non-LLM) path for every test so the suite is hermetic
    and deterministic — never depends on a GROQ_API_KEY in the developer's .env
    or makes a network call."""
    original = settings.groq_api_key
    settings.groq_api_key = ""
    get_llm.cache_clear()
    yield
    settings.groq_api_key = original
    get_llm.cache_clear()


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    (tmp_path / seed_mod.CUTOFF_FILE).write_text(json.dumps(_CUTOFF))
    (tmp_path / seed_mod.TABLE_FILE).write_text(json.dumps(_TABLE))
    return tmp_path


@pytest.fixture
def seeded_db(data_dir: Path):
    """Point the app at a fresh mongomock client and seed it via app.seed.run."""
    db_mod._client = mongomock.MongoClient()
    index_mod._index = None
    get_llm.cache_clear()

    seed_mod.run(str(data_dir), drop=True)
    index_mod.build_index()

    yield db_mod.get_db()

    index_mod._index = None
    db_mod._client = None
    get_llm.cache_clear()


@pytest.fixture
def index(seeded_db):
    return index_mod.get_index()


@pytest.fixture
def client(seeded_db, monkeypatch):
    """FastAPI TestClient. mongomock doesn't implement the admin `ping` command,
    so we treat Mongo as reachable; the index is already built from seeded_db."""
    monkeypatch.setattr(main_mod, "ping", lambda: True)
    with TestClient(main_mod.app) as c:
        yield c
