"""Add workspace invites

Revision ID: 0b9f4f0f6b4a
Revises: 4f3d2c1a9e10
Create Date: 2025-12-24 00:00:00
"""

import sqlalchemy as sa

from alembic import op

revision = "0b9f4f0f6b4a"
down_revision = "4f3d2c1a9e10"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workspace_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("inviter_user_id", sa.Integer(), nullable=False),
        sa.Column("invitee_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_workspace_invites_workspace_id_workspaces"),
        ),
        sa.ForeignKeyConstraint(
            ["inviter_user_id"],
            ["users.id"],
            name=op.f("fk_workspace_invites_inviter_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["invitee_user_id"],
            ["users.id"],
            name=op.f("fk_workspace_invites_invitee_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace_invites")),
        sa.UniqueConstraint(
            "workspace_id",
            "invitee_user_id",
            "status",
            name="uq_workspace_invites_workspace_invitee_status",
        ),
    )
    op.create_index(op.f("ix_workspace_invites_id"), "workspace_invites", ["id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_workspace_invites_id"), table_name="workspace_invites")
    op.drop_table("workspace_invites")
