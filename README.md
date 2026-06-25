# Karier Kontrol

Karyerlardan chiqayotgan yuk avtotransporti va material hajmini AI kamera orqali real vaqtda
nazorat qiluvchi tizim (Jizzax viloyati, 13 tuman). Bu monorepo eski bitta-faylli HTML demoning
(`Karyerlar_Nazorati_Tizimi.html`) production-grade qayta qurilishi.

## Texnologiyalar

- **Backend:** Python 3.13 + FastAPI + async SQLAlchemy + Alembic
- **Baza:** PostgreSQL 16 + PostGIS
- **Frontend:** React 18 + TypeScript + Vite (3 ta app)
- **Monorepo:** pnpm workspaces + Turborepo
- **Auth:** rolli JWT (superadmin / department / operator)

## Tuzilma

```
apps/
  web-main/         Karyer YARATISH (superadmin)
  web-department/   Barcha karyerlarni monitoring (viloyat → tuman drill-down)
  web-quarry/       Karyer operatori (video, event, o'lchov bayonnomasi)
packages/
  ui/               Design-system (Tailwind v4 + demo CSS tokenlari)
  i18n/             uz-latn / uz-cyrl / ru lug'atlari
  api-client/       OpenAPI-generated tiplar + typed fetch + react-query hooks
  calc/             Hajm/status hisobi (TS preview port)
  types/            Umumiy enum/interfeyslar
  config/           Shared tsconfig/eslint/vite presetlar
backend/            FastAPI ilovasi
```

## Tez boshlash (Faza 0 skeleton)

### 1. Baza (PostGIS)

```bash
cp .env.example .env
docker compose up -d db
```

### 2. Backend

> `uv` tavsiya etiladi (https://docs.astral.sh/uv/). O'rnatilmagan bo'lsa `pip` bilan ham ishlaydi.

```bash
cd backend
# uv bilan:
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed
uv run uvicorn app.main:app --reload --port 8000

# yoki pip bilan:
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

Tekshirish: http://localhost:8000/health → `{"status":"ok"}`,
http://localhost:8000/api/v1/materials → 6 ta material, http://localhost:8000/docs → Swagger.

**Demo loginlar** (seed yaratadi):

| Login | Parol | Rol | App |
|---|---|---|---|
| `admin` | `admin123` | superadmin | web-main |
| `department` | `dept123` | department | web-department |
| `operator` | `oper123` | operator | web-quarry |

**OpenAPI → TS tip generatsiya** (backend ishlab turganda):

```bash
pnpm --filter @karier/api-client generate   # → packages/api-client/src/generated/schema.ts
```

### 3. Frontendlar

```bash
pnpm install
pnpm dev          # uchchala app birga
# yoki alohida:
pnpm dev:main         # http://localhost:5173
pnpm dev:department   # http://localhost:5174
pnpm dev:quarry       # http://localhost:5175
```

Har bir app login shell, til almashtirgich (UZ/ЎЗ/RU) va "backend connected" indikatorini ko'rsatadi.

## Yo'l xaritasi

- **Faza 0** — Skeleton ✅
- **Faza 1** — Auth + Quarries (web-main) ✅ — rolli JWT, regions+13 tuman, quarries CRUD, OpenAPI tip-gen
- **Faza 2** — Events + Volume (web-quarry) ✅ — events modeli, autoritativ volume service (parite test), scoped `GET /events`, operator UI (qayd + jonli preview + ro'yxat)
- **Faza 3** — Department monitoring + xarita ✅ — haqiqiy Jizzax SVG xaritasi (13 tuman drill-down), `/stats/overview` `/stats/m1` (8 filtr) `/stats/dynamics` `/regions/{id}/geo`, 86 karyer seed
- **Faza 4** — O'lchov bayonnomasi + hisobotlar ✅ — protocols modeli, real QR (qrcode), A4 print hujjati, M2-M5 agregat hisobotlar
- **Faza 5** — AI/CV integratsiya ✅ — media modeli + storage, almashtiriladigan `Detector` interfeysi (stub; YOLO keyin ulanadi), `/video/analyze` + `/video/ingest` (auto-event), web-quarry AI stansiyasi (bbox + plate overlay + autofill)

**Barcha 6 faza yakunlandi.** Backend: 23 ta test. To'liq reja: `Karier_Kontrol_Loyiha_Hujjati.docx` va arxitektura reja faylida.

### AI detektorni haqiqiy modelga ulash
`backend/app/services/detection.py` da `Detector` Protocol va `StubDetector` bor. Production uchun `YoloDetector` (ultralytics/ONNX + OpenCV) yozib, `get_detector()` ni almashtiring — boshqa hech narsa o'zgarmaydi.
