from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ..models.direct_message import DirectMessage
from ..models.direct_message_thread import DirectMessageThread
from ..models.user import User


def _ordered_user_ids(user_a: int, user_b: int) -> tuple[int, int]:
    return (user_a, user_b) if user_a < user_b else (user_b, user_a)


async def get_or_create_thread(
    db: AsyncSession, *, workspace_id: int, user_a: int, user_b: int
) -> DirectMessageThread:
    if user_a == user_b:
        raise ValueError("Cannot create direct message thread with yourself")

    user1_id, user2_id = _ordered_user_ids(user_a, user_b)
    stmt = select(DirectMessageThread).where(
        DirectMessageThread.workspace_id == workspace_id,
        DirectMessageThread.user1_id == user1_id,
        DirectMessageThread.user2_id == user2_id,
    )
    result = await db.execute(stmt)
    thread = result.scalars().first()
    if thread:
        return thread

    thread = DirectMessageThread(
        workspace_id=workspace_id,
        user1_id=user1_id,
        user2_id=user2_id,
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def list_threads(
    db: AsyncSession,
    *,
    user_id: int,
    workspace_id: int | None = None,
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    user1 = aliased(User)
    user2 = aliased(User)

    stmt = (
        select(DirectMessageThread)
        .join(user1, DirectMessageThread.user1_id == user1.id)
        .join(user2, DirectMessageThread.user2_id == user2.id)
        .where(
        or_(
            DirectMessageThread.user1_id == user_id,
            DirectMessageThread.user2_id == user_id,
        )
        )
    )
    if workspace_id is not None:
        stmt = stmt.where(DirectMessageThread.workspace_id == workspace_id)

    if query:
        q = f"%{query.strip()}%"
        stmt = stmt.where(or_(user1.display_name.ilike(q), user2.display_name.ilike(q)))

    result = await db.execute(
        stmt.options(
            selectinload(DirectMessageThread.user1),
            selectinload(DirectMessageThread.user2),
        )
        .order_by(DirectMessageThread.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


async def get_thread(db: AsyncSession, thread_id: int) -> DirectMessageThread | None:
    result = await db.execute(
        select(DirectMessageThread)
        .options(
            selectinload(DirectMessageThread.user1),
            selectinload(DirectMessageThread.user2),
        )
        .where(DirectMessageThread.id == thread_id)
    )
    return result.scalars().first()


def user_in_thread(thread: DirectMessageThread, user_id: int) -> bool:
    return user_id in (thread.user1_id, thread.user2_id)


async def list_messages(db: AsyncSession, *, thread_id: int, limit: int = 50, offset: int = 0):
    stmt = (
        select(DirectMessage)
        .options(selectinload(DirectMessage.sender))
        .where(DirectMessage.thread_id == thread_id)
        .order_by(DirectMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_direct_message(
    db: AsyncSession, *, thread_id: int, sender_id: int, content: str
) -> DirectMessage:
    message = DirectMessage(thread_id=thread_id, sender_id=sender_id, content=content)
    db.add(message)
    await db.commit()
    await db.refresh(message)
    q = await db.execute(
        select(DirectMessage)
        .options(selectinload(DirectMessage.sender))
        .where(DirectMessage.id == message.id)
    )
    return q.scalars().first()
