from __future__ import annotations

from fastapi import APIRouter

from ..models import CompareRequest, CompareResponse
from ..services.comparison import compare

router = APIRouter(tags=["comparison"])


@router.post("/compare", response_model=CompareResponse)
def post_compare(req: CompareRequest) -> CompareResponse:
    return compare(req)
