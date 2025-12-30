from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
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
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication"
        )

    if session_id:
        session = await session_service.get_session_by_sid(db, str(session_id))
        if not session or session.user_id != user_id or session.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked"
            )

    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
