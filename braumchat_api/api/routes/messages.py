from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...config import get_settings
from ...db.redis import redis as redis_client
from ...models.channel import Channel
from ...realtime.manager import manager
from ...schemas.message import MessageCreate, MessageRead
from ...security.rate_limit import RateLimitRule, enforce_rate_limit
from ...services.message_service import create_message, list_messages
from ...services.workspace_service import get_workspace_member

router = APIRouter()
settings = get_settings()


@router.get(
    "/channels/{channel_id}/messages",
    response_model=List[MessageRead],
    response_model_by_alias=False,
)
async def get_messages(
    channel_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    membership = await get_workspace_member(db, workspace_id=channel.workspace_id, user_id=user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return await list_messages(db, channel_id=channel_id, limit=limit)


@router.post(
    "/channels/{channel_id}/messages",
    response_model=MessageRead,
    response_model_by_alias=False,
)
async def post_message(
    channel_id: int,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    membership = await get_workspace_member(db, workspace_id=channel.workspace_id, user_id=user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await enforce_rate_limit(
        redis=redis_client,
        key=f"rl:msg:post:u:{user.id}:c:{channel_id}",
        rule=RateLimitRule(
            limit=settings.RATE_LIMIT_POST_MESSAGE_PER_10_SECONDS, window_seconds=10
        ),
        fail_open=settings.RATE_LIMIT_FAIL_OPEN,
    )
    msg = await create_message(db, channel_id=channel_id, user_id=user.id, content=payload.content)

    author = msg.user
    ws_payload = {
        "id": msg.id,
        "content": msg.content,
        "client_id": payload.client_id,
        "user_id": msg.user_id,
        "author": {
            "id": author.id,
            "display_name": author.display_name,
            "avatar_url": author.avatar_url,
        },
        "channel_id": msg.channel_id,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "is_edited": msg.is_edited,
        "is_deleted": msg.is_deleted,
    }

    # Broadcast realtime (best-effort).
    try:
        # O padrão da chave segue o ws_channel em realtime.py.
        await manager.broadcast(
            f"chat:w:{int(channel.workspace_id)}:c:{channel_id}",
            {"type": "message", "payload": ws_payload},
        )
    except Exception:
        pass
    # Retorna formato consistente com o realtime (e inclui client_id opcional).
    return ws_payload
