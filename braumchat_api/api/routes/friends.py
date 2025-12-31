from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...realtime.manager import manager
from ...schemas.friend import FriendRequestCreate, FriendRequestRead
from ...schemas.user import UserPublic
from ...services import friend_service
from ...services.user_service import get_user_by_display_name

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("/", response_model=List[UserPublic])
async def list_friends(
    q: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    return await friend_service.list_friends(
        db, user_id=user.id, query=q, limit=limit, offset=offset
    )


@router.post("/requests", response_model=FriendRequestRead)
async def create_request(
    payload: FriendRequestCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    addressee = await get_user_by_display_name(db, payload.addressee_display_name)
    if not addressee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    try:
        req = await friend_service.create_or_reopen_request(
            db, requester_id=user.id, addressee_id=addressee.id
        )
    except ValueError as e:
        msg = str(e)
        if msg == "Already friends":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        if msg == "Incoming request already pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    await manager.broadcast(
        f"notify:{addressee.id}",
        {"type": "friend.requested", "payload": {"id": req.id}},
    )

    return req


@router.get("/requests/incoming", response_model=List[FriendRequestRead])
async def list_incoming(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    return await friend_service.list_incoming_requests(
        db, user_id=user.id, limit=limit, offset=offset
    )


@router.get("/requests/outgoing", response_model=List[FriendRequestRead])
async def list_outgoing(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    return await friend_service.list_outgoing_requests(
        db, user_id=user.id, limit=limit, offset=offset
    )


@router.post("/requests/{request_id}/accept", response_model=FriendRequestRead)
async def accept(
    request_id: int,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    req = await friend_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    try:
        req = await friend_service.accept_request(db, req=req, user_id=user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await manager.broadcast(
        f"notify:{req.requester_id}",
        {
            "type": "friend.accepted",
            "payload": {
                "id": req.id,
                "by": {
                    "id": user.id,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                },
            },
        },
    )

    return req


@router.post("/requests/{request_id}/decline", response_model=FriendRequestRead)
async def decline(
    request_id: int,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    req = await friend_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    try:
        req = await friend_service.decline_request(db, req=req, user_id=user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    await manager.broadcast(
        f"notify:{req.requester_id}",
        {
            "type": "friend.declined",
            "payload": {
                "id": req.id,
                "by": {
                    "id": user.id,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                },
            },
        },
    )

    return req
