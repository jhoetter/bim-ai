"""Wave-3 Prompt-3 (re-run) — schedule sheet export parity evidence + advisories."""

from __future__ import annotations

from typing import Any

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.schedule_sheet_export_parity import (
    FORMAT_V1,
    PARITY_ALIGNED,
    PARITY_PLACEMENT_MISSING,
    build_schedule_sheet_export_parity_evidence_v1_for_sheet,
    collect_schedule_sheet_export_parity_rows_for_doc,
)


def _square_room(rid: str, name: str = "") -> RoomElem:
    return RoomElem(
        kind="room",
        id=rid,
        name=name or rid,
        levelId="lvl",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 2000, "yMm": 0},
            {"xMm": 2000, "yMm": 2000},
            {"xMm": 0, "yMm": 2000},
        ],
    )


def _doc_with_placed_schedule(*, n_rooms: int = 3, height_mm: float = 8000.0) -> Document:
    elems: dict[str, Any] = {
        "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    }
    for i in range(n_rooms):
        elems[f"rm-{i}"] = _square_room(f"rm-{i}", f"R{i}")
    elems["sh-1"] = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-sch",
                "viewRef": "schedule:sch-1",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 5000,
                "heightMm": height_mm,
            },
        ],
    )
    elems["sch-1"] = ScheduleElem(
        kind="schedule",
        id="sch-1",
        name="Rooms",
        sheetId="sh-1",
        filters={"category": "room"},
    )
    return Document(revision=1, elements=elems)


def test_parity_evidence_embedded_on_schedule_table_payload_aligned() -> None:
    doc = _doc_with_placed_schedule(n_rooms=3)
    payload = derive_schedule_table(doc, "sch-1")
    ev = payload.get("scheduleSheetExportParityEvidence_v1")
    assert isinstance(ev, dict)
    assert ev.get("format") == FORMAT_V1
    rows = ev.get("rows") or []
    assert len(rows) == 1
    row = rows[0]
    assert row["scheduleId"] == "sch-1"
    assert row["sheetId"] == "sh-1"
    assert row["viewportId"] == "vp-sch"
    assert row["jsonRowCount"] == 3
    assert row["csvRowCount"] == 3
    assert row["svgListingRowCount"] == 3
    assert row["paginationSegmentCount"] == 1
    assert row["crossFormatParityToken"] == PARITY_ALIGNED
    assert isinstance(ev.get("scheduleSheetExportParityDigestSha256"), str)
    assert len(ev["scheduleSheetExportParityDigestSha256"]) == 64


def test_parity_evidence_unplaced_schedule_emits_no_row_in_table_payload() -> None:
    elems: dict[str, Any] = {
        "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
        "rm-1": _square_room("rm-1"),
        "sch-1": ScheduleElem(
            kind="schedule",
            id="sch-1",
            name="Rooms",
            filters={"category": "room"},
        ),
    }
    doc = Document(revision=1, elements=elems)
    payload = derive_schedule_table(doc, "sch-1")
    ev = payload.get("scheduleSheetExportParityEvidence_v1")
    assert isinstance(ev, dict)
    assert ev.get("rows") == []


def test_parity_evidence_placement_missing_when_sheet_lacks_viewport() -> None:
    elems: dict[str, Any] = {
        "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
        "rm-1": _square_room("rm-1"),
        "sh-1": SheetElem(kind="sheet", id="sh-1", name="S1", viewportsMm=[]),
        "sch-1": ScheduleElem(
            kind="schedule",
            id="sch-1",
            name="Rooms",
            sheetId="sh-1",
            filters={"category": "room"},
        ),
    }
    doc = Document(revision=1, elements=elems)
    payload = derive_schedule_table(doc, "sch-1")
    ev = payload.get("scheduleSheetExportParityEvidence_v1")
    assert isinstance(ev, dict)
    rows = ev.get("rows") or []
    assert len(rows) == 1
    row = rows[0]
    assert row["crossFormatParityToken"] == PARITY_PLACEMENT_MISSING
    assert row["svgListingRowCount"] == 0


def test_parity_evidence_per_sheet_manifest_embed() -> None:
    from uuid import uuid4

    doc = _doc_with_placed_schedule(n_rooms=4)
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="evidence",
        semantic_digest_sha256="0" * 64,
        semantic_digest_prefix16="0" * 16,
    )
    assert len(rows) == 1
    sheet_row = rows[0]
    parity = sheet_row.get("scheduleSheetExportParityEvidence_v1")
    assert isinstance(parity, dict)
    assert parity["format"] == FORMAT_V1
    assert parity["sheetId"] == "sh-1"
    parity_rows = parity["rows"]
    assert len(parity_rows) == 1
    assert parity_rows[0]["scheduleId"] == "sch-1"
    assert parity_rows[0]["jsonRowCount"] == 4
    assert parity_rows[0]["csvRowCount"] == 4
    assert parity_rows[0]["crossFormatParityToken"] == PARITY_ALIGNED


def test_parity_evidence_for_sheet_helper_sorts_rows_deterministically() -> None:
    elems: dict[str, Any] = {
        "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
        "rm-1": _square_room("rm-1"),
    }
    elems["sh-1"] = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-b",
                "viewRef": "schedule:sch-b",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 5000,
                "heightMm": 8000,
            },
            {
                "viewportId": "vp-a",
                "viewRef": "schedule:sch-a",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 5000,
                "heightMm": 8000,
            },
        ],
    )
    elems["sch-a"] = ScheduleElem(
        kind="schedule",
        id="sch-a",
        name="A",
        sheetId="sh-1",
        filters={"category": "room"},
    )
    elems["sch-b"] = ScheduleElem(
        kind="schedule",
        id="sch-b",
        name="B",
        sheetId="sh-1",
        filters={"category": "room"},
    )
    doc = Document(revision=1, elements=elems)
    payload = build_schedule_sheet_export_parity_evidence_v1_for_sheet(doc, doc.elements["sh-1"])  # type: ignore[arg-type]
    ids = [r["scheduleId"] for r in payload["rows"]]
    assert ids == sorted(ids)


def test_collect_doc_rows_excludes_unplaced_schedules() -> None:
    elems: dict[str, Any] = {
        "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
        "rm-1": _square_room("rm-1"),
        "sch-placed": ScheduleElem(
            kind="schedule",
            id="sch-placed",
            name="P",
            sheetId="sh-1",
            filters={"category": "room"},
        ),
        "sch-unplaced": ScheduleElem(
            kind="schedule",
            id="sch-unplaced",
            name="U",
            filters={"category": "room"},
        ),
        "sh-1": SheetElem(
            kind="sheet",
            id="sh-1",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp",
                    "viewRef": "schedule:sch-placed",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 5000,
                    "heightMm": 8000,
                },
            ],
        ),
    }
    doc = Document(revision=1, elements=elems)
    rows = collect_schedule_sheet_export_parity_rows_for_doc(doc)
    sched_ids = sorted(r["scheduleId"] for r in rows)
    assert sched_ids == ["sch-placed"]


def test_advisor_does_not_fire_when_parity_aligned() -> None:
    doc = _doc_with_placed_schedule(n_rooms=2)
    viols = evaluate(doc.elements)
    rule_ids = {v.rule_id for v in viols}
    assert "schedule_sheet_export_parity_csv_diverges" not in rule_ids
    assert "schedule_sheet_export_parity_json_diverges" not in rule_ids
    assert "schedule_sheet_export_parity_listing_diverges" not in rule_ids


def test_digest_is_deterministic_for_same_doc() -> None:
    doc1 = _doc_with_placed_schedule(n_rooms=3)
    doc2 = _doc_with_placed_schedule(n_rooms=3)
    p1 = derive_schedule_table(doc1, "sch-1")
    p2 = derive_schedule_table(doc2, "sch-1")
    d1 = p1["scheduleSheetExportParityEvidence_v1"]["scheduleSheetExportParityDigestSha256"]
    d2 = p2["scheduleSheetExportParityEvidence_v1"]["scheduleSheetExportParityDigestSha256"]
    assert d1 == d2


def test_advisor_fires_listing_diverges_when_listing_row_count_mismatched(
    monkeypatch,
) -> None:
    """Forcing a divergence by patching the per-payload listing formatter."""
    import bim_ai.schedule_sheet_export_parity as parity_mod

    real_classify = parity_mod._classify_parity

    def fake_classify(**kwargs: Any) -> str:  # type: ignore[no-untyped-def]
        token = real_classify(**kwargs)
        if token == PARITY_ALIGNED:
            return parity_mod.PARITY_LISTING_DIVERGES
        return token

    monkeypatch.setattr(parity_mod, "_classify_parity", fake_classify)

    doc = _doc_with_placed_schedule(n_rooms=2)
    viols = evaluate(doc.elements)
    rule_ids = {v.rule_id for v in viols}
    assert "schedule_sheet_export_parity_listing_diverges" in rule_ids
