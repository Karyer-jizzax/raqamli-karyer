"""trip_stops + trips.netto_source + quarries.flow

Qatnov shu paytgacha **to'rtta qattiq slot** edi (kon kirish/chiqish, tarozi
kirish/chiqish) va zanjir har karyerda bir xil deb faraz qilinardi. Drabilkali
karyerda zanjir boshqacha (karyer → drabilka, yoki karyer → drabilka → zavod)
va tarozi umuman bo'lmasligi mumkin — to'rtta ustunga bu sig'maydi.

* `trip_stops` — qatnovning to'xtashlari bolalar jadvali sifatida. Har qator
  bitta hodisa: zanjirdagi o'rni (`seq`), tuguni (`node`), yo'nalishi va
  o'lchangan vazni. `UNIQUE(trip_id, node, direction)` — bitta bosqich ikki
  marta yozilmaydi (local server qayta yuborsa ham).
* `trips.netto_source` — netto tarozida o'lchanganmi (`scale`) yoki qatnov
  faqat sanalganmi (`count`). Usiz tarozisiz karyerning hisoboti nol bo'lib
  ko'rinardi va "o'lchanmagan" bilan "yuk yo'q" farqlanmasdi.
* `quarries.flow` — zanjirning qo'lda belgilangan tartibi. NULL = karyerdagi
  post rollaridan avtomatik chiqariladi (odatdagi holat).

To'rtta eski ustun **o'chiriladi**: ikkita manba qolsa ular ertami-kechmi
bir-biriga mos kelmay qoladi. Chiqish tomonida (TripOut) o'sha nomlar
`trip_stops`dan hisoblanadigan xossa bo'lib qoladi, shuning uchun mavjud
frontend sinmaydi.

Revision ID: 0019_trip_stops
Revises: 0018_post_roles
Create Date: 2026-08-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0019_trip_stops"
down_revision: str | None = "0018_post_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (eski ustun, zanjirdagi o'rni, tugun, yo'nalish, vazn ustuni)
_SLOTS = (
    ("kon_enter_event_id", 0, "kon", "enter", None),
    ("kon_exit_event_id", 1, "kon", "exit", None),
    ("main_enter_event_id", 2, "tarozi", "enter", "enter_weight_kg"),
    ("main_exit_event_id", 3, "tarozi", "exit", "exit_weight_kg"),
)


def upgrade() -> None:
    op.create_table(
        "trip_stops",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "trip_id",
            sa.Uuid(),
            sa.ForeignKey("trips.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("node", sa.String(length=16), nullable=False),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("post_id", sa.Uuid(), sa.ForeignKey("posts.id"), nullable=True),
        sa.Column("event_id", sa.Uuid(), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("weight_kg", sa.Integer(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("trip_id", "node", "direction", name="uq_trip_stops_step"),
    )
    op.create_index("ix_trip_stops_trip_id", "trip_stops", ["trip_id"])
    op.create_index("ix_trip_stops_event_id", "trip_stops", ["event_id"])

    op.add_column("trips", sa.Column("netto_source", sa.String(length=8), nullable=True))
    op.add_column("quarries", sa.Column("flow", postgresql.JSONB(), nullable=True))

    for column, seq, node, direction, weight_col in _SLOTS:
        weight = f"t.{weight_col}" if weight_col else "NULL"
        op.execute(
            f"""
            INSERT INTO trip_stops
                (id, trip_id, seq, node, direction, post_id, event_id,
                 weight_kg, occurred_at, created_at, updated_at)
            SELECT gen_random_uuid(), t.id, {seq}, '{node}', '{direction}',
                   e.post_id, e.id, {weight}, e.occurred_at, now(), now()
            FROM trips t JOIN events e ON e.id = t.{column}
            """
        )
    # O'lchangan qatnovlar tarozida o'lchangan — sanalganlar keyin paydo bo'ladi.
    op.execute("UPDATE trips SET netto_source = 'scale' WHERE netto_kg IS NOT NULL")

    for column, *_ in _SLOTS:
        op.drop_column("trips", column)


def downgrade() -> None:
    for column, *_ in _SLOTS:
        op.add_column("trips", sa.Column(column, sa.Uuid(), nullable=True))
        op.create_foreign_key(f"fk_trips_{column}_events", "trips", "events", [column], ["id"])

    for column, _seq, node, direction, _weight in _SLOTS:
        op.execute(
            f"""
            UPDATE trips t SET {column} = s.event_id
            FROM trip_stops s
            WHERE s.trip_id = t.id AND s.node = '{node}' AND s.direction = '{direction}'
            """
        )

    op.drop_column("quarries", "flow")
    op.drop_column("trips", "netto_source")
    op.drop_index("ix_trip_stops_event_id", table_name="trip_stops")
    op.drop_index("ix_trip_stops_trip_id", table_name="trip_stops")
    op.drop_table("trip_stops")
