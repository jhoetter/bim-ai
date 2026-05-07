"""SKT-01 sketch session lifecycle: open → add lines → finish commits CreateFloor."""

from __future__ import annotations

from bim_ai.elements import FloorElem, Vec2Mm
from bim_ai.sketch_session import (
    SketchLine,
    SketchSessionRegistry,
    get_sketch_registry,
)
from bim_ai.sketch_validation import (
    derive_closed_loop_polygon,
    validate_sketch_session,
)


def test_registry_open_creates_session_with_unique_ids():
    reg = SketchSessionRegistry()
    s1 = reg.open(model_id="m1", element_kind="floor", level_id="lvl-1")
    s2 = reg.open(model_id="m1", element_kind="floor", level_id="lvl-1")
    assert s1.session_id != s2.session_id
    assert s1.status == "open"


def test_registry_get_returns_none_for_unknown_id():
    reg = SketchSessionRegistry()
    assert reg.get("does-not-exist") is None


def test_registry_replace_appends_lines_and_validation_clears():
    reg = SketchSessionRegistry()
    sk = reg.open(model_id="m1", element_kind="floor", level_id="lvl-1")
    # Closed L-shape
    pts = [
        (0, 0, 2000, 0),
        (2000, 0, 2000, 1000),
        (2000, 1000, 1000, 1000),
        (1000, 1000, 1000, 2000),
        (1000, 2000, 0, 2000),
        (0, 2000, 0, 0),
    ]
    for x0, y0, x1, y1 in pts:
        sk = sk.model_copy(
            update={
                "lines": [
                    *sk.lines,
                    SketchLine(
                        from_mm=Vec2Mm(xMm=x0, yMm=y0),
                        to_mm=Vec2Mm(xMm=x1, yMm=y1),
                    ),
                ]
            }
        )
        reg.replace(sk)
    state = validate_sketch_session(sk)
    assert state.valid is True
    poly = derive_closed_loop_polygon(list(sk.lines))
    assert len(poly) == 6


def test_module_singleton_returns_same_registry():
    a = get_sketch_registry()
    b = get_sketch_registry()
    assert a is b


def test_finish_translates_loop_into_create_floor_via_engine():
    """The Finish action emits a single CreateFloor; verify the engine accepts it."""
    from bim_ai.document import Document
    from bim_ai.elements import LevelElem
    from bim_ai.engine import try_commit

    lvl = LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)
    doc = Document(revision=1, elements={"lvl-1": lvl})

    polygon = [
        (0.0, 0.0),
        (2000.0, 0.0),
        (2000.0, 1000.0),
        (1000.0, 1000.0),
        (1000.0, 2000.0),
        (0.0, 2000.0),
    ]
    cmd = {
        "type": "createFloor",
        "name": "L Floor",
        "levelId": "lvl-1",
        "boundaryMm": [{"xMm": x, "yMm": y} for (x, y) in polygon],
    }
    ok, new_doc, _cmd, _viols, code = try_commit(doc, cmd)
    assert ok is True, code
    assert new_doc is not None
    floors = [el for el in new_doc.elements.values() if isinstance(el, FloorElem)]
    assert len(floors) == 1
    assert len(floors[0].boundary_mm) == 6
