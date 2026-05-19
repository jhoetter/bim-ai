from __future__ import annotations

import json
from pathlib import Path

from bim_ai.cmd.types import CommandBundle
from bim_ai.constructability_report import build_constructability_report
from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit_bundle
from bim_ai.routes_deps import violations_wire


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _target_house_access_proxy_doc() -> Document:
    floor = FloorElem(
        id="ground-base-floor",
        levelId="hf-lvl-ground",
        boundaryMm=[_pt(1000, 0), _pt(7000, 0), _pt(7000, 7000), _pt(1000, 7000)],
    )
    wall = WallElem(
        id="access-wall-hf-room-gf-bath-laundry",
        name="Bath / Laundry access control wall",
        levelId="hf-lvl-ground",
        start=_pt(7600, 1300),
        end=_pt(7600, 1900),
        thicknessMm=90,
        heightMm=2400,
        wallTypeId="wt-internal",
        materialKey="gypsum_board",
        loadBearing=False,
        structuralRole="non_load_bearing",
        analyticalParticipation=False,
    )
    door = DoorElem(
        id="access-door-hf-room-gf-bath-laundry",
        name="Bath / Laundry access door",
        wallId=wall.id,
        alongT=0.5,
        widthMm=500,
        familyTypeId="ft-pocket-door-standard",
    )
    return Document(
        elements={
            "hf-lvl-ground": LevelElem(id="hf-lvl-ground", name="Ground", elevationMm=0),
            floor.id: floor,
            wall.id: wall,
            door.id: door,
        }
    )


def test_snapshot_advisor_includes_hosted_opening_integrity_findings() -> None:
    doc = _target_house_access_proxy_doc()

    rows = violations_wire(doc.elements)
    rule_ids = {row["ruleId"] for row in rows}

    assert "hosted_opening_helper_host" in rule_ids
    assert "hosted_opening_host_outside_floor_envelope" in rule_ids
    assert "physical_access_proxy_leakage" in rule_ids
    helper = next(row for row in rows if row["ruleId"] == "hosted_opening_helper_host")
    assert helper["hostIds"] == ["access-wall-hf-room-gf-bath-laundry"]
    assert "BIR-B01" in helper["trackerItems"]
    assert helper["recommendation"]
    assert helper["safeFixHints"]


def test_constructability_report_includes_model_integrity_findings() -> None:
    doc = _target_house_access_proxy_doc()

    report = build_constructability_report(
        doc.elements,
        revision=doc.revision,
        profile="construction_readiness",
    )
    rule_ids = {row["ruleId"] for row in report["findings"]}

    assert "hosted_opening_helper_host" in rule_ids
    assert "hosted_opening_host_outside_floor_envelope" in rule_ids
    assert report["summary"]["severityCounts"]["error"] >= 1


def test_target_house_ground_service_rooms_are_floor_contained() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    bundle_path = repo_root / "seed-artifacts" / "target-house-1" / "bundle.json"
    bundle_payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    bundle = CommandBundle.model_validate({**bundle_payload, "parentRevision": 1})

    ok, doc, _commands, violations, code = try_commit_bundle(
        Document(revision=1, elements={}),  # type: ignore[arg-type]
        bundle.commands,
    )

    assert ok, f"target-house-1 bundle replay failed: {code} {violations}"
    assert doc is not None

    report = build_constructability_report(
        doc.elements,
        revision=doc.revision,
        profile="construction_readiness",
    )
    target_room_ids = {"hf-room-gf-bath-laundry", "hf-room-utility"}
    target_findings = [
        finding
        for finding in report["findings"]
        if finding.get("code") == "BIR-D06-FLOOR"
        and target_room_ids.intersection(finding.get("elementIds") or [])
    ]
    containment_findings = [
        finding
        for finding in report["findings"]
        if str(finding.get("ruleId") or "").startswith("room_containment")
    ]

    assert target_findings == []
    assert containment_findings == []
