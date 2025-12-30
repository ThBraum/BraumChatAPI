from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_current_user, get_db_dep
from ...schemas.user import UserPublic
from ...services.user_service import get_user_by_display_name, search_users_by_display_name

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/by-username/{username}", response_model=UserPublic)
async def by_username(
    username: str,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    # compat: endpoint antigo — agora resolve por display_name
    found = await get_user_by_display_name(db, username)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return found


@router.get("/by-display-name/{display_name}", response_model=UserPublic)
async def by_display_name(
    display_name: str,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    found = await get_user_by_display_name(db, display_name)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return found


@router.get("/search", response_model=List[UserPublic])
async def search(
    q: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db_dep),
    user=Depends(get_current_user),
):
    limit = max(1, min(limit, 50))
    return await search_users_by_display_name(db, query=q, limit=limit)