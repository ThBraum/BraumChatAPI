from __future__ import annotations

from typing import Iterable

from redis.asyncio.client import Redis


UNREAD_KEY_PATTERN = "dm_unread:user:{user_id}:thread:{thread_id}"
LAST_READ_KEY_PATTERN = "dm_last_read:user:{user_id}:thread:{thread_id}"


def _unread_key(user_id: int, thread_id: int) -> str:
    return UNREAD_KEY_PATTERN.format(user_id=user_id, thread_id=thread_id)


def _last_read_key(user_id: int, thread_id: int) -> str:
    return LAST_READ_KEY_PATTERN.format(user_id=user_id, thread_id=thread_id)


async def increment_unread(redis: Redis, *, user_id: int, thread_id: int, delta: int = 1) -> int:
    return int(await redis.incrby(_unread_key(user_id, thread_id), delta))


async def clear_unread(redis: Redis, *, user_id: int, thread_id: int) -> None:
    await redis.delete(_unread_key(user_id, thread_id))


async def get_unread(redis: Redis, *, user_id: int, thread_id: int) -> int:
    raw = await redis.get(_unread_key(user_id, thread_id))
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0


async def get_unread_map(
    redis: Redis, *, user_id: int, thread_ids: Iterable[int]
) -> dict[int, int]:
    ids = [int(tid) for tid in thread_ids]
    if not ids:
        return {}
    pipe = redis.pipeline()
    for tid in ids:
        pipe.get(_unread_key(user_id, tid))
    results = await pipe.execute()
    out: dict[int, int] = {}
    for tid, raw in zip(ids, results):
        try:
            out[tid] = int(raw or 0)
        except (TypeError, ValueError):
            out[tid] = 0
    return out


async def set_last_read(redis: Redis, *, user_id: int, thread_id: int, message_id: int) -> int:
    # Store the max (don't regress when clients race).
    key = _last_read_key(user_id, thread_id)
    current_raw = await redis.get(key)
    try:
        current = int(current_raw or 0)
    except (TypeError, ValueError):
        current = 0
    next_value = max(current, int(message_id))
    await redis.set(key, str(next_value))
    return next_value


async def get_last_read(redis: Redis, *, user_id: int, thread_id: int) -> int:
    raw = await redis.get(_last_read_key(user_id, thread_id))
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0
