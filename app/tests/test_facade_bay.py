"""Issue #102 — FacadeBayElem (Erker) tests.

These pin the contract for the new ``facade_bay`` element kind plus the
``createFacadeBay`` engine command. Scope (v0):

* ``FacadeBayElem`` validates on a representative payload (rectangular,
  chamfered, curved) and rejects degenerate inputs.
* ``createFacadeBay`` dispatch (via ``try_commit``) authors the element with
  the host wall's level inherited by default and rejects unknown / wrong-kind
  host walls.
* The element is discoverable through the ``Element`` discriminated union
  and the ``ElementKind`` literal (so the rest of the engine treats it as
  a first-class kind, not a placeholder string).
"""

from __future__ import annotations

import math

import pytest
from pydantic import TypeAdapter, ValidationError

from bim_ai.document import Document
from bim_ai.elements import (
    Element,
    ElementKind,
    FacadeBayElem,
    FacadeBayShape,
    LevelElem,
    WallElem,
)
from bim_ai.engine import try_commit


def _seed_doc() -> Document:
    """Minimal doc with one Level + one Wall to host a facade bay."""

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


def test_facade_bay_elem_validates_rectangular_payload() -> None:
    bay = FacadeBayElem.model_validate(
        {
            "kind": "facade_bay",
            "id": "bay-1",
            "hostWallId": "wall-south",
            "startAlongWallMm": 1500,
            "endAlongWallMm": 4500,
            "projectionMm": 1000,
            "shape": "rectangular",
        }
    )

    assert bay.kind == "facade_bay"
    assert bay.host_wall_id == "wall-south"
    assert math.isclose(bay.start_along_wall_mm, 1500)
    assert math.isclose(bay.end_along_wall_mm, 4500)
    assert math.isclose(bay.projection_mm, 1000)
    assert bay.shape == "rectangular"
    assert bay.chamfer_angle_deg is None


def test_facade_bay_elem_chamfered_defaults_angle_to_45_when_omitted() -> None:
    bay = FacadeBayElem.model_validate(
        {
            "kind": "facade_bay",
            "id": "bay-cham",
            "hostWallId": "wall-south",
            "startAlongWallMm": 1000,
            "endAlongWallMm": 3500,
            "projectionMm": 900,
            "shape": "chamfered",
        }
    )

    assert bay.shape == "chamfered"
    assert bay.chamfer_angle_deg is not None
    assert math.isclose(bay.chamfer_angle_deg, 45.0)


def test_facade_bay_elem_chamfered_accepts_explicit_angle() -> None:
    bay = FacadeBayElem(
        kind="facade_bay",
        id="bay-cham-30",
        host_wall_id="wall-south",
        start_along_wall_mm=0,
        end_along_wall_mm=2000,
        projection_mm=800,
        shape="chamfered",
        chamfer_angle_deg=30.0,
    )

    assert math.isclose(bay.chamfer_angle_deg or 0.0, 30.0)


def test_facade_bay_elem_clears_chamfer_angle_for_non_chamfered_shape() -> None:
    bay = FacadeBayElem(
        kind="facade_bay",
        id="bay-curved",
        host_wall_id="wall-south",
        start_along_wall_mm=0,
        end_along_wall_mm=2000,
        projection_mm=800,
        shape="curved",
        chamfer_angle_deg=45.0,  # nonsense for curved shape
    )

    # Validator zeroes the field so downstream renderers don't read it.
    assert bay.chamfer_angle_deg is None


def test_facade_bay_elem_rejects_degenerate_span() -> None:
    with pytest.raises(ValidationError):
        FacadeBayElem(
            kind="facade_bay",
            id="bay-bad",
            host_wall_id="wall-south",
            start_along_wall_mm=3000,
            end_along_wall_mm=3000,  # zero-length span
            projection_mm=900,
            shape="rectangular",
        )


def test_facade_bay_elem_rejects_zero_projection() -> None:
    with pytest.raises(ValidationError):
        FacadeBayElem(
            kind="facade_bay",
            id="bay-bad-proj",
            host_wall_id="wall-south",
            start_along_wall_mm=0,
            end_along_wall_mm=2000,
            projection_mm=0,  # gt=0 constraint
            shape="rectangular",
        )


def test_facade_bay_elem_rejects_out_of_range_chamfer_angle() -> None:
    with pytest.raises(ValidationError):
        FacadeBayElem(
            kind="facade_bay",
            id="bay-bad-angle",
            host_wall_id="wall-south",
            start_along_wall_mm=0,
            end_along_wall_mm=2000,
            projection_mm=900,
            shape="chamfered",
            chamfer_angle_deg=120.0,
        )


# ---------------------------------------------------------------------------
# ElementKind / Element discriminator wiring
# ---------------------------------------------------------------------------


def test_facade_bay_is_registered_as_first_class_element_kind() -> None:
    """The kind literal must include ``facade_bay`` so envelope/integrity
    checks (and every other element-kind dispatch) recognise the element.
    """

    assert "facade_bay" in ElementKind.__args__  # type: ignore[attr-defined]


def test_facade_bay_kind_resolves_via_element_discriminated_union() -> None:
    """``Element`` must accept the new payload via the ``kind`` discriminator."""

    adapter = TypeAdapter(Element)
    parsed = adapter.validate_python(
        {
            "kind": "facade_bay",
            "id": "bay-union",
            "hostWallId": "wall-south",
            "startAlongWallMm": 0,
            "endAlongWallMm": 2000,
            "projectionMm": 1000,
            "shape": "rectangular",
        }
    )
    assert isinstance(parsed, FacadeBayElem)


def test_facade_bay_shape_literal_lists_three_options() -> None:
    args = FacadeBayShape.__args__  # type: ignore[attr-defined]
    assert set(args) == {"rectangular", "chamfered", "curved"}


# ---------------------------------------------------------------------------
# createFacadeBay command dispatch (via try_commit)
# ---------------------------------------------------------------------------


def _commit(doc: Document, payload: dict[str, object]) -> tuple[bool, Document, str]:
    ok, new_doc, _violations, _undo, code = try_commit(doc, payload)
    return ok, new_doc, code


def test_create_facade_bay_command_produces_element_with_inherited_level() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createFacadeBay",
            "id": "bay-erker-south",
            "name": "South Erker",
            "hostWallId": "wall-south",
            "startAlongWallMm": 1500,
            "endAlongWallMm": 4500,
            "projectionMm": 1000,
            "shape": "rectangular",
        },
    )

    assert ok, f"createFacadeBay should succeed but got code={code!r}"
    bay = new_doc.elements["bay-erker-south"]
    assert isinstance(bay, FacadeBayElem)
    assert bay.host_wall_id == "wall-south"
    assert bay.shape == "rectangular"
    # The dispatcher must default the bay's level to the host wall's level.
    assert bay.level_id == "lvl-1"
    assert bay.discipline == "arch"


def test_create_facade_bay_supports_chamfered_shape() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createFacadeBay",
            "id": "bay-cham",
            "hostWallId": "wall-south",
            "startAlongWallMm": 2000,
            "endAlongWallMm": 4000,
            "projectionMm": 1200,
            "shape": "chamfered",
            "chamferAngleDeg": 45.0,
        },
    )

    assert ok, f"chamfered createFacadeBay should succeed but got code={code!r}"
    bay = new_doc.elements["bay-cham"]
    assert isinstance(bay, FacadeBayElem)
    assert bay.shape == "chamfered"
    assert bay.chamfer_angle_deg == 45.0


def test_create_facade_bay_supports_curved_shape() -> None:
    doc = _seed_doc()
    ok, new_doc, code = _commit(
        doc,
        {
            "type": "createFacadeBay",
            "id": "bay-curved",
            "hostWallId": "wall-south",
            "startAlongWallMm": 1000,
            "endAlongWallMm": 3000,
            "projectionMm": 900,
            "shape": "curved",
        },
    )

    assert ok, f"curved createFacadeBay should succeed but got code={code!r}"
    bay = new_doc.elements["bay-curved"]
    assert isinstance(bay, FacadeBayElem)
    assert bay.shape == "curved"
    # The validator nulls chamfer_angle_deg for non-chamfered shapes.
    assert bay.chamfer_angle_deg is None


def test_create_facade_bay_rejects_missing_host_wall() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="hostWallId"):
        _commit(
            doc,
            {
                "type": "createFacadeBay",
                "id": "bay-orphan",
                "hostWallId": "wall-does-not-exist",
                "startAlongWallMm": 0,
                "endAlongWallMm": 1000,
                "projectionMm": 800,
            },
        )


def test_create_facade_bay_rejects_non_wall_host() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="hostWallId"):
        _commit(
            doc,
            {
                "type": "createFacadeBay",
                "id": "bay-on-level",
                "hostWallId": "lvl-1",  # exists but is a level, not a wall
                "startAlongWallMm": 0,
                "endAlongWallMm": 1000,
                "projectionMm": 800,
            },
        )


def test_create_facade_bay_rejects_duplicate_id() -> None:
    doc = _seed_doc()
    with pytest.raises(ValueError, match="duplicate"):
        _commit(
            doc,
            {
                "type": "createFacadeBay",
                "id": "wall-south",  # collides with existing wall id
                "hostWallId": "wall-south",
                "startAlongWallMm": 0,
                "endAlongWallMm": 1000,
                "projectionMm": 800,
            },
        )
