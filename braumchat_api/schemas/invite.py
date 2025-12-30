from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .user import UserPublic


class WorkspaceInviteCreate(BaseModel):
    invitee_display_name: str


class WorkspaceInviteRead(BaseModel):
    id: int
    workspace_id: int
    workspace_name: str
    status: str
    inviter: UserPublic
    invitee: UserPublic
    created_at: Optional[datetime]

    class Config:
        orm_mode = True
