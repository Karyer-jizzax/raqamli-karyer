"""Karyerning qatnov zanjiri — qaysi bosqichlar, qaysi tartibda kutiladi.

Zanjir avval kodda qattiq yozilgan edi (kon kirish → kon chiqish → tarozi
kirish → tarozi chiqish) va hamma karyerda bir xil deb faraz qilinardi.
Amalda u har xil: postini drabilkaga qo'ygan karyerda tarozi umuman yo'q,
ba'zisida esa mashina drabilkadan keyin zavodga ham boradi.

Shuning uchun zanjir **karyerdagi post rollaridan** chiqariladi (adminkada
post yaratilganda tanlanadi), `quarries.flow` esa qo'lda yozib qo'yish uchun
zaxira: to'ldirilgan bo'lsa avtomatik xulosa o'rniga o'sha ishlatiladi.

Bosqich `"<tugun>:<yo'nalish>"` ko'rinishida, masalan `"drabilka:enter"`.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quarry import Post, Quarry
from app.models.trip import NODE_DRABILKA, NODE_KON, NODE_TAROZI

# Post roli qaysi tugunga tegishli. Bir tomonlama darvozaning ikki roli ham
# bitta "kon" tuguniga tushadi — ular bitta nuqtaning ikki kamerasi.
ROLE_NODE: dict[str, str] = {
    "kon": NODE_KON,
    "kon_kirish": NODE_KON,
    "kon_chiqish": NODE_KON,
    "drabilka": NODE_DRABILKA,
    "tarozi": NODE_TAROZI,
}

# Mashina yo'lining tabiiy tartibi: karyerdan chiqadi → drabilka → zavod.
NODE_ORDER = (NODE_KON, NODE_DRABILKA, NODE_TAROZI)

# Rol belgilanmagan karyer — tizim shu paytgacha shu zanjirni bilardi.
LEGACY_FLOW = ("kon:enter", "kon:exit", "tarozi:enter", "tarozi:exit")


def node_for_event(post_role: str | None, is_main: bool) -> str:
    """Hodisa qaysi tugunda yozilgan. Rol yo'q eski hodisalar uchun `is_main`."""
    if post_role in ROLE_NODE:
        return ROLE_NODE[post_role]
    return NODE_TAROZI if is_main else NODE_KON


def _kon_directions(roles: set[str]) -> tuple[str, ...]:
    """Bir tomonlama darvoza faqat o'z yo'nalishini beradi; ikkalasi bo'lsa
    yoki umumiy `kon` bo'lsa — ikkalasi ham."""
    if "kon" in roles or {"kon_kirish", "kon_chiqish"} <= roles:
        return ("enter", "exit")
    if "kon_kirish" in roles:
        return ("enter",)
    if "kon_chiqish" in roles:
        return ("exit",)
    return ()


def _directions_from_posts(defaults: list[str | None]) -> tuple[str, ...]:
    """Drabilka uchun: postlarning majburiy yo'nalishlari. Hech bo'lmasa bitta
    post yo'nalishni o'zi aniqlasa (default yo'q) — ikkala tomon ham kutiladi.

    Bitta bir tomonlama kamera qo'yilgan drabilkada chiqish hodisasi hech qachon
    kelmaydi; agar baribir kutilsa, har bir qatnov "chala" (huquqbuzarlik)
    bo'lib ko'rinardi."""
    if not defaults or any(d is None for d in defaults):
        return ("enter", "exit")
    found = {d for d in defaults if d}
    return tuple(d for d in ("enter", "exit") if d in found)


def build_flow(posts: list[Post]) -> tuple[str, ...]:
    """Karyer postlaridan zanjir bosqichlarini yig'ish."""
    roles = {p.role for p in posts if p.role}
    if not roles:
        return LEGACY_FLOW

    steps: list[str] = []
    for node in NODE_ORDER:
        node_roles = {r for r in roles if ROLE_NODE.get(r) == node}
        if not node_roles:
            continue
        if node == NODE_KON:
            directions = _kon_directions(node_roles)
        elif node == NODE_TAROZI:
            # Tarozi doim ikki marta o'lchaydi: brutto va tara.
            directions = ("enter", "exit")
        else:
            directions = _directions_from_posts(
                [p.default_direction for p in posts if ROLE_NODE.get(p.role or "") == node]
            )
        steps.extend(f"{node}:{d}" for d in directions)
    return tuple(steps) or LEGACY_FLOW


async def quarry_flow(db: AsyncSession, quarry_id: UUID) -> tuple[str, ...]:
    """Shu karyerda kutiladigan bosqichlar, tartib bilan."""
    quarry = await db.get(Quarry, quarry_id)
    if quarry is not None and quarry.flow:
        # Qo'lda yozilgan tartib — avtomatik xulosadan ustun.
        return tuple(str(s) for s in quarry.flow)
    posts = list(
        (await db.execute(select(Post).where(Post.quarry_id == quarry_id))).scalars().all()
    )
    return build_flow(posts)


def has_scale(flow: tuple[str, ...]) -> bool:
    """Zanjirda ikkala tortish bormi — netto shundagina o'lchanadi."""
    return f"{NODE_TAROZI}:enter" in flow and f"{NODE_TAROZI}:exit" in flow
