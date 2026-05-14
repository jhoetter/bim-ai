from __future__ import annotations

from bim_ai.commands import (
    CreateConstructionLogisticsCmd,
    CreateConstructionPackageCmd,
    SetElementConstructionCmd,
    UpsertConstructionQaChecklistCmd,
)
from bim_ai.construction_lens import build_construction_lens_payload
from bim_ai.document import Document
from bim_ai.elements import LevelElem, PhaseElem, ScheduleElem, Vec2Mm, WallElem
from bim_ai.engine import apply_inplace
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.api.registry import get_catalog


def _doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Ground", elevationMm=0),
            "phase-new": PhaseElem(kind="phase", id="phase-new", name="New", ord=2),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                name="Wall 1",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=3000,
            ),
        },
    )


def test_construction_commands_attach_metadata_without_reclassifying_design_element() -> None:
    doc = _doc()
    apply_inplace(
        doc,
        CreateConstructionPackageCmd(
            id="pkg-01",
            name="Core walls",
            code="A-100",
            phaseId="phase-new",
            plannedStart="2026-06-01",
            plannedEnd="2026-06-10",
            responsibleCompany="BuildCo",
        ),
    )
    apply_inplace(
        doc,
        SetElementConstructionCmd(
            elementId="wall-1",
            phaseCreatedId="phase-new",
            metadata={
                "constructionPackageId": "pkg-01",
                "plannedStart": "2026-06-01",
                "plannedEnd": "2026-06-10",
                "installationSequence": 12,
                "progressStatus": "installed",
                "responsibleCompany": "BuildCo",
                "evidenceRefs": [{"kind": "deterministic_png", "pngBasename": "wall-1.png"}],
                "inspectionChecklist": [{"id": "firestop", "label": "Firestop checked"}],
            },
        ),
    )

    wall = doc.elements["wall-1"]
    assert isinstance(wall, WallElem)
    assert wall.kind == "wall"
    assert wall.phase_created == "phase-new"
    assert wall.props["construction"]["progressStatus"] == "installed"
    assert wall.props["construction"]["constructionPackageId"] == "pkg-01"


def test_construction_schedule_defaults_cover_package_phase_progress_logistics_and_qa() -> None:
    doc = _doc()
    apply_inplace(
        doc,
        CreateConstructionPackageCmd(id="pkg-01", name="Core walls", phaseId="phase-new"),
    )
    apply_inplace(
        doc,
        SetElementConstructionCmd(
            elementId="wall-1",
            phaseCreatedId="phase-new",
            metadata={
                "constructionPackageId": "pkg-01",
                "progressStatus": "in_progress",
                "responsibleCompany": "BuildCo",
            },
        ),
    )
    apply_inplace(
        doc,
        CreateConstructionLogisticsCmd(
            id="log-01",
            name="Crane swing",
            logisticsKind="crane_lift_zone",
            constructionPackageId="pkg-01",
            progressStatus="not_started",
            boundaryMm=[
                Vec2Mm(xMm=0, yMm=0),
                Vec2Mm(xMm=1000, yMm=0),
                Vec2Mm(xMm=1000, yMm=1000),
            ],
        ),
    )
    apply_inplace(
        doc,
        UpsertConstructionQaChecklistCmd(
            id="qa-01",
            name="Wall QA",
            targetElementIds=["wall-1"],
            constructionPackageId="pkg-01",
            progressStatus="inspected",
            checklist=[
                {"id": "plumb", "label": "Plumb", "status": "pass"},
                {"id": "anchor", "label": "Anchors", "status": "open"},
            ],
        ),
    )
    doc.elements.update(
        {
            "sch-pkg": ScheduleElem(kind="schedule", id="sch-pkg", name="Packages", category="construction_package"),
            "sch-phase": ScheduleElem(kind="schedule", id="sch-phase", name="Phases", category="phase"),
            "sch-progress": ScheduleElem(kind="schedule", id="sch-progress", name="Progress", category="progress"),
            "sch-log": ScheduleElem(kind="schedule", id="sch-log", name="Site Logistics", category="site_logistics"),
            "sch-qa": ScheduleElem(kind="schedule", id="sch-qa", name="QA Checklist", category="qa_checklist"),
        }
    )

    assert derive_schedule_table(doc, "sch-pkg")["rows"][0]["elementId"] == "pkg-01"
    assert derive_schedule_table(doc, "sch-phase")["rows"][0]["createdCount"] == 1
    assert derive_schedule_table(doc, "sch-progress")["rows"][0]["progressStatus"] == "in_progress"
    assert derive_schedule_table(doc, "sch-log")["rows"][0]["logisticsKind"] == "crane_lift_zone"
    assert derive_schedule_table(doc, "sch-qa")["rows"][0]["passedCount"] == 1

    payload = build_construction_lens_payload(doc)
    assert payload["lens"]["id"] == "construction"
    assert payload["summary"]["progressElementCount"] == 1
    assert payload["summary"]["logisticsElementCount"] == 1
    assert {row["category"] for row in payload["scheduleDefaults"]} >= {
        "construction_package",
        "phase",
        "progress",
        "punch",
        "site_logistics",
        "qa_checklist",
    }
    assert any(row["colorBy"] == "progressStatus" for row in payload["viewDefaults"])
    assert any(row["name"] == "Punch Item Sheet" for row in payload["sheetDefaults"])


def test_construction_lens_tools_are_registered() -> None:
    names = {tool.name for tool in get_catalog().tools}
    assert "construction-lens-report" in names
    assert "set-element-construction" in names
