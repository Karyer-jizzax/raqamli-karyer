"""posts.role / default_direction / debounce_seconds + events.post_role

Karyer sxemasi shu paytgacha kodda qattiq yozilgan edi: nazorat nuqtasi faqat
"kon" yoki "tarozi" bo'la olardi, va buni baza emas, karyerdagi local server
o'z config faylidan hal qilib har hodisada `is_main` bilan yuborardi (API.md
§4). Tarozisi yo'q va kamerasi drabilka kirishida turgan karyerda bu ishlamaydi.

* `posts.role` — nuqtaning zanjirdagi o'rni (kon/kon_kirish/kon_chiqish/
  tarozi/drabilka). NULL = eski xatti-harakat, mavjud karyerlar o'zgarishsiz
  qoladi va payload'dagi `is_main` ishlatilaveradi.
* `posts.default_direction` — kamera yo'nalishni o'lchay olmaganda majburiy
  yo'nalish; usiz bunday hodisa qatnovga umuman ulanmasdi.
* `posts.debounce_seconds` — drabilka oldidagi navbatda bir mashina bir necha
  marta kadrga tushadi; shu oyna ichidagi takror o'tish sanalmaydi.
* `events.post_role` — hodisa yozilgan paytdagi rol nusxasi (post keyin
  tahrirlansa tarix buzilmasin, M-1 filtri/eksporti join'siz ishlasin).

Backfill nomdan taxmin qilmaydi: mavjud postlar NULL bo'lib qoladi va eski
yo'l bilan ishlaydi. Faqat `events.post_role` `is_main`dan to'ldiriladi, chunki
u hodisaning o'zida allaqachon bor ma'lumot.

Revision ID: 0018_post_roles
Revises: 0017_user_district_scope
Create Date: 2026-08-28

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018_post_roles"
down_revision: str | None = "0017_user_district_scope"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("role", sa.String(length=16), nullable=True))
    op.add_column("posts", sa.Column("default_direction", sa.String(length=8), nullable=True))
    op.add_column(
        "posts",
        sa.Column("debounce_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("events", sa.Column("post_role", sa.String(length=16), nullable=True))
    # Hodisadagi mavjud ma'lumotdan: tarozi hodisasi "tarozi", qolgani "kon".
    op.execute("UPDATE events SET post_role = CASE WHEN is_main THEN 'tarozi' ELSE 'kon' END")
    op.create_index("ix_events_post_role", "events", ["post_role"])


def downgrade() -> None:
    op.drop_index("ix_events_post_role", table_name="events")
    op.drop_column("events", "post_role")
    op.drop_column("posts", "debounce_seconds")
    op.drop_column("posts", "default_direction")
    op.drop_column("posts", "role")
