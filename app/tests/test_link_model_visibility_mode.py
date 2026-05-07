"""FED-01 polish — link_model.visibilityMode (host_view | linked_view)."""

from __future__ import annotations

import pytest

from bim_ai.commands import UpdateLinkModelCmd
from bim_ai.document import Document
from bim_ai.elements import LevelElem, LinkModelElem, Vec2Mm, Vec3Mm, WallElem
from bim_ai.engine import apply_inplace, try_commit
from bim_ai.link_expansion import LINKED_VISIBILITY_MODE_KEY, expand_links


def _empty_doc() -> Document:
    return Document(revision=1, elements={})


def test_create_link_model_defaults_visibility_to_host_view():
    ok, new_doc, _c, _v, code = try_commit(
        _empty_doc(),
        {
            "type": "createLinkModel",
            "id": "link-1",
            "sourceModelId": "11111111-1111-1111-1111-111111111111",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
        },
    )
    assert ok, code
    assert new_doc is not None
    link = new_doc.elements["link-1"]
    assert isinstance(link, LinkModelElem)
    assert link.visibility_mode == "host_view"


def test_create_link_model_accepts_linked_view():
    ok, new_doc, _c, _v, code = try_commit(
        _empty_doc(),
        {
            "type": "createLinkModel",
            "id": "link-1",
            "sourceModelId": "22222222-2222-2222-2222-222222222222",
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "visibilityMode": "linked_view",
        },
    )
    assert ok, code
    assert new_doc is not None
    link = new_doc.elements["link-1"]
    assert isinstance(link, LinkModelElem)
    assert link.visibility_mode == "linked_view"


def test_update_link_model_can_flip_visibility_mode():
    base = _empty_doc()
    base.elements["link-1"] = LinkModelElem(
        id="link-1",
        sourceModelId="22222222-2222-2222-2222-222222222222",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
    )
    apply_inplace(
        base,
        UpdateLinkModelCmd(linkId="link-1", visibilityMode="linked_view"),
    )
    after = base.elements["link-1"]
    assert isinstance(after, LinkModelElem)
    assert after.visibility_mode == "linked_view"
    apply_inplace(
        base,
        UpdateLinkModelCmd(linkId="link-1", visibilityMode="host_view"),
    )
    again = base.elements["link-1"]
    assert isinstance(again, LinkModelElem)
    assert again.visibility_mode == "host_view"


def test_create_link_model_rejects_unknown_visibility_mode():
    with pytest.raises(Exception):
        try_commit(
            _empty_doc(),
            {
                "type": "createLinkModel",
                "id": "link-1",
                "sourceModelId": "22222222-2222-2222-2222-222222222222",
                "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
                "visibilityMode": "phantom_view",
            },
        )


def test_expand_links_propagates_visibility_mode_to_inlined_elements():
    """Each linked element carries the link's visibility mode under
    `_linkedVisibilityMode` so the renderer / VV can group them."""

    host = _empty_doc()
    host.elements["link-1"] = LinkModelElem(
        id="link-1",
        sourceModelId="src-uuid",
        positionMm=Vec3Mm(xMm=0, yMm=0, zMm=0),
        visibilityMode="linked_view",
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
    inlined = expanded["link-1::wall-1"]
    assert inlined[LINKED_VISIBILITY_MODE_KEY] == "linked_view"
    inlined_lvl = expanded["link-1::lvl1"]
    assert inlined_lvl[LINKED_VISIBILITY_MODE_KEY] == "linked_view"
