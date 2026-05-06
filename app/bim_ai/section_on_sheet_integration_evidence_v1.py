"""Section-on-sheet integration evidence (WP-E03/E04/E05/E06/V01 — wave 3 prompt 2).

For every section/elevation viewport placed on a sheet, builds a deterministic
integration row that cross-references the cut-line digest, profile token,
listing-segment digest, and the sheet titleblock revision/issue manifest.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import SectionCutElem, SheetElem
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.sheet_preview_svg import format_section_viewport_documentation_segment
from bim_ai.sheet_titleblock_revision_issue_v1 import (
    build_sheet_titleblock_revision_issue_manifest_v1,
)

SECTION_ON_SHEET_INTEGRATION_EVIDENCE_V1 = "sectionOnSheetIntegrationEvidence_v1"


def _cut_line_digest_sha256(sec: SectionCutElem) -> str:
    """Stable SHA-256 digest of the section cut line endpoint coordinates (mm)."""
    p0x = float(sec.line_start_mm.x_mm)
    p0y = float(sec.line_start_mm.y_mm)
    p1x = float(sec.line_end_mm.x_mm)
    p1y = float(sec.line_end_mm.y_mm)
    canon = json.dumps([p0x, p0y, p1x, p1y], separators=(",", ":"))
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def section_cut_line_present(sec: SectionCutElem) -> bool:
    """True when the section cut line is non-degenerate (endpoints are distinct)."""
    p0x = float(sec.line_start_mm.x_mm)
    p0y = float(sec.line_start_mm.y_mm)
    p1x = float(sec.line_end_mm.x_mm)
    p1y = float(sec.line_end_mm.y_mm)
    dx, dy = p1x - p0x, p1y - p0y
    return (dx * dx + dy * dy) > 1e-12


def section_profile_token_from_primitives(prim: dict[str, Any]) -> str:
    """Extract the first available sectionProfileToken_v0 from section primitives.

    Falls back to geometry-extent or level-marker derived tokens when no roof
    witness is present.  ``"noGeometry_v1"`` signals that no useful profile data
    was found (triggers ``section_on_sheet_profile_token_missing`` advisory).
    """
    roofs_raw = prim.get("roofs") or []
    if isinstance(roofs_raw, list):
        for roof_row in roofs_raw:
            if not isinstance(roof_row, dict):
                continue
            witness = roof_row.get("roofSectionCutWitness_v0")
            if isinstance(witness, dict):
                token = str(witness.get("sectionProfileToken_v0") or "").strip()
                if token:
                    return token
    geom_raw = prim.get("sectionGeometryExtentMm")
    if isinstance(geom_raw, dict):
        return "geometryExtentChord_v1"
    markers = prim.get("levelMarkers") or []
    if isinstance(markers, list) and len(markers) > 0:
        return "levelMarkerChord_v1"
    return "noGeometry_v1"


def build_section_on_sheet_integration_evidence_v1(doc: Document, sh: SheetElem) -> dict[str, Any]:
    """Build the section-on-sheet integration evidence payload for *sh*.

    Returns a ``sectionOnSheetIntegrationEvidence_v1`` dict with one row per
    section/elevation viewport and a deterministic ``sectionOnSheetIntegrationDigestSha256``
    summarising all rows for the sheet.
    """
    tb_manifest = build_sheet_titleblock_revision_issue_manifest_v1(sh)
    rev_iss_cross_ref = str(tb_manifest.get("titleblockDisplaySegment") or "")

    rows: list[dict[str, Any]] = []
    for vp in list(sh.viewports_mm or []):
        if not isinstance(vp, dict):
            continue
        vr_raw = vp.get("viewRef") or vp.get("view_ref")
        if not isinstance(vr_raw, str) or ":" not in vr_raw:
            continue
        kind_raw, ref_raw = vr_raw.split(":", 1)
        kind = kind_raw.strip().lower()
        if kind not in {"section", "sec"}:
            continue
        sec_id = ref_raw.strip()
        if not sec_id:
            continue
        el = doc.elements.get(sec_id)
        if not isinstance(el, SectionCutElem):
            continue

        vid = str(vp.get("viewportId") or vp.get("viewport_id") or "").strip()

        cut_present = section_cut_line_present(el)
        cut_line_digest = _cut_line_digest_sha256(el) if cut_present else None

        prim, _ = build_section_projection_primitives(doc, el)
        profile_token = section_profile_token_from_primitives(prim)

        listing_seg = format_section_viewport_documentation_segment(doc, vr_raw)
        listing_segment_digest = (
            hashlib.sha256(listing_seg.encode("utf-8")).hexdigest() if listing_seg else None
        )

        rows.append(
            {
                "sheetId": sh.id,
                "viewportId": vid,
                "sectionViewId": sec_id,
                "cutLinePresent": cut_present,
                "cutLineDigestSha256": cut_line_digest,
                "sectionProfileToken": profile_token,
                "listingSegment": listing_seg,
                "listingSegmentDigestSha256": listing_segment_digest,
                "sheetRevIssDocCrossRef": rev_iss_cross_ref,
            }
        )

    rows.sort(key=lambda r: (str(r.get("viewportId") or ""), str(r.get("sectionViewId") or "")))

    canon = json.dumps(rows, sort_keys=True, separators=(",", ":"), default=str)
    sheet_digest = hashlib.sha256(canon.encode("utf-8")).hexdigest()

    return {
        "format": SECTION_ON_SHEET_INTEGRATION_EVIDENCE_V1,
        "sheetId": sh.id,
        "rows": rows,
        "sectionOnSheetIntegrationDigestSha256": sheet_digest,
    }
