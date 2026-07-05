"""events: event_uid (idempotency) + is_main — for API.md /api/weigh ingest

Revision ID: 0009_event_uid_is_main
Revises: 0008_drop_region_district_code
Create Date: 2026-07-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_event_uid_is_main"
down_revision: str | None = "0008_drop_region_district_code"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Idempotency key: the local server retries, so the same event_uid may
    # arrive many times — a UNIQUE index makes re-sends a no-op.
    op.add_column("events", sa.Column("event_uid", sa.Uuid(), nullable=True))
    op.create_unique_constraint("uq_events_event_uid", "events", ["event_uid"])

    # Main weighbridge vs kon checkpoint. Existing rows are main scale events.
    op.add_column(
        "events",
        sa.Column("is_main", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("events", "is_main", server_default=None)


def downgrade() -> None:
    op.drop_column("events", "is_main")
    op.drop_constraint("uq_events_event_uid", "events", type_="unique")
    op.drop_column("events", "event_uid")
