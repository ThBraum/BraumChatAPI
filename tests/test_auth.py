import pytest
import re


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
    assert re.match(r"^Joao#\d{4}$", u2["display_name"]) or re.match(r"^joao#\d{4}$", u2["display_name"], re.IGNORECASE)
    assert u1["display_name"].lower() != u2["display_name"].lower()
