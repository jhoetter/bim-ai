from __future__ import annotations

from bim_ai.folder_output import _build_open_repair_requests, _build_package_acceptance_report
from bim_ai.source_level_completeness import build_source_level_completeness_report


def test_source_level_completeness_blocks_empty_required_level() -> None:
    report = build_source_level_completeness_report(
        [
            {"factId": "level-kg", "kind": "level", "value": {"levelId": "KG", "name": "KG"}},
            {"factId": "level-eg", "kind": "level", "value": {"levelId": "EG", "name": "EG"}},
            {
                "factId": "wall-eg",
                "kind": "wall_chain",
                "value": {
                    "levelId": "EG",
                    "points": [{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
                    "thicknessMm": 240,
                },
            },
        ]
    )

    assert report["ok"] is False
    assert report["summary"]["emptySourceLevelCount"] == 1
    kg = next(row for row in report["levels"] if row.get("levelId") == "KG")
    assert kg["status"] == "blocked_no_physical_source_content"


def test_source_level_completeness_accepts_physical_source_content_per_level() -> None:
    report = build_source_level_completeness_report(
        [
            {"factId": "level-kg", "kind": "level", "value": {"levelId": "KG", "name": "KG"}},
            {
                "factId": "room-kg",
                "kind": "room",
                "value": {
                    "levelId": "KG",
                    "name": "Keller",
                    "boundaryMm": [{"xMm": 0, "yMm": 0}],
                },
            },
        ]
    )

    assert report["ok"] is True
    assert report["summary"]["blockingCount"] == 0


def test_folder_acceptance_and_repairs_include_source_level_blockers() -> None:
    level_report = build_source_level_completeness_report(
        [{"factId": "level-kg", "kind": "level", "value": {"levelId": "KG", "name": "KG"}}]
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
        source_material_assemblies={"summary": {"blockedAssemblyCount": 0}},
        reader_consensus={"summary": {"blockingCount": 0}},
        source_level_completeness=level_report,
    )
    repair_requests = _build_open_repair_requests(
        loop={},
        room_topology={"rooms": []},
        source_area_consistency={"blockers": []},
        site_terrain={"actions": []},
        source_material_assemblies={"assemblyScopes": []},
        reader_consensus={"blockers": []},
        source_level_completeness=level_report,
    )

    assert acceptance["ok"] is False
    assert acceptance["findings"][0]["code"] == "folder_output_source_levels_incomplete"
    assert repair_requests[0]["kind"] == "source_level_completeness_repair"
