from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.workspace_invite import WorkspaceInvite
from ..models.workspace_member import WorkspaceMember


async def create_invite(
    db: AsyncSession,
    *,
    workspace_id: int,
    inviter_user_id: int,
    invitee_user_id: int,
) -> WorkspaceInvite:
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        inviter_user_id=inviter_user_id,
        invitee_user_id=invitee_user_id,
        status="pending",
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


async def list_incoming_invites(db: AsyncSession, *, user_id: int):
    stmt = (
        select(WorkspaceInvite)
        .options(
            selectinload(WorkspaceInvite.workspace),
            selectinload(WorkspaceInvite.inviter),
            selectinload(WorkspaceInvite.invitee),
        )
        .where(
            and_(
                WorkspaceInvite.invitee_user_id == user_id,
                WorkspaceInvite.status == "pending",
            )
        )
        .order_by(WorkspaceInvite.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_invite(db: AsyncSession, invite_id: int) -> WorkspaceInvite | None:
    result = await db.execute(
        select(WorkspaceInvite)
        .options(
            selectinload(WorkspaceInvite.workspace),
            selectinload(WorkspaceInvite.inviter),
            selectinload(WorkspaceInvite.invitee),
        )
        .where(WorkspaceInvite.id == invite_id)
    )
    return result.scalars().first()


async def accept_invite(
    db: AsyncSession,
    *,
    invite: WorkspaceInvite,
    user_id: int,
) -> WorkspaceInvite:
    if invite.invitee_user_id != user_id:
        raise ValueError("Not invitee")
    if invite.status != "pending":
        return invite

    # create membership if missing
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invite.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not existing.scalars().first():
        db.add(WorkspaceMember(workspace_id=invite.workspace_id, user_id=user_id, role="member"))

    invite.status = "accepted"
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


async def decline_invite(
    db: AsyncSession,
    *,
    invite: WorkspaceInvite,
    user_id: int,
) -> WorkspaceInvite:
    if invite.invitee_user_id != user_id:
        raise ValueError("Not invitee")
    if invite.status != "pending":
        return invite

    invite.status = "declined"
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite
