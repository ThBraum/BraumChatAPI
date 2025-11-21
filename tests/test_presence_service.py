import asyncio

import pytest

from braumchat_api.services import presence_service


class FakeRedis:
    def __init__(self):
        self.hashes = {}
        self.sets = {}

    async def hincrby(self, key, field, amount):
        field = str(field)
        self.hashes.setdefault(key, {})
        self.hashes[key][field] = self.hashes[key].get(field, 0) + amount
        return self.hashes[key][field]

    async def sadd(self, key, member):
        member = str(member)
        self.sets.setdefault(key, set()).add(member)

    async def srem(self, key, member):
        member = str(member)
        if key in self.sets:
            self.sets[key].discard(member)

    async def hdel(self, key, field):
        field = str(field)
        if key in self.hashes:
            self.hashes[key].pop(field, None)

    async def smembers(self, key):
        return self.sets.get(key, set()).copy()


@pytest.mark.asyncio
async def test_presence_counts_and_listing():
    redis = FakeRedis()

    await presence_service.add_user(redis, 1, 2, 10)
    await presence_service.add_user(redis, 1, 2, 10)
    await presence_service.add_user(redis, 1, 2, 20)

    users = await presence_service.list_users(redis, 1, 2)
    assert users == [10, 20]

    await presence_service.remove_user(redis, 1, 2, 10)
    users = await presence_service.list_users(redis, 1, 2)
    assert users == [10, 20]

    await presence_service.remove_user(redis, 1, 2, 10)
    users = await presence_service.list_users(redis, 1, 2)
    assert users == [20]
