"""trips.kon_enter_event_id — karyer kirish bosqichi

Revision ID: 0011_trip_kon_enter
Revises: 0010_trips
Create Date: 2026-07-10

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_trip_kon_enter"
down_revision: str | None = "0010_trips"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("kon_enter_event_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_trips_kon_enter_event_id_events", "trips", "events", ["kon_enter_event_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_trips_kon_enter_event_id_events", "trips", type_="foreignkey")
    op.drop_column("trips", "kon_enter_event_id")
