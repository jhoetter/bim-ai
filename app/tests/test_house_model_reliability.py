"""Focused reliability tests for modeled residential houses."""

from __future__ import annotations

import json
from collections import Counter
from typing import Any

from bim_ai.cmd.apply_bundle import apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, RoofElem, RoomElem, WallElem, WindowElem
from bim_ai.engine import (
    clone_document,
    diff_undo_cmds,
    ensure_internal_origin,
    ensure_sun_settings,
    replay_bundle_diagnostics_for_outcome,
    try_commit_bundle,
)
from bim_ai.skb.archetypes import bundle_for

_HOUSE_ARCHETYPE_ID = "single_family_two_story_modest"

_VALID_ASSUMPTION = {
    "key": "residential_archetype",
    "value": _HOUSE_ARCHETYPE_ID,
    "confidence": 0.95,
    "source": "test_fixture",
}


def _empty_doc() -> Document:
    return Document(revision=1, elements={})  # type: ignore[arg-type]


def _house_commands() -> list[dict[str, Any]]:
    return [row["command"] for row in bundle_for(_HOUSE_ARCHETYPE_ID)]


def _blocking_wire(violations: list[Any]) -> list[dict[str, Any]]:
    return [
        v.model_dump(by_alias=True)
        for v in violations
        if getattr(v, "blocking", False) or getattr(v, "severity", None) == "error"
    ]


def _wire_elements(doc: Document) -> dict[str, dict[str, Any]]:
    return {
        eid: elem.model_dump(mode="json", by_alias=True) for eid, elem in doc.elements.items()
    }


def _explicit_house_element_ids() -> set[str]:
    return {
        str(cmd["id"])
        for cmd in _house_commands()
        if isinstance(cmd.get("id"), str)
        and cmd["type"] not in {"saveViewpoint", "createLevel"}
    }


def test_realistic_house_bundle_materializes_valid_building_elements() -> None:
    ok, new_doc, _cmds, violations, code = try_commit_bundle(_empty_doc(), _house_commands())
    assert ok is True, (code, _blocking_wire(violations))
    assert code == "ok"
    assert new_doc is not None
    assert _blocking_wire(violations) == []

    counts = Counter(elem.kind for elem in new_doc.elements.values())
    assert counts["level"] == 2
    assert counts["wall"] == 14
    assert counts["floor"] == 2
    assert counts["roof"] == 1
    assert counts["room"] == 6
    assert counts["door"] == 1
    assert counts["window"] == 8

    levels = {eid for eid, elem in new_doc.elements.items() if elem.kind == "level"}
    walls = {eid for eid, elem in new_doc.elements.items() if isinstance(elem, WallElem)}
    floors = [elem for elem in new_doc.elements.values() if isinstance(elem, FloorElem)]
    roofs = [elem for elem in new_doc.elements.values() if isinstance(elem, RoofElem)]
    rooms = [elem for elem in new_doc.elements.values() if isinstance(elem, RoomElem)]
    doors = [elem for elem in new_doc.elements.values() if isinstance(elem, DoorElem)]
    windows = [elem for elem in new_doc.elements.values() if isinstance(elem, WindowElem)]

    assert all(
        wall.level_id in levels
        for wall in new_doc.elements.values()
        if isinstance(wall, WallElem)
    )
    assert all(floor.level_id in levels and len(floor.boundary_mm) >= 3 for floor in floors)
    assert all(roof.reference_level_id in levels and len(roof.footprint_mm) >= 3 for roof in roofs)
    assert all(room.level_id in levels and len(room.outline_mm) >= 3 for room in rooms)
    assert all(door.wall_id in walls for door in doors)
    assert all(window.wall_id in walls for window in windows)


def test_house_bundle_apply_bundle_serializes_and_reloads() -> None:
    doc = _empty_doc()
    bundle = CommandBundle.model_validate(
        {
            "schemaVersion": "cmd-v3.0",
            "commands": _house_commands(),
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": doc.revision,
            "targetOptionId": "main",
        }
    )

    result, new_doc = apply_bundle(doc, bundle, "commit", submitter="human")

    assert result.applied is True
    assert result.new_revision == 2
    assert new_doc is not None
    assert not [
        v for v in result.violations if v.get("blocking") or v.get("severity") == "error"
    ]

    wire = new_doc.model_dump(mode="json", by_alias=True)
    reloaded = Document.model_validate(json.loads(json.dumps(wire, sort_keys=True)))
    assert Counter(elem.kind for elem in reloaded.elements.values()) == Counter(
        elem.kind for elem in new_doc.elements.values()
    )
    assert reloaded.elements["rf-main"].kind == "roof"
    assert reloaded.elements["dr-main"].kind == "door"


def test_house_bundle_undo_and_replay_are_stable() -> None:
    doc = _empty_doc()
    ensure_internal_origin(doc)
    ensure_sun_settings(doc)
    baseline = clone_document(doc)

    ok, new_doc, _cmds, violations, code = try_commit_bundle(baseline, _house_commands())
    assert ok is True, (code, _blocking_wire(violations))
    assert new_doc is not None

    undo_cmds = diff_undo_cmds(baseline, new_doc)
    assert any(
        cmd["type"] == "deleteElement" and cmd["elementId"] == "w-gf-s"
        for cmd in undo_cmds
    )

    ok_undo, rolled_back, _undo_cmds, undo_violations, undo_code = try_commit_bundle(
        new_doc, undo_cmds
    )
    assert ok_undo is True, (undo_code, _blocking_wire(undo_violations))
    assert rolled_back is not None
    assert _wire_elements(rolled_back) == _wire_elements(baseline)

    ok_replay, replayed, _replay_cmds, replay_violations, replay_code = try_commit_bundle(
        baseline, _house_commands()
    )
    assert ok_replay is True, (replay_code, _blocking_wire(replay_violations))
    assert replayed is not None
    assert Counter(elem.kind for elem in replayed.elements.values()) == Counter(
        elem.kind for elem in new_doc.elements.values()
    )
    replayed_wire = _wire_elements(replayed)
    new_doc_wire = _wire_elements(new_doc)
    for eid in _explicit_house_element_ids():
        assert replayed_wire[eid] == new_doc_wire[eid]


def test_house_bundle_rejects_impossible_geometry_without_mutating_source_doc() -> None:
    doc = _empty_doc()
    commands = [
        *_house_commands(),
        {
            "type": "createWall",
            "id": "w-impossible-zero-length",
            "name": "Impossible zero-length wall",
            "levelId": "lvl-ground",
            "start": {"xMm": 1200, "yMm": 1200},
            "end": {"xMm": 1200, "yMm": 1200},
            "thicknessMm": 200,
            "heightMm": 2800,
        },
    ]

    ok, new_doc, _cmds, violations, code = try_commit_bundle(doc, commands)

    assert ok is False
    assert new_doc is None
    assert code == "constraint_error"
    assert doc.elements == {}
    assert any(v.rule_id == "wall_zero_length" for v in violations)

    diagnostics = replay_bundle_diagnostics_for_outcome(doc, commands, outcome_code=code)
    assert diagnostics["firstBlockingCommandIndex"] == len(_house_commands())
    assert diagnostics["blockingViolationRuleIds"] == ["wall_zero_length"]
