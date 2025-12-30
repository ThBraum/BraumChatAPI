from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from ..models.friend import Friend
from ..models.friend_request import FriendRequest
from ..models.user import User


def _ordered_user_ids(user_a: int, user_b: int) -> tuple[int, int]:
    return (user_a, user_b) if user_a < user_b else (user_b, user_a)


async def get_friendship(db: AsyncSession, *, user_a: int, user_b: int) -> Friend | None:
    user1_id, user2_id = _ordered_user_ids(user_a, user_b)
    res = await db.execute(
        select(Friend)
        .options(selectinload(Friend.user1), selectinload(Friend.user2))
        .where(and_(Friend.user1_id == user1_id, Friend.user2_id == user2_id))
    )
    return res.scalars().first()


async def create_friendship(db: AsyncSession, *, user_a: int, user_b: int) -> Friend:
    if user_a == user_b:
        raise ValueError("Cannot friend yourself")

    existing = await get_friendship(db, user_a=user_a, user_b=user_b)
    if existing:
        return existing

    user1_id, user2_id = _ordered_user_ids(user_a, user_b)
    friendship = Friend(user1_id=user1_id, user2_id=user2_id)
    db.add(friendship)
    await db.commit()
    await db.refresh(friendship)
    return friendship


async def create_or_reopen_request(
    db: AsyncSession, *, requester_id: int, addressee_id: int
) -> FriendRequest:
    if requester_id == addressee_id:
        raise ValueError("Cannot friend yourself")

    # already friends
    if await get_friendship(db, user_a=requester_id, user_b=addressee_id):
        raise ValueError("Already friends")

    # if there is a pending request in the opposite direction, keep UX simple and block
    opposite = await db.execute(
        select(FriendRequest)
        .where(
            and_(
                FriendRequest.requester_id == addressee_id,
                FriendRequest.addressee_id == requester_id,
                FriendRequest.status == "pending",
            )
        )
    )
    if opposite.scalars().first():
        raise ValueError("Incoming request already pending")

    existing_res = await db.execute(
        select(FriendRequest)
        .options(
            selectinload(FriendRequest.requester),
            selectinload(FriendRequest.addressee),
        )
        .where(
            and_(
                FriendRequest.requester_id == requester_id,
                FriendRequest.addressee_id == addressee_id,
            )
        )
    )
    existing = existing_res.scalars().first()

    if existing:
        if existing.status == "pending":
            return existing
        existing.status = "pending"
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        refreshed = await get_request(db, existing.id)
        return refreshed or existing

    req = FriendRequest(
        requester_id=requester_id,
        addressee_id=addressee_id,
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    refreshed = await get_request(db, req.id)
    return refreshed or req


async def list_incoming_requests(
    db: AsyncSession, *, user_id: int, limit: int = 20, offset: int = 0
) -> list[FriendRequest]:
    stmt = (
        select(FriendRequest)
        .options(
            selectinload(FriendRequest.requester),
            selectinload(FriendRequest.addressee),
        )
        .where(
            and_(
                FriendRequest.addressee_id == user_id,
                FriendRequest.status == "pending",
            )
        )
        .order_by(FriendRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


async def list_outgoing_requests(
    db: AsyncSession, *, user_id: int, limit: int = 20, offset: int = 0
) -> list[FriendRequest]:
    stmt = (
        select(FriendRequest)
        .options(
            selectinload(FriendRequest.requester),
            selectinload(FriendRequest.addressee),
        )
        .where(
            and_(
                FriendRequest.requester_id == user_id,
                FriendRequest.status == "pending",
            )
        )
        .order_by(FriendRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


async def get_request(db: AsyncSession, request_id: int) -> FriendRequest | None:
    res = await db.execute(
        select(FriendRequest)
        .options(
            selectinload(FriendRequest.requester),
            selectinload(FriendRequest.addressee),
        )
        .where(FriendRequest.id == request_id)
    )
    return res.scalars().first()


async def accept_request(db: AsyncSession, *, req: FriendRequest, user_id: int) -> FriendRequest:
    if req.addressee_id != user_id:
        raise ValueError("Forbidden")
    if req.status != "pending":
        return req

    await create_friendship(db, user_a=req.requester_id, user_b=req.addressee_id)

    req.status = "accepted"
    db.add(req)
    await db.commit()
    await db.refresh(req)
    refreshed = await get_request(db, req.id)
    return refreshed or req


async def decline_request(db: AsyncSession, *, req: FriendRequest, user_id: int) -> FriendRequest:
    if req.addressee_id != user_id:
        raise ValueError("Forbidden")
    if req.status != "pending":
        return req

    req.status = "declined"
    db.add(req)
    await db.commit()
    await db.refresh(req)
    refreshed = await get_request(db, req.id)
    return refreshed or req


async def list_friends(
    db: AsyncSession,
    *,
    user_id: int,
    query: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[User]:
    u1 = aliased(User)
    u2 = aliased(User)

    stmt = (
        select(Friend, u1, u2)
        .join(u1, Friend.user1_id == u1.id)
        .join(u2, Friend.user2_id == u2.id)
        .where(or_(Friend.user1_id == user_id, Friend.user2_id == user_id))
        .order_by(Friend.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if query:
        q = f"%{query.strip()}%"
        stmt = stmt.where(or_(u1.display_name.ilike(q), u2.display_name.ilike(q)))

    res = await db.execute(stmt)
    friends: list[User] = []
    for friendship, user1, user2 in res.all():
        other = user2 if friendship.user1_id == user_id else user1
        friends.append(other)
    return friends
