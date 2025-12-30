from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...api.deps import get_current_user, get_db_dep
from ...schemas.message import MessageCreate, MessageRead
from ...services.message_service import create_message, list_messages
from ...realtime.manager import manager
from ...models.channel import Channel

router = APIRouter()


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
        workspace_id = await db.scalar(select(Channel.workspace_id).where(Channel.id == channel_id))
        if workspace_id is None:
            return ws_payload

        # O padrão da chave segue o ws_channel em realtime.py.
        await manager.broadcast(
            f"chat:w:{int(workspace_id)}:c:{channel_id}",
            {"type": "message", "payload": ws_payload},
        )
    except Exception:
        pass
    # Retorna formato consistente com o realtime (e inclui client_id opcional).
    return ws_payload
