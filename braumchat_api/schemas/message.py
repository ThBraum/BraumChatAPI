from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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

    class Config:
        orm_mode = True
