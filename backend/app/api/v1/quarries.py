"""Quarries CRUD + nested posts & cameras (web-main, superadmin)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models.quarry import Camera, Post, Quarry
from app.schemas.quarry import (
    CameraCreate,
    CameraOut,
    PostCreate,
    PostOut,
    QuarryCreate,
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


# ── cameras ────────────────────────────────────────────────────────────────
@router.get("/posts/{post_id}/cameras", response_model=list[CameraOut])
async def list_cameras(post_id: UUID, _user: CurrentUser, db: DbDep) -> list[Camera]:
    result = await db.execute(select(Camera).where(Camera.post_id == post_id))
    return list(result.scalars().all())


@router.post(
    "/posts/{post_id}/cameras", response_model=CameraOut, status_code=status.HTTP_201_CREATED
)
async def create_camera(post_id: UUID, body: CameraCreate, db: DbDep, _a: AdminDep) -> Camera:
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post topilmadi")
    camera = Camera(post_id=post_id, **body.model_dump())
    db.add(camera)
    await db.commit()
    await db.refresh(camera)
    return camera
