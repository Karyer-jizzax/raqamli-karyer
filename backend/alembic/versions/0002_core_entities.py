"""core entities: regions, districts, organizations, users, quarries, posts, cameras

Revision ID: 0002_core_entities
Revises: 0001_init
Create Date: 2026-06-25

"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0002_core_entities"
down_revision: str | None = "0001_init"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _ts() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "regions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("name_uz_latn", sa.String(64), nullable=False),
        sa.Column("name_uz_cyrl", sa.String(64), nullable=False),
        sa.Column("name_ru", sa.String(64), nullable=False),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("MULTIPOLYGON", srid=4326, spatial_index=False),
            nullable=True,
        ),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_regions"),
        sa.UniqueConstraint("code", name="uq_regions_code"),
    )

    op.create_table(
        "districts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("region_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(16), nullable=False),
        sa.Column("name_uz_latn", sa.String(64), nullable=False),
        sa.Column("name_uz_cyrl", sa.String(64), nullable=False),
        sa.Column("name_ru", sa.String(64), nullable=False),
        sa.Column("is_capital", sa.Boolean(), nullable=False),
        sa.Column("svg_path", sa.Text(), nullable=True),
        sa.Column(
            "geom",
            geoalchemy2.Geometry("MULTIPOLYGON", srid=4326, spatial_index=False),
            nullable=True,
        ),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_districts"),
        sa.UniqueConstraint("code", name="uq_districts_code"),
        sa.ForeignKeyConstraint(
            ["region_id"], ["regions.id"], name="fk_districts_region_id_regions"
        ),
    )
    op.create_index("ix_districts_region_id", "districts", ["region_id"])

    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("stir", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("payer_type", sa.String(16), nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        sa.UniqueConstraint("stir", name="uq_organizations_stir"),
    )
    op.create_index("ix_organizations_stir", "organizations", ["stir"])

    # users.quarry_id FK added after quarries (circular dependency).
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(128), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("quarry_id", sa.Uuid(), nullable=True),
        sa.Column("region_id", sa.Uuid(), nullable=True),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.ForeignKeyConstraint(
            ["region_id"], ["regions.id"], name="fk_users_region_id_regions"
        ),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "quarries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("district_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "location",
            geoalchemy2.Geometry("POINT", srid=4326, spatial_index=False),
            nullable=True,
        ),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_quarries"),
        sa.UniqueConstraint("code", name="uq_quarries_code"),
        sa.ForeignKeyConstraint(
            ["district_id"], ["districts.id"], name="fk_quarries_district_id_districts"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_quarries_organization_id_organizations",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name="fk_quarries_created_by_users"
        ),
    )
    op.create_index("ix_quarries_district_id", "quarries", ["district_id"])
    op.create_index("ix_quarries_code", "quarries", ["code"])

    # Close the circular FK: users.quarry_id -> quarries.id
    op.create_foreign_key(
        "fk_users_quarry_id_quarries", "users", "quarries", ["quarry_id"], ["id"]
    )

    op.create_table(
        "posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quarry_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_posts"),
        sa.UniqueConstraint("code", name="uq_posts_code"),
        sa.ForeignKeyConstraint(
            ["quarry_id"], ["quarries.id"], name="fk_posts_quarry_id_quarries"
        ),
    )
    op.create_index("ix_posts_quarry_id", "posts", ["quarry_id"])
    op.create_index("ix_posts_code", "posts", ["code"])

    op.create_table(
        "cameras",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("stream_url", sa.String(512), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *_ts(),
        sa.PrimaryKeyConstraint("id", name="pk_cameras"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], name="fk_cameras_post_id_posts"),
    )
    op.create_index("ix_cameras_post_id", "cameras", ["post_id"])


def downgrade() -> None:
    op.drop_table("cameras")
    op.drop_table("posts")
    op.drop_constraint("fk_users_quarry_id_quarries", "users", type_="foreignkey")
    op.drop_table("quarries")
    op.drop_table("users")
    op.drop_table("organizations")
    op.drop_table("districts")
    op.drop_table("regions")
