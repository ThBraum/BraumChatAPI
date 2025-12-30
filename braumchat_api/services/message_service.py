from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.message import Message


async def create_message(db: AsyncSession, channel_id: int, user_id: int, content: str) -> Message:
    msg = Message(channel_id=channel_id, user_id=user_id, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    q = await db.execute(
        select(Message)
        .options(selectinload(Message.user))
        .where(Message.id == msg.id)
    )
    return q.scalars().first()


async def list_messages(db: AsyncSession, channel_id: int, limit: int = 50):
    q = await db.execute(
        select(Message)
        .options(selectinload(Message.user))
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return q.scalars().all()
