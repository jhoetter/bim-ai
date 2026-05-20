from __future__ import annotations

from bim_ai.source_area_consistency import build_source_area_consistency_report


def test_source_area_consistency_accepts_matching_room_rows_and_level_total() -> None:
    report = build_source_area_consistency_report(
        [
            {
                "factId": "room-living",
                "kind": "room",
                "value": {
                    "levelId": "EG",
                    "name": "Living",
                    "areaM2": 20.0,
                    "boundaryMm": [
                        {"xMm": 0, "yMm": 0},
                        {"xMm": 4000, "yMm": 0},
                        {"xMm": 4000, "yMm": 5000},
                        {"xMm": 0, "yMm": 5000},
                    ],
                },
            },
            {
                "factId": "area-living",
                "kind": "room",
                "value": {"levelId": "EG", "name": "Living", "areaM2": 20.0},
            },
            {
                "factId": "area-eg",
                "kind": "area",
                "value": {
                    "levelId": "EG",
                    "name": "Net EG",
                    "scope": "one_half_level_subtotal",
                    "areaM2": 20.0,
                },
            },
        ],
        tolerance_m2=0.1,
    )

    assert report["summary"]["accepted"] is True
    assert report["summary"]["blockingCount"] == 0
    assert {row["status"] for row in report["checks"]} == {"accepted"}


def test_source_area_consistency_blocks_missing_modelable_room_for_area_row() -> None:
    report = build_source_area_consistency_report(
        [
            {
                "factId": "area-pantry",
                "kind": "area",
                "value": {"scope": "room", "levelId": "EG", "name": "Pantry", "areaM2": 0.52},
            }
        ],
        tolerance_m2=0.1,
    )

    assert report["summary"]["accepted"] is False
    assert report["summary"]["blockingCount"] == 1
    assert report["blockers"][0]["code"] == "source_area_room_row_without_modelable_room"


def test_source_area_consistency_blocks_level_total_mismatch() -> None:
    report = build_source_area_consistency_report(
        [
            {
                "factId": "room-a",
                "kind": "room",
                "value": {
                    "levelId": "EG",
                    "name": "A",
                    "areaM2": 10.0,
                    "boundaryMm": [{"xMm": 0, "yMm": 0}],
                },
            },
            {
                "factId": "area-eg",
                "kind": "area",
                "value": {
                    "levelId": "EG",
                    "scope": "one_half_level_subtotal",
                    "areaM2": 12.0,
                },
            },
        ],
        tolerance_m2=0.1,
    )

    assert report["summary"]["accepted"] is False
    assert report["blockers"][0]["code"] == "source_area_level_total_crosscheck"
    assert report["blockers"][0]["deltaM2"] == -2.0


def test_source_area_consistency_tolerates_disposed_level_total_mismatch() -> None:
    report = build_source_area_consistency_report(
        [
            {
                "factId": "room-a",
                "kind": "room",
                "value": {
                    "levelId": "DG",
                    "name": "A",
                    "areaM2": 10.0,
                    "boundaryMm": [{"xMm": 0, "yMm": 0}],
                },
            },
            {
                "factId": "area-dg",
                "kind": "area",
                "value": {
                    "levelId": "DG",
                    "scope": "sloped_roof_weighted_total",
                    "areaM2": 8.0,
                    "areaDisposition": {
                        "status": "tolerated",
                        "acceptedBy": "test",
                        "reason": "Source total is WoFlV weighted while room boundary is gross floor outline.",
                    },
                },
            },
        ],
        tolerance_m2=0.1,
    )

    assert report["summary"]["accepted"] is True
    assert report["checks"][0]["status"] == "tolerated"
