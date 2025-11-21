"""Add direct message and user session tables

Revision ID: 7c1c8b3a5ab0
Revises: 891fb89f1e3b
Create Date: 2025-11-21 00:00:00
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7c1c8b3a5ab0'
down_revision = '891fb89f1e3b'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'direct_message_threads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('user1_id', sa.Integer(), nullable=False),
        sa.Column('user2_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_direct_message_threads_workspace_id_workspaces')),
        sa.ForeignKeyConstraint(['user1_id'], ['users.id'], name=op.f('fk_direct_message_threads_user1_id_users')),
        sa.ForeignKeyConstraint(['user2_id'], ['users.id'], name=op.f('fk_direct_message_threads_user2_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_direct_message_threads')),
        sa.UniqueConstraint('workspace_id', 'user1_id', 'user2_id', name='uq_dm_threads_workspace_users'),
    )
    op.create_index(op.f('ix_direct_message_threads_id'), 'direct_message_threads', ['id'], unique=False)

    op.create_table(
        'direct_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('is_edited', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['thread_id'], ['direct_message_threads.id'], name=op.f('fk_direct_messages_thread_id_direct_message_threads')),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], name=op.f('fk_direct_messages_sender_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_direct_messages')),
    )
    op.create_index(op.f('ix_direct_messages_id'), 'direct_messages', ['id'], unique=False)

    op.create_table(
        'user_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=64), nullable=False),
        sa.Column('user_agent', sa.String(length=512), nullable=True),
        sa.Column('ip_address', sa.String(length=128), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_sessions_user_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_sessions')),
        sa.UniqueConstraint('session_id', name=op.f('uq_user_sessions_session_id')),
    )
    op.create_index(op.f('ix_user_sessions_id'), 'user_sessions', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_user_sessions_id'), table_name='user_sessions')
    op.drop_table('user_sessions')
    op.drop_index(op.f('ix_direct_messages_id'), table_name='direct_messages')
    op.drop_table('direct_messages')
    op.drop_index(op.f('ix_direct_message_threads_id'), table_name='direct_message_threads')
    op.drop_table('direct_message_threads')
