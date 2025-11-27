from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    slug: Optional[str] = None


class WorkspaceRead(BaseModel):
    id: int
    name: str
    slug: str
    owner_id: int
    created_at: Optional[datetime]

    class Config:
        orm_mode = True
