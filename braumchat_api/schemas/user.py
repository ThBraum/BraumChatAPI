from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, validator


class UserCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=2, max_length=32)
    password: str

    @validator("display_name")
    def _strip_display_name(cls, v: str) -> str:
        return v.strip()


class UserRead(BaseModel):
    id: int
    email: EmailStr
    display_name: Optional[str] = Field(default=None, min_length=7, max_length=37, regex=r"^.{2,32}#\d{4}$")
    avatar_url: Optional[str] = None
    is_active: bool
    is_superuser: bool
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


class UserPublic(BaseModel):
    id: int
    display_name: Optional[str] = Field(default=None, min_length=7, max_length=37, regex=r"^.{2,32}#\d{4}$")
    avatar_url: Optional[str] = None

    class Config:
        orm_mode = True
