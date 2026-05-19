from __future__ import annotations

from bim_ai.elements import DoorElem, FloorElem, LevelElem, RoomElem, StairElem, Vec2Mm, WallElem
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
        "targetAreaM2": 9.0,
        "props": {
            "roomBimIntent": {
                "number": f"N-{room_id}",
                "occupancyUse": "residential living",
                "areaSource": "authored_outline_area",
                "boundingStatus": "bounded",
                "classification": {
                    "din277Use": "living/use area",
                    "din277AreaType": "NUF",
                    "ifcEntityIntent": "IfcSpace",
                },
            }
        },
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


def _room_sep(
    separation_id: str,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    level_id: str = "lvl-1",
) -> dict:
    return {
        "kind": "room_separation",
        "id": separation_id,
        "levelId": level_id,
        "start": {"xMm": start[0], "yMm": start[1]},
        "end": {"xMm": end[0], "yMm": end[1]},
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
    assert smoke["trackedItems"] == [
        "BIR-D01",
        "BIR-D02",
        "BIR-D03",
        "BIR-D04",
        "BIR-D05",
        "BIR-D06",
        "BIR-D07",
    ]
    assert smoke["findings"] == []


def test_element_object_mapping_is_valid_subject_shape() -> None:
    elements = {
        "lvl-1": LevelElem(id="lvl-1", elevationMm=0),
        "floor-1": FloorElem(
            id="floor-1",
            levelId="lvl-1",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=6000, yMm=0),
                Vec2Mm(xMm=6000, yMm=3000),
                Vec2Mm(xMm=0, yMm=3000),
            ],
        ),
        "wall-s": WallElem(
            id="wall-s",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=6000, yMm=0),
            props={"exterior": True},
        ),
        "room-a": RoomElem(
            id="room-a",
            levelId="lvl-1",
            name="Room A",
            outlineMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=6000, yMm=0),
                Vec2Mm(xMm=6000, yMm=3000),
                Vec2Mm(xMm=0, yMm=3000),
            ],
            programmeCode="RES",
            department="House",
            functionLabel="Living",
            finishSet="standard",
        ),
        "door-exit": DoorElem(
            id="door-exit",
            wallId="wall-s",
            alongT=0.5,
            props={"exitDoor": True},
        ),
    }

    findings = check_room_access_integrity(elements)

    assert "room_access_invalid_subject" not in _rule_ids(findings)


def test_stair_transition_uses_persisted_object_run_points() -> None:
    elements = {
        "lvl-1": LevelElem(id="lvl-1", elevationMm=0),
        "lvl-2": LevelElem(id="lvl-2", elevationMm=3000),
        "room-base": RoomElem(
            id="room-base",
            levelId="lvl-1",
            name="Base Hall",
            outlineMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=3000, yMm=0),
                Vec2Mm(xMm=3000, yMm=3000),
                Vec2Mm(xMm=0, yMm=3000),
            ],
            programmeCode="hall",
            department="House",
            functionLabel="Circulation",
            finishSet="standard",
        ),
        "room-top": RoomElem(
            id="room-top",
            levelId="lvl-2",
            name="Upper Hall",
            outlineMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=3000, yMm=0),
                Vec2Mm(xMm=3000, yMm=3000),
                Vec2Mm(xMm=0, yMm=3000),
            ],
            programmeCode="landing",
            department="House",
            functionLabel="Circulation",
            finishSet="standard",
        ),
        "stair": StairElem(
            id="stair",
            baseLevelId="lvl-1",
            topLevelId="lvl-2",
            runStartMm=Vec2Mm(xMm=1000, yMm=1000),
            runEndMm=Vec2Mm(xMm=2000, yMm=2000),
            widthMm=1000,
        ),
    }

    findings = check_room_access_integrity(elements)

    assert "room_access_stair_room_transition_unresolved" not in _rule_ids(findings)


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


def test_door_inside_room_but_not_on_boundary_does_not_create_access_path() -> None:
    elements = _small_house()
    elements.pop("door-between")
    elements["wall-floating"] = _wall("wall-floating", (3600, 1000), (5400, 1000))
    elements["door-floating"] = _door("door-floating", "wall-floating", 0.5)

    findings = check_room_access_integrity(elements)

    invalid = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_door_not_on_room_boundary"
    )
    assert invalid.code == "BIR-D04-DOOR"
    assert invalid.element_ids == ("door-floating", "wall-floating")
    assert any(
        finding.rule_id == "room_access_inaccessible_room" and finding.element_ids == ("room-b",)
        for finding in findings
    )


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


def test_open_room_separation_only_access_is_reported_without_blocking_open_plan() -> None:
    elements = _small_house()
    elements.pop("door-between")
    elements["sep-open-plan"] = _room_sep("sep-open-plan", (3000, 0), (3000, 3000))

    findings = check_room_access_integrity(elements)

    separator_only = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_open_separator_only_access"
        and finding.element_ids == ("room-b", "room-a")
    )
    assert separator_only.code == "BIR-D04-SEPARATION"
    assert separator_only.severity == "warning"
    assert not [
        finding
        for finding in findings
        if finding.rule_id == "room_access_inaccessible_room" and finding.element_ids == ("room-b",)
    ]


def test_helper_hosted_door_does_not_create_real_room_access() -> None:
    elements = _small_house()
    elements["wall-mid"]["props"]["physicalRole"] = "analysis"

    findings = check_room_access_integrity(elements)

    helper = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_door_host_not_real_boundary"
    )
    assert helper.code == "BIR-D02-REAL-DOOR"
    assert helper.element_ids == ("door-between", "wall-mid")
    assert helper.tracker_items == ("BIR-D01", "BIR-D02")
    assert helper.actionability == "fixable_by_rehost_or_physical_door"
    assert any(
        finding.rule_id == "room_access_inaccessible_room" and finding.element_ids == ("room-b",)
        for finding in findings
    )


def test_physical_room_separation_access_hack_is_reported() -> None:
    elements = _small_house()
    elements.pop("door-between")
    elements["sep-fake-door"] = _room_sep("sep-fake-door", (3000, 0), (3000, 3000))
    elements["sep-fake-door"]["props"] = {
        "physicalRole": "physical",
        "doorProxy": True,
        "showInSchedule": True,
    }

    findings = check_room_access_integrity(elements)

    fake = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_fake_room_separation_access"
    )
    assert fake.tracker_items == ("BIR-D01", "BIR-D02")
    assert fake.severity == "error"
    assert fake.priority == "P0"
    assert any(
        finding.rule_id == "room_access_inaccessible_room" and finding.element_ids == ("room-b",)
        for finding in findings
    )
    assert not [
        finding
        for finding in findings
        if finding.rule_id == "room_access_open_separator_only_access"
        and finding.element_ids == ("room-b", "room-a")
    ]


def test_exit_door_requires_explicit_exterior_classification_for_egress_evidence() -> None:
    elements = _small_house()
    elements["wall-s"]["props"] = {}

    findings = check_room_access_integrity(elements)

    implicit = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_exit_classification_implicit"
    )
    assert implicit.code == "BIR-D04-EXIT"
    assert implicit.tracker_items == ("BIR-D04",)
    assert implicit.element_ids == ("door-exit", "wall-s")


def test_room_outside_floor_is_reported() -> None:
    elements = _small_house()
    elements["room-b"] = _room(
        "room-b",
        "lvl-1",
        [(7000, 0), (9000, 0), (9000, 3000), (7000, 3000)],
    )

    findings = check_room_access_integrity(elements)

    outside = next(
        finding for finding in findings if finding.rule_id == "room_access_room_outside_floor"
    )
    assert outside.element_ids == ("room-b", "floor-1")
    assert outside.code == "BIR-D06-FLOOR"
    assert outside.tracker_items == ("BIR-D03",)


def test_room_on_level_without_floor_is_reported_against_storey() -> None:
    elements = _small_house()
    elements["lvl-2"] = {"kind": "level", "id": "lvl-2", "name": "Level 2"}
    elements["room-b"] = _room(
        "room-b",
        "lvl-2",
        [(3000, 0), (6000, 0), (6000, 3000), (3000, 3000)],
    )

    findings = check_room_access_integrity(elements)

    missing_floor = next(
        finding
        for finding in findings
        if finding.rule_id == "room_containment_missing_level_floor"
    )
    assert missing_floor.element_ids == ("room-b",)
    assert missing_floor.tracker_items == ("BIR-D03",)


def test_room_separations_are_explicit_room_wall_topology() -> None:
    elements = _small_house()
    elements["open-room"] = _room(
        "open-room",
        "lvl-1",
        [(1000, 500), (2500, 500), (2500, 2200), (1000, 2200)],
    )
    for wall_id in ("wall-mid",):
        elements.pop(wall_id)
    for index, (start, end) in enumerate(
        [
            ((1000, 500), (2500, 500)),
            ((2500, 500), (2500, 2200)),
            ((2500, 2200), (1000, 2200)),
            ((1000, 2200), (1000, 500)),
        ],
        start=1,
    ):
        elements[f"sep-open-room-{index}"] = _room_sep(f"sep-open-room-{index}", start, end)

    findings = check_room_access_integrity(elements)

    topology_gaps = [
        finding
        for finding in findings
        if finding.rule_id == "room_access_room_wall_topology_gap"
        and finding.element_ids == ("open-room",)
    ]
    assert topology_gaps == []


def test_room_wall_topology_gap_requires_wall_or_explicit_separator() -> None:
    elements = _small_house()
    elements["open-room"] = _room(
        "open-room",
        "lvl-1",
        [(1000, 500), (2500, 500), (2500, 2200), (1000, 2200)],
    )

    findings = check_room_access_integrity(elements)

    gap = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_room_wall_topology_gap"
        and finding.element_ids == ("open-room",)
    )
    assert gap.code == "BIR-D06-WALL"
    assert gap.evidence == {"unsupportedEdgeCount": 4}


def test_room_wall_topology_gap_detects_partial_edge_coverage() -> None:
    elements = {
        "lvl-1": {"kind": "level", "id": "lvl-1", "name": "Level 1"},
        "room-partial": _room(
            "room-partial",
            "lvl-1",
            [(0, 0), (3000, 0), (3000, 3000), (0, 3000)],
        ),
        "wall-s": _wall("wall-s", (0, 0), (3000, 0)),
        "wall-e": _wall("wall-e", (3000, 0), (3000, 3000)),
        "wall-w": _wall("wall-w", (0, 3000), (0, 0)),
        "wall-n-short": _wall("wall-n-short", (1300, 3000), (1700, 3000)),
    }

    findings = check_room_access_integrity(elements)

    gap = next(
        finding
        for finding in findings
        if finding.rule_id == "room_access_room_wall_topology_gap"
        and finding.element_ids == ("room-partial",)
    )
    assert gap.evidence == {"unsupportedEdgeCount": 1}


def test_wall_boundary_role_conflict_is_reported_deterministically() -> None:
    elements = _small_house()
    elements["wall-mid"]["props"] = {"roomBoundaryRole": "exterior"}

    findings = check_room_access_integrity(elements)

    conflicts = [
        finding
        for finding in findings
        if finding.rule_id == "room_access_wall_boundary_role_conflict"
    ]
    assert [finding.element_ids for finding in conflicts] == [
        ("room-a", "wall-mid"),
        ("room-b", "wall-mid"),
    ]
    assert all(finding.tracker_items == ("BIR-D05",) for finding in conflicts)


def test_wall_boundary_role_uses_adjacent_room_semantics_for_corridors() -> None:
    elements = _small_house()
    elements["room-b"]["functionLabel"] = "Corridor"
    elements["wall-mid"]["props"] = {"roomBoundaryRole": "interior"}

    findings = check_room_access_integrity(elements)

    conflicts = [
        finding
        for finding in findings
        if finding.rule_id == "room_access_wall_boundary_role_conflict"
    ]
    assert [finding.element_ids for finding in conflicts] == [
        ("room-a", "wall-mid"),
        ("room-b", "wall-mid"),
    ]
    assert {finding.evidence["expectedRole"] for finding in conflicts} == {"corridor"}
    assert {finding.evidence["declaredRole"] for finding in conflicts} == {"interior"}


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


def test_room_schedule_fields_read_structured_bim_intent() -> None:
    elements = _small_house()
    elements["room-b"]["props"]["roomBimIntent"]["classification"] = {
        "din277Use": "living/use area",
        "din277AreaType": "NUF",
        "ifcEntityIntent": "IfcSpace",
    }

    findings = check_room_access_integrity(elements)

    assert "room_access_missing_room_schedule_fields" not in _rule_ids(findings)


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
        finding for finding in findings if finding.rule_id == "room_access_unresolved_egress_path"
    ]
    assert [finding.element_ids for finding in egress] == [("room-c",)]


def test_multilevel_room_graph_reaches_exterior_through_stair_and_landing_doors() -> None:
    elements = {
        "lvl-1": {"kind": "level", "id": "lvl-1", "name": "Level 1"},
        "lvl-2": {"kind": "level", "id": "lvl-2", "name": "Level 2"},
        "floor-1": {
            "kind": "floor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
        },
        "floor-2": {
            "kind": "floor",
            "id": "floor-2",
            "levelId": "lvl-2",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 4000, "yMm": 0},
                {"xMm": 4000, "yMm": 3000},
                {"xMm": 0, "yMm": 3000},
            ],
        },
        "wall-exit": _wall("wall-exit", (0, 0), (0, 3000), props={"exterior": True}),
        "wall-ground-room": _wall("wall-ground-room", (2000, 0), (2000, 3000)),
        "wall-upper-room": _wall("wall-upper-room", (2000, 0), (2000, 3000), level_id="lvl-2"),
        "room-ground": _room("room-ground", "lvl-1", [(0, 0), (2000, 0), (2000, 3000), (0, 3000)]),
        "room-upper-landing": _room(
            "room-upper-landing",
            "lvl-2",
            [(0, 0), (2000, 0), (2000, 3000), (0, 3000)],
        ),
        "room-upper-bed": _room(
            "room-upper-bed",
            "lvl-2",
            [(2000, 0), (4000, 0), (4000, 3000), (2000, 3000)],
        ),
        "door-exit": _door("door-exit", "wall-exit", 0.5, {"exteriorDoor": True}),
        "door-upper": _door("door-upper", "wall-upper-room", 0.5),
        "stair-main": {
            "kind": "stair",
            "id": "stair-main",
            "baseLevelId": "lvl-1",
            "topLevelId": "lvl-2",
            "runStartMm": {"xMm": 1000, "yMm": 1000},
            "runEndMm": {"xMm": 1000, "yMm": 1000},
        },
    }

    findings = check_room_access_integrity(elements)

    assert not [
        finding for finding in findings if finding.rule_id == "room_access_unresolved_egress_path"
    ]


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
    assert {
        finding.rule_id: finding.tracker_items
        for finding in findings
        if finding.rule_id
        in {
            "room_access_occupancy_profile_placeholder",
            "room_access_accessibility_profile_placeholder",
        }
    } == {
        "room_access_occupancy_profile_placeholder": ("BIR-D07",),
        "room_access_accessibility_profile_placeholder": ("BIR-D07",),
    }
