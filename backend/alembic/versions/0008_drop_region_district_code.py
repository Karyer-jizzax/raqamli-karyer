"""drop code from regions/districts — not needed for hududlar

Revision ID: 0008_drop_region_district_code
Revises: 0007_quarry_materials
Create Date: 2026-07-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_drop_region_district_code"
down_revision: str | None = "0007_quarry_materials"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_districts_code", "districts", type_="unique")
    op.drop_column("districts", "code")
    op.drop_constraint("uq_regions_code", "regions", type_="unique")
    op.drop_column("regions", "code")


def downgrade() -> None:
    op.add_column("regions", sa.Column("code", sa.String(16), nullable=False, server_default=""))
    op.create_unique_constraint("uq_regions_code", "regions", ["code"])
    op.alter_column("regions", "code", server_default=None)

    op.add_column("districts", sa.Column("code", sa.String(16), nullable=False, server_default=""))
    op.create_unique_constraint("uq_districts_code", "districts", ["code"])
    op.alter_column("districts", "code", server_default=None)
