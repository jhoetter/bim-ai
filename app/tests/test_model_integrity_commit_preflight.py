from __future__ import annotations

from bim_ai.constraints_core import Violation
from bim_ai.document import Document
from bim_ai.elements import FloorElem, LevelElem, Vec2Mm, WallElem
from bim_ai.engine import compute_delta_wire, try_commit, try_commit_bundle


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _base_doc() -> Document:
    level = LevelElem(id="lvl-1", name="Ground", elevationMm=0)
    floor = FloorElem(
        id="floor-1",
        levelId=level.id,
        boundaryMm=[_pt(0, 0), _pt(5000, 0), _pt(5000, 4000), _pt(0, 4000)],
    )
    wall = WallElem(
        id="wall-1",
        name="Interior wall",
        levelId=level.id,
        start=_pt(1000, 1000),
        end=_pt(4000, 1000),
        thicknessMm=200,
        heightMm=2800,
    )
    return Document(elements={level.id: level, floor.id: floor, wall.id: wall})


def _rule_ids(violations: list[Violation]) -> set[str]:
    return {v.rule_id for v in violations}


def test_single_command_commit_rejects_physical_helper_wall_before_persisting() -> None:
    ok, new_doc, _cmd, violations, code = try_commit(
        _base_doc(),
        {
            "type": "set_element_prop",
            "elementId": "wall-1",
            "key": "helper",
            "value": True,
        },
    )

    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert "physical_access_proxy_leakage" in _rule_ids(violations)


def test_bundle_commit_rejects_helper_hosted_physical_door() -> None:
    commands = [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0},
        {
            "type": "createFloor",
            "id": "floor-1",
            "levelId": "lvl-1",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 5000, "yMm": 0},
                {"xMm": 5000, "yMm": 4000},
                {"xMm": 0, "yMm": 4000},
            ],
        },
        {
            "type": "createWall",
            "id": "wall-1",
            "name": "Interior wall",
            "levelId": "lvl-1",
            "start": {"xMm": 1000, "yMm": 1000},
            "end": {"xMm": 4000, "yMm": 1000},
            "heightMm": 2800,
            "thicknessMm": 200,
        },
        {"type": "set_element_prop", "elementId": "wall-1", "key": "helper", "value": True},
        {
            "type": "insertDoorOnWall",
            "id": "door-1",
            "wallId": "wall-1",
            "alongT": 0.5,
            "widthMm": 900,
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(Document(elements={}), commands)

    rule_ids = _rule_ids(violations)
    assert not ok
    assert new_doc is None
    assert code == "constraint_error"
    assert "physical_access_proxy_leakage" in rule_ids
    assert "hosted_opening_helper_host" in rule_ids


def test_delta_wire_default_includes_commit_integrity_findings() -> None:
    before = _base_doc()
    after = before.model_copy(deep=True)
    wall = after.elements["wall-1"]
    after.elements["wall-1"] = wall.model_copy(update={"props": {"helper": True}})

    delta = compute_delta_wire(before, after)
    rule_ids = {row["ruleId"] for row in delta["violations"]}

    assert "physical_access_proxy_leakage" in rule_ids
