"""Tests for per-page visual classification (TH-X-F008).

Covers the dispatch-plan emission, response normalization, and the back-merge
into ``aiVisualTracePacket.documents[].renderedPages[].pageClassificationRoles``
that downstream work-order routing already honours.
"""

from __future__ import annotations

import json
from pathlib import Path

from bim_ai.services.source_ingestion import (
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
)
from bim_ai.source_page_classification import (
    apply_page_classifications,
    build_page_classification_dispatch_plan,
    load_page_classification_responses,
)


def _compound_classifications() -> dict:
    """Mimic a compound scanned PDF that classify_documents would label
    ``unknown`` because the filename is opaque (gamma 'Kannenofen.pdf')."""

    return {
        "ok": True,
        "format": "sourceDocumentClassification_v1",
        "documentCount": 1,
        "classificationCounts": {"unknown": 1},
        "documents": [
            {
                "sourceDocumentId": "srcdoc-kannenofen",
                "sourcePath": "/abs/path/Kannenofen.pdf",
                "relativePath": "Kannenofen.pdf",
                "kind": "pdf",
                "classification": "unknown",
                "confidence": 0.0,
                "classificationRoles": [],
                "secondaryClassifications": [],
                "method": "filename_heuristic",
            }
        ],
    }


def _manifest_with(doc_id: str, abs_path: str, relative: str) -> dict:
    return {
        "ok": True,
        "format": "sourceFolderManifest_v1",
        "files": [
            {
                "sourceDocumentId": doc_id,
                "relativePath": relative,
                "name": Path(relative).name,
                "kind": "pdf",
                "mimeType": "application/pdf",
                "absolutePath": abs_path,
                "sha256": "deadbeef",
            }
        ],
    }


def _rendered_envelope(
    *, abs_path: str, doc_id: str, count: int, output_dir: Path
) -> list[dict]:
    rendered_dir = output_dir / "source" / "rendered-pages"
    rendered_dir.mkdir(parents=True, exist_ok=True)
    pages = []
    for page_no in range(1, count + 1):
        png_path = rendered_dir / f"{doc_id}-p{page_no}.png"
        png_path.write_bytes(b"\x89PNG\r\n\x1a\n")
        pages.append(
            {"page": page_no, "path": str(png_path), "sha256": "abc", "image": {}}
        )
    return [{"sourcePath": abs_path, "pages": pages}]


def _packet_for(doc_id: str, abs_path: str, relative: str, count: int, output_dir: Path) -> dict:
    classifications = _compound_classifications()
    classifications["documents"][0]["sourceDocumentId"] = doc_id
    classifications["documents"][0]["sourcePath"] = abs_path
    classifications["documents"][0]["relativePath"] = relative
    rendered = _rendered_envelope(
        abs_path=abs_path, doc_id=doc_id, count=count, output_dir=output_dir
    )
    return build_ai_visual_trace_packet(
        manifest=_manifest_with(doc_id, abs_path, relative),
        classifications=classifications,
        rendered_pages=rendered,
    )


def test_dispatch_plan_triggers_for_unknown_documents(tmp_path: Path) -> None:
    packet = _packet_for(
        doc_id="srcdoc-kannenofen",
        abs_path="/abs/path/Kannenofen.pdf",
        relative="Kannenofen.pdf",
        count=10,
        output_dir=tmp_path,
    )

    plan = build_page_classification_dispatch_plan(
        visual_packet=packet,
        output_dir=tmp_path,
        mode="auto",
        write_assignments=True,
    )

    assert plan["ok"] is True
    assert plan["assignmentCount"] == 1
    assignment = plan["assignments"][0]
    assert assignment["sourceDocumentId"] == "srcdoc-kannenofen"
    assert assignment["pageCount"] == 10
    assert assignment["trigger"] == "document_unknown"

    md_path = Path(assignment["assignmentPath"])
    assert md_path.exists()
    content = md_path.read_text(encoding="utf-8")
    # Role vocabulary is enumerated for the reader.
    assert "floor_plan" in content
    assert "elevation" in content
    assert "detail" in content
    # Each rendered page is referenced.
    for page_no in range(1, 11):
        assert f"p{page_no}:" in content


def test_dispatch_plan_skips_well_classified_short_documents(tmp_path: Path) -> None:
    abs_path = "/abs/path/EG.pdf"
    classifications = {
        "ok": True,
        "format": "sourceDocumentClassification_v1",
        "documents": [
            {
                "sourceDocumentId": "srcdoc-eg",
                "sourcePath": abs_path,
                "relativePath": "EG Grundriss.pdf",
                "classification": "floor_plan",
                "secondaryClassifications": [],
            }
        ],
    }
    rendered = _rendered_envelope(
        abs_path=abs_path, doc_id="srcdoc-eg", count=1, output_dir=tmp_path
    )
    packet = build_ai_visual_trace_packet(
        manifest=_manifest_with("srcdoc-eg", abs_path, "EG Grundriss.pdf"),
        classifications=classifications,
        rendered_pages=rendered,
    )

    plan = build_page_classification_dispatch_plan(
        visual_packet=packet,
        output_dir=tmp_path,
        mode="auto",
        write_assignments=True,
    )

    assert plan["assignmentCount"] == 0
    assert plan["skipped"][0]["reason"] == "trigger_not_met"


def test_normalize_and_apply_merges_roles_into_packet(tmp_path: Path) -> None:
    packet = _packet_for(
        doc_id="srcdoc-kannenofen",
        abs_path="/abs/path/Kannenofen.pdf",
        relative="Kannenofen.pdf",
        count=4,
        output_dir=tmp_path,
    )
    build_page_classification_dispatch_plan(
        visual_packet=packet,
        output_dir=tmp_path,
        mode="auto",
        write_assignments=True,
    )

    response_dir = tmp_path / "ai-reading" / "page-classifications" / "responses"
    response_dir.mkdir(parents=True, exist_ok=True)
    (response_dir / "srcdoc-kannenofen.json").write_text(
        json.dumps(
            {
                "sourceDocumentId": "srcdoc-kannenofen",
                "pages": [
                    {"page": 1, "primaryRole": "floor_plan", "confidence": 0.9},
                    {
                        "page": 2,
                        "primaryRole": "elevation",
                        "additionalRoles": ["detail"],
                        "confidence": 0.85,
                    },
                    {"page": 3, "primaryRole": "section", "confidence": 0.88},
                    {"page": 4, "primaryRole": "detail", "rotation": 90},
                ],
            }
        ),
        encoding="utf-8",
    )

    normalized = load_page_classification_responses(tmp_path)
    assert normalized["responseCount"] == 1
    assert not normalized["diagnostics"]

    application = apply_page_classifications(
        packet,
        responses=normalized["responses"],
    )
    assert application["appliedPageCount"] == 4
    assert application["affectedDocumentIds"] == ["srcdoc-kannenofen"]

    doc = packet["documents"][0]
    by_page = {page["page"]: page for page in doc["renderedPages"]}
    assert {row["classification"] for row in by_page[1]["pageClassificationRoles"]} == {
        "floor_plan"
    }
    page_two_roles = {row["classification"] for row in by_page[2]["pageClassificationRoles"]}
    assert page_two_roles == {"elevation", "detail"}
    priorities = {
        row["classification"]: row.get("rolePriority")
        for row in by_page[2]["pageClassificationRoles"]
    }
    assert priorities["elevation"] == "primary"
    assert priorities["detail"] == "additional"


def test_invalid_response_entries_are_diagnosed_not_applied(tmp_path: Path) -> None:
    response_dir = tmp_path / "ai-reading" / "page-classifications" / "responses"
    response_dir.mkdir(parents=True, exist_ok=True)
    (response_dir / "bad.json").write_text(
        json.dumps(
            {
                "sourceDocumentId": "srcdoc-x",
                "pages": [
                    {"page": "not-an-int", "primaryRole": "floor_plan"},
                    {"page": 2, "primaryRole": "not_a_role"},
                    {"page": 3, "primaryRole": "section"},
                ],
            }
        ),
        encoding="utf-8",
    )

    normalized = load_page_classification_responses(tmp_path)
    assert normalized["responseCount"] == 1
    diag_codes = {row["code"] for row in normalized["diagnostics"]}
    assert "page_classification_response_page_number_invalid" in diag_codes
    assert "page_classification_response_primary_role_invalid" in diag_codes
    # The valid entry survives.
    pages = normalized["responses"][0]["pages"]
    assert [entry["page"] for entry in pages] == [3]


def test_routing_improves_after_page_classification_is_applied(tmp_path: Path) -> None:
    """End-to-end: an 'unknown'-classified compound PDF gets routed to multiple
    work packages once visual page roles are merged into the packet."""

    packet = _packet_for(
        doc_id="srcdoc-kannenofen",
        abs_path="/abs/path/Kannenofen.pdf",
        relative="Kannenofen.pdf",
        count=4,
        output_dir=tmp_path,
    )
    response_dir = tmp_path / "ai-reading" / "page-classifications" / "responses"
    response_dir.mkdir(parents=True, exist_ok=True)
    (response_dir / "srcdoc-kannenofen.json").write_text(
        json.dumps(
            {
                "sourceDocumentId": "srcdoc-kannenofen",
                "pages": [
                    {"page": 1, "primaryRole": "floor_plan", "confidence": 0.9},
                    {"page": 2, "primaryRole": "elevation", "confidence": 0.85},
                    {"page": 3, "primaryRole": "section", "confidence": 0.88},
                    {"page": 4, "primaryRole": "site_plan", "confidence": 0.8},
                ],
            }
        ),
        encoding="utf-8",
    )

    apply_page_classifications(
        packet,
        responses=load_page_classification_responses(tmp_path)["responses"],
    )

    work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=packet)

    routed: dict[str, set[int]] = {}
    for package in work_order.get("workPackages") or []:
        for row in package.get("inputs") or []:
            routed.setdefault(str(package.get("id")), set()).add(int(row.get("page") or 0))

    # Pre-change, all 4 pages of an 'unknown' PDF would have landed in
    # wp-current-condition only (the only package that accepts 'unknown').
    # Post-change, the visual page roles route them to the right places.
    assert 1 in routed.get("wp-dimensional-floorplans", set())
    assert 2 in routed.get("wp-sections-elevations-roof", set())
    assert 3 in routed.get("wp-sections-elevations-roof", set())
    assert 4 in routed.get("wp-site-parcel-terrain", set())
