from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db_dep
from ...db.redis import redis as redis_client
from ...realtime.manager import manager
from ...services import direct_message_service, presence_service
from ...services.message_service import create_message

router = APIRouter()


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
    except Exception:
        await websocket.close(code=1008)
        return

    channel_key = f"notify:{user.id}"
    await manager.connect(channel_key, websocket, user_id=user.id)

    try:
        while True:
            # Keep connection open; client may send pings or nothing.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
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
    except Exception:
        await websocket.close(code=1008)
        return

    channel_key = f"chat:w:{workspace_id}:c:{channel_id}"

    await manager.connect(channel_key, websocket, user_id=user.id)
    await presence_service.add_user(redis_client, workspace_id, channel_id, user.id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                content = data.get("content")
                if not content:
                    continue

                # Persist message in DB
                msg = await create_message(
                    db, channel_id=channel_id, user_id=user.id, content=content
                )

                author = {
                    "id": user.id,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                }

                payload = {
                    "id": msg.id,
                    "content": msg.content,
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
            elif msg_type == "typing":
                await manager.broadcast(
                    channel_key,
                    {
                        "type": "typing",
                        "payload": {
                            "user_id": user.id,
                            "is_typing": bool(data.get("is_typing", True)),
                        },
                    },
                )
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(channel_key, websocket)
        await presence_service.remove_user(redis_client, workspace_id, channel_id, user.id)


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
    except Exception:
        await websocket.close(code=1008)
        return

    thread = await direct_message_service.get_thread(db, thread_id)
    if not thread or not direct_message_service.user_in_thread(thread, user.id):
        await websocket.close(code=1008)
        return

    channel_key = f"dm:{thread_id}"
    await manager.connect(channel_key, websocket, user_id=user.id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                content = data.get("content")
                if not content:
                    continue

                message = await direct_message_service.create_direct_message(
                    db,
                    thread_id=thread.id,
                    sender_id=user.id,
                    content=content,
                )

                author = {
                    "id": user.id,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                }

                payload = {
                    "id": message.id,
                    "thread_id": message.thread_id,
                    "sender_id": message.sender_id,
                    "user_id": message.sender_id,
                    "content": message.content,
                    "author": author,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                    "is_deleted": message.is_deleted,
                    "is_edited": message.is_edited,
                }

                await manager.broadcast(channel_key, {"type": "message", "payload": payload})
            elif msg_type == "typing":
                await manager.broadcast(
                    channel_key,
                    {
                        "type": "typing",
                        "payload": {
                            "user_id": user.id,
                            "is_typing": bool(data.get("is_typing", True)),
                        },
                    },
                )
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(channel_key, websocket)
