"""O'zbekiston tumanlari xaritasini SVG chizmasiga aylantirib beradi.

Natija — `uz_map.json`: har viloyat uchun tumanlar ro'yxati, har tumanda SVG
`path` va nom yorlig'ining markazi. Uni bazaga `import_map.py` yozadi.

Ikkita manba qo'shiladi, chunki bittasida ikkalasi ham yo'q:

* **geoBoundaries** (gbOpen UZB ADM1/ADM2, CC BY 3.0 IGO) — chegara
  geometriyasi. Soddalashtirilgan, ya'ni fayl kichik; nomlari esa inglizcha
  ("Kiziltepa", "Pastdargom"), bazadagi o'zbekcha nomlarga tushmaydi.
* **OpenStreetMap** (Overpass, ODbL) — `admin_level=6` munosabatlarining
  nomi (`name:uz`, `name:ru`) va markazi. Geometriyasi bu yerda kerak emas:
  markaz nuqtasi qaysi ko'pburchak ichiga tushsa, nom o'shanikidir.

Har viloyat alohida 640×586 maydonga sig'diriladi (mavjud Jizzax chizmasi ham
shu o'lchamda), ya'ni ilova tomonda bitta `viewBox` yetadi va viloyatlar bir
xil kattalikda ko'rinadi — chizma yer yuzidagi masshtabni emas, shaklni
saqlaydi.

Ishlatish:

    python scripts/build_uz_map.py                 # tarmoqdan yuklab, yozadi
    python scripts/build_uz_map.py --adm2 a.geojson --adm1 b.geojson --osm c.json
    python scripts/build_uz_map.py --out /tmp/uz_map.json
"""

from __future__ import annotations

import argparse
import json
import math
import urllib.request
from pathlib import Path
from typing import Any

# ── manbalar ─────────────────────────────────────────────────────────────────
GB_COMMIT = "9469f09"
GB_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/{commit}/releaseData/gbOpen/"
    "UZB/ADM{level}/geoBoundaries-UZB-ADM{level}.geojson"
)
OVERPASS_HOSTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
# Chegaradosh davlatlarning tumanlari ham tushadi — ular viloyat ichiga
# tushmagani uchun keyin o'zi chiqib ketadi.
OVERPASS_QUERY = """[out:json][timeout:180][bbox:37.0,55.8,45.7,73.3];
rel["boundary"="administrative"]["admin_level"="6"];
out center tags;
"""

# ── chizma o'lchami ──────────────────────────────────────────────────────────
MAP_WIDTH = 640.0
VIEW_HEIGHT = 586.0
# Chetdagi tuman qirqilib qolmasin va nom yorlig'iga joy qolsin.
MARGIN = 18.0
# Soddalashtirish chegarasi (piksel). 0.4 px — ekranda ko'rinmaydigan, lekin
# nuqtalar sonini o'nlab marta kamaytiradigan farq.
SIMPLIFY_TOLERANCE = 0.4
# Bundan kichik orolchani chizishdan ma'no yo'q (piksel²).
MIN_RING_AREA = 1.5

# geoBoundaries ADM1 nomlari inglizcha; bazaga o'zbekcha nom kerak.
REGION_NAMES: dict[str, tuple[str, str, str]] = {
    "Andijan Region": ("Andijon viloyati", "Андижон вилояти", "Андижанская область"),
    "Bukhara Region": ("Buxoro viloyati", "Бухоро вилояти", "Бухарская область"),
    "Fergana Region": ("Farg'ona viloyati", "Фарғона вилояти", "Ферганская область"),
    "Jizzakh Region": ("Jizzax viloyati", "Жиззах вилояти", "Джизакская область"),
    "Namangan Region": ("Namangan viloyati", "Наманган вилояти", "Наманганская область"),
    "Navoiy Region": ("Navoiy viloyati", "Навоий вилояти", "Навоийская область"),
    "Qashqadaryo Region": (
        "Qashqadaryo viloyati",
        "Қашқадарё вилояти",
        "Кашкадарьинская область",
    ),
    "Republic of Karakalpakstan": (
        "Qoraqalpog'iston Respublikasi",
        "Қорақалпоғистон Республикаси",
        "Республика Каракалпакстан",
    ),
    "Samarqand Region": ("Samarqand viloyati", "Самарқанд вилояти", "Самаркандская область"),
    "Sirdaryo Region": ("Sirdaryo viloyati", "Сирдарё вилояти", "Сырдарьинская область"),
    "Surxondaryo Region": (
        "Surxondaryo viloyati",
        "Сурхондарё вилояти",
        "Сурхандарьинская область",
    ),
    "Tashkent": ("Toshkent shahri", "Тошкент шаҳри", "город Ташкент"),
    "Tashkent Region": ("Toshkent viloyati", "Тошкент вилояти", "Ташкентская область"),
    "Xorazm Region": ("Xorazm viloyati", "Хоразм вилояти", "Хорезмская область"),
}


# ── nom bilan ishlash ────────────────────────────────────────────────────────
APOSTROPHES = "'`‘’ʻʼ′"

# OSM'da bir xil harf uchun bir nechta apostrof belgisi uchraydi (o', oʻ, o`);
# bazada bittasi turadi, shuning uchun hammasi shunga keltiriladi.
def normalize_apostrophes(name: str) -> str:
    return "".join("'" if ch in APOSTROPHES else ch for ch in name)


# o'/g' boshqa digraflardan oldin belgilanadi, aks holda "yo'l" ichidagi "yo"
# ё bo'lib ketadi va "ъ" qo'shimcha bo'lib qoladi.
_PLACEHOLDER = {"ǒ": "ў", "ǧ": "ғ"}
_CYR_DIGRAPHS = [
    ("sh", "ш"),
    ("ch", "ч"),
    ("ya", "я"),
    ("yo", "ё"),
    ("yu", "ю"),
    ("ts", "ц"),
]
_CYR_SINGLE = {
    "a": "а", "b": "б", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "ҳ",
    "i": "и", "j": "ж", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о",
    "p": "п", "q": "қ", "r": "р", "s": "с", "t": "т", "u": "у", "v": "в",
    "w": "в", "x": "х", "y": "й", "z": "з",
}


def to_cyrillic(name: str) -> str:
    """Lotinchadan kirillchaga — taxminiy, lekin o'qib bo'ladigan darajada.

    Adminkadan nomni qo'lda tuzatish mumkin, shuning uchun bu yerda mukammal
    imlodan ko'ra bir xil qoida muhimroq."""
    out: list[str] = []
    for word in normalize_apostrophes(name).split(" "):
        low = word.lower().replace("o'", "ǒ").replace("g'", "ǧ")
        i = 0
        buf: list[str] = []
        while i < len(low):
            for src, dst in _CYR_DIGRAPHS:
                if low.startswith(src, i):
                    buf.append(dst)
                    i += len(src)
                    break
            else:
                ch = low[i]
                if ch in _PLACEHOLDER:
                    buf.append(_PLACEHOLDER[ch])
                elif ch == "'":
                    buf.append("ъ")
                else:
                    buf.append(_CYR_SINGLE.get(ch, ch))
                i += 1
        cyr = "".join(buf)
        # So'z boshidagi "e" kirillchada "э".
        if cyr.startswith("е"):
            cyr = "э" + cyr[1:]
        out.append(cyr.capitalize() if word[:1].isupper() else cyr)
    return " ".join(out)


# OSM'da mos nuqta topilmagan hollarda geoBoundaries'ning inglizcha nomi
# qoladi. Bu ro'yxat o'shalarni o'zbekchaga o'giradi — asosan shaharlar, ular
# OSM'da `admin_level=6` bo'lib turmaydi.
ENGLISH_ALIASES = {
    "dzhizak": "Jizzax",
    "khiva": "Xiva",
    "ramitan": "Romitan",
    "sariasiya": "Sariosiyo",
    "termez": "Termiz",
    "urgench": "Urganch",
    "yangibazar": "Yangibozor",
}

_SUFFIXES = (
    " tumani", " tuman", " shahri", " shahar", " sh.", " rayoni", " rayon",
    " district", " city", " region", " qishlog'i",
)

_RU_SUFFIXES = (" район", " г.", " шахар")


def clean_district_name(raw: str) -> str:
    """"Qo'ng'irot Tumani" → "Qo'ng'irot" — bazada nom tumansiz turadi."""
    name = normalize_apostrophes(" ".join(raw.split()))
    # "Nurafshon (Toytepa)" — qavs ichidagi eski nom yorliqqa sig'maydi.
    if "(" in name:
        name = " ".join(name.split("(")[0].split())
    low = name.lower()
    for suffix in _SUFFIXES:
        if low.endswith(suffix):
            return name[: len(name) - len(suffix)].strip()
    return name


def clean_ru_name(raw: str) -> str:
    name = " ".join(raw.split())
    low = name.lower()
    for suffix in _RU_SUFFIXES:
        if low.endswith(suffix):
            return name[: len(name) - len(suffix)].strip()
    if low.startswith("город "):
        return name[len("город ") :].strip()
    return name


# ── geometriya ───────────────────────────────────────────────────────────────
Ring = list[tuple[float, float]]


def polygons_of(geometry: dict[str, Any]) -> list[list[Ring]]:
    """GeoJSON geometriyasini [ko'pburchak][halqa][nuqta] shakliga keltiradi."""
    kind = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if kind == "Polygon":
        return [[[(float(x), float(y)) for x, y in ring] for ring in coords]]
    if kind == "MultiPolygon":
        return [
            [[(float(x), float(y)) for x, y in ring] for ring in poly] for poly in coords
        ]
    return []


def ring_area(ring: Ring) -> float:
    """Yo'naltirilgan yuza (shoelace) — belgisi halqa yo'nalishini beradi."""
    total = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        total += x1 * y2 - x2 * y1
    return total / 2.0


def centroid_of(ring: Ring) -> tuple[float, float]:
    area = ring_area(ring)
    if abs(area) < 1e-12:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx = cy = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        cross = x1 * y2 - x2 * y1
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    return cx / (6.0 * area), cy / (6.0 * area)


def point_in_ring(point: tuple[float, float], ring: Ring) -> bool:
    """Nur usuli (ray casting)."""
    x, y = point
    inside = False
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        if (y1 > y) != (y2 > y):
            xin = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xin:
                inside = not inside
    return inside


def point_in_polygons(point: tuple[float, float], polygons: list[list[Ring]]) -> bool:
    for rings in polygons:
        if not rings:
            continue
        if point_in_ring(point, rings[0]) and not any(
            point_in_ring(point, hole) for hole in rings[1:]
        ):
            return True
    return False


def simplify(ring: Ring, tolerance: float) -> Ring:
    """Douglas–Peucker. Halqa yopiq, shuning uchun ikki yarmi alohida."""
    if len(ring) < 4:
        return ring

    def rdp(points: Ring) -> Ring:
        """Rekursiyasiz: chegara bir necha ming nuqtali bo'lishi mumkin, va
        rekursiya eng yomon holatda shuncha chuqurlashadi."""
        if len(points) < 3:
            return list(points)
        keep = [False] * len(points)
        keep[0] = keep[-1] = True
        stack = [(0, len(points) - 1)]
        while stack:
            start, end = stack.pop()
            if end - start < 2:
                continue
            x1, y1 = points[start]
            x2, y2 = points[end]
            dx, dy = x2 - x1, y2 - y1
            norm = math.hypot(dx, dy)
            best_i, best_d = start, -1.0
            for i in range(start + 1, end):
                px, py = points[i]
                if norm < 1e-12:
                    dist = math.hypot(px - x1, py - y1)
                else:
                    dist = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
                if dist > best_d:
                    best_i, best_d = i, dist
            if best_d > tolerance:
                keep[best_i] = True
                stack.append((start, best_i))
                stack.append((best_i, end))
        return [p for p, k in zip(points, keep, strict=True) if k]

    # Yopiq halqani ikkiga bo'lib soddalashtirish — boshlanish nuqtasi
    # qo'zg'almasligi uchun.
    half = len(ring) // 2
    first = rdp(ring[: half + 1])
    second = rdp(ring[half:])
    return first[:-1] + second[:-1]


def path_of(polygons: list[list[Ring]]) -> str:
    """Ko'pburchaklarni bitta SVG `d` qatoriga yig'adi (teshiklar ham)."""
    parts: list[str] = []
    for rings in polygons:
        for ring in rings:
            if len(ring) < 3:
                continue
            head = f"M{ring[0][0]:.1f},{ring[0][1]:.1f}"
            body = "".join(f"L{x:.1f},{y:.1f}" for x, y in ring[1:])
            parts.append(head + body + "Z")
    return "".join(parts)


# ── loyihalash ───────────────────────────────────────────────────────────────
def project_region(
    districts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Viloyat tumanlarini 640×586 maydonga sig'diradi.

    Kichik hudud uchun ekvitorial proyeksiya yetarli: kenglik bo'yicha
    siqilish `cos(lat)` bilan hisobga olinadi, qolgani — masshtab."""
    lats = [y for d in districts for poly in d["polygons"] for ring in poly for _, y in ring]
    if not lats:
        return []
    lat0 = math.radians((min(lats) + max(lats)) / 2.0)
    kx = math.cos(lat0)

    flat: list[tuple[float, float]] = [
        (x * kx, -y)
        for d in districts
        for poly in d["polygons"]
        for ring in poly
        for x, y in ring
    ]
    min_x = min(p[0] for p in flat)
    max_x = max(p[0] for p in flat)
    min_y = min(p[1] for p in flat)
    max_y = max(p[1] for p in flat)
    span_x = max(max_x - min_x, 1e-9)
    span_y = max(max_y - min_y, 1e-9)
    scale = min((MAP_WIDTH - 2 * MARGIN) / span_x, (VIEW_HEIGHT - 2 * MARGIN) / span_y)
    off_x = (MAP_WIDTH - span_x * scale) / 2.0
    off_y = (VIEW_HEIGHT - span_y * scale) / 2.0

    def to_px(lon: float, lat: float) -> tuple[float, float]:
        return (
            (lon * kx - min_x) * scale + off_x,
            (-lat - min_y) * scale + off_y,
        )

    out: list[dict[str, Any]] = []
    for d in districts:
        polygons: list[list[Ring]] = []
        for poly in d["polygons"]:
            rings: list[Ring] = []
            for ring in poly:
                px = [to_px(x, y) for x, y in ring]
                px = simplify(px, SIMPLIFY_TOLERANCE)
                if len(px) >= 3 and abs(ring_area(px)) >= MIN_RING_AREA:
                    rings.append(px)
            if rings:
                polygons.append(rings)
        if not polygons:
            continue
        # Yorliq eng katta halqaning og'irlik markazida turadi.
        biggest = max((r for rings in polygons for r in rings), key=lambda r: abs(ring_area(r)))
        cx, cy = centroid_of(biggest)
        out.append(
            {
                "name_uz_latn": d["name_uz_latn"],
                "name_uz_cyrl": d["name_uz_cyrl"],
                "name_ru": d["name_ru"],
                "source_name": d["source_name"],
                "named_from_osm": d["named_from_osm"],
                "cx": round(cx, 1),
                "cy": round(cy, 1),
                "d": path_of(polygons),
            }
        )
    return out


# ── manbalarni o'qish ────────────────────────────────────────────────────────
def fetch(url: str, timeout: int = 180) -> bytes:
    print(f"  ↓ {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "karier-map-build/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read()


def load_geojson(path: str | None, level: int) -> dict[str, Any]:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    return json.loads(fetch(GB_URL.format(commit=GB_COMMIT, level=level)))


def load_osm_names(path: str | None) -> list[dict[str, Any]]:
    if path:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data.get("elements", [])
    last_error: Exception | None = None
    for host in OVERPASS_HOSTS:
        try:
            print(f"  ↓ {host}")
            req = urllib.request.Request(
                host,
                data=OVERPASS_QUERY.encode("utf-8"),
                headers={"User-Agent": "karier-map-build/1.0"},
            )
            with urllib.request.urlopen(req, timeout=240) as resp:  # noqa: S310
                return json.loads(resp.read()).get("elements", [])
        except Exception as exc:  # noqa: BLE001 — keyingi mirror'ga o'tamiz
            last_error = exc
            print(f"    … bo'lmadi: {exc}")
    raise RuntimeError(f"Overpass javob bermadi: {last_error}")


def osm_name_for(
    element: dict[str, Any],
) -> tuple[str, str] | None:
    """(lotincha, ruscha) — o'zbekcha nomi yo'q munosabat kerak emas."""
    tags = element.get("tags") or {}
    latin = tags.get("name:uz") or tags.get("int_name")
    if not latin:
        # Toshkent shahri tumanlarida ko'pincha faqat `name` o'zbekcha.
        name = tags.get("name") or ""
        if name.lower().endswith(("tumani", "tuman", "shahri")):
            latin = name
    if not latin:
        return None
    # `admin_level=6` orasida tuman bo'lmagan narsa ham uchraydi (ko'cha,
    # mahalla) — ular nom bo'lib tushib qolmasin.
    if latin.lower().endswith(("ko'chasi", "kochasi", "street", "mahallasi", "mfy")):
        return None
    return clean_district_name(latin), (tags.get("name:ru") or "").strip()


# ── yig'ish ──────────────────────────────────────────────────────────────────
def build(adm1: dict[str, Any], adm2: dict[str, Any], osm: list[dict[str, Any]]) -> dict[str, Any]:
    regions: list[dict[str, Any]] = []
    for feature in adm1.get("features", []):
        shape_name = (feature.get("properties") or {}).get("shapeName", "")
        names = REGION_NAMES.get(shape_name)
        if names is None:
            print(f"  ! notanish viloyat: {shape_name!r} — o'tkazib yuborildi")
            continue
        regions.append(
            {
                "shape_name": shape_name,
                "names": names,
                "polygons": polygons_of(feature.get("geometry") or {}),
                "districts": [],
            }
        )

    # OSM markazlari: nomni ko'pburchakka biriktirish uchun.
    osm_points: list[tuple[tuple[float, float], str, str]] = []
    for element in osm:
        center = element.get("center") or {}
        got = osm_name_for(element)
        if not got or "lon" not in center or "lat" not in center:
            continue
        osm_points.append(((float(center["lon"]), float(center["lat"])), got[0], got[1]))
    print(f"  OSM nomlari: {len(osm_points)}")

    unassigned = 0
    pending: list[dict[str, Any]] = []
    for feature in adm2.get("features", []):
        polygons = polygons_of(feature.get("geometry") or {})
        if not polygons:
            continue
        source_name = (feature.get("properties") or {}).get("shapeName", "").strip()

        # Qaysi viloyat: eng katta halqaning markazi kimning ichida.
        biggest = max((r for rings in polygons for r in rings), key=lambda r: abs(ring_area(r)))
        center = centroid_of(biggest)
        region = next(
            (r for r in regions if point_in_polygons(center, r["polygons"])),
            None,
        )
        if region is None:
            unassigned += 1
            continue
        pending.append(
            {
                "region": region,
                "polygons": polygons,
                "center": center,
                "source_name": source_name,
                # "Kagan city" — shahar tumandan alohida birlik, nomi ham
                # shunga yarasha bo'lishi kerak, aks holda ikkalasi bitta
                # nomga tushib qoladi.
                "is_city": source_name.lower().endswith((" city", " shahri")),
                "osm": None,
            }
        )

    # Nom biriktirish ikki bosqichda. Har bir OSM nuqtasi bitta tumanga
    # tegishli: aks holda shahar bilan tuman bir xil nom olib qoladi.
    #
    # Kichigidan boshlanadi: shahar tumanning ichida yotadi, ya'ni shahar
    # nuqtasi ikkalasining ham ichida. Katta tuman birinchi olsa, shahar
    # nomsiz qolardi.
    def polygon_area(item: dict[str, Any]) -> float:
        return sum(abs(ring_area(rings[0])) for rings in item["polygons"] if rings)

    pending.sort(key=polygon_area)

    used: set[int] = set()
    for item in pending:
        inside = sorted(
            (math.dist(p[0], item["center"]), i)
            for i, p in enumerate(osm_points)
            if point_in_polygons(p[0], item["polygons"])
        )
        for _, i in inside:
            if i not in used:
                used.add(i)
                item["osm"] = osm_points[i]
                break

    # Chegaralar ikki manbada bir xil emas: nuqta chetda qolsa, ichiga
    # tushmaydi. Shunday hollarda eng yaqin bo'sh nuqta olinadi — 0.3° ≈ 30 km,
    # tuman o'lchamidan kichik, ya'ni qo'shni tumanning nomini tortib
    # ketmaydi.
    for item in pending:
        if item["osm"] is not None:
            continue
        near = sorted(
            (math.dist(p[0], item["center"]), i)
            for i, p in enumerate(osm_points)
            if i not in used and math.dist(p[0], item["center"]) < 0.3
        )
        if near:
            i = near[0][1]
            used.add(i)
            item["osm"] = osm_points[i]

    for item in pending:
        if item["osm"] is not None:
            _, latin, ru = item["osm"]
            named_from_osm = True
        else:
            latin = clean_district_name(item["source_name"])
            latin = ENGLISH_ALIASES.get(latin.lower(), latin)
            ru, named_from_osm = "", False
        if item["is_city"] and not latin.lower().endswith(("shahri", "sh.")):
            latin = f"{latin} shahri"
        ru = clean_ru_name(ru)

        item["region"]["districts"].append(
            {
                "name_uz_latn": latin,
                "name_uz_cyrl": to_cyrillic(latin),
                "name_ru": ru or latin,
                "source_name": item["source_name"],
                "named_from_osm": named_from_osm,
                "polygons": item["polygons"],
            }
        )

    if unassigned:
        print(f"  ! {unassigned} ta tuman hech bir viloyat ichiga tushmadi")

    out_regions: list[dict[str, Any]] = []
    for region in sorted(regions, key=lambda r: r["names"][0]):
        districts = project_region(region["districts"])
        if not districts:
            print(f"  ! {region['names'][0]}: tuman topilmadi")
            continue
        guessed = sum(1 for d in districts if not d["named_from_osm"])
        print(
            f"  {region['names'][0]}: {len(districts)} tuman"
            + (f" ({guessed} tasining nomi inglizchadan)" if guessed else "")
        )
        out_regions.append(
            {
                "name_uz_latn": region["names"][0],
                "name_uz_cyrl": region["names"][1],
                "name_ru": region["names"][2],
                "districts": sorted(districts, key=lambda d: d["name_uz_latn"]),
            }
        )

    return {
        "source": (
            "geoBoundaries gbOpen UZB ADM1/ADM2 (CC BY 3.0 IGO); "
            "nomlar: OpenStreetMap (ODbL)"
        ),
        "width": MAP_WIDTH,
        "view_height": VIEW_HEIGHT,
        "regions": out_regions,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adm1", help="geoBoundaries ADM1 geojson (bo'lmasa yuklab oladi)")
    parser.add_argument("--adm2", help="geoBoundaries ADM2 geojson (bo'lmasa yuklab oladi)")
    parser.add_argument("--osm", help="Overpass javobi (bo'lmasa so'rov yuboradi)")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).parent / "uz_map.json"),
        help="natija fayli (standart: scripts/uz_map.json)",
    )
    args = parser.parse_args()

    print("Manbalar:")
    adm1 = load_geojson(args.adm1, 1)
    adm2 = load_geojson(args.adm2, 2)
    osm = load_osm_names(args.osm)

    print("Yig'ilmoqda:")
    data = build(adm1, adm2, osm)

    out = Path(args.out)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(len(r["districts"]) for r in data["regions"])
    size_kb = out.stat().st_size / 1024
    print(f"Yozildi: {out} — {len(data['regions'])} viloyat, {total} tuman, {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
