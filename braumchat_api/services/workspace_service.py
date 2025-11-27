from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.workspace import Workspace


async def create_workspace(
    db: AsyncSession, owner_id: int, name: str, slug: str | None = None
) -> Workspace:
    if not slug:
        slug = name.lower().replace(" ", "-")
    ws = Workspace(name=name, slug=slug, owner_id=owner_id)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws


async def list_workspaces(db: AsyncSession, user_id: int):
    # naive: return workspaces where user is owner for now
    q = await db.execute(select(Workspace).where(Workspace.owner_id == user_id))
    return q.scalars().all()


async def get_workspace(db: AsyncSession, workspace_id: int):
    q = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    return q.scalars().first()
