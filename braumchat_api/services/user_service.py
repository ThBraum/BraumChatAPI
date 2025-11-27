from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..security.security import hash_password


async def create_user(
    db: AsyncSession, email: str, password: str, display_name: str | None = None
) -> User:
    user = User(email=email, hashed_password=hash_password(password), display_name=display_name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    q = await db.execute(select(User).where(User.email == email))
    return q.scalars().first()


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    q = await db.execute(select(User).where(User.id == user_id))
    return q.scalars().first()
