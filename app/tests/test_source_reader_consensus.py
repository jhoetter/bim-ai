from __future__ import annotations

from bim_ai.source_reader_consensus import build_source_reader_consensus_report


def _room_response(reader_id: str, area_m2: float) -> dict:
    return {
        "format": "sourceAiVisualTraceReaderResponse_v1",
        "workPackageId": "wp-dimensional-floorplans",
        "readerId": reader_id,
        "facts": [
            {
                "factId": f"{reader_id}-room-living",
                "kind": "room",
                "value": {
                    "levelId": "EG",
                    "name": "Living",
                    "areaM2": area_m2,
                    "boundaryMm": [
                        {"xMm": 0, "yMm": 0},
                        {"xMm": 4000, "yMm": 0},
                        {"xMm": 4000, "yMm": 5000},
                        {"xMm": 0, "yMm": 5000},
                    ],
                },
                "confidence": 0.9,
                "provenance": {"sourceDocumentId": "src-plan", "page": 1, "region": "living"},
            }
        ],
    }


def test_source_reader_consensus_blocks_single_critical_reader_pass() -> None:
    report = build_source_reader_consensus_report([_room_response("reader-a", 20.0)])

    assert report["ok"] is False
    assert report["summary"]["insufficientPackageCount"] == 1
    assert report["blockers"][0]["code"] == "reader_consensus_insufficient_independent_passes"


def test_source_reader_consensus_accepts_agreeing_independent_readers() -> None:
    report = build_source_reader_consensus_report(
        [
            _room_response("reader-a", 20.0),
            _room_response("reader-b", 20.1),
        ]
    )

    assert report["ok"] is True
    assert report["summary"]["blockingCount"] == 0
    assert report["factGroups"][0]["status"] == "accepted"


def test_source_reader_consensus_blocks_conflicting_critical_values() -> None:
    report = build_source_reader_consensus_report(
        [
            _room_response("reader-a", 20.0),
            _room_response("reader-b", 22.0),
        ]
    )

    assert report["ok"] is False
    assert report["summary"]["conflictingFactGroupCount"] == 1
    assert any(
        blocker["code"] == "reader_consensus_critical_fact_conflict"
        and blocker["field"] == "areaM2"
        for blocker in report["blockers"]
    )


def test_source_reader_consensus_allows_source_backed_single_reader_disposition() -> None:
    report = build_source_reader_consensus_report(
        [_room_response("reader-a", 20.0)],
        consensus_dispositions=[
            {
                "code": "reader_consensus_insufficient_independent_passes",
                "workPackageId": "wp-dimensional-floorplans",
                "decision": "accept_deterministic_cross_check",
                "reason": "The same room area is dimensionally cross-checked against the source plan.",
                "crossCheckEvidence": {"method": "dimension_sum", "sourceDocumentId": "src-plan"},
            }
        ],
    )

    assert report["ok"] is True
    assert report["summary"]["blockingCount"] == 0
    assert report["packages"][0]["status"] == "accepted_by_deterministic_disposition"


def test_source_reader_consensus_allows_source_backed_conflict_disposition() -> None:
    blocked = build_source_reader_consensus_report(
        [_room_response("reader-a", 20.0), _room_response("reader-b", 22.0)]
    )
    conflict = next(row for row in blocked["blockers"] if row["code"] == "reader_consensus_critical_fact_conflict")

    report = build_source_reader_consensus_report(
        [_room_response("reader-a", 20.0), _room_response("reader-b", 22.0)],
        consensus_dispositions=[
            {
                "code": "reader_consensus_critical_fact_conflict",
                "matchKey": conflict["matchKey"],
                "field": "areaM2",
                "decision": "use_authoritative_document",
                "reason": "The Wohnflaechenberechnung is the authoritative source for this area.",
                "sourceEvidence": {"sourceDocumentId": "src-area", "page": 1, "region": "room row"},
            }
        ],
    )

    assert report["ok"] is True
    assert report["summary"]["blockingCount"] == 0
    assert any(
        row["status"] == "resolved_by_deterministic_disposition"
        for row in report["factGroups"][0]["comparisons"]
    )
