from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import StairElem, Vec2Mm
from bim_ai.finding_disposition import build_finding_disposition_ledger


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def test_finding_disposition_ledger_combines_findings_blockers_and_tolerances() -> None:
    doc = Document(
        revision=4,
        elements={
            "stair-1": StairElem(
                id="stair-1",
                baseLevelId="EG",
                topLevelId="DG",
                runStartMm=_pt(0, 0),
                runEndMm=_pt(1000, 0),
                props={
                    "existingConditionTolerance": {
                        "accepted": True,
                        "findingCodes": ["stair_riser_tread_comfort_failure"],
                        "reason": "Source-documented existing condition.",
                        "sourceFactIds": ["fact-stair"],
                    }
                },
            )
        },
    )

    ledger = build_finding_disposition_ledger(
        "model-1",
        doc,
        advisor={
            "data": {
                "findings": [
                    {
                        "ruleId": "room_without_door_access",
                        "severity": "warning",
                        "elementIds": ["room-1"],
                        "message": "Room has no door.",
                    }
                ]
            }
        },
        integrity={"findings": []},
        area_reconciliation={
            "rows": [
                {"factId": "area-1", "status": "mismatch", "deltaM2": 1.2},
                {"factId": "area-2", "status": "within_tolerance"},
            ]
        },
        coverage={"unmodeledBlockingFactIds": ["fact-missing"]},
    )

    assert ledger["summary"]["accepted"] is False
    assert ledger["summary"]["unresolvedBlockingCount"] == 3
    assert ledger["summary"]["dispositionCounts"]["existing_nonconforming_tolerated"] == 1
    assert {row["source"] for row in ledger["rows"]} == {
        "advisor",
        "area_reconciliation",
        "source_coverage",
        "model_tolerance",
    }


def test_finding_disposition_ledger_applies_explicit_reviewed_decisions() -> None:
    doc = Document(revision=1, elements={})

    ledger = build_finding_disposition_ledger(
        "model-1",
        doc,
        advisor={
            "data": {
                "findings": [
                    {
                        "ruleId": "door_operation_clearance_conflict",
                        "severity": "warning",
                        "elementIds": ["door-1", "wall-1"],
                        "message": "Door swing source missing.",
                    }
                ]
            }
        },
        integrity={"findings": []},
        area_reconciliation={"rows": []},
        coverage={"unmodeledBlockingFactIds": ["fact-duplicate"]},
        dispositions=[
            {
                "ruleId": "door_operation_clearance_conflict",
                "disposition": "tolerated_source_lacks_swing_direction",
                "reason": "Source plan has opening position but no swing arc.",
                "acceptedBy": "test-reviewer",
            },
            {
                "factId": "fact-duplicate",
                "disposition": "duplicate_reconciled",
                "reason": "Duplicate elevation evidence is represented by a plan opening.",
                "acceptedBy": "test-reviewer",
            },
        ],
    )

    assert ledger["summary"]["accepted"] is True
    assert ledger["summary"]["unresolvedBlockingCount"] == 0
    assert ledger["summary"]["dispositionCounts"]["duplicate_reconciled"] == 1
