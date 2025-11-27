from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChannelCreate(BaseModel):
    name: str
    is_private: bool = False


class ChannelRead(BaseModel):
    id: int
    workspace_id: int
    name: str
    is_private: bool
    created_at: Optional[datetime]

    class Config:
        orm_mode = True
