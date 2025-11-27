from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...schemas.message import MessageCreate, MessageRead
from ...services.message_service import create_message, list_messages

router = APIRouter()


@router.get("/channels/{channel_id}/messages", response_model=List[MessageRead])
async def get_messages(
    channel_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    return await list_messages(db, channel_id=channel_id, limit=limit)


@router.post("/channels/{channel_id}/messages", response_model=MessageRead)
async def post_message(
    channel_id: int,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    msg = await create_message(db, channel_id=channel_id, user_id=user.id, content=payload.content)
    return msg
