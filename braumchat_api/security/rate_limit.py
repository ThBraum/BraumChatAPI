from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int


async def enforce_rate_limit(
    *,
    redis,
    key: str,
    rule: RateLimitRule,
    fail_open: bool = True,
) -> None:
    """Fixed-window rate limit.

    Incrementa um contador por (key, window) e aplica TTL no primeiro hit.

    Se ocorrer erro no Redis:
    - fail_open=True: não bloqueia a request.
    - fail_open=False: bloqueia com 503.
    """

    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, rule.window_seconds)
        if count > rule.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
            )
    except HTTPException:
        raise
    except Exception:
        if fail_open:
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Rate limiter unavailable",
        )
