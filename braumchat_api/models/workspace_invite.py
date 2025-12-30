from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from braumchat_api.models.meta import BaseEntity


class WorkspaceInvite(BaseEntity):
    __tablename__ = "workspace_invites"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id",
            "invitee_user_id",
            "status",
            name="uq_workspace_invites_workspace_invitee_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    inviter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # pending | accepted | declined
    status = Column(String(20), nullable=False, default="pending")

    workspace = relationship("Workspace")
    inviter = relationship("User", foreign_keys=[inviter_user_id])
    invitee = relationship("User", foreign_keys=[invitee_user_id])
