from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from braumchat_api.models.meta import BaseEntity


class Workspace(BaseEntity):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User")
    members = relationship("WorkspaceMember", back_populates="workspace")
    channels = relationship("Channel", back_populates="workspace")
