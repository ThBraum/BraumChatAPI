from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...db.redis import redis as redis_client
from ...schemas.channel import ChannelCreate, ChannelRead
from ...services import presence_service
from ...services.channel_service import create_channel, get_channel, list_channels
from ...services.user_service import list_users_by_ids
from ...services.workspace_service import get_workspace_member

router = APIRouter()


@router.post("/workspaces/{workspace_id}/channels", response_model=ChannelRead)
async def create(
    workspace_id: int,
    payload: ChannelCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    membership = await get_workspace_member(db, workspace_id=workspace_id, user_id=user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    ch = await create_channel(
        db, workspace_id=workspace_id, name=payload.name, is_private=payload.is_private
    )
    return ch


@router.get("/workspaces/{workspace_id}/channels", response_model=List[ChannelRead])
async def list_all(
    workspace_id: int, db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)
):
    membership = await get_workspace_member(db, workspace_id=workspace_id, user_id=user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return await list_channels(db, workspace_id)


@router.get("/{channel_id}", response_model=ChannelRead)
async def get_one(
    channel_id: int, db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)
):
    ch = await get_channel(db, channel_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    membership = await get_workspace_member(db, workspace_id=ch.workspace_id, user_id=user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return ch


@router.get("/{channel_id}/presence")
async def get_channel_presence(
    channel_id: int, db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)
):
    channel = await get_channel(db, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    membership = await get_workspace_member(db, workspace_id=channel.workspace_id, user_id=user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    online_user_ids = await presence_service.list_users(
        redis_client, channel.workspace_id, channel.id
    )

    users = await list_users_by_ids(db, online_user_ids)
    return [{"user_id": u.id, "display_name": u.display_name} for u in users]
