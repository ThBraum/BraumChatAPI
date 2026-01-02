from __future__ import annotations

from starlette.requests import Request


def _first_ip(value: str | None) -> str | None:
    if not value:
        return None
    # X-Forwarded-For can be: "client, proxy1, proxy2"
    first = value.split(",", 1)[0].strip()
    return first or None


def get_client_ip(request: Request, *, trust_proxy_headers: bool) -> str:
    if trust_proxy_headers:
        forwarded_for = request.headers.get("x-forwarded-for")
        ip = _first_ip(forwarded_for)
        if ip:
            return ip
        real_ip = request.headers.get("x-real-ip")
        ip = _first_ip(real_ip)
        if ip:
            return ip

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def get_client_ip_from_scope(scope: dict, *, trust_proxy_headers: bool) -> str:
    if trust_proxy_headers:
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        ip = _first_ip(headers.get("x-forwarded-for"))
        if ip:
            return ip
        ip = _first_ip(headers.get("x-real-ip"))
        if ip:
            return ip

    client = scope.get("client")
    if client and isinstance(client, (list, tuple)) and len(client) >= 1 and client[0]:
        return str(client[0])
    return "unknown"
