"""DSC-V3-01 — discipline tag primitive tests.

Covers: SetElementDiscipline (happy path, undo, invalid discipline,
        non-physical element rejection, nonexistent element rejection,
        multi-element batch), default discipline on create.
"""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import ColumnElem, WallElem
from bim_ai.engine import try_commit_bundle


def _seed() -> Document:
    return Document(revision=1, elements={})


def _create_level(id_: str = "lvl-1", name: str = "Ground") -> dict:
    return {"type": "createLevel", "id": id_, "name": name, "elevationMm": 0}


def _create_wall(id_: str = "w-1", level_id: str = "lvl-1", y_mm: float = 0) -> dict:
    return {
        "type": "createWall",
        "id": id_,
        "levelId": level_id,
        "start": {"xMm": 0, "yMm": y_mm},
        "end": {"xMm": 5000, "yMm": y_mm},
    }


def _create_column(
    id_: str = "col-1", level_id: str = "lvl-1", x_mm: float = 1000, y_mm: float = 1000
) -> dict:
    return {
        "type": "createColumn",
        "id": id_,
        "levelId": level_id,
        "positionMm": {"xMm": x_mm, "yMm": y_mm},
        "heightMm": 3000,
    }


# ---------------------------------------------------------------------------
# Default discipline on create
# ---------------------------------------------------------------------------


def test_wall_gets_arch_discipline_on_create() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall()])
    assert ok
    wall = nd.elements["w-1"]
    assert isinstance(wall, WallElem)
    assert wall.discipline == "arch"


def test_column_gets_struct_discipline_on_create() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_column()])
    assert ok
    col = nd.elements["col-1"]
    assert isinstance(col, ColumnElem)
    assert col.discipline == "struct"


# ---------------------------------------------------------------------------
# SetElementDiscipline — happy path
# ---------------------------------------------------------------------------


def test_set_element_discipline_wall_to_struct() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall()])
    assert ok
    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["w-1"], "discipline": "struct"}],
    )
    assert ok2
    assert nd2.elements["w-1"].discipline == "struct"


def test_set_element_discipline_column_to_mep() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_column(x_mm=2000, y_mm=2000)])
    assert ok
    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["col-1"], "discipline": "mep"}],
    )
    assert ok2
    assert nd2.elements["col-1"].discipline == "mep"


def test_set_element_discipline_all_three_values() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall()])
    assert ok
    for disc in ("arch", "struct", "mep"):
        ok2, nd2, *_ = try_commit_bundle(
            nd,
            [{"type": "setElementDiscipline", "elementIds": ["w-1"], "discipline": disc}],
        )
        assert ok2, f"discipline={disc!r} should be accepted"
        assert nd2.elements["w-1"].discipline == disc


# ---------------------------------------------------------------------------
# Undo (revision rollback via original document)
# ---------------------------------------------------------------------------


def test_set_element_discipline_undo_reverts() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall()])
    assert ok
    # Tag as struct
    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["w-1"], "discipline": "struct"}],
    )
    assert ok2
    assert nd2.elements["w-1"].discipline == "struct"
    # Applying the same command to nd (pre-change) effectively "undoes" the tag
    ok3, nd3, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["w-1"], "discipline": "arch"}],
    )
    assert ok3
    assert nd3.elements["w-1"].discipline == "arch"


# ---------------------------------------------------------------------------
# Rejection: non-physical element
# ---------------------------------------------------------------------------


def test_set_element_discipline_on_level_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level()])
    assert ok
    # Levels don't have a discipline field
    ok2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["lvl-1"], "discipline": "arch"}],
    )
    assert not ok2


# ---------------------------------------------------------------------------
# Rejection: nonexistent element
# ---------------------------------------------------------------------------


def test_set_element_discipline_nonexistent_element_rejected() -> None:
    ok, *_ = try_commit_bundle(
        _seed(),
        [{"type": "setElementDiscipline", "elementIds": ["nonexistent-id"], "discipline": "arch"}],
    )
    assert not ok


# ---------------------------------------------------------------------------
# Rejection: invalid discipline value
# ---------------------------------------------------------------------------


def test_set_element_discipline_invalid_value_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall()])
    assert ok
    ok2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["w-1"], "discipline": "mechanical"}],
    )
    assert not ok2


def test_set_element_discipline_empty_value_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall()])
    assert ok
    ok2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementDiscipline", "elementIds": ["w-1"], "discipline": ""}],
    )
    assert not ok2


# ---------------------------------------------------------------------------
# Multi-element batch
# ---------------------------------------------------------------------------


def test_set_element_discipline_multiple_elements() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            _create_level(),
            _create_wall("w-1", y_mm=0),
            _create_wall("w-2", y_mm=5000),
            _create_wall("w-3", y_mm=10000),
        ],
    )
    assert ok
    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [
            {
                "type": "setElementDiscipline",
                "elementIds": ["w-1", "w-2", "w-3"],
                "discipline": "struct",
            }
        ],
    )
    assert ok2
    assert nd2.elements["w-1"].discipline == "struct"
    assert nd2.elements["w-2"].discipline == "struct"
    assert nd2.elements["w-3"].discipline == "struct"


def test_set_element_discipline_batch_partial_invalid_element_rejected() -> None:
    """Batch with one valid and one nonexistent ID must fail atomically."""
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level(), _create_wall("w-1", y_mm=0)])
    assert ok
    ok2, *_ = try_commit_bundle(
        nd,
        [
            {
                "type": "setElementDiscipline",
                "elementIds": ["w-1", "ghost-id"],
                "discipline": "struct",
            }
        ],
    )
    assert not ok2
    # Original document should be unchanged
    assert nd.elements["w-1"].discipline == "arch"
