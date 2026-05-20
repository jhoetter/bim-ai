from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.api.registry import get_descriptor
from bim_ai.folder_output import build_reverse_bim_folder_output
from bim_ai.reverse_bim import (
    build_existing_building_ir_seed,
    build_mcp_authoring_readiness,
    build_reverse_bim_phase_packet,
    build_source_coverage_matrix,
    plan_mcp_authoring_actions,
    validate_existing_building_ir,
)
from bim_ai.routes_api import api_router
from bim_ai.source_agent_loop import (
    build_ai_visual_trace_agent_requests,
    normalize_ai_visual_trace_reader_responses,
    prepare_ai_visual_trace_run_from_folder,
    run_ai_visual_trace_agent_loop,
)
from bim_ai.source_ingestion import (
    build_ai_reading_packet,
    build_ai_visual_trace_packet,
    build_ai_visual_trace_work_order,
    build_folder_manifest,
    classify_documents,
    detect_scale_from_text,
    extract_source_facts,
    validate_ai_source_facts,
    validate_ai_visual_trace_completeness,
)

PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00"
    b"\x90wS\xde"
)


def test_folder_manifest_is_stable_and_classifies_sources(tmp_path: Path) -> None:
    (tmp_path / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    (tmp_path / "Ansicht Nord.png").write_bytes(PNG_1X1)
    (tmp_path / "Wohnflaechenberechnung.txt").write_text("Wohnflaeche M 1:100", encoding="utf-8")

    manifest_a = build_folder_manifest(tmp_path)
    manifest_b = build_folder_manifest(tmp_path)

    assert manifest_a["ok"] is True
    assert manifest_a["fileCount"] == 3
    assert manifest_a["manifestDigestSha256"] == manifest_b["manifestDigestSha256"]
    assert manifest_a["kindCounts"]["pdf"] == 1
    assert manifest_a["kindCounts"]["image"] == 1

    classifications = classify_documents(manifest_a)
    labels = {row["relativePath"]: row["classification"] for row in classifications["documents"]}
    assert labels["EG Grundriss.pdf"] == "floor_plan"
    assert labels["Ansicht Nord.png"] == "elevation"


def test_scale_detection_and_fact_ledger_from_classification(tmp_path: Path) -> None:
    (tmp_path / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    manifest = build_folder_manifest(tmp_path)
    classifications = classify_documents(manifest)
    source_path = classifications["documents"][0]["sourcePath"]

    scale = detect_scale_from_text("Grundriss Erdgeschoss M 1:100")
    assert scale["candidateCount"] >= 1
    assert scale["candidates"][0]["scale"] == "1:100"

    facts = extract_source_facts(
        classifications,
        text_extractions=[
            {
                "sourcePath": source_path,
                "pages": [{"page": 1, "text": "Grundriss Erdgeschoss M 1:100"}],
            }
        ],
    )
    kinds = {fact["kind"] for fact in facts["facts"]}
    assert "source_document_classification" in kinds
    assert "drawing_candidate" in kinds
    assert "scale_candidate" in kinds


def test_existing_building_ir_seed_and_validation(tmp_path: Path) -> None:
    (tmp_path / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    manifest = build_folder_manifest(tmp_path)
    classifications = classify_documents(manifest)
    facts = extract_source_facts(classifications)

    ir = build_existing_building_ir_seed(
        source_manifest=manifest,
        source_facts=facts,
        classifications=classifications,
    )
    validation = validate_existing_building_ir(ir)

    assert ir["format"] == "ExistingBuildingIR_v1"
    assert validation["ok"] is True
    assert validation["summary"]["factCount"] == facts["factCount"]


def test_ir_validation_blocks_missing_provenance() -> None:
    validation = validate_existing_building_ir(
        {
            "sourceManifest": {},
            "extractedFacts": [
                {"factId": "srcfact-1", "kind": "wall_line", "confidence": 0.8}
            ],
            "levels": [],
            "floorPlanGraphs": [],
            "rooms": [],
            "openings": [],
            "site": {},
            "conflicts": [],
        }
    )

    assert validation["ok"] is False
    assert validation["summary"]["errorCount"] >= 1
    assert any(row["code"] == "ir_fact_provenance_missing" for row in validation["findings"])


def test_source_coverage_and_phase_packet_blockers() -> None:
    facts = [
        {
            "factId": "srcfact-1",
            "kind": "room_area",
            "status": "accepted",
            "confidence": 0.9,
            "provenance": {"sourceDocumentId": "srcdoc-1"},
        }
    ]
    coverage = build_source_coverage_matrix(facts=facts, fact_to_element_refs={})
    assert coverage["uncoveredBlockingFactCount"] == 1

    packet = build_reverse_bim_phase_packet(
        phase_id="P6-rooms",
        finding_dispositions=[
            {"findingId": "room-area-mismatch", "disposition": "blocked"}
        ],
    )
    assert packet["acceptedForNextPhase"] is False
    assert packet["summary"]["openBlockerCount"] == 1

    warning_packet = build_reverse_bim_phase_packet(
        phase_id="P7-openings",
        advisor={"data": {"summary": {"severityCounts": {"error": 0, "warning": 1}}}},
    )
    assert warning_packet["acceptedForNextPhase"] is False
    assert warning_packet["summary"]["blockingWarningCount"] == 1

    clean_packet = build_reverse_bim_phase_packet(
        phase_id="P7-openings",
        advisor={"data": {"summary": {"severityCounts": {"error": 0, "warning": 0}}}},
        constructability={"summary": {"severityCounts": {"error": 0, "warning": 0}}},
        integrity_preflight={"summary": {"severityCounts": {"error": 0, "warning": 0}}},
    )
    assert clean_packet["acceptedForNextPhase"] is True
    assert clean_packet["summary"]["missingRequiredReportCount"] == 0


def test_authoring_plan_maps_ai_facts_to_mcp_tools() -> None:
    plan = plan_mcp_authoring_actions(
        facts=[
            {
                "factId": "ai-srcfact-wall-1",
                "kind": "wall_line",
                "confidence": 0.9,
                "value": {
                    "levelId": "level-eg",
                    "start": {"xMm": 0, "yMm": 0},
                    "end": {"xMm": 3000, "yMm": 0},
                },
                "provenance": {"sourceDocumentId": "srcdoc-eg", "page": 1},
            },
            {
                "factId": "ai-srcfact-door-1",
                "kind": "door",
                "confidence": 0.8,
                "value": {"widthMm": 875},
                "provenance": {"sourceDocumentId": "srcdoc-eg", "page": 1},
            },
        ],
        target_phase="P3",
    )

    assert plan["format"] == "reverseBimMcpAuthoringPlan_v1"
    assert plan["actions"][0]["tool"] == "author.wall"
    assert plan["actions"][0]["readyForDryRun"] is True
    assert plan["actions"][0]["expectedReadback"]["expected"]["elementKind"] == "wall"
    assert "query.elements" in plan["actions"][0]["expectedReadback"]["querySurfaces"]
    assert plan["actions"][1]["tool"] == "opening.door_on_wall"
    assert plan["actions"][1]["readyForDryRun"] is False
    assert plan["actions"][1]["requiredBeforeDryRun"][0]["resolver"] == "resolve.wall_by_line"
    assert plan["actions"][1]["expectedReadback"]["expected"]["elementKind"] == "door"


def test_ai_visual_reader_normalization_builds_mcp_feedable_facts() -> None:
    normalized = normalize_ai_visual_trace_reader_responses(
        [
            {
                "format": "sourceAiVisualTraceReaderResponse_v1",
                "workPackageId": "wp-area-volume-schedules",
                "facts": [
                    {
                        "factId": "ai-srcfact-area-wohnen",
                        "kind": "area",
                        "value": 18.65,
                        "scope": "room",
                        "levelId": "level-eg",
                        "name": "Wohnen",
                        "areaM2": 18.65,
                        "confidence": 0.9,
                        "provenance": {
                            "sourceDocumentId": "srcdoc-area",
                            "page": 1,
                            "region": "area table",
                        },
                    },
                    {
                        "factId": "ai-srcfact-room-wohnen",
                        "kind": "room",
                        "value": {
                            "levelId": "level-eg",
                            "name": "Wohnen",
                            "areaM2": 18.65,
                            "boundaryPointsMm": [
                                {"xMm": 0, "yMm": 0},
                                {"xMm": 1000, "yMm": 0},
                                {"xMm": 1000, "yMm": 1000},
                            ],
                        },
                        "confidence": 0.8,
                        "provenance": {
                            "sourceDocumentId": "srcdoc-eg",
                            "page": 1,
                            "region": "room outline",
                        },
                    },
                ],
            }
        ]
    )

    facts = normalized["responses"][0]["facts"]
    area = next(fact for fact in facts if fact["kind"] == "area")
    room = next(fact for fact in facts if fact["kind"] == "room")
    assert area["value"]["scope"] == "room"
    assert area["value"]["areaM2"] == 18.65
    assert room["value"]["boundaryMm"][0]["xMm"] == 0
    assert room["value"]["boundaryRef"] == "ai-srcfact-room-wohnen:boundary"


def test_mcp_authoring_readiness_separates_resolvers_metadata_and_source_refinement() -> None:
    readiness = build_mcp_authoring_readiness(
        facts=[
            {
                "factId": "ai-srcfact-room-1",
                "kind": "room",
                "confidence": 0.85,
                "value": {
                    "levelId": "level-eg",
                    "name": "Wohnen",
                    "areaM2": 18.65,
                    "boundaryMm": [
                        {"xMm": 0, "yMm": 0},
                        {"xMm": 1000, "yMm": 0},
                        {"xMm": 1000, "yMm": 1000},
                    ],
                },
                "provenance": {"sourceDocumentId": "srcdoc-eg", "page": 1},
            },
            {
                "factId": "ai-srcfact-opening-1",
                "kind": "opening",
                "confidence": 0.75,
                "value": {
                    "levelId": "level-eg",
                    "openingType": "door",
                    "hostWallRef": "west exterior wall",
                    "widthMm": 885,
                    "heightMm": 2010,
                    "position": {"alongT": 0.5},
                },
                "provenance": {"sourceDocumentId": "srcdoc-eg", "page": 1},
            },
            {
                "factId": "ai-srcfact-roof-opening-1",
                "kind": "opening",
                "confidence": 0.75,
                "value": {
                    "levelId": "level-dg",
                    "openingType": "roof window",
                    "hostRoofRef": "main roof",
                    "widthMm": 780,
                    "heightMm": 1180,
                },
                "provenance": {"sourceDocumentId": "srcdoc-section", "page": 1},
            },
            {
                "factId": "ai-srcfact-dormer-1",
                "kind": "dormer",
                "confidence": 0.75,
                "value": {
                    "hostRoofRef": "main roof",
                    "position": {"xMm": 4000, "yMm": 5000},
                    "widthMm": 2400,
                    "heightMm": 1200,
                    "dormerType": "shed dormer",
                },
                "provenance": {"sourceDocumentId": "srcdoc-elevation", "page": 1},
            },
            {
                "factId": "ai-srcfact-area-room-ref-1",
                "kind": "room",
                "confidence": 0.9,
                "value": {
                    "scope": "room_area_reference",
                    "levelId": "level-eg",
                    "name": "Wohnen",
                    "areaM2": 18.65,
                    "boundaryRef": "area-table-row-only",
                },
                "provenance": {"sourceDocumentId": "srcdoc-area", "page": 1},
            },
            {
                "factId": "ai-srcfact-area-1",
                "kind": "area",
                "confidence": 0.9,
                "value": {"scope": "room", "levelId": "level-eg", "name": "Wohnen", "areaM2": 18.65},
                "provenance": {"sourceDocumentId": "srcdoc-area", "page": 1},
            },
            {
                "factId": "ai-srcfact-terrain-1",
                "kind": "terrain",
                "confidence": 0.6,
                "value": {"siteRef": "parcel-258", "method": "photo", "confidenceNote": "slope only"},
                "provenance": {"sourceDocumentId": "srcdoc-site", "page": 1},
            },
        ],
        target_phase="P6",
    )

    rows = {row["factId"]: row for row in readiness["rows"]}
    assert rows["ai-srcfact-room-1"]["status"] == "ready_for_mcp_authoring"
    assert rows["ai-srcfact-room-1"]["expectedReadback"]["expected"]["elementKind"] == "room"
    assert rows["ai-srcfact-opening-1"]["status"] == "needs_mcp_resolver"
    assert rows["ai-srcfact-opening-1"]["requiredBeforeMcp"][0]["resolver"] == "resolve.wall_by_line"
    assert rows["ai-srcfact-roof-opening-1"]["mcpTool"] == "opening.roof_opening"
    assert rows["ai-srcfact-roof-opening-1"]["requiredBeforeMcp"][0]["resolver"] == "resolve.roof_host_region"
    assert rows["ai-srcfact-dormer-1"]["mcpTool"] == "author.dormer_on_roof"
    assert rows["ai-srcfact-dormer-1"]["status"] == "needs_mcp_resolver_and_source_refinement"
    assert rows["ai-srcfact-area-room-ref-1"]["status"] == "metadata_for_authoring"
    assert rows["ai-srcfact-area-room-ref-1"]["readyForMcpAuthoring"] is True
    assert rows["ai-srcfact-area-1"]["status"] == "metadata_for_authoring"
    assert rows["ai-srcfact-terrain-1"]["status"] == "needs_source_refinement"
    assert readiness["ok"] is False

    resolved_conflict_readiness = build_mcp_authoring_readiness(
        facts=[
            {
                "factId": "conflict-resolved",
                "kind": "conflict",
                "confidence": 1,
                "status": "resolved",
                "value": {
                    "topic": "year",
                    "candidates": ["1956", "1957"],
                    "recommendedDisposition": "use 1957",
                    "disposition": {
                        "decision": "choose_candidate",
                        "chosenCandidate": "1957",
                    },
                },
                "provenance": {"sourceDocumentId": "srcdoc-admin", "page": 1},
            }
        ]
    )
    assert resolved_conflict_readiness["rows"][0]["status"] == "metadata_for_authoring"

    context_terrain_readiness = build_mcp_authoring_readiness(
        facts=[
            {
                "factId": "terrain-context",
                "kind": "terrain",
                "confidence": 0.7,
                "status": "resolved",
                "value": {
                    "siteRef": "parcel",
                    "method": "raster context",
                    "confidenceNote": "no spot heights",
                    "disposition": {
                        "decision": "accept_context_only_no_toposolid",
                    },
                },
                "provenance": {"sourceDocumentId": "srcdoc-site", "page": 1},
            }
        ]
    )
    assert context_terrain_readiness["rows"][0]["status"] == "reference_only"


def test_ai_reading_packet_and_ai_fact_validation(tmp_path: Path) -> None:
    (tmp_path / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    manifest = build_folder_manifest(tmp_path)
    classifications = classify_documents(manifest)
    rendered = [
        {
            "sourcePath": manifest["files"][0]["absolutePath"],
            "pages": [
                {
                    "page": 1,
                    "path": "/tmp/EG-1.png",
                    "sha256": "abc",
                    "image": {"widthPx": 100, "heightPx": 80},
                }
            ],
        }
    ]
    packet = build_ai_reading_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered,
        text_extractions=[],
    )
    assert packet["format"] == "sourceAiReadingPacket_v1"
    assert packet["documents"][0]["renderedPages"][0]["path"] == "/tmp/EG-1.png"
    assert packet["expectedFactSchema"]["provenance"]["method"] == "ai_document_read"

    visual_packet = build_ai_visual_trace_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered,
        text_extractions=[],
    )
    assert visual_packet["format"] == "sourceAiVisualTracePacket_v1"
    assert visual_packet["task"] == "ai_visual_trace_to_existing_building_source_facts"
    assert "wall_chain" in visual_packet["expectedFactSchema"]["kind"]
    assert visual_packet["expectedFactSchema"]["traceGeometry"]["modelDraft"]

    work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=visual_packet)
    assert work_order["format"] == "reverseBimAiVisualTraceWorkOrder_v1"
    floorplan_wp = next(
        wp for wp in work_order["workPackages"] if wp["id"] == "wp-dimensional-floorplans"
    )
    assert floorplan_wp["status"] == "ready"
    assert floorplan_wp["inputs"][0]["renderedPagePath"] == "/tmp/EG-1.png"
    assert "wall_chain" in floorplan_wp["blockingRequiredFactKinds"]

    validation = validate_ai_source_facts(
        [
            {
                "factId": "ai-srcfact-1",
                "kind": "room",
                "value": {"name": "Wohnen"},
                "confidence": 0.9,
                "provenance": {"sourceDocumentId": manifest["files"][0]["sourceDocumentId"]},
            }
        ]
    )
    assert validation["ok"] is True
    assert validation["facts"][0]["provenance"]["method"] == "ai_document_read"

    completeness = validate_ai_visual_trace_completeness(
        [
            {
                "factId": "ai-srcfact-room-1",
                "kind": "room",
                "value": {
                    "levelId": "level-eg",
                    "name": "Wohnen",
                    "areaM2": 18.65,
                    "boundaryRef": "room-loop-eg-wohnen",
                },
                "confidence": 0.9,
                "provenance": {
                    "sourceDocumentId": manifest["files"][0]["sourceDocumentId"],
                    "page": 1,
                    "region": "room label",
                },
            }
        ]
    )
    assert completeness["ok"] is True
    assert completeness["summary"]["coreFactCounts"]["room"] == 1

    incomplete = validate_ai_visual_trace_completeness(
        [
            {
                "factId": "ai-srcfact-room-2",
                "kind": "room",
                "value": {"name": "Wohnen"},
                "confidence": 0.9,
                "provenance": {
                    "sourceDocumentId": manifest["files"][0]["sourceDocumentId"],
                    "page": 1,
                    "region": "room label",
                },
            }
        ]
    )
    assert incomplete["ok"] is False
    assert incomplete["findings"][0]["code"] == "ai_visual_fact_required_value_missing"

    missing_kind = validate_ai_visual_trace_completeness(
        [
            {
                "factId": "ai-srcfact-level-1",
                "kind": "level",
                "value": {"name": "EG", "elevationMm": 0},
                "confidence": 0.9,
                "provenance": {
                    "sourceDocumentId": manifest["files"][0]["sourceDocumentId"],
                    "page": 1,
                    "region": "level marker",
                },
            }
        ],
        required_kinds=["level", "wall_chain"],
    )
    assert missing_kind["ok"] is False
    assert any(
        finding["code"] == "ai_visual_required_fact_kind_missing"
        and finding["kind"] == "wall_chain"
        for finding in missing_kind["findings"]
    )


def test_ai_visual_trace_agent_loop_accepts_or_repairs_packages(tmp_path: Path) -> None:
    (tmp_path / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    manifest = build_folder_manifest(tmp_path)
    classifications = classify_documents(manifest)
    rendered = [
        {
            "sourcePath": manifest["files"][0]["absolutePath"],
            "pages": [
                {
                    "page": 1,
                    "path": "/tmp/EG-1.png",
                    "sha256": "abc",
                    "image": {"widthPx": 100, "heightPx": 80},
                }
            ],
        }
    ]
    visual_packet = build_ai_visual_trace_packet(
        manifest=manifest,
        classifications=classifications,
        rendered_pages=rendered,
        text_extractions=[],
    )
    work_order = build_ai_visual_trace_work_order(ai_visual_trace_packet=visual_packet)
    work_order["workPackages"] = [
        wp for wp in work_order["workPackages"] if wp["id"] == "wp-dimensional-floorplans"
    ]
    room_requirements = work_order["workPackages"][0]["requiredValueFieldsByKind"]["room"]
    assert {"boundaryMm", "boundaryEdges", "accessRefs", "adjacentRoomRefs"} <= set(room_requirements)

    requests = build_ai_visual_trace_agent_requests(work_order=work_order, run_id="run-test")
    assert requests["format"] == "sourceAiVisualTraceAgentRequests_v1"
    assert requests["requests"][0]["outputContract"]["blockingRequiredFactKinds"]

    blocked = run_ai_visual_trace_agent_loop(work_order=work_order, responses=[])
    assert blocked["ok"] is False
    assert blocked["summary"]["waitingPackageCount"] == 1
    assert blocked["repairRequests"][0]["workPackageId"] == "wp-dimensional-floorplans"

    reader_script = tmp_path / "reader.py"
    reader_script.write_text(
        "import json, sys\n"
        "request = json.load(sys.stdin)\n"
        "print(json.dumps({\n"
        "  'format': 'sourceAiVisualTraceReaderResponse_v1',\n"
        "  'workPackageId': request['workPackageId'],\n"
        "  'facts': []\n"
        "}))\n",
        encoding="utf-8",
    )
    dispatched = run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=[],
        reader_command=[sys.executable, str(reader_script)],
    )
    assert dispatched["summary"]["waitingPackageCount"] == 0
    assert dispatched["summary"]["needsRevisionPackageCount"] == 1
    assert dispatched["dispatchDiagnostics"] == []
    assert dispatched["readerResponses"] == [
        {
            "format": "sourceAiVisualTraceReaderResponse_v1",
            "workPackageId": "wp-dimensional-floorplans",
            "facts": [],
        }
    ]

    source_document_id = manifest["files"][0]["sourceDocumentId"]
    accepted = run_ai_visual_trace_agent_loop(
        work_order=work_order,
        responses=[
            {
                "format": "sourceAiVisualTraceReaderResponse_v1",
                "workPackageId": "wp-dimensional-floorplans",
                "facts": [
                    {
                        "factId": "ai-srcfact-level-eg",
                        "kind": "level",
                        "value": {"name": "EG", "elevationMm": 0},
                        "confidence": 0.9,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "plan title",
                        },
                    },
                    {
                        "factId": "ai-srcfact-wall-chain-eg",
                        "kind": "wall_chain",
                        "value": {
                            "levelId": "level-eg",
                            "points": [
                                {"xMm": 0, "yMm": 0},
                                {"xMm": 1000, "yMm": 0},
                                {"xMm": 1000, "yMm": 1000},
                            ],
                            "thicknessMm": 240,
                            "wallRole": "exterior",
                            "closed": False,
                        },
                        "confidence": 0.85,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "exterior wall chain",
                        },
                    },
                    {
                        "factId": "ai-srcfact-wall-thickness-eg",
                        "kind": "wall_thickness",
                        "value": {"thicknessMm": 240, "appliesTo": "exterior wall chain"},
                        "confidence": 0.8,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "dimension note",
                        },
                    },
                    {
                        "factId": "ai-srcfact-room-eg",
                        "kind": "room",
                        "value": {
                            "levelId": "level-eg",
                            "name": "Wohnen",
                            "areaM2": 18.65,
                            "boundaryMm": [
                                {"xMm": 0, "yMm": 0},
                                {"xMm": 1000, "yMm": 0},
                                {"xMm": 1000, "yMm": 1000},
                                {"xMm": 0, "yMm": 1000},
                            ],
                            "boundaryEdges": [
                                {
                                    "fromMm": {"xMm": 0, "yMm": 0},
                                    "toMm": {"xMm": 1000, "yMm": 0},
                                    "backingWallRef": "wall-chain-eg",
                                }
                            ],
                            "accessRefs": ["ai-srcfact-opening-eg"],
                            "adjacentRoomRefs": ["outside"],
                        },
                        "confidence": 0.9,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "room label",
                        },
                    },
                    {
                        "factId": "ai-srcfact-opening-eg",
                        "kind": "opening",
                        "value": {
                            "levelId": "level-eg",
                            "openingType": "door",
                            "hostWallRef": "wall-chain-eg",
                            "widthMm": 885,
                            "heightMm": 2010,
                            "position": {"alongT": 0.5},
                        },
                        "confidence": 0.75,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "door swing",
                        },
                    },
                    {
                        "factId": "ai-srcfact-stair-eg-dg",
                        "kind": "stair",
                        "value": {
                            "fromLevelId": "level-eg",
                            "toLevelId": "level-dg",
                            "runs": [{"direction": "up"}],
                            "stepCount": 14,
                            "slabOpeningRef": "slab-opening-eg-dg",
                        },
                        "confidence": 0.7,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "stair arrow",
                        },
                    },
                    {
                        "factId": "ai-srcfact-slab-opening-eg-dg",
                        "kind": "slab_opening",
                        "value": {
                            "levelId": "level-dg",
                            "hostFloorRef": "floor-dg",
                            "boundary": [{"xMm": 0, "yMm": 0}],
                        },
                        "confidence": 0.7,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "stair void",
                        },
                    },
                    {
                        "factId": "ai-srcfact-area-eg",
                        "kind": "area",
                        "value": {
                            "scope": "room",
                            "levelId": "level-eg",
                            "name": "Wohnen",
                            "areaM2": 18.65,
                        },
                        "confidence": 0.9,
                        "provenance": {
                            "sourceDocumentId": source_document_id,
                            "page": 1,
                            "region": "area text",
                        },
                    },
                ],
            }
        ],
    )
    assert accepted["ok"] is True
    assert accepted["summary"]["acceptedPackageCount"] == 1
    assert len(accepted["acceptedFacts"]) == 8
    assert accepted["readerResponses"][0]["workPackageId"] == "wp-dimensional-floorplans"


def test_prepare_ai_visual_trace_run_from_folder_writes_artifacts(tmp_path: Path) -> None:
    source_dir = tmp_path / "source"
    output_dir = tmp_path / "out"
    source_dir.mkdir()
    (source_dir / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")

    prepared = prepare_ai_visual_trace_run_from_folder(
        root_path=source_dir,
        output_dir=output_dir,
        run_id="prepare-test",
        max_pages_per_pdf=1,
    )

    assert prepared["format"] == "sourceAiVisualTracePreparedRun_v1"
    assert prepared["runId"] == "prepare-test"
    assert Path(prepared["artifacts"]["manifest"]).exists()
    assert Path(prepared["artifacts"]["aiVisualTraceAgentRequests"]).exists()
    assert Path(prepared["artifacts"]["initialAgentLoop"]).exists()
    assert prepared["summary"]["readerRequestCount"] >= 1


def test_reverse_bim_folder_output_blocks_without_reader_responses(tmp_path: Path) -> None:
    source_dir = tmp_path / "source"
    output_dir = tmp_path / "folder-output"
    source_dir.mkdir()
    (source_dir / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")

    package = build_reverse_bim_folder_output(
        root_path=source_dir,
        output_dir=output_dir,
        run_id="folder-output-test",
        max_pages_per_pdf=1,
        reset_output=True,
    )

    assert package["format"] == "reverseBimFolderOutputPackage_v1"
    assert package["packageState"] == "source_packaging_ready"
    assert Path(package["artifacts"]["runSummary"]).exists()
    assert Path(package["artifacts"]["phaseAuthoringSpec"]).exists()
    assert Path(package["artifacts"]["evidenceRequirements"]).exists()
    assert Path(package["artifacts"]["packageAcceptanceReport"]).exists()
    assert package["acceptance"]["summary"]["readerResponseCount"] == 0


def test_reverse_bim_folder_output_rejects_seed_artifact_source_roots(tmp_path: Path) -> None:
    source_dir = tmp_path / "seed-artifacts" / "target-house-3"
    output_dir = tmp_path / "folder-output"
    source_dir.mkdir(parents=True)
    (source_dir / "bundle.json").write_text("{}", encoding="utf-8")

    package = build_reverse_bim_folder_output(
        root_path=source_dir,
        output_dir=output_dir,
        run_id="folder-output-seed-rejected",
        reset_output=True,
    )

    assert package["ok"] is False
    assert package["packageState"] == "source_rejected"
    assert package["acceptance"]["findings"][0]["code"] == "folder_output_generated_source_rejected"
    assert (output_dir / "validation" / "package-acceptance-report.json").exists()


def test_reverse_bim_folder_output_captures_reader_command_responses(
    tmp_path: Path,
    monkeypatch,
) -> None:
    source_dir = tmp_path / "source"
    output_dir = tmp_path / "folder-output-command"
    source_dir.mkdir()
    (source_dir / "EG Grundriss.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    monkeypatch.setattr(
        "bim_ai.folder_output.render_pdf_pages",
        lambda source_path, **_: {
            "ok": True,
            "format": "sourcePdfRender_v1",
            "sourcePath": str(Path(source_path).resolve()),
            "pages": [
                {
                    "page": 1,
                    "path": str(tmp_path / "EG-1.png"),
                    "sha256": "abc",
                    "image": {"widthPx": 100, "heightPx": 80},
                }
            ],
        },
    )
    monkeypatch.setattr(
        "bim_ai.folder_output.extract_pdf_text",
        lambda source_path, **_: {
            "ok": True,
            "format": "sourcePdfTextExtraction_v1",
            "sourcePath": str(Path(source_path).resolve()),
            "pages": [{"page": 1, "text": "", "charCount": 0}],
        },
    )
    reader_script = tmp_path / "reader.py"
    reader_script.write_text(
        "import json, sys\n"
        "request = json.load(sys.stdin)\n"
        "print(json.dumps({\n"
        "  'format': 'sourceAiVisualTraceReaderResponse_v1',\n"
        "  'workPackageId': request['workPackageId'],\n"
        "  'readerId': 'test-reader',\n"
        "  'model': 'test-vision',\n"
        "  'facts': []\n"
        "}))\n",
        encoding="utf-8",
    )

    package = build_reverse_bim_folder_output(
        root_path=source_dir,
        output_dir=output_dir,
        reader_command=[sys.executable, str(reader_script)],
        run_id="folder-output-command-test",
        max_pages_per_pdf=1,
        reset_output=True,
    )

    assert package["format"] == "reverseBimFolderOutputPackage_v1"
    response_index = json.loads(Path(package["artifacts"]["readerResponseIndex"]).read_text())
    assert response_index["responseCount"] == 1
    assert response_index["rows"][0]["readerId"] == "test-reader"
    assert response_index["rows"][0]["model"] == "test-vision"


def test_api_routes_and_descriptors_are_registered(tmp_path: Path) -> None:
    (tmp_path / "Lageplan.pdf").write_bytes(b"%PDF-1.4\n% test\n")
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    resp = client.post("/api/v3/source/folder-manifest", json={"rootPath": str(tmp_path)})
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceFolderManifest_v1"

    resp = client.post(
        "/api/v3/source/ai-visual-trace-packet",
        json={"manifest": resp.json(), "renderedPages": []},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceAiVisualTracePacket_v1"

    resp = client.post(
        "/api/v3/source/ai-visual-trace-work-order",
        json={"aiVisualTracePacket": resp.json()},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimAiVisualTraceWorkOrder_v1"
    work_order = resp.json()

    resp = client.post(
        "/api/v3/source/ai-visual-trace-agent-requests",
        json={"workOrder": work_order, "runId": "run-api-test"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceAiVisualTraceAgentRequests_v1"

    resp = client.post(
        "/api/v3/source/ai-visual-trace-agent-loop",
        json={"workOrder": work_order, "responses": []},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceAiVisualTraceAgentLoopRun_v1"
    assert resp.json()["status"] == "blocked"

    resp = client.post(
        "/api/v3/source/normalize-ai-visual-trace-reader-responses",
        json={
            "responses": [
                {
                    "workPackageId": "wp-current-condition",
                    "facts": [
                        {
                            "factId": "photo-note-1",
                            "kind": "photo_observation",
                            "value": "dark tiled roof visible",
                            "confidence": 0.8,
                            "provenance": {"sourceDocumentId": "srcdoc-1", "page": 1},
                        }
                    ],
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceAiVisualTraceReaderResponsesNormalization_v1"
    assert resp.json()["responses"][0]["facts"][0]["value"]["observation"] == "dark tiled roof visible"

    resp = client.post(
        "/api/v3/source/reader-consensus",
        json={
            "responses": [
                {
                    "workPackageId": "wp-dimensional-floorplans",
                    "readerId": "reader-a",
                    "facts": [
                        {
                            "factId": "reader-a-level-eg",
                            "kind": "level",
                            "value": {"name": "EG", "elevationMm": 0},
                            "confidence": 0.9,
                            "provenance": {"sourceDocumentId": "srcdoc-1", "page": 1},
                        }
                    ],
                },
                {
                    "workPackageId": "wp-dimensional-floorplans",
                    "readerId": "reader-b",
                    "facts": [
                        {
                            "factId": "reader-b-level-eg",
                            "kind": "level",
                            "value": {"name": "EG", "elevationMm": 0},
                            "confidence": 0.9,
                            "provenance": {"sourceDocumentId": "srcdoc-1", "page": 1},
                        }
                    ],
                },
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimSourceReaderConsensus_v1"
    assert resp.json()["ok"] is True

    output_dir = tmp_path / "prepared"
    resp = client.post(
        "/api/v3/source/prepare-ai-visual-trace-run",
        json={
            "rootPath": str(tmp_path),
            "outputDir": str(output_dir),
            "runId": "route-prepare-test",
            "maxPagesPerPdf": 1,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceAiVisualTracePreparedRun_v1"
    assert resp.json()["summary"]["readerRequestCount"] >= 1

    resp = client.post(
        "/api/v3/source/validate-ai-visual-trace-completeness",
        json={
            "requiredKinds": ["level"],
            "facts": [
                {
                    "factId": "ai-srcfact-level-1",
                    "kind": "level",
                    "value": {"name": "EG", "elevationMm": 0},
                    "confidence": 0.9,
                    "provenance": {
                        "sourceDocumentId": "srcdoc-1",
                        "page": 1,
                        "region": "level marker",
                    },
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "sourceAiVisualTraceCompletenessValidation_v1"
    assert resp.json()["ok"] is True

    resp = client.post(
        "/api/v3/reverse-bim/ir/validate",
        json={
            "sourceManifest": {},
            "extractedFacts": [],
            "levels": [],
            "floorPlanGraphs": [],
            "rooms": [],
            "openings": [],
            "site": {},
            "conflicts": [],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True

    resp = client.post(
        "/api/v3/reverse-bim/mcp-readiness",
        json={
            "facts": [
                {
                    "factId": "ai-srcfact-area-1",
                    "kind": "area",
                    "value": {"scope": "room", "levelId": "level-eg", "name": "Wohnen", "areaM2": 18.65},
                    "confidence": 0.9,
                    "provenance": {"sourceDocumentId": "srcdoc-1", "page": 1},
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimMcpAuthoringReadiness_v1"
    assert resp.json()["summary"]["metadataForAuthoringCount"] == 1

    resp = client.post(
        "/api/v3/reverse-bim/source-material-assemblies",
        json={
            "facts": [
                {
                    "factId": "wall-chain-eg-north",
                    "kind": "wall_chain",
                    "value": {
                        "elementScope": "wall-chain-eg-north",
                        "levelId": "EG",
                        "points": [{"xMm": 0, "yMm": 0}, {"xMm": 5000, "yMm": 0}],
                        "thicknessMm": 240,
                    },
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimSourceMaterialAssemblies_v1"
    assert resp.json()["summary"]["blockedAssemblyCount"] == 1

    resp = client.post(
        "/api/v3/reverse-bim/phase-run",
        json={
            "phaseAuthoringSpec": {
                "phases": [
                    {
                        "phaseId": "P2-levels",
                        "sourceFactIds": ["level-eg"],
                        "authoringActions": [{"factId": "level-eg"}],
                    }
                ]
            },
            "phasePackets": [],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimPhaseRunReport_v1"
    assert resp.json()["ok"] is False

    resp = client.post(
        "/api/v3/reverse-bim/evidence-requirements",
        json={
            "sourcePageIndex": {
                "pages": [
                    {
                        "sourcePageId": "src-plan:p1",
                        "sourceDocumentId": "src-plan",
                        "page": 1,
                        "classification": "floor_plan",
                    }
                ]
            },
            "facts": [
                {
                    "factId": "level-eg",
                    "kind": "level",
                    "value": {"levelId": "EG", "name": "EG"},
                }
            ],
            "phaseAuthoringSpec": {"phases": []},
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimEvidenceRequirements_v1"
    assert resp.json()["summary"]["overlayViewCount"] == 1

    folder_output_dir = tmp_path / "folder-output-route"
    resp = client.post(
        "/api/v3/reverse-bim/folder-output",
        json={
            "rootPath": str(tmp_path),
            "outputDir": str(folder_output_dir),
            "runId": "route-folder-output-test",
            "maxPagesPerPdf": 1,
            "resetOutput": True,
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["format"] == "reverseBimFolderOutputPackage_v1"
    assert resp.json()["packageState"] == "source_packaging_ready"

    for name in (
        "source.folder_manifest",
        "source.extract_text",
        "source.render_pdf_pages",
        "source.ai_reading_packet",
        "source.ai_visual_trace_packet",
        "source.ai_visual_trace_work_order",
        "source.ai_visual_trace_agent_requests",
        "source.prepare_ai_visual_trace_run",
        "source.ai_visual_trace_agent_loop",
        "source.normalize_ai_visual_trace_reader_responses",
        "source.reader_consensus",
        "source.validate_ai_visual_trace_completeness",
        "source.validate_ai_facts",
        "reverse_bim.ir_validate",
        "reverse_bim.plan_authoring",
        "reverse_bim.mcp_readiness",
        "reverse_bim.source_material_assemblies",
        "reverse_bim.folder_output",
        "reverse_bim.phase_packet",
        "reverse_bim.phase_run",
        "reverse_bim.evidence_requirements",
        "reverse_bim.level_completeness",
        "reverse_bim.physical_topology",
        "reverse_bim.source_overlay_evidence",
        "reverse_bim.ui_evidence",
        "reverse_bim.final_acceptance",
        "qa.level_completeness",
        "qa.physical_topology",
        "qa.source_overlay_compare",
        "resolve.opening_source_match",
        "resolve.dormer_opening_host",
        "resolve.roof_position_from_source_point",
        "validate.roof_dormer_source_alignment",
        "author.wall",
        "opening.door_on_wall",
        "opening.window_on_wall",
    ):
        assert get_descriptor(name) is not None


def test_promoted_authoring_descriptors_route_to_semantic_bundles() -> None:
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    cases = [
        (
            "author.wall",
            {
                "id": "wall-1",
                "levelId": "level-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 1000, "yMm": 0},
            },
            "wall",
        ),
        (
            "author.wall_chain",
            {
                "levelId": "level-1",
                "points": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                ],
            },
            "wall_chain",
        ),
        (
            "author.floor_from_boundary",
            {
                "name": "Floor",
                "levelId": "level-1",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
            },
            "floor_from_boundary",
        ),
        (
            "author.room_outline",
            {
                "name": "Room",
                "levelId": "level-1",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
            },
            "room_outline",
        ),
        (
            "author.roof_from_boundary",
            {
                "name": "Roof",
                "referenceLevelId": "level-2",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
            },
            "roof_from_boundary",
        ),
        (
            "opening.door_on_wall",
            {"wallId": "wall-1", "alongT": 0.5, "widthMm": 900},
            "door_on_wall",
        ),
        (
            "opening.window_on_wall",
            {
                "wallId": "wall-1",
                "alongT": 0.5,
                "widthMm": 1200,
                "heightMm": 1200,
                "sillHeightMm": 900,
            },
            "window_on_wall",
        ),
    ]

    for surface, payload, operation in cases:
        response = client.post(f"/api/semantic-authoring/{surface}", json=payload)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["operation"] == operation
        assert body["commands"]
