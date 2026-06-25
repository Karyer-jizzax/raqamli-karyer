"""Materials endpoint — read-only reference data."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.material import Material
from app.schemas.material import MaterialOut

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("", response_model=list[MaterialOut])
async def list_materials(db: AsyncSession = Depends(get_db)) -> list[Material]:
    result = await db.execute(select(Material).order_by(Material.default_density))
    return list(result.scalars().all())
