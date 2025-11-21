from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class DirectMessageThreadCreate(BaseModel):
    workspace_id: int
    user_id: int  # other participant


class DirectMessageThreadRead(BaseModel):
    id: int
    workspace_id: int
    user1_id: int
    user2_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class DirectMessageCreate(BaseModel):
    content: str


class DirectMessageRead(BaseModel):
    id: int
    thread_id: int
    sender_id: int
    content: str
    is_deleted: bool
    is_edited: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
