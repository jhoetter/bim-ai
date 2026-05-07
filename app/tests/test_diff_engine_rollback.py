"""CLI-02: covers the engine-level rollback used by ``_document_at_revision``.

Doesn't go through HTTP — instead exercises the same pattern: build a
sequence of revisions by replaying forward bundles, then walk backwards
via the undo bundles and confirm the diff between any two arbitrary
revisions matches what the diff engine produces directly from the live
documents.
"""

from __future__ import annotations

from typing import Any

from bim_ai.diff_engine import compute_element_diff
from bim_ai.document import Document
from bim_ai.engine import clone_document, diff_undo_cmds, try_commit_bundle


def _wire_elements(doc: Document) -> dict[str, dict[str, Any]]:
    return {k: v.model_dump(by_alias=True) for k, v in doc.elements.items()}


def _replay_to_revision(
    current: Document,
    undo_history: list[dict[str, Any]],
    target_rev: int,
) -> Document:
    """Mirror of routes_api._document_at_revision (sync, in-memory).

    ``undo_history`` is an ordered list of {"revision_after", "undo_commands"}
    dicts produced as forward bundles were committed (oldest first). To roll
    back to ``target_rev`` we apply undo bundles for each step where
    ``revision_after > target_rev``, in reverse order.
    """
    if target_rev == current.revision:
        return clone_document(current)
    rolling = clone_document(current)
    for entry in reversed(undo_history):
        if entry["revision_after"] <= target_rev:
            continue
        if entry["revision_after"] > current.revision:
            continue
        ok, new_doc, _cmds, _viols, _code = try_commit_bundle(rolling, list(entry["undo_commands"]))
        assert ok and new_doc is not None, "undo replay failed"
        rolling = new_doc
    return rolling


def _commit_bundle(
    doc: Document, cmds: list[dict[str, Any]]
) -> tuple[Document, list[dict[str, Any]]]:
    baseline = clone_document(doc)
    ok, new_doc, _cmds, _viols, _code = try_commit_bundle(doc, cmds)
    assert ok and new_doc is not None
    undos = diff_undo_cmds(baseline, new_doc)
    return new_doc, undos


def test_rollback_walks_undo_history_to_arbitrary_revision() -> None:
    doc0 = Document(revision=1, elements={})  # type: ignore[arg-type]

    # rev 2: add a level
    add_level = {
        "type": "createLevel",
        "id": "lvl-g",
        "name": "G",
        "elevationMm": 0,
    }
    doc1, u1 = _commit_bundle(doc0, [add_level])

    # rev 3: add a wall
    add_wall = {
        "type": "createWall",
        "id": "w-a",
        "name": "W",
        "levelId": "lvl-g",
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 4000, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 2800,
    }
    doc2, u2 = _commit_bundle(doc1, [add_wall])

    # rev 4: thicken the wall
    thicken = {
        "type": "updateElementProperty",
        "elementId": "w-a",
        "key": "thicknessMm",
        "value": 250,
    }
    doc3, u3 = _commit_bundle(doc2, [thicken])

    history: list[dict[str, Any]] = [
        {"revision_after": doc1.revision, "undo_commands": u1},
        {"revision_after": doc2.revision, "undo_commands": u2},
        {"revision_after": doc3.revision, "undo_commands": u3},
    ]

    rolled_to_rev2 = _replay_to_revision(doc3, history, doc1.revision)
    assert "w-a" not in rolled_to_rev2.elements

    rolled_to_rev3 = _replay_to_revision(doc3, history, doc2.revision)
    assert "w-a" in rolled_to_rev3.elements
    assert rolled_to_rev3.elements["w-a"].thickness_mm == 200

    diff = compute_element_diff(_wire_elements(rolled_to_rev3), _wire_elements(doc3))
    assert diff["summary"]["addedCount"] == 0
    assert diff["summary"]["removedCount"] == 0
    assert diff["summary"]["modifiedCount"] == 1
    fc = diff["modified"][0]["fieldChanges"]
    fields = {f["field"]: (f["from"], f["to"]) for f in fc}
    assert fields == {"thicknessMm": (200, 250)}


def test_rollback_to_current_revision_is_noop() -> None:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    add_level = {"type": "createLevel", "id": "lvl-g", "name": "G", "elevationMm": 0}
    new_doc, _u = _commit_bundle(doc, [add_level])
    rolled = _replay_to_revision(new_doc, [], new_doc.revision)
    assert _wire_elements(rolled) == _wire_elements(new_doc)
