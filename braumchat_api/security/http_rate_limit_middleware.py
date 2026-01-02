from __future__ import annotations

from starlette.types import ASGIApp, Receive, Scope, Send

from ..security.client import get_client_ip_from_scope
from ..security.rate_limit import RateLimitRule, enforce_rate_limit


class HttpRateLimitMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        redis,
        settings,
        exempt_paths: set[str] | None = None,
    ):
        self.app = app
        self.redis = redis
        self.settings = settings
        self.exempt_paths = exempt_paths or set()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path") or ""
        if path in self.exempt_paths:
            await self.app(scope, receive, send)
            return

        ip = get_client_ip_from_scope(scope, trust_proxy_headers=self.settings.TRUST_PROXY_HEADERS)
        await enforce_rate_limit(
            redis=self.redis,
            key=f"rl:http:ip:{ip}",
            rule=RateLimitRule(limit=self.settings.RATE_LIMIT_HTTP_PER_MINUTE, window_seconds=60),
            fail_open=self.settings.RATE_LIMIT_FAIL_OPEN,
        )

        await self.app(scope, receive, send)
