from __future__ import annotations

from bim_ai.folder_output import _build_open_repair_requests, _build_package_acceptance_report
from bim_ai.source_building_scope import build_source_building_scope_report
from bim_ai.source_reader_consensus import build_source_reader_consensus_report


def test_source_building_scope_blocks_missing_or_ambiguous_target_scope() -> None:
    missing_report = build_source_building_scope_report([])
    ambiguous_report = build_source_building_scope_report(
        [
            {
                "factId": "scope-a",
                "kind": "building_scope",
                "value": {
                    "scopeType": "ambiguous",
                    "modeledExtent": "unclear whether full Doppelhaus or right half",
                    "evidenceSummary": "title block says Doppelwohnhäuser; plan crop shows one mirrored half",
                },
            }
        ]
    )

    assert missing_report["ok"] is False
    assert missing_report["blockers"][0]["code"] == "building_scope_missing"
    assert ambiguous_report["ok"] is False
    assert ambiguous_report["summary"]["unresolvedScopeFactCount"] == 1
    assert ambiguous_report["blockers"][0]["code"] == "building_scope_unresolved"


def test_source_building_scope_accepts_target_half_with_context_scope() -> None:
    report = build_source_building_scope_report(
        [
            {
                "factId": "scope-target",
                "kind": "building_scope",
                "value": {
                    "scopeType": "target_half",
                    "modeledExtent": "right half of Doppelhaus, Weidenstrasse 6",
                    "evidenceSummary": "address/party wall evidence shows the right half is the target scope",
                    "targetScopeId": "leo-right-half",
                    "contextScopeRefs": ["left-adjoining-half"],
                    "scopeBoundaryRef": "wall-chain-eg-party-wall plus target exterior boundary",
                },
            },
            {
                "factId": "scope-context",
                "kind": "building_scope",
                "value": {
                    "scopeType": "context_only",
                    "modeledExtent": "left adjoining half only used for party-wall and elevation context",
                    "evidenceSummary": "mirrored elevation/floorplan context from same source sheet",
                },
            },
        ]
    )

    assert report["ok"] is True
    assert report["summary"]["resolvedTargetScopeType"] == "target_half"
    assert report["summary"]["targetHalfDirection"] == "right"
    assert report["summary"]["contextScopeFactCount"] == 1


def test_source_building_scope_blocks_target_half_without_scope_mask() -> None:
    report = build_source_building_scope_report(
        [
            {
                "factId": "scope-target",
                "kind": "building_scope",
                "value": {
                    "scopeType": "target_half",
                    "modeledExtent": "right half of Doppelhaus",
                    "evidenceSummary": "address/party wall evidence shows the right half is the target scope",
                },
            }
        ]
    )

    assert report["ok"] is False
    assert report["blockers"][0]["code"] == "building_scope_mask_missing"


def test_source_building_scope_blocks_target_type_conflict() -> None:
    report = build_source_building_scope_report(
        [
            {
                "factId": "scope-full",
                "kind": "building_scope",
                "value": {
                    "scopeType": "whole_doppelhaus",
                    "modeledExtent": "whole Doppelhaus with both halves",
                    "evidenceSummary": "title block describes Doppelwohnhäuser",
                },
            },
            {
                "factId": "scope-half",
                "kind": "building_scope",
                "value": {
                    "scopeType": "target_half",
                    "modeledExtent": "right half only",
                    "evidenceSummary": "parcel/address evidence points to one half",
                    "scopeBoundaryRef": "right-half perimeter",
                },
            },
        ]
    )

    assert report["ok"] is False
    assert report["blockers"][0]["code"] == "building_scope_target_type_conflict"


def test_folder_acceptance_and_repairs_include_building_scope_blockers() -> None:
    scope_report = build_source_building_scope_report([])
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
        roof_dormer={"summary": {"blockedActionCount": 0}},
        source_material_assemblies={"summary": {"blockedAssemblyCount": 0}},
        reader_consensus={"summary": {"blockingCount": 0}},
        source_level_completeness={"summary": {}},
        source_building_scope=scope_report,
    )
    repairs = _build_open_repair_requests(
        loop={},
        room_topology={"rooms": []},
        source_building_scope=scope_report,
    )

    assert acceptance["ok"] is False
    assert acceptance["summary"]["buildingScopeBlockerCount"] == 1
    assert acceptance["findings"][0]["code"] == "folder_output_building_scope_unresolved"
    assert repairs[0]["kind"] == "building_scope_repair"


def test_reader_consensus_treats_building_scope_as_critical() -> None:
    report = build_source_reader_consensus_report(
        [
            {
                "workPackageId": "wp-dimensional-floorplans",
                "readerId": "reader-a",
                "facts": [
                    {
                        "factId": "scope-a",
                        "kind": "building_scope",
                        "value": {
                        "scopeType": "target_half",
                        "modeledExtent": "right half",
                        "evidenceSummary": "visible title/address evidence",
                        "scopeBoundaryRef": "target half perimeter",
                    },
                    }
                ],
            }
        ],
        min_independent_readers=2,
    )

    assert report["ok"] is False
    assert report["blockers"][0]["code"] == "reader_consensus_insufficient_independent_passes"
    assert "building_scope" in report["blockers"][0]["criticalFactKinds"]
