from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...schemas.direct_message import (
    DirectMessageCreate,
    DirectMessageRead,
    DirectMessageThreadCreate,
    DirectMessageThreadRead,
)
from ...services import direct_message_service

router = APIRouter(prefix="/dm", tags=["direct-messages"])


@router.post("/threads", response_model=DirectMessageThreadRead)
async def create_or_get_thread(
    payload: DirectMessageThreadCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    thread = await direct_message_service.get_or_create_thread(
        db,
        workspace_id=payload.workspace_id,
        user_a=user.id,
        user_b=payload.user_id,
    )
    return thread


@router.get("/threads", response_model=List[DirectMessageThreadRead])
async def list_threads(
    workspace_id: int | None = None,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    threads = await direct_message_service.list_threads(
        db, user_id=user.id, workspace_id=workspace_id
    )
    return threads


async def _get_thread_or_404(db: AsyncSession, thread_id: int):
    thread = await direct_message_service.get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return thread


@router.get("/threads/{thread_id}/messages", response_model=List[DirectMessageRead])
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


@router.post("/threads/{thread_id}/messages", response_model=DirectMessageRead)
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
    return message
