import pytest

from braumchat_api.models.user import User
from braumchat_api.models.workspace import Workspace
from braumchat_api.services import direct_message_service


@pytest.mark.asyncio
async def test_direct_message_thread_creation_and_messages(db_session):
    user1 = User(email="a@example.com", hashed_password="x")
    user2 = User(email="b@example.com", hashed_password="y")
    workspace = Workspace(name="Acme", slug="acme", owner_id=1)
    db_session.add_all([user1, user2, workspace])
    await db_session.commit()

    thread = await direct_message_service.get_or_create_thread(
        db_session,
        workspace_id=workspace.id,
        user_a=user1.id,
        user_b=user2.id,
    )

    same_thread = await direct_message_service.get_or_create_thread(
        db_session,
        workspace_id=workspace.id,
        user_a=user2.id,
        user_b=user1.id,
    )

    assert thread.id == same_thread.id

    message = await direct_message_service.create_direct_message(
        db_session,
        thread_id=thread.id,
        sender_id=user1.id,
        content="hello",
    )

    messages = await direct_message_service.list_messages(db_session, thread_id=thread.id)
    assert len(messages) == 1
    assert messages[0].content == "hello"
    assert messages[0].sender_id == user1.id
