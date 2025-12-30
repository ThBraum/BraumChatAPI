"""Add username to users

Revision ID: 4f3d2c1a9e10
Revises: 7c1c8b3a5ab0
Create Date: 2025-12-24 00:00:00
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4f3d2c1a9e10"
down_revision = "7c1c8b3a5ab0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("username", sa.String(length=32), nullable=True))
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)


def downgrade():
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "username")
