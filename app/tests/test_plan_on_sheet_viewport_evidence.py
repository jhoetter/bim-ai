"""Plan-on-sheet viewport placement evidence tests (Wave 3 Prompt 1 / WP-C01/C02/E05/V01)."""

from __future__ import annotations

from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.sheet_preview_svg import plan_sheet_viewport_placement_evidence_v1


def _doc_with_plan_on_sheet(
    *,
    plan_crop_min: tuple[float, float] | None = None,
    plan_crop_max: tuple[float, float] | None = None,
    vp_width: float = 200.0,
    vp_height: float = 150.0,
    vp_crop_min: tuple[float, float] | None = None,
    vp_crop_max: tuple[float, float] | None = None,
) -> tuple[Document, SheetElem]:
    pv_extra: dict = {}
    if plan_crop_min is not None:
        pv_extra["cropMinMm"] = {"xMm": plan_crop_min[0], "yMm": plan_crop_min[1]}
    if plan_crop_max is not None:
        pv_extra["cropMaxMm"] = {"xMm": plan_crop_max[0], "yMm": plan_crop_max[1]}

    vp: dict = {
        "viewportId": "vp-1",
        "viewRef": "plan:pv-1",
        "xMm": 10.0,
        "yMm": 10.0,
        "widthMm": vp_width,
        "heightMm": vp_height,
    }
    if vp_crop_min is not None:
        vp["cropMinMm"] = {"xMm": vp_crop_min[0], "yMm": vp_crop_min[1]}
    if vp_crop_max is not None:
        vp["cropMaxMm"] = {"xMm": vp_crop_max[0], "yMm": vp_crop_max[1]}

    sh = SheetElem(kind="sheet", id="sh-1", name="GA01", viewportsMm=[vp])
    pv = PlanViewElem(kind="plan_view", id="pv-1", name="Level 1", levelId="lvl-1", **pv_extra)
    lvl = LevelElem(kind="level", id="lvl-1", name="L1", elevationMm=0)
    doc = Document(revision=1, elements={"sh-1": sh, "pv-1": pv, "lvl-1": lvl})
    return doc, sh


# ── Token tests ───────────────────────────────────────────────────────────────

def test_token_crop_missing_when_no_plan_crop() -> None:
    doc, sh = _doc_with_plan_on_sheet()
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert len(rows) == 1
    assert rows[0]["intersectClampToken"] == "crop_missing"


def test_token_viewport_zero_extent() -> None:
    doc, sh = _doc_with_plan_on_sheet(vp_width=0.0)
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["intersectClampToken"] == "viewport_zero_extent"


def test_token_crop_inverted_when_min_x_exceeds_max_x() -> None:
    doc, sh = _doc_with_plan_on_sheet(plan_crop_min=(5000.0, 0.0), plan_crop_max=(1000.0, 8000.0))
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["intersectClampToken"] == "crop_inverted"


def test_token_crop_inverted_when_min_y_exceeds_max_y() -> None:
    doc, sh = _doc_with_plan_on_sheet(plan_crop_min=(0.0, 9000.0), plan_crop_max=(8000.0, 1000.0))
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["intersectClampToken"] == "crop_inverted"


def test_token_inside_when_no_sheet_viewport_model_crop() -> None:
    doc, sh = _doc_with_plan_on_sheet(
        plan_crop_min=(0.0, 0.0), plan_crop_max=(5000.0, 4000.0)
    )
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["intersectClampToken"] == "inside"


def test_token_inside_when_plan_crop_within_vp_model_crop() -> None:
    doc, sh = _doc_with_plan_on_sheet(
        plan_crop_min=(1000.0, 1000.0),
        plan_crop_max=(5000.0, 4000.0),
        vp_crop_min=(0.0, 0.0),
        vp_crop_max=(6000.0, 5000.0),
    )
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["intersectClampToken"] == "inside"


def test_token_clamped_when_plan_crop_exceeds_vp_model_crop() -> None:
    doc, sh = _doc_with_plan_on_sheet(
        plan_crop_min=(0.0, 0.0),
        plan_crop_max=(8000.0, 6000.0),
        vp_crop_min=(500.0, 500.0),
        vp_crop_max=(4000.0, 3000.0),
    )
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["intersectClampToken"] == "clamped"


# ── Payload shape tests ───────────────────────────────────────────────────────

def test_evidence_row_shape() -> None:
    doc, sh = _doc_with_plan_on_sheet(
        plan_crop_min=(0.0, 0.0), plan_crop_max=(4000.0, 3000.0)
    )
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    r = rows[0]
    assert r["format"] == "planSheetViewportPlacementEvidence_v1"
    assert r["viewportId"] == "vp-1"
    assert r["planViewId"] == "pv-1"
    assert r["sheetViewportMmBox"]["widthMm"] == 200.0
    assert isinstance(r["resolvedPlanCropMmBox"], dict)
    assert r["resolvedPlanCropMmBox"]["xMinMm"] == 0.0
    assert r["resolvedPlanCropMmBox"]["xMaxMm"] == 4000.0
    assert isinstance(r["primitiveCounts"], dict)
    assert "inBox" in r["primitiveCounts"]
    assert "clipped" in r["primitiveCounts"]
    digest = r["planOnSheetSegmentDigestSha256"]
    assert isinstance(digest, str) and len(digest) == 64


def test_evidence_row_no_plan_crop_has_null_crop_box() -> None:
    doc, sh = _doc_with_plan_on_sheet()
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows[0]["resolvedPlanCropMmBox"] is None


def test_skips_non_plan_viewports() -> None:
    sh = SheetElem(
        kind="sheet",
        id="sh-x",
        name="X",
        viewportsMm=[
            {"viewportId": "vp-sec", "viewRef": "section:sec-1", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
        ],
    )
    doc = Document(revision=1, elements={"sh-x": sh})
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows == []


def test_skips_unresolved_plan_view_id() -> None:
    sh = SheetElem(
        kind="sheet",
        id="sh-y",
        name="Y",
        viewportsMm=[
            {"viewportId": "vp-ghost", "viewRef": "plan:nonexistent", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
        ],
    )
    doc = Document(revision=1, elements={"sh-y": sh})
    rows = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert rows == []


def test_segment_digest_is_stable() -> None:
    doc, sh = _doc_with_plan_on_sheet(
        plan_crop_min=(0.0, 0.0), plan_crop_max=(4000.0, 3000.0)
    )
    r1 = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    r2 = plan_sheet_viewport_placement_evidence_v1(doc, list(sh.viewports_mm or []))
    assert r1[0]["planOnSheetSegmentDigestSha256"] == r2[0]["planOnSheetSegmentDigestSha256"]


# ── Evidence manifest integration ─────────────────────────────────────────────

def test_evidence_manifest_includes_plan_sheet_placement_field() -> None:
    sid = uuid4()
    doc, _ = _doc_with_plan_on_sheet(
        plan_crop_min=(0.0, 0.0), plan_crop_max=(5000.0, 4000.0)
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    assert len(rows) == 1
    ev = rows[0].get("planSheetViewportPlacementEvidence_v1")
    assert isinstance(ev, list)
    assert len(ev) == 1
    assert ev[0]["format"] == "planSheetViewportPlacementEvidence_v1"
    assert ev[0]["planViewId"] == "pv-1"


def test_evidence_manifest_placement_is_empty_list_when_no_plan_viewports() -> None:
    sid = uuid4()
    sh = SheetElem(kind="sheet", id="sh-only", name="X", viewportsMm=[])
    doc = Document(revision=1, elements={"sh-only": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="b" * 64,
        semantic_digest_prefix16="b" * 16,
    )
    ev = rows[0].get("planSheetViewportPlacementEvidence_v1")
    assert ev == []
