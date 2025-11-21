from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship

from braumchat_api.models.meta import BaseEntity


class User(BaseEntity):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(String(1024), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)

    workspaces = relationship("WorkspaceMember", back_populates="user")
    messages = relationship("Message", back_populates="user")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
