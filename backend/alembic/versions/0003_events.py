"""events + vehicles

Revision ID: 0003_events
Revises: 0002_core_entities
Create Date: 2026-06-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_events"
down_revision: str | None = "0002_core_entities"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _ts() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plate_region", sa.String(8), nullable=False),
        sa.Column("plate_number", sa.String(16), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("vtype", sa.String(16), nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_vehicles"),
        sa.UniqueConstraint("plate_region", "plate_number", name="uq_vehicles_plate"),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quarry_id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=True),
        sa.Column("camera_id", sa.Uuid(), nullable=True),
        sa.Column("vehicle_id", sa.Uuid(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("material_id", sa.String(32), nullable=True),
        sa.Column("plate_region", sa.String(8), nullable=False),
        sa.Column("plate_number", sa.String(16), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_loaded", sa.Boolean(), nullable=False),
        sa.Column("vtype", sa.String(16), nullable=False),
        sa.Column("payer_type", sa.String(16), nullable=False),
        sa.Column("density", sa.Numeric(6, 3), nullable=False),
        sa.Column("weight_kg", sa.Integer(), nullable=False),
        sa.Column("length_m", sa.Numeric(6, 2), nullable=False),
        sa.Column("width_m", sa.Numeric(6, 2), nullable=False),
        sa.Column("height_m", sa.Numeric(6, 2), nullable=False),
        sa.Column("tent_cover_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("volume_camera", sa.Numeric(10, 2), nullable=True),
        sa.Column("volume_scale", sa.Numeric(10, 2), nullable=False),
        sa.Column("volume_final", sa.Numeric(10, 2), nullable=False),
        sa.Column("diff_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("volume_confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("material_confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("owner_name", sa.String(255), nullable=False),
        sa.Column("stir", sa.String(20), nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_events"),
        sa.ForeignKeyConstraint(["quarry_id"], ["quarries.id"], name="fk_events_quarry_id_quarries"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], name="fk_events_post_id_posts"),
        sa.ForeignKeyConstraint(["camera_id"], ["cameras.id"], name="fk_events_camera_id_cameras"),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], name="fk_events_vehicle_id_vehicles"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], name="fk_events_organization_id_organizations"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_events_created_by_users"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], name="fk_events_material_id_materials"),
    )
    op.create_index("ix_events_quarry_id", "events", ["quarry_id"])
    op.create_index("ix_events_occurred_at", "events", ["occurred_at"])
    op.create_index("ix_events_status", "events", ["status"])
    op.create_index("ix_events_quarry_occurred", "events", ["quarry_id", "occurred_at"])


def downgrade() -> None:
    op.drop_table("events")
    op.drop_table("vehicles")
