from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...realtime.manager import manager
from ...schemas.direct_message import (
    DirectMessageCreate,
    DirectMessageRead,
    DirectMessageThreadCreate,
    DirectMessageThreadRead,
)
from ...services import direct_message_service
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
    return {
        "id": thread.id,
        "workspace_id": thread.workspace_id,
        "participants": participants,
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
    return [
        {
            "id": t.id,
            "workspace_id": t.workspace_id,
            "participants": [p for p in [t.user1, t.user2] if p is not None],
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
    # Retorna formato consistente com o realtime (e inclui client_id opcional).
    return ws_payload
