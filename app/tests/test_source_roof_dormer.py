from __future__ import annotations

from bim_ai.source_roof_dormer import build_source_roof_dormer_report


def test_source_roof_dormer_report_blocks_estimated_roof_and_missing_dormer_depth() -> None:
    facts = [
        {
            "factId": "roof-a",
            "kind": "roof",
            "status": "source_visible_estimate",
            "confidence": 0.6,
            "value": {
                "roofType": "gable",
                "boundaryMm": [{"xMm": 0, "yMm": 0}],
                "pitchDeg": 45,
                "eaveHeightMm": 5000,
                "ridgeHeightMm": 9000,
            },
        },
        {
            "factId": "dormer-a",
            "kind": "dormer",
            "status": "observed",
            "confidence": 0.9,
            "value": {
                "hostRoofRef": "roof-a",
                "position": {"xMm": 1000, "yMm": 2000},
                "widthMm": 2000,
                "heightMm": 1000,
            },
        },
    ]

    report = build_source_roof_dormer_report(facts)

    assert report["summary"] == {
        "roofCount": 1,
        "dormerCount": 1,
        "roofOpeningCount": 0,
        "actionCount": 2,
        "blockedActionCount": 2,
        "kindCounts": {
            "dormer_precision_repair": 1,
            "roof_precision_repair": 1,
        },
    }
    assert report["roofs"][0]["sourcePrecision"] == "estimated"
    assert report["dormers"][0]["missingFields"] == ["depthMm"]


def test_source_roof_dormer_report_checks_roof_opening_host_and_position() -> None:
    facts = [
        {
            "factId": "roof-window",
            "kind": "opening",
            "status": "uncertain",
            "confidence": 0.4,
            "value": {
                "openingType": "roof window",
                "widthMm": 800,
                "heightMm": 1200,
            },
        }
    ]

    report = build_source_roof_dormer_report(facts)

    assert report["summary"]["roofOpeningCount"] == 1
    assert report["roofOpenings"][0]["missingFields"] == ["hostRoofRef", "position"]
    assert report["actions"][0]["kind"] == "roof_opening_precision_repair"
