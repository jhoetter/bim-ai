"""Deterministic sheet evidence manifest tests (sort order, schedule pagination hints — Prompt 6)."""

from __future__ import annotations

import hashlib
from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoomElem, ScheduleElem, SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.sheet_preview_svg import (
    _viewport_export_correlation_segment_bytes,
    viewport_evidence_hints_v1,
)


def test_deterministic_sheet_evidence_sorted_by_sheet_id() -> None:
    sid = uuid4()
    doc = Document(
        revision=1,
        elements={
            "z-sh": SheetElem(kind="sheet", id="z-sh", name="Z"),
            "a-sh": SheetElem(kind="sheet", id="a-sh", name="A"),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="c" * 64,
        semantic_digest_prefix16="c" * 16,
    )
    assert [r["sheetId"] for r in rows] == ["a-sh", "z-sh"]


def test_deterministic_sheet_evidence_schedule_pagination_on_viewport_hints() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(
        revision=2,
        elements={
            "lvl": lvl,
            "rm-1": RoomElem(
                kind="room",
                id="rm-1",
                name="A",
                levelId="lvl",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
            "sh-1": SheetElem(
                kind="sheet",
                id="sh-1",
                name="S1",
                viewportsMm=[
                    {
                        "viewportId": "vp-sch",
                        "viewRef": "schedule:sch-1",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 4000,
                        "heightMm": 90,
                    },
                ],
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Rooms",
                sheetId="sh-1",
                filters={"category": "room"},
            ),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="spag",
        semantic_digest_sha256="d" * 64,
        semantic_digest_prefix16="d" * 16,
    )
    assert len(rows) == 1
    hints = rows[0].get("viewportEvidenceHints_v0") or []
    assert len(hints) == 1
    h0 = hints[0]
    assert h0["viewportId"] == "vp-sch"
    pag = h0.get("schedulePaginationPlacementEvidence_v0")
    assert isinstance(pag, dict)
    assert pag.get("format") == "schedulePaginationPlacementEvidence_v0"
    assert pag.get("sheetViewportId") == "vp-sch"
    assert pag.get("placementStatus") == "placed"
    assert isinstance(pag.get("digestSha256"), str) and len(pag.get("digestSha256") or "") == 64


def test_viewport_correlation_bytes_include_schedule_pagination_digest() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door"},
            ),
            "sh-x": SheetElem(
                kind="sheet",
                id="sh-x",
                name="SX",
                viewportsMm=[
                    {
                        "viewportId": "v1",
                        "viewRef": "schedule:sch-1",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 100,
                        "heightMm": 80,
                    },
                ],
            ),
        },
    )
    sh = doc.elements["sh-x"]
    assert isinstance(sh, SheetElem)
    hints = viewport_evidence_hints_v1(doc, list(sh.viewports_mm or []))
    assert len(hints) == 1
    b0 = _viewport_export_correlation_segment_bytes(hints[0])
    d0 = hashlib.sha256(b0).hexdigest()
    pag = hints[0].get("schedulePaginationPlacementEvidence_v0")
    assert isinstance(pag, dict)
    digest = str(pag.get("digestSha256") or "")
    assert digest.encode("utf-8") in b0
    alt = dict(hints[0])
    alt_pag = dict(pag)
    alt_pag["digestSha256"] = digest[:-1] + ("0" if digest[-1] != "0" else "1")
    alt["schedulePaginationPlacementEvidence_v0"] = alt_pag
    b1 = _viewport_export_correlation_segment_bytes(alt)
    assert hashlib.sha256(b1).hexdigest() != d0
