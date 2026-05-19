from __future__ import annotations

from bim_ai.room_access_integrity import (
    check_room_access_integrity,
    room_access_integrity_smoke_v1,
)


def _room(room_id: str, level_id: str, outline: list[tuple[float, float]]) -> dict:
    return {
        "kind": "room",
        "id": room_id,
        "name": room_id.upper(),
        "levelId": level_id,
        "outlineMm": [{"xMm": x, "yMm": y} for x, y in outline],
        "programmeCode": "RES",
        "department": "House",
        "functionLabel": "Living",
        "finishSet": "standard",
    }


def _wall(
    wall_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    level_id: str = "lvl-1",
    props: dict | None = None,
) -> dict:
    return {
        "kind": "wall",
        "id": wall_id,
        "levelId": level_id,
        "start": {"xMm": start[0], "yMm": start[1]},
        "end": {"xMm": end[0], "yMm": end[1]},
        "props": props or {},
    }


def _door(door_id: str, wall_id: str, along_t: float = 0.5, props: dict | None = None) -> dict:
    return {
        "kind": "door",
        "id": door_id,
        "wallId": wall_id,
        "alongT": along_t,
        "props": props or {},
    }


def _small_house() -> dict[str, dict]:
    return {
        "lvl-1": {"kind": "level", "id": "lvl-1", "name": "Level 1"},
        "floor-1": {
            "kind": "floor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 6000, "yMm": 0},
                {"xMm": 6000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
        },
        "wall-s": _wall("wall-s", (0, 0), (6000, 0), props={"exterior": True}),
        "wall-e": _wall("wall-e", (6000, 0), (6000, 3000), props={"exterior": True}),
        "wall-n": _wall("wall-n", (6000, 3000), (0, 3000), props={"exterior": True}),
        "wall-w": _wall("wall-w", (0, 3000), (0, 0), props={"exterior": True}),
        "wall-mid": _wall("wall-mid", (3000, 0), (3000, 3000)),
        "room-a": _room("room-a", "lvl-1", [(0, 0), (3000, 0), (3000, 3000), (0, 3000)]),
        "room-b": _room(
            "room-b",
            "lvl-1",
            [(3000, 0), (6000, 0), (6000, 3000), (3000, 3000)],
        ),
        "door-exit": _door("door-exit", "wall-s", 0.25, {"exitDoor": True}),
        "door-between": _door("door-between", "wall-mid", 0.5),
    }


def _rule_ids(findings) -> set[str]:
    return {finding.rule_id for finding in findings}


def test_clean_small_house_room_graph_has_no_findings_and_stable_payload() -> None:
    findings = check_room_access_integrity(_small_house())

    assert findings == []

    smoke = room_access_integrity_smoke_v1(list(_small_house().values()))
    assert smoke["ok"] is True
    assert smoke["trackedItems"] == ["BIR-D04", "BIR-D05", "BIR-D06", "BIR-D07"]
    assert smoke["findings"] == []


def test_inaccessible_room_is_reported_without_db_or_api() -> None:
    elements = _small_house()
    elements.pop("door-between")

    findings = check_room_access_integrity({"elements": elements})

    assert "room_access_inaccessible_room" in _rule_ids(findings)
    inaccessible = next(
        finding for finding in findings if finding.rule_id == "room_access_inaccessible_room"
    )
    assert inaccessible.to_dict()["ruleId"] == "room_access_inaccessible_room"
    assert inaccessible.to_dict()["code"] == "BIR-D04-ACCESS"
    assert inaccessible.to_dict()["severity"] == "error"
    assert inaccessible.to_dict()["priority"] == "P1"
    assert inaccessible.to_dict()["discipline"] == "architecture"
    assert inaccessible.to_dict()["perspective"] == "room_access_egress_topology"
    assert inaccessible.to_dict()["elementIds"] == ["room-b"]
    assert inaccessible.to_dict()["recommendation"]


def test_fake_helper_access_is_rejected_when_not_geometrically_evidenced() -> None:
    elements = _small_house()
    elements["door-exit"]["props"]["roomIds"] = ["room-a", "room-b"]

    findings = check_room_access_integrity(elements)

    helper = next(
        finding for finding in findings if finding.rule_id == "room_access_fake_helper_access"
    )
    assert helper.element_ids == ("door-exit", "room-a", "room-b")
    assert helper.evidence == {
        "declaredRoomIds": ["room-a", "room-b"],
        "geometricRoomIds": ["room-a"],
    }


def test_room_outside_floor_is_reported() -> None:
    elements = _small_house()
    elements["room-b"] = _room(
        "room-b",
        "lvl-1",
        [(7000, 0), (9000, 0), (9000, 3000), (7000, 3000)],
    )

    findings = check_room_access_integrity(elements)

    outside = next(finding for finding in findings if finding.rule_id == "room_access_room_outside_floor")
    assert outside.element_ids == ("room-b", "floor-1")
    assert outside.code == "BIR-D06-FLOOR"


def test_missing_room_schedule_fields_are_reported() -> None:
    elements = _small_house()
    elements["room-b"]["programmeCode"] = ""
    elements["room-b"].pop("finishSet")

    findings = check_room_access_integrity(elements)

    schedule = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_missing_room_schedule_fields"
    )
    assert schedule.element_ids == ("room-b",)
    assert schedule.evidence == {"missingFields": ["programmeCode", "finishSet"]}


def test_unresolved_egress_path_is_reported_for_isolated_accessible_room() -> None:
    elements = _small_house()
    elements.update(
        {
            "wall-iso-s": _wall("wall-iso-s", (8000, 0), (11000, 0)),
            "wall-iso-e": _wall("wall-iso-e", (11000, 0), (11000, 3000)),
            "wall-iso-n": _wall("wall-iso-n", (11000, 3000), (8000, 3000)),
            "wall-iso-w": _wall("wall-iso-w", (8000, 3000), (8000, 0)),
            "room-c": _room(
                "room-c",
                "lvl-1",
                [(8000, 0), (11000, 0), (11000, 3000), (8000, 3000)],
            ),
            "door-isolated": _door("door-isolated", "wall-iso-s", 0.5),
        }
    )

    findings = check_room_access_integrity(elements)

    egress = [
        finding
        for finding in findings
        if finding.rule_id == "room_access_unresolved_egress_path"
    ]
    assert [finding.element_ids for finding in egress] == [("room-c",)]


def test_profile_controlled_occupancy_and_accessibility_placeholders() -> None:
    elements = _small_house()

    findings = check_room_access_integrity(
        elements,
        profile={
            "requiredRoomScheduleFields": [
                "name",
                "levelId",
                "programmeCode",
                "department",
                "functionLabel",
                "finishSet",
            ],
            "requireOccupancy": True,
            "requiredOccupancyFields": ["occupancyType", "occupantLoad"],
            "requireAccessibility": True,
            "requiredAccessibilityFields": ["accessibleRoute"],
        },
    )

    assert {
        "room_access_occupancy_profile_placeholder",
        "room_access_accessibility_profile_placeholder",
    }.issubset(_rule_ids(findings))
