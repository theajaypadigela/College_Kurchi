from __future__ import annotations

from fastapi import APIRouter

from ..models import RecommendationRequest, RecommendationResponse
from ..services.recommendations import recommend

router = APIRouter(tags=["recommendations"])


@router.post("/recommendations", response_model=RecommendationResponse)
def post_recommendations(req: RecommendationRequest) -> RecommendationResponse:
    return recommend(req)
