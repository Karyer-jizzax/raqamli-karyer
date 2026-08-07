# Karier Kontrol — ish rejasi

Holat: 2026-08-03. Manba: kod tahlili (`apps/`, `packages/`, `backend/`) + `promt.txt` qoldiqlari.
Ustuvorlik: **1) UI/UX + informatsiya arxitekturasi → 2) Dashboard/analitika → 3) o'lik funksiyalarni ulash → 4) texnik qarz.**

---

## 0. Hozirgi holat — diagnoz

Dizayn migratsiyasi (shadcn, tokenlar, `@karier/ui`ga birlashtirish) **tugagan**. Qolgan muammo dizayn emas — **ekranlar yetishmasligi va ish oqimi yo'qligi**.

| Ilova | Ekranlar | Muammo |
|---|---|---|
| `web-main` | 6 (Quarries, Posts, Materials, Departments, Geo, Settings) | Yaxshi — namuna |
| `web-department` | 3 nav + 2 drill-down | Nav 3 ta bo'lgani uchun "kam"; xarita bilan jadval orasida bog'liqlik yo'q |
| `web-quarry` | **1 ta sahifa** (router ham ulanmagan, `react-router-dom` bekor yotibdi) | Butun ilova bitta uzun sahifa + 2 tab |

O'lchangan bo'shliqlar:

- `/api/v1/stats/dynamics` (oylik dinamika) — frontendda **hech qayerda ishlatilmagan**. Hook bor (`useDynamics`), chaqiruvchi yo'q.
- `/api/v1/stats/reports/2..5` (M2 material, M3 to'lovchi turi, M4 tuman, M5 status) — **hech qayerda ishlatilmagan**. Hook bor (`useReport`), chaqiruvchi yo'q.
- `ProtocolViewer` / `ProtocolDocument` (`packages/ui/src/protocol.tsx`) — eksport qilingan, lekin **hech bir ilovada ochilmaydi**. Ya'ni huquqbuzarlik dalolatnomasi backendda bor, UIда yo'q.
- Grafik kutubxonasi umuman yo'q — dashboard raqamlardan iborat, trend ko'rinmaydi.

Xulosa: **backendда tayyor ma'lumot bor, frontend uni ko'rsatmayapti.** Eng arzon g'alaba shu yerda.

---

# A. SOFT — dasturiy ishlar

## A1. Informatsiya arxitekturasi ✅ BAJARILDI

Umumiy sidebar `packages/ui/src/app-shell.tsx` (`AppShell`) — router-free, ikkala ilova ishlatadi.
Eskirgan `AppHeader`/`TopNav`/`navLink` o'chirildi.

### A1.1 `web-quarry` — 1 sahifadan 5 ekranga ✅
Router ulash (`BrowserRouter` + sidebar/top-nav) va sahifalarga bo'lish:

| Yo'l | Ekran | Mazmun |
|---|---|---|
| `/` | **Dashboard** | KPI kartalar + bugungi/haftalik trend grafigi + oxirgi 10 hodisa lentasi + kamera holati |
| `/trips` | **Qatnovlar** | `TripsTable` (hozir tab ichida) |
| `/events` | **Hodisalar** | `M1Table` (hozir tab ichida) |
| `/inbox` | **Tekshirish kerak** ⚠️ | `no_plate` + `inspect` hodisalar; sidebarda sonli badge |
| `/cameras` | **Kameralar / postlar** | Postlar va kameralar holati (faol/nofaol, tur, IP) |

Qolgani (A2): dashboardga davr filtri, soatlik yuklama, kamera uptime tarixi.

### A1.2 `web-department` — 3 navdan 5 ga ✅
| Yo'l | Ekran | Holat |
|---|---|---|
| `/dashboard` | Dashboard (xarita) + drill-down | Bor — kengaytiriladi (A2) |
| `/quarries` | **Karyerlar ro'yxati** | ✅ yangi — qidiruv + tuman filtri, qator bosilsa drill-down'ga o'tadi |
| `/data` | Qatnovlar | Bor |
| `/events` | Hodisalar | Bor |
| `/violations` | **Huquqbuzarliklar** | ✅ yangi — 2 tab: chala qatnovlar + belgilangan hodisalar |
| `/analytics` | **Analitika** | ✅ dinamika + M2–M5, davr va tuman filtri |

### A1.3 Navigatsiya — qolgan ishlar
- `web-main` hali o'z sidebar'ini ishlatadi (tab state, router yo'q) — `AppShell`ga o'tkazish mumkin.
- Departamentda "Huquqbuzarliklar" uchun badge yo'q — arzon sanoq endpointi kerak (hozir 500 qator yuklamasdan sanab bo'lmaydi).
- Klaviatura: `/` → qidiruv, `g d` → dashboard kabi tezkor tugmalar (ixtiyoriy).

---

## A2. Dashboard va analitika ✅ BAJARILDI

### A2.1 Grafik kutubxonasi ✅
**Recharts** o'rnatildi; `packages/ui/src/charts.tsx` — barcha grafik primitivlari bitta joyda,
rang faqat tokendan (`--primary`, `--chart-context`, status ranglari), animatsiya o'chirilgan.
`StatTile`, `ChartCard` (jadval ko'rinishiga o'tish tugmasi bilan), `TrendColumns`, `RankBars`,
`SplitBar`, `BucketColumns`, `ChartTable`.
Qoidalar: bitta o'q (dual-axis yo'q), nominal ustunlar bitta rangda, ≥2 seriya uchun legenda,
har bir grafikning jadval nusxasi bor, davr almashganda eski raqam so'nadi (skeleton "sakramaydi").
`--chart-1..5` tokenlari app aksentidan ajratildi (avval `--chart-1 = --primary` bo'lib,
departamentda ikkita slot bir xil rangga tushardi) va CVD/kontrast bo'yicha tekshirildi.

### A2.2 Department Dashboard ✅
- KPI qatori: hodisalar, hajm, o'lchov ishonchi (o'tgan davrga nisbatan ↑↓), karyerlar, faol kameralar
- Oylik dinamika: tasdiqlangan / tasdiqlanmagan ustunlar (`useDynamics` — birinchi marta ishlatildi)
- Tumanlar reytingi: `useReport(4)`, hajm bo'yicha, top-8 + "Boshqalar"
- Xarita va drill-down saqlandi; davr filtri butun sahifani qamraydi

### A2.3 Quarry Dashboard ✅
- Yil/Oy davr filtri — KPI kartalar, soatlik grafik va status taqsimoti bir xil davrni o'qiydi
- Soatlik yuklama grafigi (M-1 jurnalidan, mijoz tomonida hisoblanadi)
- Holatlar taqsimoti (part-to-whole, status ranglari)
- Qolgani: kamera uptime tarixi (backendda hodisa tarixi yo'q — alohida endpoint kerak)

### A2.4 Analitika sahifasi ✅
`/analytics` — oylik dinamika (ustunlar), tasdiqlash darajasi (chiziq), M2 material (halqa),
M4 tuman (reyting); tuman + davr filtri, har bir karta jadvalga o'tadi. Excel eksporti hali
yo'q (M-1 eksporti bor) — kichik qolgan ish.

M3 (to'lovchi turi) olib tashlandi: yuridik/jismoniy/YaTT bo'linishi bu tizimda yo'q, va
ustun raqam seriyasidan taxmin qilinardi. Baza ustunlari ham tushirildi — migratsiya 0016.

### A2.5 Backend (A2 uchun qo'shildi)
- `/stats/reports/{n}` endi `date_from`/`date_to`/`district_id` oladi — avval hisobotlar
  davr filtrini butunlay e'tiborsiz qoldirardi (dashboardda filtrlangan va filtrlanmagan
  raqamlar yonma-yon turardi)
- `/stats/m1` ham `date_from`/`date_to` oladi
- Ikkalasiga test yozildi (`test_reports_period_filter`, `test_m1_period_filter`) — 58 test o'tdi

---

## A2.6 Tarozi punkti agenti (`doc.txt`) ✅ BAJARILDI — 2026-08-06

Ikkinchi, mustaqil ingest yo'li: KELI D12 tarozisi + kamera. ANPR yo'q, kanal
144 kbps'gacha sekin bo'lishi mumkin — shuning uchun hodisa **foto bilan darhol**,
video esa **keyin alohida** keladi.

**Backend** (`app/api/agent.py`, `app/api/v1/agents.py`, migratsiya `0015`)
- `quarry_agents` jadvali: token (berish/qayta generatsiya/bekor qilish), sozlama
  (doc §3.2), oxirgi heartbeat (doc §3.3). `events.source` ustuni qo'shildi.
- `POST /api/agent/events` (multipart, foto majburiy, `event_id` idempotent),
  `PUT /api/agent/events/{id}/video`, `GET /api/agent/config`,
  `POST /api/agent/heartbeat`, `POST /api/agent/live-snapshot`.
- Sayt tomoni: `GET/POST/DELETE /quarries/{id}/agent[/token]`,
  `PUT .../agent/config`, `GET /live-snapshot/{quarry}/{camera}`.
- Material/kamera aniqlash mantiqi `services/ingest.py`ga ko'chirildi — `/api/weigh`
  bilan bitta manba (ikki xil qoida bo'lib qolmasin).
- 10 ta yangi test (`test_agent.py`).

**Frontend**
- web-main: karyer qatorida 📻 tugmasi → token + holat + sozlama modali.
- web-quarry: `/live` sahifasi — WebRTC (WHEP) → HLS → JPEG kadr rejimi.
- Karyer sahifasida (ikkala ilovada) agent holati chizig'i; M-1 jadvalida
  "video yuklanmoqda…" holati.

**Infratuzilma:** `backend/mediamtx.yml`, `docker-compose.prod.yml --profile live`,
`.env.example`dagi `MEDIAMTX_*`. Sozlanmasa jonli oqim e'lon qilinmaydi —
hodisalar oqimi ta'sirlanmaydi.

**Qolgani:** agent hodisasi yo'nalishni bilmagani uchun qatnov (Trip) zanjiriga
ulanmaydi — kerak bo'lsa alohida qaror.

### A2.7 Navigatsiya soddalashtirildi — 2026-08-06
Jonli ko'rish ikkala ilovada ham bor: karyerda o'z karyeri, departamentda
tanlanadigan karyer (`LivePanel` — `@karier/ui`, ikkalasi bitta ekranni ishlatadi).
O'chirildi: departamentdagi **Huquqbuzarliklar** (chala qatnovlar va belgilangan
hodisalar — ular Qatnovlar/Hodisalar jadvallarida filtr bilan ham ko'rinadi),
karyerdagi **Kameralar** (faqat o'qish uchun ro'yxat edi — jonli ko'rish uni
almashtiradi) va **Tekshirish kerak** (M-1 jadvalidagi holat filtri bilan bir xil).
Eski yo'llar dashboardga qaytaradi, ishlatilmay qolgan i18n kalitlari o'chirildi.

---

## A3. Ulanmagan funksiyalarni ishga tushirish (3-navbat)

- **Protokol/dalolatnoma** — `ProtocolViewer` ni hodisa qatoridan ochish, `POST /protocols` bilan yaratish, chop etish (print CSS).
- **Raqam tuzatish tarixi** — tuzatish o'zi bor (`no_plate` qatoridagi tugma → `FixPlateModal`), lekin kim va qachon tuzatgani ko'rinmaydi. Audit izini qo'shish.
- **Media** — foto/video ko'rish `media.tsx`da bor; lightbox, klaviatura bilan yurish, "dalil" sifatida yuklab olish tugmasi.
- **Tarozi ko'rsatkichi** (`/scale/reading`) — quarry dashboard'da jonli qiymat sifatida.
- **Trip qoidalari** (`/settings/trip-rules`) — web-main'da bor; department uchun "faqat o'qish" ko'rinishida ko'rsatish (inspektor qaysi qoida bo'yicha huquqbuzarlik belgilanganini bilsin).

## A4. Ma'lumot sifati va ish oqimi

- **"Tekshirish kerak" navbati** — bitta joyda: `inspect=true`, raqamsiz, netto anomaliya, juftlanmagan qatnov. Har biri uchun harakat tugmasi.
- **Filtrlarni URL'ga yozish** — hozir filtr sahifa yangilansa yo'qoladi; havola bilan bo'lishib bo'lmaydi.
- **Saqlangan filtrlar / davr** — inspektor har safar qayta tanlamasin (localStorage).
- **Eksport** — M1 Excel bor; qatnovlar va hisobotlar uchun ham qo'shish, PDF (protokol) alohida.

## A5. Texnik qarz

- **Dark mode** — tokenlar oklch'da tayyor, `.dark` klassi hech qayerda qo'yilmaydi, ba'zi joyda `bg-white` qattiq yozilgan. Alohida ish.
- **Realtime / avto-yangilanish** — hozir faqat react-query default. Dashboard uchun 30s polling yoki SSE.
- **Skeleton/empty/error** — asosiy jadvallarda bor, yangi ekranlarda ham bo'lsin.
- **i18n** — yangi matnlar uch tilda (uz-latn / uz-cyrl / ru).
- **Ruxsatlar** — rol bo'yicha ekran ko'rinishi (`operator` protokol yaratolmasin va h.k.).
- **Bundle** — Recharts qo'shilgach lazy-load qilish, `pnpm build` hajmini kuzatish.

## A6. Backend — `promt.txt`dan qolgan ishlar

1. **Stub-detektor material tayinlashi** (`backend/app/api/weigh.py`, `_resolve_material`) — karyerda >1 material bo'lsa va local `material_id` yubormasa, tasodifiy taklif inspektsiz qabul bo'lyapti. Fix: `inspect=True` qilish + test.
2. **Kamera nomi noyobligi** (`backend/app/api/v1/quarries.py`) — bir karyerda ikkita bir xil nomli kamera bo'lsa, `weigh` ixtiyoriy postga biriktiradi. Yaratish/tahrirlashda 409 qaytarish.
3. **`is_loaded=True` qattiq yozilgan** (`weigh.py`) — yo netto'dan hisoblansin, yo hisobotlardan chiqarilsin. Past ustuvorlik.
4. **Prod test-ma'lumotlarini tozalash** — skript tayyor (`backend/scripts/purge_test_events.py`); prod DB'da **ishga tushirish qolgan**.
5. **Dashboard uchun yangi endpointlar** (A2 talab qilsa): soatlik taqsimot, kamera uptime tarixi, davrlararo taqqoslash (o'tgan oyga nisbatan %).

---

# B. HARD — jihoz va infratuzilma

> Bu qismni siz bajarasiz (kod emas). Ba'zilari taxminim — tasdiqlashingiz kerak.

## B1. Shoshilinch

1. **Kamera soatlari / NTP** — Dahua `.110` ichki soati ~3.5 soat xato. Suratlardagi OSD vaqt noto'g'ri → **dalil qiymati buziladi**. To'rttala kamerada tekshirib, NTP server ko'rsatish (yoki qo'lda to'g'rilash) va UTC+5 tanlash.
2. **Local server EXE qayta build** — hozirgi `dist/` oxirgi ~15 tuzatishdan oldingi. Tarqatishdan oldin qayta qurish (`console=False`).
3. **Har bir karyerda local server versiyasini tekshirish** — qaysi karyerda qaysi versiya ishlayotgani hozir noma'lum.

## B2. Kamera va o'lchov

4. **Kamera burchagi va fokusi** — ANPR o'qish foizi past postlarni aniqlab, burchak/ekspozitsiyani sozlash (`det_debug.log` bo'yicha birga ko'ramiz).
5. **Tungi yoritish / IR** — kechqurun raqam o'qilmasa, ishning yarmi yo'qoladi.
6. **Tarozi kalibratsiyasi va sertifikati** — netto hisob shunga tayanadi; muddati o'tgan bo'lsa hisobot yuridik kuchini yo'qotadi.
7. **Kamera–post bog'lanishi** — bazadagi kamera nomi jihozdagi nom bilan mos kelishini tekshirish (A6.2 bilan juft).

## B3. Uzluksizlik

8. **UPS** — elektr uzilishida local server va kamera o'chsa, qatnov ro'yxatga tushmaydi.
9. **Internet zaxirasi** — 4G modem/SIM. Outbox 10 daqiqa kutadi, undan keyin videosiz jo'natadi.
10. **Disk hajmi** — 14 kunlik video retention bor; disk to'lishini har karyerda o'lchash.

## B4. Prod server (`api.raqamli-karyer.uz`)

11. **Backup** — PostgreSQL avtomatik zaxira + tiklashni bir marta sinab ko'rish.
12. **Media disk** — foto/video o'sishi kuzatilsin, kvota va tozalash siyosati.
13. **Monitoring/alert** — backend o'lsa yoki karyerdan 6 soat hodisa kelmasa xabar (Telegram bot yetarli).
14. **HTTPS sertifikat avtoyangilanishi** — tekshirish.

---

## Taklif qilingan tartib

| Bosqich | Ish | Natija |
|---|---|---|
| ~~1~~ | ~~A1.1 + A1.2 — ekranlarni ajratish, nav~~ | ✅ bajarildi |
| ~~2~~ | ~~A2.1 + A2.2 — grafik + department dashboard~~ | ✅ bajarildi |
| ~~3~~ | ~~A2.3 + A2.4 — quarry dashboard, analitika~~ | ✅ bajarildi |
| 4 | A3 + A4 — protokol, plate tuzatish, inbox | Ish oqimi paydo bo'ladi |
| 5 | A6 (1,2,4) + B1 | Prod ma'lumot sifati |
| 6 | A5 — dark mode, realtime, sayqal | — |

B1 (kamera NTP, EXE) — **soft ishlarga parallel, kutmaydi.**
