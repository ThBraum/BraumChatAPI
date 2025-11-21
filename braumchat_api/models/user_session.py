from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .meta import BaseEntity


class UserSession(BaseEntity):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(64), unique=True, nullable=False)
    user_agent = Column(String(512), nullable=True)
    ip_address = Column(String(128), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    user = relationship("User", back_populates="sessions")
