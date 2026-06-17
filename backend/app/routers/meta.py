from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import META, META_ID, get_db
from ..models import Meta

router = APIRouter(tags=["meta"])


@router.get("/meta", response_model=Meta)
def get_meta() -> Meta:
    doc = get_db()[META].find_one({"_id": META_ID})
    if not doc:
        raise HTTPException(status_code=503, detail="Data not seeded. Run: python -m app.seed")
    doc.pop("_id", None)
    return Meta(**doc)
