from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.channel import Channel


async def create_channel(
    db: AsyncSession, workspace_id: int, name: str, is_private: bool = False
) -> Channel:
    ch = Channel(workspace_id=workspace_id, name=name, is_private=is_private)
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return ch


async def list_channels(db: AsyncSession, workspace_id: int):
    q = await db.execute(select(Channel).where(Channel.workspace_id == workspace_id))
    return q.scalars().all()


async def get_channel(db: AsyncSession, channel_id: int):
    q = await db.execute(select(Channel).where(Channel.id == channel_id))
    return q.scalars().first()
