from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...realtime.manager import manager
from ...schemas.invite import WorkspaceInviteRead
from ...services import invite_service

router = APIRouter()


def _to_read(invite) -> dict:
    return {
        "id": invite.id,
        "workspace_id": invite.workspace_id,
        "workspace_name": invite.workspace.name if invite.workspace else "",
        "status": invite.status,
        "inviter": invite.inviter,
        "invitee": invite.invitee,
        "created_at": invite.created_at,
    }


@router.get("/incoming", response_model=List[WorkspaceInviteRead])
async def list_incoming(
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    invites = await invite_service.list_incoming_invites(db, user_id=user.id)
    return [_to_read(i) for i in invites]


@router.post("/{invite_id}/accept", response_model=WorkspaceInviteRead)
async def accept_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    invite = await invite_service.get_invite(db, invite_id)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    try:
        invite = await invite_service.accept_invite(db, invite=invite, user_id=user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await manager.broadcast(
        f"notify:{invite.inviter_user_id}",
        {"type": "invite.accepted", "payload": _to_read(invite)},
    )

    return _to_read(invite)


@router.post("/{invite_id}/decline", response_model=WorkspaceInviteRead)
async def decline_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    invite = await invite_service.get_invite(db, invite_id)
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    try:
        invite = await invite_service.decline_invite(db, invite=invite, user_id=user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await manager.broadcast(
        f"notify:{invite.inviter_user_id}",
        {"type": "invite.declined", "payload": _to_read(invite)},
    )

    return _to_read(invite)
