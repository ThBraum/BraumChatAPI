from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.message import Message


async def create_message(db: AsyncSession, channel_id: int, user_id: int, content: str) -> Message:
    msg = Message(channel_id=channel_id, user_id=user_id, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def list_messages(db: AsyncSession, channel_id: int, limit: int = 50):
    q = await db.execute(
        select(Message)
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return q.scalars().all()
