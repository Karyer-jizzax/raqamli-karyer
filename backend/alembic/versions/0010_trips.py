"""trips (qatnov) — kon exit → main enter → main exit event linking

Revision ID: 0010_trips
Revises: 0009_event_uid_is_main
Create Date: 2026-07-10

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010_trips"
down_revision: str | None = "0009_event_uid_is_main"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quarry_id", sa.Uuid(), nullable=False),
        sa.Column("plate_region", sa.String(8), nullable=False),
        sa.Column("plate_number", sa.String(16), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("kon_exit_event_id", sa.Uuid(), nullable=True),
        sa.Column("main_enter_event_id", sa.Uuid(), nullable=True),
        sa.Column("main_exit_event_id", sa.Uuid(), nullable=True),
        sa.Column("enter_weight_kg", sa.Integer(), nullable=True),
        sa.Column("exit_weight_kg", sa.Integer(), nullable=True),
        sa.Column("netto_kg", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_trips"),
        sa.ForeignKeyConstraint(["quarry_id"], ["quarries.id"], name="fk_trips_quarry_id_quarries"),
        sa.ForeignKeyConstraint(
            ["kon_exit_event_id"], ["events.id"], name="fk_trips_kon_exit_event_id_events"
        ),
        sa.ForeignKeyConstraint(
            ["main_enter_event_id"], ["events.id"], name="fk_trips_main_enter_event_id_events"
        ),
        sa.ForeignKeyConstraint(
            ["main_exit_event_id"], ["events.id"], name="fk_trips_main_exit_event_id_events"
        ),
    )
    op.create_index("ix_trips_quarry_id", "trips", ["quarry_id"])
    op.create_index("ix_trips_plate_number", "trips", ["plate_number"])
    op.create_index("ix_trips_status", "trips", ["status"])
    op.create_index("ix_trips_started_at", "trips", ["started_at"])


def downgrade() -> None:
    op.drop_table("trips")
