from __future__ import annotations

from bim_ai.elements import WallElem


def _minimal_wall_payload() -> dict[str, object]:
    return {
        "kind": "wall",
        "id": "w-struct",
        "name": "Wall",
        "levelId": "lvl-1",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 4000, "yMm": 0},
    }


def test_wall_structural_aliases_roundtrip() -> None:
    wall = WallElem.model_validate(
        {
            **_minimal_wall_payload(),
            "loadBearing": True,
            "structuralRole": "load_bearing",
            "analyticalParticipation": True,
            "structuralMaterialKey": "concrete-c30",
            "structuralIntentConfidence": 0.82,
        }
    )

    assert wall.load_bearing is True
    assert wall.structural_role == "load_bearing"
    assert wall.analytical_participation is True
    assert wall.structural_material_key == "concrete-c30"
    assert wall.structural_intent_confidence == 0.82

    exported = wall.model_dump(by_alias=True)
    assert exported["loadBearing"] is True
    assert exported["structuralRole"] == "load_bearing"
    assert exported["analyticalParticipation"] is True
    assert exported["structuralMaterialKey"] == "concrete-c30"
    assert exported["structuralIntentConfidence"] == 0.82


def test_wall_structural_fields_keep_minimal_wall_backwards_compatible() -> None:
    wall = WallElem.model_validate(_minimal_wall_payload())

    assert wall.load_bearing is None
    assert wall.structural_role == "unknown"
    assert wall.analytical_participation is False
    assert wall.structural_material_key is None
    assert wall.structural_intent_confidence is None

    exported = wall.model_dump(by_alias=True)
    assert exported["loadBearing"] is None
    assert exported["structuralRole"] == "unknown"
    assert exported["analyticalParticipation"] is False
    assert exported["structuralMaterialKey"] is None
    assert exported["structuralIntentConfidence"] is None
