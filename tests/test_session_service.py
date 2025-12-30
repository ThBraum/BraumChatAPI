import pytest

from braumchat_api.models.user import User
from braumchat_api.services import session_service


@pytest.mark.asyncio
async def test_session_lifecycle(db_session):
    user = User(email="user@example.com", username="user", hashed_password="x")
    db_session.add(user)
    await db_session.commit()

    session_id = "session-123"
    await session_service.create_session(
        db_session,
        user_id=user.id,
        session_id=session_id,
        user_agent="pytest",
        ip_address="127.0.0.1",
    )

    sessions = await session_service.list_active_sessions(db_session, user.id)
    assert len(sessions) == 1
    assert sessions[0].session_id == session_id

    await session_service.revoke_session(db_session, user.id, session_id)
    sessions_after = await session_service.list_active_sessions(db_session, user.id)
    assert sessions_after == []
