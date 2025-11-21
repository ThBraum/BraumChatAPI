from redis import asyncio as redis_asyncio

from ..config import get_settings

_settings = get_settings()

redis = redis_asyncio.from_url(
    _settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)

__all__ = ["redis"]
