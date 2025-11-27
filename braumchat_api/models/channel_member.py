from sqlalchemy import Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from braumchat_api.models.meta import BaseEntity


class ChannelMember(BaseEntity):
    __tablename__ = "channel_members"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    channel = relationship("Channel", back_populates="members")
    user = relationship("User")
