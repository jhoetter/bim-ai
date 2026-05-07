"""FED-01 — link_model element kind, commands, read-only enforcement, snapshot expansion."""

from __future__ import annotations

from bim_ai.commands import (
    DeleteElementCmd,
    DeleteLinkModelCmd,
    MoveWallEndpointsCmd,
    UpdateElementPropertyCmd,
    UpdateLinkModelCmd,
)
from bim_ai.document import Document
from bim_ai.elements import LevelElem, LinkModelElem, Vec2Mm, Vec3Mm, WallElem
from bim_ai.engine import LINKED_ID_SEPARATOR, apply_inplace, try_commit
from bim_ai.link_expansion import (
    LINKED_FROM_ELEMENT_ID_KEY,
    LINKED_FROM_LINK_ID_KEY,
    LINKED_FROM_MODEL_ID_KEY,
    expand_links,
)


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def test_create_link_model_inserts_row_with_defaults():
    ok, new_doc, _c, _v, code = try_commit(
        _empty_doc(),
        {
            "type": "createLinkModel",
            "id": "link-1",
            "name": "Linked Structure",
            "sourceModelId": "11111111-1111-1111-1111-111111111111",
            "positionMm": {"xMm": 1000, "yMm": 2000, "zMm": 0},
            "rotationDeg": 30.0,
            "originAlignmentMode": "origin_to_origin",
        },
    )
    assert ok, code
    assert new_doc is not None
    link = new_doc.elements["link-1"]
    assert isinstance(link, LinkModelElem)
    assert link.name == "Linked Structure"
    assert link.source_model_id == "11111111-1111-1111-1111-111111111111"
    assert link.position_mm.x_mm == 1000
    assert link.rotation_deg == 30.0
    assert link.origin_alignment_mode == "origin_to_origin"


def test_create_link_model_rejects_empty_source_model_id():
    import pytest

    with pytest.raises(ValueError, match="sourceModelId"):
        try_commit(
            _empty_doc(),
            {
                "type": "createLinkModel",
                "id": "link-1",
                "sourceModelId": "   ",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            },
        )


def test_create_link_model_rejects_self_reference_at_link_id_level():
    import pytest

    with pytest.raises(ValueError, match="cannot reference this link itself"):
        try_commit(
            _empty_doc(),
            {
                "type": "createLinkModel",
                "id": "linkA",
                "sourceModelId": "linkA",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            },
        )


def test_update_link_model_changes_position_and_rotation():
    base = _empty_doc()
    base.elements["link-1"] = LinkModelElem(
        id="link-1",
        name="L",
        sourceModelId="11111111-1111-1111-1111-111111111111",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
    )
    cmd = UpdateLinkModelCmd(
        linkId="link-1",
        positionMm=Vec3Mm(xMm=5000, yMm=0, zMm=0),
        rotationDeg=45.0,
    )
    apply_inplace(base, cmd)
    after = base.elements["link-1"]
    assert isinstance(after, LinkModelElem)
    assert after.position_mm.x_mm == 5000
    assert after.rotation_deg == 45.0


def test_delete_link_model_removes_row():
    base = _empty_doc()
    base.elements["link-1"] = LinkModelElem(
        id="link-1",
        name="L",
        sourceModelId="11111111-1111-1111-1111-111111111111",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
    )
    apply_inplace(base, DeleteLinkModelCmd(linkId="link-1"))
    assert "link-1" not in base.elements


def test_delete_link_model_rejects_non_link_target():
    base = _empty_doc()
    base.elements["lvl1"] = LevelElem(id="lvl1", name="L", elevationMm=0)
    cmd = DeleteLinkModelCmd(linkId="lvl1")
    try:
        apply_inplace(base, cmd)
    except ValueError as exc:
        assert "link_model" in str(exc)
    else:
        raise AssertionError("expected DeleteLinkModelCmd on a level to raise")


def test_linked_element_readonly_blocks_move_wall():
    base = _empty_doc()
    base.elements["lvl1"] = LevelElem(id="lvl1", name="Lv", elevationMm=0)
    linked_wall_id = f"link-1{LINKED_ID_SEPARATOR}wall-source"
    base.elements[linked_wall_id] = WallElem(
        id=linked_wall_id,
        name="Linked wall",
        levelId="lvl1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=1000, yMm=0),
    )
    cmd = MoveWallEndpointsCmd(
        wallId=linked_wall_id, start=Vec2Mm(xMm=0, yMm=0), end=Vec2Mm(xMm=2000, yMm=0)
    )
    try:
        apply_inplace(base, cmd)
    except ValueError as exc:
        assert "linked_element_readonly" in str(exc)
    else:
        raise AssertionError("expected linked_element_readonly to block the move")


def test_linked_element_readonly_blocks_delete_and_property_update():
    linked_id = f"link-1{LINKED_ID_SEPARATOR}some-elem"

    for cmd in (
        DeleteElementCmd(elementId=linked_id),
        UpdateElementPropertyCmd(elementId=linked_id, key="name", value="x"),
    ):
        base = _empty_doc()
        try:
            apply_inplace(base, cmd)
        except ValueError as exc:
            assert "linked_element_readonly" in str(exc)
        else:
            raise AssertionError(f"expected linked_element_readonly to block {type(cmd).__name__}")


def test_expand_links_inlines_source_with_provenance_and_transform():
    """Snapshot expansion: inline source elements with provenance markers and
    apply the link's translation/rotation transform to coordinates."""

    host = _empty_doc()
    host.elements["link-1"] = LinkModelElem(
        id="link-1",
        name="L",
        sourceModelId="src-uuid",
        positionMm=Vec3Mm(xMm=10_000, yMm=0, zMm=0),
        rotationDeg=0,
    )
    src = Document(revision=1, elements={})
    src.elements["lvl1"] = LevelElem(id="lvl1", name="Lv", elevationMm=0)
    src.elements["wall-1"] = WallElem(
        id="wall-1",
        name="W",
        levelId="lvl1",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=1000, yMm=0),
    )

    host_wire = {k: v.model_dump(by_alias=True) for k, v in host.elements.items()}
    expanded = expand_links(host, host_wire, lambda _id, _rev: src)

    # Original host link row is preserved.
    assert "link-1" in expanded
    # Linked elements appear under the prefixed id.
    inlined_id = f"link-1{LINKED_ID_SEPARATOR}wall-1"
    assert inlined_id in expanded
    inlined = expanded[inlined_id]
    assert inlined[LINKED_FROM_LINK_ID_KEY] == "link-1"
    assert inlined[LINKED_FROM_ELEMENT_ID_KEY] == "wall-1"
    assert inlined[LINKED_FROM_MODEL_ID_KEY] == "src-uuid"
    # Translation transformed coordinates of start/end by +10_000 mm in x.
    assert inlined["start"]["xMm"] == 10_000
    assert inlined["end"]["xMm"] == 11_000
    # Cross-element id (levelId) was rewired to its prefixed form.
    assert inlined["levelId"] == f"link-1{LINKED_ID_SEPARATOR}lvl1"


def test_expand_links_respects_hidden_links_and_missing_source():
    host = _empty_doc()
    host.elements["link-hidden"] = LinkModelElem(
        id="link-hidden",
        name="hidden",
        sourceModelId="src-uuid",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
        hidden=True,
    )
    host.elements["link-missing"] = LinkModelElem(
        id="link-missing",
        name="missing",
        sourceModelId="missing-uuid",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
    )
    host_wire = {k: v.model_dump(by_alias=True) for k, v in host.elements.items()}

    def provider(uuid_str: str, _rev: int | None) -> Document | None:
        return None

    expanded = expand_links(host, host_wire, provider)
    # Both link rows are still present, but no inlined elements.
    assert "link-hidden" in expanded
    assert "link-missing" in expanded
    assert all(LINKED_ID_SEPARATOR not in k for k in expanded)


def test_expand_links_skips_recursive_link_rows():
    """Source's own link_model rows are not inlined into the host (single-hop)."""

    host = _empty_doc()
    host.elements["link-1"] = LinkModelElem(
        id="link-1",
        name="L",
        sourceModelId="src-uuid",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
    )
    src = Document(revision=1, elements={})
    src.elements["nested-link"] = LinkModelElem(
        id="nested-link",
        name="nested",
        sourceModelId="other-uuid",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
    )
    src.elements["lvl1"] = LevelElem(id="lvl1", name="Lv", elevationMm=0)
    host_wire = {k: v.model_dump(by_alias=True) for k, v in host.elements.items()}
    expanded = expand_links(host, host_wire, lambda _id, _rev: src)
    # Level inlined, nested-link skipped.
    assert f"link-1{LINKED_ID_SEPARATOR}lvl1" in expanded
    assert f"link-1{LINKED_ID_SEPARATOR}nested-link" not in expanded
