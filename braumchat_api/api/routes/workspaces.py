from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...schemas.workspace import WorkspaceCreate, WorkspaceRead
from ...services.workspace_service import create_workspace, get_workspace, list_workspaces

router = APIRouter()


@router.post("/", response_model=WorkspaceRead)
async def create(
    payload: WorkspaceCreate,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    ws = await create_workspace(db, owner_id=user.id, name=payload.name, slug=payload.slug)
    return ws


@router.get("/", response_model=List[WorkspaceRead])
async def list_all(db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)):
    return await list_workspaces(db, user.id)


@router.get("/{workspace_id}", response_model=WorkspaceRead)
async def get_one(
    workspace_id: int, db: AsyncSession = Depends(get_db_dep), user=Depends(get_current_user)
):
    ws = await get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return ws
