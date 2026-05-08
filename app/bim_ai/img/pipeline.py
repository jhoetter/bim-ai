"""IMG-V3-01 — Deterministic CV trace pipeline.

Entry point: trace(image_path, ...) -> StructuredLayout

Pipeline:
  1. Load image → get pixel dimensions
  2. SKB-14 edge detection (deterministic Canny)
  3. SKB-07 colour sampler (for region type hints, optional)
  4. polygon.recover_rooms() → rooms, walls, openings
  5. ocr.extract_labels() → OCR labels (graceful fallback)
  6. Assemble StructuredLayout

No AI runs inside this module. Same input → byte-identical JSON output.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path

from bim_ai.img.types import Advisory, ImageMetadata, StructuredLayout
from bim_ai.skb.edge_detection import detect_edges, edge_density

_DEFAULT_SCALE_MM_PER_PX = 1.0
_LOW_CONTRAST_DENSITY_THRESHOLD = 0.001


def trace(
    image_path: str | Path,
    *,
    archetype_hint: str | None = None,
    brief_path: str | None = None,
) -> StructuredLayout:
    """Deterministic CV trace: image → StructuredLayout.

    ``archetype_hint`` and ``brief_path`` are passed through as metadata only
    — the CV pipeline does not interpret them.

    Raises FileNotFoundError if the image does not exist.
    """
    from bim_ai.img.ocr import extract_labels
    from bim_ai.img.polygon import recover_rooms

    in_path = Path(image_path)
    if not in_path.exists():
        raise FileNotFoundError(f"Image not found: {in_path}")

    # 1. Load image dimensions (lazy import for speed).
    try:
        from PIL import Image as _Image

        with _Image.open(str(in_path)) as img:
            width_px, height_px = img.size
    except Exception:
        try:
            import cv2  # type: ignore[import-not-found]

            cv_img = cv2.imread(str(in_path))
            if cv_img is None:
                raise ValueError(f"Cannot read image: {in_path}")
            height_px, width_px = cv_img.shape[:2]
        except Exception as exc:
            raise ValueError(f"Cannot load image dimensions: {exc}") from exc

    scale = _DEFAULT_SCALE_MM_PER_PX

    # 2. SKB-14 edge detection — write to a deterministic temp path keyed by
    # the input file's content hash so repeated calls reuse the same output.
    img_hash = _file_sha256_prefix(in_path)
    tmp_dir = Path(tempfile.gettempdir()) / "bim_ai_img"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    edges_path = tmp_dir / f"edges_{img_hash}.png"

    edge_result = detect_edges(
        str(in_path),
        str(edges_path),
        canny_low=50,
        canny_high=150,
        blur_sigma=1.4,
    )

    advisories: list[Advisory] = []

    # 3. Polygon recovery (Hough + contours)
    rooms, walls, openings, poly_advisories = recover_rooms(
        edges_path=str(edges_path),
        scale_mm_per_px=scale,
        image_width_px=width_px,
        image_height_px=height_px,
    )
    advisories.extend(poly_advisories)

    # 4. OCR (graceful fallback)
    ocr_labels, ocr_advisories = extract_labels(str(in_path), scale)
    advisories.extend(ocr_advisories)

    # Check for no_dimensions_detected advisory (OCR found no numeric labels).
    has_numeric = any(any(c.isdigit() for c in lbl.text) for lbl in ocr_labels)
    if not has_numeric and not any(a.code == "tesseract_unavailable" for a in advisories):
        advisories.append(Advisory(code="no_dimensions_detected"))

    # 5. Assemble
    layout = StructuredLayout(
        schemaVersion="img-v3.0",
        imageMetadata=ImageMetadata(
            widthPx=width_px,
            heightPx=height_px,
            calibrationMmPerPx=scale,
            briefPath=str(brief_path) if brief_path else None,
        ),
        rooms=rooms,
        walls=walls,
        openings=openings,
        ocrLabels=ocr_labels,
        advisories=_dedup_advisories(advisories),
    )
    return layout


def _file_sha256_prefix(path: Path, n: int = 16) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()[:n]


def _dedup_advisories(advisories: list[Advisory]) -> list[Advisory]:
    seen: set[str] = set()
    out: list[Advisory] = []
    for a in advisories:
        if a.code not in seen:
            seen.add(a.code)
            out.append(a)
    return out
