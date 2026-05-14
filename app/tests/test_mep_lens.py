from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, SlabOpeningElem
from bim_ai.engine import try_commit_bundle
from bim_ai.mep_lens import build_mep_lens_payload, build_mep_schedule_table


def _doc_with_mep() -> Document:
    doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Level 1", elevationMm=0),
            "room-1": RoomElem(
                kind="room",
                id="room-1",
                name="Office",
                levelId="lvl-1",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                ventilationZone="VAV-1",
                heatingCoolingZone="HC-1",
                designAirChangeRate=4.5,
                electricalLoadSummary={"connectedLoadW": 1200},
                serviceRequirements=["supply_air", "data"],
            ),
            "shaft-1": SlabOpeningElem(
                kind="slab_opening",
                id="shaft-1",
                name="Riser A",
                hostFloorId="floor-1",
                boundaryMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 1400, "yMm": 1000},
                    {"xMm": 1400, "yMm": 1400},
                    {"xMm": 1000, "yMm": 1400},
                ],
                isShaft=True,
            ),
        },
    )
    ok, next_doc, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createPipe",
                "id": "pipe-1",
                "levelId": "lvl-1",
                "startMm": {"xMm": 0, "yMm": 100},
                "endMm": {"xMm": 3000, "yMm": 100},
                "diameterMm": 40,
                "systemType": "domestic_water",
                "systemName": "CW-1",
                "flowDirection": "supply",
                "serviceLevel": "Level 1 ceiling",
                "connectors": [{"id": "pipe-1:c1", "systemType": "domestic_water"}],
            },
            {
                "type": "createDuct",
                "id": "duct-1",
                "levelId": "lvl-1",
                "startMm": {"xMm": 0, "yMm": 800},
                "endMm": {"xMm": 2000, "yMm": 800},
                "widthMm": 500,
                "heightMm": 250,
                "systemType": "hvac_supply",
                "systemName": "SA-1",
                "flowDirection": "supply",
            },
            {
                "type": "createMepEquipment",
                "id": "ahu-1",
                "name": "AHU-1",
                "levelId": "lvl-1",
                "positionMm": {"xMm": 500, "yMm": 500},
                "systemType": "hvac_supply",
                "systemName": "SA-1",
                "electricalLoadW": 900,
            },
            {
                "type": "createMepOpeningRequest",
                "id": "or-1",
                "hostElementId": "shaft-1",
                "levelId": "lvl-1",
                "requesterElementIds": ["duct-1"],
                "openingKind": "shaft",
                "widthMm": 550,
                "heightMm": 300,
                "systemType": "hvac_supply",
                "systemName": "SA-1",
            },
        ],
    )
    assert ok
    return next_doc


def test_mep_lens_payload_exposes_required_contracts() -> None:
    payload = build_mep_lens_payload(_doc_with_mep())

    categories = {row["category"] for row in payload["scheduleDefaults"]}
    assert categories == {
        "equipment",
        "duct",
        "pipe",
        "fixture",
        "opening_request",
        "shaft",
        "electrical_load",
    }
    assert payload["lensId"] == "mep"
    assert payload["connectors"][0]["ownerElementId"] == "pipe-1"
    assert payload["roomZones"][0]["ventilationZone"] == "VAV-1"
    assert payload["openingRequests"][0]["hostElementId"] == "shaft-1"


def test_mep_schedule_tables_cover_services_openings_shafts_and_loads() -> None:
    doc = _doc_with_mep()

    pipe = build_mep_schedule_table(doc, "pipe")
    assert pipe["rows"][0]["systemType"] == "domestic_water"
    assert pipe["rows"][0]["lengthM"] == 3

    duct = build_mep_schedule_table(doc, "duct")
    assert duct["rows"][0]["widthMm"] == 500

    openings = build_mep_schedule_table(doc, "opening_request")
    assert openings["rows"][0]["requesterElementIds"] == "duct-1"

    shafts = build_mep_schedule_table(doc, "shaft")
    assert shafts["rows"][0]["isShaft"] is True

    loads = build_mep_schedule_table(doc, "electrical_load")
    assert {row["elementId"] for row in loads["rows"]} == {"ahu-1", "room-1"}
