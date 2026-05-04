"""updateElementProperty for plan_view / viewpoint authoring slices."""

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import CameraMm, LevelElem, PlanViewElem, Vec3Mm, ViewpointElem
from bim_ai.engine import apply_inplace

_CAM = CameraMm(
    position=Vec3Mm(xMm=0, yMm=0, zMm=1400),
    target=Vec3Mm(xMm=1, yMm=0, zMm=1400),
    up=Vec3Mm(xMm=0, yMm=0, zMm=1000),
)


def test_plan_view_plan_presentation_categories_hidden_underlay() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "lv2": LevelElem(kind="level", id="lv2", name="OG", elevationMm=2800),
        "pv": PlanViewElem(
            kind="plan_view",
            id="pv",
            name="Test",
            levelId="lv",
            categoriesHidden=["room"],
        ),
    }
    doc = Document(revision=1, elements=els)
    for cmd in (
        UpdateElementPropertyCmd(elementId="pv", key="planPresentation", value="room_scheme"),
        UpdateElementPropertyCmd(elementId="pv", key="categoriesHidden", value='["room","door"]'),
        UpdateElementPropertyCmd(elementId="pv", key="underlayLevelId", value="lv2"),
        UpdateElementPropertyCmd(elementId="pv", key="planPresentation", value="opening_focus"),
    ):
        apply_inplace(doc, cmd)
    pv_out = doc.elements["pv"]
    assert isinstance(pv_out, PlanViewElem)
    assert pv_out.plan_presentation == "opening_focus"
    assert set(pv_out.categories_hidden) == {"room", "door"}
    assert pv_out.underlay_level_id == "lv2"


def test_viewpoint_clip_and_hidden_categories() -> None:
    els = {
        "vp": ViewpointElem(
            kind="viewpoint",
            id="vp",
            name="Orb",
            camera=_CAM,
            mode="orbit_3d",
        ),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="vp", key="viewerClipCapElevMm", value="5600"),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="vp", key="viewerClipFloorElevMm", value="0"),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="vp", key="hiddenSemanticKinds3d", value='["roof"]'),
    )
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="vp", key="viewerClipCapElevMm", value="")
    )
    vp = doc.elements["vp"]
    assert isinstance(vp, ViewpointElem)
    assert vp.viewer_clip_cap_elev_mm is None
    assert vp.viewer_clip_floor_elev_mm == 0
    assert vp.hidden_semantic_kinds_3d == ["roof"]
