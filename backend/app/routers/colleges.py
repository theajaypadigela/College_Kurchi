from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from ..models import College, CutoffRow
from ..services import colleges as svc

router = APIRouter(tags=["colleges"])


@router.get("/colleges", response_model=List[College])
def list_colleges(
    q: Optional[str] = None,
    branch: Optional[str] = None,
    district: Optional[str] = None,
    type: Optional[str] = Query(None),
    university: Optional[str] = None,
    minFee: Optional[int] = None,
    maxFee: Optional[int] = None,
    minAvgPackage: Optional[float] = None,
    codes: Optional[str] = Query(None, description="comma-separated college codes"),
    sort: Optional[str] = Query(None, description="name | fee | package"),
    limit: Optional[int] = None,
) -> List[dict]:
    code_list = [c.strip().upper() for c in codes.split(",") if c.strip()] if codes else None
    return svc.list_colleges(
        q=q, branch=branch, district=district, type_=type, university=university,
        min_fee=minFee, max_fee=maxFee, min_avg_package=minAvgPackage,
        codes=code_list, sort=sort, limit=limit,
    )


@router.get("/cutoffs", response_model=List[CutoffRow])
def list_cutoffs(
    branch: Optional[str] = None,
    category: str = "OC",
    gender: str = "Boys",
    district: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 400,
) -> List[dict]:
    return svc.list_cutoffs(
        branch=branch, category=category, gender=gender, district=district, q=q, limit=limit
    )


@router.get("/colleges/{code}", response_model=College)
def get_college(code: str) -> dict:
    doc = svc.get_college(code)
    if not doc:
        raise HTTPException(status_code=404, detail=f"College '{code}' not found")
    return doc
