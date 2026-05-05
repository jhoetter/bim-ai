"""Deterministic v1 acceptance proof matrix (prompt-1 / WP-A01, WP-A02, WP-001).

Aggregates PRD §15 Done Rule axes across every relevant subsystem and emits a
manifest readout. This module is aggregation-only — it reads from existing
evidence manifest names but does not add new evidence emitters.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bim_ai.document import Document

# ── Allowed axis states ───────────────────────────────────────────────────────

ALLOWED_AXIS_STATES: frozenset[str] = frozenset({"present", "partial", "missing"})

# ── Seven Done Rule axes (PRD §15) ────────────────────────────────────────────

AXIS_IDS: tuple[str, ...] = (
    "cliFixtureReplay",
    "commandSchema",
    "engineApi",
    "goldenE2eUnitEvidence",
    "snapshotExport",
    "summaryScheduleValidation",
    "webHydrate",
)

# ── Static subsystem assessment rows ─────────────────────────────────────────
# Each row maps the seven Done Rule axes to present | partial | missing and
# lists stable evidenceTokens that are already emitted by other modules.
# Do NOT add new evidence emitters here — aggregation only.

_SUBSYSTEM_ROWS: list[dict[str, Any]] = [
    {
        "subsystemId": "agent_loop",
        "subsystemLabel": "AI-agent production loop",
        "trackerRefs": ["WP-F01", "WP-F02", "WP-F03"],
        "axes": {
            "cliFixtureReplay": "partial",
            "commandSchema": "partial",
            "engineApi": "partial",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "missing",
            "summaryScheduleValidation": "missing",
            "webHydrate": "partial",
        },
        "evidenceTokens": [
            "agentBriefCommandProtocol_v1",
            "agentEvidenceClosureHints",
            "evidenceClosureReview_v1",
            "evidenceLifecycleSignal_v1",
        ],
    },
    {
        "subsystemId": "openbim",
        "subsystemLabel": "OpenBIM exchange (IFC/glTF/BCF)",
        "trackerRefs": ["WP-X02", "WP-X03", "WP-X04", "WP-X05"],
        "axes": {
            "cliFixtureReplay": "partial",
            "commandSchema": "partial",
            "engineApi": "partial",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "partial",
            "summaryScheduleValidation": "partial",
            "webHydrate": "missing",
        },
        "evidenceTokens": [
            "exportLinks",
        ],
    },
    {
        "subsystemId": "performance_collab",
        "subsystemLabel": "Performance and collaboration",
        "trackerRefs": ["WP-P01", "WP-P02"],
        "axes": {
            "cliFixtureReplay": "partial",
            "commandSchema": "missing",
            "engineApi": "partial",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "missing",
            "summaryScheduleValidation": "missing",
            "webHydrate": "partial",
        },
        "evidenceTokens": [],
    },
    {
        "subsystemId": "plan_views",
        "subsystemLabel": "Production plan views",
        "trackerRefs": ["WP-C01", "WP-C02", "WP-C03", "WP-C04", "WP-C05"],
        "axes": {
            "cliFixtureReplay": "partial",
            "commandSchema": "present",
            "engineApi": "present",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "partial",
            "summaryScheduleValidation": "partial",
            "webHydrate": "partial",
        },
        "evidenceTokens": [
            "deterministicPlanViewEvidence",
            "planProjectionWireSample",
            "planViews",
        ],
    },
    {
        "subsystemId": "residential_semantic_kernel",
        "subsystemLabel": "Residential semantic kernel",
        "trackerRefs": ["WP-A01", "WP-B02", "WP-X01"],
        "axes": {
            "cliFixtureReplay": "present",
            "commandSchema": "present",
            "engineApi": "present",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "present",
            "summaryScheduleValidation": "partial",
            "webHydrate": "partial",
        },
        "evidenceTokens": [
            "planViews",
            "roomDerivationCandidates",
            "roomDerivationPreview",
            "typeMaterialRegistry",
        ],
    },
    {
        "subsystemId": "schedules_families_materials",
        "subsystemLabel": "Schedules, families, and materials",
        "trackerRefs": ["WP-A03", "WP-B06"],
        "axes": {
            "cliFixtureReplay": "partial",
            "commandSchema": "present",
            "engineApi": "present",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "present",
            "summaryScheduleValidation": "present",
            "webHydrate": "partial",
        },
        "evidenceTokens": [
            "scheduleIds",
            "typeMaterialRegistry",
        ],
    },
    {
        "subsystemId": "sections_3d_sheets_export",
        "subsystemLabel": "Sections, 3D views, sheets, and export",
        "trackerRefs": ["WP-E02", "WP-E05", "WP-E06"],
        "axes": {
            "cliFixtureReplay": "partial",
            "commandSchema": "present",
            "engineApi": "present",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "partial",
            "summaryScheduleValidation": "partial",
            "webHydrate": "partial",
        },
        "evidenceTokens": [
            "deterministic3dViewEvidence",
            "deterministicSectionCutEvidence",
            "deterministicSheetEvidence",
            "sheetProductionBaseline_v1",
        ],
    },
    {
        "subsystemId": "validation_advisor",
        "subsystemLabel": "Validation and advisor",
        "trackerRefs": ["WP-V01"],
        "axes": {
            "cliFixtureReplay": "present",
            "commandSchema": "partial",
            "engineApi": "present",
            "goldenE2eUnitEvidence": "partial",
            "snapshotExport": "present",
            "summaryScheduleValidation": "present",
            "webHydrate": "partial",
        },
        "evidenceTokens": [
            "validate",
        ],
    },
]


def _axis_coverage(rows: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, dict[str, int]] = {
        axis: {"missing": 0, "partial": 0, "present": 0} for axis in AXIS_IDS
    }
    for row in rows:
        for axis in AXIS_IDS:
            state = str(row["axes"].get(axis, "missing"))
            if state in counts[axis]:
                counts[axis][state] += 1
    return {axis: counts[axis] for axis in sorted(counts)}


def build_v1_acceptance_proof_matrix_v1(doc: Document) -> dict[str, Any]:  # noqa: ARG001
    """Deterministic v1 acceptance proof matrix over PRD §15 Done Rule axes.

    Returns a key-sorted, digest-annotated manifest. Does not emit new evidence
    — only aggregates from existing evidence manifest names.
    """
    rows: list[dict[str, Any]] = sorted(
        [
            {
                "axes": {axis: r["axes"][axis] for axis in sorted(r["axes"])},
                "evidenceTokens": sorted(r["evidenceTokens"]),
                "subsystemId": r["subsystemId"],
                "subsystemLabel": r["subsystemLabel"],
                "trackerRefs": sorted(r["trackerRefs"]),
            }
            for r in _SUBSYSTEM_ROWS
        ],
        key=lambda r: r["subsystemId"],
    )

    axis_coverage = _axis_coverage(rows)

    manifest_body: dict[str, Any] = {
        "axisCoverage": axis_coverage,
        "format": "v1AcceptanceProofMatrix_v1",
        "schemaVersion": 1,
        "subsystemRows": rows,
    }

    canonical = json.dumps(manifest_body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    return {
        **manifest_body,
        "manifestContentDigestSha256": digest,
        "v1AcceptanceProofMatrix_v1": {
            "axisCoverage": axis_coverage,
            "digest": digest,
            "schemaVersion": 1,
        },
    }
