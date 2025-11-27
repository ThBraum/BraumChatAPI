from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class UserSessionRead(BaseModel):
    session_id: str
    user_agent: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    last_seen_at: Optional[datetime]
    revoked_at: Optional[datetime]

    class Config:
        orm_mode = True
