"""Document-aware sketch route validation."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import FloorElem, LevelElem, Vec2Mm
from bim_ai.routes_sketch import validate_sketch_session_against_document
from bim_ai.sketch_session import SketchLine, SketchSession


def _point(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _square_boundary(x0: float, y0: float, side: float) -> list[Vec2Mm]:
    return [
        _point(x0, y0),
        _point(x0 + side, y0),
        _point(x0 + side, y0 + side),
        _point(x0, y0 + side),
    ]


def _square_lines(x0: float, y0: float, side: float) -> list[SketchLine]:
    pts = _square_boundary(x0, y0, side)
    return [
        SketchLine(from_mm=pts[0], to_mm=pts[1]),
        SketchLine(from_mm=pts[1], to_mm=pts[2]),
        SketchLine(from_mm=pts[2], to_mm=pts[3]),
        SketchLine(from_mm=pts[3], to_mm=pts[0]),
    ]


def _floor(fid: str, level_id: str, boundary_mm: list[Vec2Mm]) -> FloorElem:
    return FloorElem(
        id=fid,
        name=fid,
        level_id=level_id,
        boundary_mm=boundary_mm,
    )


def _session(
    lines: list[SketchLine],
    *,
    level_id: str = "lvl-1",
    options: dict[str, str] | None = None,
) -> SketchSession:
    return SketchSession(
        session_id="sk-1",
        model_id="00000000-0000-0000-0000-000000000001",
        element_kind="floor",
        level_id=level_id,
        lines=lines,
        options=options or {},
    )


def _doc_with_existing_floor() -> Document:
    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    floor = _floor("floor-existing", "lvl-1", _square_boundary(0, 0, 4000))
    return Document(revision=1, elements={"lvl-1": lvl, "floor-existing": floor})


def test_floor_sketch_reports_overlap_before_finish():
    state = validate_sketch_session_against_document(
        _session(_square_lines(3000, 3000, 4000)),
        _doc_with_existing_floor(),
    )
    assert state.valid is False
    assert any(issue.code == "floor_overlap" for issue in state.issues)


def test_floor_sketch_allows_non_overlapping_boundary():
    state = validate_sketch_session_against_document(
        _session(_square_lines(6000, 6000, 1000)),
        _doc_with_existing_floor(),
    )
    assert state.valid is True
    assert state.issues == []


def test_floor_sketch_overlap_ignores_source_floor_when_editing():
    state = validate_sketch_session_against_document(
        _session(
            _square_lines(0, 0, 4000),
            options={"editElementId": "floor-existing"},
        ),
        _doc_with_existing_floor(),
    )
    assert state.valid is True
