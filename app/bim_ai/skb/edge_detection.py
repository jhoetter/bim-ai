"""SKB-14 — sketch edge-detection helper (classical CV).

Deterministic vision aid: runs Canny edge-detection on a sketch / colour
study and writes an edges-only PNG. Massing outlines pop out more crisply
than the original drawing.

The agent reads the edges PNG with its own vision and traces polygons.
Pure OpenCV (or scikit-image fallback). No model.

Avoids the heavy OpenCV dep at import-time — the function imports cv2
lazily so unrelated tests don't pay the cost.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class EdgeDetectionResult:
    input_path: str
    output_path: str
    canny_low: int
    canny_high: int
    blur_sigma: float
    edge_pixel_count: int
    image_size: tuple[int, int]   # (width, height) in pixels


def detect_edges(
    input_path: str | Path,
    output_path: str | Path,
    canny_low: int = 50,
    canny_high: int = 150,
    blur_sigma: float = 1.4,
) -> EdgeDetectionResult:
    """Run Canny edge detection and write an edges-only PNG.

    `canny_low` / `canny_high` are the hysteresis thresholds (0-255).
    `blur_sigma` is the Gaussian blur sigma applied before edge detection
    to suppress sketch noise; pass 0 to skip blur.

    Returns metadata about the run that callers can log to evidence.
    """
    in_path = Path(input_path)
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import cv2  # type: ignore[import-not-found]

        img = cv2.imread(str(in_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise FileNotFoundError(f"could not read image: {in_path}")
        if blur_sigma > 0:
            ksize = max(3, int(round(blur_sigma * 3)) | 1)
            img = cv2.GaussianBlur(img, (ksize, ksize), blur_sigma)
        edges = cv2.Canny(img, canny_low, canny_high)
        cv2.imwrite(str(out_path), edges)
        edge_count = int((edges > 0).sum())
        h, w = edges.shape
        return EdgeDetectionResult(
            input_path=str(in_path),
            output_path=str(out_path),
            canny_low=canny_low,
            canny_high=canny_high,
            blur_sigma=blur_sigma,
            edge_pixel_count=edge_count,
            image_size=(int(w), int(h)),
        )
    except ImportError:
        # scikit-image fallback — Canny applies blur internally via sigma;
        # do NOT pre-blur or the double smoothing kills all edge gradients.
        from skimage import feature, img_as_ubyte, io

        img = io.imread(str(in_path), as_gray=True)
        edges = feature.canny(
            img,
            sigma=blur_sigma if blur_sigma > 0 else 1.0,
            low_threshold=canny_low / 255.0,
            high_threshold=canny_high / 255.0,
        )
        edges_u8 = img_as_ubyte(edges)
        io.imsave(str(out_path), edges_u8)
        edge_count = int(edges.sum())
        h, w = edges.shape
        return EdgeDetectionResult(
            input_path=str(in_path),
            output_path=str(out_path),
            canny_low=canny_low,
            canny_high=canny_high,
            blur_sigma=blur_sigma,
            edge_pixel_count=edge_count,
            image_size=(int(w), int(h)),
        )


def edge_density(result: EdgeDetectionResult) -> float:
    """Edge pixels / total pixels — quick check that detection didn't
    return all-black (failed) or all-white (over-saturated)."""
    w, h = result.image_size
    if w == 0 or h == 0:
        return 0.0
    return result.edge_pixel_count / float(w * h)
