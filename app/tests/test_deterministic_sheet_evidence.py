"""Deterministic sheet evidence manifest tests (sort order, revision/issue manifest, schedule pagination — Prompt 4/6)."""

from __future__ import annotations

import hashlib
from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, RoomElem, ScheduleElem, SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_EXPORT_PDF_MIME_TYPE,
    SHEET_EXPORT_PNG_MIME_TYPE,
    SHEET_EXPORT_SVG_MIME_TYPE,
    SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    _viewport_export_correlation_segment_bytes,
    viewport_evidence_hints_v1,
)
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    SHEET_TITLEBLOCK_REVISION_ISSUE_MANIFEST_V1,
    build_sheet_titleblock_revision_issue_manifest_v1,
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


def test_sheet_titleblock_revision_issue_manifest_v1_on_row() -> None:
    sid = uuid4()
    doc = Document(
        revision=3,
        elements={
            "sh1": SheetElem(
                kind="sheet",
                id="sh1",
                name="S1",
                titleBlock="TB1",
                titleblock_parameters={
                    "revisionId": "R-001",
                    "revisionCode": "B",
                    "revisionDate": "2026-05-05",
                    "revisionDescription": "issued for review",
                    "issueStatus": "for_review",
                },
                viewportsMm=[
                    {
                        "viewportId": "vp1",
                        "viewRef": "plan:pv",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 50,
                        "heightMm": 50,
                    },
                ],
            ),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="q",
        semantic_digest_sha256="d" * 64,
        semantic_digest_prefix16="d" * 16,
    )
    assert len(rows) == 1
    raw = rows[0].get("sheetTitleblockRevisionIssueManifest_v1")
    assert isinstance(raw, dict)
    assert raw.get("format") == SHEET_TITLEBLOCK_REVISION_ISSUE_MANIFEST_V1
    assert raw.get("revisionId") == "R-001"
    assert raw.get("revisionCode") == "B"
    assert raw.get("revisionDate") == "2026-05-05"
    assert raw.get("revisionDescription") == "issued for review"
    assert raw.get("issueStatus") == "for_review"
    assert raw.get("titleblockDisplaySegment", "").startswith("sheetRevIssDoc[")
    assert "sheetRevIssList[" in str(raw.get("exportListingSegment", ""))
    sh = doc.elements["sh1"]
    assert isinstance(sh, SheetElem)
    assert raw == build_sheet_titleblock_revision_issue_manifest_v1(sh)


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


def test_sheet_export_artifact_manifest_v1_structure() -> None:
    sid = uuid4()
    doc = Document(
        revision=1,
        elements={
            "sh1": SheetElem(kind="sheet", id="sh1", name="S1"),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    assert len(rows) == 1
    mf = rows[0].get("sheetExportArtifactManifest_v1")
    assert isinstance(mf, dict)
    assert mf["format"] == "sheetExportArtifactManifest_v1"
    assert mf["sheetId"] == "sh1"
    artifacts = mf["artifacts"]
    assert isinstance(artifacts, list) and len(artifacts) == 3
    by_name = {a["artifactName"]: a for a in artifacts}
    assert "sheet-preview.svg" in by_name
    assert "sheet-preview.pdf" in by_name
    assert "sheet-print-raster.png" in by_name


def test_sheet_export_artifact_manifest_v1_mime_types() -> None:
    sid = uuid4()
    doc = Document(revision=1, elements={"sh1": SheetElem(kind="sheet", id="sh1", name="S1")})
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="b" * 64,
        semantic_digest_prefix16="b" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    assert by_name["sheet-preview.svg"]["mimeType"] == SHEET_EXPORT_SVG_MIME_TYPE
    assert by_name["sheet-preview.pdf"]["mimeType"] == SHEET_EXPORT_PDF_MIME_TYPE
    assert by_name["sheet-print-raster.png"]["mimeType"] == SHEET_EXPORT_PNG_MIME_TYPE


def test_sheet_export_artifact_manifest_v1_png_surrogate_and_fallback_token() -> None:
    sid = uuid4()
    doc = Document(revision=1, elements={"sh1": SheetElem(kind="sheet", id="sh1", name="S1")})
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="c" * 64,
        semantic_digest_prefix16="c" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    png_entry = by_name["sheet-print-raster.png"]
    assert png_entry["surrogateContract"] == SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
    assert png_entry["fullRasterExportStatus"] == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert png_entry["fullRasterExportStatus"] == "unsupported_full_raster_renderer_unavailable"
    assert isinstance(png_entry["digestSha256"], str) and len(png_entry["digestSha256"]) == 64


def test_sheet_export_artifact_manifest_v1_svg_digest_matches_svg_href_sha() -> None:
    sid = uuid4()
    sh = SheetElem(kind="sheet", id="sh1", name="S1")
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="d" * 64,
        semantic_digest_prefix16="d" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    svg_digest = by_name["sheet-preview.svg"]["digestSha256"]
    assert isinstance(svg_digest, str) and len(svg_digest) == 64
    ci_corr = mf["ciBaselineCorrelation"]
    assert ci_corr["format"] == "sheetExportCiBaselineCorrelation_v1"
    assert ci_corr["sheetId"] == "sh1"
    assert ci_corr["svgDigestSha256"] == svg_digest
    assert ci_corr["pngDigestSha256"] == by_name["sheet-print-raster.png"]["digestSha256"]
    assert (
        isinstance(ci_corr["exportListingDigestSha256"], str)
        and len(ci_corr["exportListingDigestSha256"]) == 64
    )


def test_sheet_export_artifact_manifest_v1_parity_token() -> None:
    sid = uuid4()
    doc = Document(revision=1, elements={"sh1": SheetElem(kind="sheet", id="sh1", name="S1")})
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="e" * 64,
        semantic_digest_prefix16="e" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    assert mf["exportListingParityToken"] == SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN
    assert mf["exportListingParityToken"] == "svgPdfListingParity_v1"


def test_sheet_export_artifact_manifest_v1_relative_paths() -> None:
    sid = uuid4()
    doc = Document(revision=1, elements={"sh1": SheetElem(kind="sheet", id="sh1", name="S1")})
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="f" * 64,
        semantic_digest_prefix16="f" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    assert by_name["sheet-preview.svg"]["relativeArtifactPath"] == "exports/sheet-preview.svg"
    assert by_name["sheet-preview.pdf"]["relativeArtifactPath"] == "exports/sheet-preview.pdf"
    assert (
        by_name["sheet-print-raster.png"]["relativeArtifactPath"]
        == "exports/sheet-print-raster.png"
    )
