from __future__ import annotations

from bim_ai.source_conflicts import (
    apply_source_conflict_dispositions,
    build_source_conflict_disposition_worklist,
)


def test_source_conflict_disposition_worklist_classifies_open_conflicts() -> None:
    ledger = {
        "format": "reverseBimConflictLedger_v1",
        "conflicts": [
            {
                "conflictId": "conflict-year",
                "topic": "year conflict",
                "status": "open",
                "severity": "blocker",
                "candidates": ["1956 permit", "1957 built"],
                "recommendedDisposition": "use 1957 as built year; retain 1956 as permit provenance",
                "sourceFactIds": ["fact-year"],
            },
            {
                "conflictId": "conflict-scope",
                "topic": "scope conflict",
                "status": "open",
                "recommendedDisposition": "ask_user_or_confirm_against site documents",
            },
            {
                "conflictId": "conflict-closed",
                "topic": "closed",
                "status": "resolved",
            },
        ],
    }

    worklist = build_source_conflict_disposition_worklist(ledger)

    assert worklist["summary"] == {
        "actionCount": 2,
        "blockedDecisionCount": 2,
        "recommendedActionCounts": {
            "choose_candidate": 1,
            "ask_user": 1,
        },
    }
    assert worklist["actions"][0]["recommendedAction"] == "choose_candidate"
    assert "chosenCandidate" in worklist["actions"][0]["requiredDecisionFields"]
    assert worklist["actions"][1]["recommendedAction"] == "ask_user"
    assert "question" in worklist["actions"][1]["requiredDecisionFields"]


def test_source_conflict_disposition_worklist_classifies_repair_and_context() -> None:
    ledger = {
        "conflicts": [
            {
                "conflictId": "conflict-roof",
                "status": "open",
                "recommendedDisposition": "request higher-resolution section crop",
            },
            {
                "conflictId": "conflict-site",
                "status": "open",
                "recommendedDisposition": "tolerate raster parcel as context only",
            },
            {
                "conflictId": "conflict-drainage",
                "status": "open",
                "recommendedDisposition": "model drainage as metadata/reference",
            },
        ]
    }

    worklist = build_source_conflict_disposition_worklist(ledger)

    assert [action["recommendedAction"] for action in worklist["actions"]] == [
        "source_repair_required",
        "mark_context_only",
        "metadata_only",
    ]


def test_apply_source_conflict_dispositions_resolves_valid_decisions() -> None:
    ledger = {
        "format": "reverseBimConflictLedger_v1",
        "conflicts": [
            {
                "conflictId": "conflict-year",
                "status": "open",
                "topic": "year",
            }
        ],
    }
    decisions = [
        {
            "conflictId": "conflict-year",
            "decision": "choose_candidate",
            "reason": "Current certificate is authoritative for built year.",
            "decidedBy": "test",
            "sourceRefs": ["doc-current"],
            "chosenCandidate": "1957 built year",
            "supersededCandidates": ["1956 permit year"],
        }
    ]

    report = apply_source_conflict_dispositions(ledger, decisions)

    assert report["accepted"] is True
    assert report["summary"]["resolvedConflictCount"] == 1
    assert report["conflictLedger"]["openConflictCount"] == 0
    assert report["conflictLedger"]["conflicts"][0]["status"] == "resolved"
    assert report["conflictLedger"]["conflicts"][0]["disposition"]["decision"] == "choose_candidate"


def test_apply_source_conflict_dispositions_keeps_invalid_decisions_open() -> None:
    ledger = {
        "conflicts": [
            {
                "conflictId": "conflict-scope",
                "status": "open",
                "topic": "scope",
            }
        ],
    }

    report = apply_source_conflict_dispositions(
        ledger,
        [{"conflictId": "conflict-scope", "decision": "ask_user"}],
    )

    assert report["accepted"] is False
    assert report["summary"]["invalidDecisionCount"] == 1
    assert report["conflictLedger"]["openConflictCount"] == 1
    assert report["dispositions"][0]["errors"] == [
        "missing required field: reason",
        "missing required field: decidedBy",
        "missing required field: sourceRefs",
        "missing required field: question",
    ]
