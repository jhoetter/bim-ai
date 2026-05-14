from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    LevelElem,
    MaterialElem,
    RoomElem,
    WallElem,
    WallTypeElem,
)
from bim_ai.energy_lens import (
    build_energy_handoff_payload,
    energy_qa_rows,
    material_thermal_spec,
    type_u_value_readout,
)


def test_project_material_lambda_takes_precedence_for_u_value() -> None:
    doc = Document(
        revision=1,
        elements={
            "mat-ins": MaterialElem(
                kind="material",
                id="mat-ins",
                name="Manufacturer insulation",
                thermal={"lambdaWPerMK": 0.029, "rhoKgPerM3": 42, "sourceReference": "datasheet"},
            ),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="Exterior retrofit",
                layers=[
                    {"thicknessMm": 160, "function": "insulation", "materialKey": "mat-ins"},
                    {"thicknessMm": 100, "function": "structure", "materialKey": "masonry_brick"},
                ],
            ),
        },
    )

    assert material_thermal_spec(doc, "mat-ins").lambda_w_per_mk == 0.029
    readout = type_u_value_readout(doc, doc.elements["wt"])
    assert readout["isComplete"] is True
    assert readout["uValueWPerM2K"] < 0.2
    assert "datasheet" in readout["sourceReferences"]


def test_u_value_readout_flags_missing_layer_lambda() -> None:
    wt = WallTypeElem(
        kind="wall_type",
        id="wt",
        name="Incomplete",
        layers=[{"thicknessMm": 50, "function": "insulation", "materialKey": "unknown"}],
    )
    doc = Document(revision=1, elements={"wt": wt})

    readout = type_u_value_readout(doc, wt)
    assert readout["isComplete"] is False
    assert readout["uValueWPerM2K"] == ""
    assert readout["missingMaterialKeys"] == ["unknown"]


def test_energy_handoff_payload_is_qa_not_compliance_engine() -> None:
    level = LevelElem(kind="level", id="lvl", name="Level 0", elevationMm=0)
    room = RoomElem(
        kind="room",
        id="room",
        name="Living",
        levelId="lvl",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 3000, "yMm": 0},
            {"xMm": 3000, "yMm": 3000},
            {"xMm": 0, "yMm": 3000},
        ],
        heatingStatus="heated",
    )
    wall = WallElem(
        kind="wall",
        id="wall",
        name="Wall",
        levelId="lvl",
        start={"xMm": 0, "yMm": 0},
        end={"xMm": 3000, "yMm": 0},
        thicknessMm=240,
        heightMm=2800,
    )
    door = DoorElem(
        kind="door",
        id="door",
        name="Door",
        wallId="wall",
        alongT=0.5,
        widthMm=900,
        thermalClassification="window_or_door_thermal_envelope",
    )
    doc = Document(revision=1, elements={"lvl": level, "room": room, "wall": wall, "door": door})

    qa = energy_qa_rows(doc)
    assert {row["issueCode"] for row in qa} >= {
        "energy_envelope_classification_missing",
        "energy_opening_u_or_g_value_missing",
        "energy_heated_room_zone_missing",
    }
    payload = build_energy_handoff_payload(doc)
    assert payload["format"] == "bimAiEnergyHandoff_v1"
    assert payload["scope"] == "model_enrichment_and_handoff_not_compliance_calculation"
    assert len(payload["qa"]) == len(qa)
