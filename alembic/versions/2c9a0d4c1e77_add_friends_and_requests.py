"""add friends and friend_requests

Revision ID: 2c9a0d4c1e77
Revises: 0b9f4f0f6b4a
Create Date: 2025-12-30

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2c9a0d4c1e77"
down_revision = "0b9f4f0f6b4a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "friends",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user1_id", sa.Integer(), nullable=False),
        sa.Column("user2_id", sa.Integer(), nullable=False),
        sa.CheckConstraint("user1_id < user2_id", name="ck_friends_order"),
        sa.ForeignKeyConstraint(["user1_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user2_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user1_id", "user2_id", name="uq_friends_users"),
    )
    op.create_index(op.f("ix_friends_id"), "friends", ["id"], unique=False)

    op.create_table(
        "friend_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("addressee_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["addressee_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("requester_id", "addressee_id", name="uq_friend_requests_users"),
    )
    op.create_index(op.f("ix_friend_requests_id"), "friend_requests", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_friend_requests_id"), table_name="friend_requests")
    op.drop_table("friend_requests")

    op.drop_index(op.f("ix_friends_id"), table_name="friends")
    op.drop_table("friends")
