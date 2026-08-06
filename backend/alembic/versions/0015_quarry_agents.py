"""quarry_agents (tarozi punkti agenti: token, sozlama, heartbeat) + events.source

Revision ID: 0015_quarry_agents
Revises: 0014_app_settings
Create Date: 2026-08-06

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015_quarry_agents"
down_revision: str | None = "0014_app_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quarry_agents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "quarry_id",
            sa.Uuid(),
            sa.ForeignKey("quarries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # token
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column(
            "token_issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        # sozlama (doc §3.2)
        sa.Column("video_quality", sa.String(16), server_default="auto", nullable=False),
        sa.Column("quality_profiles_override", sa.JSON(), nullable=True),
        sa.Column(
            "live_stream_enabled", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
        sa.Column("event_pre_seconds", sa.Integer(), server_default="5", nullable=False),
        sa.Column("event_post_seconds", sa.Integer(), server_default="5", nullable=False),
        sa.Column("min_event_weight_kg", sa.Integer(), server_default="500", nullable=False),
        sa.Column("stable_seconds", sa.Integer(), server_default="3", nullable=False),
        sa.Column("heartbeat_interval_sec", sa.Integer(), server_default="60", nullable=False),
        # heartbeat (doc §3.3)
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agent_version", sa.String(32), server_default="", nullable=False),
        sa.Column("scale_ok", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("cameras", sa.JSON(), nullable=True),
        sa.Column("queue_size", sa.Integer(), server_default="0", nullable=False),
        sa.Column("upload_kbps_avg", sa.Integer(), server_default="0", nullable=False),
        sa.Column("live_streaming", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("current_quality", sa.String(16), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    # Bitta karyerga bitta agent; token bo'yicha qidiruv har so'rovda bo'ladi.
    op.create_unique_constraint("uq_quarry_agents_quarry_id", "quarry_agents", ["quarry_id"])
    op.create_index("ix_quarry_agents_quarry_id", "quarry_agents", ["quarry_id"])
    op.create_unique_constraint("uq_quarry_agents_token", "quarry_agents", ["token"])
    op.create_index("ix_quarry_agents_token", "quarry_agents", ["token"])

    # Hodisa manbasi: mavjud qatorlar — local server ingesti.
    op.add_column(
        "events",
        sa.Column("source", sa.String(16), server_default="local", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("events", "source")
    op.drop_index("ix_quarry_agents_token", table_name="quarry_agents")
    op.drop_index("ix_quarry_agents_quarry_id", table_name="quarry_agents")
    op.drop_table("quarry_agents")
