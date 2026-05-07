"""EDT-04: engine commands wired up by the 9 plan-canvas tools.

Covers the four Modify commands authored as part of EDT-04
(``splitWallAt``, ``alignElementToReference``, ``trimElementToReference``,
``setWallJoinVariant``) and the three placement commands the canvas
flows now invoke (``createColumn``, ``createBeam``, ``createCeiling``).
"""

from __future__ import annotations

import math

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    JoinGeometryElem,
    LevelElem,
    WallElem,
    WallOpeningElem,
    WindowElem,
)
from bim_ai.engine import try_commit


def _seed_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="EG", elevationMm=0),
            "w-1": WallElem(
                kind="wall",
                id="w-1",
                name="W1",
                levelId="lvl-0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 10000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )


# ----------------------------- splitWallAt ---------------------------------


def test_split_wall_at_replaces_host_with_two_segments_and_migrates_door():
    doc = _seed_doc()
    # Add a door at 30 % along — should land on the *left* half after splitting at 0.5.
    doc.elements["d-1"] = DoorElem(
        kind="door",
        id="d-1",
        name="D",
        wallId="w-1",
        alongT=0.3,
        widthMm=900,
    )
    ok, doc_a, *_ = try_commit(doc, {"type": "splitWallAt", "wallId": "w-1", "alongT": 0.5})
    assert ok and doc_a is not None
    assert "w-1" not in doc_a.elements
    walls = [e for e in doc_a.elements.values() if isinstance(e, WallElem)]
    assert len(walls) == 2
    door = doc_a.elements["d-1"]
    assert isinstance(door, DoorElem)
    # Door alongT was 0.3 of the original; mid is at 0.5; door now at 0.6 of the left half.
    assert door.wall_id != "w-1"
    assert any(w.id == door.wall_id for w in walls)
    assert math.isclose(door.along_t, 0.6, abs_tol=1e-9)


def test_split_wall_at_migrates_wall_opening_to_correct_half():
    doc = _seed_doc()
    doc.elements["wo-1"] = WallOpeningElem(
        kind="wall_opening",
        id="wo-1",
        hostWallId="w-1",
        alongTStart=0.7,
        alongTEnd=0.9,
        sillHeightMm=200,
        headHeightMm=2400,
    )
    ok, doc_a, *_ = try_commit(doc, {"type": "splitWallAt", "wallId": "w-1", "alongT": 0.5})
    assert ok and doc_a is not None
    wo = doc_a.elements["wo-1"]
    assert isinstance(wo, WallOpeningElem)
    # The opening's midpoint at 0.8 falls past the split → goes onto the right half.
    assert wo.host_wall_id != "w-1"
    assert math.isclose(wo.along_t_start, 0.4, abs_tol=1e-9)
    assert math.isclose(wo.along_t_end, 0.8, abs_tol=1e-9)


def test_split_wall_at_rejects_unknown_wall():
    doc = _seed_doc()
    with pytest.raises(ValueError, match="splitWallAt.wallId"):
        try_commit(doc, {"type": "splitWallAt", "wallId": "nope", "alongT": 0.5})


def test_split_wall_at_rejects_endpoint_t():
    doc = _seed_doc()
    with pytest.raises(ValueError):
        try_commit(doc, {"type": "splitWallAt", "wallId": "w-1", "alongT": 0.0})


# ----------------------- alignElementToReference ---------------------------


def test_align_element_translates_target_along_dominant_axis():
    doc = _seed_doc()
    # Horizontal wall on y=0; align to a reference whose y component matters.
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "alignElementToReference",
            "targetWallId": "w-1",
            "referenceMm": {"xMm": 0, "yMm": 500},
        },
    )
    assert ok and doc_a is not None
    w = doc_a.elements["w-1"]
    assert isinstance(w, WallElem)
    # Horizontal wall (dx=10000, dy=0) snaps along Y; both endpoints shift +500 in Y.
    assert math.isclose(w.start.y_mm, 500.0)
    assert math.isclose(w.end.y_mm, 500.0)


def test_align_element_rejects_non_wall_target():
    doc = _seed_doc()
    with pytest.raises(ValueError, match="alignElementToReference"):
        try_commit(
            doc,
            {
                "type": "alignElementToReference",
                "targetWallId": "lvl-0",
                "referenceMm": {"xMm": 0, "yMm": 0},
            },
        )


# ------------------------- trimElementToReference --------------------------


def test_trim_element_extends_target_endpoint_to_reference_line():
    doc = _seed_doc()
    # Add a perpendicular wall whose `end` is short of w-1.
    doc.elements["w-2"] = WallElem(
        kind="wall",
        id="w-2",
        name="W2",
        levelId="lvl-0",
        start={"xMm": 5000, "yMm": -3000},
        end={"xMm": 5000, "yMm": -500},  # ends 500 short of w-1 at y=0
        thicknessMm=200,
        heightMm=2800,
    )
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "trimElementToReference",
            "referenceWallId": "w-1",
            "targetWallId": "w-2",
            "endHint": "end",
        },
    )
    assert ok and doc_a is not None
    w2 = doc_a.elements["w-2"]
    assert isinstance(w2, WallElem)
    # w-2's `end` should now lie on w-1's infinite line (y=0).
    assert math.isclose(w2.end.x_mm, 5000.0)
    assert math.isclose(w2.end.y_mm, 0.0)
    # Start endpoint untouched.
    assert math.isclose(w2.start.x_mm, 5000.0)
    assert math.isclose(w2.start.y_mm, -3000.0)


def test_trim_element_rejects_parallel_walls():
    doc = _seed_doc()
    doc.elements["w-2"] = WallElem(
        kind="wall",
        id="w-2",
        name="W2",
        levelId="lvl-0",
        start={"xMm": 0, "yMm": 1000},
        end={"xMm": 5000, "yMm": 1000},
        thicknessMm=200,
        heightMm=2800,
    )
    with pytest.raises(ValueError, match="parallel"):
        try_commit(
            doc,
            {
                "type": "trimElementToReference",
                "referenceWallId": "w-1",
                "targetWallId": "w-2",
                "endHint": "end",
            },
        )


# --------------------------- setWallJoinVariant ----------------------------


def test_set_wall_join_variant_creates_join_geometry_with_variant_note():
    doc = _seed_doc()
    doc.elements["w-2"] = WallElem(
        kind="wall",
        id="w-2",
        name="W2",
        levelId="lvl-0",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 0, "yMm": 4000},
        thicknessMm=200,
        heightMm=2800,
    )
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "setWallJoinVariant",
            "wallIds": ["w-1", "w-2"],
            "variant": "miter",
        },
    )
    assert ok and doc_a is not None
    joins = [e for e in doc_a.elements.values() if isinstance(e, JoinGeometryElem)]
    assert len(joins) == 1
    assert sorted(joins[0].joined_element_ids) == ["w-1", "w-2"]
    assert "variant=miter" in joins[0].notes


def test_set_wall_join_variant_rejects_non_wall_id():
    doc = _seed_doc()
    with pytest.raises(ValueError, match="setWallJoinVariant"):
        try_commit(
            doc,
            {
                "type": "setWallJoinVariant",
                "wallIds": ["lvl-0"],
                "variant": "miter",
            },
        )


# ------------------------------- createColumn ------------------------------


def test_create_column_succeeds():
    doc = _seed_doc()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createColumn",
            "id": "c-1",
            "levelId": "lvl-0",
            "positionMm": {"xMm": 1500, "yMm": 2500},
        },
    )
    assert ok and doc_a is not None
    c = doc_a.elements["c-1"]
    assert isinstance(c, ColumnElem)
    assert c.position_mm.x_mm == 1500 and c.position_mm.y_mm == 2500
    assert c.b_mm == 300 and c.h_mm == 300


def test_create_column_rejects_unknown_level():
    doc = _seed_doc()
    with pytest.raises(ValueError, match="createColumn.levelId"):
        try_commit(
            doc,
            {
                "type": "createColumn",
                "levelId": "nope",
                "positionMm": {"xMm": 0, "yMm": 0},
            },
        )


# ------------------------------- createBeam --------------------------------


def test_create_beam_succeeds():
    doc = _seed_doc()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createBeam",
            "id": "b-1",
            "levelId": "lvl-0",
            "startMm": {"xMm": 0, "yMm": 0},
            "endMm": {"xMm": 5000, "yMm": 0},
        },
    )
    assert ok and doc_a is not None
    b = doc_a.elements["b-1"]
    assert isinstance(b, BeamElem)
    assert b.start_mm.x_mm == 0 and b.end_mm.x_mm == 5000


def test_create_beam_rejects_zero_length():
    doc = _seed_doc()
    with pytest.raises(ValueError, match="createBeam"):
        try_commit(
            doc,
            {
                "type": "createBeam",
                "levelId": "lvl-0",
                "startMm": {"xMm": 0, "yMm": 0},
                "endMm": {"xMm": 0, "yMm": 0},
            },
        )


# ------------------------------ createCeiling ------------------------------


def test_create_ceiling_succeeds():
    doc = _seed_doc()
    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createCeiling",
            "id": "ce-1",
            "levelId": "lvl-0",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
        },
    )
    assert ok and doc_a is not None
    ce = doc_a.elements["ce-1"]
    assert isinstance(ce, CeilingElem)
    assert len(ce.boundary_mm) == 4
    assert ce.thickness_mm == 20


def test_create_ceiling_rejects_short_boundary():
    doc = _seed_doc()
    with pytest.raises(ValueError, match="boundaryMm"):
        try_commit(
            doc,
            {
                "type": "createCeiling",
                "levelId": "lvl-0",
                "boundaryMm": [{"xMm": 0, "yMm": 0}, {"xMm": 1, "yMm": 0}],
            },
        )


# Ensure WindowElem reference still works (catch-all import smoke check).
def test_window_element_import_smoke() -> None:
    assert WindowElem.__name__ == "WindowElem"
