from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from ...api.deps import get_current_user, get_db_dep
from ...schemas.invite import WorkspaceInviteCreate, WorkspaceInviteRead
from ...schemas.workspace import WorkspaceCreate, WorkspaceRead
from ...services import invite_service
from ...services.user_service import get_user_by_display_name
from ...services.workspace_service import (
    create_workspace,
    get_workspace,
    get_workspace_member,
    list_workspaces,
)
from ...realtime.manager import manager

router = APIRouter()


@router.post("/", response_model=WorkspaceRead)
async def create(
    payload: WorkspaceCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    ws = await create_workspace(db, owner_id=user.id, name=payload.name, slug=payload.slug)
    return ws


@router.get("/", response_model=List[WorkspaceRead])
async def list_all(db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)):
    return await list_workspaces(db, user.id)


@router.get("/{workspace_id}", response_model=WorkspaceRead)
async def get_one(
    workspace_id: int, db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)
):
    ws = await get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if ws.owner_id != user.id:
        membership = await get_workspace_member(db, workspace_id=workspace_id, user_id=user.id)
        if not membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return ws


@router.post("/{workspace_id}/invites", response_model=WorkspaceInviteRead)
async def invite_user(
    workspace_id: int,
    payload: WorkspaceInviteCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    ws = await get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    if ws.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    invitee = await get_user_by_display_name(db, payload.invitee_display_name)
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if invitee.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite yourself")

    try:
        invite = await invite_service.create_invite(
            db,
            workspace_id=workspace_id,
            inviter_user_id=user.id,
            invitee_user_id=invitee.id,
        )
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already pending")

    # realtime notify invitee
    await manager.broadcast(
        f"notify:{invitee.id}",
        {
            "type": "invite.created",
            "payload": {
                "id": invite.id,
                "workspace_id": ws.id,
                "workspace_name": ws.name,
                "status": invite.status,
                "inviter": {
                    "id": user.id,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                },
                "invitee": {
                    "id": invitee.id,
                    "display_name": invitee.display_name,
                    "avatar_url": invitee.avatar_url,
                },
                "created_at": invite.created_at.isoformat() if invite.created_at else None,
            },
        },
    )

    return {
        "id": invite.id,
        "workspace_id": ws.id,
        "workspace_name": ws.name,
        "status": invite.status,
        "inviter": user,
        "invitee": invitee,
        "created_at": invite.created_at,
    }
