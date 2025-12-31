import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import braumchat_api.models  # noqa: F401 - ensure models are registered
from braumchat_api.api.deps import get_db_dep
from braumchat_api.main import app
from braumchat_api.models.meta import Base


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_db_dep():
        async with TestSession() as s:
            yield s

    app.dependency_overrides[get_db_dep] = _override_get_db_dep

    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.pop(get_db_dep, None)


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session

    await engine.dispose()
