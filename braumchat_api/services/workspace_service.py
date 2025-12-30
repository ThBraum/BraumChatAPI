from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.workspace import Workspace
from ..models.workspace_member import WorkspaceMember


async def create_workspace(
    db: AsyncSession, owner_id: int, name: str, slug: str | None = None
) -> Workspace:
    if not slug:
        slug = name.lower().replace(" ", "-")
    ws = Workspace(name=name, slug=slug, owner_id=owner_id)
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=owner_id, role="owner"))
    await db.commit()
    await db.refresh(ws)
    return ws


async def list_workspaces(db: AsyncSession, user_id: int):
    # return workspaces where user is owner OR member
    stmt = (
        select(Workspace)
        .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(or_(Workspace.owner_id == user_id, WorkspaceMember.user_id == user_id))
        .order_by(Workspace.created_at.desc())
    )
    q = await db.execute(stmt)
    return q.scalars().unique().all()


async def get_workspace(db: AsyncSession, workspace_id: int):
    q = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    return q.scalars().first()
