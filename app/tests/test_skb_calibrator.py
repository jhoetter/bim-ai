"""Tests for SKB-04 sketch-to-dimensions calibrator."""

from __future__ import annotations

import math

import pytest

from bim_ai.skb.calibrator import (
    Anchor,
    calibrate,
    make_calibrated_sketch,
)


def test_single_anchor_exact() -> None:
    a = Anchor(label="house width", pixels=700, millimeters=7000, axis="x")
    cal = calibrate([a])
    assert cal.scale_mm_per_px == pytest.approx(10.0)
    assert cal.axis == "x"
    assert cal.residual_pct == 0.0
    assert cal.pixels_to_mm(100) == pytest.approx(1000)
    assert cal.mm_to_pixels(2500) == pytest.approx(250)


def test_two_consistent_anchors_zero_residual() -> None:
    anchors = [
        Anchor(label="width", pixels=500, millimeters=5000, axis="x"),
        Anchor(label="height", pixels=300, millimeters=3000, axis="y"),
    ]
    cal = calibrate(anchors)
    assert cal.scale_mm_per_px == pytest.approx(10.0)
    assert cal.residual_pct < 0.001


def test_two_inconsistent_anchors_reports_residual() -> None:
    anchors = [
        Anchor(label="width", pixels=500, millimeters=5000),
        Anchor(label="height", pixels=300, millimeters=3300),
    ]
    cal = calibrate(anchors)
    # Scales: 10.0 and 11.0, median = 10.5, max deviation = 0.5
    assert cal.scale_mm_per_px == pytest.approx(10.5)
    # |10.0 - 10.5| / 10.5 ≈ 4.76%
    assert 4 < cal.residual_pct < 6


def test_calibrate_rejects_zero_pixels() -> None:
    with pytest.raises(ValueError):
        calibrate([Anchor(label="bad", pixels=0, millimeters=1000)])


def test_calibrate_rejects_zero_mm() -> None:
    with pytest.raises(ValueError):
        calibrate([Anchor(label="bad", pixels=100, millimeters=0)])


def test_calibrate_rejects_empty() -> None:
    with pytest.raises(ValueError):
        calibrate([])


def test_axis_isotropic_when_mixed() -> None:
    anchors = [
        Anchor(label="x-anchor", pixels=500, millimeters=5000, axis="x"),
        Anchor(label="y-anchor", pixels=300, millimeters=3000, axis="y"),
    ]
    cal = calibrate(anchors)
    assert cal.axis == "any"


def test_calibrated_sketch_measure_segment() -> None:
    sk = make_calibrated_sketch([Anchor("ref", 100, 1000)])
    # 3-4-5 triangle in pixels → 5 px → 50 mm
    d = sk.measure_segment((0, 0), (3, 4))
    assert d == pytest.approx(50)


def test_calibrated_sketch_position_to_mm() -> None:
    sk = make_calibrated_sketch([Anchor("ref", 100, 1000)])
    p = sk.position_to_mm((50, 25), origin_px=(10, 5))
    # (50-10) * 10 = 400, (25-5) * 10 = 200
    assert p == pytest.approx((400, 200))


def test_calibrated_sketch_records_anchors() -> None:
    anchors = [Anchor("a1", 100, 1000), Anchor("a2", 200, 2000)]
    sk = make_calibrated_sketch(anchors, image_path="x.png")
    assert sk.anchors == anchors
    assert sk.image_path == "x.png"


def test_three_anchors_median() -> None:
    anchors = [
        Anchor("a", 100, 1000),   # 10.0
        Anchor("b", 100, 1100),   # 11.0
        Anchor("c", 100, 1200),   # 12.0
    ]
    cal = calibrate(anchors)
    assert cal.scale_mm_per_px == pytest.approx(11.0)
    # max deviation from 11 is 1, residual ≈ 9.09%
    assert math.isclose(cal.residual_pct, 100.0 / 11.0, rel_tol=1e-3)
