"""Reverse-BIM folder-output orchestrator + phase-module re-exports.

The orchestrator ``build_reverse_bim_folder_output`` is a thin coordinator that
threads ``FolderOutputPhaseState`` through seven phase functions (BRT-20). Each
phase lives in its own module under this subpackage (BRT-26):

- ``state``         — ``FolderOutputPhaseState`` + entry-phase helpers
- ``render``        — phase 1: PDFs/text/classification/visual-trace inputs
- ``reader_pass``   — phase 2: reader response load + agent loop + consensus
- ``facts``         — phase 3: facts-for-handoff + per-aspect source reports
- ``decisions``     — phase 4: site/conflict/coordinate-frame decisions
- ``mcp_handoff``   — phase 5: existing-building IR + MCP readiness/spec
- ``acceptance``    — phase 6: package acceptance + run-summary
- ``repair``        — phase 6 helpers: open-repair-request list + repair plan
- ``artifacts``     — phase 7: artifact path map + writes + ``FolderOutputResponse``

The public surface is exactly ``build_reverse_bim_folder_output``; the private
helpers re-exported here exist for test access only and may move freely.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from bim_ai._io.json_io import write_json as _write_json_shared
from bim_ai._io.log import get_logger
from bim_ai.models.reverse_bim_responses import FolderOutputResponse
from bim_ai.services.folder_output.acceptance import (
    _build_package_acceptance_report,
    _phase_acceptance,
)
from bim_ai.services.folder_output.artifacts import _phase_write_artifacts
from bim_ai.services.folder_output.decisions import _phase_decisions
from bim_ai.services.folder_output.facts import _phase_facts_derivation
from bim_ai.services.folder_output.mcp_handoff import _phase_mcp_handoff
from bim_ai.services.folder_output.reader_pass import (
    _build_reader_response_index,
    _load_reader_response_files,
    _phase_reader_pass,
    _reader_response_payload,
)
from bim_ai.services.folder_output.render import _phase_render_and_extract
from bim_ai.services.folder_output.repair import _build_open_repair_requests
from bim_ai.services.folder_output.state import (
    FolderOutputPhaseState,
    _ensure_tree,
    _forbidden_source_root_reason,
)
from bim_ai.services.source_ingestion import build_folder_manifest

_logger = get_logger("bim_ai.services.folder_output")

# Re-exported for tests that import the in-acceptance helpers directly. These
# names are not part of the public API and may move; pin them only in tests.
__all__ = [
    "FolderOutputPhaseState",
    "build_reverse_bim_folder_output",
    "_build_open_repair_requests",
    "_build_package_acceptance_report",
    "_build_reader_response_index",
    "_load_reader_response_files",
    "_reader_response_payload",
]


def build_reverse_bim_folder_output(
    *,
    root_path: str | Path,
    output_dir: str | Path,
    reader_responses: list[dict[str, Any]] | dict[str, Any] | None = None,
    reader_command: list[str] | None = None,
    reader_timeout_seconds: int = 300,
    reader_consensus_dispositions: list[dict[str, Any]] | dict[str, Any] | None = None,
    building_scope_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
    conflict_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
    coordinate_frame_alignments: list[dict[str, Any]] | dict[str, Any] | None = None,
    site_terrain_decisions: list[dict[str, Any]] | dict[str, Any] | None = None,
    run_id: str | None = None,
    dpi: int = 240,
    max_pages_per_pdf: int | None = None,
    reset_output: bool = False,
) -> FolderOutputResponse:
    """Create the folder-output handoff package for reverse-BIM.

    The output is intentionally useful even when no reader responses exist: it
    packages the source folder and writes the exact AI-reader work still needed.
    When responses are supplied, it normalizes them, validates completeness,
    builds MCP-readiness, and writes the modeling handoff artifacts.

    The body is a thin orchestrator over phase functions (BRT-20). Each phase
    mutates ``FolderOutputPhaseState``; cross-phase wiring lives on the state.
    """

    source_root = Path(root_path).expanduser().resolve()
    out_dir = Path(output_dir).expanduser().resolve()
    _logger.info(
        "build_reverse_bim_folder_output.start",
        extra={
            "phase": "entry",
            "source_root": str(source_root),
            "output_dir": str(out_dir),
            "run_id": run_id,
            "reader_response_count": (
                len(reader_responses) if isinstance(reader_responses, list) else None
            ),
            "reset_output": reset_output,
        },
    )
    if reset_output and out_dir.exists():
        shutil.rmtree(out_dir)
    _ensure_tree(out_dir)

    forbidden_source_reason = _forbidden_source_root_reason(source_root)
    if forbidden_source_reason:
        return _build_source_rejected_response(
            source_root=source_root,
            out_dir=out_dir,
            reason=forbidden_source_reason,
        )

    manifest = build_folder_manifest(source_root)
    if manifest.get("ok") is False:
        _write_json_shared(out_dir / "run-summary.json", manifest)
        return FolderOutputResponse.model_validate(manifest)

    state = FolderOutputPhaseState(
        source_root=source_root,
        out_dir=out_dir,
        run_id=run_id,
        reader_responses_provided=reader_responses is not None,
        manifest=manifest,
    )

    _phase_render_and_extract(state, dpi=dpi, max_pages_per_pdf=max_pages_per_pdf)
    _phase_reader_pass(
        state,
        reader_responses=reader_responses,
        reader_command=reader_command,
        reader_timeout_seconds=reader_timeout_seconds,
        reader_consensus_dispositions=reader_consensus_dispositions,
    )
    _phase_facts_derivation(state, building_scope_decisions=building_scope_decisions)
    _phase_decisions(
        state,
        conflict_decisions=conflict_decisions,
        coordinate_frame_alignments=coordinate_frame_alignments,
        site_terrain_decisions=site_terrain_decisions,
    )
    _phase_mcp_handoff(state)
    _phase_acceptance(state)
    return _phase_write_artifacts(
        state,
        reader_responses=reader_responses,
        reader_consensus_dispositions=reader_consensus_dispositions,
        building_scope_decisions=building_scope_decisions,
    )


def _build_source_rejected_response(
    *,
    source_root: Path,
    out_dir: Path,
    reason: str,
) -> FolderOutputResponse:
    """Phase 0a: write the early-return ``packageState: source_rejected`` package."""
    result = {
        "ok": False,
        "format": "reverseBimFolderOutputPackage_v1",
        "packageState": "source_rejected",
        "sourceFolder": str(source_root),
        "outputDir": str(out_dir),
        "summary": {
            "sourceDocumentCount": 0,
            "renderedPageCount": 0,
            "workPackageCount": 0,
            "openBlockerCount": 1,
        },
        "acceptance": {
            "ok": False,
            "format": "reverseBimFolderOutputAcceptanceReport_v1",
            "packageState": "source_rejected",
            "summary": {"errorCount": 1, "warningCount": 0},
            "findings": [
                {
                    "code": "folder_output_generated_source_rejected",
                    "severity": "error",
                    "message": reason,
                }
            ],
        },
        "nextStep": "Use the original source-document folder, not seed-artifacts or generated reverse-BIM outputs.",
    }
    _write_json_shared(out_dir / "run-summary.json", result)
    _write_json_shared(
        out_dir / "validation" / "package-acceptance-report.json", result["acceptance"]
    )
    return FolderOutputResponse.model_validate(result)
