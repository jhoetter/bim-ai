"""Unit tests for the diff helpers in ``routes_time_travel``.

The helpers operate on raw document dicts and require no DB or
HTTP layer; full route coverage lives in the DB-backed integration tier.
"""

from __future__ import annotations

from bim_ai.routes_time_travel import (
    _diff_documents_cheap,
    _diff_documents_deep,
)


def _doc(elements: dict[str, dict]) -> dict:
    return {"revision": 1, "elements": elements}


def test_cheap_diff_counts_by_kind() -> None:
    a = _doc(
        {
            "w1": {"kind": "wall"},
            "w2": {"kind": "wall"},
            "d1": {"kind": "door"},
        }
    )
    b = _doc(
        {
            "w1": {"kind": "wall"},
            "w2": {"kind": "wall", "length_mm": 4000},  # modified
            "d2": {"kind": "door"},  # added
            "win1": {"kind": "window"},  # added
        }
    )
    out = _diff_documents_cheap(a, b)
    assert out["addedCount"] == 2
    assert out["modifiedCount"] == 1
    assert out["removedCount"] == 1
    assert out["addedByKind"] == {"door": 1, "window": 1}
    assert out["modifiedByKind"] == {"wall": 1}
    assert out["removedByKind"] == {"door": 1}


def test_cheap_diff_handles_garbage_inputs() -> None:
    assert _diff_documents_cheap({}, {})["addedCount"] == 0
    assert _diff_documents_cheap({"elements": "not a dict"}, {})["addedCount"] == 0


def test_deep_diff_emits_per_element_changes() -> None:
    a = _doc(
        {
            "w1": {"kind": "wall", "length_mm": 3000},
            "w2": {"kind": "wall", "length_mm": 5000},
        }
    )
    b = _doc(
        {
            "w1": {"kind": "wall", "length_mm": 3500},  # modified
            "w3": {"kind": "wall", "length_mm": 2000},  # added
        }
    )
    out = _diff_documents_deep(a, b)

    assert {row["id"] for row in out["added"]} == {"w3"}
    assert {row["id"] for row in out["removed"]} == {"w2"}
    assert {row["id"] for row in out["modified"]} == {"w1"}

    modified_w1 = out["modified"][0]
    assert modified_w1["id"] == "w1"
    assert modified_w1["kind"] == "wall"
    assert modified_w1["changedFields"] == ["length_mm"]
    assert modified_w1["before"] == {"kind": "wall", "length_mm": 3000}
    assert modified_w1["after"] == {"kind": "wall", "length_mm": 3500}

    # Cheap fields included alongside per-element lists.
    assert out["addedCount"] == 1
    assert out["modifiedCount"] == 1
    assert out["removedCount"] == 1


def test_deep_diff_changed_fields_handles_added_and_removed_keys() -> None:
    a = _doc({"e": {"kind": "wall", "x": 1, "y": 2}})
    b = _doc({"e": {"kind": "wall", "y": 99, "z": 3}})
    out = _diff_documents_deep(a, b)
    assert out["modified"][0]["changedFields"] == ["x", "y", "z"]


def test_deep_diff_identical_docs_are_empty() -> None:
    a = _doc({"e": {"kind": "wall"}})
    out = _diff_documents_deep(a, a)
    assert out["added"] == []
    assert out["modified"] == []
    assert out["removed"] == []
