"""cameras.brand/ip/login/password — connection details for local-server provisioning

Revision ID: 0013_camera_credentials
Revises: 0012_quarry_api_key
Create Date: 2026-07-12

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_camera_credentials"
down_revision: str | None = "0012_quarry_api_key"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cameras", sa.Column("brand", sa.String(16), nullable=False, server_default="dahua")
    )
    op.add_column("cameras", sa.Column("ip", sa.String(64), nullable=True))
    op.add_column("cameras", sa.Column("login", sa.String(64), nullable=True))
    op.add_column("cameras", sa.Column("password", sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column("cameras", "password")
    op.drop_column("cameras", "login")
    op.drop_column("cameras", "ip")
    op.drop_column("cameras", "brand")
