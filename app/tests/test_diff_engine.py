"""CLI-02: diff_engine.compute_element_diff classifies adds / removes /
modifications and produces per-kind summary counts. Pure-functional
tests — no DB, no HTTP."""

from __future__ import annotations

from bim_ai.diff_engine import compute_element_diff


def test_added_removed_modified_classification() -> None:
    src = {
        "lvl-g": {"kind": "level", "id": "lvl-g", "name": "G", "elevationMm": 0},
        "w-a": {"kind": "wall", "id": "w-a", "thicknessMm": 200, "heightMm": 2800},
        "w-b": {"kind": "wall", "id": "w-b", "thicknessMm": 100, "heightMm": 2800},
    }
    dst = {
        "lvl-g": {"kind": "level", "id": "lvl-g", "name": "G", "elevationMm": 0},
        "w-a": {"kind": "wall", "id": "w-a", "thicknessMm": 250, "heightMm": 2800},
        "d-1": {"kind": "door", "id": "d-1", "wallId": "w-a", "alongT": 0.5},
    }

    diff = compute_element_diff(src, dst)

    assert {e["id"] for e in diff["added"]} == {"d-1"}
    assert {e["id"] for e in diff["removed"]} == {"w-b"}
    modified_ids = {m["id"] for m in diff["modified"]}
    assert modified_ids == {"w-a"}, modified_ids

    field_changes = next(m["fieldChanges"] for m in diff["modified"] if m["id"] == "w-a")
    fields = {fc["field"]: (fc["from"], fc["to"]) for fc in field_changes}
    assert fields == {"thicknessMm": (200, 250)}


def test_summary_counts_and_by_kind() -> None:
    src = {
        "w-a": {"kind": "wall", "id": "w-a"},
        "w-b": {"kind": "wall", "id": "w-b"},
    }
    dst = {
        "w-a": {"kind": "wall", "id": "w-a", "name": "renamed"},
        "d-1": {"kind": "door", "id": "d-1"},
        "d-2": {"kind": "door", "id": "d-2"},
    }

    diff = compute_element_diff(src, dst)
    summary = diff["summary"]

    assert summary["addedCount"] == 2
    assert summary["removedCount"] == 1
    assert summary["modifiedCount"] == 1
    by_kind = summary["byKind"]
    assert by_kind["wall"] == {"added": 0, "removed": 1, "modified": 1}
    assert by_kind["door"] == {"added": 2, "removed": 0, "modified": 0}


def test_identical_snapshots_have_empty_diff() -> None:
    src = {"a": {"kind": "level", "id": "a", "name": "G"}}
    diff = compute_element_diff(src, dict(src))
    assert diff["added"] == []
    assert diff["removed"] == []
    assert diff["modified"] == []
    assert diff["summary"]["addedCount"] == 0
    assert diff["summary"]["modifiedCount"] == 0


def test_field_added_or_removed_listed_with_none() -> None:
    src = {"w": {"kind": "wall", "id": "w", "thicknessMm": 200}}
    dst = {"w": {"kind": "wall", "id": "w", "thicknessMm": 200, "materialKey": "mat-brick"}}
    diff = compute_element_diff(src, dst)
    fields = next(m["fieldChanges"] for m in diff["modified"] if m["id"] == "w")
    by_field = {fc["field"]: fc for fc in fields}
    assert "materialKey" in by_field
    assert by_field["materialKey"]["from"] is None
    assert by_field["materialKey"]["to"] == "mat-brick"
