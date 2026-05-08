"""EDT-02 — engine wiring for the `createConstraint` command + post-apply
violation rejection.
"""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import ConstraintElem, LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit, try_commit_bundle


def _wall(id_: str, sx: float, sy: float, ex: float, ey: float) -> WallElem:
    return WallElem(
        kind="wall",
        id=id_,
        name=id_,
        level_id="lvl_g",
        start=Vec2Mm(xMm=sx, yMm=sy),
        end=Vec2Mm(xMm=ex, yMm=ey),
        thickness_mm=200,
        height_mm=3000,
    )


def _two_wall_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl_g": LevelElem(kind="level", id="lvl_g", name="Ground", elevation_mm=0),
            # Two parallel vertical walls 5000 mm apart on the x axis. Each
            # wall is 4000 mm long along y so the centre points are at
            # (0, 2000) and (5000, 2000) — distance 5000 mm.
            "w1": _wall("w1", 0, 0, 0, 4000),
            "w2": _wall("w2", 5000, 0, 5000, 4000),
        },
    )


def test_create_constraint_inserts_element() -> None:
    ok, doc, _cmd, _v, code = try_commit(
        _two_wall_doc(),
        {
            "type": "createConstraint",
            "id": "c1",
            "rule": "equal_distance",
            "refsA": [{"elementId": "w1", "anchor": "center"}],
            "refsB": [{"elementId": "w2", "anchor": "center"}],
            "lockedValueMm": 5000.0,
            "severity": "error",
        },
    )
    assert ok, code
    assert doc is not None
    el = doc.elements["c1"]
    assert isinstance(el, ConstraintElem)
    assert el.rule == "equal_distance"
    assert el.locked_value_mm == 5000.0
    assert el.severity == "error"
    assert el.refs_a[0].element_id == "w1"
    assert el.refs_b[0].element_id == "w2"


def test_violation_after_apply_rejects_bundle() -> None:
    """Two walls + locked constraint at 5000mm. Bundle moves one wall;
    engine must reject the bundle, leave the world unchanged."""

    doc = _two_wall_doc()
    doc.elements["c-lock"] = ConstraintElem(
        kind="constraint",
        id="c-lock",
        rule="equal_distance",
        refsA=[{"elementId": "w1", "anchor": "center"}],
        refsB=[{"elementId": "w2", "anchor": "center"}],
        lockedValueMm=5000.0,
        severity="error",
    )

    # Bundle: shift w2 by 200 mm — breaks the lock.
    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        doc,
        [
            {
                "type": "moveWallDelta",
                "wallId": "w2",
                "dxMm": 200,
                "dyMm": 0,
            }
        ],
    )
    assert ok is False
    assert new_doc is None
    assert code == "constraint_error"
    edt_rows = [v for v in violations if v.rule_id == "edt_constraint_violated"]
    assert edt_rows, "expected an EDT-02 violation row"
    msg = edt_rows[0].message
    assert "c-lock" in msg
    assert "equal_distance" in msg
    assert "residual" in msg

    # World is unchanged — w2 still at original (5000, 0).
    w2 = doc.elements["w2"]
    assert isinstance(w2, WallElem)
    assert w2.start.x_mm == 5000
    assert w2.end.x_mm == 5000


def test_warning_constraint_does_not_reject() -> None:
    doc = _two_wall_doc()
    doc.elements["c-lock"] = ConstraintElem(
        kind="constraint",
        id="c-lock",
        rule="equal_distance",
        refsA=[{"elementId": "w1", "anchor": "center"}],
        refsB=[{"elementId": "w2", "anchor": "center"}],
        lockedValueMm=5000.0,
        severity="warning",
    )

    ok, new_doc, _cmds, _violations, code = try_commit_bundle(
        doc,
        [{"type": "moveWallDelta", "wallId": "w2", "dxMm": 200, "dyMm": 0}],
    )
    assert ok is True, code
    assert new_doc is not None
    w2 = new_doc.elements["w2"]
    assert isinstance(w2, WallElem)
    assert w2.start.x_mm == 5200
