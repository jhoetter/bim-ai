"""Cross-surface evidence audit — deterministic proof that every evidence emitter
is reachable from the aggregated package, the Agent Review readout, and the tracker
(WP-A02 / WP-A03 / WP-F02).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

FORMAT = "crossSurfaceEvidenceAuditManifest_v1"
SCHEMA_VERSION = 1

Coverage = str  # "full" | "partial" | "missing"


@dataclass(frozen=True)
class EmitterAuditRef:
    manifest_key: str  # top-level manifest format key produced by the emitter
    emitter_module: str  # source file relative to app/bim_ai/


# Alphabetized by manifest_key.
# Do NOT parse modules at runtime — this list is the audit input.
_REGISTRY: tuple[EmitterAuditRef, ...] = (
    EmitterAuditRef("agentReviewActions_v1", "agent_evidence_review_loop.py"),
    EmitterAuditRef(
        "ifcPropertySetCoverageEvidence_v0", "ifc_property_set_coverage_evidence_v0.py"
    ),
    EmitterAuditRef("levelElevationPropagationEvidence_v0", "level_datum_propagation_evidence.py"),
    EmitterAuditRef("roofLayeredPrismWitness_v1", "roof_layered_prism_evidence_v1.py"),
    EmitterAuditRef("roofSectionCutWitness_v0", "roof_layered_prism_evidence_v1.py"),
    EmitterAuditRef("roomColorSchemeOverrideEvidence_v1", "room_color_scheme_override_evidence.py"),
    EmitterAuditRef("roomColourSchemeLegendEvidence_v1", "room_color_scheme_override_evidence.py"),
    EmitterAuditRef(
        "schedulePaginationPlacementEvidence_v0", "schedule_pagination_placement_evidence.py"
    ),
    EmitterAuditRef(
        "sectionOnSheetIntegrationEvidence_v1", "section_on_sheet_integration_evidence_v1.py"
    ),
    EmitterAuditRef("wallCornerJoinEvidence_v0", "wall_join_evidence.py"),
    EmitterAuditRef("wallCornerJoinSummary_v1", "wall_join_evidence.py"),
)


def enumerate_evidence_emitters_v1() -> list[EmitterAuditRef]:
    """Return the curated registry of evidence emitter manifest keys."""
    return list(_REGISTRY)


def _key_present_in_readout(key: str, readout: dict[str, Any]) -> bool:
    """Return True if key appears as a dict key at any nesting level of readout."""
    stack: list[Any] = [readout]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if key in node:
                return True
            for v in node.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(node, list):
            for item in node:
                if isinstance(item, (dict, list)):
                    stack.append(item)
    return False


def _coverage(
    *,
    evidence_present: bool,
    readout_present: bool,
    tracker_present: bool,
) -> Coverage:
    total = int(evidence_present) + int(readout_present) + int(tracker_present)
    if total == 3:
        return "full"
    if total == 0:
        return "missing"
    return "partial"


def build_cross_surface_evidence_audit_manifest_v1(
    doc: dict[str, Any],
    *,
    agent_review_readout: dict[str, Any],
    tracker_row_index: list[str],
) -> dict[str, Any]:
    """Build a deterministic cross-surface evidence audit manifest.

    Args:
        doc: Assembled aggregated evidence package dict (evidencePackage_v1 payload).
        agent_review_readout: Web Agent Review readout dict provided by the caller.
        tracker_row_index: List of tracker row strings provided by the caller.

    Returns:
        crossSurfaceEvidenceAuditManifest_v1 token with per-emitter coverage rows
        and a SHA-256 digest of the canonical body.
    """
    rows: list[dict[str, Any]] = []
    for ref in _REGISTRY:
        key = ref.manifest_key
        evidence_present = key in doc
        readout_present = _key_present_in_readout(key, agent_review_readout)
        tracker_present = any(key in row for row in tracker_row_index)
        rows.append(
            {
                "manifestKey": key,
                "emitterModule": ref.emitter_module,
                "aggregatedEvidenceManifestPresent": evidence_present,
                "agentReviewReadoutPresent": readout_present,
                "trackerRowReferencePresent": tracker_present,
                "coverage": _coverage(
                    evidence_present=evidence_present,
                    readout_present=readout_present,
                    tracker_present=tracker_present,
                ),
            }
        )

    body: dict[str, Any] = {
        "format": FORMAT,
        "schemaVersion": SCHEMA_VERSION,
        "rows": rows,
    }
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**body, "crossSurfaceEvidenceAuditManifestDigestSha256": digest}
