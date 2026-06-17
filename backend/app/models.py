"""Pydantic request/response schemas shared by the routers."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ── Core domain ───────────────────────────────────────────────────────────────
class Branch(BaseModel):
    code: str
    name: str
    ranks: Dict[str, int] = Field(default_factory=dict)  # "OC|Boys" -> closing rank


class College(BaseModel):
    code: str
    name: str
    place: str = ""
    district: str = ""
    distCode: str = ""
    university: str = ""
    type: str = ""
    coEducation: str = ""
    feePerYear: Optional[int] = None
    totalFees: Optional[int] = None
    highestPackageLpa: Optional[float] = None
    averagePackageLpa: Optional[float] = None
    topRecruiters: List[str] = Field(default_factory=list)
    branches: List[Branch] = Field(default_factory=list)


class Category(BaseModel):
    value: str
    label: str


class BranchInfo(BaseModel):
    code: str
    name: str
    count: int


class Meta(BaseModel):
    year: int
    phase: str
    categories: List[Category]
    genders: List[str]
    branches: List[BranchInfo]
    districts: List[str]
    universities: List[str]
    collegeTypes: List[str]
    collegeCount: int
    embeddingBackend: str = "hashing"
    embeddingDim: int = 512


# ── Cutoffs ─────────────────────────────────────────────────────────────────--
class CutoffRow(BaseModel):
    collegeCode: str
    collegeName: str
    district: str
    university: str
    type: str
    branchCode: str
    branchName: str
    closingRank: int


# ── Recommendations ─────────────────────────────────────────────────────────--
class RecommendationRequest(BaseModel):
    rank: int = Field(gt=0)
    category: str = "OC"
    gender: str = "Boys"
    branch: str = "CSE"
    location: Optional[str] = None
    maxFee: Optional[int] = None


class RecommendationItem(BaseModel):
    college: College
    branchCode: str
    branchName: str
    closingRank: int
    bucket: str  # dream | moderate | safe
    reason: str


class RecommendationResponse(BaseModel):
    dream: List[RecommendationItem]
    moderate: List[RecommendationItem]
    safe: List[RecommendationItem]


# ── Predictor ─────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    rank: int = Field(gt=0)
    category: str = "OC"
    gender: str = "Boys"
    branch: str = "CSE"
    collegeCode: Optional[str] = None


class SafeAlternative(BaseModel):
    code: str
    name: str
    closingRank: int


class PredictResponse(BaseModel):
    collegeName: Optional[str] = None
    branch: str
    cutoffRank: Optional[int] = None
    probability: int
    classification: str  # HIGH | MEDIUM | LOW
    reasoning: str
    safeAlternatives: List[SafeAlternative]


# ── Comparison ─────────────────────────────────────────────────────────────--
class CompareRequest(BaseModel):
    codes: List[str] = Field(min_length=1, max_length=4)
    category: str = "OC"
    gender: str = "Boys"


class CompareResponse(BaseModel):
    colleges: List[College]
    aiSummary: str


# ── Counselor (RAG chat) ──────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)
    # Optional user profile for personalised answers (sent by frontend when logged in)
    userRank: Optional[int] = None
    userCategory: Optional[str] = None
    userGender: Optional[str] = None


class ChatSource(BaseModel):
    code: str
    name: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource]
    parsed: Dict = Field(default_factory=dict)
    usedLlm: bool = False
