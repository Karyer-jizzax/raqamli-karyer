"""Weighbridge (tarozi) reader — a swappable stub for a real scale API.

A real deployment would poll the weighbridge controller's own HTTP/Modbus
API for the live reading tied to a plate number. This stub returns a
deterministic, plausible truck weight so the full flow (register → save) can
be exercised without hardware. Swap `read_weight_kg` for a real HTTP client
call when the physical integration is available — nothing else in the app
changes.
"""

import hashlib

_MIN_KG = 18_000
_RANGE_KG = 70_000


def read_weight_kg(plate_region: str, plate_number: str) -> int:
    basis = f"{plate_region}{plate_number}".encode()
    h = int(hashlib.sha256(basis).hexdigest(), 16)
    return _MIN_KG + (h % _RANGE_KG)
