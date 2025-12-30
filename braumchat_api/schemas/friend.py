from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .user import UserPublic


class FriendRequestCreate(BaseModel):
    addressee_display_name: str = Field(..., min_length=2, max_length=32)


class FriendRequestRead(BaseModel):
    id: int
    status: str
    requester: UserPublic
    addressee: UserPublic
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
