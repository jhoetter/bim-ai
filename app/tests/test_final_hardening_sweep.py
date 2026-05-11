"""Structural assertions for prompt-8 final hardening sweep (WP-V01, WP-D06, WP-A04)."""

from __future__ import annotations

import ast
import pathlib

_REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

# Curated allow-list: files touched during wave-4 (git log --since='2026-04-01').
# Prompt-8 changes must be a strict subset of this set.
WAVE_4_TOUCHED_FILES: frozenset[str] = frozenset(
    {
        "app/bim_ai/__init__.py",
        "app/bim_ai/agent_brief_acceptance_readout.py",
        "app/bim_ai/agent_brief_command_protocol.py",
        "app/bim_ai/agent_evidence_review_loop.py",
        "app/bim_ai/agent_generated_bundle_qa_checklist.py",
        "app/bim_ai/agent_review_readout_consistency_closure.py",
        "app/bim_ai/bcf_issue_package_export.py",
        "app/bim_ai/ci_gate_runner.py",
        "app/bim_ai/codes.py",
        "app/bim_ai/commands.py",
        "app/bim_ai/config.py",
        "app/bim_ai/constraints.py",
        "app/bim_ai/cut_solid_kernel.py",
        "app/bim_ai/datum_levels.py",
        "app/bim_ai/db.py",
        "app/bim_ai/document.py",
        "app/bim_ai/elements.py",
        "app/bim_ai/engine.py",
        "app/bim_ai/evidence_manifest.py",
        "app/bim_ai/evidence_replay_determinism_harness.py",
        "app/bim_ai/export_gltf.py",
        "app/bim_ai/export_ifc.py",
        "app/bim_ai/geometry.py",
        "app/bim_ai/hub.py",
        "app/bim_ai/ifc_material_layer_exchange_v0.py",
        "app/bim_ai/ifc_property_set_coverage_evidence_v0.py",
        "app/bim_ai/ifc_stub.py",
        "app/bim_ai/kernel_ifc_opening_replay_v0.py",
        "app/bim_ai/level_datum_propagation_evidence.py",
        "app/bim_ai/main.py",
        "app/bim_ai/material_assembly_resolve.py",
        "app/bim_ai/model_summary.py",
        "app/bim_ai/opening_cut_primitives.py",
        "app/bim_ai/plan_aa_room_separation.py",
        "app/bim_ai/plan_category_graphics.py",
        "app/bim_ai/plan_projection_wire.py",
        "app/bim_ai/prd_blocking_advisor_matrix.py",
        "app/bim_ai/prd_closeout_cross_correlation.py",
        "app/bim_ai/roof_geometry.py",
        "app/bim_ai/roof_layered_prism_evidence_v1.py",
        "app/bim_ai/room_color_scheme_override_evidence.py",
        "app/bim_ai/room_derivation.py",
        "app/bim_ai/room_derivation_preview.py",
        "app/bim_ai/room_finish_schedule.py",
        "app/bim_ai/routes_api.py",
        "app/bim_ai/schedule_csv.py",
        "app/bim_ai/schedule_derivation.py",
        "app/bim_ai/schedule_field_registry.py",
        "app/bim_ai/schedule_pagination_placement_evidence.py",
        "app/bim_ai/schedule_sheet_export_parity.py",
        "app/bim_ai/section_on_sheet_integration_evidence_v1.py",
        "app/bim_ai/section_projection_primitives.py",
        "app/bim_ai/sheet_preview_pdf.py",
        "app/bim_ai/sheet_preview_svg.py",
        "app/bim_ai/sheet_titleblock_revision_issue_v1.py",
        "app/bim_ai/stair_plan_proxy.py",
        "app/bim_ai/tables.py",
        "app/bim_ai/type_material_registry.py",
        "app/bim_ai/v1_acceptance_proof_matrix.py",
        "app/bim_ai/v1_closeout_readiness_manifest.py",
        "app/bim_ai/wall_join_evidence.py",
        "app/bim_ai/wall_opening_cut_fidelity.py",
        "app/tests/test_advisor_blocking_class_expansion.py",
        "app/tests/test_agent_brief_acceptance_readout.py",
        "app/tests/test_agent_brief_command_protocol.py",
        "app/tests/test_agent_evidence_loop_closure.py",
        "app/tests/test_agent_generated_bundle_qa_checklist.py",
        "app/tests/test_agent_review_readout_consistency_closure.py",
        "app/tests/test_ci_gate_runner.py",
        "app/tests/test_constraints.py",
        "app/tests/test_constraints_discipline.py",
        "app/tests/test_constraints_room_programme_consistency.py",
        "app/tests/test_constraints_schedule_sheet_link.py",
        "app/tests/test_constraints_sheet_documentation_advisory.py",
        "app/tests/test_cut_solid_kernel.py",
        "app/tests/test_derived_performance_budget.py",
        "app/tests/test_deterministic_sheet_evidence.py",
        "app/tests/test_engine_constraints.py",
        "app/tests/test_evidence_agent_follow_through.py",
        "app/tests/test_evidence_agent_review_loop.py",
        "app/tests/test_evidence_baseline_lifecycle_readout.py",
        "app/tests/test_evidence_manifest_closure.py",
        "app/tests/test_evidence_package_digest.py",
        "app/tests/test_evidence_replay_determinism_harness.py",
        "app/tests/test_exchange_ifc_geometry_skips_advisory.py",
        "app/tests/test_export_gltf.py",
        "app/tests/test_export_ifc.py",
        "app/tests/test_export_ifc_door_material_readback.py",
        "app/tests/test_final_hardening_sweep.py",
        "app/tests/test_gltf_export_manifest_closure.py",
        "app/tests/test_golden_exchange_fixture.py",
        "app/tests/test_ids_enforcement.py",
        "app/tests/test_ifc_exchange_manifest_offline.py",
        "app/tests/test_ifc_pset_qto_deepening.py",
        "app/tests/test_kernel_schedule_exports.py",
        "app/tests/test_layered_assembly_cut_alignment.py",
        "app/tests/test_level_datum_chain.py",
        "app/tests/test_material_assembly_schedule.py",
        "app/tests/test_seed_artifact_roundtrip.py",
        "app/tests/test_opening_cut_primitives.py",
        "app/tests/test_plan_on_sheet_viewport_evidence.py",
        "app/tests/test_plan_projection_and_evidence_slices.py",
        "app/tests/test_plan_template_tag_matrix_advisor.py",
        "app/tests/test_plan_view_template_application.py",
        "app/tests/test_prd_blocking_advisor_matrix.py",
        "app/tests/test_prd_closeout_cross_correlation.py",
        "app/tests/test_prd_traceability_matrix.py",
        "app/tests/test_roof_pitch_evidence.py",
        "app/tests/test_room_color_scheme_override_evidence.py",
        "app/tests/test_room_derivation_preview.py",
        "app/tests/test_room_finish_schedule_evidence.py",
        "app/tests/test_room_programme_unbounded_evidence.py",
        "app/tests/test_room_rectangle.py",
        "app/tests/test_room_target_area.py",
        "app/tests/test_saved_3d_view_clip_evidence.py",
        "app/tests/test_schedule_category_field_coverage.py",
        "app/tests/test_schedule_derivation.py",
        "app/tests/test_schedule_door_material_key_column.py",
        "app/tests/test_schedule_field_registry.py",
        "app/tests/test_schedule_opening_computed_fields.py",
        "app/tests/test_schedule_required_field_advisories.py",
        "app/tests/test_schedule_row_filters.py",
        "app/tests/test_schedule_sheet_export_parity.py",
        "app/tests/test_schedule_sort_stable.py",
        "app/tests/test_schema_advisor.py",
        "app/tests/test_section_material_hatch_and_scale_evidence.py",
        "app/tests/test_section_on_sheet_integration_evidence.py",
        "app/tests/test_section_sheet_callouts_evidence.py",
        "app/tests/test_sheet_export.py",
        "app/tests/test_sheet_export_ci_baseline_gate_v3.py",
        "app/tests/test_sheet_print_raster_export_closure.py",
        "app/tests/test_sheet_print_raster_placeholder.py",
        "app/tests/test_sheet_viewport_production_hardening.py",
        "app/tests/test_site_context.py",
        "app/tests/test_skew_wall_hosted_opening_evidence.py",
        "app/tests/test_stair_geometry_evidence.py",
        "app/tests/test_undo_replay_constraint.py",
        "app/tests/test_update_element_property_door_material.py",
        "app/tests/test_update_element_property_plan_view.py",
        "app/tests/test_update_element_property_roof.py",
        "app/tests/test_upsert_schedule_filters_grouping.py",
        "app/tests/test_upsert_sheet_viewports.py",
        "app/tests/test_v1_acceptance_proof_matrix.py",
        "app/tests/test_v1_closeout_readiness_manifest.py",
        "app/tests/test_wall_corner_join_summary_v1.py",
        "app/tests/test_wall_datums.py",
        "app/tests/test_wall_join_evidence.py",
        "app/tests/test_wall_opening_cut_fidelity_v1.py",
    }
)

# Files modified by this prompt (prompt-8).
PROMPT_8_CHANGED_FILES: frozenset[str] = frozenset(
    {
        "app/bim_ai/constraints.py",
        "app/bim_ai/export_ifc.py",
        "app/tests/test_final_hardening_sweep.py",
        "app/tests/test_ifc_pset_qto_deepening.py",
    }
)

# Module name prefixes whose per-function imports are forbidden in the deepening test.
_HOISTED_PREFIXES: frozenset[str] = frozenset(
    {
        "ifcopenshell",
        "bim_ai.export_ifc",
        "bim_ai.ifc_property_set_coverage_evidence_v0",
        "bim_ai.ifc_stub",
    }
)


def _import_matches(name: str) -> bool:
    return any(name == p or name.startswith(p + ".") for p in _HOISTED_PREFIXES)


def test_no_inline_imports_in_ifc_pset_qto_deepening() -> None:
    """test_ifc_pset_qto_deepening.py must have zero per-function imports for the hoisted names."""
    target = _REPO_ROOT / "app" / "tests" / "test_ifc_pset_qto_deepening.py"
    tree = ast.parse(target.read_text())

    violations: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for child in ast.walk(node):
            if isinstance(child, ast.Import):
                for alias in child.names:
                    if _import_matches(alias.name):
                        violations.append(
                            f"line {child.lineno}: per-function `import {alias.name}` in {node.name}"
                        )
            elif isinstance(child, ast.ImportFrom):
                module = child.module or ""
                if _import_matches(module):
                    names = ", ".join(a.name for a in child.names)
                    violations.append(
                        f"line {child.lineno}: per-function `from {module} import {names}` in {node.name}"
                    )

    assert not violations, (
        f"Found {len(violations)} per-function import(s) that should be module-level:\n"
        + "\n".join(f"  {v}" for v in violations)
    )


def test_prompt_8_files_within_wave_4_scope() -> None:
    """Every file changed by prompt-8 must appear in the wave-4 allow-list."""
    out_of_scope = PROMPT_8_CHANGED_FILES - WAVE_4_TOUCHED_FILES
    assert not out_of_scope, f"Prompt-8 changed files outside wave-4 scope: {sorted(out_of_scope)}"
