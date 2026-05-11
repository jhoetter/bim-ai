"""PRD blocking advisor matrix for v1 closeout wave 2 (WP-V01/A01/A02/A04/F01).

Deterministic, checked-in source data covering PRD §11–§15 validation sections with:
- Required rule IDs by PRD section with stable identifiers and deterministic ordering
- Current status: pass | warn | block | deferred
- Explicit structured waiver reason codes for any deferred item
- Golden bundle coverage links for applicable PRD sections
- SHA-256 digest for CI correlation

Not a claim that v1 is complete — deferred items and partial coverage are explicitly modelled.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]

# ── Allowed status and waiver vocabulary ──────────────────────────────────────

ALLOWED_STATUSES: frozenset[str] = frozenset({"pass", "warn", "block", "deferred", "partial"})

ALLOWED_WAIVER_REASON_CODES: frozenset[str] = frozenset(
    {
        "v1_scope_deferred",  # Explicitly out of v1 wave 1/2 scope per tracker
        "partial_coverage_v1",  # Partial rule coverage; full enforcement deferred to a later wave
        "no_rule_impl_v1",  # No constraint rule implemented yet for this PRD class in v1
    }
)

# ── Canonical advisor matrix rows ─────────────────────────────────────────────
# Rows are sorted by `id` (alphabetical) for deterministic ordering.
# `prdNeedle` historically anchored a markdown PRD; it now serves as the
# in-code documentation of the validation class for each row. See the
# workpackage tracker (`spec/workpackage-master-tracker.md`) for outstanding
# backlog associated with these classes.

_PRD_ADVISOR_ROWS: list[dict[str, Any]] = [
    # §11 Datum
    {
        "id": "prd_s11_datum",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Datum",
        "prdNeedle": "Datum: missing level constraints, inconsistent offsets, duplicate level names, invalid FFB/RFB/UKRD chains.",
        "requiredRuleIds": sorted(
            [
                "datum_grid_reference_missing",
                "elevation_marker_view_unresolved",
                "level_datum_parent_cycle",
                "level_datum_parent_offset_mismatch",
                "level_duplicate_elevation",
                "level_parent_unresolved",
                "section_level_reference_missing",
            ]
        ),
        "status": "pass",
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {"kind": "pytest_module", "path": "app/tests/test_level_datum_chain.py"},
            {"kind": "wp_ref", "id": "WP-V01"},
        ],
    },
    # §11 Cleanroom — deferred: specialized vertical, out of core v1 wave 1/2 scope
    {
        "id": "prd_s11_cleanroom",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Cleanroom",
        "prdNeedle": "Cleanroom: missing room class, missing pressure, missing interlock, invalid finish, incomplete door metadata.",
        "requiredRuleIds": sorted(
            [
                "ids_cleanroom_cleanroom_class_missing",
                "ids_cleanroom_door_pressure_metadata_missing",
                "ids_cleanroom_door_without_family_type",
                "ids_cleanroom_interlock_grade_missing",
                "ids_cleanroom_opening_finish_material_missing",
            ]
        ),
        "status": "deferred",
        "waiverReasonCode": "v1_scope_deferred",
        "waiverEvidenceLink": "spec/workpackage-master-tracker.md",
        "waiverNote": (
            "Cleanroom is a specialized vertical outside core v1 wave 1/2 scope. "
            "Rules exist for structural checks; full UX/IDS enforcement deferred per tracker."
        ),
        "goldenBundleCoverage": [],
    },
    # §11 Exchange (partial: IFC/IDS breadth is a known open item; rules pass current gate)
    {
        "id": "prd_s11_exchange",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Exchange",
        "prdNeedle": "Exchange: missing IFC mapping, unexportable categories, IDS violations.",
        "requiredRuleIds": sorted(
            [
                "exchange_ifc_ids_identity_pset_gap",
                "exchange_ifc_ids_qto_gap",
                "exchange_ifc_kernel_geometry_skip_summary",
                "exchange_ifc_material_layer_readback_mismatch",
                "exchange_ifc_roundtrip_count_mismatch",
                "exchange_ifc_roundtrip_programme_mismatch",
                "exchange_ifc_unhandled_geometry_present",
                "exchange_manifest_ifc_gltf_slice_mismatch",
                "material_catalog_missing_layer_stack",
                "material_catalog_missing_material",
                "material_catalog_stale_assembly_reference",
            ]
        ),
        "status": "warn",
        "warnNote": (
            "Core IFC/glTF exchange rules pass. Full IDS validation, arbitrary IFC graph replay, "
            "and unconstrained populated-document merge remain partial per tracker. "
            "Status is warn rather than pass to reflect this partial breadth."
        ),
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {
                "kind": "pytest_module",
                "path": "app/tests/test_exchange_ifc_geometry_skips_advisory.py",
            },
            {"kind": "wp_ref", "id": "WP-A02"},
        ],
    },
    # §11 Geometry
    {
        "id": "prd_s11_geometry",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Geometry",
        "prdNeedle": "Geometry: overlap, zero length, orphaned hosts, openings outside walls, unjoined edges.",
        "requiredRuleIds": sorted(
            [
                "door_not_on_wall",
                "door_off_wall",
                "floor_missing_level",
                "floor_polygon_degenerate",
                "slab_opening_missing_floor",
                "slab_opening_polygon_degenerate",
                "wall_overlap",
                "wall_zero_length",
                "window_off_wall",
                "window_overlaps_door",
            ]
        ),
        "status": "pass",
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {"kind": "wp_ref", "id": "WP-V01"},
        ],
    },
    # §11 Roofs — deferred: no roof constraint rule implemented in v1
    {
        "id": "prd_s11_roofs",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Roofs",
        "prdNeedle": "Roofs: invalid slope, unclosed footprint, unattached gable walls.",
        "requiredRuleIds": [],
        "status": "deferred",
        "waiverReasonCode": "no_rule_impl_v1",
        "waiverEvidenceLink": "spec/workpackage-master-tracker.md",
        "waiverNote": (
            "No roof-specific constraint rules implemented in v1. "
            "Roof geometry evidence exists (roofGeometryEvidence_v0) but dedicated advisor "
            "rules for slope/footprint/gable-wall checks are deferred to a later wave."
        ),
        "goldenBundleCoverage": [],
    },
    # §11 Rooms
    {
        "id": "prd_s11_rooms",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Rooms",
        "prdNeedle": "Rooms: unbounded rooms, overlapping rooms, no separation, missing number/name/area, wrong upper limit.",
        "requiredRuleIds": sorted(
            [
                "room_outline_degenerate",
                "room_overlap_plan",
                "room_programme_inconsistent_within_level",
                "room_programme_metadata_hint",
                "room_target_area_mismatch",
            ]
        ),
        "status": "pass",
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {"kind": "wp_ref", "id": "WP-V01"},
        ],
    },
    # §11 Schedules
    {
        "id": "prd_s11_schedules",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Schedules",
        "prdNeedle": "Schedules: missing required fields, duplicate marks, fields not available.",
        "requiredRuleIds": sorted(
            [
                "schedule_field_registry_gap",
                "schedule_not_placed_on_sheet",
                "schedule_opening_family_type_incomplete",
                "schedule_opening_host_wall_type_incomplete",
                "schedule_opening_identifier_missing",
                "schedule_opening_orphan_host",
                "schedule_sheet_viewport_missing",
                "sheet_viewport_schedule_stale",
            ]
        ),
        "status": "pass",
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {
                "kind": "pytest_module",
                "path": "app/tests/test_schedule_required_field_advisories.py",
            },
            {
                "kind": "pytest_module",
                "path": "app/tests/test_advisor_blocking_class_expansion.py",
            },
            {"kind": "wp_ref", "id": "WP-V01"},
        ],
    },
    # §11 Sheets — tied to reusable seed artifact contract
    {
        "id": "prd_s11_sheets",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Sheets",
        "prdNeedle": "Sheets: missing titleblock, empty viewport, scale mismatch, crop clipping annotations.",
        "requiredRuleIds": sorted(
            [
                "plan_view_sheet_viewport_crop_inverted",
                "plan_view_sheet_viewport_crop_missing",
                "plan_view_sheet_viewport_zero_extent",
                "sheet_missing_titleblock",
                "sheet_revision_issue_metadata_missing",
                "sheet_viewport_unknown_ref",
                "sheet_viewport_zero_extent",
            ]
        ),
        "status": "partial",
        "waiverReasonCode": "partial_coverage_v1",
        "waiverEvidenceLink": "spec/workpackage-master-tracker.md",
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {
                "kind": "pytest_module",
                "path": "app/tests/test_constraints_sheet_documentation_advisory.py",
            },
            {
                "kind": "seed_artifact_contract",
                "path": "spec/seed-artifacts.md",
                "bundleRef": "SKB",
            },
            {"kind": "wp_ref", "id": "WP-V01"},
        ],
    },
    # §11 Stairs
    {
        "id": "prd_s11_stairs",
        "prdSection": "§11",
        "prdSectionTitle": "Validation and Advisor Requirements — Stairs",
        "prdNeedle": "Stairs: riser/tread impossible, missing headroom, no landing, no slab opening.",
        "requiredRuleIds": sorted(
            [
                "stair_geometry_unreasonable",
                "stair_missing_levels",
                "stair_schedule_degenerate_run",
                "stair_schedule_guardrail_placeholder_uncorrelated",
                "stair_schedule_incomplete_riser_tread",
            ]
        ),
        "status": "pass",
        "goldenBundleCoverage": [
            {"kind": "pytest_module", "path": "app/tests/test_constraints.py"},
            {"kind": "pytest_module", "path": "app/tests/test_stair_geometry_evidence.py"},
            {"kind": "wp_ref", "id": "WP-V01"},
        ],
    },
    # §12 Exchange replay — golden bundle test gate
    {
        "id": "prd_s12_exchange_replay",
        "prdSection": "§12",
        "prdSectionTitle": "Exchange Requirements — JSON command bundle replay",
        "prdNeedle": "JSON command bundle: canonical internal replay.",
        "requiredRuleIds": [],
        "status": "pass",
        "goldenBundleCoverage": [
            {
                "kind": "seed_artifact_contract",
                "path": "spec/seed-artifacts.md",
                "bundleRef": "SKB",
            },
            {
                "kind": "pytest_module",
                "path": "app/tests/test_seed_artifact_roundtrip.py",
            },
            {
                "kind": "pytest_module",
                "path": "app/tests/test_undo_replay_constraint.py",
            },
            {"kind": "wp_ref", "id": "WP-A01"},
        ],
    },
    # §14 Phase A golden bundle
    {
        "id": "prd_s14_golden_bundle",
        "prdSection": "§14",
        "prdSectionTitle": "Roadmap Phase A — Golden reference command bundle",
        "prdNeedle": "Build golden command bundle for reference two-storey house.",
        "requiredRuleIds": [],
        "status": "pass",
        "goldenBundleCoverage": [
            {
                "kind": "seed_artifact_contract",
                "path": "spec/seed-artifacts.md",
                "bundleRef": "SKB",
            },
            {
                "kind": "pytest_module",
                "path": "app/tests/test_seed_artifact_roundtrip.py",
            },
            {"kind": "wp_ref", "id": "WP-A01"},
        ],
    },
    # §15 Golden fixture proves replay
    {
        "id": "prd_s15_golden_fixture",
        "prdSection": "§15",
        "prdSectionTitle": "Verification Strategy — Golden fixture proves replay",
        "prdNeedle": "Golden fixture proves replay.",
        "requiredRuleIds": [],
        "status": "pass",
        "goldenBundleCoverage": [
            {
                "kind": "pytest_module",
                "path": "app/tests/test_golden_exchange_fixture.py",
            },
            {"kind": "wp_ref", "id": "WP-A04"},
        ],
    },
    # §15 Python unit tests
    {
        "id": "prd_s15_python_unit_tests",
        "prdSection": "§15",
        "prdSectionTitle": "Verification Strategy — Python unit tests for commands and rules",
        "prdNeedle": "Python unit tests for each command and regeneration rule.",
        "requiredRuleIds": [],
        "status": "pass",
        "goldenBundleCoverage": [
            {"kind": "ci_config", "path": ".github/workflows/ci.yml"},
            {"kind": "wp_ref", "id": "WP-A04"},
        ],
    },
]

# Enforce deterministic row order at module load time.
_PRD_ADVISOR_ROWS = sorted(_PRD_ADVISOR_ROWS, key=lambda r: str(r["id"]))


# ── Validation ────────────────────────────────────────────────────────────────


def validate_prd_advisor_matrix_rows(rows: list[dict[str, Any]]) -> list[str]:
    """Validate a list of PRD advisor matrix rows. Returns a list of error strings (empty = ok)."""
    errors: list[str] = []
    seen_ids: set[str] = set()

    for row in rows:
        row_id = str(row.get("id") or "<missing>")

        if not row.get("id"):
            errors.append(f"Row missing required field 'id': {row!r}")
        if not row.get("prdSection"):
            errors.append(f"{row_id}: missing required field 'prdSection'")
        if not row.get("prdSectionTitle"):
            errors.append(f"{row_id}: missing required field 'prdSectionTitle'")
        if not row.get("prdNeedle"):
            errors.append(f"{row_id}: missing required field 'prdNeedle'")

        status = str(row.get("status") or "")
        if status not in ALLOWED_STATUSES:
            errors.append(
                f"{row_id}: invalid status {status!r}; allowed: {sorted(ALLOWED_STATUSES)}"
            )

        if row_id in seen_ids:
            errors.append(f"Duplicate row id: {row_id!r}")
        seen_ids.add(row_id)

        if status in ("deferred", "partial"):
            waiver_code = str(row.get("waiverReasonCode") or "")
            if not waiver_code:
                errors.append(
                    f"{row_id}: {status} row must have 'waiverReasonCode'; "
                    f"allowed: {sorted(ALLOWED_WAIVER_REASON_CODES)}"
                )
            elif waiver_code not in ALLOWED_WAIVER_REASON_CODES:
                errors.append(
                    f"{row_id}: unknown waiverReasonCode {waiver_code!r}; "
                    f"allowed: {sorted(ALLOWED_WAIVER_REASON_CODES)}"
                )
            if not row.get("waiverEvidenceLink"):
                errors.append(f"{row_id}: {status} row must have 'waiverEvidenceLink'")
        else:
            if row.get("waiverReasonCode"):
                errors.append(
                    f"{row_id}: non-deferred row must not have 'waiverReasonCode' "
                    f"(status={status!r})"
                )

    ids = [str(r.get("id") or "") for r in rows]
    if ids != sorted(ids):
        errors.append(f"Rows are not sorted by id; expected {sorted(ids)}, got {ids}")

    return errors


# ── Build ─────────────────────────────────────────────────────────────────────


def build_prd_blocking_advisor_matrix() -> dict[str, Any]:
    """Build the deterministic PRD blocking advisor matrix with a content digest.

    Returns a dict with:
      - format / schemaVersion
      - rows: sorted list of PRD section advisor rows
      - statusCounts: summary of pass/warn/block/deferred counts
      - matrixContentDigestSha256: SHA-256 of the canonical row body
    """
    rows = _PRD_ADVISOR_ROWS  # already sorted at module load
    errors = validate_prd_advisor_matrix_rows(rows)

    status_counts: dict[str, int] = {s: 0 for s in sorted(ALLOWED_STATUSES)}
    for row in rows:
        st = str(row.get("status") or "")
        if st in status_counts:
            status_counts[st] += 1

    body: dict[str, Any] = {
        "format": "prdBlockingAdvisorMatrix_v1",
        "schemaVersion": 1,
        "rows": rows,
        "statusCounts": status_counts,
        "allowedStatuses": sorted(ALLOWED_STATUSES),
        "allowedWaiverReasonCodes": sorted(ALLOWED_WAIVER_REASON_CODES),
        "validationErrors": sorted(errors),
        "note": (
            "Deterministic PRD blocking advisor matrix for WP-V01/A01/A02/A04/F01 v1 closeout wave 2. "
            "Does not claim v1 completion; deferred items are explicitly modelled with waiver evidence."
        ),
    }

    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**body, "matrixContentDigestSha256": digest}


def prd_advisor_matrix_summary() -> dict[str, Any]:
    """Compact summary suitable for embedding in the v1 closeout readiness manifest."""
    m = build_prd_blocking_advisor_matrix()
    rows = m["rows"]
    return {
        "format": "prdAdvisorMatrixSummary_v1",
        "totalSections": len(rows),
        "statusCounts": m["statusCounts"],
        "deferredCount": m["statusCounts"].get("deferred", 0),
        "blockCount": m["statusCounts"].get("block", 0),
        "warnCount": m["statusCounts"].get("warn", 0),
        "passCount": m["statusCounts"].get("pass", 0),
        "deferredSectionIds": sorted(r["id"] for r in rows if r.get("status") == "deferred"),
        "blockingSectionIds": sorted(r["id"] for r in rows if r.get("status") == "block"),
        "matrixContentDigestSha256": m["matrixContentDigestSha256"],
        "validationErrors": m["validationErrors"],
    }


def prdBlockingAdvisorMatrixExpansion_v1() -> dict[str, Any]:
    """Complete rule inventory with blocking class, severity, and quick-fix availability (PRD §11-§15)."""
    from bim_ai.constraints import (  # noqa: PLC0415
        _RULE_BLOCKING_CLASS,
        AdvisorBlockingClass,
    )

    _NEW_RULE_SEVERITY: dict[str, str] = {
        "schedule_not_placed_on_sheet": "warning",
        "sheet_viewport_schedule_stale": "warning",
        "schedule_field_registry_gap": "info",
    }
    _NEW_RULE_HAS_QUICK_FIX: dict[str, bool] = {
        "schedule_not_placed_on_sheet": True,
        "sheet_viewport_schedule_stale": True,
        "schedule_field_registry_gap": False,
    }

    new_rule_ids = sorted(_NEW_RULE_SEVERITY.keys())
    new_rows = [
        {
            "ruleId": rid,
            "blockingClass": _RULE_BLOCKING_CLASS.get(
                rid, AdvisorBlockingClass.documentation.value
            ),
            "severity": _NEW_RULE_SEVERITY[rid],
            "hasQuickFix": _NEW_RULE_HAS_QUICK_FIX[rid],
            "prdSection": "§11",
        }
        for rid in new_rule_ids
    ]

    full_inventory = [
        {
            "ruleId": rid,
            "blockingClass": _RULE_BLOCKING_CLASS[rid],
        }
        for rid in sorted(_RULE_BLOCKING_CLASS.keys())
    ]

    return {
        "format": "prdBlockingAdvisorMatrixExpansion_v1",
        "newRules": new_rows,
        "fullRuleInventory": full_inventory,
        "totalRules": len(full_inventory),
    }
