"""add_discord_style_display_name

Revision ID: 5a4f3d2b1c11
Revises: 2c9a0d4c1e77
Create Date: 2025-12-30

"""

from __future__ import annotations

import random
import re

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5a4f3d2b1c11"
down_revision = "2c9a0d4c1e77"
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
    # Evita '#', reservado para o discriminador.
    base = base.replace("#", "")
    if len(base) < 2:
        base = "user"
    return base


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(sa.text("SELECT id, display_name, username, email FROM users")).fetchall()

    existing = set()
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
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_display_name_lower ON users (lower(display_name))"
        )
    else:
        op.create_unique_constraint("uq_users_display_name", "users", ["display_name"])


def downgrade() -> None:
    ctx = op.get_context()
    dialect = getattr(getattr(ctx, "dialect", None), "name", None)

    if dialect == "postgresql":
        op.execute("DROP INDEX IF EXISTS uq_users_display_name_lower")
    else:
        op.drop_constraint("uq_users_display_name", "users", type_="unique")
