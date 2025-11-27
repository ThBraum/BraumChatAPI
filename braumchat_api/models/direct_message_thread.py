from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from .meta import BaseEntity


class DirectMessageThread(BaseEntity):
    __tablename__ = "direct_message_threads"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "user1_id", "user2_id", name="uq_dm_threads_workspace_users"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    messages = relationship("DirectMessage", back_populates="thread", cascade="all, delete-orphan")
