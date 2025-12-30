import asyncio
import os
import sys
import time
from logging.config import fileConfig

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import braumchat_api.models  # noqa: F401
from braumchat_api.config import get_settings  # type: ignore
from braumchat_api.models.meta import Base  # type: ignore

config = context.config

settings = get_settings()

db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_async_engine(db_url, future=True)

    async def run():
        async with connectable.begin() as connection:
            lock_key = int(os.getenv("ADVISORY_LOCK_KEY", "987654321"))
            lock_timeout = int(os.getenv("MIGRATE_LOCK_TIMEOUT", "600"))
            start = time.time()

            while True:
                try:
                    res = await connection.execute(
                        text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_key}
                    )
                    got = res.scalar()
                except Exception:
                    got = False

                if got:
                    break
                if time.time() - start >= lock_timeout:
                    raise RuntimeError(f"Timed out acquiring advisory lock after {lock_timeout}s")
                await asyncio.sleep(1)

            try:
                await connection.run_sync(do_run_migrations)
            finally:
                try:
                    await connection.execute(
                        text("SELECT pg_advisory_unlock(:k)"), {"k": lock_key}
                    )
                except Exception:
                    pass

    asyncio.run(run())


if context.is_offline_mode():
    raise RuntimeError("Offline mode not supported")
else:
    run_migrations_online()
