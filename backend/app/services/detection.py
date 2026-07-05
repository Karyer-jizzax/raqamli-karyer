"""AI detection interface + a deterministic stub implementation.

The camera is used for vehicle detection: plate OCR and cargo material-type
recognition. It does not measure cargo volume or weight — that comes from the
weighbridge (see `services.scale`). Wiring a real model (YOLO/ONNX + OpenCV)
is a deploy-heavy concern (GPU), so this module defines a swappable `Detector`
Protocol and ships a `StubDetector` that returns plausible, deterministic
results — enough to exercise the full ingest → event flow.

To plug in a real model later, implement `Detector.analyze` (e.g. `YoloDetector`)
and swap `get_detector()` — nothing else in the app changes.
"""

import hashlib
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

# Plausible fleet for the stub (mirrors the demo's sample data).
_PLATES = [
    ("80", "R 548 SA", "HOWO SINOTRUK"),
    ("01", "A 712 BC", "SHACMAN X3000"),
    ("85", "K 209 MK", "FAW J6"),
    ("90", "G 845 TT", "ISUZU FORWARD"),
]
_MATERIALS = ["qumshagal", "shagal", "qurilishqum", "tosh"]


@dataclass
class DetectionResult:
    plate_region: str
    plate_number: str
    model: str
    material_id: str
    # Normalized bounding box [x, y, w, h] in 0..1 (overlay on the frame).
    bbox: tuple[float, float, float, float]
    plate_confidence: float
    type_confidence: float


@runtime_checkable
class Detector(Protocol):
    def analyze(self, image_bytes: bytes | None) -> DetectionResult: ...


class StubDetector:
    """Deterministic placeholder. Varies output by a hash of the input bytes
    (or a per-call seed) so repeated demo runs look realistic but reproducible.
    """

    def __init__(self, seed: int = 0) -> None:
        self._seed = seed

    def analyze(self, image_bytes: bytes | None) -> DetectionResult:
        basis = image_bytes if image_bytes else str(self._seed).encode()
        h = int(hashlib.sha256(basis).hexdigest(), 16)

        region, number, model = _PLATES[h % len(_PLATES)]
        material = _MATERIALS[(h >> 8) % len(_MATERIALS)]

        return DetectionResult(
            plate_region=region,
            plate_number=number,
            model=model,
            material_id=material,
            bbox=(0.52, 0.22, 0.13, 0.20),
            plate_confidence=round(95 + (h % 45) / 10, 2),
            type_confidence=round(97 + (h % 25) / 10, 2),
        )


_detector: Detector = StubDetector()


def get_detector() -> Detector:
    """Swap this for a real implementation (e.g. YoloDetector) in production."""
    return _detector
