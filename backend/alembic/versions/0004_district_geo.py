"""district label centroid columns

Revision ID: 0004_district_geo
Revises: 0003_events
Create Date: 2026-06-25

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_district_geo"
down_revision: str | None = "0003_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("districts", sa.Column("center_x", sa.Numeric(8, 2), nullable=True))
    op.add_column("districts", sa.Column("center_y", sa.Numeric(8, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("districts", "center_y")
    op.drop_column("districts", "center_x")
