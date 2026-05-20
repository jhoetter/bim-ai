from __future__ import annotations

from bim_ai.source_site_terrain import (
    apply_source_site_terrain_decisions,
    build_source_site_terrain_report,
)


def test_source_site_terrain_report_blocks_uncertain_parcel_and_context_only_terrain() -> None:
    facts = [
        {
            "factId": "parcel-a",
            "kind": "parcel_boundary",
            "status": "observed_with_uncertainty",
            "confidence": 0.55,
            "value": {
                "parcelId": "Flur 21 Flurstueck 258",
                "boundary": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 10000, "yMm": 0},
                    {"xMm": 10000, "yMm": 12000},
                    {"xMm": 0, "yMm": 12000},
                    {"xMm": 0, "yMm": 0},
                ],
                "areaM2": 120,
                "coordinateFrameId": "site-frame-a",
            },
        },
        {
            "factId": "terrain-a",
            "kind": "terrain",
            "status": "observed_with_limitation",
            "confidence": 0.62,
            "value": {
                "siteRef": "parcel-a",
                "method": "visual raster interpretation",
                "confidenceNote": "No spot heights visible.",
            },
        },
        {
            "factId": "site-a",
            "kind": "site_context",
            "status": "observed",
            "confidence": 0.9,
            "value": {"parcelReference": "parcel-a"},
        },
    ]

    report = build_source_site_terrain_report(facts)

    assert report["summary"] == {
        "parcelCount": 1,
        "terrainCount": 1,
        "siteContextCount": 1,
        "exactToposolidCandidateCount": 0,
        "contextOnlyTerrainCount": 1,
        "buildingPlacementKnownCount": 0,
        "actionCount": 3,
        "blockedActionCount": 3,
        "kindCounts": {
            "building_placement_alignment_required": 1,
            "parcel_precision_repair": 1,
            "terrain_source_repair_or_tolerance": 1,
        },
    }
    assert report["terrain"][0]["terrainDecision"] == "context_only_or_tolerance_required"
    assert report["actions"][0]["kind"] == "parcel_precision_repair"


def test_source_site_terrain_report_accepts_measured_toposolid_inputs() -> None:
    facts = [
        {
            "factId": "parcel-a",
            "kind": "parcel_boundary",
            "status": "observed",
            "confidence": 0.95,
            "value": {
                "parcelId": "parcel-a",
                "boundary": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                    {"xMm": 0, "yMm": 0},
                ],
                "areaM2": 1,
                "coordinateFrameId": "frame-site",
            },
        },
        {
            "factId": "terrain-a",
            "kind": "terrain",
            "status": "observed",
            "confidence": 0.9,
            "value": {
                "siteRef": "parcel-a",
                "elevationPoints": [{"xMm": 0, "yMm": 0, "zMm": 0}],
            },
        },
        {
            "factId": "site-a",
            "kind": "site_context",
            "status": "observed",
            "confidence": 0.9,
            "value": {
                "parcelReference": "parcel-a",
                "roadRelationship": "fronts street",
                "buildingPlacement": {"originMm": {"xMm": 100, "yMm": 200}},
            },
        },
    ]

    report = build_source_site_terrain_report(facts)

    assert report["summary"]["exactToposolidCandidateCount"] == 1
    assert report["summary"]["blockedActionCount"] == 0
    assert report["actions"] == []


def test_source_site_terrain_report_blocks_missing_site_evidence() -> None:
    report = build_source_site_terrain_report([])

    assert report["summary"]["actionCount"] == 1
    assert report["actions"][0]["kind"] == "site_context_setup_required"


def test_apply_source_site_terrain_decisions_resolves_valid_tolerance_and_placement() -> None:
    report = {
        "format": "reverseBimSourceSiteTerrainReport_v1",
        "summary": {"actionCount": 3, "blockedActionCount": 3},
        "actions": [
            {
                "id": "parcel-precision:parcel-a",
                "kind": "parcel_precision_repair",
                "status": "blocked_needs_source_precision",
            },
            {
                "id": "terrain-decision:terrain-a",
                "kind": "terrain_source_repair_or_tolerance",
                "status": "blocked_needs_source_precision_or_tolerance",
            },
            {
                "id": "building-placement:site-a",
                "kind": "building_placement_alignment_required",
                "status": "blocked_needs_source_alignment",
            },
        ],
    }

    decision_report = apply_source_site_terrain_decisions(
        report,
        [
            {
                "actionId": "parcel-precision:parcel-a",
                "decision": "accept_context_only",
                "reason": "Raster parcel is context only.",
                "decidedBy": "test",
                "sourceRefs": ["site-plan"],
            },
            {
                "actionId": "terrain-decision:terrain-a",
                "decision": "accept_context_only_no_toposolid",
                "reason": "No contours or spot heights in source package.",
                "decidedBy": "test",
                "sourceRefs": ["site-plan"],
                "tolerance": {"findingCodes": ["site_relationship_missing_toposolid"]},
            },
            {
                "actionId": "building-placement:site-a",
                "decision": "accept_building_placement",
                "reason": "Placement taken from aligned site plan.",
                "decidedBy": "test",
                "sourceRefs": ["site-plan"],
                "buildingPlacement": {"originMm": {"xMm": 0, "yMm": 0}},
                "roadRelationship": "fronts Weidenstrasse",
            },
        ],
    )

    assert decision_report["accepted"] is True
    assert decision_report["summary"]["blockedActionCount"] == 0
    assert decision_report["siteTerrainReport"]["summary"]["resolvedActionCount"] == 3


def test_apply_source_site_terrain_decisions_keeps_invalid_decisions_blocked() -> None:
    report = {
        "actions": [
            {
                "id": "building-placement:site-a",
                "kind": "building_placement_alignment_required",
                "status": "blocked_needs_source_alignment",
            }
        ]
    }

    decision_report = apply_source_site_terrain_decisions(
        report,
        [{"actionId": "building-placement:site-a", "decision": "accept_building_placement"}],
    )

    assert decision_report["accepted"] is False
    assert decision_report["summary"]["invalidDecisionCount"] == 1
    assert decision_report["summary"]["blockedActionCount"] == 1
