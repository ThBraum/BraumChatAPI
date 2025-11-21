"""Utilities for tracking realtime presence in Redis."""

from __future__ import annotations

from typing import List

from redis.asyncio.client import Redis

PRESENCE_KEY_PATTERN = "presence:w:{workspace_id}:c:{channel_id}"
PRESENCE_COUNT_KEY_PATTERN = "presence_counts:w:{workspace_id}:c:{channel_id}"


def _presence_key(workspace_id: int, channel_id: int) -> str:
    return PRESENCE_KEY_PATTERN.format(workspace_id=workspace_id, channel_id=channel_id)


def _count_key(workspace_id: int, channel_id: int) -> str:
    return PRESENCE_COUNT_KEY_PATTERN.format(workspace_id=workspace_id, channel_id=channel_id)


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