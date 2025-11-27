from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..security.security import create_access_token, create_refresh_token, verify_password
from ..services.user_service import get_user_by_email


async def authenticate_user(db: AsyncSession, email: str, password: str):
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def create_tokens_for_user(
    user, *, session_id: str, access_expires: timedelta | None = None
):
    access = create_access_token(str(user.id), expires_delta=access_expires)
    refresh = create_refresh_token(str(user.id), session_id=session_id)
    return {"access_token": access, "refresh_token": refresh}
