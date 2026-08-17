"""users.district_id — tuman darajasidagi departament hisobi

A department account was scoped to a viloyat only. Inspections are run by
tuman, so an account now optionally names its district: `district_id` set →
the user sees that tuman alone, empty → the whole region, exactly as before.

Revision ID: 0017_user_district_scope
Revises: 0016_drop_payer_type
Create Date: 2026-08-17

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_user_district_scope"
down_revision: str | None = "0016_drop_payer_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("district_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_users_district_id_districts", "users", "districts", ["district_id"], ["id"]
    )
    op.create_index("ix_users_district_id", "users", ["district_id"])


def downgrade() -> None:
    op.drop_index("ix_users_district_id", table_name="users")
    op.drop_constraint("fk_users_district_id_districts", "users", type_="foreignkey")
    op.drop_column("users", "district_id")
