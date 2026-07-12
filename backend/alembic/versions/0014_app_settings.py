"""app_settings — runtime-tunable key/value settings (trip rules from web-main)

Revision ID: 0014_app_settings
Revises: 0013_camera_credentials
Create Date: 2026-07-12

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_app_settings"
down_revision: str | None = "0013_camera_credentials"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
