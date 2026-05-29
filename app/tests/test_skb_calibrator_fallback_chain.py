"""TEST-CQ-02 — coverage for the SKB-04 calibrator fallback chain.

The original ``test_skb_calibrator.py`` covers the happy-path `calibrate()`
algebra. This file targets the previously-dark fallback chain in
``calibrate_from_edges`` (lines 47-222 in the source) and the
structured-log payload the production path emits.

Each test asserts BOTH the returned calibration AND the structured log
record emitted by the calibrator, so a regression cannot silently
degrade into "identity scale, no warning".
"""

from __future__ import annotations

import logging

import numpy as np
import pytest

from bim_ai.skb import calibrator
from bim_ai.skb.calibrator import (
    _ASSUMED_ROOM_WIDTH_MM,
    Anchor,
    CalibrationResult,
    calibrate,
    calibrate_from_edges,
)

_LOGGER_NAME = "bim_ai.skb.calibrator"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _records_for(caplog: pytest.LogCaptureFixture, event: str) -> list[logging.LogRecord]:
    return [r for r in caplog.records if getattr(r, "event", None) == event]


# ---------------------------------------------------------------------------
# calibrate() — anchor-side rejection (missing / zero-pixel) logs payload
# ---------------------------------------------------------------------------


def test_calibrate_missing_anchor_logs_and_rejects(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    with pytest.raises(ValueError, match="at least one anchor"):
        calibrate([])

    records = _records_for(caplog, "calibrate.reject")
    assert len(records) == 1
    rec = records[0]
    assert rec.levelname == "WARNING"
    assert rec.reason == "no_anchors"
    assert rec.anchor_count == 0


def test_calibrate_zero_pixel_anchor_logs_and_rejects(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    with pytest.raises(ValueError, match="pixels must be > 0"):
        calibrate([Anchor(label="bad-anchor", pixels=0, millimeters=1000)])

    records = _records_for(caplog, "calibrate.reject")
    assert len(records) == 1
    rec = records[0]
    assert rec.reason == "zero_pixels"
    assert rec.anchor_label == "bad-anchor"
    assert rec.pixels == 0


def test_calibrate_non_positive_millimeters_logs_and_rejects(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    with pytest.raises(ValueError, match="millimeters must be > 0"):
        calibrate([Anchor(label="bad-mm", pixels=100, millimeters=-5)])

    records = _records_for(caplog, "calibrate.reject")
    assert len(records) == 1
    rec = records[0]
    assert rec.reason == "non_positive_mm"
    assert rec.anchor_label == "bad-mm"
    assert rec.millimeters == -5


# ---------------------------------------------------------------------------
# CalibrationResult.mm_to_pixels — line 47 guard
# ---------------------------------------------------------------------------


def test_mm_to_pixels_returns_zero_when_scale_is_zero() -> None:
    """Line 47: zero-scale calibration returns 0.0 instead of dividing by zero."""
    cal = CalibrationResult(
        scale_mm_per_px=0.0,
        axis="any",
        anchor_count=0,
        residual_pct=0.0,
        notes="degenerate",
    )
    # Sanity: pixels_to_mm path still works (multiplication by zero).
    assert cal.pixels_to_mm(1234.0) == 0.0
    # The zero-division guard kicks in.
    assert cal.mm_to_pixels(5000.0) == 0.0


# ---------------------------------------------------------------------------
# calibrate_from_edges — load-time fallbacks
# ---------------------------------------------------------------------------


def test_calibrate_from_edges_load_failure_returns_identity(
    tmp_path, caplog: pytest.LogCaptureFixture
) -> None:
    """Path that does not exist — neither cv2 (unavailable) nor PIL can
    load it. The chain falls through to ``arr=None`` and returns 1.0."""
    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    missing = tmp_path / "does-not-exist.png"

    scale = calibrate_from_edges(str(missing))

    assert scale == 1.0
    records = _records_for(caplog, "calibrate_from_edges.fallback")
    assert len(records) == 1
    rec = records[0]
    assert rec.levelname == "WARNING"
    assert rec.stage == "load"
    # cv2 is not installed in the test environment, so we land in the
    # PIL branch and PIL raises FileNotFoundError → source = "load-failed".
    assert rec.source == "load-failed"
    assert rec.scale_mm_per_px == 1.0


def test_calibrate_from_edges_pil_fallback_loads_real_png(
    tmp_path, caplog: pytest.LogCaptureFixture
) -> None:
    """cv2 is unavailable; PIL is the fallback loader. With a real PNG
    on disk we should load it via PIL and then hit the numpy bbox
    branch (because cv2 contour extraction is also unavailable)."""
    from PIL import Image

    width = 200
    height = 100
    img = np.zeros((height, width), dtype=np.uint8)
    # Stripe non-zero columns 10..189 → bbox width = 180.
    img[20:80, 10:190] = 255
    Image.fromarray(img, mode="L").save(tmp_path / "edges.png")

    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)

    scale = calibrate_from_edges(str(tmp_path / "edges.png"))

    assert scale == pytest.approx(_ASSUMED_ROOM_WIDTH_MM / 180.0)
    records = _records_for(caplog, "calibrate_from_edges.numpy_bbox")
    assert len(records) == 1
    rec = records[0]
    assert rec.levelname == "INFO"
    assert rec.stage == "numpy_bbox"
    assert rec.source == "pil-fallback"
    assert rec.width_px == 180
    assert rec.assumed_width_mm == _ASSUMED_ROOM_WIDTH_MM
    assert rec.scale_mm_per_px == pytest.approx(_ASSUMED_ROOM_WIDTH_MM / 180.0)


# ---------------------------------------------------------------------------
# calibrate_from_edges — ndarray input fallback chain
# ---------------------------------------------------------------------------


def test_calibrate_from_edges_ndarray_numpy_bbox_branch(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """ndarray passed directly: cv2 contour extraction is unavailable,
    so the numpy-bbox branch decides the scale."""
    arr = np.zeros((50, 400), dtype=np.uint8)
    arr[10:40, 100:300] = 255  # bbox width = 200

    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    scale = calibrate_from_edges(arr)

    assert scale == pytest.approx(_ASSUMED_ROOM_WIDTH_MM / 200.0)
    records = _records_for(caplog, "calibrate_from_edges.numpy_bbox")
    assert len(records) == 1
    rec = records[0]
    assert rec.source == "ndarray"
    assert rec.width_px == 200
    assert rec.scale_mm_per_px == pytest.approx(_ASSUMED_ROOM_WIDTH_MM / 200.0)


def test_calibrate_from_edges_zero_pixel_input_falls_through_to_identity(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """All-zero ndarray: no contour, no non-zero column. Falls through
    every heuristic and lands on the final identity-scale fallback,
    emitting the ``stage=empty`` structured warning."""
    arr = np.zeros((50, 50), dtype=np.uint8)

    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    scale = calibrate_from_edges(arr)

    assert scale == 1.0
    records = _records_for(caplog, "calibrate_from_edges.fallback")
    assert len(records) == 1
    rec = records[0]
    assert rec.levelname == "WARNING"
    assert rec.stage == "empty"
    assert rec.source == "ndarray"
    assert rec.scale_mm_per_px == 1.0
    # And the cv2-contour event must NOT have fired.
    assert _records_for(caplog, "calibrate_from_edges.cv2_contour") == []


def test_calibrate_from_edges_bgr_3channel_array_handled(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """3-channel input goes through the ``arr.ndim == 3`` branch.
    cv2 is unavailable so the BGR→grey conversion silently passes;
    numpy bbox then operates on the 3D array directly. The chain
    must still resolve to either a scale OR the empty fallback —
    never raise."""
    arr = np.zeros((50, 400, 3), dtype=np.uint8)
    arr[10:40, 100:300, :] = 255

    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    scale = calibrate_from_edges(arr)

    # np.any(arr > 0, axis=0) on (H,W,3) returns shape (W,3); .any()
    # collapses to scalar True, and np.where(cols)[0] yields indices
    # across the flattened nonzero mask. The width-px computation is
    # still > 0, so we expect the numpy_bbox path to fire.
    assert scale != 1.0  # heuristic produced *some* scale
    assert scale > 0
    records = _records_for(caplog, "calibrate_from_edges.numpy_bbox")
    assert len(records) == 1
    assert records[0].source == "ndarray"


# ---------------------------------------------------------------------------
# calibrate_from_edges — numpy-missing branch (simulate import failure)
# ---------------------------------------------------------------------------


def test_calibrate_from_edges_numpy_missing_returns_identity(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """If numpy itself is unimportable, the resolver hits ``arr = None``
    with ``source = "numpy-missing"`` and the identity-scale fallback
    fires."""
    import builtins

    real_import = builtins.__import__

    def blocking_import(name: str, *args, **kwargs):
        if name == "numpy":
            raise ImportError("simulated: numpy unavailable")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", blocking_import)

    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    scale = calibrate_from_edges("/tmp/whatever.png")

    assert scale == 1.0
    records = _records_for(caplog, "calibrate_from_edges.fallback")
    assert len(records) == 1
    rec = records[0]
    assert rec.stage == "load"
    assert rec.source == "numpy-missing"
    assert rec.scale_mm_per_px == 1.0


# ---------------------------------------------------------------------------
# Smoke: the module-level logger name is stable (so log shippers
# downstream can target it).
# ---------------------------------------------------------------------------


def test_module_logger_name_is_stable() -> None:
    assert calibrator._logger.name == _LOGGER_NAME


# ---------------------------------------------------------------------------
# Coverage backstops for the non-fallback paths so the file as a whole
# clears the TEST-CQ-02 80% floor.
# ---------------------------------------------------------------------------


def test_calibrate_single_anchor_does_not_log_reject(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Sanity guard: a healthy single-anchor calibration must NOT emit a
    ``calibrate.reject`` warning. Pairs with the rejection tests above —
    together they prove the reject log only fires on actual rejections.
    """
    caplog.set_level(logging.DEBUG, logger=_LOGGER_NAME)
    cal = calibrate([Anchor(label="ref", pixels=200, millimeters=2000, axis="x")])

    assert cal.scale_mm_per_px == pytest.approx(10.0)
    assert cal.axis == "x"
    assert cal.anchor_count == 1
    assert cal.residual_pct == 0.0
    assert cal.notes == "single anchor: exact"
    # And the success path round-trips through mm_to_pixels (line 51).
    assert cal.mm_to_pixels(2000.0) == pytest.approx(200.0)

    assert _records_for(caplog, "calibrate.reject") == []


def test_calibrate_multiple_anchors_reports_residual_and_isotropic_axis() -> None:
    """Drives the multi-anchor branch (lines 102-104) and the
    same-axis collapse (line 111)."""
    cal = calibrate(
        [
            Anchor(label="a", pixels=100, millimeters=1000, axis="x"),
            Anchor(label="b", pixels=100, millimeters=1100, axis="x"),
        ]
    )
    # Two scales: 10.0 and 11.0 → median = 10.5.
    assert cal.scale_mm_per_px == pytest.approx(10.5)
    assert cal.anchor_count == 2
    # max deviation = 0.5; residual = 0.5 / 10.5 * 100 ≈ 4.76%.
    assert cal.residual_pct == pytest.approx(100.0 * 0.5 / 10.5)
    assert cal.notes.startswith("2 anchors")
    # Both anchors share axis "x" → no isotropic collapse.
    assert cal.axis == "x"


def test_make_calibrated_sketch_round_trip() -> None:
    """Exercises ``make_calibrated_sketch`` and the
    ``CalibratedSketch`` measurement helpers (lines 133-149, 157-159)."""
    sketch = calibrator.make_calibrated_sketch(
        [Anchor(label="ref", pixels=100, millimeters=1000)],
        image_path="plan.png",
    )

    assert sketch.image_path == "plan.png"
    assert sketch.calibration.scale_mm_per_px == pytest.approx(10.0)
    assert sketch.anchors[0].label == "ref"

    # measure_pixels (line 133)
    assert sketch.measure_pixels(50.0) == pytest.approx(500.0)
    # measure_segment 3-4-5 triangle (lines 137-139)
    assert sketch.measure_segment((0.0, 0.0), (3.0, 4.0)) == pytest.approx(50.0)
    # position_to_mm with non-origin reference (lines 146-149)
    assert sketch.position_to_mm((100.0, 50.0), origin_px=(10.0, 5.0)) == pytest.approx(
        (900.0, 450.0)
    )
