from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db.redis import redis as redis_client
from ..db.session import get_db
from ..security.security import decode_token
from ..services import session_service
from ..services.user_service import get_user

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

settings = get_settings()


async def get_db_dep() -> AsyncGenerator[AsyncSession, None]:
    async for s in get_db():
        yield s


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db_dep)
):
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        session_id = payload.get("sid")
        token_type = payload.get("typ")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication"
        )

    # Do not allow refresh tokens to be used as Bearer auth.
    if token_type == "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication"
        )

    if settings.REQUIRE_SESSION_CLAIM and not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication"
        )

    if session_id:
        session_id = str(session_id)
        session = await session_service.get_session_by_sid(db, session_id)
        if not session or session.user_id != user_id or session.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked"
            )

        if settings.SESSION_TOUCH_ENABLED:
            await session_service.touch_session_if_due(
                db,
                redis=redis_client,
                session_id=session_id,
                ttl_seconds=settings.SESSION_TOUCH_TTL_SECONDS,
            )

    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
