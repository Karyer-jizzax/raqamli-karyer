# PROMPT — web-department va web-quarry UI/UX to'liq qayta ishlash

> Bu faylni Claude Code'ga bering: `UI-REDESIGN-PROMT.md faylini o'qi va bajar.`

---

## 0. Ishni boshlashdan oldin

1. `frontend-design` skill'ini yukla (vizual yo'nalish uchun), `emil-design-eng` skill'ini ham (mayda detallar, animatsiya, "his qilinadigan sifat" uchun).
2. Bu faylni oxirigacha o'qi.
3. **Plan mode'da rejani tuz**, tasdiqlangandan keyin kod yoz. Bu katta ish — bir zarbada qilma.
4. Layout qarorlarini **o'zing** qabul qil. Quyida natija mezonlari va cheklovlar bor, piksel-ko'rsatma emas. Qayerga nima joylashishini sen hal qil.

---

## 1. Vazifa

`apps/web-department` va `apps/web-quarry` ilovalarining UI/UX'ini to'liq qayta ishla. Hozir ular xunuk, chalkash va tartibsiz. Natija professional, yaxlit va bir tizimga bo'ysunadigan interfeys bo'lishi kerak.

Bu **"chiroyli rang tanlash" vazifasi emas.** Bu ikki ilova Tailwind migratsiyasidan o'tmay qolgan — `packages/ui/src/globals.css:3-4` buni ochiq yozib qo'ygan:

```
/* Legacy design tokens + .kk-* classes — kept so the not-yet-migrated apps
   (web-department, web-quarry) that still use inline styles keep rendering. */
```

Ya'ni asosiy ish — **tugallanmagan migratsiyani tugatish**: mavjud dizayn tizimidan foydalanish va uch marta ko'chirib yozilgan sahifalarni birlashtirish. Vizual sifat shundan keyin o'z-o'zidan keladi.

---

## 2. Mahsulot konteksti

**Karier Kontrol** — Jizzax viloyati karyerlarini davlat nazorati tizimi. Karyerlardan chiqayotgan qurilish materiallari hisobga olinadi: kameralar avtomobil raqamini o'qiydi (ANPR), tarozi og'irlikni o'lchaydi, tizim har bir qatnovni zanjirga bog'lab netto yukni hisoblaydi va huquqbuzarliklarni ko'rsatadi.

Monorepoda 3 ta frontend:

| Ilova | Foydalanuvchi | Rol | Holati |
|---|---|---|---|
| `web-main` | Superadmin | Karyer/material/geo/foydalanuvchi boshqaruvi | **Yaxshi holatda — namuna sifatida ol** |
| `web-department` | Viloyat departamenti inspektori | Barcha karyerlarni kuzatish, hisobot | Qayta ishlanadi |
| `web-quarry` | Karyer operatori | Bitta karyer, kunlik ish | Qayta ishlanadi |

Bu **ish quroli**, marketing sayti emas. Inspektor kun bo'yi jadval o'qiydi, raqam solishtiradi, shubhali qatnovni topadi. Shuning uchun asosiy mezon — **o'qish tezligi va aniqlik**, bezak emas.

### Ekranlar

**web-quarry** (bitta sahifa, tab'lar bilan):
- `QuarryDashboard` — karyer statistikasi (hajm, mashinalar, hodisalar, kameralar), karyer ma'lumoti, kameralar holati
- Tab: **Ma'lumotlar** → `TripsTable` (qatnovlar: har bir mashinaning tarozi kirish/chiqish, netto, holat)
- Tab: **Hodisalar** → `M1Table` (xom hodisalar jurnali, M-1 shakli, Excel eksport)

**web-department** (3 ta sahifa + drill-down):
- `Dashboard` — Jizzax xaritasi (SVG choropleth), tuman tanlash, umumiy statistika
- `DistrictDetail` — tuman bo'yicha eko-postlar, karyerlar ro'yxati
- `QuarryDetail` — bitta karyer (web-quarry dashboard'ining nusxasi)
- `Trips` — barcha karyerlar bo'yicha qatnovlar
- `Events` — barcha karyerlar bo'yicha M-1 jurnali

---

## 3. Muammoning aniq diagnostikasi

Bular o'lchangan raqamlar, taxmin emas:

| Muammo | O'lcham |
|---|---|
| Qo'lda yozilgan hex ranglar | **37 xil** (`#ecfdf5`, `#0f766e`, `#e2e8f0`, `#f6fbfb`, `#f6fefd`, `#f0f3f8`…) |
| O'zboshimcha shrift o'lchamlari | **9 xil**: 10, 11, 11.5, 12.5, 13, 13.5, 15, 17, 19px — yarim-piksel o'lchamlar bilan |
| Qo'lda chizilgan inline SVG ikonka | **24 ta** (lucide-react o'rnatilgan turib) |
| Xom `<table>` | 7 ta (shadcn `Table` mavjud turib) |
| Xom `<select>` | 12 ta (shadcn `Select` mavjud turib) |
| Xom `<button>` | 36 ta (shadcn `Button` mavjud turib) |
| `@karier/ui`dan ishlatilayotgani | Faqat `Card`, `cn`, `PlateBadge`, `RequireAuth`, `ProfileMenu`, `LangSwitcher`, `JizzaxMap`, `exportM1ToExcel` |

### Eng katta muammo: uch juft sahifa ko'chirma nusxa

| Fayl juftligi | Satrlar | Farq |
|---|---|---|
| `Trips.tsx` (quarry / department) | 546 / 592 | atigi **54 satr** |
| `DataM1.tsx` (quarry / department) | 646 / 676 | atigi **42 satr** |
| `QuarryDashboard.tsx` / `QuarryDetail.tsx` | 278 / 315 | atigi **65 satr** |

Ikki ilovaning jami 3786 satr kodidan **3053 satri (80%)** shu 6 ta faylda — va ular ~90% bir xil. Chalkashlikning ildizi shu: tuzatish bir ilovada qilinadi, ikkinchisida unutiladi. **Bu takrorlanishni yo'q qilmasdan hech qanday dizayn ishi barqaror bo'lmaydi.**

### Nima uchun shunday bo'lgan

Kod `di/*.dc.html` fayllaridagi qo'lda yozilgan HTML maketlardan ko'chirilgan (`WebQuarry.dc.html`, `WebDepartment.dc.html`). Maketda hamma narsa inline `style=""` bilan yozilgan edi — yarim-piksel shriftlar va 37 xil hex o'sha yerdan kelgan. Kod kommentlaridagi "per mockup" shunga ishora qiladi.

---

## 4. Allaqachon mavjud — qayta ixtiro qilma

### Dizayn tokenlari (Tailwind v4, CSS-first)

`packages/ui/src/globals.css` — `tailwind.config.js` **yo'q**, hammasi shu faylda:

- Ranglar: `--background`, `--foreground`, `--card`, `--primary`, `--primary-tint`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`
- `@theme inline` orqali utility'ga bog'langan: `bg-primary`, `text-muted-foreground`, `border-input`, `bg-primary-tint` va h.k.
- Radiuslar: `--radius: 0.75rem` + `--radius-sm/md/lg/xl` (8/10/12/16px)
- Shrift: `--font-sans: 'Geist', 'Inter', …` — Geist Google Fonts'dan yuklanadi (`index.html`)
- Har bir ilova o'z aksentini `src/theme.css`da 3 qator bilan almashtiradi: web-quarry yashil `#16a34a`, web-department feruza `#0d9488`

**Qoida: yangi hex yozma. Kerakli rang token'da yo'q bo'lsa — `globals.css`ga yangi token qo'sh, keyin ishlat.**

### shadcn/ui primitivlari (o'rnatilgan, lekin ishlatilmayapti)

`packages/ui/src/ui/` — Radix asosida: `Button`, `Card`, `Input`, `PasswordInput`, `Label`, `Badge`, `Dialog`, `Select`, `Table`, `Pagination` (+ `getPaginationRange` helper), `DropdownMenu`.

Eslatma: `select.tsx` stock shadcn holida qolgan (`h-9 rounded-md`), `input.tsx` esa uy uslubiga moslangan (`h-10 rounded-[10px]`) — filtr panellarida balandliklar mos kelmaydi. Buni tuzat.

### Ikonkalar

`lucide-react ^0.469.0` o'rnatilgan va web-main'da yaxshi ishlatilgan. **24 ta qo'lda chizilgan SVG'ni lucide ikonkalari bilan almashtir.**

### Haqiqiy dizayn tizimi: `apps/web-main/src/shared.tsx`

Bu yerda tayyor, yaxshi ishlangan komponentlar bor, lekin ular web-main ichida qamalib qolgan:

- `Eyebrow` — `text-[11px] font-semibold tracking-[0.09em] uppercase` bo'lim sarlavhasi
- `CountPill` — `rounded-full bg-secondary` sanoq belgisi
- `StatusDot` — `ring-[3px]` nurli holat nuqtasi
- `Field` — Label + Input o'ramchasi
- `ModalForm` — Dialog + sarlavha + forma + xato bloki + tugmalar
- `ROW_ACTION` / `ROW_ACTION_DANGER` — jadval qatoridagi 32px ikonka tugmalar

**Bularni `packages/ui`ga ko'chir va uchala ilovada ishlat.** `TH` konstantasi web-main'da 3 marta takrorlangan — uni ham umumiylashtir.

### Boshqa mavjud narsalar

- `PlateBadge` — O'zDSt-1087 avtomobil raqami belgisi (yaxshi ishlangan, tegma)
- `JizzaxMap` — SVG choropleth xarita (inline style'da, ixtiyoriy ravishda token'ga o'tkaz)
- `exportM1ToExcel` — SheetJS eksport
- `@tanstack/react-query` — barcha ma'lumot olish `@karier/api-client` hook'lari orqali
- `tw-animate-css` — shadcn animatsiyalari

---

## 5. Dizayn yo'nalishi

### Asosiy tamoyil

Bu **ma'lumot zich inspeksiya quroli**. Har bir piksel ma'lumot o'qishga xizmat qilsin. Dashboard emas, "cockpit".

### Aniq talablar

**Tipografika.** 9 ta o'zboshimcha o'lchamni **4-5 pog'onali shkala** bilan almashtir. Yarim-piksel o'lchamlar (11.5px, 12.5px, 13.5px) butunlay yo'qolsin. Sarlavhalarda `tracking-[-0.01em]`, uppercase eyebrow'larda `tracking-[0.09em]` — web-main'dagi uslubga mos.

**Raqamlar.** Barcha son ustunlari `tabular-nums`, o'ngga tekislangan. Og'irlik/hajm birligi (`t`, `m³`) raqamdan kichikroq va xiraroq. Bu allaqachon qisman bor — tizimlashtir.

**Ranglar semantikasi.** Holat ranglari bir joyda, bir marta aniqlansin (hozir har faylda qaytadan yozilgan):
- `done` / yakunlandi → yashil
- `open` / jarayonda → ko'k yoki binafsha
- `incomplete` / huquqbuzarlik → qizil (diqqat tortadigan, lekin qichqirmaydigan)
- `no_cargo` / yuk emas → kulrang, so'nik
- `inspect` / `no_plate` → sariq/amber (operator aralashuvi kerak)

**Jadvallar — mahsulotning o'zagi.** Talablar:
- Sticky header (uzun ro'yxatda scroll qilganda sarlavha ko'rinib tursin)
- Qator hover holati aniq bo'lsin
- Zich, lekin siqilib qolmagan — inspektor 25-50 qatorni bir ekranda ko'rsin
- Gorizontal scroll faqat jadvalning o'zida bo'lsin, sahifa scroll qilmasin
- Ustun guruhlari (Zavod / AI / Material) vizual ajratilsin — hozir bu rangli fon bilan qilingan, saqla lekin token'ga o'tkaz
- Foto/video chip'lari va hover preview — funksional, saqla, lekin toza qil

**Holatlar.** Hozir faqat `{t('loading')}` matni bor. Kerak:
- Loading → skeleton (jadval shaklida, matn emas)
- Empty → sabab tushuntirilgan holat ("Filtrga mos qatnov yo'q" ≠ "Hali ma'lumot yo'q")
- Error → qayta urinish tugmasi bilan

**Filtrlash.** Hozir filtrlar Card ichida tartibsiz `flex-wrap`. Yig'ilgan, izchil balandlikdagi, aktiv filtrlar ko'rinib turadigan panel qil. Filtr tozalash tugmasi aktiv filtr bor-yo'qligini bilsin.

**Navigatsiya.** web-department'da hozir top-nav, web-main'da sidebar. Ikkalasini bir xil qilish shart emas, lekin **department'da 5 ta ekran bor va ular orasidagi bog'liqlik ko'rinmayapti** (dashboard → tuman → karyer drill-down zanjiri). Breadcrumb va sahifa sarlavhasi tizimini tartibga sol. web-quarry'da esa bitta sahifa — u yerda tab'lar yetarli, lekin tab dizayni primitiv (`border-primary bg-primary` tugmalar) — buni yaxshila.

**Responsive.** Hozir `max-md:` hack'lari bor. Planshetda (inspektor maydonda planshet bilan yuradi) normal ishlasin.

### Nima QILMA

- Gradient, glassmorphism, dekorativ animatsiya — bu davlat nazorat tizimi
- Dark mode **hozircha yo'q**. Token'lari bor (oklch'da), lekin hech qayerda `.dark` klassi qo'shilmaydi va ko'p joyda `bg-white` qattiq yozilgan. Buni alohida ish sifatida qoldir — hozir aralashtirma.
- Yangi rang palitrasini o'ylab topma. Aksent ranglar (yashil/feruza) allaqachon tanlangan va ilovani ajratib turadi.
- Chart kutubxonasi qo'shma (hozir yo'q va zarurat ham yo'q — agar grafik kerak bo'lsa avval so'ra)

---

## 6. Ish tartibi

Har bosqichdan keyin `pnpm typecheck` va `pnpm build` o'tsin, keyin commit qil. Bir necha kichik commit — bitta katta commit emas.

**1-bosqich: poydevor.**
`web-main/src/shared.tsx`dagi komponentlarni `packages/ui`ga ko'chir. Yetishmayotgan token'larni (`--surface-hover`, `--surface-subtle`, holat ranglari, shadow shkalasi) `globals.css`ga qo'sh. `select.tsx`ni `input.tsx` balandligiga moslashtir. Tipografika shkalasini aniqla.

**2-bosqich: takrorlanishni yo'q qil.**
`TripsTable`, `M1Table` va karyer-ko'rinishi (`QuarryDashboard`/`QuarryDetail`) — uchalasini `packages/ui`ga (yoki yangi `packages/features`ga) bitta komponent sifatida ko'chir. Ilovalar orasidagi farqlar prop bilan boshqarilsin (masalan `showQuarryColumn`, `quarryId`, `scope`). **Bu bosqich eng muhimi — 3000 satr 1500 satrga tushishi kerak.**

**3-bosqich: ekranlarni qayta ishla.**
Endi bitta joyda tuzatish ikkala ilovaga tegadi. Har bir ekranni yuqoridagi talablar bo'yicha qayta ishla.

**4-bosqich: sayqal.**
Ikonkalarni lucide'ga o'tkaz, holatlarni (loading/empty/error) qo'sh, focus-visible holatlarini tekshir, klaviatura bilan yurish, responsive tekshiruv.

---

## 7. Qattiq qoidalar

1. **Funksionallik o'zgarmaydi.** Har bir mavjud imkoniyat (filtrlar, sahifalash, Excel eksport, foto/video preview, raqam tuzatish modali, drill-down navigatsiya) ishlashda davom etsin. Bu vizual va strukturaviy qayta ishlash, funksional emas.
2. **i18n buzilmasin.** Hech qanday matn kodga qattiq yozilmasin — hammasi `t('key')` orqali. Yangi kalit qo'shsang, **uchala tilga** qo'sh (`uz-latn`, `uz-cyrl`, `ru`) — `packages/i18n/src/dictionaries.ts`. Ishlatilmay qolgan kalitlarni o'chir.
3. **Backend'ga tegma.** API kontrakti, `@karier/api-client` hook'lari, ma'lumot shakllari o'zgarmaydi.
4. **web-main'ni buzma.** `shared.tsx`ni ko'chirganda uning import'larini yangila, lekin uning ko'rinishini o'zgartirma.
5. **Yangi dependency** faqat haqiqiy zarurat bo'lsa va sababini aytib. (Tooltip yoki toast kerak bo'lishi mumkin — Radix Tooltip / Sonner. Avval so'ra.)
6. **Kod uslubi.** Atrofdagi kodga mos yoz: TypeScript strict, `cn()` klasslarni birlashtirish uchun, kommentlar o'zbekcha/inglizcha aralash (mavjud uslub), qisqa va faqat zarur joyda.

---

## 8. Tekshirish

```bash
pnpm typecheck              # 8/8 o'tishi shart
pnpm build                  # barcha ilovalar build bo'lsin
pnpm dev:quarry             # yoki dev:department — backend bilan birga
```

Keyin brauzerda (Claude in Chrome bilan) har bir ekranni ochib ko'r:
- Ma'lumot bor holatda, bo'sh holatda, yuklanayotgan holatda
- Uchala tilda (UZ / ЎЗ / RU) — matn sig'masligini tekshir, rus tilidagi so'zlar uzunroq
- Tor ekranda (planshet kengligi)
- Klaviatura bilan: Tab bilan yurish, focus ko'rinishi

Skrinshot olib, oldingi holat bilan solishtirib ko'rsat.

---

## 9. Muvaffaqiyat mezoni

Ish tugaganda quyidagilar rost bo'lsin:

- [ ] Ikki ilovada qo'lda yozilgan hex rang **0 ta** (hammasi token orqali)
- [ ] O'zboshimcha `text-[Npx]` o'lchamlar **0 ta** (shkala orqali)
- [ ] Qo'lda chizilgan inline SVG ikonka **0 ta** (lucide orqali)
- [ ] `TripsTable`, `M1Table`, karyer-ko'rinishi — har biri **bitta** joyda yashaydi
- [ ] Xom `<table>` / `<select>` / `<button>` o'rniga shadcn primitivlari
- [ ] Har bir ro'yxatda loading / empty / error holati bor
- [ ] `pnpm typecheck` va `pnpm build` toza
- [ ] Uchala tilda layout buzilmaydi
