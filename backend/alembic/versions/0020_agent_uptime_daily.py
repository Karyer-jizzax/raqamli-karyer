"""agent_uptime_daily + quarry_agents.route

* `agent_uptime_daily` — karyer agentining kunlik onlayn/oflayn statistikasi.
* `quarry_agents.route` — agent asosiy yo'ldanmi (ingest) yoki zaxira
  yo'ldan (Cloudflare) kelyapti; asosiy yo'l yopilganini saytda ko'rsatish uchun.

Local server (karyer-local `netwatch.py`) kunlik yig'indini heartbeat'ning
`uptime` maydonida yuboradi: onlayn, internet yo'q, server javob bermadi,
kompyuter o'chiq — daqiqalarda, va uzilish oraliqlari. Bitta qator = bitta
karyerning bitta kuni, `(quarry_id, date)` bo'yicha UPSERT qilinadi.

Revision ID: 0020_agent_uptime_daily
Revises: 0019_trip_stops
Create Date: 2026-11-03

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_agent_uptime_daily"
down_revision: str | None = "0019_trip_stops"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "agent_uptime_daily",
        sa.Column(
            "quarry_id",
            sa.Uuid(),
            sa.ForeignKey("quarries.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("covered_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("online_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("net_down_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("server_down_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("agent_off_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("outages", sa.JSON(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column(
        "quarry_agents",
        sa.Column("route", sa.String(length=16), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("quarry_agents", "route")
    op.drop_table("agent_uptime_daily")
