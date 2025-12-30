"""Utilities for tracking realtime presence in Redis."""

from __future__ import annotations

import asyncio
from typing import Iterable, List

from redis.asyncio.client import Redis

PRESENCE_KEY_PATTERN = "presence:w:{workspace_id}:c:{channel_id}"
PRESENCE_COUNT_KEY_PATTERN = "presence_counts:w:{workspace_id}:c:{channel_id}"

USER_ONLINE_KEY_PATTERN = "online:user:{user_id}"
USER_ONLINE_COUNT_KEY_PATTERN = "online_count:user:{user_id}"
USER_ONLINE_TTL_SECONDS = 75
USER_ONLINE_HEARTBEAT_SECONDS = 30


def _presence_key(workspace_id: int, channel_id: int) -> str:
    return PRESENCE_KEY_PATTERN.format(workspace_id=workspace_id, channel_id=channel_id)


def _count_key(workspace_id: int, channel_id: int) -> str:
    return PRESENCE_COUNT_KEY_PATTERN.format(workspace_id=workspace_id, channel_id=channel_id)


def _online_key(user_id: int) -> str:
    return USER_ONLINE_KEY_PATTERN.format(user_id=user_id)


def _online_count_key(user_id: int) -> str:
    return USER_ONLINE_COUNT_KEY_PATTERN.format(user_id=user_id)


async def add_user(redis: Redis, workspace_id: int, channel_id: int, user_id: int) -> int:
    """Increment the presence count for the user and add them to the set when first seen."""

    count_key = _count_key(workspace_id, channel_id)
    presence_key = _presence_key(workspace_id, channel_id)

    count = await redis.hincrby(count_key, user_id, 1)
    if count == 1:
        await redis.sadd(presence_key, user_id)
    return count


async def remove_user(redis: Redis, workspace_id: int, channel_id: int, user_id: int) -> int:
    """Decrement the presence count and remove from the set when it hits zero."""

    count_key = _count_key(workspace_id, channel_id)
    presence_key = _presence_key(workspace_id, channel_id)

    count = await redis.hincrby(count_key, user_id, -1)
    if count <= 0:
        await redis.hdel(count_key, user_id)
        await redis.srem(presence_key, user_id)
        count = 0
    return count


async def list_users(redis: Redis, workspace_id: int, channel_id: int) -> List[int]:
    presence_key = _presence_key(workspace_id, channel_id)
    members = await redis.smembers(presence_key)
    return sorted(int(user_id) for user_id in members)


async def set_user_online(redis: Redis, user_id: int) -> None:
    await redis.set(_online_key(user_id), "1", ex=USER_ONLINE_TTL_SECONDS)


async def set_user_offline(redis: Redis, user_id: int) -> None:
    await redis.delete(_online_key(user_id))


async def online_connect(redis: Redis, user_id: int) -> int:
    """Increment user's online connection count and mark as online."""

    count = await redis.incr(_online_count_key(user_id))
    await set_user_online(redis, user_id)
    return int(count)


async def online_disconnect(redis: Redis, user_id: int) -> int:
    """Decrement user's online connection count and mark offline at zero."""

    key = _online_count_key(user_id)
    count = await redis.decr(key)
    if int(count) <= 0:
        await redis.delete(key)
        await set_user_offline(redis, user_id)
        return 0
    return int(count)


async def is_user_online(redis: Redis, user_id: int) -> bool:
    return bool(await redis.exists(_online_key(user_id)))


async def get_online_map(redis: Redis, user_ids: Iterable[int]) -> dict[int, bool]:
    ids = list(user_ids)
    if not ids:
        return {}

    pipe = redis.pipeline()
    for uid in ids:
        pipe.exists(_online_key(uid))
    results = await pipe.execute()
    return {uid: bool(exists) for uid, exists in zip(ids, results)}


async def online_heartbeat(redis: Redis, user_id: int) -> None:
    """Refresh the user's online key until cancelled."""

    try:
        while True:
            await set_user_online(redis, user_id)
            await asyncio.sleep(USER_ONLINE_HEARTBEAT_SECONDS)
    except asyncio.CancelledError:
        # Caller is responsible for setting offline when appropriate.
        raise
