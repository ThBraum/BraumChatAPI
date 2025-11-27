from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user_session import UserSession


async def create_session(
    db: AsyncSession,
    *,
    user_id: int,
    session_id: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> UserSession:
    session = UserSession(
        user_id=user_id,
        session_id=session_id,
        user_agent=user_agent,
        ip_address=ip_address,
        last_seen_at=datetime.utcnow(),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def list_active_sessions(db: AsyncSession, user_id: int) -> List[UserSession]:
    stmt = select(UserSession).where(
        UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_session_by_sid(db: AsyncSession, session_id: str) -> Optional[UserSession]:
    stmt = select(UserSession).where(UserSession.session_id == session_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def revoke_session(db: AsyncSession, user_id: int, session_id: str) -> Optional[UserSession]:
    session = await get_session_by_sid(db, session_id)
    if not session or session.user_id != user_id:
        return None
    if session.revoked_at is None:
        session.revoked_at = datetime.utcnow()
        await db.commit()
        await db.refresh(session)
    return session


async def touch_session(db: AsyncSession, session_id: str) -> None:
    session = await get_session_by_sid(db, session_id)
    if session and session.revoked_at is None:
        session.last_seen_at = datetime.utcnow()
        await db.commit()
