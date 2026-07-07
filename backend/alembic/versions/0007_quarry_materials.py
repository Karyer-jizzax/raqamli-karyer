"""quarry_materials — which materials a quarry produces/handles

Revision ID: 0007_quarry_materials
Revises: 0006_media
Create Date: 2026-07-03

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_quarry_materials"
down_revision: str | None = "0006_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quarry_materials",
        sa.Column("quarry_id", sa.Uuid(), nullable=False),
        sa.Column("material_id", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("quarry_id", "material_id", name="pk_quarry_materials"),
        sa.ForeignKeyConstraint(
            ["quarry_id"],
            ["quarries.id"],
            name="fk_quarry_materials_quarry_id_quarries",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["material_id"],
            ["materials.id"],
            name="fk_quarry_materials_material_id_materials",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("quarry_materials")
