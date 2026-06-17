from __future__ import annotations

from fastapi import APIRouter

from ..models import PredictRequest, PredictResponse
from ..services.predictor import predict

router = APIRouter(tags=["predictor"])


@router.post("/predict", response_model=PredictResponse)
def post_predict(req: PredictRequest) -> PredictResponse:
    return predict(req)
