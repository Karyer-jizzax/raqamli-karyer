"""quarries.api_key — per-quarry local-server ingest key (provisioning)

Revision ID: 0012_quarry_api_key
Revises: 0011_trip_kon_enter
Create Date: 2026-07-10

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_quarry_api_key"
down_revision: str | None = "0011_trip_kon_enter"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Generated on first provision-token issue; NULL until then. The global
    # WEIGH_API_KEYS env list keeps working alongside for old installs.
    op.add_column("quarries", sa.Column("api_key", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_quarries_api_key", "quarries", ["api_key"])


def downgrade() -> None:
    op.drop_constraint("uq_quarries_api_key", "quarries", type_="unique")
    op.drop_column("quarries", "api_key")
