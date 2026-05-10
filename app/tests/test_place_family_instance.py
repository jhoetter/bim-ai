from __future__ import annotations

import pytest
from pydantic import TypeAdapter

from bim_ai.commands import Command
from bim_ai.document import Document
from bim_ai.engine import apply_inplace


def _apply(doc: Document, cmd_dict: dict) -> Document:
    cmd = TypeAdapter(Command).validate_python(cmd_dict)
    apply_inplace(doc, cmd)
    return doc


def _doc() -> Document:
    return Document(
        elements={
            "lvl": {"kind": "level", "id": "lvl", "name": "Level 1", "elevationMm": 0},
            "pv": {"kind": "plan_view", "id": "pv", "name": "Level 1", "levelId": "lvl"},
            "wall": {
                "kind": "wall",
                "id": "wall",
                "name": "Wall",
                "levelId": "lvl",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 3000, "yMm": 0},
                "thicknessMm": 200,
                "heightMm": 2800,
            },
            "ft": {
                "kind": "family_type",
                "id": "ft",
                "name": "Loaded Chair",
                "familyId": "fam-chair",
                "discipline": "generic",
                "parameters": {"Width": 500},
            },
        }
    )


def test_place_family_instance_level_based() -> None:
    out = _apply(
        _doc(),
        {
            "type": "placeFamilyInstance",
            "id": "fi",
            "familyTypeId": "ft",
            "levelId": "lvl",
            "positionMm": {"xMm": 1200, "yMm": 900},
            "rotationDeg": 90,
            "paramValues": {"Width": 600},
        },
    )

    fi = out.elements["fi"]
    assert fi.kind == "family_instance"
    assert fi.family_type_id == "ft"
    assert fi.level_id == "lvl"
    assert fi.position_mm.x_mm == 1200
    assert fi.rotation_deg == 90
    assert fi.param_values["Width"] == 600


def test_place_family_instance_wall_hosted_metadata() -> None:
    out = _apply(
        _doc(),
        {
            "type": "placeFamilyInstance",
            "id": "fi-wall",
            "familyTypeId": "ft",
            "levelId": "lvl",
            "hostViewId": "pv",
            "hostElementId": "wall",
            "hostAlongT": 0.4,
            "positionMm": {"xMm": 1200, "yMm": 0},
        },
    )

    fi = out.elements["fi-wall"]
    assert fi.host_element_id == "wall"
    assert fi.host_along_t == 0.4
    assert fi.host_view_id == "pv"
    opening = out.elements["fi-wall_opening"]
    assert opening.kind == "wall_opening"
    assert opening.host_wall_id == "wall"
    assert opening.along_t_start < 0.4 < opening.along_t_end
    assert opening.sill_height_mm == 0
    assert opening.head_height_mm == 2100


def test_place_family_instance_rejects_unknown_type() -> None:
    with pytest.raises(ValueError, match="familyTypeId"):
        _apply(
            _doc(),
            {
                "type": "placeFamilyInstance",
                "familyTypeId": "missing",
                "levelId": "lvl",
                "positionMm": {"xMm": 0, "yMm": 0},
            },
        )
