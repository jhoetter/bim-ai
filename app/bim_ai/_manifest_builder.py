"""Fluent builders for evidence-manifest payloads (REF-CQ-04).

Two layered builders share an internal ``dict[str, Any]`` accumulator and
return ``self`` from every mutator so payload construction reads as a
top-down recipe instead of nested dict-literal assembly.

* :class:`EvidenceManifestBuilder` — assembles top-level evidence-package
  fragments. Designed for :func:`evidence_manifest.evidence_closure_review_v1`
  but generic enough that any caller can compose deterministic PNG
  inventory, correlation-digest consistency, screenshot gap rollup, fix-loop
  blockers, etc.
* :class:`DeterministicEvidenceRowBuilder` — assembles a single
  ``deterministic_*_evidence_manifest`` row. Centralises the
  ``correlation`` / ``playwrightSuggestedFilenames`` shape that every
  ``deterministic_*`` function repeats.

The builders never compute hashes or perform IO; they accept already-
computed values from the caller and arrange them into the well-known shape
the tests pin.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


class EvidenceManifestBuilder:
    """Fluent accumulator for top-level evidence-manifest fragments.

    Methods return ``self`` so callers can chain. ``build()`` returns the
    accumulated dict (a fresh shallow copy so later builder mutations cannot
    surprise the caller).
    """

    def __init__(self) -> None:
        self._state: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # generic primitives
    # ------------------------------------------------------------------

    def set(self, key: str, value: Any) -> EvidenceManifestBuilder:
        """Set ``key`` to ``value``; returns ``self`` for chaining."""
        self._state[key] = value
        return self

    def set_format(self, fmt: str) -> EvidenceManifestBuilder:
        """Convenience for the ubiquitous ``format`` discriminator."""
        self._state["format"] = fmt
        return self

    def update(self, payload: dict[str, Any]) -> EvidenceManifestBuilder:
        """Shallow-merge ``payload`` into the accumulator."""
        self._state.update(payload)
        return self

    # ------------------------------------------------------------------
    # PNG inventory + correlation-digest scan
    # ------------------------------------------------------------------

    def add_png_inventory(
        self,
        *,
        deterministic_sheet_evidence: list[dict[str, Any]],
        deterministic_3d_view_evidence: list[dict[str, Any]],
        deterministic_plan_view_evidence: list[dict[str, Any]],
        deterministic_section_cut_evidence: list[dict[str, Any]],
    ) -> EvidenceManifestBuilder:
        """Populate sorted deterministic PNG basenames + primary count.

        Walks each row's ``playwrightSuggestedFilenames`` for the four
        well-known PNG slot keys and stores the deduped, sorted list at
        ``expectedDeterministicPngBasenames`` plus an inventory count at
        ``primaryScreenshotArtifactCount``.
        """
        names: list[str] = []
        for rows in (
            deterministic_sheet_evidence,
            deterministic_3d_view_evidence,
            deterministic_plan_view_evidence,
            deterministic_section_cut_evidence,
        ):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                pw = row.get("playwrightSuggestedFilenames")
                if not isinstance(pw, dict):
                    continue
                for key in (
                    "pngViewport",
                    "pngFullSheet",
                    "pngPlanCanvas",
                    "pngSectionViewport",
                ):
                    val = pw.get(key)
                    if isinstance(val, str) and val.endswith(".png"):
                        names.append(val)
        basenames_sorted = sorted(set(names))
        self._state["expectedDeterministicPngBasenames"] = basenames_sorted
        self._state["primaryScreenshotArtifactCount"] = len(basenames_sorted)
        return self

    # ------------------------------------------------------------------
    # correlation-digest hygiene scan
    # ------------------------------------------------------------------

    def add_digest_consistency(
        self,
        *,
        package_semantic_digest_sha256: str,
        deterministic_sheet_evidence: list[dict[str, Any]],
        deterministic_3d_view_evidence: list[dict[str, Any]],
        deterministic_plan_view_evidence: list[dict[str, Any]],
        deterministic_section_cut_evidence: list[dict[str, Any]],
    ) -> EvidenceManifestBuilder:
        """Populate ``correlationDigestConsistency`` (stale + missing rows).

        For each deterministic row, compare its
        ``correlation.semanticDigestSha256`` to the package digest. Rows
        with a mismatch land in ``staleRowsRelativeToPackageDigest`` and
        rows whose correlation has no digest land in
        ``rowsMissingCorrelationDigest``. ``isFullyConsistent`` is true
        only when both buckets are empty.
        """
        stale_rows: list[dict[str, Any]] = []
        missing_rows: list[dict[str, Any]] = []

        for kind, id_key, rows in (
            ("sheet", "sheetId", deterministic_sheet_evidence),
            ("viewpoint", "viewpointId", deterministic_3d_view_evidence),
            ("plan_view", "planViewId", deterministic_plan_view_evidence),
            ("section_cut", "sectionCutId", deterministic_section_cut_evidence),
        ):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                row_id = str(row.get(id_key, "") or "")
                corr_raw = row.get("correlation")
                corr = corr_raw if isinstance(corr_raw, dict) else {}
                row_sha = corr.get("semanticDigestSha256")
                if row_sha is None:
                    if row_id:
                        missing_rows.append({"kind": kind, "id": row_id})
                elif (
                    isinstance(row_sha, str)
                    and row_sha != package_semantic_digest_sha256
                ):
                    stale_rows.append(
                        {
                            "kind": kind,
                            "id": row_id,
                            "correlationSemanticDigestSha256": row_sha,
                            "packageSemanticDigestSha256": package_semantic_digest_sha256,
                        }
                    )

        self._state["correlationDigestConsistency"] = {
            "format": "correlationDigestConsistency_v1",
            "staleRowsRelativeToPackageDigest": stale_rows,
            "rowsMissingCorrelationDigest": missing_rows,
            "isFullyConsistent": len(stale_rows) == 0 and len(missing_rows) == 0,
        }
        return self

    # ------------------------------------------------------------------
    # screenshot gaps, pixel-diff, package digest
    # ------------------------------------------------------------------

    def add_screenshot_hint_gaps(
        self, gaps_v1: dict[str, Any]
    ) -> EvidenceManifestBuilder:
        """Attach a precomputed ``screenshotHintGaps_v1`` fragment."""
        self._state["screenshotHintGaps_v1"] = gaps_v1
        return self

    def add_pixel_diff_expectation(
        self, pixel_diff: dict[str, Any]
    ) -> EvidenceManifestBuilder:
        """Attach a precomputed ``pixelDiffExpectation`` fragment."""
        self._state["pixelDiffExpectation"] = pixel_diff
        return self

    def add_package_digest(
        self, package_semantic_digest_sha256: str
    ) -> EvidenceManifestBuilder:
        """Set ``packageSemanticDigestSha256`` echo."""
        self._state["packageSemanticDigestSha256"] = package_semantic_digest_sha256
        return self

    # ------------------------------------------------------------------
    # correlation digests + fix-loop blocker rollups (composable helpers)
    # ------------------------------------------------------------------

    def add_correlation_digests(
        self,
        *,
        package_semantic_digest_sha256: str,
        artifact_ingest_manifest_digest_sha256: str | None = None,
    ) -> EvidenceManifestBuilder:
        """Attach a ``correlationDigests`` rollup (package + ingest digest).

        Convenience for callers that want a single nested bag of digests
        rather than scattering them across the payload root. The ingest
        digest is optional and only emitted when non-None.
        """
        out: dict[str, Any] = {
            "format": "correlationDigests_v1",
            "packageSemanticDigestSha256": package_semantic_digest_sha256,
        }
        if artifact_ingest_manifest_digest_sha256 is not None:
            out["artifactIngestManifestDigestSha256"] = (
                artifact_ingest_manifest_digest_sha256
            )
        self._state["correlationDigests"] = out
        return self

    def add_fix_loop_blockers(
        self, blocker_codes: list[str]
    ) -> EvidenceManifestBuilder:
        """Attach a deterministic ``fixLoopBlockers`` rollup.

        Codes are deduped and sorted; ``needsFixLoop`` mirrors
        ``len(codes) > 0`` so downstream consumers can branch on the
        boolean without rescanning the list.
        """
        codes = sorted({str(c) for c in blocker_codes if isinstance(c, str)})
        self._state["fixLoopBlockers"] = {
            "format": "fixLoopBlockers_v1",
            "needsFixLoop": len(codes) > 0,
            "blockerCodes": codes,
        }
        return self

    # ------------------------------------------------------------------
    # high-level recipe: closure review
    # ------------------------------------------------------------------

    def build_closure_review(
        self,
        *,
        package_semantic_digest_sha256: str,
        deterministic_sheet_evidence: list[dict[str, Any]],
        deterministic_3d_view_evidence: list[dict[str, Any]],
        deterministic_plan_view_evidence: list[dict[str, Any]],
        deterministic_section_cut_evidence: list[dict[str, Any]],
        screenshot_hint_gaps: Callable[..., dict[str, Any]],
        pixel_diff_expectation_factory: Callable[[list[str]], dict[str, Any]],
    ) -> dict[str, Any]:
        """Compose the closure-review payload in one fluent recipe.

        Equivalent to the original ``evidence_closure_review_v1`` body but
        expressed as chained builder calls. The two callables let the
        caller plug in the existing free functions
        (``screenshot_hint_gaps_v1`` and
        ``pixel_diff_expectation_v1_with_ingest``) without pulling those
        modules into the builder's import surface.
        """
        self.set_format("evidenceClosureReview_v1")
        self.add_package_digest(package_semantic_digest_sha256)
        self.add_png_inventory(
            deterministic_sheet_evidence=deterministic_sheet_evidence,
            deterministic_3d_view_evidence=deterministic_3d_view_evidence,
            deterministic_plan_view_evidence=deterministic_plan_view_evidence,
            deterministic_section_cut_evidence=deterministic_section_cut_evidence,
        )
        self.add_screenshot_hint_gaps(
            screenshot_hint_gaps(
                deterministic_sheet_evidence=deterministic_sheet_evidence,
                deterministic_3d_view_evidence=deterministic_3d_view_evidence,
                deterministic_plan_view_evidence=deterministic_plan_view_evidence,
                deterministic_section_cut_evidence=deterministic_section_cut_evidence,
            )
        )
        self.add_digest_consistency(
            package_semantic_digest_sha256=package_semantic_digest_sha256,
            deterministic_sheet_evidence=deterministic_sheet_evidence,
            deterministic_3d_view_evidence=deterministic_3d_view_evidence,
            deterministic_plan_view_evidence=deterministic_plan_view_evidence,
            deterministic_section_cut_evidence=deterministic_section_cut_evidence,
        )
        self.add_pixel_diff_expectation(
            pixel_diff_expectation_factory(
                self._state["expectedDeterministicPngBasenames"]
            )
        )
        return self.build()

    # ------------------------------------------------------------------

    def build(self) -> dict[str, Any]:
        """Return a shallow copy of the accumulated payload."""
        return dict(self._state)


class DeterministicEvidenceRowBuilder:
    """Fluent accumulator for a single ``deterministic_*_evidence`` row.

    Every ``deterministic_*_evidence_manifest`` row shares the same
    ``correlation`` block (format, package digest, prefix, revision, model
    id, suggested bundle filename) and a ``playwrightSuggestedFilenames``
    block. Centralising those two shapes is the bulk of the LoC win.
    """

    def __init__(self, primary_id_key: str, primary_id_value: str) -> None:
        self._state: dict[str, Any] = {primary_id_key: primary_id_value}

    def set(self, key: str, value: Any) -> DeterministicEvidenceRowBuilder:
        """Set ``key`` to ``value`` on the row; returns ``self`` for chaining."""
        self._state[key] = value
        return self

    def set_if_not_none(
        self, key: str, value: Any
    ) -> DeterministicEvidenceRowBuilder:
        """Set ``key`` to ``value`` only when ``value is not None``."""
        if value is not None:
            self._state[key] = value
        return self

    def update(self, payload: dict[str, Any]) -> DeterministicEvidenceRowBuilder:
        """Shallow-merge ``payload`` into the row."""
        self._state.update(payload)
        return self

    def add_playwright_filenames(
        self, **slot_to_basename: str
    ) -> DeterministicEvidenceRowBuilder:
        """Attach the ``playwrightSuggestedFilenames`` block from kwargs."""
        self._state["playwrightSuggestedFilenames"] = dict(slot_to_basename)
        return self

    def add_correlation(
        self,
        *,
        format_id: str,
        semantic_digest_sha256: str,
        semantic_digest_prefix16: str,
        model_revision: int,
        model_id: str,
        suggested_evidence_bundle_evidence_package_json: str,
    ) -> DeterministicEvidenceRowBuilder:
        """Attach the common ``correlation`` block.

        Every ``deterministic_*_evidence_manifest`` function repeats this
        exact 6-key dict; centralising it removes the bulk of the row
        boilerplate.
        """
        self._state["correlation"] = {
            "format": format_id,
            "semanticDigestSha256": semantic_digest_sha256,
            "semanticDigestPrefix16": semantic_digest_prefix16,
            "modelRevision": model_revision,
            "modelId": model_id,
            "suggestedEvidenceBundleEvidencePackageJson": (
                suggested_evidence_bundle_evidence_package_json
            ),
        }
        return self

    def build(self) -> dict[str, Any]:
        """Return a shallow copy of the accumulated row."""
        return dict(self._state)


# ---------------------------------------------------------------------------
# Reusable static-shape factories (lift large literals out of caller modules)
# ---------------------------------------------------------------------------


def sheet_print_raster_ingest_v1(
    *,
    contract: str,
    svg_content_sha256: str,
    placeholder_png_sha256: str,
) -> dict[str, Any]:
    """Return the ``sheetPrintRasterIngest_v1`` block.

    Centralises the 12-line nested-dict literal that every sheet
    evidence row carries. ``contract`` is the surrogate-contract
    sentinel (``SHEET_PRINT_RASTER_PRINT_SURROGATE_CONTRACT_V2``).
    """
    return {
        "format": "sheetPrintRasterIngest_v1",
        "contract": contract,
        "svgContentSha256": svg_content_sha256,
        "placeholderPngSha256": placeholder_png_sha256,
        "diffCorrelation": {
            "format": "sheetPrintRasterDiffCorrelation_v1",
            "playwrightBaselineSlot": "pngFullSheet",
            "notes": (
                "Server print-surrogate PNG (128×112) stacks a 128×96 viewport "
                "layout stamp with SVG UTF-8 salt and a 16px deterministic "
                "titleblock metadata band; it does not pixel-match Playwright "
                "captures or fully render the SVG. Use for CI artifact/hash "
                "correlation and layout/titleblock evidence; baseline visual "
                "diff remains client-side on pngFullSheet / pngViewport."
            ),
        },
    }


def sheet_export_artifact_manifest_v1(
    *,
    sheet_id: str,
    sheet_name: str | None,
    svg_mime_type: str,
    pdf_mime_type: str,
    png_mime_type: str,
    svg_digest_sha256: str,
    placeholder_png_sha256: str,
    export_listing_digest_sha256: str,
    surrogate_contract: str,
    full_raster_renderer_status: str,
    export_listing_parity_token: str,
) -> dict[str, Any]:
    """Return the ``sheetExportArtifactManifest_v1`` block.

    Centralises the ~40-line nested-dict literal that every sheet
    evidence row carries (three artifact rows + CI baseline correlation
    sub-dict). Constants are passed in by the caller so this module
    stays import-free of the sheet-preview package.
    """
    return {
        "format": "sheetExportArtifactManifest_v1",
        "sheetId": sheet_id,
        "artifacts": [
            {
                "artifactName": "sheet-preview.svg",
                "mimeType": svg_mime_type,
                "relativeArtifactPath": "exports/sheet-preview.svg",
                "digestSha256": svg_digest_sha256,
            },
            {
                "artifactName": "sheet-preview.pdf",
                "mimeType": pdf_mime_type,
                "relativeArtifactPath": "exports/sheet-preview.pdf",
                "digestSha256": None,
                "note": (
                    "PDF bytes not deterministically available server-side; "
                    "correlate via exportListingDigestSha256."
                ),
            },
            {
                "artifactName": "sheet-print-raster.png",
                "mimeType": png_mime_type,
                "relativeArtifactPath": "exports/sheet-print-raster.png",
                "digestSha256": placeholder_png_sha256,
                "surrogateContract": surrogate_contract,
                "fullRasterExportStatus": full_raster_renderer_status,
            },
        ],
        "exportListingParityToken": export_listing_parity_token,
        "svgListingDigestSha256": export_listing_digest_sha256,
        "pdfListingDigestSha256": export_listing_digest_sha256,
        "exportListingParityDigestMatch": True,
        "ciBaselineCorrelation": {
            "format": "sheetExportCiBaselineCorrelation_v1",
            "sheetId": sheet_id,
            "sheetName": sheet_name,
            "svgArtifactName": "sheet-preview.svg",
            "pngArtifactName": "sheet-print-raster.png",
            "svgDigestSha256": svg_digest_sha256,
            "pngDigestSha256": placeholder_png_sha256,
            "exportListingDigestSha256": export_listing_digest_sha256,
            "surrogateContract": surrogate_contract,
            "fullRasterExportStatus": full_raster_renderer_status,
        },
    }


__all__ = [
    "DeterministicEvidenceRowBuilder",
    "EvidenceManifestBuilder",
    "sheet_export_artifact_manifest_v1",
    "sheet_print_raster_ingest_v1",
]
