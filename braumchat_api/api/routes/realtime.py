import asyncio
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db_dep
from ...config import get_settings
from ...db.redis import redis as redis_client
from ...realtime.manager import manager
from ...security.client import get_client_ip_from_scope
from ...security.rate_limit import RateLimitRule, enforce_rate_limit
from ...services import direct_message_service, dm_state_service, presence_service
from ...services.message_service import create_message

router = APIRouter()

settings = get_settings()

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
    try:
        ip = get_client_ip_from_scope(
            websocket.scope, trust_proxy_headers=settings.TRUST_PROXY_HEADERS
        )
        await enforce_rate_limit(
            redis=redis_client,
            key=f"rl:ws:connect:ip:{ip}",
            rule=RateLimitRule(limit=settings.RATE_LIMIT_WS_CONNECT_PER_MINUTE, window_seconds=60),
            fail_open=settings.RATE_LIMIT_FAIL_OPEN,
        )
    except Exception:
        await websocket.close(code=1008)
        return

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        from ...security.security import decode_token
        from ...services.user_service import get_user

        payload = decode_token(token)
        if payload.get("typ") == "refresh":
            raise ValueError()
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
    try:
        ip = get_client_ip_from_scope(
            websocket.scope, trust_proxy_headers=settings.TRUST_PROXY_HEADERS
        )
        await enforce_rate_limit(
            redis=redis_client,
            key=f"rl:ws:connect:ip:{ip}",
            rule=RateLimitRule(limit=settings.RATE_LIMIT_WS_CONNECT_PER_MINUTE, window_seconds=60),
            fail_open=settings.RATE_LIMIT_FAIL_OPEN,
        )
    except Exception:
        await websocket.close(code=1008)
        return

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)  # policy violation
        return

    try:
        from ...security.security import decode_token
        from ...services.user_service import get_user

        payload = decode_token(token)
        if payload.get("typ") == "refresh":
            raise ValueError()
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
    try:
        ip = get_client_ip_from_scope(
            websocket.scope, trust_proxy_headers=settings.TRUST_PROXY_HEADERS
        )
        await enforce_rate_limit(
            redis=redis_client,
            key=f"rl:ws:connect:ip:{ip}",
            rule=RateLimitRule(limit=settings.RATE_LIMIT_WS_CONNECT_PER_MINUTE, window_seconds=60),
            fail_open=settings.RATE_LIMIT_FAIL_OPEN,
        )
    except Exception:
        await websocket.close(code=1008)
        return

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        from ...security.security import decode_token
        from ...services.user_service import get_user

        payload = decode_token(token)
        if payload.get("typ") == "refresh":
            raise ValueError()
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

    other_user_id = thread.user2_id if int(thread.user1_id) == int(user_id) else thread.user1_id

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

                # Unread + notifications for the other participant (best-effort)
                try:
                    if manager.user_connection_count(channel_key, int(other_user_id)) == 0:
                        await dm_state_service.increment_unread(
                            redis_client,
                            user_id=int(other_user_id),
                            thread_id=int(thread_id),
                            delta=1,
                        )
                        await manager.broadcast(
                            f"notify:{int(other_user_id)}",
                            {
                                "type": "dm.unread",
                                "payload": {"thread_id": int(thread_id), "delta": 1},
                            },
                        )
                except Exception:
                    pass

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
            elif msg_type == "read":
                last_read = data.get("last_read_message_id")
                try:
                    last_read_int = int(last_read)
                except (TypeError, ValueError):
                    continue
                if last_read_int <= 0:
                    continue
                try:
                    last_read_int = await dm_state_service.set_last_read(
                        redis_client,
                        user_id=int(user_id),
                        thread_id=int(thread_id),
                        message_id=int(last_read_int),
                    )
                    await dm_state_service.clear_unread(
                        redis_client, user_id=int(user_id), thread_id=int(thread_id)
                    )
                except Exception:
                    pass

                await manager.broadcast(
                    channel_key,
                    {
                        "type": "read",
                        "payload": {
                            "user_id": int(user_id),
                            "last_read_message_id": int(last_read_int),
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
