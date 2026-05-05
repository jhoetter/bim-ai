"""updateElementProperty for plan_view / viewpoint authoring slices."""

import json

import pytest

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    LevelElem,
    PlanViewElem,
    TagDefinitionElem,
    Vec3Mm,
    ViewpointElem,
    ViewTemplateElem,
)
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


def test_plan_view_crop_range_discipline_phase() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "pv": PlanViewElem(
            kind="plan_view",
            id="pv",
            name="Test",
            levelId="lv",
        ),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="pv",
            key="cropMinMm",
            value=json.dumps({"xMm": 0, "yMm": 0}),
        ),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="pv",
            key="cropMaxMm",
            value=json.dumps({"xMm": 5000, "yMm": 4000}),
        ),
    )
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="viewRangeBottomMm", value="-500"))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="viewRangeTopMm", value="3000"))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="cutPlaneOffsetMm", value="-1200"))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="discipline", value="structure"))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="phaseId", value="ph-1"))
    pv = doc.elements["pv"]
    assert isinstance(pv, PlanViewElem)
    assert pv.crop_min_mm is not None and pv.crop_min_mm.x_mm == 0 and pv.crop_min_mm.y_mm == 0
    assert pv.crop_max_mm is not None and pv.crop_max_mm.x_mm == 5000
    assert pv.view_range_bottom_mm == -500
    assert pv.view_range_top_mm == 3000
    assert pv.cut_plane_offset_mm == -1200
    assert pv.discipline == "structure"
    assert pv.phase_id == "ph-1"

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="cropMinMm", value=""))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="phaseId", value=""))
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.crop_min_mm is None
    assert pv2.phase_id is None



def test_plan_view_plan_detail_level_and_room_fill_scale() -> None:
    vt = ViewTemplateElem(
        kind="view_template",
        id="vt",
        name="T",
        plan_detail_level="fine",
        plan_room_fill_opacity_scale=0.5,
    )
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "vt": vt,
        "pv": PlanViewElem(
            kind="plan_view",
            id="pv",
            name="Test",
            levelId="lv",
            viewTemplateId="vt",
        ),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="planDetailLevel", value="coarse"))
    pv = doc.elements["pv"]
    assert isinstance(pv, PlanViewElem)
    assert pv.plan_detail_level == "coarse"

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="planDetailLevel", value=""))
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.plan_detail_level is None

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="pv", key="planRoomFillOpacityScale", value="0.25"),
    )
    pv3 = doc.elements["pv"]
    assert isinstance(pv3, PlanViewElem)
    assert pv3.plan_room_fill_opacity_scale == 0.25

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="planRoomFillOpacityScale", value=""))
    pv4 = doc.elements["pv"]
    assert isinstance(pv4, PlanViewElem)
    assert pv4.plan_room_fill_opacity_scale is None


def test_plan_view_crop_json_invalid_raises() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="Test", levelId="lv"),
        },
    )
    with pytest.raises(ValueError, match="cropMaxMm"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="pv", key="cropMaxMm", value="not-json"),
        )


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


def test_plan_view_plan_annotation_flags_and_template_inheritance() -> None:
    vt = ViewTemplateElem(
        kind="view_template",
        id="vt",
        name="T",
        planShowOpeningTags=True,
        planShowRoomLabels=True,
    )
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "vt": vt,
        "pv": PlanViewElem(
            kind="plan_view",
            id="pv",
            name="Test",
            levelId="lv",
            viewTemplateId="vt",
        ),
    }
    doc = Document(revision=1, elements=els)
    pv0 = doc.elements["pv"]
    assert isinstance(pv0, PlanViewElem)
    assert pv0.plan_show_opening_tags is None

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="planShowOpeningTags", value="false"))
    pv1 = doc.elements["pv"]
    assert isinstance(pv1, PlanViewElem)
    assert pv1.plan_show_opening_tags is False

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="planShowOpeningTags", value=""))
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.plan_show_opening_tags is None

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vt", key="planShowOpeningTags", value="false"))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vt", key="planShowRoomLabels", value="false"))
    vt2 = doc.elements["vt"]
    assert isinstance(vt2, ViewTemplateElem)
    assert vt2.plan_show_opening_tags is False
    assert vt2.plan_show_room_labels is False


def test_plan_view_template_tag_definition_refs_and_style_update() -> None:
    room_tag = TagDefinitionElem(
        kind="tag_definition",
        id="tag-room",
        name="Room bubble",
        tagKind="room",
    )
    opening_tag = TagDefinitionElem(
        kind="tag_definition",
        id="tag-opening",
        name="Door mark",
        tagKind="sill",
    )
    vt = ViewTemplateElem(kind="view_template", id="vt", name="T")
    pv = PlanViewElem(kind="plan_view", id="pv", name="Test", levelId="lv", viewTemplateId="vt")
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
            "tag-room": room_tag,
            "tag-opening": opening_tag,
            "vt": vt,
            "pv": pv,
        },
    )

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="tag-room",
            key="planTagStyle",
            value='{"labelPrefix":"R-","textCase":"upper","maxLabelChars":24,"showBox":true}',
        ),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="vt", key="planRoomTagDefinitionId", value="tag-room"),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="pv",
            key="planOpeningTagDefinitionId",
            value="tag-opening",
        ),
    )

    tag_out = doc.elements["tag-room"]
    vt_out = doc.elements["vt"]
    pv_out = doc.elements["pv"]
    assert isinstance(tag_out, TagDefinitionElem)
    assert isinstance(vt_out, ViewTemplateElem)
    assert isinstance(pv_out, PlanViewElem)
    assert tag_out.plan_tag_style.label_prefix == "R-"
    assert tag_out.plan_tag_style.text_case == "upper"
    assert tag_out.plan_tag_style.show_box is True
    assert vt_out.plan_room_tag_definition_id == "tag-room"
    assert pv_out.plan_opening_tag_definition_id == "tag-opening"


def test_view_template_plan_detail_level_and_room_fill_via_update_element_property() -> None:
    vt = ViewTemplateElem(
        kind="view_template",
        id="vt",
        name="T",
        plan_detail_level="medium",
        plan_room_fill_opacity_scale=1.0,
    )
    doc = Document(revision=1, elements={"vt": vt})
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vt", key="planDetailLevel", value="fine"))
    vt1 = doc.elements["vt"]
    assert isinstance(vt1, ViewTemplateElem)
    assert vt1.plan_detail_level == "fine"

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="vt", key="planRoomFillOpacityScale", value="0.35"),
    )
    vt2 = doc.elements["vt"]
    assert isinstance(vt2, ViewTemplateElem)
    assert vt2.plan_room_fill_opacity_scale == 0.35

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vt", key="planDetailLevel", value=""))
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vt", key="planRoomFillOpacityScale", value=""))
    vt3 = doc.elements["vt"]
    assert isinstance(vt3, ViewTemplateElem)
    assert vt3.plan_detail_level is None
    assert vt3.plan_room_fill_opacity_scale == 1.0
