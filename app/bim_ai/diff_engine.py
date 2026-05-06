"""CLI-02: element-level diff between two model snapshots.

Pure-functional diff that takes two ``id -> element-dict`` maps and produces:

- ``added``    : elements present at ``to`` but not at ``from``
- ``removed``  : elements present at ``from`` but not at ``to``
- ``modified`` : ids present in both whose dicts differ, with field-level
                  ``{field, from, to}`` change rows
- ``summary``  : per-bucket counts plus a per-kind breakdown

Used by the ``GET /api/models/{id}/diff`` endpoint and by the ``bim-ai diff``
CLI subcommand. Compares wire-format (alias-keyed) element dicts so results
match the snapshot endpoint's serialization.
"""

from __future__ import annotations

from typing import Any


def _kind_of(elem: dict[str, Any] | None) -> str:
    if not isinstance(elem, dict):
        return "?"
    k = elem.get("kind")
    return k if isinstance(k, str) else "?"


def compute_element_diff(
    elements_from: dict[str, dict[str, Any]],
    elements_to: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Diff two id -> element-dict maps. Pure; no I/O."""
    keys_from = set(elements_from.keys())
    keys_to = set(elements_to.keys())

    added_ids = sorted(keys_to - keys_from)
    removed_ids = sorted(keys_from - keys_to)
    common_ids = sorted(keys_from & keys_to)

    added: list[dict[str, Any]] = [dict(elements_to[i]) for i in added_ids]
    removed: list[dict[str, Any]] = [dict(elements_from[i]) for i in removed_ids]

    modified: list[dict[str, Any]] = []
    for eid in common_ids:
        a = elements_from[eid]
        b = elements_to[eid]
        if a == b:
            continue
        all_fields = sorted(set(a.keys()) | set(b.keys()))
        field_changes: list[dict[str, Any]] = []
        for f in all_fields:
            va = a.get(f)
            vb = b.get(f)
            if va != vb:
                field_changes.append({"field": f, "from": va, "to": vb})
        modified.append(
            {
                "id": eid,
                "kind": _kind_of(b) if _kind_of(b) != "?" else _kind_of(a),
                "fieldChanges": field_changes,
            }
        )

    by_kind: dict[str, dict[str, int]] = {}

    def _bump(kind: str, key: str) -> None:
        bucket = by_kind.setdefault(kind, {"added": 0, "removed": 0, "modified": 0})
        bucket[key] += 1

    for el in added:
        _bump(_kind_of(el), "added")
    for el in removed:
        _bump(_kind_of(el), "removed")
    for m in modified:
        _bump(str(m["kind"]), "modified")

    return {
        "added": added,
        "removed": removed,
        "modified": modified,
        "summary": {
            "addedCount": len(added),
            "removedCount": len(removed),
            "modifiedCount": len(modified),
            "byKind": by_kind,
        },
    }
