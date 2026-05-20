from __future__ import annotations

from bim_ai.area_reconciliation import build_area_reconciliation_report
from bim_ai.document import Document
from bim_ai.elements import RoomElem, Vec2Mm


def _pt(x: float, y: float) -> Vec2Mm:
    return Vec2Mm(xMm=x, yMm=y)


def test_area_reconciliation_matches_source_room_area_to_model_outline() -> None:
    doc = Document(
        revision=3,
        elements={
            "room-living": RoomElem(
                id="room-living",
                name="Living",
                levelId="eg",
                outlineMm=[_pt(0, 0), _pt(4000, 0), _pt(4000, 5000), _pt(0, 5000)],
            )
        },
    )

    report = build_area_reconciliation_report(
        "model-1",
        doc,
        [
            {
                "factId": "src-area-1",
                "kind": "room",
                "value": {"levelId": "eg", "name": "Living", "areaM2": 20.0},
                "provenance": {"sourceDocumentId": "doc-1", "page": 1},
            }
        ],
        tolerance_m2=0.1,
    )

    assert report["summary"]["accepted"] is True
    assert report["rows"][0]["status"] == "within_tolerance"
    assert report["rows"][0]["modelAreaM2"] == 20.0


def test_area_reconciliation_reports_mismatches_and_missing_rows() -> None:
    doc = Document(
        revision=3,
        elements={
            "room-living": RoomElem(
                id="room-living",
                name="Living",
                levelId="eg",
                outlineMm=[_pt(0, 0), _pt(4000, 0), _pt(4000, 5000), _pt(0, 5000)],
            ),
            "room-kitchen": RoomElem(
                id="room-kitchen",
                name="Kitchen",
                levelId="eg",
                outlineMm=[_pt(0, 0), _pt(3000, 0), _pt(3000, 3000), _pt(0, 3000)],
            ),
        },
    )

    report = build_area_reconciliation_report(
        "model-1",
        doc,
        [
            {
                "factId": "src-area-1",
                "kind": "room",
                "value": {"levelId": "eg", "name": "Living", "areaM2": 18.0},
            },
            {
                "factId": "src-area-2",
                "kind": "room",
                "value": {"levelId": "eg", "name": "Bath", "areaM2": 6.0},
            },
        ],
        tolerance_m2=0.1,
    )

    statuses = {row["status"] for row in report["rows"]}
    assert statuses == {"mismatch", "missing_model_room", "missing_source_area"}
    assert report["summary"]["blockingCount"] == 2
    assert report["summary"]["accepted"] is False


def test_area_reconciliation_handles_level_totals_and_ignores_parcel_areas() -> None:
    doc = Document(
        revision=3,
        elements={
            "room-a": RoomElem(
                id="room-a",
                name="Room A",
                levelId="eg",
                outlineMm=[_pt(0, 0), _pt(4000, 0), _pt(4000, 5000), _pt(0, 5000)],
            ),
            "room-b": RoomElem(
                id="room-b",
                name="Room B",
                levelId="eg",
                outlineMm=[_pt(0, 0), _pt(3000, 0), _pt(3000, 3000), _pt(0, 3000)],
            ),
        },
    )

    report = build_area_reconciliation_report(
        "model-1",
        doc,
        [
            {
                "factId": "src-total-eg",
                "kind": "area",
                "value": {"levelId": "eg", "name": "Net total EG", "areaM2": 29.0},
            },
            {
                "factId": "parcel-1",
                "kind": "parcel_boundary",
                "value": {"areaM2": 541.1},
            },
        ],
        tolerance_m2=0.1,
    )

    total_rows = [row for row in report["rows"] if row.get("factId") == "src-total-eg"]
    assert len(total_rows) == 1
    assert total_rows[0]["status"] == "within_tolerance"
    assert total_rows[0]["modelAreaM2"] == 29.0
    assert all(row.get("factId") != "parcel-1" for row in report["rows"])


def test_area_reconciliation_treats_area_scope_room_as_room_area_row() -> None:
    doc = Document(
        revision=3,
        elements={
            "room-living": RoomElem(
                id="room-living",
                name="Living",
                levelId="eg",
                outlineMm=[_pt(0, 0), _pt(4000, 0), _pt(4000, 5000), _pt(0, 5000)],
            )
        },
    )

    report = build_area_reconciliation_report(
        "model-1",
        doc,
        [
            {
                "factId": "src-area-living",
                "kind": "area",
                "value": {"scope": "room", "levelId": "eg", "name": "Living", "areaM2": 20.0},
            }
        ],
        tolerance_m2=0.1,
    )

    assert report["rows"][0]["kind"] == "room"
    assert report["rows"][0]["status"] == "within_tolerance"
