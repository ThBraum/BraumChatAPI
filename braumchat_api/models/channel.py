from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from braumchat_api.models.meta import BaseEntity


class Channel(BaseEntity):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(255), nullable=False)
    is_private = Column(Boolean, default=False, nullable=False)

    workspace = relationship("Workspace", back_populates="channels")
    members = relationship("ChannelMember", back_populates="channel")
    messages = relationship("Message", back_populates="channel")
