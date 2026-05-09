"""SKB-04 — sketch-to-dimensions calibrator.

The agent rarely gets every dimension from the sketch; usually 2-3 are
called out, and the rest is proportional. This module takes a list of
**anchors** (each pinning a pixel-distance to a real-world mm distance),
computes a pixel-to-mm scale, and exposes a query API the agent uses
when it needs a derived measurement.

No model. Pure math. The agent is still the brain — it provides anchors,
the calibrator gives back consistent numbers.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Anchor:
    """One dimension call-out: a pixel distance corresponds to a real
    measurement in mm. `axis` is `'x'` or `'y'` to disambiguate
    perspective-distorted sketches.
    """

    label: str
    pixels: float
    millimeters: float
    axis: str = "any"   # 'x' | 'y' | 'any'


@dataclass(frozen=True)
class CalibrationResult:
    """The agreed scale with provenance."""

    scale_mm_per_px: float
    axis: str               # 'x', 'y', or 'any' when isotropic
    anchor_count: int
    residual_pct: float     # max % disagreement between anchors at the chosen scale
    notes: str = ""

    def pixels_to_mm(self, pixels: float) -> float:
        return pixels * self.scale_mm_per_px

    def mm_to_pixels(self, mm: float) -> float:
        if self.scale_mm_per_px == 0:
            return 0.0
        return mm / self.scale_mm_per_px


def calibrate(anchors: Sequence[Anchor]) -> CalibrationResult:
    """Compute a single scale from one or more anchors.

    With a single anchor: scale = mm / pixels exactly.
    With multiple: median scale; residual = max abs % deviation from median.
    Raises ValueError on no anchors or zero-pixel anchors.
    """
    if not anchors:
        raise ValueError("calibrate(): need at least one anchor")
    for a in anchors:
        if a.pixels <= 0:
            raise ValueError(f"anchor {a.label!r}: pixels must be > 0 (got {a.pixels})")
        if a.millimeters <= 0:
            raise ValueError(f"anchor {a.label!r}: millimeters must be > 0 (got {a.millimeters})")

    scales = sorted(a.millimeters / a.pixels for a in anchors)
    n = len(scales)
    median = scales[n // 2] if n % 2 == 1 else 0.5 * (scales[n // 2 - 1] + scales[n // 2])

    if n == 1:
        residual = 0.0
        notes = "single anchor: exact"
    else:
        residual = 100.0 * max(abs(s - median) for s in scales) / median
        notes = f"{n} anchors; max residual {residual:.2f}%"

    # Determine axis: isotropic if all anchors share an axis or all are 'any'.
    axes = {a.axis for a in anchors}
    if axes == {"any"} or len(axes) > 1:
        out_axis = "any"
    else:
        out_axis = next(iter(axes))

    return CalibrationResult(
        scale_mm_per_px=median,
        axis=out_axis,
        anchor_count=n,
        residual_pct=residual,
        notes=notes,
    )


@dataclass(frozen=True)
class CalibratedSketch:
    """A sketch whose pixel-space has been calibrated via one or more
    anchors. Subsequent agent queries hit the cached `Calibration`."""

    image_path: str | None
    calibration: CalibrationResult
    anchors: list[Anchor] = field(default_factory=list)

    def measure_pixels(self, pixels: float) -> float:
        """Return mm corresponding to a pixel distance."""
        return self.calibration.pixels_to_mm(pixels)

    def measure_segment(self, p1: tuple[float, float], p2: tuple[float, float]) -> float:
        """mm length of the pixel segment p1 → p2."""
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        d_px = (dx * dx + dy * dy) ** 0.5
        return self.measure_pixels(d_px)

    def position_to_mm(self, p: tuple[float, float], origin_px: tuple[float, float] = (0, 0)) -> tuple[float, float]:
        """Convert a pixel position to a mm-space position relative to
        the given pixel origin (default = pixel (0, 0))."""
        return (
            self.calibration.pixels_to_mm(p[0] - origin_px[0]),
            self.calibration.pixels_to_mm(p[1] - origin_px[1]),
        )


def make_calibrated_sketch(
    anchors: Iterable[Anchor],
    image_path: str | None = None,
) -> CalibratedSketch:
    """Convenience: calibrate + bundle the anchors into a CalibratedSketch."""
    anchor_list = list(anchors)
    cal = calibrate(anchor_list)
    return CalibratedSketch(image_path=image_path, calibration=cal, anchors=anchor_list)


# ---------------------------------------------------------------------------
# SKB-04 extension — auto-calibrate from an edge-detection output image.
# ---------------------------------------------------------------------------

_ASSUMED_ROOM_WIDTH_MM: float = 4000.0
"""Heuristic assumption: the largest detected rectangular room is ~4 m wide.
This gives a reasonable mm/px estimate for typical architectural floor plans.
"""


def calibrate_from_edges(edges_image: object) -> float:
    """Estimate mm-per-pixel scale from an edge-detection output.

    Strategy: find the widest rectangular region in the edge image (assumed to
    be the largest room), then set scale = _ASSUMED_ROOM_WIDTH_MM / width_px.

    ``edges_image`` may be:
    - A NumPy ndarray (uint8 greyscale or BGR) — used directly.
    - A file path (str / Path) — loaded with cv2 or PIL.

    Falls back to 1.0 if no usable contour is found.
    """

    arr = None

    # Resolve to numpy array.
    try:
        import numpy as np  # type: ignore[import-not-found]

        if isinstance(edges_image, np.ndarray):
            arr = edges_image
        else:
            # Treat as file path.
            path_str = str(edges_image)
            try:
                import cv2  # type: ignore[import-not-found]

                arr = cv2.imread(path_str, cv2.IMREAD_GRAYSCALE)
            except ImportError:
                try:
                    import numpy as np
                    from PIL import Image as _Image  # type: ignore[import-not-found]

                    arr = np.asarray(_Image.open(path_str).convert("L"), dtype=np.uint8)
                except Exception:
                    arr = None
    except ImportError:
        arr = None

    if arr is None:
        return 1.0

    # Convert to greyscale if BGR.
    try:
        import numpy as np  # type: ignore[import-not-found]

        if arr.ndim == 3:
            import cv2  # type: ignore[import-not-found]

            arr = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    except Exception:
        pass

    # Try cv2 contour approach first.
    try:
        import cv2  # type: ignore[import-not-found]

        contours, _ = cv2.findContours(arr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            _x, _y, w, _h = cv2.boundingRect(largest)
            if w > 0:
                return _ASSUMED_ROOM_WIDTH_MM / float(w)
    except Exception:
        pass

    # Fallback: bounding box of all non-zero pixels via numpy.
    try:
        import numpy as np  # type: ignore[import-not-found]

        cols = np.any(arr > 0, axis=0)
        if cols.any():
            col_indices = np.where(cols)[0]
            width_px = int(col_indices[-1] - col_indices[0] + 1)
            if width_px > 0:
                return _ASSUMED_ROOM_WIDTH_MM / float(width_px)
    except Exception:
        pass

    return 1.0
