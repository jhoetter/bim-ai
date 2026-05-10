"""VIE-07 — Pin/unpin element + pin-block on mutating commands."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import GridLineElem, LevelElem, LinkDxfElem, Vec2Mm, WallElem
from bim_ai.engine import is_element_pinned, try_commit_bundle


def _seed_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                name="W1",
                levelId="lvl-1",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=5000, yMm=0),
                thicknessMm=200,
                heightMm=2800,
            ),
            "grid-A": GridLineElem(
                kind="grid_line",
                id="grid-A",
                name="A",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=0, yMm=10000),
                label="A",
            ),
        },
    )


def test_pin_element_sets_pinned_true_and_unpin_clears():
    doc = _seed_doc()
    ok, nd, *_ = try_commit_bundle(doc, [{"type": "pinElement", "elementId": "wall-1"}])
    assert ok is True and nd is not None
    assert is_element_pinned(nd.elements["wall-1"]) is True

    ok2, nd2, *_ = try_commit_bundle(nd, [{"type": "unpinElement", "elementId": "wall-1"}])
    assert ok2 is True and nd2 is not None
    assert is_element_pinned(nd2.elements["wall-1"]) is False


def test_move_wall_endpoints_refuses_pinned_wall_without_override():
    doc = _seed_doc()
    _, doc1, *_ = try_commit_bundle(doc, [{"type": "pinElement", "elementId": "wall-1"}])
    assert doc1 is not None
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc1,
        [
            {
                "type": "moveWallEndpoints",
                "wallId": "wall-1",
                "start": {"xMm": 100, "yMm": 100},
                "end": {"xMm": 5100, "yMm": 100},
            }
        ],
    )
    assert ok is False, "Expected rejection for pinned wall"
    assert new_doc is None
    assert "pinned_element_blocked" in code


def test_force_pin_override_allows_move_on_pinned_wall():
    doc = _seed_doc()
    _, doc1, *_ = try_commit_bundle(doc, [{"type": "pinElement", "elementId": "wall-1"}])
    assert doc1 is not None
    ok, nd, *_ = try_commit_bundle(
        doc1,
        [
            {
                "type": "moveWallEndpoints",
                "wallId": "wall-1",
                "start": {"xMm": 100, "yMm": 100},
                "end": {"xMm": 5100, "yMm": 100},
                "forcePinOverride": True,
            }
        ],
    )
    assert ok is True and nd is not None
    moved = nd.elements["wall-1"]
    assert isinstance(moved, WallElem)
    assert (moved.start.x_mm, moved.start.y_mm) == (100, 100)


def test_pinned_grid_blocks_move_grid_endpoints():
    doc = _seed_doc()
    _, doc1, *_ = try_commit_bundle(doc, [{"type": "pinElement", "elementId": "grid-A"}])
    assert doc1 is not None
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc1,
        [
            {
                "type": "moveGridLineEndpoints",
                "gridLineId": "grid-A",
                "start": {"xMm": 50, "yMm": 0},
                "end": {"xMm": 50, "yMm": 10000},
            }
        ],
    )
    assert ok is False, "Expected rejection for pinned grid line"
    assert new_doc is None
    assert "pinned_element_blocked" in code


def test_unpin_unknown_element_raises():
    doc = _seed_doc()
    ok, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc, [{"type": "unpinElement", "elementId": "nope"}]
    )
    assert ok is False, "Expected rejection for unknown elementId"
    assert new_doc is None
    assert "unpinElement.elementId unknown" in code


def test_pin_element_supports_link_model_and_blocks_spatial_update():
    doc = _seed_doc()
    ok, doc1, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkModel",
                "id": "link-1",
                "name": "Structure",
                "sourceModelId": "11111111-1111-1111-1111-111111111111",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
                "rotationDeg": 0,
            },
            {"type": "pinElement", "elementId": "link-1"},
        ],
    )
    assert ok is True and doc1 is not None
    assert is_element_pinned(doc1.elements["link-1"]) is True

    ok2, new_doc, _cmds, _viols, code = try_commit_bundle(
        doc1,
        [
            {
                "type": "updateLinkModel",
                "linkId": "link-1",
                "positionMm": {"xMm": 100, "yMm": 0, "zMm": 0},
            }
        ],
    )
    assert ok2 is False
    assert new_doc is None
    assert "pinned_element_blocked" in code


def test_pinned_link_model_still_allows_revision_pin_update():
    doc = _seed_doc()
    ok, doc1, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkModel",
                "id": "link-1",
                "name": "Structure",
                "sourceModelId": "11111111-1111-1111-1111-111111111111",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
                "rotationDeg": 0,
            },
            {"type": "pinElement", "elementId": "link-1"},
        ],
    )
    assert ok is True and doc1 is not None

    ok2, doc2, *_ = try_commit_bundle(
        doc1, [{"type": "updateLinkModel", "linkId": "link-1", "sourceModelRevision": 7}]
    )
    assert ok2 is True and doc2 is not None
    assert doc2.elements["link-1"].source_model_revision == 7


def test_pin_element_supports_link_dxf_underlay():
    doc = _seed_doc()
    ok, doc1, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLinkDxf",
                "id": "dxf-1",
                "name": "Site DXF",
                "levelId": "lvl-1",
                "originMm": {"xMm": 0, "yMm": 0},
                "rotationDeg": 0,
                "scaleFactor": 1,
                "linework": [],
            },
            {"type": "pinElement", "elementId": "dxf-1"},
        ],
    )
    assert ok is True and doc1 is not None
    link = doc1.elements["dxf-1"]
    assert isinstance(link, LinkDxfElem)
    assert is_element_pinned(link) is True
