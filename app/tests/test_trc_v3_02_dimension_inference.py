from __future__ import annotations

import pytest

from bim_ai.img.dimension_inference import ScaleObservation, infer_mm_per_px_from_symbols


def test_trc_v3_02_infers_median_scale_from_known_symbols() -> None:
    result = infer_mm_per_px_from_symbols(
        [
            ScaleObservation(symbol="toilet", pixel_width=70, confidence=0.9),
            ScaleObservation(symbol="standard_door", pixel_width=90, confidence=0.8),
            ScaleObservation(symbol="parking_stall", pixel_width=200, confidence=0.95),
        ]
    )

    assert result.ok is True
    assert result.source_count == 3
    assert result.mm_per_px == pytest.approx(10.0)
    assert result.confidence == pytest.approx((0.9 + 0.8 + 0.95) / 3)


def test_trc_v3_02_rejects_low_confidence_or_invalid_symbols() -> None:
    result = infer_mm_per_px_from_symbols(
        [
            ScaleObservation(symbol="toilet", pixel_width=70, confidence=0.3),
            ScaleObservation(symbol="standard_door", pixel_width=0, confidence=0.9),
        ]
    )

    assert result.ok is False
    assert result.mm_per_px is None
    assert result.reason == "no_known_scale_symbols"
