from __future__ import annotations

import pytest

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FamilyTypeElem,
    FloorElem,
    LevelElem,
    ValidationRuleElem,
    WallElem,
)
from bim_ai.export_ifc import IFC_AVAILABLE, summarize_kernel_ifc_semantic_roundtrip

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


def test_exchange_advisory_info_when_ifc_skips_instances() -> None:
    doc = Document(
        revision=88,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl-a": FloorElem(
                kind="floor",
                id="fl-a",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
            ),
            "door-bad": DoorElem(
                kind="door",
                id="door-bad",
                name="Ghost",
                wallId="ghost-wall",
                alongT=0.5,
                widthMm=800,
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    infos = [
        v
        for v in viols
        if getattr(v, "rule_id", None) == "exchange_ifc_kernel_geometry_skip_summary"
    ]
    assert len(infos) == 1
    assert infos[0].severity == "info"
    assert "door_missing_host_wall" in infos[0].message
    assert not any(v.rule_id == "exchange_ifc_roundtrip_count_mismatch" for v in viols)


def test_summarize_kernel_ifc_semantic_roundtrip_passes_when_skipped_door_only() -> None:
    doc = Document(
        revision=89,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl-a": FloorElem(
                kind="floor",
                id="fl-a",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
            ),
            "door-bad": DoorElem(
                kind="door",
                id="door-bad",
                name="Ghost",
                wallId="ghost-wall",
                alongT=0.5,
                widthMm=800,
            ),
        },
    )
    summ = summarize_kernel_ifc_semantic_roundtrip(doc)
    assert summ["roundtripChecks"] is not None
    assert summ["roundtripChecks"]["allChecksPass"] is True


def test_exchange_no_ids_qto_gap_when_cleanroom_rule_and_roundtrip_clean() -> None:
    """Cleanroom IDS enables STEP roundtrip; QTO linkage should match — no ``exchange_ifc_ids_qto_gap``."""

    doc = Document(
        revision=210,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl-a": FloorElem(
                kind="floor",
                id="fl-a",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "ft-d": FamilyTypeElem(
                kind="family_type",
                id="ft-d",
                discipline="door",
                parameters={"displayName": "Clean door"},
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w-a",
                alongT=0.5,
                widthMm=900,
                familyTypeId="ft-d",
            ),
            "ids-rule": ValidationRuleElem(
                kind="validation_rule",
                id="ids-rule",
                name="cleanroom",
                ruleJson={"enforceCleanroomDoorFamilyTypes": True},
            ),
        },
    )
    summ = summarize_kernel_ifc_semantic_roundtrip(doc)
    assert summ["roundtripChecks"] is not None
    assert summ["roundtripChecks"].get("allQtoLinksMatch") is True
    viols = evaluate(dict(doc.elements))
    assert not any(v.rule_id == "exchange_ifc_ids_qto_gap" for v in viols)
