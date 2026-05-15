"""Door/window type + material authoring via updateElementProperty."""

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, RailingElem, StairElem, Vec2Mm, WallElem, WindowElem
from bim_ai.engine import apply_inplace


def test_door_family_type_and_material_updates() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
        "w1": WallElem(
            kind="wall",
            id="w1",
            name="W",
            level_id="lv",
            start=Vec2Mm(x_mm=0, y_mm=0),
            end=Vec2Mm(x_mm=4000, y_mm=0),
            thickness_mm=200,
            height_mm=2800,
        ),
        "d1": DoorElem(
            kind="door",
            id="d1",
            name="D1",
            wall_id="w1",
            along_t=0.5,
            width_mm=900,
            family_type_id="ft-door-a",
            material_key=None,
        ),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="d1", key="familyTypeId", value="ft-door-upgraded"),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="d1", key="materialKey", value="aluminium_clear"),
    )
    d = doc.elements["d1"]
    assert isinstance(d, DoorElem)
    assert d.family_type_id == "ft-door-upgraded"
    assert d.material_key == "aluminium_clear"


def test_window_material_update() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
        "w1": WallElem(
            kind="wall",
            id="w1",
            name="W",
            level_id="lv",
            start=Vec2Mm(x_mm=0, y_mm=0),
            end=Vec2Mm(x_mm=4000, y_mm=0),
            thickness_mm=200,
            height_mm=2800,
        ),
        "z1": WindowElem(
            kind="window",
            id="z1",
            name="Z1",
            wall_id="w1",
            along_t=0.3,
            width_mm=1200,
            sill_height_mm=900,
            height_mm=1400,
        ),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="z1", key="materialKey", value="triple_glazed"),
    )
    z = doc.elements["z1"]
    assert isinstance(z, WindowElem)
    assert z.material_key == "triple_glazed"


def test_door_window_material_slot_updates() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                level_id="lv",
                start=Vec2Mm(x_mm=0, y_mm=0),
                end=Vec2Mm(x_mm=4000, y_mm=0),
                thickness_mm=200,
                height_mm=2800,
            ),
            "d1": DoorElem(kind="door", id="d1", name="D", wall_id="w1", along_t=0.5, width_mm=900),
            "z1": WindowElem(
                kind="window",
                id="z1",
                name="Z",
                wall_id="w1",
                along_t=0.3,
                width_mm=1200,
                sill_height_mm=900,
                height_mm=1400,
            ),
        },
    )

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="d1",
            key="materialSlots",
            value={"frame": "aluminium_black", "panel": "cladding_warm_wood"},
        ),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="z1",
            key="materialSlots",
            value={"frame": "aluminium_natural", "glass": "asset_clear_glass_double"},
        ),
    )

    d = doc.elements["d1"]
    z = doc.elements["z1"]
    assert isinstance(d, DoorElem)
    assert isinstance(z, WindowElem)
    assert d.material_slots == {"frame": "aluminium_black", "panel": "cladding_warm_wood"}
    assert z.material_slots == {"frame": "aluminium_natural", "glass": "asset_clear_glass_double"}


def test_stair_railing_material_slot_updates() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv0": LevelElem(kind="level", id="lv0", name="L0", elevation_mm=0),
            "lv1": LevelElem(kind="level", id="lv1", name="L1", elevation_mm=2800),
            "st1": StairElem(
                kind="stair",
                id="st1",
                name="Stair",
                base_level_id="lv0",
                top_level_id="lv1",
                run_start=Vec2Mm(x_mm=0, y_mm=0),
                run_end=Vec2Mm(x_mm=4000, y_mm=0),
                width_mm=1000,
                riser_mm=175,
                tread_mm=280,
            ),
            "rail1": RailingElem(
                kind="railing",
                id="rail1",
                name="Rail",
                path_mm=[Vec2Mm(x_mm=0, y_mm=0), Vec2Mm(x_mm=3000, y_mm=0)],
            ),
        },
    )

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="st1",
            key="materialSlots",
            value={"tread": "timber_cladding", "stringer": "aluminium_black"},
        ),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="rail1",
            key="materialSlots",
            value={"topRail": "aluminium_black", "panel": "asset_clear_glass_double"},
        ),
    )

    stair = doc.elements["st1"]
    rail = doc.elements["rail1"]
    assert isinstance(stair, StairElem)
    assert isinstance(rail, RailingElem)
    assert stair.material_slots == {"tread": "timber_cladding", "stringer": "aluminium_black"}
    assert rail.material_slots == {"topRail": "aluminium_black", "panel": "asset_clear_glass_double"}


def test_wall_face_material_overrides_update() -> None:
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        level_id="lv",
        start=Vec2Mm(x_mm=0, y_mm=0),
        end=Vec2Mm(x_mm=4000, y_mm=0),
        thickness_mm=200,
        height_mm=2800,
        material_key="masonry_block",
    )
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
            "w1": wall,
        },
    )

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="w1",
            key="faceMaterialOverrides",
            value=[{"faceKind": "exterior", "materialKey": "masonry_brick", "source": "paint"}],
        ),
    )
    updated = doc.elements["w1"]
    assert isinstance(updated, WallElem)
    assert updated.material_key == "masonry_block"
    assert updated.face_material_overrides is not None
    assert updated.face_material_overrides[0].face_kind == "exterior"
    assert updated.face_material_overrides[0].material_key == "masonry_brick"

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="w1",
            key="faceMaterialOverrides",
            value=[
                {
                    "faceKind": "exterior",
                    "materialKey": "masonry_brick",
                    "source": "paint",
                    "uvRotationDeg": 90,
                    "uvOffsetMm": {"uMm": 50, "vMm": 0},
                    "uvScaleMm": {"uMm": 800, "vMm": 800},
                }
            ],
        ),
    )
    aligned = doc.elements["w1"]
    assert isinstance(aligned, WallElem)
    assert aligned.face_material_overrides is not None
    assert aligned.face_material_overrides[0].uv_rotation_deg == 90
    assert aligned.face_material_overrides[0].uv_offset_mm == {"uMm": 50, "vMm": 0}
    assert aligned.face_material_overrides[0].uv_scale_mm == {"uMm": 800, "vMm": 800}

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="w1", key="faceMaterialOverrides", value=""),
    )
    cleared = doc.elements["w1"]
    assert isinstance(cleared, WallElem)
    assert cleared.face_material_overrides is None
