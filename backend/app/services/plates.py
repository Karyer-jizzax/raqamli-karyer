"""Uzbek number-plate parsing (O'zDSt 1087).

The local server sends the ANPR read as one string ("20167TAA"); we split it
into the 2-digit region code + the number part, and the number's series tells
the owner kind: `A123BC` = jismoniy shaxs, `123ABC` = yuridik shaxs,
`123DAV` = davlat organi (2021 "DAV" series).
"""

import re

_INDIV_RE = re.compile(r"[A-Z]\d{3}[A-Z]{2}")


def split_plate(plate: str | None) -> tuple[str, str]:
    """`01S748HE` -> ('01', 'S748HE'); `20167TAA` -> ('20', '167TAA').

    Uzbek region codes are always exactly 2 digits — never consume more, or a
    `01 123 ABC`-format plate loses the first digit of its number part.
    """
    if not plate:
        return "", ""
    plate = plate.strip().upper()
    i = 0
    while i < len(plate) and i < 2 and plate[i].isdigit():
        i += 1
    return plate[:i], plate[i:]


def payer_type(plate_number: str) -> str:
    """To'lovchi turi raqam seriyasidan: jismoniy shaxs seriyasi → indiv,
    qolgan hammasi (yuridik `123ABC`, davlat `123DAV`, ...) → legal."""
    n = plate_number.replace(" ", "").upper()
    return "indiv" if _INDIV_RE.fullmatch(n) else "legal"
