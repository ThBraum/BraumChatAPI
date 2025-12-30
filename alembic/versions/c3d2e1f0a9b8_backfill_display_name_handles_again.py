"""Backfill discord-style display_name for new rows

Revision ID: c3d2e1f0a9b8
Revises: 5a4f3d2b1c11
Create Date: 2025-12-30

"""

from __future__ import annotations

import random
import re

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c3d2e1f0a9b8"
down_revision = "5a4f3d2b1c11"
branch_labels = None
depends_on = None


_HANDLE_RE = re.compile(r"^(.{2,32})#(\d{4})$")


def _base_from_row(display_name: str | None, username: str | None, email: str) -> str:
    candidate = (display_name or "").strip()
    if candidate and "#" not in candidate:
        base = candidate
    else:
        candidate = (username or "").strip()
        if candidate and "#" not in candidate:
            base = candidate
        else:
            base = (email.split("@", 1)[0] or "user").strip()

    base = base.strip()
    if len(base) < 2:
        base = "user"
    if len(base) > 32:
        base = base[:32]
    base = base.replace("#", "")
    if len(base) < 2:
        base = "user"
    return base


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(sa.text("SELECT id, display_name, username, email FROM users")).fetchall()

    existing: set[str] = set()
    for r in rows:
        dn = (r.display_name or "").strip()
        if dn:
            existing.add(dn.lower())

    updates: list[tuple[int, str]] = []

    for r in rows:
        current = (r.display_name or "").strip()
        if current and _HANDLE_RE.match(current):
            continue

        base = _base_from_row(r.display_name, r.username, r.email)

        handle = None
        for _ in range(10000):
            code = f"{random.randint(0, 9999):04d}"
            candidate = f"{base}#{code}"
            if candidate.lower() not in existing:
                handle = candidate
                existing.add(candidate.lower())
                break

        if handle is None:
            code = f"{int(r.id) % 10000:04d}"
            candidate = f"{base}#{code}"
            suffix = 0
            while candidate.lower() in existing and suffix < 10000:
                code = f"{(int(r.id) + suffix) % 10000:04d}"
                candidate = f"{base}#{code}"
                suffix += 1
            handle = candidate
            existing.add(candidate.lower())

        updates.append((int(r.id), handle))

    for user_id, handle in updates:
        conn.execute(
            sa.text("UPDATE users SET display_name = :dn WHERE id = :id"),
            {"dn": handle, "id": user_id},
        )

    ctx = op.get_context()
    dialect = getattr(getattr(ctx, "dialect", None), "name", None)

    if dialect == "postgresql":
        op.execute(
            "ALTER TABLE users "
            "ADD CONSTRAINT ck_users_display_name_handle "
            "CHECK (display_name IS NULL OR display_name ~ '^.{2,32}#\\d{4}$')"
        )


def downgrade() -> None:
    ctx = op.get_context()
    dialect = getattr(getattr(ctx, "dialect", None), "name", None)

    if dialect == "postgresql":
        op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_display_name_handle")
