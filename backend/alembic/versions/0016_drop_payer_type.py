"""drop payer_type from events and organizations

The "yuridik shaxs / jismoniy shaxs / YaTT" split is not a distinction this
system makes. On events it was never entered by anyone — it was guessed from the
plate series (`A123BC` → indiv, everything else → legal) and then reported as if
it were a fact; on organizations it was a column nothing ever read.

Dropping it loses those values. That is the point: they were derived, not
observed, so nothing is lost that the plate itself doesn't still carry.
`downgrade` puts the columns back with their old default, not with the old
values.

Revision ID: 0016_drop_payer_type
Revises: 0015_quarry_agents
Create Date: 2026-08-08

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016_drop_payer_type"
down_revision: str | None = "0015_quarry_agents"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("events", "payer_type")
    op.drop_column("organizations", "payer_type")


def downgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("payer_type", sa.String(16), nullable=False, server_default="legal"),
    )
    op.add_column(
        "events",
        sa.Column("payer_type", sa.String(16), nullable=False, server_default="legal"),
    )
