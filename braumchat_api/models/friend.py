from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from .meta import BaseEntity


class Friend(BaseEntity):
    __tablename__ = "friends"
    __table_args__ = (
        UniqueConstraint("user1_id", "user2_id", name="uq_friends_users"),
        CheckConstraint("user1_id < user2_id", name="ck_friends_order"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
