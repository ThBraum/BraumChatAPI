import pytest


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    r = await client.get("/auth/me")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_login_rejects_invalid(client):
    r = await client.post("/auth/login", data={"username": "noone@example.com", "password": "bad"})
    assert r.status_code in (400, 401)
