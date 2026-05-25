"""Issue #113 — StructuralFacadeGridElem (Huf-Haus Pfosten-Riegel) tests.

Pin the contract for the new ``structural_facade_grid`` element kind plus
the ``createStructuralFacadeGrid`` engine command. Scope (v0):

* ``StructuralFacadeGridElem`` validates on representative payloads
  ("none" / "single" / "cross" strut patterns) and rejects degenerate inputs.
* ``createStructuralFacadeGrid`` dispatch (via ``try_commit``) authors the
  element with the host wall's level inherited by default and rejects
  unknown / wrong-kind host walls.
* The element is discoverable through the ``Element`` discriminated union
  and the ``ElementKind`` literal so the rest of the engine treats it as
  a first-class kind, not a placeholder string.
"""

from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from bim_ai.document import Document
from bim_ai.elements import (
    DiagonalStrutPattern,
    Element,
    ElementKind,
    LevelElem,
    StructuralFacadeGridElem,
    WallElem,
)
from bim_ai.engine import try_commit


def _seed_doc() -> Document:
    """Minimal doc with one Level + one Wall to host a Huf-Haus grid."""

    level = LevelElem(kind="level", id="lvl-1", name="Level 1", elevation_mm=0)
    wall = WallElem.model_validate(
        {
            "kind": "wall",
            "id": "wall-south",
            "name": "South wall",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 6000, "yMm": 0},
            "thicknessMm": 300,
            "heightMm": 3000,
        }
    )
    return Document(revision=1, elements={level.id: level, wall.id: wall})


# ---------------------------------------------------------------------------
# Pydantic model contract
# ---------------------------------------------------------------------------


def test_structural_facade_grid_elem_validates_single_strut_payload() -> None:
    grid = StructuralFacadeGridElem.model_validate(
        {
            "kind": "structural_facade_grid",
            "id": "grid-1",
            "hostWallId": "wall-south",
            "postSpacingMm": 1500,
            "beamHeights": [1500],
            "diagonalStrutPattern": "single",
        }
    )

    assert grid.kind == "structural_facade_grid"
    assert grid.host_wall_id == "wall-south"
    assert grid.post_spacing_mm == 1500
    assert grid.beam_heights == [1500.0]
    assert grid.diagonal_strut_pattern == "single"


def test_structural_facade_grid_elem_accepts_cross_pattern() -> None:
    grid = StructuralFacadeGridElem(
        kind="structural_facade_grid",
        id="grid-cross",
        host_wall_id="wall-south",
        post_spacing_mm=1500,
        beam_heights=[1000, 2000],
        diagonal_strut_pattern="cross",
    )
    assert grid.diagonal_strut_pattern == "cross"


def test_structural_facade_grid_elem_accepts_none_pattern() -> None:
    grid = StructuralFacadeGridElem(
        kind="structural_facade_grid",
        id="grid-none",
        host_wall_id="wall-south",
        post_spacing_mm=1500,
        beam_heights=[],
        diagonal_strut_pattern="none",
    )
    assert grid.diagonal_strut_pattern == "none"


def test_structural_facade_grid_elem_rejects_zero_post_spacing() -> None:
    with pytest.raises(ValidationError):
        StructuralFacadeGridElem(
            kind="structural_facade_grid",
            id="grid-bad",
            host_wall_id="wall-south",
            post_spacing_mm=0,
            beam_heights=[],
            diagonal_strut_pattern="single",
        )


def test_structural_facade_grid_elem_rejects_negative_member_thickness() -> None:
    with pytest.raises(ValueError, match="memberThicknessMm"):
        StructuralFacadeGridElem(
            kind="structural_facade_grid",
            id="grid-bad-thick",
            host_wall_id="wall-south",
            post_spacing_mm=1500,
            beam_heights=[],
            diagonal_strut_pattern="single",
            member_thickness_mm=-10,
        )


def test_structural_facade_grid_elem_drops_negative_beam_heights() -> None:
    grid = StructuralFacadeGridElem(
        kind="structural_facade_grid",
        id="grid-clean",
        host_wall_id="wall-south",
        post_spacing_mm=1500,
        beam_heights=[1000, -200, 2000, 1000],  # dup + negative
        diagonal_strut_pattern="single",
    )
    # Validator sorts + de-duplicates the list; negative values are dropped.
    assert grid.beam_heights == [1000.0, 2000.0]


# ---------------------------------------------------------------------------
# ElementKind / Element discriminator wiring
# ---------------------------------------------------------------------------


def test_structural_facade_grid_is_registered_as_first_class_element_kind() -> None:
    """Kind literal must include ``structural_facade_grid`` so envelope and
    integrity checks recognise the element."""

    assert "structural_facade_grid" in ElementKind.__args__  # type: ignore[attr-defined]


def test_structural_facade_grid_resolves_via_element_discriminated_union() -> None:
    """``Element`` must accept the new payload via the ``kind`` discriminator."""

    adapter = TypeAdapter(Element)
    parsed = adapter.validate_python(
        {
            "kind": "structural_facade_grid",
            "id": "grid-union",
            "hostWallId": "wall-south",
            "postSpacingMm": 1500,
            "beamHeights": [1500],
            "diagonalStrutPattern": "single",
        }
    )
    assert isinstance(parsed, StructuralFacadeGridElem)


def test_diagonal_strut_pattern_literal_lists_three_options() -> None:
    args = DiagonalStrutPattern.__args__  # type: ignore[attr-defined]
    assert set(args) == {"none", "cross", "single"}


# ---------------------------------------------------------------------------
# createStructuralFacadeGrid command dispatch (via try_commit)
# ---------------------------------------------------------------------------


def _commit(doc: Document, payload: dict[str, object]) -> tuple[bool, Document, str]:
    ok, new_doc, _violations, _undo, code = try_commit(doc, payload)
    return ok, new_doc, code


def test_create_structural_facade_grid_produces_element_with_inherited_level() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createStructuralFacadeGrid",
            "id": "grid-huf-south",
            "name": "South Huf-Haus Grid",
            "hostWallId": "wall-south",
            "postSpacingMm": 1500,
            "beamHeights": [1500],
            "diagonalStrutPattern": "single",
        },
    )

    assert ok, f"createStructuralFacadeGrid should succeed but got code={code!r}"
    grid = new_doc.elements["grid-huf-south"]
    assert isinstance(grid, StructuralFacadeGridElem)
    assert grid.host_wall_id == "wall-south"
    assert grid.diagonal_strut_pattern == "single"
    assert grid.level_id == "lvl-1"
    assert grid.discipline == "arch"


def test_create_structural_facade_grid_supports_cross_pattern() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createStructuralFacadeGrid",
            "id": "grid-cross",
            "hostWallId": "wall-south",
            "postSpacingMm": 1200,
            "beamHeights": [1000, 2000],
            "diagonalStrutPattern": "cross",
        },
    )

    assert ok, f"cross createStructuralFacadeGrid should succeed but got code={code!r}"
    grid = new_doc.elements["grid-cross"]
    assert isinstance(grid, StructuralFacadeGridElem)
    assert grid.diagonal_strut_pattern == "cross"


def test_create_structural_facade_grid_rejects_missing_host_wall() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="hostWallId"):
        _commit(
            doc,
            {
                "type": "createStructuralFacadeGrid",
                "id": "grid-orphan",
                "hostWallId": "wall-does-not-exist",
                "postSpacingMm": 1500,
                "beamHeights": [],
                "diagonalStrutPattern": "single",
            },
        )
