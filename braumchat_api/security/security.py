from datetime import datetime, timedelta
from typing import Optional

from passlib.context import CryptContext
from jose import jwt, JWTError

from ..config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def _encode_token(subject: str, expires_delta: timedelta, additional_claims: Optional[dict] = None) -> str:
    expire = datetime.utcnow() + expires_delta
    to_encode: dict[str, object] = {"sub": str(subject), "exp": expire}
    if additional_claims:
        to_encode.update(additional_claims)
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[dict] = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MINUTES)
    return _encode_token(subject, expires_delta, additional_claims)


def create_refresh_token(
    subject: str,
    *,
    session_id: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
    additional_claims = {"sid": session_id}
    return _encode_token(subject, expires_delta, additional_claims)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise
