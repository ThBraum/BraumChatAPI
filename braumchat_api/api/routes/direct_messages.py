from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...db.redis import redis as redis_client
from ...realtime.manager import manager
from ...schemas.direct_message import (
    DirectMessageCreate,
    DirectMessageRead,
    DirectMessageReadMark,
    DirectMessageReadStatus,
    DirectMessageThreadCreate,
    DirectMessageThreadRead,
)
from ...services import direct_message_service, dm_state_service
from ...services.user_service import get_user, get_user_by_email

router = APIRouter(prefix="/dm", tags=["direct-messages"])


@router.post("/threads", response_model=DirectMessageThreadRead)
async def create_or_get_thread(
    payload: DirectMessageThreadCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    other_user_id = payload.user_id
    if other_user_id is None and payload.participant_email is not None:
        other = await get_user_by_email(db, payload.participant_email)
        if not other:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        other_user_id = other.id

    if other_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")

    thread = await direct_message_service.get_or_create_thread(
        db,
        workspace_id=payload.workspace_id,
        user_a=user.id,
        user_b=other_user_id,
    )

    thread = await direct_message_service.get_thread(db, thread.id)
    participants = [p for p in [thread.user1, thread.user2] if p is not None]

    # Best-effort: unread count is stored in Redis; if it fails, default to 0.
    try:
        unread = await dm_state_service.get_unread(redis_client, user_id=user.id, thread_id=thread.id)
    except Exception:
        unread = 0
    return {
        "id": thread.id,
        "workspace_id": thread.workspace_id,
        "participants": participants,
        "unread_count": unread,
        "created_at": thread.created_at,
        "updated_at": thread.updated_at,
    }


@router.get("/threads", response_model=List[DirectMessageThreadRead])
async def list_threads(
    workspace_id: int | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    threads = await direct_message_service.list_threads(
        db, user_id=user.id, workspace_id=workspace_id, query=q, limit=limit, offset=offset
    )

    # Best-effort unread lookup for returned threads.
    unread_map: dict[int, int] = {}
    try:
        unread_map = await dm_state_service.get_unread_map(
            redis_client, user_id=user.id, thread_ids=[t.id for t in threads]
        )
    except Exception:
        unread_map = {}

    return [
        {
            "id": t.id,
            "workspace_id": t.workspace_id,
            "participants": [p for p in [t.user1, t.user2] if p is not None],
            "unread_count": int(unread_map.get(int(t.id), 0)),
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }
        for t in threads
    ]


async def _get_thread_or_404(db: AsyncSession, thread_id: int):
    thread = await direct_message_service.get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return thread


@router.get(
    "/threads/{thread_id}/messages",
    response_model=List[DirectMessageRead],
    response_model_by_alias=False,
)
async def list_thread_messages(
    thread_id: int,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    thread = await _get_thread_or_404(db, thread_id)
    if not direct_message_service.user_in_thread(thread, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this thread"
        )
    messages = await direct_message_service.list_messages(
        db, thread_id=thread.id, limit=limit, offset=offset
    )
    return messages


@router.post(
    "/threads/{thread_id}/messages",
    response_model=DirectMessageRead,
    response_model_by_alias=False,
)
async def post_thread_message(
    thread_id: int,
    payload: DirectMessageCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    thread = await _get_thread_or_404(db, thread_id)
    if not direct_message_service.user_in_thread(thread, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this thread"
        )
    message = await direct_message_service.create_direct_message(
        db,
        thread_id=thread.id,
        sender_id=user.id,
        content=payload.content,
    )

    # Determine the other participant for unread + notification.
    other_user_id = thread.user2_id if int(thread.user1_id) == int(user.id) else thread.user1_id

    author = message.sender
    ws_payload = {
        "id": message.id,
        "thread_id": message.thread_id,
        "user_id": message.sender_id,
        "client_id": payload.client_id,
        "content": message.content,
        "author": {
            "id": author.id,
            "display_name": author.display_name,
            "avatar_url": author.avatar_url,
        },
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "updated_at": message.updated_at.isoformat() if message.updated_at else None,
        "is_deleted": message.is_deleted,
        "is_edited": message.is_edited,
    }

    # Broadcast para participantes conectados (realtime) mantendo formato esperado no frontend.
    try:
        await manager.broadcast(f"dm:{thread.id}", {"type": "message", "payload": ws_payload})
    except Exception:
        # Best-effort; o REST já retornou sucesso.
        pass

    # Unread + notification for recipient (best-effort).
    try:
        if manager.user_connection_count(f"dm:{thread.id}", int(other_user_id)) == 0:
            await dm_state_service.increment_unread(
                redis_client, user_id=int(other_user_id), thread_id=int(thread.id), delta=1
            )
            await manager.broadcast(
                f"notify:{int(other_user_id)}",
                {
                    "type": "dm.unread",
                    "payload": {"thread_id": int(thread.id), "delta": 1},
                },
            )
    except Exception:
        pass

    return ws_payload


@router.get(
    "/threads/{thread_id}/read-status",
    response_model=DirectMessageReadStatus,
)
async def get_read_status(
    thread_id: int,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    thread = await _get_thread_or_404(db, thread_id)
    if not direct_message_service.user_in_thread(thread, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this thread")

    other_user_id = thread.user2_id if int(thread.user1_id) == int(user.id) else thread.user1_id

    try:
        self_last = await dm_state_service.get_last_read(
            redis_client, user_id=int(user.id), thread_id=int(thread.id)
        )
        other_last = await dm_state_service.get_last_read(
            redis_client, user_id=int(other_user_id), thread_id=int(thread.id)
        )
    except Exception:
        self_last = 0
        other_last = 0

    return {
        "thread_id": int(thread.id),
        "self_last_read_message_id": int(self_last),
        "other_last_read_message_id": int(other_last),
    }


@router.post(
    "/threads/{thread_id}/read",
    response_model=DirectMessageReadStatus,
)
async def mark_read(
    thread_id: int,
    payload: DirectMessageReadMark,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    thread = await _get_thread_or_404(db, thread_id)
    if not direct_message_service.user_in_thread(thread, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this thread")

    other_user_id = thread.user2_id if int(thread.user1_id) == int(user.id) else thread.user1_id

    last_read = int(payload.last_read_message_id or 0)
    try:
        if last_read > 0:
            last_read = await dm_state_service.set_last_read(
                redis_client, user_id=int(user.id), thread_id=int(thread.id), message_id=last_read
            )
        await dm_state_service.clear_unread(redis_client, user_id=int(user.id), thread_id=int(thread.id))

        # Broadcast read update to connected participants (best-effort)
        if last_read > 0:
            await manager.broadcast(
                f"dm:{int(thread.id)}",
                {
                    "type": "read",
                    "payload": {"user_id": int(user.id), "last_read_message_id": int(last_read)},
                },
            )
    except Exception:
        pass

    # Return current status snapshot
    try:
        self_last = await dm_state_service.get_last_read(
            redis_client, user_id=int(user.id), thread_id=int(thread.id)
        )
        other_last = await dm_state_service.get_last_read(
            redis_client, user_id=int(other_user_id), thread_id=int(thread.id)
        )
    except Exception:
        self_last = 0
        other_last = 0

    return {
        "thread_id": int(thread.id),
        "self_last_read_message_id": int(self_last),
        "other_last_read_message_id": int(other_last),
    }
