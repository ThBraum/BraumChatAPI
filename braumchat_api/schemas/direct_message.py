from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, root_validator

from .user import UserPublic


class DirectMessageThreadCreate(BaseModel):
    workspace_id: int
    user_id: int | None = None  # other participant
    participant_email: EmailStr | None = None

    @root_validator
    def _validate_participant(cls, values):
        user_id = values.get("user_id")
        participant_email = values.get("participant_email")
        if (user_id is None) == (participant_email is None):
            raise ValueError("Provide exactly one of user_id or participant_email")
        return values


class DirectMessageThreadRead(BaseModel):
    id: int
    workspace_id: int
    participants: List[UserPublic]
    unread_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class DirectMessageCreate(BaseModel):
    content: str
    client_id: Optional[str] = None


class DirectMessageRead(BaseModel):
    id: int
    thread_id: int
    user_id: int = Field(..., alias="sender_id")
    content: str
    client_id: Optional[str] = None
    is_deleted: bool
    is_edited: bool
    created_at: datetime
    updated_at: Optional[datetime]
    author: UserPublic = Field(..., alias="sender")

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class DirectMessageReadMark(BaseModel):
    last_read_message_id: int | None = None


class DirectMessageReadStatus(BaseModel):
    thread_id: int
    self_last_read_message_id: int
    other_last_read_message_id: int
