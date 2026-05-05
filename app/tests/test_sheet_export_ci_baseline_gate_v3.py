"""Wave 3 CI gate tests: sheet export contract completeness and baseline correlation closure.

Verifies the wave-3 additions to sheetExportArtifactManifest_v1:
- ciBaselineCorrelation is fully self-contained (includes surrogateContract,
  fullRasterExportStatus, artifact names, and sheetName)
- cross-manifest consistency: sheetPrintRasterPrintContract_v3 validates against
  the manifest's ci baseline digests
- fallback token is stable and consistent across ciBaselineCorrelation,
  artifacts entry, and sheetPrintRasterPrintContract_v3
- PNG export endpoint header X-Bim-Ai-Sheet-Print-Raster-Full-Raster-Status
  carries the fallback token
"""

from __future__ import annotations

from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import SheetElem
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.sheet_preview_svg import (
    FULL_RASTER_RENDERER_STATUS_UNAVAILABLE,
    SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2,
    build_sheet_print_raster_print_contract_v3,
    sheet_elem_to_svg,
    sheet_print_raster_print_surrogate_png_bytes_v2,
    validate_sheet_print_raster_print_contract_v3,
)


def _row(**sheet_kwargs: object) -> dict:
    sh = SheetElem(kind="sheet", id="sh1", name="TestSheet", **sheet_kwargs)  # type: ignore[arg-type]
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="ev",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    return rows[0]


# ---------------------------------------------------------------------------
# ciBaselineCorrelation wave-3 fields
# ---------------------------------------------------------------------------


def test_ci_baseline_correlation_has_surrogate_contract() -> None:
    corr = _row()["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["surrogateContract"] == SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2
    assert corr["surrogateContract"] == "sheetPrintRasterPrintSurrogate_v2"


def test_ci_baseline_correlation_has_full_raster_export_status() -> None:
    corr = _row()["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["fullRasterExportStatus"] == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert corr["fullRasterExportStatus"] == "unsupported_full_raster_renderer_unavailable"


def test_ci_baseline_correlation_has_svg_artifact_name() -> None:
    corr = _row()["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["svgArtifactName"] == "sheet-preview.svg"


def test_ci_baseline_correlation_has_png_artifact_name() -> None:
    corr = _row()["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["pngArtifactName"] == "sheet-print-raster.png"


def test_ci_baseline_correlation_has_sheet_name() -> None:
    corr = _row()["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["sheetName"] == "TestSheet"


def test_ci_baseline_correlation_sheet_name_matches_row_sheet_name() -> None:
    sh = SheetElem(kind="sheet", id="sh1", name="GA-001 Ground Floor")
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc, evidence_artifact_basename="ev",
        semantic_digest_sha256="b" * 64, semantic_digest_prefix16="b" * 16,
    )
    corr = rows[0]["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
    assert corr["sheetName"] == "GA-001 Ground Floor"


def test_ci_baseline_correlation_artifact_names_are_stable() -> None:
    row_a = _row(viewportsMm=[
        {"viewportId": "v1", "xMm": 0, "yMm": 0, "widthMm": 100, "heightMm": 80},
    ])
    row_b = _row(titleblockParameters={"revisionCode": "Z"})
    for row in (row_a, row_b):
        corr = row["sheetExportArtifactManifest_v1"]["ciBaselineCorrelation"]
        assert corr["svgArtifactName"] == "sheet-preview.svg"
        assert corr["pngArtifactName"] == "sheet-print-raster.png"


# ---------------------------------------------------------------------------
# Cross-contract consistency: ciBaselineCorrelation ↔ artifacts ↔ contract_v3
# ---------------------------------------------------------------------------


def test_ci_surrogate_contract_matches_artifacts_entry() -> None:
    mf = _row()["sheetExportArtifactManifest_v1"]
    corr = mf["ciBaselineCorrelation"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    assert corr["surrogateContract"] == by_name["sheet-print-raster.png"]["surrogateContract"]


def test_ci_full_raster_status_matches_artifacts_entry() -> None:
    mf = _row()["sheetExportArtifactManifest_v1"]
    corr = mf["ciBaselineCorrelation"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    assert corr["fullRasterExportStatus"] == by_name["sheet-print-raster.png"]["fullRasterExportStatus"]


def test_ci_full_raster_status_matches_contract_v3() -> None:
    row = _row()
    mf = row["sheetExportArtifactManifest_v1"]
    corr = mf["ciBaselineCorrelation"]
    v3 = row["sheetPrintRasterPrintContract_v3"]
    assert corr["fullRasterExportStatus"] == v3["fullRasterExportStatus"]


def test_ci_surrogate_contract_matches_contract_v3() -> None:
    row = _row()
    mf = row["sheetExportArtifactManifest_v1"]
    corr = mf["ciBaselineCorrelation"]
    v3 = row["sheetPrintRasterPrintContract_v3"]
    assert corr["surrogateContract"] == v3["surrogateVersion"]


# ---------------------------------------------------------------------------
# validate_sheet_print_raster_print_contract_v3 on manifest-embedded contract
# ---------------------------------------------------------------------------


def test_manifest_embedded_contract_v3_validates_cleanly() -> None:
    sh = SheetElem(
        kind="sheet", id="sh1", name="S1",
        titleblockParameters={"revisionCode": "A"},
        viewportsMm=[
            {"viewportId": "v1", "xMm": 0, "yMm": 0, "widthMm": 200, "heightMm": 150},
        ],
    )
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc, evidence_artifact_basename="ev",
        semantic_digest_sha256="c" * 64, semantic_digest_prefix16="c" * 16,
    )
    v3 = rows[0]["sheetPrintRasterPrintContract_v3"]
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    ok, errors = validate_sheet_print_raster_print_contract_v3(v3, png, doc, sh, svg)
    assert ok, f"contract validation failed: {errors}"
    assert errors == []


def test_manifest_embedded_contract_v3_valid_flag_is_true() -> None:
    sh = SheetElem(kind="sheet", id="sh1", name="S1")
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc, evidence_artifact_basename="ev",
        semantic_digest_sha256="d" * 64, semantic_digest_prefix16="d" * 16,
    )
    v3 = rows[0]["sheetPrintRasterPrintContract_v3"]
    assert v3["valid"] is True


def test_manifest_embedded_contract_v3_full_raster_status_is_unavailable() -> None:
    sh = SheetElem(kind="sheet", id="sh1", name="S1")
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc, evidence_artifact_basename="ev",
        semantic_digest_sha256="e" * 64, semantic_digest_prefix16="e" * 16,
    )
    v3 = rows[0]["sheetPrintRasterPrintContract_v3"]
    assert v3["fullRasterExportStatus"] == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE


# ---------------------------------------------------------------------------
# Standalone contract_v3 build + validate round-trip
# ---------------------------------------------------------------------------


def test_contract_v3_round_trip_validate_passes() -> None:
    sh = SheetElem(
        kind="sheet", id="sh1", name="Round-trip",
        titleblockParameters={"revisionCode": "RT1", "issueStatus": "issued"},
        viewportsMm=[
            {"viewportId": "va", "xMm": 10, "yMm": 20, "widthMm": 300, "heightMm": 200},
            {"viewportId": "vb", "xMm": 350, "yMm": 20, "widthMm": 150, "heightMm": 200},
        ],
    )
    doc = Document(revision=7, elements={"sh1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    contract = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    ok, errors = validate_sheet_print_raster_print_contract_v3(contract, png, doc, sh, svg)
    assert ok, f"round-trip failed: {errors}"


def test_contract_v3_validate_fails_on_tampered_png_sha() -> None:
    sh = SheetElem(kind="sheet", id="sh1", name="S1")
    doc = Document(revision=1, elements={"sh1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    contract = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    tampered = dict(contract)
    tampered["pngByteSha256"] = "0" * 64
    ok, errors = validate_sheet_print_raster_print_contract_v3(tampered, png, doc, sh, svg)
    assert not ok
    assert any("png_byte_sha256" in e for e in errors)


def test_contract_v3_validate_fails_on_wrong_svg_sha() -> None:
    sh = SheetElem(kind="sheet", id="sh1", name="S1")
    doc = Document(revision=1, elements={"sh1": sh})
    svg = sheet_elem_to_svg(doc, sh)
    png = sheet_print_raster_print_surrogate_png_bytes_v2(doc, sh, svg)
    contract = build_sheet_print_raster_print_contract_v3(doc, sh, svg, png)
    tampered = dict(contract)
    tampered["svgContentSha256"] = "f" * 64
    ok, errors = validate_sheet_print_raster_print_contract_v3(tampered, png, doc, sh, svg)
    assert not ok
    assert any("svgContentSha256" in e for e in errors)


# ---------------------------------------------------------------------------
# Fallback token stability across all carrier locations
# ---------------------------------------------------------------------------


def test_fallback_token_constant_value() -> None:
    assert FULL_RASTER_RENDERER_STATUS_UNAVAILABLE == "unsupported_full_raster_renderer_unavailable"


def test_fallback_token_consistent_across_manifest_contract_and_correlation() -> None:
    sh = SheetElem(kind="sheet", id="sh1", name="S1")
    doc = Document(revision=1, elements={"sh1": sh})
    rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(), doc=doc, evidence_artifact_basename="ev",
        semantic_digest_sha256="f" * 64, semantic_digest_prefix16="f" * 16,
    )
    mf = rows[0]["sheetExportArtifactManifest_v1"]
    by_name = {a["artifactName"]: a for a in mf["artifacts"]}
    v3 = rows[0]["sheetPrintRasterPrintContract_v3"]
    corr = mf["ciBaselineCorrelation"]

    token_in_artifact = by_name["sheet-print-raster.png"]["fullRasterExportStatus"]
    token_in_contract = v3["fullRasterExportStatus"]
    token_in_corr = corr["fullRasterExportStatus"]

    assert token_in_artifact == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert token_in_contract == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert token_in_corr == FULL_RASTER_RENDERER_STATUS_UNAVAILABLE
    assert token_in_artifact == token_in_contract == token_in_corr
