"""KRN-09 — engine command for curtain-wall panel overrides."""

from __future__ import annotations

import pytest

from bim_ai.commands import SetCurtainPanelOverrideCmd
from bim_ai.document import Document
from bim_ai.elements import (
    CurtainPanelOverride,
    LevelElem,
    Vec2Mm,
    WallElem,
    curtain_grid_cell_id,
    parse_curtain_grid_cell_id,
)
from bim_ai.engine import apply_inplace


def _doc_with_curtain_wall(*, is_curtain: bool = True) -> Document:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "cw": WallElem(
            kind="wall",
            id="cw",
            name="Curtain wall",
            levelId="lv",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=6000, yMm=0),
            thicknessMm=80,
            heightMm=3000,
            isCurtainWall=is_curtain,
        ),
    }
    return Document(revision=1, elements=els)


def test_set_empty_override_records_in_panel_map() -> None:
    doc = _doc_with_curtain_wall()
    cmd = SetCurtainPanelOverrideCmd(
        wallId="cw",
        gridCellId="v0h0",
        override=CurtainPanelOverride(kind="empty"),
    )
    apply_inplace(doc, cmd)
    wall = doc.elements["cw"]
    assert isinstance(wall, WallElem)
    assert wall.curtain_panel_overrides is not None
    assert "v0h0" in wall.curtain_panel_overrides
    assert wall.curtain_panel_overrides["v0h0"].kind == "empty"


def test_set_system_override_carries_material_key() -> None:
    doc = _doc_with_curtain_wall()
    apply_inplace(
        doc,
        SetCurtainPanelOverrideCmd(
            wallId="cw",
            gridCellId="v1h0",
            override=CurtainPanelOverride(kind="system", materialKey="cladding_warm_wood"),
        ),
    )
    wall = doc.elements["cw"]
    assert isinstance(wall, WallElem)
    o = wall.curtain_panel_overrides["v1h0"]
    assert o.kind == "system"
    assert o.material_key == "cladding_warm_wood"


def test_set_family_instance_override_carries_family_type_id() -> None:
    doc = _doc_with_curtain_wall()
    apply_inplace(
        doc,
        SetCurtainPanelOverrideCmd(
            wallId="cw",
            gridCellId="v2h1",
            override=CurtainPanelOverride(kind="family_instance", familyTypeId="ft-slat-screen"),
        ),
    )
    wall = doc.elements["cw"]
    assert isinstance(wall, WallElem)
    o = wall.curtain_panel_overrides["v2h1"]
    assert o.kind == "family_instance"
    assert o.family_type_id == "ft-slat-screen"


def test_clearing_override_with_none_removes_the_cell() -> None:
    doc = _doc_with_curtain_wall()
    apply_inplace(
        doc,
        SetCurtainPanelOverrideCmd(
            wallId="cw",
            gridCellId="v0h0",
            override=CurtainPanelOverride(kind="empty"),
        ),
    )
    apply_inplace(
        doc,
        SetCurtainPanelOverrideCmd(wallId="cw", gridCellId="v0h0", override=None),
    )
    wall = doc.elements["cw"]
    assert isinstance(wall, WallElem)
    # Empty dict normalises to None so authors don't see ghost map entries.
    assert wall.curtain_panel_overrides is None


def test_overrides_replay_idempotent_for_same_cell() -> None:
    doc = _doc_with_curtain_wall()
    apply_inplace(
        doc,
        SetCurtainPanelOverrideCmd(
            wallId="cw",
            gridCellId="v0h0",
            override=CurtainPanelOverride(kind="empty"),
        ),
    )
    apply_inplace(
        doc,
        SetCurtainPanelOverrideCmd(
            wallId="cw",
            gridCellId="v0h0",
            override=CurtainPanelOverride(kind="system", materialKey="brick_red"),
        ),
    )
    wall = doc.elements["cw"]
    assert isinstance(wall, WallElem)
    o = wall.curtain_panel_overrides["v0h0"]
    assert o.kind == "system"
    assert o.material_key == "brick_red"


def test_set_override_rejects_non_curtain_wall() -> None:
    doc = _doc_with_curtain_wall(is_curtain=False)
    with pytest.raises(ValueError, match="curtain wall"):
        apply_inplace(
            doc,
            SetCurtainPanelOverrideCmd(
                wallId="cw",
                gridCellId="v0h0",
                override=CurtainPanelOverride(kind="empty"),
            ),
        )


def test_set_override_rejects_unknown_wall_id() -> None:
    doc = _doc_with_curtain_wall()
    with pytest.raises(ValueError, match="must reference a Wall"):
        apply_inplace(
            doc,
            SetCurtainPanelOverrideCmd(
                wallId="ghost",
                gridCellId="v0h0",
                override=CurtainPanelOverride(kind="empty"),
            ),
        )


def test_set_override_rejects_malformed_cell_id() -> None:
    doc = _doc_with_curtain_wall()
    with pytest.raises(ValueError, match="cell id"):
        apply_inplace(
            doc,
            SetCurtainPanelOverrideCmd(
                wallId="cw",
                gridCellId="bogus_id",
                override=CurtainPanelOverride(kind="empty"),
            ),
        )


def test_curtain_grid_cell_id_helpers_round_trip() -> None:
    assert curtain_grid_cell_id(0, 0) == "v0h0"
    assert curtain_grid_cell_id(3, 1) == "v3h1"
    assert parse_curtain_grid_cell_id("v3h1") == (3, 1)
    assert parse_curtain_grid_cell_id("v12h0") == (12, 0)
    with pytest.raises(ValueError):
        parse_curtain_grid_cell_id("bogus")
    with pytest.raises(ValueError):
        parse_curtain_grid_cell_id("v3")
