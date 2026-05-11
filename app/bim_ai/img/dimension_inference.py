"""TRC-V3-02 — deterministic AutoScale-style dimension inference.

This module deliberately avoids model mutation. It reduces observed, recognised
symbols from a traced raster into a stable millimetres-per-pixel estimate that
TRC-V3-01 orchestration can consume later.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Literal

KnownSymbol = Literal["toilet", "standard_door", "parking_stall"]

KNOWN_SYMBOL_WIDTH_MM: dict[KnownSymbol, float] = {
    "toilet": 700.0,
    "standard_door": 900.0,
    "parking_stall": 2500.0,
}


@dataclass(frozen=True)
class ScaleObservation:
    symbol: KnownSymbol
    pixel_width: float
    confidence: float = 1.0


@dataclass(frozen=True)
class DimensionInferenceResult:
    ok: bool
    mm_per_px: float | None
    source_count: int
    confidence: float
    reason: str | None = None


def infer_mm_per_px_from_symbols(
    observations: list[ScaleObservation],
    *,
    min_confidence: float = 0.55,
) -> DimensionInferenceResult:
    """Infer drawing scale from recognised known-size plan symbols.

    Each accepted observation contributes ``known_width_mm / observed_px``.
    The median is used so one bad recognition cannot dominate the page scale.
    """

    ratios: list[float] = []
    confidences: list[float] = []
    for obs in observations:
        if obs.confidence < min_confidence:
            continue
        if obs.pixel_width <= 0:
            continue
        known_width = KNOWN_SYMBOL_WIDTH_MM[obs.symbol]
        ratios.append(known_width / obs.pixel_width)
        confidences.append(obs.confidence)

    if not ratios:
        return DimensionInferenceResult(
            ok=False,
            mm_per_px=None,
            source_count=0,
            confidence=0.0,
            reason="no_known_scale_symbols",
        )

    return DimensionInferenceResult(
        ok=True,
        mm_per_px=float(median(ratios)),
        source_count=len(ratios),
        confidence=float(sum(confidences) / len(confidences)),
    )
