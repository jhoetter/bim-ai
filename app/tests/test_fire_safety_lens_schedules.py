from __future__ import annotations

from bim_ai.api.registry import get_descriptor
from bim_ai.document import Document
from bim_ai.elements import DoorElem, DuctElem, LevelElem, RoomElem, ScheduleElem, Vec2Mm, WallElem
from bim_ai.fire_safety_lens import fire_safety_lens_review_status
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.schedule_field_registry import SCHEDULE_COLUMN_METADATA, SCHEDULE_COLUMN_ORDER


def _rect(x0: float, y0: float, x1: float, y1: float) -> list[Vec2Mm]:
    return [
        Vec2Mm(xMm=x0, yMm=y0),
        Vec2Mm(xMm=x1, yMm=y0),
        Vec2Mm(xMm=x1, yMm=y1),
        Vec2Mm(xMm=x0, yMm=y1),
    ]


def _doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0),
            "room-a": RoomElem(
                kind="room",
                id="room-a",
                name="Office",
                levelId="lvl-1",
                outlineMm=_rect(0, 0, 5000, 4000),
                props={
                    "fireCompartmentId": "BA-01",
                    "fireCompartmentName": "BA 01",
                    "fireResistanceRequirement": "REI 90",
                    "smokeCompartmentId": "RA-01",
                    "boundaryClosureStatus": "closed",
                    "volumeM3": 56,
                    "reviewStatus": "consultant_review",
                },
            ),
            "wall-rated": WallElem(
                kind="wall",
                id="wall-rated",
                name="Rated corridor wall",
                levelId="lvl-1",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                props={"fireResistanceRating": "F90", "reviewStatus": "checked"},
            ),
            "door-rated": DoorElem(
                kind="door",
                id="door-rated",
                name="T30-RS",
                wallId="wall-rated",
                alongT=0.5,
                widthMm=1000,
                props={
                    "doorFireRating": "T30",
                    "doorSmokeControlRating": "RS",
                    "selfClosingRequired": True,
                    "escapeRouteId": "ER-01",
                    "exitWidthMm": 1000,
                    "doorSwingCompliant": True,
                    "reviewStatus": "checked",
                },
            ),
            "duct-1": DuctElem(
                kind="duct",
                id="duct-1",
                levelId="lvl-1",
                startMm={"xMm": -1000, "yMm": 0},
                endMm={"xMm": 1000, "yMm": 0},
                props={
                    "ratedWallId": "wall-rated",
                    "firestopStatus": "installed",
                    "approvalStatus": "approved",
                    "responsibleTrade": "HVAC",
                    "inspectionEvidence": "photo-17",
                    "smokeControlEquipment": True,
                    "equipmentType": "smoke damper",
                    "systemId": "SC-1",
                    "controlZone": "RA-01",
                    "smokeControlStatus": "commissioned",
                },
            ),
            "sch-comp": ScheduleElem(
                kind="schedule",
                id="sch-comp",
                name="Fire compartment schedule",
                filters={"category": "fire_compartment"},
            ),
            "sch-rated": ScheduleElem(
                kind="schedule",
                id="sch-rated",
                name="Rated wall/floor schedule",
                filters={"category": "rated_element"},
            ),
            "sch-door": ScheduleElem(
                kind="schedule",
                id="sch-door",
                name="Fire door schedule",
                filters={"category": "fire_door"},
            ),
            "sch-route": ScheduleElem(
                kind="schedule",
                id="sch-route",
                name="Escape route schedule",
                filters={"category": "escape_route"},
            ),
            "sch-pen": ScheduleElem(
                kind="schedule",
                id="sch-pen",
                name="Firestop penetration schedule",
                filters={"category": "firestop_penetration"},
            ),
            "sch-smoke": ScheduleElem(
                kind="schedule",
                id="sch-smoke",
                name="Smoke control equipment schedule",
                filters={"category": "smoke_control_equipment"},
            ),
        },
    )


def test_fire_compartment_schedule_aggregates_shared_rooms() -> None:
    tbl = derive_schedule_table(_doc(), "sch-comp")
    assert tbl["category"] == "fire_compartment"
    assert tbl["columns"][:4] == ["elementId", "compartmentId", "name", "level"]
    assert tbl["rows"][0]["compartmentId"] == "BA-01"
    assert tbl["rows"][0]["areaM2"] == 20
    assert tbl["rows"][0]["boundaryClosureStatus"] == "closed"
    assert tbl["rows"][0]["fireResistanceRequirement"] == "REI 90"


def test_rated_element_and_fire_door_schedules_surface_required_ratings() -> None:
    rated = derive_schedule_table(_doc(), "sch-rated")
    assert {row["elementId"] for row in rated["rows"]} == {"door-rated", "wall-rated"}
    door = derive_schedule_table(_doc(), "sch-door")
    assert door["rows"][0]["fireRating"] == "T30"
    assert door["rows"][0]["smokeControlRating"] == "RS"
    assert door["rows"][0]["selfClosingRequired"] is True


def test_escape_penetration_and_smoke_control_schedules_are_auditable() -> None:
    route = derive_schedule_table(_doc(), "sch-route")
    assert route["rows"][0]["routeId"] == "ER-01"
    assert route["rows"][0]["exitWidthMm"] == 1000
    penetration = derive_schedule_table(_doc(), "sch-pen")
    assert penetration["rows"][0]["firestopStatus"] == "installed"
    assert penetration["rows"][0]["responsibleTrade"] == "HVAC"
    smoke = derive_schedule_table(_doc(), "sch-smoke")
    assert smoke["rows"][0]["equipmentType"] == "smoke damper"
    assert smoke["rows"][0]["status"] == "commissioned"


def test_fire_safety_schedule_registry_fields_have_metadata() -> None:
    for category in (
        "fire_compartment",
        "rated_element",
        "fire_door",
        "escape_route",
        "firestop_penetration",
        "smoke_control_equipment",
    ):
        assert category in SCHEDULE_COLUMN_ORDER
        missing = set(SCHEDULE_COLUMN_ORDER[category]) - set(SCHEDULE_COLUMN_METADATA[category])
        assert missing == set()


def test_fire_safety_lens_review_status_counts_default_schedules() -> None:
    payload = fire_safety_lens_review_status(_doc())
    assert payload["format"] == "fireSafetyLensReviewStatus_v1"
    assert payload["lensId"] == "fire-safety"
    assert payload["germanName"] == "Brandschutz"
    assert [row["category"] for row in payload["scheduleDefaults"]] == [
        "fire_compartment",
        "rated_element",
        "fire_door",
        "escape_route",
        "firestop_penetration",
        "smoke_control_equipment",
    ]
    assert payload["viewDefaults"][0]["defaultLens"] == "show_fire_safety"
    assert payload["sheetDefaults"][0]["sheetKind"] == "approval"
    assert payload["counts"]["fire_compartment"] == 1
    assert payload["counts"]["firestop_penetration"] == 1
    assert "no_jurisdictional_fire_code_approval" in payload["nonGoals"]


def test_fire_safety_lens_api_descriptor_is_registered() -> None:
    descriptor = get_descriptor("fire-safety-lens-review-status")
    assert descriptor is not None
    assert descriptor.restEndpoint is not None
    assert descriptor.restEndpoint.path == "/api/models/{model_id}/fire-safety-lens"
    assert descriptor.sideEffects == "none"
