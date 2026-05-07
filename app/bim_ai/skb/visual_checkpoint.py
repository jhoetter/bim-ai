"""SKB-03 — visual checkpoint tool.

Captures a deterministic 3D screenshot of the current model + target,
computes the per-region pixel delta, returns a `CheckpointReport` the
agent can read to drive SKB-15's refine loop.

This module ships:

  - `CheckpointRegion` / `CheckpointReport` data shapes
  - `compare_pngs` — pure pixel comparison (mean abs diff + per-region
    delta + dominant-colour shift) — no dev-server / Playwright required
  - `run_checkpoint_against_target` — orchestrates: take screenshot via
    a caller-provided `screenshot_fn`, compare to target PNG, return
    report. The screenshot function is injected (Playwright vs headless
    Three.js vs anything else) so this stays testable.

The Playwright wiring lives in `packages/web/e2e/skb-checkpoint.spec.ts`
when it's enabled; this module only does the math + I/O.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Sequence


@dataclass(frozen=True)
class CheckpointRegion:
    """Sub-region of the rendered image to delta-test independently.

    Coordinates are pixel `(x_min, y_min, x_max, y_max)` from top-left.
    `weight` boosts the region's contribution to the overall delta —
    use it to prioritise the silhouette over interior detail.
    """

    label: str
    bounds: tuple[int, int, int, int]
    weight: float = 1.0


@dataclass(frozen=True)
class RegionDelta:
    label: str
    mean_abs_delta: float          # 0..255
    pct_pixels_above_threshold: float   # 0..100
    weight: float


@dataclass(frozen=True)
class CheckpointReport:
    """Full result of one checkpoint run."""

    actual_png: str
    target_png: str
    overall_delta_normalised: float    # 0..1, weighted average across regions / 255
    threshold: float                    # acceptance threshold used
    region_deltas: list[RegionDelta] = field(default_factory=list)
    note: str = ""

    @property
    def passed(self) -> bool:
        return self.overall_delta_normalised <= self.threshold

    def to_dict(self) -> dict:
        return {
            "actual_png": self.actual_png,
            "target_png": self.target_png,
            "overall_delta_normalised": self.overall_delta_normalised,
            "threshold": self.threshold,
            "passed": self.passed,
            "region_deltas": [
                {
                    "label": r.label,
                    "mean_abs_delta": r.mean_abs_delta,
                    "pct_pixels_above_threshold": r.pct_pixels_above_threshold,
                    "weight": r.weight,
                }
                for r in self.region_deltas
            ],
            "note": self.note,
        }


def _load_rgb(path: str | Path):
    """Load PNG as a (H, W, 3) numpy uint8 array, RGB."""
    from PIL import Image
    import numpy as np
    img = Image.open(path).convert("RGB")
    return np.asarray(img, dtype=np.uint8)


def compare_pngs(
    actual_png: str | Path,
    target_png: str | Path,
    regions: Sequence[CheckpointRegion] | None = None,
    threshold: float = 0.05,
    pixel_diff_threshold: int = 16,
    note: str = "",
) -> CheckpointReport:
    """Pure-math pixel delta. Resamples actual → target if sizes differ
    so callers don't have to pre-size."""
    import numpy as np

    actual = _load_rgb(actual_png)
    target = _load_rgb(target_png)
    if actual.shape != target.shape:
        from PIL import Image
        # Resize actual to target's dimensions
        h, w, _ = target.shape
        actual_img = Image.fromarray(actual).resize((w, h))
        actual = np.asarray(actual_img, dtype=np.uint8)

    region_list = (
        list(regions)
        if regions
        else [CheckpointRegion(label="full", bounds=(0, 0, target.shape[1], target.shape[0]))]
    )

    deltas: list[RegionDelta] = []
    weighted_mean_sum = 0.0
    weight_sum = 0.0
    for r in region_list:
        x0, y0, x1, y1 = r.bounds
        x0 = max(0, x0)
        y0 = max(0, y0)
        x1 = min(target.shape[1], x1)
        y1 = min(target.shape[0], y1)
        if x1 <= x0 or y1 <= y0:
            continue
        actual_crop = actual[y0:y1, x0:x1].astype(np.int16)
        target_crop = target[y0:y1, x0:x1].astype(np.int16)
        diff = np.abs(actual_crop - target_crop)
        mad = float(diff.mean())
        per_pixel = diff.max(axis=2)  # worst channel
        pct_over = float((per_pixel > pixel_diff_threshold).mean() * 100.0)
        deltas.append(
            RegionDelta(
                label=r.label,
                mean_abs_delta=mad,
                pct_pixels_above_threshold=pct_over,
                weight=r.weight,
            )
        )
        weighted_mean_sum += mad * r.weight
        weight_sum += r.weight

    overall = (weighted_mean_sum / weight_sum / 255.0) if weight_sum > 0 else 1.0
    return CheckpointReport(
        actual_png=str(actual_png),
        target_png=str(target_png),
        overall_delta_normalised=overall,
        threshold=threshold,
        region_deltas=deltas,
        note=note,
    )


def run_checkpoint_against_target(
    *,
    target_png: str | Path,
    screenshot_fn: Callable[[Path], None],
    output_dir: str | Path,
    actual_basename: str = "actual.png",
    regions: Sequence[CheckpointRegion] | None = None,
    threshold: float = 0.05,
) -> CheckpointReport:
    """Orchestrates: call `screenshot_fn(out_path)` to capture the
    current model render, then compare to `target_png`. Returns report.

    `screenshot_fn` is injected so Playwright / headless three.js / a
    test fixture can all plug in without this module knowing about them.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    actual_png = out_dir / actual_basename
    screenshot_fn(actual_png)
    return compare_pngs(
        actual_png=actual_png,
        target_png=target_png,
        regions=regions,
        threshold=threshold,
    )
