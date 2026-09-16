"""Ikkala ingest yo'li uchun umumiy qismlar.

Karyerdan hodisa ikki xil manbadan keladi:

* ANPR local server → `POST /api/weigh` (`app.api.weigh`)
* tarozi punkti agenti → `POST /api/agent/events` (`app.api.agent`, doc.txt)

Material tanlash va kamera aniqlash qoidalari ikkalasi uchun bir xil bo'lishi
shart — aks holda bitta karyerda ikki xil mantiq ishlab, hisobotlar bir-biriga
mos kelmay qoladi. Shuning uchun ular shu yerda, bitta joyda turadi.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.material import Material
from app.models.quarry import Camera, Post, quarry_materials


async def resolve_material(
    db: AsyncSession,
    quarry_id: object,
    local_id: str | None,
    local_conf: float | None,
    det_id: str | None,
    det_conf: float,
) -> tuple[Material | None, float, bool]:
    """Hodisa materialini aniqlash. Asosiy manba — karyerga biriktirilgan
    mahsulotlar ro'yxati; lokal YOLO taklifi ham, backend detektori ham shu
    ro'yxat bilan cheklanadi. Qaytaradi: (material, confidence, inspect?).

    * 1 ta biriktirilgan  → har doim o'sha (AI shart emas).
    * bir nechta          → lokal taklif ro'yxatda bo'lsa → qabul; bo'lmasa
                            detektor taklifi ro'yxatda bo'lsa → yoziladi, lekin
                            inspect (detektor yagona manba — operator
                            tasdiqlasin); hech biri mos kelmasa → birinchisi
                            yoziladi va inspect.
    * ro'yxat bo'sh       → eski xatti-harakat: lokal taklif > detektor.
    """
    assigned = list(
        (
            await db.execute(
                select(Material)
                .join(quarry_materials, quarry_materials.c.material_id == Material.id)
                .where(quarry_materials.c.quarry_id == quarry_id)
                .order_by(Material.default_density)
            )
        )
        .scalars()
        .all()
    )

    if len(assigned) == 1:
        return assigned[0], 100.0, False

    if assigned:
        by_id = {m.id: m for m in assigned}
        if local_id and local_id in by_id:
            return by_id[local_id], float(local_conf or 0.0), False
        if det_id and det_id in by_id:
            # Detektor taklifi yagona manba (lokal yo'q yoki ro'yxatdan
            # tashqarida) — tasodifiy taqsimlanib ketmasin, operator ko'rsin.
            return by_id[det_id], det_conf, True
        return assigned[0], 0.0, True

    for cand_id, conf in ((local_id, float(local_conf or 0.0)), (det_id, det_conf)):
        if cand_id:
            material = await db.get(Material, cand_id)
            if material is not None:
                return material, conf, False
    return None, 0.0, False


@dataclass(frozen=True)
class PostBinding:
    """Hodisa qaysi nuqtaga tushdi — postning zanjirdagi sozlamalari bilan."""

    post_id: UUID | None
    camera_id: UUID | None
    role: str | None = None
    default_direction: str | None = None
    debounce_seconds: int = 0

    @property
    def matched(self) -> bool:
        """Kamera bazadagi qatorga topildimi."""
        return self.camera_id is not None


async def resolve_camera(db: AsyncSession, quarry_id: UUID, camera_name: str | None) -> PostBinding:
    """Karyer ichida kamerani nomi yoki kodi bo'yicha topib, uning postini
    (rol, majburiy yo'nalish, debounce oynasi bilan birga) qaytarish.

    Topilmasa **taxmin qilinmaydi**: avval hodisa karyerning birinchi postiga
    biriktirilardi, natijada mos kelmagan kamera nomi jimgina noto'g'ri
    nuqtaga (masalan drabilka hodisasi zavod postiga) yozilardi. Endi bog'lanish
    bo'sh qaytadi va chaqiruvchi hodisani `inspect` qilib qo'yadi — operator
    kamera nomini to'g'rilaydi, ma'lumot esa yo'qolmaydi.
    """
    if not camera_name:
        return PostBinding(post_id=None, camera_id=None)

    row = (
        await db.execute(
            select(Camera.id, Post.id, Post.role, Post.default_direction, Post.debounce_seconds)
            .join(Post, Post.id == Camera.post_id)
            .where(Post.quarry_id == quarry_id)
            .where(or_(Camera.name == camera_name, Camera.code == camera_name))
            .limit(1)
        )
    ).first()
    if row is None:
        return PostBinding(post_id=None, camera_id=None)

    camera_id, post_id, role, default_direction, debounce_seconds = row
    return PostBinding(
        post_id=post_id,
        camera_id=camera_id,
        role=role,
        default_direction=default_direction,
        debounce_seconds=int(debounce_seconds or 0),
    )


async def find_debounced(
    db: AsyncSession,
    quarry_id: UUID,
    binding: PostBinding,
    plate_region: str,
    plate_number: str,
    occurred_at: datetime,
) -> Event | None:
    """Shu nuqtada, shu oyna ichida o'sha mashina allaqachon yozilganmi.

    Drabilka yoki darvoza oldida navbat bo'lganda bitta mashina kameraga bir
    necha marta tushadi — har biri alohida hodisa bo'lsa qatnovlar soni
    ko'payib ketadi. Oyna `posts.debounce_seconds` bilan har nuqtaga alohida
    sozlanadi (0 = o'chiq). Raqamsiz hodisa hech qachon birlashtirilmaydi:
    kimligi noma'lum ikki mashinani bitta deb hisoblab bo'lmaydi.
    """
    if binding.post_id is None or binding.debounce_seconds <= 0 or not plate_number:
        return None
    window = timedelta(seconds=binding.debounce_seconds)
    return (
        await db.execute(
            select(Event)
            .where(
                and_(
                    Event.quarry_id == quarry_id,
                    Event.post_id == binding.post_id,
                    Event.plate_region == plate_region,
                    Event.plate_number == plate_number,
                    Event.occurred_at >= occurred_at - window,
                    Event.occurred_at <= occurred_at + window,
                )
            )
            .order_by(Event.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
