"""Sheet print raster / export closure contract tests (Prompt-3 wave 2 tightening).

Verifies the deterministic closure of:
- SVG/PDF listing parity fields at the artifact manifest level
- PNG surrogate contract fields (fullRasterExportStatus, surrogateContract)
- Artifact completeness (name, mimeType, relativeArtifactPath, digestSha256)
- CI baseline manifest correlation (all four required fields)
- Listing digest consistency between sheetExportArtifactManifest_v1 and
  sheetPrintRasterPrintContract_v3
"""

from __future__ import annotations

import hashlib
from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, SectionCutElem, SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_EXPORT_PDF_MIME_TYPE,
    SHEET_EXPORT_PNG_MIME_TYPE,
    SHEET_EXPORT_SVG_MIME_TYPE,
    SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    build_sheet_print_raster_print_contract_v3,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    sheet_viewport_export_listing_lines,
)


def _make_sheet(**kwargs: object) -> SheetElem:
    return SheetElem(kind="sheet", id="sh1", name="S1", **kwargs)  # type: ignore[arg-type]


def _single_sheet_rows(**sheet_kwargs: object) -> list[dict]:
    doc = Document(revision=1, elements={"sh1": _make_sheet(**sheet_kwargs)})
    return deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )


# ---------------------------------------------------------------------------
# SVG/PDF listing parity fields in sheetExportArtifactManifest_v1
# ---------------------------------------------------------------------------


def test_artifact_manifest_has_svg_listing_digest() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    digest = mf.get("svgListingDigestSha256")
    assert isinstance(digest, str) and len(digest) == 64


def test_artifact_manifest_has_pdf_listing_digest() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    digest = mf.get("pdfListingDigestSha256")
    assert isinstance(digest, str) and len(digest) == 64


def test_artifact_manifest_listing_parity_digest_match_is_true() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    assert mf.get("exportListingParityDigestMatch") is True


def test_artifact_manifest_svg_and_pdf_listing_digests_are_equal() -> None:
    rows = _single_sheet_rows(
        viewportsMm=[
            {"viewportId": "v1", "viewRef": "", "label": "Flr", "xMm": 0, "yMm": 0, "widthMm": 200, "heightMm": 150},
        ]
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    assert mf["svgListingDigestSha256"] == mf["pdfListingDigestSha256"]


def test_artifact_manifest_svg_listing_digest_matches_listing_blob() -> None:
    sh = _make_sheet(
        viewportsMm=[
            {"viewportId": "v1", "viewRef": "", "label": "X", "xMm": 10, "yMm": 20, "widthMm": 100, "heightMm": 80},
        ]
    )
    doc = Document(revision=2, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="b" * 64,
        semantic_digest_prefix16="b" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    listing_blob = "\n".join(sheet_viewport_export_listing_lines(doc, sh)).encode("utf-8")
    expected = hashlib.sha256(listing_blob).hexdigest()
    assert mf["svgListingDigestSha256"] == expected


def test_artifact_manifest_listing_digest_matches_contract_v3_digest() -> None:
    sh = _make_sheet(
        titleblockParameters={"revisionCode": "D"},
        viewportsMm=[
            {"viewportId": "v1", "viewRef": "", "label": "Y", "xMm": 0, "yMm": 0, "widthMm": 300, "heightMm": 200},
        ],
    )
    doc = Document(revision=3, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="c" * 64,
        semantic_digest_prefix16="c" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    # Verify manifest listing digest matches contract v3 listing segment digest
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    v3 = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    assert mf["svgListingDigestSha256"] == v3["svgListingSegmentsDigestSha256"]
    assert mf["pdfListingDigestSha256"] == v3["pdfListingSegmentsDigestSha256"]


# ---------------------------------------------------------------------------
# Artifact completeness: name, mimeType, relativeArtifactPath, digestSha256
# ---------------------------------------------------------------------------


def test_each_artifact_has_all_four_required_fields() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    for art in mf["artifacts"]:
        assert "artifactName" in art, f"missing artifactName in {art}"
        assert "mimeType" in art, f"missing mimeType in {art}"
        assert "relativeArtifactPath" in art, f"missing relativeArtifactPath in {art}"
        assert "digestSha256" in art, f"missing digestSha256 in {art}"


def test_svg_artifact_digest_is_64_hex_chars() -> None:
    rows = _single_sheet_rows()
    by_name = {a["artifactName"]: a for a in rows[0]["sheetExportArtifactManifest_v1"]["artifacts"]}
    d = by_name["sheet-preview.svg"]["digestSha256"]
    assert isinstance(d, str) and len(d) == 64


def test_png_artifact_digest_is_64_hex_chars() -> None:
    rows = _single_sheet_rows()
    by_name = {a["artifactName"]: a for a in rows[0]["sheetExportArtifactManifest_v1"]["artifacts"]}
    d = by_name["sheet-print-raster.png"]["digestSha256"]
    assert isinstance(d, str) and len(d) == 64


def test_pdf_artifact_digest_is_none_with_server_side_note() -> None:
    rows = _single_sheet_rows()
    by_name = {a["artifactName"]: a for a in rows[0]["sheetExportArtifactManifest_v1"]["artifacts"]}
    pdf = by_name["sheet-preview.pdf"]
    assert pdf["digestSha256"] is None
    assert "note" in pdf


def test_png_artifact_has_surrogate_contract_and_fallback_token() -> None:
    rows = _single_sheet_rows()
    by_name = {a["artifactName"]: a for a in rows[0]["sheetExportArtifactManifest_v1"]["artifacts"]}
    png = by_name["sheet-print-raster.png"]
    assert png["surrogateContract"] == SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
    assert png["fullRasterExportStatus"] == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert png["fullRasterExportStatus"] == "unsupported_full_raster_renderer_unavailable"


def test_artifact_mime_types_match_constants() -> None:
    rows = _single_sheet_rows()
    by_name = {a["artifactName"]: a for a in rows[0]["sheetExportArtifactManifest_v1"]["artifacts"]}
    assert by_name["sheet-preview.svg"]["mimeType"] == SHEET_EXPORT_SVG_MIME_TYPE
    assert by_name["sheet-preview.pdf"]["mimeType"] == SHEET_EXPORT_PDF_MIME_TYPE
    assert by_name["sheet-print-raster.png"]["mimeType"] == SHEET_EXPORT_PNG_MIME_TYPE


# ---------------------------------------------------------------------------
# CI baseline correlation: sheetExportCiBaselineCorrelation_v1
# ---------------------------------------------------------------------------


def test_ci_baseline_correlation_has_all_required_fields() -> None:
    rows = _single_sheet_rows()
    corr = rows[0]["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["format"] == "sheetExportCiBaselineCorrelation_v1"
    assert "sheetId" in corr
    assert "svgDigestSha256" in corr
    assert "pngDigestSha256" in corr
    assert "exportListingDigestSha256" in corr


def test_ci_baseline_correlation_sheet_id_matches() -> None:
    rows = _single_sheet_rows()
    corr = rows[0]["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["sheetId"] == "sh1"


def test_ci_baseline_correlation_svg_digest_matches_svg_artifact() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    assert mf["ciBaselineCorrelation"]["svgDigestSha256"] == by_name["sheet-preview.svg"]["digestSha256"]


def test_ci_baseline_correlation_png_digest_matches_png_artifact() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    assert mf["ciBaselineCorrelation"]["pngDigestSha256"] == by_name["sheet-print-raster.png"]["digestSha256"]


def test_ci_baseline_correlation_export_listing_digest_matches_svg_listing() -> None:
    rows = _single_sheet_rows()
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    assert mf["ciBaselineCorrelation"]["exportListingDigestSha256"] == mf["svgListingDigestSha256"]


def test_ci_baseline_correlation_all_digests_are_64_hex() -> None:
    rows = _single_sheet_rows()
    corr = rows[0]["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    for key in ("svgDigestSha256", "pngDigestSha256", "exportListingDigestSha256"):
        val = corr[key]
        assert isinstance(val, str) and len(val) == 64, f"{key} = {val!r}"


# ---------------------------------------------------------------------------
# Multi-sheet independence
# ---------------------------------------------------------------------------


def test_two_sheets_have_independent_manifests() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    doc = Document(
        revision=1,
        elements={
            "lvl": lvl,
            "sh1": SheetElem(kind="sheet", id="sh1", name="A", viewportsMm=[
                {"viewportId": "v1", "viewRef": "", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
            ]),
            "sh2": SheetElem(kind="sheet", id="sh2", name="B", viewportsMm=[
                {"viewportId": "v2", "viewRef": "", "xMm": 50, "yMm": 0, "widthMm": 200, "heightMm": 160},
            ]),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="d" * 64,
        semantic_digest_prefix16="d" * 16,
    )
    assert len(rows) == 2
    mf1 = rows[0]["sheetExportArtifactManifest_v1"]
    mf2 = rows[1]["sheetExportArtifactManifest_v1"]
    assert mf1["sheetId"] != mf2["sheetId"]
    # Each sheet's listing digest may differ when viewport geometry differs
    # (svg content and listing are deterministic per sheet)
    assert mf1["svgListingDigestSha256"] != mf2["svgListingDigestSha256"]


def test_manifest_is_deterministic_across_calls() -> None:
    sh = _make_sheet(titleblockParameters={"revisionCode": "X"})
    doc = Document(revision=5, elements={"sh1": sh})
    mid = uuid4()
    kwargs = dict(
        model_id=mid,
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="e" * 64,
        semantic_digest_prefix16="e" * 16,
    )
    rows_a = deterministic_sheet_evidence_manifest(**kwargs)
    rows_b = deterministic_sheet_evidence_manifest(**kwargs)
    mf_a = rows_a[0]["sheetExportArtifactManifest_v1"]
    mf_b = rows_b[0]["sheetExportArtifactManifest_v1"]
    assert mf_a["svgListingDigestSha256"] == mf_b["svgListingDigestSha256"]
    assert mf_a["exportListingParityDigestMatch"] == mf_b["exportListingParityDigestMatch"]
    for fa, fb in zip(mf_a["artifacts"], mf_b["artifacts"], strict=True):
        assert fa["digestSha256"] == fb["digestSha256"]


# ---------------------------------------------------------------------------
# Fallback token stability
# ---------------------------------------------------------------------------


def test_full_raster_fallback_token_constant_is_stable() -> None:
    assert FULL_RASTER_RENDERER_STATUS_UNAVAILABLE == "unsupported_full_raster_renderer_unavailable"


def test_parity_token_constant_is_stable() -> None:
    assert SHEET_EXPORT_SVG_PDF_LISTING_PARITY_TOKEN == "svgPdfListingParity_v1"


def test_surrogate_contract_constant_is_stable() -> None:
    assert SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2 == "sheetPrintRasterPrintSurrogate_v2"


# ---------------------------------------------------------------------------
# Cross-contract: manifest ↔ contract_v3 digest consistency
# ---------------------------------------------------------------------------


def test_manifest_ci_correlation_listing_digest_matches_contract_v3_pdf_listing_digest() -> None:
    sh = _make_sheet(
        titleblockParameters={"revisionCode": "R1", "issueStatus": "for_approval"},
        viewportsMm=[
            {"viewportId": "va", "viewRef": "", "label": "Ground", "xMm": 0, "yMm": 0, "widthMm": 500, "heightMm": 400},
        ],
    )
    doc = Document(revision=9, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="f" * 64,
        semantic_digest_prefix16="f" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    ci_listing_digest = mf["ciBaselineCorrelation"]["exportListingDigestSha256"]
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    v3 = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    assert ci_listing_digest == v3["pdfListingSegmentsDigestSha256"]


# ---------------------------------------------------------------------------
# Listing parity field changes when viewport geometry changes
# ---------------------------------------------------------------------------


def test_listing_digest_changes_when_viewport_label_changes() -> None:
    sh_a = _make_sheet(viewportsMm=[
        {"viewportId": "v1", "viewRef": "", "label": "Plan", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
    ])
    sh_b = _make_sheet(viewportsMm=[
        {"viewportId": "v1", "viewRef": "", "label": "Section", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
    ])
    doc_a = Document(revision=1, elements={"sh1": sh_a})
    doc_b = Document(revision=1, elements={"sh1": sh_b})
    rows_a = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc_a, evidence_artifact_basename="ev",
        semantic_digest_sha256="g" * 64, semantic_digest_prefix16="g" * 16,
    )
    rows_b = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc_b, evidence_artifact_basename="ev",
        semantic_digest_sha256="g" * 64, semantic_digest_prefix16="g" * 16,
    )
    assert (
        rows_a[0]["sheetExportArtifactManifest_v1"]["svgListingDigestSha256"]
        != rows_b[0]["sheetExportArtifactManifest_v1"]["svgListingDigestSha256"]
    )


def test_parity_match_remains_true_with_multiple_viewports() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="G", elevationMm=0)
    sec = SectionCutElem(
        kind="section_cut", id="sec1", name="Cut",
        lineStartMm={"xMm": 0, "yMm": 0}, lineEndMm={"xMm": 0, "yMm": 1000},
    )
    pv = PlanViewElem(kind="plan_view", id="pv1", name="P", levelId="lvl")
    sh = SheetElem(
        kind="sheet", id="sh1", name="S1",
        titleblockParameters={"revisionCode": "B"},
        viewportsMm=[
            {"viewportId": "vp1", "viewRef": "plan:pv1", "label": "Plan", "xMm": 0, "yMm": 0, "widthMm": 500, "heightMm": 400},
            {"viewportId": "vs1", "viewRef": "section:sec1", "label": "Section", "xMm": 600, "yMm": 0, "widthMm": 400, "heightMm": 300},
        ],
    )
    doc = Document(revision=1, elements={"lvl": lvl, "sec1": sec, "pv1": pv, "sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc, evidence_artifact_basename="ev",
        semantic_digest_sha256="h" * 64, semantic_digest_prefix16="h" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    assert mf["exportListingParityDigestMatch"] is True
    assert mf["svgListingDigestSha256"] == mf["pdfListingDigestSha256"]
