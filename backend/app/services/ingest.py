"""Ikkala ingest yo'li uchun umumiy qismlar.

Karyerdan hodisa ikki xil manbadan keladi:

* ANPR local server → `POST /api/weigh` (`app.api.weigh`)
* tarozi punkti agenti → `POST /api/agent/events` (`app.api.agent`, doc.txt)

Material tanlash va kamera aniqlash qoidalari ikkalasi uchun bir xil bo'lishi
shart — aks holda bitta karyerda ikki xil mantiq ishlab, hisobotlar bir-biriga
mos kelmay qoladi. Shuning uchun ular shu yerda, bitta joyda turadi.
"""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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


async def resolve_camera(
    db: AsyncSession, quarry_id: UUID, camera_name: str | None
) -> tuple[UUID | None, UUID | None]:
    """Karyer ichida kamerani nomi yoki kodi bo'yicha topish.

    Qaytaradi `(post_id, camera_id)`. Kamera topilmasa hodisa yo'qolmasin —
    karyerning birinchi postiga biriktiriladi (M-1 ustunlari bo'sh qolmasligi
    uchun), kamera esa NULL bo'ladi.
    """
    if camera_name:
        cam = (
            await db.execute(
                select(Camera)
                .join(Post, Post.id == Camera.post_id)
                .where(Post.quarry_id == quarry_id)
                .where(or_(Camera.name == camera_name, Camera.code == camera_name))
                .limit(1)
            )
        ).scalar_one_or_none()
        if cam is not None:
            return cam.post_id, cam.id

    post_id = (
        await db.execute(select(Post.id).where(Post.quarry_id == quarry_id).limit(1))
    ).scalar_one_or_none()
    return post_id, None
