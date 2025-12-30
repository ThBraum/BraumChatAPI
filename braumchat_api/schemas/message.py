from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .user import UserPublic


class MessageCreate(BaseModel):
    content: str


class MessageRead(BaseModel):
    id: int
    channel_id: int
    user_id: int
    content: str
    is_edited: bool
    is_deleted: bool
    created_at: Optional[datetime]
    author: UserPublic = Field(..., alias="user")

    class Config:
        orm_mode = True
        allow_population_by_field_name = True
