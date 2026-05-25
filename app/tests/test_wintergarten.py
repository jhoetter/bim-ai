"""Issue #114 — WintergartenElem (glazed conservatory) tests.

These pin the contract for the new ``wintergarten`` element kind plus the
``createWintergarten`` engine command. Scope (v0):

* ``WintergartenElem`` validates on a representative payload (barrel /
  mono_pitch / flat roof modes) and rejects degenerate inputs.
* ``createWintergarten`` dispatch (via ``try_commit``) authors the element
  with the host wall's level inherited by default, defaults ``materialKey``
  to ``glass_clear``, and rejects unknown / wrong-kind host walls.
* The element is discoverable through the ``Element`` discriminated union
  and the ``ElementKind`` literal.

Deferred (PR body): interior CSG fusion with the host wall, IFC export.
"""

from __future__ import annotations

import math

import pytest
from pydantic import TypeAdapter, ValidationError

from bim_ai.document import Document
from bim_ai.elements import (
    Element,
    ElementKind,
    LevelElem,
    WallElem,
    WintergartenElem,
    WintergartenRoofMode,
)
from bim_ai.engine import try_commit


def _seed_doc() -> Document:
    """Minimal doc with one Level + one Wall to host a Wintergarten."""

    level = LevelElem(kind="level", id="lvl-1", name="Level 1", elevation_mm=0)
    wall = WallElem.model_validate(
        {
            "kind": "wall",
            "id": "wall-south",
            "name": "South wall",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 8000, "yMm": 0},
            "thicknessMm": 300,
            "heightMm": 3000,
        }
    )
    return Document(revision=1, elements={level.id: level, wall.id: wall})


# ---------------------------------------------------------------------------
# Pydantic model contract
# ---------------------------------------------------------------------------


def test_wintergarten_elem_validates_barrel_payload() -> None:
    wg = WintergartenElem.model_validate(
        {
            "kind": "wintergarten",
            "id": "wg-1",
            "hostWallId": "wall-south",
            "footprintMm": [
                {"xMm": 1000, "yMm": 0},
                {"xMm": 7000, "yMm": 0},
                {"xMm": 7000, "yMm": -3500},
                {"xMm": 1000, "yMm": -3500},
            ],
            "wallHeightMm": 2400,
            "roofGeometryMode": "barrel",
            "barrelRiseMm": 1200,
            "barrelSegmentCount": 16,
            "materialKey": "glass_clear",
        }
    )

    assert wg.kind == "wintergarten"
    assert wg.host_wall_id == "wall-south"
    assert wg.roof_geometry_mode == "barrel"
    assert math.isclose(wg.barrel_rise_mm or 0.0, 1200)
    assert wg.barrel_segment_count == 16
    assert wg.material_key == "glass_clear"
    assert len(wg.footprint_mm) == 4


def test_wintergarten_elem_defaults_material_to_glass_clear() -> None:
    wg = WintergartenElem(
        kind="wintergarten",
        id="wg-default-mat",
        host_wall_id="wall-south",
        footprint_mm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 5000, "yMm": 0},
            {"xMm": 5000, "yMm": -3000},
            {"xMm": 0, "yMm": -3000},
        ],
        roof_geometry_mode="flat",
    )
    assert wg.material_key == "glass_clear"


def test_wintergarten_elem_rejects_barrel_without_rise() -> None:
    with pytest.raises(ValidationError):
        WintergartenElem(
            kind="wintergarten",
            id="wg-bad-barrel",
            host_wall_id="wall-south",
            footprint_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": -3000},
                {"xMm": 0, "yMm": -3000},
            ],
            roof_geometry_mode="barrel",
            # barrel_rise_mm omitted — must raise.
        )


def test_wintergarten_elem_rejects_degenerate_footprint() -> None:
    with pytest.raises(ValidationError):
        WintergartenElem(
            kind="wintergarten",
            id="wg-bad-footprint",
            host_wall_id="wall-south",
            footprint_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
            ],
            roof_geometry_mode="flat",
        )


def test_wintergarten_elem_rejects_non_positive_wall_height() -> None:
    with pytest.raises(ValidationError):
        WintergartenElem(
            kind="wintergarten",
            id="wg-bad-height",
            host_wall_id="wall-south",
            footprint_mm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": -3000},
                {"xMm": 0, "yMm": -3000},
            ],
            wall_height_mm=0,
            roof_geometry_mode="flat",
        )


# ---------------------------------------------------------------------------
# ElementKind / Element discriminator wiring
# ---------------------------------------------------------------------------


def test_wintergarten_is_registered_as_first_class_element_kind() -> None:
    """The kind literal must include ``wintergarten`` so envelope/integrity
    checks (and every other element-kind dispatch) recognise the element.
    """

    assert "wintergarten" in ElementKind.__args__  # type: ignore[attr-defined]


def test_wintergarten_kind_resolves_via_element_discriminated_union() -> None:
    """``Element`` must accept the new payload via the ``kind`` discriminator."""

    adapter = TypeAdapter(Element)
    parsed = adapter.validate_python(
        {
            "kind": "wintergarten",
            "id": "wg-union",
            "hostWallId": "wall-south",
            "footprintMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": -3000},
                {"xMm": 0, "yMm": -3000},
            ],
            "roofGeometryMode": "flat",
        }
    )
    assert isinstance(parsed, WintergartenElem)


def test_wintergarten_roof_mode_literal_lists_three_options() -> None:
    args = WintergartenRoofMode.__args__  # type: ignore[attr-defined]
    assert set(args) == {"barrel", "mono_pitch", "flat"}


# ---------------------------------------------------------------------------
# createWintergarten command dispatch (via try_commit)
# ---------------------------------------------------------------------------


def _commit(doc: Document, payload: dict[str, object]) -> tuple[bool, Document, str]:
    ok, new_doc, _violations, _undo, code = try_commit(doc, payload)
    return ok, new_doc, code


def test_create_wintergarten_command_produces_element_with_inherited_level() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createWintergarten",
            "id": "wg-south",
            "name": "Süd-Wintergarten",
            "hostWallId": "wall-south",
            "footprintMm": [
                {"xMm": 1000, "yMm": 0},
                {"xMm": 7000, "yMm": 0},
                {"xMm": 7000, "yMm": -3500},
                {"xMm": 1000, "yMm": -3500},
            ],
            "wallHeightMm": 2400,
            "roofGeometryMode": "barrel",
            "barrelRiseMm": 1200,
        },
    )

    assert ok, f"createWintergarten should succeed but got code={code!r}"
    wg = new_doc.elements["wg-south"]
    assert isinstance(wg, WintergartenElem)
    assert wg.host_wall_id == "wall-south"
    assert wg.roof_geometry_mode == "barrel"
    assert wg.level_id == "lvl-1"
    assert wg.discipline == "arch"
    # Default material key applied by the dispatcher.
    assert wg.material_key == "glass_clear"


def test_create_wintergarten_command_rejects_unknown_host_wall() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="hostWallId"):
        _commit(
            doc,
            {
                "type": "createWintergarten",
                "id": "wg-bad-host",
                "hostWallId": "wall-ghost",
                "footprintMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": -3000},
                    {"xMm": 0, "yMm": -3000},
                ],
                "roofGeometryMode": "flat",
            },
        )


def test_create_wintergarten_command_rejects_barrel_without_rise() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="barrelRiseMm"):
        _commit(
            doc,
            {
                "type": "createWintergarten",
                "id": "wg-bad-barrel",
                "hostWallId": "wall-south",
                "footprintMm": [
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 7000, "yMm": 0},
                    {"xMm": 7000, "yMm": -3500},
                    {"xMm": 1000, "yMm": -3500},
                ],
                "roofGeometryMode": "barrel",
                # barrelRiseMm omitted — must fail.
            },
        )


def test_create_wintergarten_command_supports_mono_pitch_roof() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createWintergarten",
            "id": "wg-mono",
            "hostWallId": "wall-south",
            "footprintMm": [
                {"xMm": 1000, "yMm": 0},
                {"xMm": 7000, "yMm": 0},
                {"xMm": 7000, "yMm": -3500},
                {"xMm": 1000, "yMm": -3500},
            ],
            "roofGeometryMode": "mono_pitch",
            "roofSlopeDeg": 8.0,
        },
    )
    assert ok, f"mono_pitch createWintergarten should succeed but got code={code!r}"
    wg = new_doc.elements["wg-mono"]
    assert isinstance(wg, WintergartenElem)
    assert wg.roof_geometry_mode == "mono_pitch"
    assert wg.roof_slope_deg == pytest.approx(8.0)


def test_create_wintergarten_command_rejects_unknown_material_key() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="materialKey"):
        _commit(
            doc,
            {
                "type": "createWintergarten",
                "id": "wg-bad-mat",
                "hostWallId": "wall-south",
                "footprintMm": [
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 7000, "yMm": 0},
                    {"xMm": 7000, "yMm": -3500},
                    {"xMm": 1000, "yMm": -3500},
                ],
                "roofGeometryMode": "flat",
                "materialKey": "no_such_material_key",
            },
        )


def test_create_wintergarten_rejects_duplicate_id() -> None:
    doc = _seed_doc()
    ok1, doc1, _ = _commit(
        doc,
        {
            "type": "createWintergarten",
            "id": "wg-dup",
            "hostWallId": "wall-south",
            "footprintMm": [
                {"xMm": 1000, "yMm": 0},
                {"xMm": 7000, "yMm": 0},
                {"xMm": 7000, "yMm": -3500},
                {"xMm": 1000, "yMm": -3500},
            ],
            "roofGeometryMode": "flat",
        },
    )
    assert ok1
    with pytest.raises(ValueError, match="duplicate"):
        _commit(
            doc1,
            {
                "type": "createWintergarten",
                "id": "wg-dup",
                "hostWallId": "wall-south",
                "footprintMm": [
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 7000, "yMm": 0},
                    {"xMm": 7000, "yMm": -3500},
                    {"xMm": 1000, "yMm": -3500},
                ],
                "roofGeometryMode": "flat",
            },
        )
