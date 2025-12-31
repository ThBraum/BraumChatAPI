import re

import pytest


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    r = await client.get("/auth/me")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_login_rejects_invalid(client):
    r = await client.post("/auth/login", data={"username": "noone@example.com", "password": "bad"})
    assert r.status_code in (400, 401)


@pytest.mark.asyncio
async def test_register_generates_unique_discriminator(client):
    r1 = await client.post(
        "/auth/register",
        json={
            "email": "joao1@example.com",
            "password": "secret123",
            "display_name": "joao",
        },
    )
    assert r1.status_code == 200

    u1 = r1.json()
    assert re.match(r"^joao#\d{4}$", u1["display_name"], re.IGNORECASE)

    r2 = await client.post(
        "/auth/register",
        json={
            "email": "joao2@example.com",
            "password": "secret123",
            "display_name": "Joao",  # mesma base, deve gerar outro discriminador
        },
    )
    assert r2.status_code == 200

    u2 = r2.json()
    assert re.match(r"^Joao#\d{4}$", u2["display_name"]) or re.match(
        r"^joao#\d{4}$", u2["display_name"], re.IGNORECASE
    )
    assert u1["display_name"].lower() != u2["display_name"].lower()


@pytest.mark.asyncio
async def test_refresh_rotates_and_revokes_old_refresh_token(client):
    # Register
    r = await client.post(
        "/auth/register",
        json={
            "email": "mara@example.com",
            "password": "secret123",
            "display_name": "mara",
        },
    )
    assert r.status_code == 200

    # Login
    r = await client.post(
        "/auth/login",
        data={"username": "mara@example.com", "password": "secret123"},
    )
    assert r.status_code == 200
    tokens1 = r.json()
    assert tokens1.get("access_token")
    assert tokens1.get("refresh_token")

    # Refresh
    r = await client.post("/auth/refresh", json={"refresh_token": tokens1["refresh_token"]})
    assert r.status_code == 200
    tokens2 = r.json()
    assert tokens2.get("access_token")
    assert tokens2.get("refresh_token")
    assert tokens2["refresh_token"] != tokens1["refresh_token"]

    # Using the old refresh token again should now fail (session revoked)
    r = await client.post("/auth/refresh", json={"refresh_token": tokens1["refresh_token"]})
    assert r.status_code == 401

    # New refresh token still works
    r = await client.post("/auth/refresh", json={"refresh_token": tokens2["refresh_token"]})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_logout_revokes_session_and_blocks_refresh(client):
    # Register
    r = await client.post(
        "/auth/register",
        json={
            "email": "braum@example.com",
            "password": "secret123",
            "display_name": "braum",
        },
    )
    assert r.status_code == 200

    # Login
    r = await client.post(
        "/auth/login",
        data={"username": "braum@example.com", "password": "secret123"},
    )
    assert r.status_code == 200
    tokens = r.json()

    # Logout with refresh token
    r = await client.post(
        "/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert r.status_code == 204

    # Refresh should now fail
    r = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401
