"""SKT-01 propagation — sketch sessions for `roof` and `room_separation`.

Floor sketches were already covered by `test_sketch_session.py`. This module
exercises the wave3-4 propagation: end-to-end commit through `try_commit` for
each newly-supported element kind.

Ceiling is intentionally not covered: it requires a `CeilingElem` +
`createCeiling` engine command that lives in its own kernel WP. Until that
lands, opening a sketch session with `elementKind='ceiling'` is rejected by
the HTTP route.
"""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    RoofElem,
    RoomSeparationElem,
    Vec2Mm,
)
from bim_ai.engine import try_commit
from bim_ai.sketch_session import SketchLine, SketchSession
from bim_ai.sketch_validation import (
    derive_closed_loop_polygon,
    validate_sketch_session,
)


def _line(x0: float, y0: float, x1: float, y1: float) -> SketchLine:
    return SketchLine(from_mm=Vec2Mm(xMm=x0, yMm=y0), to_mm=Vec2Mm(xMm=x1, yMm=y1))


def _bare_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
        },
    )


def _l_shape_lines() -> list[SketchLine]:
    """Six-segment L-shape, closed loop."""

    return [
        _line(0, 0, 2000, 0),
        _line(2000, 0, 2000, 1000),
        _line(2000, 1000, 1000, 1000),
        _line(1000, 1000, 1000, 2000),
        _line(1000, 2000, 0, 2000),
        _line(0, 2000, 0, 0),
    ]


def test_roof_sketch_session_validates_as_closed_loop():
    sess = SketchSession(
        sessionId="sk-roof",
        modelId="m-1",
        elementKind="roof",
        levelId="lvl-1",
        lines=_l_shape_lines(),
        status="open",
    )
    state = validate_sketch_session(sess)
    assert state.valid, state.issues


def test_roof_sketch_session_finishes_via_create_roof():
    """Finish translation: closed-loop sketch → `createRoof` with footprintMm."""

    polygon = derive_closed_loop_polygon(_l_shape_lines())
    cmd = {
        "type": "createRoof",
        "name": "L Roof",
        "referenceLevelId": "lvl-1",
        "footprintMm": [{"xMm": x, "yMm": y} for (x, y) in polygon],
        "roofGeometryMode": "mass_box",
    }
    ok, new_doc, _cmd_obj, _viols, code = try_commit(_bare_doc(), cmd)
    assert ok, code
    assert new_doc is not None
    roofs = [el for el in new_doc.elements.values() if isinstance(el, RoofElem)]
    assert len(roofs) == 1
    assert len(roofs[0].footprint_mm) == 6
    assert roofs[0].roof_geometry_mode == "mass_box"


def test_room_separation_session_validates_with_open_lines():
    """Room separation does not require a closed loop — just non-zero lines."""

    sess = SketchSession(
        sessionId="sk-rs",
        modelId="m-1",
        elementKind="room_separation",
        levelId="lvl-1",
        lines=[
            _line(0, 0, 5000, 0),
            _line(0, 0, 0, 4000),
        ],
        status="open",
    )
    state = validate_sketch_session(sess)
    assert state.valid, state.issues


def test_empty_room_separation_session_is_invalid():
    sess = SketchSession(
        sessionId="sk-rs-empty",
        modelId="m-1",
        elementKind="room_separation",
        levelId="lvl-1",
        lines=[],
        status="open",
    )
    state = validate_sketch_session(sess)
    assert state.valid is False
    assert any(i.code == "empty_sketch" for i in state.issues)


def test_room_separation_zero_length_line_rejected():
    sess = SketchSession(
        sessionId="sk-rs-zero",
        modelId="m-1",
        elementKind="room_separation",
        levelId="lvl-1",
        lines=[_line(100, 100, 100, 100)],
        status="open",
    )
    state = validate_sketch_session(sess)
    assert state.valid is False
    assert any(i.code == "zero_length" for i in state.issues)


def test_room_separation_sketch_finish_emits_one_command_per_line():
    """Two sketch lines → two CreateRoomSeparation commands → two elements."""

    cmds = [
        {
            "type": "createRoomSeparation",
            "name": "Sep",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 5000, "yMm": 0},
        },
        {
            "type": "createRoomSeparation",
            "name": "Sep",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 0, "yMm": 4000},
        },
    ]
    doc = _bare_doc()
    for cmd in cmds:
        ok, doc_after, _co, _v, code = try_commit(doc, cmd)
        assert ok, code
        assert doc_after is not None
        doc = doc_after

    seps = [el for el in doc.elements.values() if isinstance(el, RoomSeparationElem)]
    assert len(seps) == 2
