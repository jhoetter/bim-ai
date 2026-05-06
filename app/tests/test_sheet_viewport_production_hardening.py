"""Sheet viewport production hardening tests (Prompt 8 — WP-E05, WP-E06, WP-A02)."""

from __future__ import annotations

from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, ScheduleElem, SectionCutElem, SheetElem
from bim_ai.evidence_manifest import (
    deterministic_sheet_evidence_manifest,
    sheetProductionEvidenceBaseline_v1,
)
from bim_ai.sheet_preview_svg import (
    sheet_elem_to_svg,
    sheetExportSegmentCompleteness_v1,
    sheetViewportProductionManifest_v1,
    viewport_production_metadata_v1,
)
from bim_ai.sheet_titleblock_revision_issue_v1 import titleblockFieldCompleteness_v1

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _minimal_sheet(**kwargs: object) -> SheetElem:
    return SheetElem(kind="sheet", id="sx", name="Sheet X", **kwargs)  # type: ignore[arg-type]


def _make_doc(**elements: object) -> Document:
    return Document(revision=1, elements=dict(elements))  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# viewport_production_metadata_v1
# ---------------------------------------------------------------------------


def test_viewport_production_metadata_plan_type() -> None:
    doc = _make_doc(
        pv1=PlanViewElem(kind="plan_view", id="pv1", name="Ground Floor Plan", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    vp = {
        "viewportId": "vp-a",
        "viewRef": "plan:pv1",
        "xMm": 100,
        "yMm": 200,
        "widthMm": 5000,
        "heightMm": 4000,
    }
    meta = viewport_production_metadata_v1(doc, vp, 0, "sheet1")
    assert meta["format"] == "viewportProductionMetadata_v1"
    assert meta["viewportId"] == "vp-a"
    assert meta["viewType"] == "plan"
    assert meta["viewName"] == "Ground Floor Plan"
    assert meta["sheetId"] == "sheet1"
    assert meta["cropBoundsMm"] is None
    assert meta["isClipped"] is False


def test_viewport_production_metadata_section_type() -> None:
    doc = _make_doc(
        sc1=SectionCutElem(
            kind="section_cut",
            id="sc1",
            name="Section A",
            lineStartMm={"xMm": 0, "yMm": 0},
            lineEndMm={"xMm": 10000, "yMm": 0},
        ),
    )
    vp = {
        "viewportId": "vp-b",
        "viewRef": "section:sc1",
        "xMm": 0,
        "yMm": 0,
        "widthMm": 3000,
        "heightMm": 2000,
    }
    meta = viewport_production_metadata_v1(doc, vp, 0, "sheet1")
    assert meta["viewType"] == "section"
    assert meta["viewName"] == "Section A"


def test_viewport_production_metadata_schedule_type() -> None:
    doc = _make_doc(
        sched1=ScheduleElem(kind="schedule", id="sched1", name="Door Schedule"),
    )
    vp = {
        "viewportId": "vp-c",
        "viewRef": "schedule:sched1",
        "xMm": 0,
        "yMm": 0,
        "widthMm": 4000,
        "heightMm": 3000,
    }
    meta = viewport_production_metadata_v1(doc, vp, 0, "sheet1")
    assert meta["viewType"] == "schedule"
    assert meta["viewName"] == "Door Schedule"


def test_viewport_production_metadata_with_crop_bounds() -> None:
    doc = _make_doc()
    vp = {
        "viewportId": "vp-crop",
        "viewRef": "plan:pv1",
        "xMm": 0,
        "yMm": 0,
        "widthMm": 5000,
        "heightMm": 4000,
        "cropMinMm": {"xMm": 0.0, "yMm": 0.0},
        "cropMaxMm": {"xMm": 10000.0, "yMm": 8000.0},
    }
    meta = viewport_production_metadata_v1(doc, vp, 0, "sheet1")
    assert meta["cropBoundsMm"] is not None
    assert meta["cropBoundsMm"]["xMinMm"] == 0.0
    assert meta["cropBoundsMm"]["xMaxMm"] == 10000.0
    assert meta["scaleFactor"] is not None
    assert meta["isClipped"] is True


def test_viewport_production_metadata_implicit_id() -> None:
    doc = _make_doc()
    vp = {"viewRef": "plan:pv1", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}
    meta = viewport_production_metadata_v1(doc, vp, 3, "sheet1")
    assert meta["viewportId"] == "__implicit_3"


# ---------------------------------------------------------------------------
# sheetViewportProductionManifest_v1
# ---------------------------------------------------------------------------


def test_sheet_viewport_production_manifest_sorted_and_digested() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp-z",
                    "viewRef": "plan:pv1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 1000,
                    "heightMm": 1000,
                },
                {
                    "viewportId": "vp-a",
                    "viewRef": "plan:pv1",
                    "xMm": 100,
                    "yMm": 100,
                    "widthMm": 1000,
                    "heightMm": 1000,
                },
            ],
        ),
        pv1=PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    manifest = sheetViewportProductionManifest_v1(doc, "sx")
    assert manifest["format"] == "sheetViewportProductionManifest_v1"
    assert manifest["sheetId"] == "sx"
    assert manifest["viewportCount"] == 2
    vp_ids = [v["viewportId"] for v in manifest["viewports"]]
    assert vp_ids == sorted(vp_ids), "viewports should be sorted by viewportId"
    assert len(manifest["manifestDigestSha256"]) == 64


def test_sheet_viewport_production_manifest_digest_stable() -> None:
    sh = SheetElem(
        kind="sheet",
        id="sx",
        name="S",
        viewportsMm=[
            {
                "viewportId": "vp1",
                "viewRef": "plan:pv",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 2000,
                "heightMm": 1000,
            },
        ],
    )
    doc = _make_doc(
        sx=sh,
        pv=PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    m1 = sheetViewportProductionManifest_v1(doc, "sx")
    m2 = sheetViewportProductionManifest_v1(doc, "sx")
    assert m1["manifestDigestSha256"] == m2["manifestDigestSha256"]


def test_sheet_viewport_production_manifest_digest_changes_on_different_viewports() -> None:
    doc_a = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {"viewportId": "vp1", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}
            ],
        ),
    )
    doc_b = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {"viewportId": "vp2", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}
            ],
        ),
    )
    da = sheetViewportProductionManifest_v1(doc_a, "sx")
    db = sheetViewportProductionManifest_v1(doc_b, "sx")
    assert da["manifestDigestSha256"] != db["manifestDigestSha256"]


# ---------------------------------------------------------------------------
# sheetExportSegmentCompleteness_v1 — SVG segment tokens
# ---------------------------------------------------------------------------


def test_segment_completeness_plan_viewport_with_primitives() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "viewRef": "plan:pv1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 5000,
                    "heightMm": 4000,
                }
            ],
        ),
        pv1=PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    result = sheetExportSegmentCompleteness_v1(doc, "sx")
    assert result["format"] == "sheetExportSegmentCompleteness_v1"
    assert result["sheetId"] == "sx"
    assert result["viewportCount"] == 1


def test_segment_completeness_schedule_viewport() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp-sched",
                    "viewRef": "schedule:sched1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 4000,
                    "heightMm": 3000,
                }
            ],
        ),
        sched1=ScheduleElem(kind="schedule", id="sched1", name="Door Schedule"),
    )
    result = sheetExportSegmentCompleteness_v1(doc, "sx")
    vp_row = result["viewports"][0]
    assert vp_row["viewportId"] == "vp-sched"
    assert isinstance(vp_row["segmentTokens"], list)
    assert isinstance(vp_row["missingTokens"], list)


def test_segment_completeness_missing_tokens_generate_advisor_entries() -> None:
    # A section viewport with no levels in the doc → secDoc segment is empty → missing token
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp-sec",
                    "viewRef": "section:sc1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 2000,
                    "heightMm": 1500,
                }
            ],
        ),
        sc1=SectionCutElem(
            kind="section_cut",
            id="sc1",
            name="S1",
            lineStartMm={"xMm": 0, "yMm": 0},
            lineEndMm={"xMm": 10000, "yMm": 0},
        ),
        # No LevelElem → level markers list is empty → secDoc returns ""
    )
    result = sheetExportSegmentCompleteness_v1(doc, "sx")
    vp_row = result["viewports"][0]
    assert "secDoc" in vp_row["missingTokens"]
    advisors = result["advisorEntries"]
    assert len(advisors) > 0
    assert all(e["severity"] == "info" for e in advisors)
    assert all(e["viewportId"] == "vp-sec" for e in advisors)


def test_segment_completeness_completeness_percent_full() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[],
        ),
    )
    result = sheetExportSegmentCompleteness_v1(doc, "sx")
    assert result["completenessPercent"] == 100.0
    assert result["viewportCount"] == 0


def test_segment_completeness_sorted_viewports() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp-z",
                    "viewRef": "plan:pv1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 1000,
                    "heightMm": 1000,
                },
                {
                    "viewportId": "vp-a",
                    "viewRef": "plan:pv1",
                    "xMm": 100,
                    "yMm": 100,
                    "widthMm": 1000,
                    "heightMm": 1000,
                },
            ],
        ),
        pv1=PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    result = sheetExportSegmentCompleteness_v1(doc, "sx")
    ids = [r["viewportId"] for r in result["viewports"]]
    assert ids == sorted(ids)


# ---------------------------------------------------------------------------
# SVG export — segment tokens present in SVG output
# ---------------------------------------------------------------------------


def test_svg_contains_plan_prim_token_for_plan_viewport() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp1",
                    "viewRef": "plan:pv1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 5000,
                    "heightMm": 4000,
                }
            ],
        ),
        pv1=PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    sh = doc.elements["sx"]
    assert isinstance(sh, SheetElem)
    svg = sheet_elem_to_svg(doc, sh)
    assert "planPrim[" in svg


def test_svg_contains_sch_doc_token_for_schedule_viewport() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {
                    "viewportId": "vp1",
                    "viewRef": "schedule:sched1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 4000,
                    "heightMm": 3000,
                }
            ],
        ),
        sched1=ScheduleElem(kind="schedule", id="sched1", name="Door Schedule"),
    )
    sh = doc.elements["sx"]
    assert isinstance(sh, SheetElem)
    svg = sheet_elem_to_svg(doc, sh)
    assert "schDoc[" in svg


# ---------------------------------------------------------------------------
# titleblockFieldCompleteness_v1
# ---------------------------------------------------------------------------


def test_titleblock_field_completeness_full() -> None:
    sh = SheetElem(
        kind="sheet",
        id="sx",
        name="Ground Floor Plan",
        titleblockParameters={
            "projectName": "Acme Tower",
            "projectNumber": "ACM-001",
            "sheetNumber": "A-101",
            "drawnBy": "JH",
            "checkedBy": "KR",
            "issueDate": "2026-05-05",
            "revisionCode": "C",
        },
    )
    result = titleblockFieldCompleteness_v1(sh)
    assert result["format"] == "titleblockFieldCompleteness_v1"
    assert result["sheetId"] == "sx"
    assert result["coveragePercent"] == 100.0
    assert result["populatedCount"] == result["totalCount"]


def test_titleblock_field_completeness_partial() -> None:
    sh = SheetElem(
        kind="sheet",
        id="sx",
        name="Sheet A",
        titleblockParameters={"projectName": "My Project"},
    )
    result = titleblockFieldCompleteness_v1(sh)
    assert result["coveragePercent"] < 100.0
    populated = [f for f in result["fields"] if f["populated"]]
    assert any(f["field"] == "projectName" for f in populated)
    assert any(f["field"] == "sheetName" for f in populated)


def test_titleblock_field_completeness_empty() -> None:
    sh = SheetElem(kind="sheet", id="sx", name="")
    result = titleblockFieldCompleteness_v1(sh)
    assert result["populatedCount"] == 0
    assert result["coveragePercent"] == 0.0


def test_titleblock_field_completeness_sheet_name_from_elem_name() -> None:
    sh = SheetElem(kind="sheet", id="sx", name="Level 1 Plan")
    result = titleblockFieldCompleteness_v1(sh)
    sn_field = next(f for f in result["fields"] if f["field"] == "sheetName")
    assert sn_field["populated"] is True
    assert sn_field["value"] == "Level 1 Plan"


def test_titleblock_field_completeness_all_expected_fields_present() -> None:
    sh = SheetElem(kind="sheet", id="sx", name="S")
    result = titleblockFieldCompleteness_v1(sh)
    field_names = [f["field"] for f in result["fields"]]
    for expected in (
        "projectName",
        "projectNumber",
        "sheetName",
        "sheetNumber",
        "drawnBy",
        "checkedBy",
        "date",
        "revision",
    ):
        assert expected in field_names


# ---------------------------------------------------------------------------
# sheetProductionEvidenceBaseline_v1
# ---------------------------------------------------------------------------


def test_sheet_production_evidence_baseline_has_all_sheets() -> None:
    doc = _make_doc(
        sx1=SheetElem(kind="sheet", id="sx1", name="Sheet 1"),
        sx2=SheetElem(kind="sheet", id="sx2", name="Sheet 2"),
    )
    result = sheetProductionEvidenceBaseline_v1(doc)
    assert result["format"] == "sheetProductionEvidenceBaseline_v1"
    assert result["sheetCount"] == 2
    ids = [r["sheetId"] for r in result["sheets"]]
    assert ids == sorted(ids)


def test_sheet_production_evidence_baseline_viewport_count() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {"viewportId": "v1", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000},
                {"viewportId": "v2", "xMm": 100, "yMm": 100, "widthMm": 1000, "heightMm": 1000},
            ],
        ),
    )
    result = sheetProductionEvidenceBaseline_v1(doc)
    row = result["sheets"][0]
    assert row["viewportCount"] == 2


def test_sheet_production_evidence_baseline_titleblock_coverage() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            titleblockParameters={"projectName": "P", "sheetNumber": "A-101"},
        ),
    )
    result = sheetProductionEvidenceBaseline_v1(doc)
    row = result["sheets"][0]
    assert 0 < row["titleblockCoveragePercent"] <= 100.0


def test_sheet_production_evidence_baseline_manifest_digest_stable() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            viewportsMm=[
                {"viewportId": "v1", "xMm": 0, "yMm": 0, "widthMm": 1000, "heightMm": 1000}
            ],
        ),
    )
    b1 = sheetProductionEvidenceBaseline_v1(doc)
    b2 = sheetProductionEvidenceBaseline_v1(doc)
    assert b1["sheets"][0]["manifestDigestSha256"] == b2["sheets"][0]["manifestDigestSha256"]


def test_sheet_production_evidence_baseline_empty_doc() -> None:
    doc = _make_doc()
    result = sheetProductionEvidenceBaseline_v1(doc)
    assert result["sheetCount"] == 0
    assert result["sheets"] == []


def test_sheet_production_evidence_baseline_revision_issue_count() -> None:
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="S",
            titleblockParameters={"revisionCode": "B", "revisionDate": "2026-05-01"},
        ),
    )
    result = sheetProductionEvidenceBaseline_v1(doc)
    row = result["sheets"][0]
    assert row["revisionIssueFieldCount"] >= 1


# ---------------------------------------------------------------------------
# Integration: deterministic_sheet_evidence_manifest includes production hardening
# ---------------------------------------------------------------------------


def test_deterministic_sheet_evidence_manifest_has_production_keys() -> None:
    mid = uuid4()
    doc = _make_doc(
        sx=SheetElem(
            kind="sheet",
            id="sx",
            name="Sheet 1",
            viewportsMm=[
                {
                    "viewportId": "vp1",
                    "viewRef": "plan:pv1",
                    "xMm": 0,
                    "yMm": 0,
                    "widthMm": 5000,
                    "heightMm": 4000,
                },
            ],
            titleblockParameters={"projectName": "Test Project", "sheetNumber": "A-101"},
        ),
        pv1=PlanViewElem(kind="plan_view", id="pv1", name="Ground Floor", levelId="lvl"),
        lvl=LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=mid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    assert len(rows) == 1
    row = rows[0]
    # Standard keys still present
    assert "sheetTitleblockRevisionIssueManifest_v1" in row
    assert "sheetExportArtifactManifest_v1" in row
