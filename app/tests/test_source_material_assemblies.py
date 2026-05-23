from __future__ import annotations

from bim_ai.services.folder_output import (
    _build_open_repair_requests,
    _build_package_acceptance_report,
)
from bim_ai.source_material_assemblies import build_source_material_assembly_report


def test_source_material_assemblies_block_generic_wall_type_authoring() -> None:
    report = build_source_material_assembly_report(
        [
            {
                "factId": "wall-chain-eg-north",
                "kind": "wall_chain",
                "value": {
                    "levelId": "EG",
                    "points": [{"xMm": 0, "yMm": 0}, {"xMm": 5000, "yMm": 0}],
                    "thicknessMm": 240,
                    "wallRole": "exterior",
                },
                "confidence": 0.9,
                "provenance": {"sourceDocumentId": "src-plan", "page": 1},
            }
        ]
    )

    assert report["summary"]["blockedAssemblyCount"] == 1
    blocker_codes = {row["code"] for row in report["blockers"]}
    assert "source_material_missing" in blocker_codes
    assert "source_layer_stack_missing_or_unavailable" in blocker_codes
    scope = report["assemblyScopes"][0]
    assert scope["status"] == "blocked_needs_source_or_disposition"
    assert scope["mcpAuthoringHints"]["preferredTool"] == "type.wall.upsert_or_select"


def test_source_material_assemblies_accept_layer_stack_for_wall_scope() -> None:
    report = build_source_material_assembly_report(
        [
            {
                "factId": "wall-chain-eg-north",
                "kind": "wall_chain",
                "value": {
                    "elementScope": "wall-chain-eg-north",
                    "levelId": "EG",
                    "points": [{"xMm": 0, "yMm": 0}, {"xMm": 5000, "yMm": 0}],
                    "thicknessMm": 300,
                    "wallRole": "exterior",
                },
            },
            {
                "factId": "mat-wall-eg-north",
                "kind": "material",
                "value": {
                    "elementScope": "wall-chain-eg-north",
                    "materialName": "plastered masonry",
                    "layerStack": [
                        {"function": "finish", "materialName": "plaster", "thicknessMm": 20},
                        {"function": "structure", "materialName": "masonry", "thicknessMm": 260},
                        {"function": "finish", "materialName": "plaster", "thicknessMm": 20},
                    ],
                },
            },
        ]
    )

    assert report["summary"]["readyAssemblyCount"] == 1
    assert report["summary"]["blockedAssemblyCount"] == 0
    scope = report["assemblyScopes"][0]
    assert scope["materialName"] == "plastered masonry"
    assert scope["assemblyTotalThicknessMm"] == 300
    assert scope["status"] == "ready_for_type_authoring"


def test_source_material_assemblies_accept_explicit_source_limited_disposition() -> None:
    report = build_source_material_assembly_report(
        [
            {
                "factId": "roof-main",
                "kind": "roof",
                "value": {
                    "elementScope": "main roof",
                    "roofType": "gable",
                    "boundaryRef": "roof-boundary",
                    "pitchDeg": 38,
                    "eaveHeightMm": 5600,
                    "ridgeHeightMm": 8200,
                },
            },
            {
                "factId": "mat-roof-main",
                "kind": "material",
                "value": {
                    "elementScope": "main roof",
                    "materialName": "dark roof tile",
                    "sourceAvailability": "not_in_sources",
                    "disposition": {
                        "decision": "tolerate_unavailable",
                        "reason": "Photos show tile finish but source folder has no roof build-up schedule.",
                    },
                },
            },
        ]
    )

    assert report["summary"]["sourceLimitedAssemblyCount"] == 1
    assert report["summary"]["blockedAssemblyCount"] == 0
    assert report["assemblyScopes"][0]["status"] == "source_limited_explicit"


def test_folder_acceptance_and_repair_requests_include_material_assembly_blockers() -> None:
    material_report = build_source_material_assembly_report(
        [
            {
                "factId": "wall-chain-eg-north",
                "kind": "wall_chain",
                "value": {
                    "levelId": "EG",
                    "points": [{"xMm": 0, "yMm": 0}, {"xMm": 5000, "yMm": 0}],
                    "thicknessMm": 240,
                },
            }
        ]
    )
    acceptance = _build_package_acceptance_report(
        raw_responses={"responseCount": 1},
        loop={"summary": {}},
        readiness={"summary": {}},
        conflicts={"openConflictCount": 0},
        source_completeness={"ok": True},
        room_topology={"summary": {}},
        source_area_consistency={"summary": {"blockingCount": 0}},
        coordinate_frame_alignment_report={"summary": {"blockingAlignmentCount": 0}},
        site_terrain={"summary": {"blockedActionCount": 0}},
        source_material_assemblies=material_report,
    )
    repair_requests = _build_open_repair_requests(
        loop={},
        room_topology={"rooms": []},
        source_area_consistency={"blockers": []},
        site_terrain={"actions": []},
        source_material_assemblies=material_report,
    )

    assert acceptance["ok"] is False
    assert acceptance["findings"][0]["code"] == "folder_output_material_assemblies_incomplete"
    assert acceptance["summary"]["sourceMaterialAssemblyBlockerCount"] == 1
    assert repair_requests[0]["kind"] == "source_material_assembly_repair"
    assert repair_requests[0]["workPackageId"] == "wp-current-condition"
