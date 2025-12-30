import random
import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException, status

from ..models.user import User
from ..security.security import hash_password


_HANDLE_RE = re.compile(r"^(.{2,32})#(\d{4})$")


def _normalize_base_display_name(raw: str) -> str:
    base = (raw or "").strip()
    if "#" in base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name must not include '#'.",
        )
    if len(base) < 2 or len(base) > 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name must be between 2 and 32 characters.",
        )
    return base


async def _generate_unique_handle(db: AsyncSession, *, base: str) -> str:
    for _ in range(10000):
        code = f"{random.randint(0, 9999):04d}"
        handle = f"{base}#{code}"
        normalized = handle.strip().lower()
        stmt = select(User.id).where(func.lower(User.display_name) == normalized).limit(1)
        exists = (await db.execute(stmt)).scalars().first()
        if not exists:
            return handle
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Unable to allocate a unique tag for this display name.",
    )


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    display_name: str,
) -> User:
    base = _normalize_base_display_name(display_name)
    normalized_display_name = await _generate_unique_handle(db, base=base)
    user = User(
        email=email,
        hashed_password=hash_password(password),
        display_name=normalized_display_name,
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
        return user
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create user: {str(exc)}",
        )


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    q = await db.execute(select(User).where(User.email == email))
    return q.scalars().first()


async def get_user_by_display_name(db: AsyncSession, display_name: str) -> User | None:
    normalized = display_name.strip().lower()
    if not normalized:
        return None
    stmt = select(User).where(func.lower(User.display_name) == normalized)
    q = await db.execute(stmt)
    return q.scalars().first()


async def search_users_by_display_name(
    db: AsyncSession, *, query: str, limit: int = 20
) -> list[User]:
    q = query.strip().lower()
    if not q:
        return []

    # Se o usuário digitar um handle completo (ex: Braum#6892), prioriza match exato.
    if _HANDLE_RE.match(query.strip()):
        stmt = select(User).where(func.lower(User.display_name) == q).limit(limit)
    else:
        # Prefix search: permite buscar por base ("Braum") ou por prefixo do handle ("Braum#6").
        stmt = select(User).where(func.lower(User.display_name).like(f"{q}%")).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    q = await db.execute(select(User).where(User.id == user_id))
    return q.scalars().first()


async def list_users_by_ids(db: AsyncSession, user_ids: list[int]) -> list[User]:
    if not user_ids:
        return []
    q = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = q.scalars().all()
    by_id = {u.id: u for u in users}
    return [by_id[user_id] for user_id in user_ids if user_id in by_id]
