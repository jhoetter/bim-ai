"""Cross-phase state and tree-setup helpers for folder-output orchestrator.

``FolderOutputPhaseState`` holds the mutable state passed between phase
functions in :mod:`bim_ai.services.folder_output`. ``_ensure_tree`` and
``_forbidden_source_root_reason`` are tiny entry-phase helpers that the
orchestrator runs before any phase fires.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class FolderOutputPhaseState:
    """Cross-phase mutable state for ``build_reverse_bim_folder_output``.

    Each phase reads from earlier phases and writes its outputs back onto this
    state. Fields default to ``None`` / empty so the dataclass can be created
    before any phase has run, and the orchestrator can pass it around with no
    keyword-argument explosion.
    """

    # Entry-phase inputs (set by orchestrator before phase 1)
    source_root: Path
    out_dir: Path
    run_id: str | None = None
    reader_responses_provided: bool = False

    # Render & extract phase
    manifest: dict[str, Any] = field(default_factory=dict)
    rendered_pages: list[dict[str, Any]] = field(default_factory=list)
    text_extractions: list[dict[str, Any]] = field(default_factory=list)
    classifications: dict[str, Any] = field(default_factory=dict)
    visual_packet: dict[str, Any] = field(default_factory=dict)
    page_classification_dispatch: dict[str, Any] = field(default_factory=dict)
    page_classification_responses: dict[str, Any] = field(default_factory=dict)
    page_classification_application: dict[str, Any] = field(default_factory=dict)
    work_order: dict[str, Any] = field(default_factory=dict)
    requests: dict[str, Any] = field(default_factory=dict)

    # Reader-pass phase
    discovered_reader_response_diagnostics: list[dict[str, Any]] = field(default_factory=list)
    raw_response_file_count: int = 0
    scanned_response_file_count: int = 0
    raw_response_file_error_count: int = 0
    raw_responses: dict[str, Any] = field(default_factory=dict)
    loop: dict[str, Any] = field(default_factory=dict)
    reader_pass_manifest: dict[str, Any] = field(default_factory=dict)
    reader_assignment_progress: dict[str, Any] = field(default_factory=dict)
    reader_consensus: dict[str, Any] = field(default_factory=dict)
    normalized: dict[str, Any] = field(default_factory=dict)
    reader_response_index: dict[str, Any] = field(default_factory=dict)

    # Facts-derivation phase
    facts: list[dict[str, Any]] = field(default_factory=list)
    source_building_scope: dict[str, Any] = field(default_factory=dict)
    source_level_completeness: dict[str, Any] = field(default_factory=dict)
    room_topology: dict[str, Any] = field(default_factory=dict)
    source_area_consistency: dict[str, Any] = field(default_factory=dict)
    opening_reconciliation: dict[str, Any] = field(default_factory=dict)
    roof_dormer: dict[str, Any] = field(default_factory=dict)

    # Decisions phase (site/conflict/coordinate)
    site_terrain_decision_report: dict[str, Any] = field(default_factory=dict)
    site_terrain: dict[str, Any] = field(default_factory=dict)
    conflicts: dict[str, Any] = field(default_factory=dict)
    conflict_disposition_report: dict[str, Any] = field(default_factory=dict)
    source_material_assemblies: dict[str, Any] = field(default_factory=dict)
    fact_ledger: dict[str, Any] = field(default_factory=dict)
    conflict_dispositions: dict[str, Any] = field(default_factory=dict)
    coordinate_frames: dict[str, Any] = field(default_factory=dict)
    coordinate_frame_alignment_report: dict[str, Any] = field(default_factory=dict)
    coordinate_frame_worklist: dict[str, Any] = field(default_factory=dict)

    # MCP handoff phase
    ir: dict[str, Any] = field(default_factory=dict)
    ir_validation: dict[str, Any] = field(default_factory=dict)
    coverage: dict[str, Any] = field(default_factory=dict)
    readiness: dict[str, Any] = field(default_factory=dict)
    authoring_plan: dict[str, Any] = field(default_factory=dict)
    resolver_worklist: dict[str, Any] = field(default_factory=dict)
    phase_spec: dict[str, Any] = field(default_factory=dict)

    # Acceptance + run-summary phase
    source_completeness: dict[str, Any] = field(default_factory=dict)
    acceptance: dict[str, Any] = field(default_factory=dict)
    run_summary: dict[str, Any] = field(default_factory=dict)
    document_registry: dict[str, Any] = field(default_factory=dict)
    source_page_index: dict[str, Any] = field(default_factory=dict)
    evidence_requirements: dict[str, Any] = field(default_factory=dict)
    tolerance_policy: dict[str, Any] = field(default_factory=dict)
    reader_assignment_prompts: dict[str, Any] = field(default_factory=dict)
    repair_requests_open: dict[str, Any] = field(default_factory=dict)
    source_repair_plan: dict[str, Any] = field(default_factory=dict)


def _ensure_tree(out_dir: Path) -> None:
    for relative in (
        "source/rendered-pages",
        "ai-reading",
        "understanding",
        "mcp-handoff",
        "validation",
        "evidence/source-thumbnails",
        "evidence/page-crops",
    ):
        (out_dir / relative).mkdir(parents=True, exist_ok=True)


def _forbidden_source_root_reason(source_root: Path) -> str | None:
    parts = set(source_root.parts)
    if "seed-artifacts" in parts:
        return (
            "Reverse-BIM source ingestion refuses seed-artifacts paths. "
            "Generated seed bundles are export/inspection artifacts, not source truth."
        )
    for parent in source_root.parents:
        if parent.name.startswith("reverse-bim-") and source_root.name.startswith("target-house-"):
            return (
                "Reverse-BIM source ingestion refuses generated target-house outputs. "
                "Use the original source-document folder for a fresh run."
            )
    return None
