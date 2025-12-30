import pytest


async def _register(client, *, email: str, password: str, display_name: str) -> None:
    r = await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": display_name,
        },
    )
    assert r.status_code == 200


async def _login(client, *, email: str, password: str) -> dict:
    r = await client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert r.status_code == 200
    return r.json()


@pytest.mark.asyncio
async def test_workspace_and_channel_acl_blocks_non_member(client):
    await _register(client, email="owner@example.com", password="secret123", display_name="owner")
    await _register(client, email="outsider@example.com", password="secret123", display_name="outsider")

    owner_tokens = await _login(client, email="owner@example.com", password="secret123")
    outsider_tokens = await _login(client, email="outsider@example.com", password="secret123")

    # Owner creates workspace
    r = await client.post(
        "/workspaces/",
        json={"name": "Acme", "slug": "acme"},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert r.status_code == 200
    ws = r.json()

    # Outsider cannot fetch workspace
    r = await client.get(
        f"/workspaces/{ws['id']}",
        headers={"Authorization": f"Bearer {outsider_tokens['access_token']}"},
    )
    assert r.status_code == 403

    # Owner creates channel
    r = await client.post(
        f"/channels/workspaces/{ws['id']}/channels",
        json={"name": "general", "is_private": False},
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )
    assert r.status_code == 200
    ch = r.json()

    # Outsider cannot list channels in workspace
    r = await client.get(
        f"/channels/workspaces/{ws['id']}/channels",
        headers={"Authorization": f"Bearer {outsider_tokens['access_token']}"},
    )
    assert r.status_code == 403

    # Outsider cannot fetch channel by id
    r = await client.get(
        f"/channels/{ch['id']}",
        headers={"Authorization": f"Bearer {outsider_tokens['access_token']}"},
    )
    assert r.status_code == 403

    # Outsider cannot post message
    r = await client.post(
        f"/channels/{ch['id']}/messages",
        json={"content": "hello", "client_id": "t1"},
        headers={"Authorization": f"Bearer {outsider_tokens['access_token']}"},
    )
    assert r.status_code == 403
