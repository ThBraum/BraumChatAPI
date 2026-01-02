from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .metrics import HTTP_REQUEST_DURATION_SECONDS, HTTP_REQUESTS_TOTAL


class PrometheusMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, excluded_paths: set[str] | None = None):
        super().__init__(app)
        self._excluded_paths = excluded_paths or set()

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            try:
                route = request.scope.get("route")
                path_template = getattr(route, "path", None) or "__unmatched__"
                if path_template in self._excluded_paths:
                    return

                status_code = getattr(response, "status_code", 500)
                method = request.method
                duration = max(0.0, time.perf_counter() - start)

                HTTP_REQUESTS_TOTAL.labels(
                    method=method, path=path_template, status=str(status_code)
                ).inc()
                HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path_template).observe(
                    duration
                )
            except Exception:
                # Never break requests due to metrics.
                return
