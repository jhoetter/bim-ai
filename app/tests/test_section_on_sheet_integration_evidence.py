"""Section-on-sheet integration evidence tests (WP-E03/E04/E05/E06/V01 — wave 3 prompt 2)."""

from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import LevelElem, SectionCutElem, SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.section_on_sheet_integration_evidence_v1 import (
    SECTION_ON_SHEET_INTEGRATION_EVIDENCE_V1,
    build_section_on_sheet_integration_evidence_v1,
    section_cut_line_present,
    section_profile_token_from_primitives,
)


def _minimal_doc_with_section_on_sheet(
    *,
    rev_id: str = "",
    rev_code: str = "",
    degenerate_cut: bool = False,
) -> tuple[Document, SheetElem]:
    x1 = 0.0 if degenerate_cut else 10_000.0
    y1 = 0.0
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="Section A",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": x1, "yMm": y1},
        cropDepthMm=3000.0,
    )
    tb: dict[str, str] = {}
    if rev_id:
        tb["revisionId"] = rev_id
    if rev_code:
        tb["revisionCode"] = rev_code
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet 1",
        titleBlock="A1",
        **({"titleblockParameters": tb} if tb else {}),
        viewportsMm=[
            {
                "viewportId": "vp-sec",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 200,
                "heightMm": 150,
            }
        ],
    )
    doc = Document(
        revision=1,
        elements={"lvl-1": lvl, "sec-1": sec, "sh-1": sh},
    )
    return doc, sh


# ---------------------------------------------------------------------------
# section_cut_line_present
# ---------------------------------------------------------------------------


def test_cut_line_present_non_degenerate() -> None:
    _, sh = _minimal_doc_with_section_on_sheet()
    doc, sh = _minimal_doc_with_section_on_sheet()
    sec = doc.elements["sec-1"]
    assert isinstance(sec, SectionCutElem)
    assert section_cut_line_present(sec) is True


def test_cut_line_present_degenerate() -> None:
    doc, _sh = _minimal_doc_with_section_on_sheet(degenerate_cut=True)
    sec = doc.elements["sec-1"]
    assert isinstance(sec, SectionCutElem)
    assert section_cut_line_present(sec) is False


# ---------------------------------------------------------------------------
# section_profile_token_from_primitives
# ---------------------------------------------------------------------------


def test_profile_token_no_geometry_returns_sentinel() -> None:
    token = section_profile_token_from_primitives({})
    assert token == "noGeometry_v1"


def test_profile_token_from_geometry_extent() -> None:
    prim = {"sectionGeometryExtentMm": {"uMinMm": 0, "uMaxMm": 5000}}
    token = section_profile_token_from_primitives(prim)
    assert token == "geometryExtentChord_v1"


def test_profile_token_from_level_markers() -> None:
    prim = {"levelMarkers": [{"id": "lvl-1", "elevationMm": 0}]}
    token = section_profile_token_from_primitives(prim)
    assert token == "levelMarkerChord_v1"


def test_profile_token_from_roof_witness() -> None:
    prim = {
        "roofs": [
            {
                "roofSectionCutWitness_v0": {
                    "sectionProfileToken_v0": "gableLayeredPrismChord_v1",
                }
            }
        ]
    }
    token = section_profile_token_from_primitives(prim)
    assert token == "gableLayeredPrismChord_v1"


def test_profile_token_roof_takes_priority_over_geometry_extent() -> None:
    prim = {
        "sectionGeometryExtentMm": {"uMinMm": 0, "uMaxMm": 5000},
        "roofs": [
            {
                "roofSectionCutWitness_v0": {
                    "sectionProfileToken_v0": "footprintChord_skipLayeredPrism_v1",
                }
            }
        ],
    }
    token = section_profile_token_from_primitives(prim)
    assert token == "footprintChord_skipLayeredPrism_v1"


# ---------------------------------------------------------------------------
# build_section_on_sheet_integration_evidence_v1
# ---------------------------------------------------------------------------


def test_integration_evidence_format_field() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    assert ev["format"] == SECTION_ON_SHEET_INTEGRATION_EVIDENCE_V1


def test_integration_evidence_sheet_id() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    assert ev["sheetId"] == "sh-1"


def test_integration_evidence_has_one_row_for_section_viewport() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    assert len(ev["rows"]) == 1


def test_integration_evidence_row_fields() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    row = ev["rows"][0]
    assert row["sheetId"] == "sh-1"
    assert row["viewportId"] == "vp-sec"
    assert row["sectionViewId"] == "sec-1"
    assert isinstance(row["cutLineDigestSha256"], str)
    assert len(row["cutLineDigestSha256"]) == 64
    assert isinstance(row["sectionProfileToken"], str)
    assert "sectionOnSheetIntegrationDigestSha256" in ev


def test_integration_evidence_cut_line_digest_is_deterministic() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev1 = build_section_on_sheet_integration_evidence_v1(doc, sh)
    ev2 = build_section_on_sheet_integration_evidence_v1(doc, sh)
    assert ev1["rows"][0]["cutLineDigestSha256"] == ev2["rows"][0]["cutLineDigestSha256"]


def test_integration_evidence_degenerate_cut_sets_null_digest() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet(degenerate_cut=True)
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    row = ev["rows"][0]
    assert row["cutLinePresent"] is False
    assert row["cutLineDigestSha256"] is None


def test_integration_evidence_sheet_digest_is_64_hex_chars() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    d = ev["sectionOnSheetIntegrationDigestSha256"]
    assert isinstance(d, str) and len(d) == 64


def test_integration_evidence_digest_changes_when_section_changes() -> None:
    doc_a, sh_a = _minimal_doc_with_section_on_sheet()
    ev_a = build_section_on_sheet_integration_evidence_v1(doc_a, sh_a)

    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec_b = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="Section B",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 20_000.0, "yMm": 0.0},
        cropDepthMm=3000.0,
    )
    sh_b = SheetElem(
        kind="sheet",
        id="sh-1",
        name="Sheet 1",
        titleBlock="A1",
        viewportsMm=[
            {
                "viewportId": "vp-sec",
                "viewRef": "section:sec-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 200,
                "heightMm": 150,
            }
        ],
    )
    doc_b = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec_b, "sh-1": sh_b})
    ev_b = build_section_on_sheet_integration_evidence_v1(doc_b, sh_b)

    assert ev_a["rows"][0]["cutLineDigestSha256"] != ev_b["rows"][0]["cutLineDigestSha256"]
    assert ev_a["sectionOnSheetIntegrationDigestSha256"] != ev_b["sectionOnSheetIntegrationDigestSha256"]


def test_integration_evidence_no_section_viewports_gives_empty_rows() -> None:
    sh = SheetElem(
        kind="sheet",
        id="sh-empty",
        name="Empty",
        viewportsMm=[],
    )
    doc = Document(revision=1, elements={"sh-empty": sh})
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    assert ev["rows"] == []


def test_integration_evidence_only_section_viewports_included() -> None:
    """Plan viewports must not appear in the integration rows."""
    from bim_ai.elements import PlanViewElem

    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="EG", levelId="lvl-1")
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="Section A",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 10_000.0, "yMm": 0.0},
        cropDepthMm=3000.0,
    )
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="A1",
        viewportsMm=[
            {"viewportId": "vp-plan", "viewRef": "plan:pv-1", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
            {"viewportId": "vp-sec", "viewRef": "section:sec-1", "xMm": 110, "yMm": 0, "widthMm": 100, "heightMm": 80},
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "pv-1": pv, "sec-1": sec, "sh-1": sh})
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    assert len(ev["rows"]) == 1
    assert ev["rows"][0]["sectionViewId"] == "sec-1"


def test_integration_evidence_rev_iss_cross_ref_set_when_revision_present() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet(rev_id="R-1", rev_code="A")
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    row = ev["rows"][0]
    assert "sheetRevIssDoc" in row["sheetRevIssDocCrossRef"]


def test_integration_evidence_rev_iss_cross_ref_empty_when_no_revision() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    row = ev["rows"][0]
    assert row["sheetRevIssDocCrossRef"] == ""


def test_integration_evidence_rows_sorted_by_viewport_id() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sec1 = SectionCutElem(
        kind="section_cut",
        id="sec-1",
        name="A",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 5000.0, "yMm": 0.0},
        cropDepthMm=3000.0,
    )
    sec2 = SectionCutElem(
        kind="section_cut",
        id="sec-2",
        name="B",
        lineStartMm={"xMm": 0.0, "yMm": 5000.0},
        lineEndMm={"xMm": 5000.0, "yMm": 5000.0},
        cropDepthMm=3000.0,
    )
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        titleBlock="A1",
        viewportsMm=[
            {"viewportId": "vp-z", "viewRef": "section:sec-2", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
            {"viewportId": "vp-a", "viewRef": "section:sec-1", "xMm": 110, "yMm": 0, "widthMm": 100, "heightMm": 80},
        ],
    )
    doc = Document(revision=1, elements={"lvl-1": lvl, "sec-1": sec1, "sec-2": sec2, "sh-1": sh})
    ev = build_section_on_sheet_integration_evidence_v1(doc, sh)
    vp_ids = [r["viewportId"] for r in ev["rows"]]
    assert vp_ids == sorted(vp_ids)


# ---------------------------------------------------------------------------
# evidence manifest integration
# ---------------------------------------------------------------------------


def test_deterministic_sheet_evidence_includes_section_on_sheet_integration() -> None:
    from uuid import UUID

    doc, _ = _minimal_doc_with_section_on_sheet()
    mid = UUID("00000000-0000-0000-0000-000000000001")
    rows = deterministic_sheet_evidence_manifest(
        model_id=mid,
        doc=doc,
        evidence_artifact_basename="test",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    assert len(rows) == 1
    row = rows[0]
    assert "sectionOnSheetIntegrationEvidence_v1" in row
    ev = row["sectionOnSheetIntegrationEvidence_v1"]
    assert ev["format"] == SECTION_ON_SHEET_INTEGRATION_EVIDENCE_V1
    assert len(ev["rows"]) == 1


# ---------------------------------------------------------------------------
# Constraint advisory rules
# ---------------------------------------------------------------------------


def test_constraint_section_on_sheet_cut_line_missing() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet(degenerate_cut=True)
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    rule_ids = [v.rule_id for v in viols]
    assert "section_on_sheet_cut_line_missing" in rule_ids
    v = next(x for x in viols if x.rule_id == "section_on_sheet_cut_line_missing")
    assert "sh-1" in v.element_ids
    assert "sec-1" in v.element_ids
    assert v.discipline == "coordination"


def test_constraint_section_on_sheet_cut_line_absent_when_valid() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    assert not any(v.rule_id == "section_on_sheet_cut_line_missing" for v in viols)


def test_constraint_section_on_sheet_revision_issue_unresolved_fires() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet()
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    assert any(v.rule_id == "section_on_sheet_revision_issue_unresolved" for v in viols)
    v = next(x for x in viols if x.rule_id == "section_on_sheet_revision_issue_unresolved")
    assert "sh-1" in v.element_ids
    assert "sec-1" in v.element_ids


def test_constraint_section_on_sheet_revision_issue_absent_when_metadata_present() -> None:
    doc, sh = _minimal_doc_with_section_on_sheet(rev_id="R-1", rev_code="A")
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    assert not any(v.rule_id == "section_on_sheet_revision_issue_unresolved" for v in viols)


def test_constraint_section_on_sheet_profile_token_missing_fires_without_geometry() -> None:
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-bare",
        name="Bare",
        lineStartMm={"xMm": 0.0, "yMm": 0.0},
        lineEndMm={"xMm": 10_000.0, "yMm": 0.0},
        cropDepthMm=0.0,
    )
    sh = SheetElem(
        kind="sheet",
        id="sh-bare",
        name="Bare",
        titleBlock="A1",
        titleblockParameters={"revisionId": "R-1", "revisionCode": "A"},
        viewportsMm=[
            {
                "viewportId": "vp-bare",
                "viewRef": "section:sec-bare",
                "xMm": 0,
                "yMm": 0,
                "widthMm": 100,
                "heightMm": 80,
            }
        ],
    )
    doc = Document(revision=1, elements={"sec-bare": sec, "sh-bare": sh})
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    assert any(v.rule_id == "section_on_sheet_profile_token_missing" for v in viols)


def test_constraint_discipline_annotation_for_new_rules() -> None:
    doc, _ = _minimal_doc_with_section_on_sheet(degenerate_cut=True)
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    cut_viols = [v for v in viols if v.rule_id == "section_on_sheet_cut_line_missing"]
    assert all(v.discipline == "coordination" for v in cut_viols)
