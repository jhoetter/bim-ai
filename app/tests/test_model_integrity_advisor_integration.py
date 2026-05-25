from __future__ import annotations

from bim_ai.constructability_report import build_constructability_report
from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, Vec2Mm, WallElem
from bim_ai.routes.deps import violations_wire


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def _access_proxy_doc() -> Document:
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
    doc = _access_proxy_doc()

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
    doc = _access_proxy_doc()

    report = build_constructability_report(
        doc.elements,
        revision=doc.revision,
        profile="construction_readiness",
    )
    rule_ids = {row["ruleId"] for row in report["findings"]}

    assert "hosted_opening_helper_host" in rule_ids
    assert "hosted_opening_host_outside_floor_envelope" in rule_ids
    assert report["summary"]["severityCounts"]["error"] >= 1


# The previous seed-artifact replay test was removed
# 2026-05-25 along with that artifact; the engine-fidelity assertions it carried
# live in the two unit tests above.
