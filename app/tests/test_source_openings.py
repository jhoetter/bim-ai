from __future__ import annotations

from bim_ai.source_openings import build_source_opening_reconciliation


def test_source_opening_reconciliation_classifies_hosts_and_duplicates() -> None:
    facts = [
        {
            "factId": "door-plan",
            "kind": "opening",
            "value": {
                "levelId": "EG",
                "openingType": "door",
                "hostWallRef": "south wall",
                "widthMm": 1000,
                "heightMm": 2175,
            },
            "provenance": {"sourceDocumentId": "doc-plan", "page": 1, "region": "entry"},
        },
        {
            "factId": "door-elevation",
            "kind": "opening",
            "value": {
                "levelId": "EG",
                "openingType": "entry door",
                "hostWallRef": "front facade",
                "widthMm": 1050,
                "heightMm": 2200,
            },
            "provenance": {"sourceDocumentId": "doc-elevation", "page": 1, "region": "front"},
        },
        {
            "factId": "roof-window",
            "kind": "opening",
            "value": {
                "levelId": "DG",
                "openingType": "roof window",
                "hostWallRef": "roof plane",
                "widthMm": 800,
                "heightMm": 1200,
            },
        },
    ]

    report = build_source_opening_reconciliation(facts)

    assert report["summary"] == {
        "openingCount": 3,
        "actionCount": 4,
        "blockedActionCount": 4,
        "kindCounts": {
            "opening_duplicate_candidate": 1,
            "opening_host_resolution": 3,
        },
    }
    host_actions = [action for action in report["actions"] if action["kind"] == "opening_host_resolution"]
    assert host_actions[0]["requiredResolvers"] == ["resolve.wall_by_line", "query.nearest_wall"]
    assert host_actions[2]["requiredResolvers"] == [
        "resolve.roof_host_region",
        "resolve.roof_position_from_source_point",
    ]
    duplicate = next(action for action in report["actions"] if action["kind"] == "opening_duplicate_candidate")
    assert duplicate["factIds"] == ["door-plan", "door-elevation"]


def test_source_opening_reconciliation_routes_dormer_windows_to_dormer_resolver() -> None:
    facts = [
        {
            "factId": "dormer-window",
            "kind": "opening",
            "value": {
                "levelId": "DG",
                "openingType": "window",
                "hostWallRef": "north dormer face",
            },
        }
    ]

    report = build_source_opening_reconciliation(facts)

    assert report["openings"][0]["hostKind"] == "dormer"
    assert report["actions"][0]["requiredResolvers"] == ["resolve.dormer_opening_host"]
