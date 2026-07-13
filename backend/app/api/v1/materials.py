"""Materials — reference data + superadmin CRUD."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.db.session import get_db
from app.models.event import Event
from app.models.material import Material
from app.schemas.material import MaterialCreate, MaterialOut, MaterialUpdate

router = APIRouter(prefix="/materials", tags=["materials"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_role("superadmin"))]


# Kirill harflarni lotinga o'girish — slug faqat [a-z0-9] dan iborat bo'lsin
_CYR = dict(zip(
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюяқғҳў",
    ["a", "b", "v", "g", "d", "e", "yo", "j", "z", "i", "y", "k", "l", "m", "n",
     "o", "p", "r", "s", "t", "u", "f", "x", "ts", "ch", "sh", "sh", "", "i",
     "", "e", "yu", "ya", "q", "g", "h", "u"],
))


def _slugify(name: str) -> str:
    s = "".join(_CYR.get(ch, ch) for ch in name.lower())
    s = re.sub(r"[^a-z0-9]+", "", s)
    # String(32) ustuniga suffiks ham sig'sin
    return s[:28] or "mahsulot"


async def _generate_material_id(db: AsyncSession, name: str) -> str:
    base = _slugify(name)
    if await db.get(Material, base) is None:
        return base
    for n in range(2, 100):
        candidate = f"{base}{n}"
        if await db.get(Material, candidate) is None:
            return candidate
    raise HTTPException(status.HTTP_409_CONFLICT, "Mahsulot ID band")


async def _get_material(db: AsyncSession, material_id: str) -> Material:
    material = await db.get(Material, material_id)
    if material is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi")
    return material


@router.get("", response_model=list[MaterialOut])
async def list_materials(db: DbDep) -> list[Material]:
    result = await db.execute(select(Material).order_by(Material.default_density))
    return list(result.scalars().all())


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
async def create_material(body: MaterialCreate, db: DbDep, _a: AdminDep) -> Material:
    data = body.model_dump()
    material_id = (data.get("id") or "").strip()
    data["id"] = material_id or await _generate_material_id(db, body.name_uz_latn)
    material = Material(**data)
    db.add(material)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Mahsulot ID band") from exc
    await db.refresh(material)
    return material


@router.patch("/{material_id}", response_model=MaterialOut)
async def update_material(
    material_id: str, body: MaterialUpdate, db: DbDep, _a: AdminDep
) -> Material:
    material = await _get_material(db, material_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(material, field, value)
    await db.commit()
    await db.refresh(material)
    return material


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(material_id: str, db: DbDep, _a: AdminDep) -> None:
    material = await _get_material(db, material_id)
    has_events = await db.execute(
        select(Event.id).where(Event.material_id == material_id).limit(1)
    )
    if has_events.first() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Bu mahsulot bo'yicha hodisalar mavjud"
        )
    await db.delete(material)
    await db.commit()
