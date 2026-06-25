"""Seed reference + demo data.

Run: uv run python -m scripts.seed   (or: python -m scripts.seed)
Idempotent — safe to run multiple times.
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.material import Material
from app.models.quarry import Camera, Post, Quarry
from app.models.region import District, Region
from app.models.user import User

# (id, default_density, min, max, is_tent, uz-latn, uz-cyrl, ru)
MATERIALS = [
    ("shagal", 1.50, 1.40, 1.60, False, "Shag'al", "Шағал", "Гравий"),
    ("qumshagal", 1.55, 1.45, 1.65, False, "Qum-shag'al", "Қум-шағал", "Песчано-гравийная смесь"),
    ("qurilishqum", 1.60, 1.50, 1.70, False, "Qurilish qumi", "Қурилиш қуми", "Строительный песок"),
    ("tosh", 1.70, 1.60, 1.80, False, "Tosh", "Тош", "Камень"),
    ("ohak", 0.50, 0.45, 0.60, False, "Ohak", "Оҳак", "Известь"),
    ("tent", 1.55, 1.40, 1.70, True, "Tent qoplangan", "Тент қопланган", "Под тентом"),
]

REGION = ("JIZ", "Jizzax viloyati", "Жиззах вилояти", "Джизакская область")

# (code, uz-latn, uz-cyrl, ru, is_capital)
DISTRICTS = [
    ("JIZ-ARN", "Arnasoy", "Арнасой", "Арнасай", False),
    ("JIZ-BAX", "Baxmal", "Бахмал", "Бахмаль", False),
    ("JIZ-DOS", "Do'stlik", "Дўстлик", "Дустлик", False),
    ("JIZ-FOR", "Forish", "Фориш", "Фариш", False),
    ("JIZ-GAL", "G'allaorol", "Ғаллаорол", "Галляарал", False),
    ("JIZ-SHR", "Sharof Rashidov", "Шароф Рашидов", "Шараф Рашидов", False),
    ("JIZ-MIR", "Mirzacho'l", "Мирзачўл", "Мирзачуль", False),
    ("JIZ-PAX", "Paxtakor", "Пахтакор", "Пахтакор", False),
    ("JIZ-YAN", "Yangiobod", "Янгиобод", "Янгиабад", False),
    ("JIZ-ZOM", "Zomin", "Зомин", "Заамин", False),
    ("JIZ-ZAF", "Zafarobod", "Зафаробод", "Зафарабад", False),
    ("JIZ-ZAR", "Zarbdor", "Зарбдор", "Зарбдар", False),
    ("JIZ-CITY", "Jizzax sh.", "Жиззах ш.", "г. Джизак", True),
]

# (username, password, full_name, role)
USERS = [
    ("admin", "admin123", "Bosh administrator", "superadmin"),
    ("department", "dept123", "Departament nazoratchisi", "department"),
    ("operator", "oper123", "Karyer operatori", "operator"),
]


async def seed() -> None:
    async with SessionLocal() as db:
        # Materials
        for mid, rho, lo, hi, tent, nl, nc, nr in MATERIALS:
            await db.execute(
                insert(Material)
                .values(
                    id=mid, default_density=rho, density_min=lo, density_max=hi,
                    is_tent=tent, name_uz_latn=nl, name_uz_cyrl=nc, name_ru=nr,
                )
                .on_conflict_do_nothing(index_elements=["id"])
            )

        # Region (Jizzax)
        region = (
            await db.execute(select(Region).where(Region.code == REGION[0]))
        ).scalar_one_or_none()
        if region is None:
            region = Region(
                code=REGION[0], name_uz_latn=REGION[1], name_uz_cyrl=REGION[2], name_ru=REGION[3]
            )
            db.add(region)
            await db.flush()

        # Districts
        for code, nl, nc, nr, cap in DISTRICTS:
            exists = (
                await db.execute(select(District).where(District.code == code))
            ).scalar_one_or_none()
            if exists is None:
                db.add(
                    District(
                        region_id=region.id, code=code,
                        name_uz_latn=nl, name_uz_cyrl=nc, name_ru=nr, is_capital=cap,
                    )
                )
        await db.flush()

        # Map geometry (real Jizzax SVG paths) + quarries matching demo counts.
        map_file = Path(__file__).parent / "jizzax_map.json"
        if map_file.exists():
            map_data = json.loads(map_file.read_text(encoding="utf-8"))
            by_name = {d["n"]["uz-latn"]: d for d in map_data["d"]}
            districts = list(
                (await db.execute(select(District))).scalars().all()
            )
            for dist in districts:
                md = by_name.get(dist.name_uz_latn)
                if not md:
                    continue
                dist.svg_path = md["d"]
                dist.center_x = md["cx"] + md.get("ox", 0)
                dist.center_y = md["cy"] + md.get("oy", 0)
                # Seed quarries up to the demo count (idempotent by code).
                have = (
                    await db.execute(
                        select(func.count()).select_from(Quarry).where(
                            Quarry.district_id == dist.id
                        )
                    )
                ).scalar() or 0
                for n in range(have + 1, md["c"] + 1):
                    db.add(
                        Quarry(
                            district_id=dist.id,
                            name=f"{dist.name_uz_latn} karyer {n}",
                            code=f"{dist.code}-Q{n}",
                            status="active",
                        )
                    )
            await db.flush()

        # Demo quarry + post + camera in the first district (for the operator).
        first_district = (
            await db.execute(
                select(District).where(District.code == DISTRICTS[0][0])
            )
        ).scalar_one()
        demo_quarry = (
            await db.execute(select(Quarry).where(Quarry.code == "DEMO-1"))
        ).scalar_one_or_none()
        if demo_quarry is None:
            demo_quarry = Quarry(
                district_id=first_district.id,
                name="Demo karyer",
                code="DEMO-1",
                status="active",
            )
            db.add(demo_quarry)
            await db.flush()
            post = Post(quarry_id=demo_quarry.id, code="0613-01", name="Asosiy post")
            db.add(post)
            await db.flush()
            db.add(
                Camera(post_id=post.id, code="R-1-KA1", name="Kamera 1", kind="plate")
            )

        # Users (department scoped to region, operator to the demo quarry)
        for username, password, full_name, role in USERS:
            exists = (
                await db.execute(select(User).where(User.username == username))
            ).scalar_one_or_none()
            if exists is None:
                db.add(
                    User(
                        username=username,
                        password_hash=hash_password(password),
                        full_name=full_name,
                        role=role,
                        region_id=region.id if role == "department" else None,
                        quarry_id=demo_quarry.id if role == "operator" else None,
                    )
                )

        # Ensure an already-seeded operator is bound to the demo quarry.
        operator = (
            await db.execute(select(User).where(User.username == "operator"))
        ).scalar_one_or_none()
        if operator is not None and operator.quarry_id is None:
            operator.quarry_id = demo_quarry.id

        await db.commit()

    async with SessionLocal() as db:
        mats = (await db.execute(select(func.count()).select_from(Material))).scalar()
        dists = (await db.execute(select(func.count()).select_from(District))).scalar()
        users = (await db.execute(select(func.count()).select_from(User))).scalar()
    print(f"Seed complete — {mats} materials, {dists} districts, {users} users.")
    print("Logins: admin/admin123 (superadmin), department/dept123, operator/oper123")


if __name__ == "__main__":
    asyncio.run(seed())
