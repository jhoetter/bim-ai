"""IMG-V3-01 — Tesseract OCR wrapper with graceful fallback.

Never raises. If Tesseract is unavailable or fails, returns [] and an advisory.
"""

from __future__ import annotations

from pathlib import Path

from bim_ai.img.types import Advisory, BboxMm, OcrLabel


def extract_labels(
    image_path: str | Path,
    scale_mm_per_px: float,
) -> tuple[list[OcrLabel], list[Advisory]]:
    """Extract text labels from an image using Tesseract OCR.

    Returns (labels, advisories). On any failure, returns ([], [advisory]).
    All coordinates are converted to mm using scale_mm_per_px.
    """
    try:
        import pytesseract  # type: ignore[import-not-found]
        from PIL import Image
    except ImportError:
        return [], [Advisory(code="tesseract_unavailable")]

    try:
        img = Image.open(str(image_path)).convert("RGB")
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    except Exception:
        return [], [Advisory(code="tesseract_unavailable")]

    labels: list[OcrLabel] = []
    n = len(data.get("text", []))
    for i in range(n):
        text = (data["text"][i] or "").strip()
        if not text:
            continue
        conf_raw = data["conf"][i]
        try:
            conf = float(conf_raw) / 100.0
        except (TypeError, ValueError):
            conf = 0.0
        if conf < 0.0:
            continue
        x_px = int(data["left"][i])
        y_px = int(data["top"][i])
        w_px = int(data["width"][i])
        h_px = int(data["height"][i])
        labels.append(
            OcrLabel(
                text=text,
                bboxMm=BboxMm(
                    x=x_px * scale_mm_per_px,
                    y=y_px * scale_mm_per_px,
                    w=w_px * scale_mm_per_px,
                    h=h_px * scale_mm_per_px,
                ),
                confidence=max(0.0, min(1.0, conf)),
            )
        )

    return labels, []
