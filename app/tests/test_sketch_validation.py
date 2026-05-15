"""Validation rules for SKT-01 sketch sessions.

Floor sketches are 2D in level-local mm: planarity is automatic by construction
so the rules under test here are closed-loop, self-intersection, and
zero-length lines.
"""

from __future__ import annotations

from bim_ai.elements import Vec2Mm
from bim_ai.sketch_session import SketchLine
from bim_ai.sketch_validation import (
    derive_closed_loop_polygon,
    validate_session,
)


def _line(x0: float, y0: float, x1: float, y1: float) -> SketchLine:
    return SketchLine(from_mm=Vec2Mm(xMm=x0, yMm=y0), to_mm=Vec2Mm(xMm=x1, yMm=y1))


def test_empty_sketch_is_open_loop():
    state = validate_session([])
    assert state.valid is False
    assert any(i.code == "open_loop" for i in state.issues)


def test_three_sides_of_rectangle_open_loop_reports_offending_lines():
    lines = [
        _line(0, 0, 1000, 0),
        _line(1000, 0, 1000, 1000),
        _line(1000, 1000, 0, 1000),
    ]
    state = validate_session(lines)
    assert state.valid is False
    open_issues = [i for i in state.issues if i.code == "open_loop"]
    assert open_issues
    assert open_issues[0].line_indices  # the lines touching the dangling vertices


def test_closed_rectangle_is_valid():
    lines = [
        _line(0, 0, 1000, 0),
        _line(1000, 0, 1000, 1000),
        _line(1000, 1000, 0, 1000),
        _line(0, 1000, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is True
    assert state.issues == []


def test_self_intersection_caught():
    # Bow-tie: two diagonals of a square cross in the middle.
    lines = [
        _line(0, 0, 1000, 1000),
        _line(0, 1000, 1000, 0),
        _line(1000, 1000, 0, 1000),
        _line(1000, 0, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is False
    assert any(i.code == "self_intersection" for i in state.issues)


def test_zero_length_line_caught():
    lines = [
        _line(0, 0, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is False
    assert any(i.code == "zero_length" for i in state.issues)


def test_too_short_boundary_edge_is_caught():
    lines = [
        _line(0, 0, 50, 0),
        _line(50, 0, 50, 1000),
        _line(50, 1000, 0, 1000),
        _line(0, 1000, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is False
    assert any(i.code == "too_short_edge" for i in state.issues)


def test_duplicate_boundary_edge_is_caught_even_when_reversed():
    lines = [
        _line(0, 0, 1000, 0),
        _line(1000, 0, 0, 0),
        _line(1000, 0, 1000, 1000),
        _line(1000, 1000, 0, 1000),
        _line(0, 1000, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is False
    assert any(i.code == "duplicate_edge" for i in state.issues)


def test_overlapping_collinear_boundary_edge_is_caught():
    lines = [
        _line(0, 0, 2000, 0),
        _line(1000, 0, 2000, 0),
        _line(2000, 0, 2000, 1000),
        _line(2000, 1000, 0, 1000),
        _line(0, 1000, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is False
    assert any(i.code == "overlapping_edge" for i in state.issues)


def test_l_shape_validates_and_derives_polygon():
    # Six-edge L-shape, drawn CCW.
    lines = [
        _line(0, 0, 2000, 0),
        _line(2000, 0, 2000, 1000),
        _line(2000, 1000, 1000, 1000),
        _line(1000, 1000, 1000, 2000),
        _line(1000, 2000, 0, 2000),
        _line(0, 2000, 0, 0),
    ]
    state = validate_session(lines)
    assert state.valid is True
    polygon = derive_closed_loop_polygon(lines)
    assert len(polygon) == 6
    # Polygon vertices should match the L corners (order may start anywhere).
    expected = {(0.0, 0.0), (2000.0, 0.0), (2000.0, 1000.0), (1000.0, 1000.0), (1000.0, 2000.0), (0.0, 2000.0)}
    assert {(round(x, 3), round(y, 3)) for (x, y) in polygon} == expected
