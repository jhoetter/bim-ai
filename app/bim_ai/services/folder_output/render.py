"""Phase 1: render PDFs, extract text, classify documents, build visual trace inputs."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from bim_ai.services.folder_output.state import FolderOutputPhaseState
from bim_ai.services.source_agent_loop import build_ai_visual_trace_agent_requests
from bim_ai.services.source_ingestion import (
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
    classify_documents,
    extract_pdf_text,
    render_pdf_pages,
)
from bim_ai.source_page_classification import (
    apply_page_classifications,
    build_page_classification_dispatch_plan,
    load_page_classification_responses,
)


def _phase_render_and_extract(
    state: FolderOutputPhaseState,
    *,
    dpi: int,
    max_pages_per_pdf: int | None,
) -> None:
    """Phase 1: render PDFs, extract text, classify documents, build visual trace inputs."""
    state.rendered_pages, state.text_extractions = _render_and_extract(
        manifest=state.manifest,
        output_dir=state.out_dir / "source" / "rendered-pages",
        dpi=dpi,
        max_pages_per_pdf=max_pages_per_pdf,
    )
    state.classifications = classify_documents(
        state.manifest, text_extractions=state.text_extractions
    )
    state.visual_packet = build_ai_visual_trace_packet(
        manifest=state.manifest,
        classifications=state.classifications,
        rendered_pages=state.rendered_pages,
        text_extractions=state.text_extractions,
    )
    state.page_classification_dispatch = build_page_classification_dispatch_plan(
        visual_packet=state.visual_packet,
        output_dir=state.out_dir,
        mode="auto",
        write_assignments=True,
    )
    state.page_classification_responses = load_page_classification_responses(state.out_dir)
    state.page_classification_application = apply_page_classifications(
        state.visual_packet,
        responses=state.page_classification_responses.get("responses") or [],
    )
    state.work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=state.visual_packet)
    state.requests = build_ai_visual_trace_agent_requests(
        work_order=state.work_order,
        run_id=state.run_id,
    )


def _render_and_extract(
    *,
    manifest: dict[str, Any],
    output_dir: Path,
    dpi: int,
    max_pages_per_pdf: int | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rendered_pages: list[dict[str, Any]] = []
    text_extractions: list[dict[str, Any]] = []
    for file_row in manifest.get("files") or []:
        if not isinstance(file_row, dict) or file_row.get("kind") != "pdf":
            continue
        source_path = str(file_row.get("absolutePath") or "")
        source_doc_id = str(file_row.get("sourceDocumentId") or "source")
        render = render_pdf_pages(
            source_path,
            output_dir=output_dir / source_doc_id,
            dpi=dpi,
            first_page=1 if max_pages_per_pdf else None,
            last_page=max_pages_per_pdf,
        )
        rendered_pages.append(render)
        text_extractions.append(extract_pdf_text(source_path, max_pages=max_pages_per_pdf))
    return rendered_pages, text_extractions
