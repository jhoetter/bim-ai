from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, Vec2Mm, WallElem, WallOpeningElem, WindowElem
from bim_ai.engine import try_commit, try_commit_bundle


def _doc_with_hosted_wall_children() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(id="lvl-1", name="Level 1", elevationMm=0),
            "wall-1": WallElem(
                id="wall-1",
                name="Host wall",
                levelId="lvl-1",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=5000, yMm=0),
                heightMm=3000,
            ),
            "door-1": DoorElem(id="door-1", wallId="wall-1", alongT=0.25, widthMm=900),
            "win-1": WindowElem(
                id="win-1",
                wallId="wall-1",
                alongT=0.65,
                widthMm=1200,
                sillHeightMm=900,
                heightMm=1200,
            ),
            "opening-1": WallOpeningElem(
                id="opening-1",
                hostWallId="wall-1",
                alongTStart=0.78,
                alongTEnd=0.9,
                sillHeightMm=0,
                headHeightMm=2100,
            ),
        },
    )


def test_delete_wall_cascades_to_wall_hosted_children() -> None:
    ok, new_doc, _cmd, violations, code = try_commit(
        _doc_with_hosted_wall_children(),
        {"type": "deleteElement", "elementId": "wall-1"},
    )

    assert ok, (code, violations)
    assert new_doc is not None
    assert "wall-1" not in new_doc.elements
    assert "door-1" not in new_doc.elements
    assert "win-1" not in new_doc.elements
    assert "opening-1" not in new_doc.elements
    assert "lvl-1" in new_doc.elements


def test_delete_elements_wall_cascade_preserves_unrelated_hosts() -> None:
    doc = _doc_with_hosted_wall_children()
    doc.elements["wall-2"] = WallElem(
        id="wall-2",
        name="Other wall",
        levelId="lvl-1",
        start=Vec2Mm(xMm=0, yMm=1000),
        end=Vec2Mm(xMm=5000, yMm=1000),
        heightMm=3000,
    )
    doc.elements["door-2"] = DoorElem(id="door-2", wallId="wall-2", alongT=0.5, widthMm=900)

    ok, new_doc, _cmds, violations, code = try_commit_bundle(
        doc,
        [{"type": "deleteElements", "elementIds": ["wall-1"]}],
    )

    assert ok, (code, violations)
    assert new_doc is not None
    assert "wall-1" not in new_doc.elements
    assert "door-1" not in new_doc.elements
    assert "win-1" not in new_doc.elements
    assert "opening-1" not in new_doc.elements
    assert "wall-2" in new_doc.elements
    assert "door-2" in new_doc.elements
