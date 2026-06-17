"""Auth router — register, login, me."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from ..config import settings
from ..db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

# ── JWT config (from settings; secret is env-driven and guarded in prod) ───────
SECRET_KEY = settings.jwt_secret
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.jwt_expire_minutes

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

USERS = "users"


# ── Schemas ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    rank: int = Field(gt=0, le=200000)
    category: str = "OC"
    gender: str = "Boys"
    phone: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    rank: int
    category: str
    gender: str
    phone: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    rank: Optional[int] = Field(None, gt=0, le=200000)
    category: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def _hash(password: str) -> str:
    return pwd_ctx.hash(password)


def _verify(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def _make_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": sub, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _user_out(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        rank=doc.get("rank", 0),
        category=doc.get("category", "OC"),
        gender=doc.get("gender", "Boys"),
        phone=doc.get("phone"),
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserOut:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")  # type: ignore[assignment]
        if not email:
            raise cred_exc
    except JWTError:
        raise cred_exc
    db = get_db()
    doc = db[USERS].find_one({"email": email})
    if not doc:
        raise cred_exc
    return _user_out(doc)


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/register", response_model=LoginResponse, status_code=201)
def register(body: RegisterRequest):
    db = get_db()
    if db[USERS].find_one({"email": body.email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    doc = {
        "name": body.name,
        "email": body.email,
        "password": _hash(body.password),
        "rank": body.rank,
        "category": body.category,
        "gender": body.gender,
        "phone": body.phone,
        "createdAt": datetime.now(timezone.utc),
    }
    result = db[USERS].insert_one(doc)
    doc["_id"] = result.inserted_id
    token = _make_token(body.email)
    return LoginResponse(access_token=token, user=_user_out(doc))


@router.post("/token", response_model=LoginResponse)
def login_form(form: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    doc = db[USERS].find_one({"email": form.username})
    if not doc or not _verify(form.password, doc["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = _make_token(form.username)
    return LoginResponse(access_token=token, user=_user_out(doc))


@router.post("/login", response_model=LoginResponse)
def login_json(body: dict):
    email = body.get("email", "")
    password = body.get("password", "")
    db = get_db()
    doc = db[USERS].find_one({"email": email})
    if not doc or not _verify(password, doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _make_token(email)
    return LoginResponse(access_token=token, user=_user_out(doc))


@router.get("/me", response_model=UserOut)
def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(body: UpdateProfileRequest, current_user: UserOut = Depends(get_current_user)):
    db = get_db()
    updates = body.model_dump(exclude_none=True)
    if updates:
        db[USERS].update_one({"email": current_user.email}, {"$set": updates})
    doc = db[USERS].find_one({"email": current_user.email})
    return _user_out(doc)
