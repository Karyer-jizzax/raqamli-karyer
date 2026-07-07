"""protocols

Revision ID: 0005_protocols
Revises: 0004_district_geo
Create Date: 2026-06-25

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_protocols"
down_revision: str | None = "0004_district_geo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "protocols",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("verification_code", sa.String(32), nullable=False),
        sa.Column("qr_payload", sa.String(255), nullable=False),
        sa.Column("inspector_name", sa.String(128), nullable=False),
        sa.Column("operator_name", sa.String(128), nullable=False),
        sa.Column("driver_name", sa.String(128), nullable=False),
        sa.Column("normative_basis", sa.Text(), nullable=False),
        sa.Column(
            "issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_protocols"),
        sa.UniqueConstraint("event_id", name="uq_protocols_event_id"),
        sa.UniqueConstraint("number", name="uq_protocols_number"),
        sa.UniqueConstraint("verification_code", name="uq_protocols_verification_code"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="fk_protocols_event_id_events"),
    )
    op.create_index("ix_protocols_event_id", "protocols", ["event_id"])


def downgrade() -> None:
    op.drop_table("protocols")
