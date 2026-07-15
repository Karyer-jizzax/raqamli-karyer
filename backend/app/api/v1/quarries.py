"""Quarries CRUD + nested posts & cameras (web-main, superadmin)."""

import secrets
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, insert, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user, require_role
from app.core.security import create_provision_token
from app.db.session import get_db
from app.models.material import Material
from app.models.quarry import Camera, Post, Quarry, quarry_materials
from app.schemas.material import MaterialOut
from app.schemas.quarry import (
    CameraCreate,
    CameraOut,
    CameraUpdate,
    PostCreate,
    PostOut,
    PostUpdate,
    ProvisionTokenOut,
    ProvisionTokenRequest,
    QuarryCreate,
    QuarryMaterialsUpdate,
    QuarryOut,
    QuarryUpdate,
)

router = APIRouter(tags=["quarries"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AdminDep = Annotated[object, Depends(require_role("superadmin"))]


async def _get_quarry(db: AsyncSession, quarry_id: UUID) -> Quarry:
    quarry = await db.get(Quarry, quarry_id)
    if quarry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Karyer topilmadi")
    return quarry


async def _get_post(db: AsyncSession, post_id: UUID) -> Post:
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post topilmadi")
    return post


async def _get_camera(db: AsyncSession, camera_id: UUID) -> Camera:
    camera = await db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kamera topilmadi")
    return camera


async def _ensure_camera_unique(
    db: AsyncSession,
    quarry_id: UUID,
    *,
    name: str | None = None,
    code: str | None = None,
    exclude_id: UUID | None = None,
) -> None:
    """Bir karyer ichida kamera name/code takrorlanmasin: weigh ingest kamerani
    karyer bo'yicha name/code orqali qidiradi (.limit(1)), dublikat bo'lsa
    hodisa ixtiyoriy postga biriktirilib qoladi."""
    conds = []
    if name:
        conds.append(Camera.name == name)
    if code:
        conds.append(Camera.code == code)
    if not conds:
        return
    stmt = (
        select(Camera.id)
        .join(Post, Post.id == Camera.post_id)
        .where(Post.quarry_id == quarry_id)
        .where(or_(*conds))
        .limit(1)
    )
    if exclude_id is not None:
        stmt = stmt.where(Camera.id != exclude_id)
    if (await db.execute(stmt)).scalar_one_or_none() is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Bu karyerda shunday nomli yoki kodli kamera bor"
        )


@router.get("/quarries", response_model=list[QuarryOut])
async def list_quarries(_user: CurrentUser, db: DbDep) -> list[Quarry]:
    result = await db.execute(select(Quarry).order_by(Quarry.created_at.desc()))
    return list(result.scalars().all())


@router.post("/quarries", response_model=QuarryOut, status_code=status.HTTP_201_CREATED)
async def create_quarry(
    body: QuarryCreate, db: DbDep, user: Annotated[object, Depends(get_current_user)], _a: AdminDep
) -> Quarry:
    quarry = Quarry(**body.model_dump(), created_by=user.id)  # type: ignore[attr-defined]
    db.add(quarry)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Karyer kodi band") from exc
    await db.refresh(quarry)
    return quarry


@router.get("/quarries/{quarry_id}", response_model=QuarryOut)
async def get_quarry(quarry_id: UUID, _user: CurrentUser, db: DbDep) -> Quarry:
    return await _get_quarry(db, quarry_id)


@router.patch("/quarries/{quarry_id}", response_model=QuarryOut)
async def update_quarry(
    quarry_id: UUID, body: QuarryUpdate, db: DbDep, _a: AdminDep
) -> Quarry:
    quarry = await _get_quarry(db, quarry_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(quarry, field, value)
    await db.commit()
    await db.refresh(quarry)
    return quarry


@router.post("/quarries/{quarry_id}/provision-token", response_model=ProvisionTokenOut)
async def issue_provision_token(
    quarry_id: UUID, body: ProvisionTokenRequest, db: DbDep, _a: AdminDep
) -> ProvisionTokenOut:
    """One paste-able token for the quarry local server's first-run setup.

    The local server exchanges it at GET /api/local/config for its full
    configuration (quarry code, ingest api_key, expected camera names).
    Re-issuing reuses the existing api_key so already-installed servers
    keep working.
    """
    quarry = await _get_quarry(db, quarry_id)
    if not quarry.api_key:
        quarry.api_key = secrets.token_urlsafe(24)
        await db.commit()
        await db.refresh(quarry)
    token = create_provision_token(str(quarry.id), body.server_url.rstrip("/"))
    return ProvisionTokenOut(
        token=token,
        expires_hours=settings.provision_token_expire_hours,
        quarry_code=quarry.code,
    )


@router.delete("/quarries/{quarry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quarry(quarry_id: UUID, db: DbDep, _a: AdminDep) -> None:
    quarry = await _get_quarry(db, quarry_id)
    await db.delete(quarry)
    await db.commit()


# ── posts ──────────────────────────────────────────────────────────────────
@router.get("/quarries/{quarry_id}/posts", response_model=list[PostOut])
async def list_posts(quarry_id: UUID, _user: CurrentUser, db: DbDep) -> list[Post]:
    result = await db.execute(select(Post).where(Post.quarry_id == quarry_id))
    return list(result.scalars().all())


@router.post(
    "/quarries/{quarry_id}/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED
)
async def create_post(quarry_id: UUID, body: PostCreate, db: DbDep, _a: AdminDep) -> Post:
    await _get_quarry(db, quarry_id)
    post = Post(quarry_id=quarry_id, **body.model_dump())
    db.add(post)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Post kodi band") from exc
    await db.refresh(post)
    return post


@router.patch("/posts/{post_id}", response_model=PostOut)
async def update_post(post_id: UUID, body: PostUpdate, db: DbDep, _a: AdminDep) -> Post:
    post = await _get_post(db, post_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(post_id: UUID, db: DbDep, _a: AdminDep) -> None:
    post = await _get_post(db, post_id)
    await db.delete(post)
    await db.commit()


# ── cameras ────────────────────────────────────────────────────────────────
@router.get("/posts/{post_id}/cameras", response_model=list[CameraOut])
# superadmin-only: CameraOut carries camera credentials (login/password)
async def list_cameras(post_id: UUID, db: DbDep, _a: AdminDep) -> list[Camera]:
    result = await db.execute(select(Camera).where(Camera.post_id == post_id))
    return list(result.scalars().all())


@router.post(
    "/posts/{post_id}/cameras", response_model=CameraOut, status_code=status.HTTP_201_CREATED
)
async def create_camera(post_id: UUID, body: CameraCreate, db: DbDep, _a: AdminDep) -> Camera:
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post topilmadi")
    await _ensure_camera_unique(db, post.quarry_id, name=body.name, code=body.code)
    camera = Camera(post_id=post_id, **body.model_dump())
    db.add(camera)
    await db.commit()
    await db.refresh(camera)
    return camera


@router.patch("/cameras/{camera_id}", response_model=CameraOut)
async def update_camera(camera_id: UUID, body: CameraUpdate, db: DbDep, _a: AdminDep) -> Camera:
    camera = await _get_camera(db, camera_id)
    updates = body.model_dump(exclude_unset=True)
    if updates.get("name"):
        post = await _get_post(db, camera.post_id)
        await _ensure_camera_unique(
            db, post.quarry_id, name=updates["name"], exclude_id=camera.id
        )
    for field, value in updates.items():
        setattr(camera, field, value)
    await db.commit()
    await db.refresh(camera)
    return camera


@router.delete("/cameras/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(camera_id: UUID, db: DbDep, _a: AdminDep) -> None:
    camera = await _get_camera(db, camera_id)
    await db.delete(camera)
    await db.commit()


# ── materials (products a quarry produces) ─────────────────────────────────
@router.get("/quarries/{quarry_id}/materials", response_model=list[MaterialOut])
async def list_quarry_materials(quarry_id: UUID, _user: CurrentUser, db: DbDep) -> list[Material]:
    await _get_quarry(db, quarry_id)
    result = await db.execute(
        select(Material)
        .join(quarry_materials, quarry_materials.c.material_id == Material.id)
        .where(quarry_materials.c.quarry_id == quarry_id)
        .order_by(Material.default_density)
    )
    return list(result.scalars().all())


@router.put("/quarries/{quarry_id}/materials", response_model=list[MaterialOut])
async def set_quarry_materials(
    quarry_id: UUID, body: QuarryMaterialsUpdate, db: DbDep, _a: AdminDep
) -> list[Material]:
    await _get_quarry(db, quarry_id)
    await db.execute(delete(quarry_materials).where(quarry_materials.c.quarry_id == quarry_id))
    if body.material_ids:
        try:
            await db.execute(
                insert(quarry_materials),
                [{"quarry_id": quarry_id, "material_id": mid} for mid in set(body.material_ids)],
            )
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Noto'g'ri mahsulot ID") from exc
    else:
        await db.commit()
    result = await db.execute(
        select(Material)
        .join(quarry_materials, quarry_materials.c.material_id == Material.id)
        .where(quarry_materials.c.quarry_id == quarry_id)
        .order_by(Material.default_density)
    )
    return list(result.scalars().all())
