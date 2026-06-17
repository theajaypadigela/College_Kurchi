from __future__ import annotations

from fastapi import APIRouter

from ..models import ChatRequest, ChatResponse
from ..rag.counselor import chat

router = APIRouter(tags=["counselor"])


@router.post("/counselor/chat", response_model=ChatResponse)
def post_chat(req: ChatRequest) -> ChatResponse:
    result = chat(
        req.message,
        history=req.history,
        user_rank=req.userRank,
        user_category=req.userCategory,
        user_gender=req.userGender,
    )
    return ChatResponse(**result)
