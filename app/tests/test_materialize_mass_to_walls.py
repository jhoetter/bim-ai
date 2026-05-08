"""Tests for SKB-02 materializeMassToWalls engine command."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    AgentDeviationElem,
    FloorElem,
    LevelElem,
    MassElem,
    RoofElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.engine import try_commit


def _doc_with_mass(
    *,
    footprint: list[tuple[float, float]],
    height_mm: float = 6000,
    material_key: str | None = None,
) -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
            "m1": MassElem(
                kind="mass",
                id="m1",
                name="Main mass",
                levelId="lvl-1",
                footprintMm=[Vec2Mm(xMm=x, yMm=y) for (x, y) in footprint],
                heightMm=height_mm,
                materialKey=material_key,
            ),
        },
    )


def test_axis_aligned_rectangle_emits_4_walls_1_floor_1_roof() -> None:
    doc = _doc_with_mass(
        footprint=[(0, 0), (5000, 0), (5000, 8000), (0, 8000)],
        height_mm=6000,
    )
    ok, new_doc, _cmds, _viols, code = try_commit(
        doc, {"type": "materializeMassToWalls", "massId": "m1"}
    )
    assert ok, code
    assert new_doc is not None

    walls = [el for el in new_doc.elements.values() if isinstance(el, WallElem)]
    floors = [el for el in new_doc.elements.values() if isinstance(el, FloorElem)]
    roofs = [el for el in new_doc.elements.values() if isinstance(el, RoofElem)]
    assert len(walls) == 4
    assert len(floors) == 1
    assert len(roofs) == 1

    wall_ids = sorted(w.id for w in walls)
    assert wall_ids == ["m1-w0", "m1-w1", "m1-w2", "m1-w3"]
    assert floors[0].id == "m1-f"
    assert roofs[0].id == "m1-r"

    # Wall heights match the mass height; walls are level-anchored.
    for w in walls:
        assert w.height_mm == 6000
        assert w.level_id == "lvl-1"

    # Floor footprint matches mass footprint (1:1 correspondence).
    assert len(floors[0].boundary_mm) == 4
    assert floors[0].level_id == "lvl-1"

    # Roof references the mass level and is flat at level base + heightMm.
    assert roofs[0].reference_level_id == "lvl-1"
    assert roofs[0].roof_geometry_mode == "flat"
    assert roofs[0].slope_deg == 0.0
    assert roofs[0].eave_height_left_mm == 6000
    assert roofs[0].eave_height_right_mm == 6000


def test_l_shape_footprint_emits_n_walls_for_n_segments() -> None:
    l_shape = [
        (0, 0),
        (6000, 0),
        (6000, 3000),
        (3000, 3000),
        (3000, 6000),
        (0, 6000),
    ]
    doc = _doc_with_mass(footprint=l_shape, height_mm=3000)
    ok, new_doc, _cmds, _viols, code = try_commit(
        doc, {"type": "materializeMassToWalls", "massId": "m1"}
    )
    assert ok, code
    assert new_doc is not None
    walls = [el for el in new_doc.elements.values() if isinstance(el, WallElem)]
    assert len(walls) == 6
    # Walls form a closed loop — last wall ends at first wall's start.
    walls_by_id = {w.id: w for w in walls}
    chain = [walls_by_id[f"m1-w{i}"] for i in range(6)]
    for i, w in enumerate(chain):
        nxt = chain[(i + 1) % 6]
        assert w.end == nxt.start


def test_emitted_elements_carry_skeleton_phase_id() -> None:
    doc = _doc_with_mass(
        footprint=[(0, 0), (4000, 0), (4000, 4000), (0, 4000)],
        height_mm=3000,
    )
    ok, new_doc, _cmds, _viols, code = try_commit(
        doc, {"type": "materializeMassToWalls", "massId": "m1"}
    )
    assert ok, code
    assert new_doc is not None
    walls = [el for el in new_doc.elements.values() if isinstance(el, WallElem)]
    floors = [el for el in new_doc.elements.values() if isinstance(el, FloorElem)]
    roofs = [el for el in new_doc.elements.values() if isinstance(el, RoofElem)]
    assert all(w.phase_id == "skeleton" for w in walls)
    assert floors[0].phase_id == "skeleton"
    assert roofs[0].phase_id == "skeleton"


def test_material_key_is_carried_forward() -> None:
    doc = _doc_with_mass(
        footprint=[(0, 0), (4000, 0), (4000, 4000), (0, 4000)],
        height_mm=3000,
        material_key="render_white",
    )
    ok, new_doc, _cmds, _viols, code = try_commit(
        doc, {"type": "materializeMassToWalls", "massId": "m1"}
    )
    assert ok, code
    assert new_doc is not None
    walls = [el for el in new_doc.elements.values() if isinstance(el, WallElem)]
    roofs = [el for el in new_doc.elements.values() if isinstance(el, RoofElem)]
    assert all(w.material_key == "render_white" for w in walls)
    assert roofs[0].material_key == "render_white"


def test_mass_is_deleted_after_materialise() -> None:
    doc = _doc_with_mass(
        footprint=[(0, 0), (4000, 0), (4000, 4000), (0, 4000)],
    )
    ok, new_doc, _cmds, _viols, code = try_commit(
        doc, {"type": "materializeMassToWalls", "massId": "m1"}
    )
    assert ok, code
    assert new_doc is not None
    assert "m1" not in new_doc.elements
    masses = [el for el in new_doc.elements.values() if isinstance(el, MassElem)]
    assert masses == []


def test_emits_agent_deviation_referencing_source_mass() -> None:
    doc = _doc_with_mass(
        footprint=[(0, 0), (4000, 0), (4000, 4000), (0, 4000)],
    )
    ok, new_doc, _cmds, _viols, code = try_commit(
        doc, {"type": "materializeMassToWalls", "massId": "m1"}
    )
    assert ok, code
    assert new_doc is not None
    deviations = [el for el in new_doc.elements.values() if isinstance(el, AgentDeviationElem)]
    assert len(deviations) == 1
    dev = deviations[0]
    assert "m1" in dev.related_element_ids
    assert "m1-w0" in dev.related_element_ids
    assert "m1-f" in dev.related_element_ids
    assert "m1-r" in dev.related_element_ids


def test_unknown_mass_id_raises() -> None:
    doc = _doc_with_mass(
        footprint=[(0, 0), (4000, 0), (4000, 4000), (0, 4000)],
    )
    with pytest.raises(ValueError, match="must reference an existing mass"):
        try_commit(doc, {"type": "materializeMassToWalls", "massId": "ghost"})
