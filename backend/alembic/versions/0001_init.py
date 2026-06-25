"""init: postgis extension + materials table

Revision ID: 0001_init
Revises:
Create Date: 2026-06-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_init"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # PostGIS must exist before any geometry columns are created (Faza 1+).
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "materials",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("default_density", sa.Numeric(5, 2), nullable=False),
        sa.Column("density_min", sa.Numeric(5, 2), nullable=False),
        sa.Column("density_max", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_tent", sa.Boolean(), nullable=False),
        sa.Column("name_uz_latn", sa.String(length=64), nullable=False),
        sa.Column("name_uz_cyrl", sa.String(length=64), nullable=False),
        sa.Column("name_ru", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_materials"),
    )


def downgrade() -> None:
    op.drop_table("materials")
