"""PRD tracker reconciliation manifest (Wave 5 / WP-001 / WP-A02).

Reconciles PRD requirements against the workpackage tracker so wave-5 closeout
can prove every PRD acceptance axis has a tracker home (or is explicitly deferred).
Surfaces orphan PRD requirements and stale tracker rows in a single deterministic
manifest.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_PRD_PATH = _REPO_ROOT / "spec" / "prd" / "revit-production-parity-ai-agent-prd.md"
_TRACKER_PATH = _REPO_ROOT / "spec" / "revit-production-parity-workpackage-tracker.md"

COVERAGE_TOKENS: frozenset[str] = frozenset({"covered", "partial", "deferred", "orphan"})


@dataclass(frozen=True)
class PrdAnchor:
    sectionId: str
    title: str
    level: int  # 2 for ##, 3 for ###


@dataclass(frozen=True)
class TrackerRow:
    id: str
    title: str
    state: str


def _slugify(text: str) -> str:
    """Convert heading text to a stable snake_case section ID."""
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def parse_prd_section_anchors_v1(prd_path: str | Path) -> list[PrdAnchor]:
    """Parse ## and ### headings from the PRD into sorted PrdAnchor list."""
    text = Path(prd_path).read_text(encoding="utf-8")
    anchors: list[PrdAnchor] = []
    for line in text.splitlines():
        if line.startswith("### "):
            title = line[4:].strip()
            anchors.append(PrdAnchor(sectionId=_slugify(title), title=title, level=3))
        elif line.startswith("## "):
            title = line[3:].strip()
            anchors.append(PrdAnchor(sectionId=_slugify(title), title=title, level=2))
    anchors.sort(key=lambda a: a.sectionId)
    return anchors


def parse_tracker_workpackages_v1(tracker_path: str | Path) -> list[TrackerRow]:
    """Parse the ## Current Workpackages table into ordered TrackerRow list."""
    text = Path(tracker_path).read_text(encoding="utf-8")
    rows: list[TrackerRow] = []
    in_section = False
    for line in text.splitlines():
        if line.strip() == "## Current Workpackages":
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if in_section and line.startswith("| WP-"):
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                rows.append(TrackerRow(id=parts[1], title=parts[2], state=parts[3]))
    return rows


# Hard-coded mapping: PRD sectionId → list of workpackage IDs (or "deferred" sentinel).
# This dict is the artifact — a hand-curated reconciliation of PRD sections to tracker WPs.
_PRD_TO_WORKPACKAGES: dict[str, list[str]] = {
    # §5 Screenshot-by-Screenshot Requirements
    "5_screenshot_by_screenshot_requirements": ["WP-A01", "WP-A02", "WP-A03"],
    "5_1_r1_exterior_3d_house_with_site_context": ["WP-B04", "WP-E01", "WP-E02", "WP-E03"],
    "5_2_r2_eg_floor_plan_with_doors_windows_stair_garage": [
        "WP-B02",
        "WP-B05",
        "WP-B06",
        "WP-C01",
        "WP-C02",
        "WP-C03",
    ],
    "5_3_r3_og_colored_room_plan": ["WP-B06", "WP-C04"],
    "5_4_r4_window_schedule": ["WP-D01", "WP-D02", "WP-D03", "WP-D04"],
    "5_5_r5_3d_cutaway_interior_view": ["WP-E01", "WP-E02", "WP-E03"],
    "5_6_r6_r7_sheet_layout_with_sections_details_titleblock": [
        "WP-E04",
        "WP-E05",
        "WP-E06",
    ],
    # §6 Model Kernel Requirements
    "6_model_kernel_requirements": [
        "WP-B01",
        "WP-B02",
        "WP-B03",
        "WP-B04",
        "WP-B05",
        "WP-B06",
    ],
    "6_1_semantic_source_of_truth": ["WP-000", "WP-X01"],
    "6_2_regeneration_engine": ["WP-B01", "WP-B02", "WP-B03", "WP-B04", "WP-B05"],
    # §7 Browser Product Requirements
    "7_browser_product_requirements": ["WP-C01", "WP-C05"],
    "7_1_workspace_layout": ["WP-C05"],
    "7_2_plan_authoring": ["WP-C01", "WP-C02", "WP-C03"],
    "7_3_documentation_view_rendering": ["WP-C01", "WP-C02", "WP-C03", "WP-E04"],
    # §8 AI-Agent Planning Requirements
    "8_ai_agent_planning_requirements": ["WP-F01", "WP-F02", "WP-F03"],
    "8_1_agent_inputs": ["WP-A01", "WP-F01"],
    "8_2_agent_planning_pipeline": ["WP-F01", "WP-F02"],
    "8_3_agent_evidence_artifacts": ["WP-A02", "WP-A03", "WP-F02", "WP-F03"],
    # §9 Schedules, Quantities, and Computations
    "9_schedules_quantities_and_computations": ["WP-D01", "WP-D02", "WP-D03"],
    # §10 Asset and Library Requirements
    "10_asset_and_library_requirements": ["WP-D04", "WP-D05", "WP-D06"],
    "10_1_family_type_libraries": ["WP-D04"],
    "10_2_asset_metadata": ["WP-D05", "WP-D06"],
    # §11 Validation and Advisor Requirements
    "11_validation_and_advisor_requirements": ["WP-A04", "WP-V01"],
    # §12 Exchange Requirements
    "12_exchange_requirements": [
        "WP-X01",
        "WP-X02",
        "WP-X03",
        "WP-X04",
        "WP-X05",
        "WP-X06",
    ],
    # §13 Performance and Collaboration
    "13_performance_and_collaboration": ["WP-P01", "WP-P02"],
    # §14 Roadmap
    "14_roadmap": ["WP-001"],
    "phase_a_evidence_and_baseline": ["WP-A01", "WP-A02", "WP-A03", "WP-A04"],
    "phase_b_real_residential_model_kernel": [
        "WP-B01",
        "WP-B02",
        "WP-B03",
        "WP-B04",
        "WP-B05",
        "WP-B06",
    ],
    "phase_c_production_plan_views": [
        "WP-C01",
        "WP-C02",
        "WP-C03",
        "WP-C04",
        "WP-C05",
    ],
    "phase_d_families_types_materials": [
        "WP-D01",
        "WP-D02",
        "WP-D03",
        "WP-D04",
        "WP-D05",
        "WP-D06",
    ],
    "phase_e_sections_3d_cutaways_sheets": [
        "WP-E01",
        "WP-E02",
        "WP-E03",
        "WP-E04",
        "WP-E05",
        "WP-E06",
    ],
    "phase_f_ai_agent_production_loop": ["WP-F01", "WP-F02", "WP-F03"],
    # §15 Verification Strategy
    "15_verification_strategy": ["WP-001", "WP-A01", "WP-A02", "WP-A03", "WP-A04"],
}

# Sections explicitly deferred (no workpackage assignment expected in v1 scope).
_DEFERRED_SECTIONS: frozenset[str] = frozenset(
    {
        "1_executive_summary",
        "2_reference_inputs",
        "2_1_supplied_revit_tutorial_screenshots",
        "2_2_existing_bim_ai_docs",
        "2_3_current_browser_baseline",
        "3_product_vision",
        "4_current_state_vs_target_state",
        "16_non_goals_and_guardrails",
        "17_open_questions",
        "18_immediate_recommendation",
    }
)


def _compute_coverage(
    section_id: str,
    wp_ids: list[str],
    state_by_wp: dict[str, str],
) -> str:
    """Derive the coverage token for one PRD anchor row."""
    if section_id in _DEFERRED_SECTIONS:
        return "deferred"
    if not wp_ids:
        return "orphan"
    if all(state_by_wp.get(wp_id, "partial") == "done" for wp_id in wp_ids):
        return "covered"
    return "partial"


def build_prd_tracker_reconciliation_manifest_v1(
    prd_path: str | Path | None = None,
    tracker_path: str | Path | None = None,
) -> dict[str, Any]:
    """Build the deterministic PRD-tracker reconciliation manifest.

    Returns a dict with prdTrackerReconciliationManifest_v1 token, schemaVersion,
    reconciliation rows sorted by sectionId, staleTrackerRows, and a SHA-256 digest.
    """
    prd_path = Path(prd_path) if prd_path else _PRD_PATH
    tracker_path = Path(tracker_path) if tracker_path else _TRACKER_PATH

    anchors = parse_prd_section_anchors_v1(prd_path)
    tracker_rows = parse_tracker_workpackages_v1(tracker_path)

    state_by_wp: dict[str, str] = {row.id: row.state for row in tracker_rows}

    # Build set of all WP IDs referenced in the mapping
    all_mapped_wp_ids: set[str] = set()
    for wp_list in _PRD_TO_WORKPACKAGES.values():
        all_mapped_wp_ids.update(wp_list)

    # Reconciliation rows — one per PRD anchor
    recon_rows: list[dict[str, Any]] = []
    for anchor in anchors:
        sid = anchor.sectionId
        wp_ids = sorted(_PRD_TO_WORKPACKAGES.get(sid, []))
        coverage = _compute_coverage(sid, wp_ids, state_by_wp)
        recon_rows.append(
            {
                "prdSectionId": sid,
                "prdSectionTitle": anchor.title,
                "prdSectionLevel": anchor.level,
                "workpackageIds": wp_ids,
                "coverage": coverage,
            }
        )

    recon_rows.sort(key=lambda r: str(r["prdSectionId"]))

    # Stale tracker rows — tracker WP IDs not referenced in the mapping at all
    stale_rows: list[dict[str, Any]] = [
        {"workpackageId": row.id, "title": row.title, "state": row.state}
        for row in tracker_rows
        if row.id not in all_mapped_wp_ids
    ]
    stale_rows.sort(key=lambda r: str(r["workpackageId"]))

    # Coverage summary counts
    coverage_counts: dict[str, int] = {t: 0 for t in sorted(COVERAGE_TOKENS)}
    for row in recon_rows:
        t = str(row.get("coverage") or "")
        if t in coverage_counts:
            coverage_counts[t] += 1

    body: dict[str, Any] = {
        "format": "prdTrackerReconciliationManifest_v1",
        "schemaVersion": 1,
        "reconciliationRows": recon_rows,
        "staleTrackerRows": stale_rows,
        "coverageCounts": coverage_counts,
        "allowedCoverageTokens": sorted(COVERAGE_TOKENS),
        "note": (
            "Deterministic PRD-tracker reconciliation for WP-001/WP-A02 wave-5 closeout. "
            "Mapping is hand-curated — the dict is itself the artifact. "
            "orphan rows have no tracker assignment and are not explicitly deferred."
        ),
    }

    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return {**body, "prdTrackerReconciliationDigestSha256": digest}
