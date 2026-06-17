"""MongoDB connection helpers (PyMongo, sync — FastAPI runs route handlers in a
threadpool, which keeps this simple and robust for a small dataset)."""
from __future__ import annotations

from typing import Optional

from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from .config import settings

_client: Optional[MongoClient] = None

COLLEGES = "colleges"
META = "meta"
META_ID = "meta"
USERS = "users"


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    return _client


def get_db() -> Database:
    return get_client()[settings.db_name]


def ping() -> bool:
    """Return True if MongoDB is reachable."""
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False


def ensure_indexes() -> None:
    db = get_db()
    col = db[COLLEGES]
    col.create_index([("district", ASCENDING)])
    col.create_index([("type", ASCENDING)])
    col.create_index([("university", ASCENDING)])
    col.create_index([("branches.code", ASCENDING)])
    col.create_index([("name", ASCENDING)])
    db[USERS].create_index([("email", ASCENDING)], unique=True)
