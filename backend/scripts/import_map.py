"""`uz_map.json` dagi xarita chizmasini bazaga yozadi.

Chizma `build_uz_map.py` bilan tayyorlanadi; bu skript uni faqat bazadagi
viloyat va tumanlarga biriktiradi. Nom bo'yicha moslaydi: apostrof, "tumani"/
"shahri" qo'shimchasi va katta-kichik harf hisobga olinmaydi, ya'ni bazadagi
"Jizzax sh." bilan xaritadagi "Jizzax shahri" bir xil deb qaraladi.

Standart holatda **hech nima o'chirilmaydi**: nomlar tegilmaydi (bazadagi
imlo o'zi to'g'ri deb qaraladi) va chizmasi bor tuman chetlab o'tiladi —
qo'lda kiritilgan Jizzax xaritasi joyida qoladi. Boshqacha kerak bo'lsa
`--overwrite`.

Ishlatish:

    python -m scripts.import_map --dry-run          # nima bo'lishini ko'rsatadi
    python -m scripts.import_map                    # bo'sh tumanlarga yozadi
    python -m scripts.import_map --overwrite        # borini ham almashtiradi
    python -m scripts.import_map --create-missing   # yo'q tumanni ochadi ham
    python -m scripts.import_map --region Jizzax    # bitta viloyat
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.region import District, Region

DEFAULT_FILE = Path(__file__).parent / "uz_map.json"

APOSTROPHES = "'`‘’ʻʼ′"

# Shahar — alohida birlik: "Bekobod" (tuman) va "Bekobod shahri" ikki xil
# yozuv, shuning uchun bu qo'shimchalar olib tashlanmaydi, `sh` belgisiga
# aylanadi. Qolgani ("tumani", "viloyati", "район"…) shunchaki tushib qoladi.
_CITY_SUFFIXES = ("shahri", "shahar", "sh.", "sh", "city", "шаҳри", "шахри", "ш.", "ш")
_PLAIN_SUFFIXES = (
    "tumani", "tuman", "rayoni", "rayon", "district", "тумани", "район",
    "viloyati", "viloyat", "region", "вилояти", "область", "oblast",
    "respublikasi", "республикаси", "republic",
)


def key(name: str | None) -> str:
    """Moslash uchun nom kaliti: imlo farqlari olib tashlanadi.

    "Do'stlik", "Dostlik", "DO‘STLIK tumani" — bittasi; "Jizzax sh." bilan
    "Jizzax shahri" ham bittasi, lekin "Jizzax" (tuman) — boshqasi."""
    if not name:
        return ""
    text = "".join(" " if ch in APOSTROPHES else ch for ch in name).lower().strip()
    city = False
    if text.startswith(("город ", "г. ")):
        text = text.split(" ", 1)[1]
        city = True
    for suffix in _CITY_SUFFIXES:
        if text.endswith(" " + suffix):
            text = text[: -len(suffix) - 1].strip()
            city = True
            break
    else:
        for suffix in _PLAIN_SUFFIXES:
            if text.endswith(" " + suffix):
                text = text[: -len(suffix) - 1].strip()
                break
    return "".join(ch for ch in text if ch.isalnum()) + ("sh" if city else "")


def keys_of(row: Any) -> set[str]:
    """Yozuvning uch tilidagi nomi — qaysi biri tushsa ham bo'ladi."""
    return {
        k
        for k in (key(row.name_uz_latn), key(row.name_uz_cyrl), key(row.name_ru))
        if k
    }


class Stats:
    def __init__(self) -> None:
        self.updated = 0
        self.skipped = 0
        self.created = 0
        self.unmatched: list[str] = []  # xaritada bor, bazada yo'q
        self.no_map: list[str] = []  # bazada bor, xaritada yo'q


async def import_map(
    path: Path,
    *,
    only_region: str | None,
    overwrite: bool,
    create_missing: bool,
    dry_run: bool,
) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    print(f"Manba: {data.get('source', '?')}")

    async with SessionLocal() as db:
        regions = list((await db.execute(select(Region))).scalars().all())
        districts = list((await db.execute(select(District))).scalars().all())

        by_region: dict[Any, list[District]] = {}
        for d in districts:
            by_region.setdefault(d.region_id, []).append(d)

        total = Stats()
        for entry in data.get("regions", []):
            if only_region and key(only_region) not in key(entry["name_uz_latn"]):
                continue

            entry_keys = {
                key(entry["name_uz_latn"]),
                key(entry["name_uz_cyrl"]),
                key(entry["name_ru"]),
            }
            region = next((r for r in regions if keys_of(r) & entry_keys), None)
            if region is None:
                if not create_missing:
                    print(f"— {entry['name_uz_latn']}: bazada yo'q (--create-missing)")
                    continue
                region = Region(
                    name_uz_latn=entry["name_uz_latn"],
                    name_uz_cyrl=entry["name_uz_cyrl"],
                    name_ru=entry["name_ru"],
                )
                db.add(region)
                await db.flush()
                regions.append(region)
                print(f"+ {entry['name_uz_latn']}: viloyat yaratildi")

            stats = Stats()
            rows = by_region.get(region.id, [])
            # Yangi yozuvning `id` si hali yo'q, shuning uchun obyektning
            # o'zi bo'yicha belgilanadi. Bir tuman ikki marta olinmasin:
            # xaritada takrorlangan nom uchraydi (masalan shahar bilan tuman
            # bir xil atalgan joylarda).
            taken: set[int] = set()

            for item in entry["districts"]:
                item_key = key(item["name_uz_latn"])
                match = next(
                    (r for r in rows if id(r) not in taken and item_key in keys_of(r)),
                    None,
                )
                if match is None:
                    if not create_missing:
                        stats.unmatched.append(item["name_uz_latn"])
                        continue
                    match = District(
                        region_id=region.id,
                        name_uz_latn=item["name_uz_latn"],
                        name_uz_cyrl=item["name_uz_cyrl"],
                        name_ru=item["name_ru"],
                        is_capital=item["name_uz_latn"].lower().endswith(("shahri", "sh.")),
                    )
                    db.add(match)
                    rows.append(match)
                    stats.created += 1
                taken.add(id(match))

                if match.svg_path and not overwrite:
                    stats.skipped += 1
                    continue
                match.svg_path = item["d"]
                match.center_x = item["cx"]
                match.center_y = item["cy"]
                stats.updated += 1

            stats.no_map = [r.name_uz_latn for r in rows if id(r) not in taken]

            print(
                f"— {entry['name_uz_latn']}: {stats.updated} yozildi, "
                f"{stats.skipped} tegilmadi, {stats.created} yaratildi"
            )
            if stats.unmatched:
                print(f"    xaritada bor, bazada yo'q: {', '.join(sorted(stats.unmatched))}")
            if stats.no_map:
                print(f"    bazada bor, xaritada yo'q: {', '.join(sorted(stats.no_map))}")

            total.updated += stats.updated
            total.skipped += stats.skipped
            total.created += stats.created
            total.unmatched += stats.unmatched
            total.no_map += stats.no_map

        if dry_run:
            await db.rollback()
            print(
                f"\n[dry-run] {total.updated} tumanga chizma yozilardi, "
                f"{total.created} tuman yaratilardi, {total.skipped} tegilmasdi."
            )
            return

        await db.commit()
        print(
            f"\nTayyor: {total.updated} tumanga chizma yozildi, "
            f"{total.created} tuman yaratildi, {total.skipped} tegilmadi."
        )
        if total.no_map:
            print(f"Chizmasiz qolgan tumanlar: {len(total.no_map)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", default=str(DEFAULT_FILE), help="xarita JSON fayli")
    parser.add_argument("--region", help="faqat shu viloyat (nomining bir qismi)")
    parser.add_argument(
        "--overwrite", action="store_true", help="chizmasi bor tumanni ham almashtirish"
    )
    parser.add_argument(
        "--create-missing",
        action="store_true",
        help="bazada yo'q viloyat/tumanni yaratish",
    )
    parser.add_argument("--dry-run", action="store_true", help="yozmasdan ko'rsatish")
    args = parser.parse_args()

    asyncio.run(
        import_map(
            Path(args.file),
            only_region=args.region,
            overwrite=args.overwrite,
            create_missing=args.create_missing,
            dry_run=args.dry_run,
        )
    )


if __name__ == "__main__":
    main()
