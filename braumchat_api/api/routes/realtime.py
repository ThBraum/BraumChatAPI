import asyncio
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db_dep
from ...db.redis import redis as redis_client
from ...realtime.manager import manager
from ...services import direct_message_service, presence_service
from ...services.message_service import create_message

router = APIRouter()

logger = logging.getLogger(__name__)

# If the client stops sending (e.g., laptop sleep / tab killed), the TCP connection
# can take a long time to be detected. We require lightweight client pings and
# close the socket if we don't receive anything within this window.
WS_CLIENT_IDLE_TIMEOUT_SECONDS = 25


@router.websocket("/ws/notifications")
async def ws_notifications(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db_dep),
):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        from ...security.security import decode_token
        from ...services.user_service import get_user

        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        user = await get_user(db, user_id)
        if not user:
            raise ValueError()

        # IMPORTANT: we'll rollback the session to avoid holding an idle transaction.
        # A rollback expires ORM instances; cache what we need as primitives first.
        user_id = int(user.id)
    except Exception:
        await websocket.close(code=1008)
        return

    # WebSockets keep the DB session open; make sure we don't hold an idle transaction.
    await db.rollback()

    channel_key = f"notify:{user_id}"
    await manager.connect(channel_key, websocket, user_id=user_id)
    await presence_service.online_connect(redis_client, user_id)
    heartbeat_task = asyncio.create_task(presence_service.online_heartbeat(redis_client, user_id))

    try:
        while True:
            # Keep connection open; client may send pings or nothing.
            try:
                await asyncio.wait_for(
                    websocket.receive_text(), timeout=WS_CLIENT_IDLE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                await websocket.close(code=1001)
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await presence_service.online_disconnect(redis_client, user_id)
        await manager.disconnect(channel_key, websocket)


@router.websocket("/ws/chat/{workspace_id}/{channel_id}")
async def ws_channel(
    websocket: WebSocket,
    workspace_id: int,
    channel_id: int,
    db: AsyncSession = Depends(get_db_dep),
):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)  # policy violation
        return

    try:
        from ...security.security import decode_token
        from ...services.user_service import get_user

        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        user = await get_user(db, user_id)
        if not user:
            raise ValueError()

        # Cache primitives before rollback expires the ORM instance.
        user_id = int(user.id)
        user_display_name = user.display_name
        user_avatar_url = user.avatar_url
    except Exception:
        await websocket.close(code=1008)
        return

    # WebSockets keep the DB session open; make sure we don't hold an idle transaction.
    await db.rollback()

    channel_key = f"chat:w:{workspace_id}:c:{channel_id}"

    await manager.connect(channel_key, websocket, user_id=user_id)
    await presence_service.online_connect(redis_client, user_id)
    heartbeat_task = asyncio.create_task(presence_service.online_heartbeat(redis_client, user_id))
    await presence_service.add_user(redis_client, workspace_id, channel_id, user_id)

    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(), timeout=WS_CLIENT_IDLE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                await websocket.close(code=1001)
                break

            msg_type = data.get("type")

            if msg_type == "ping":
                continue
            if msg_type == "message":
                content = data.get("content")
                if not content:
                    continue

                client_id = data.get("client_id")

                # Persist message in DB
                msg = await create_message(
                    db, channel_id=channel_id, user_id=user_id, content=content
                )

                author = {
                    "id": user_id,
                    "display_name": user_display_name,
                    "avatar_url": user_avatar_url,
                }

                payload = {
                    "id": msg.id,
                    "content": msg.content,
                    "client_id": client_id,
                    "user_id": msg.user_id,
                    "author": author,
                    "workspace_id": workspace_id,
                    "channel_id": channel_id,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                    "is_edited": msg.is_edited,
                    "is_deleted": msg.is_deleted,
                }

                await manager.broadcast(
                    channel_key,
                    {"type": "message", "payload": payload},
                )

                # `create_message()` ends with a SELECT; rollback to release locks.
                await db.rollback()
            elif msg_type == "typing":
                logger.info(
                    "ws channel typing workspace=%s channel=%s from_user=%s is_typing=%s",
                    workspace_id,
                    channel_id,
                    user_id,
                    bool(data.get("is_typing", True)),
                )
                await manager.broadcast(
                    channel_key,
                    {
                        "type": "typing",
                        "payload": {
                            "user_id": user_id,
                            "is_typing": bool(data.get("is_typing", True)),
                        },
                    },
                )
    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await presence_service.online_disconnect(redis_client, user_id)
        await manager.disconnect(channel_key, websocket)
        await presence_service.remove_user(redis_client, workspace_id, channel_id, user_id)


@router.websocket("/ws/dm/{thread_id}")
async def ws_direct_message(
    websocket: WebSocket,
    thread_id: int,
    db: AsyncSession = Depends(get_db_dep),
):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        from ...security.security import decode_token
        from ...services.user_service import get_user

        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        user = await get_user(db, user_id)
        if not user:
            raise ValueError()

        # Cache primitives before rollback expires the ORM instance.
        user_id = int(user.id)
        user_display_name = user.display_name
        user_avatar_url = user.avatar_url
    except Exception:
        await websocket.close(code=1008)
        return

    # WebSockets keep the DB session open; make sure we don't hold an idle transaction.
    await db.rollback()

    thread = await direct_message_service.get_thread(db, thread_id)
    if not thread or not direct_message_service.user_in_thread(thread, user_id):
        await websocket.close(code=1008)
        return

    await db.rollback()

    channel_key = f"dm:{thread_id}"
    await manager.connect(channel_key, websocket, user_id=user_id)
    await presence_service.online_connect(redis_client, user_id)
    heartbeat_task = asyncio.create_task(presence_service.online_heartbeat(redis_client, user_id))

    # Notify thread participants that this user is online (DM presence is per-thread socket).
    await manager.broadcast(
        channel_key,
        {
            "type": "presence",
            "payload": {"user_id": user_id, "online": True},
        },
    )

    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(), timeout=WS_CLIENT_IDLE_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                await websocket.close(code=1001)
                break

            msg_type = data.get("type")

            if msg_type == "ping":
                continue
            if msg_type == "message":
                content = data.get("content")
                if not content:
                    continue

                client_id = data.get("client_id")

                message = await direct_message_service.create_direct_message(
                    db,
                    thread_id=thread_id,
                    sender_id=user_id,
                    content=content,
                )

                author = {
                    "id": user_id,
                    "display_name": user_display_name,
                    "avatar_url": user_avatar_url,
                }

                payload = {
                    "id": message.id,
                    "thread_id": message.thread_id,
                    "sender_id": message.sender_id,
                    "user_id": message.sender_id,
                    "client_id": client_id,
                    "content": message.content,
                    "author": author,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                    "is_deleted": message.is_deleted,
                    "is_edited": message.is_edited,
                }

                await manager.broadcast(channel_key, {"type": "message", "payload": payload})

                # `create_direct_message()` ends with a SELECT; rollback to release locks.
                await db.rollback()
            elif msg_type == "typing":
                logger.info(
                    "ws dm typing thread=%s from_user=%s is_typing=%s",
                    thread_id,
                    user_id,
                    bool(data.get("is_typing", True)),
                )
                logger.info(
                    "ws dm typing broadcast thread=%s from_user=%s conn_count=%s",
                    thread_id,
                    user_id,
                    len(manager.active_connections.get(channel_key, [])),
                )
                await manager.broadcast(
                    channel_key,
                    {
                        "type": "typing",
                        "payload": {
                            "user_id": user_id,
                            "is_typing": bool(data.get("is_typing", True)),
                        },
                    },
                )
    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        # Disconnect first so broadcasts won't include the closing websocket.
        await manager.disconnect(channel_key, websocket)

        remaining = await presence_service.online_disconnect(redis_client, user_id)
        if remaining == 0:
            await manager.broadcast(
                channel_key,
                {
                    "type": "presence",
                    "payload": {"user_id": user_id, "online": False},
                },
            )

