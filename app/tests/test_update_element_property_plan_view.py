"""updateElementProperty for plan_view / viewpoint authoring slices."""

import json

import pytest

from bim_ai.commands import UpdateElementPropertyCmd, UpsertPlanTagStyleCmd, UpsertPlanViewCmd
from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    LevelElem,
    PlanTagStyleElem,
    PlanViewElem,
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


def test_plan_view_subtype_and_area_scheme_property_updates() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "pv": PlanViewElem(kind="plan_view", id="pv", name="Test", levelId="lv"),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planViewSubtype", value="area_plan")
    )
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="areaScheme", value="rentable")
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="pv", key="viewSubdiscipline", value="Coordination"
        ),
    )
    pv_out = doc.elements["pv"]
    assert isinstance(pv_out, PlanViewElem)
    assert pv_out.plan_view_subtype == "area_plan"
    assert pv_out.area_scheme == "rentable"
    assert pv_out.view_subdiscipline == "Coordination"


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
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="viewRangeBottomMm", value="-500")
    )
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="viewRangeTopMm", value="3000"))
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="cutPlaneOffsetMm", value="-1200")
    )
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="discipline", value="structure")
    )
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
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planDetailLevel", value="coarse")
    )
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

    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planRoomFillOpacityScale", value="")
    )
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
    vp_final = doc.elements["vp"]
    assert isinstance(vp_final, ViewpointElem)
    assert vp_final.viewer_clip_cap_elev_mm is None
    assert vp_final.viewer_clip_floor_elev_mm == 0
    assert vp_final.hidden_semantic_kinds_3d == ["roof"]

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vp", key="cutawayStyle", value="box"))
    vp_box = doc.elements["vp"]
    assert isinstance(vp_box, ViewpointElem)
    assert vp_box.cutaway_style == "box"

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vp", key="cutawayStyle", value=""))
    vp_clear_cut = doc.elements["vp"]
    assert isinstance(vp_clear_cut, ViewpointElem)
    assert vp_clear_cut.cutaway_style is None

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vp", key="cutawayStyle", value="none"))
    vp_none_explicit = doc.elements["vp"]
    assert isinstance(vp_none_explicit, ViewpointElem)
    assert vp_none_explicit.cutaway_style == "none"
    assert vp_none_explicit.viewer_clip_floor_elev_mm == 0


def test_viewpoint_plan_overlay_properties() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="Level 1", elevationMm=0),
        "pv": PlanViewElem(kind="plan_view", id="pv", name="Level 1 Plan", levelId="lv"),
        "vp": ViewpointElem(kind="viewpoint", id="vp", name="Overlay", camera=_CAM, mode="orbit_3d"),
    }
    doc = Document(revision=1, elements=els)

    for cmd in (
        UpdateElementPropertyCmd(elementId="vp", key="planOverlayEnabled", value="true"),
        UpdateElementPropertyCmd(elementId="vp", key="planOverlaySourcePlanViewId", value="pv"),
        UpdateElementPropertyCmd(elementId="vp", key="planOverlayOffsetMm", value="4200"),
        UpdateElementPropertyCmd(elementId="vp", key="planOverlayOpacity", value="0.3"),
        UpdateElementPropertyCmd(elementId="vp", key="planOverlayLineOpacity", value="0.9"),
        UpdateElementPropertyCmd(elementId="vp", key="planOverlayFillOpacity", value="0.12"),
        UpdateElementPropertyCmd(
            elementId="vp", key="planOverlayAnnotationsVisible", value="false"
        ),
        UpdateElementPropertyCmd(
            elementId="vp", key="planOverlayWitnessLinesVisible", value="true"
        ),
    ):
        apply_inplace(doc, cmd)

    vp = doc.elements["vp"]
    assert isinstance(vp, ViewpointElem)
    assert vp.plan_overlay_enabled is True
    assert vp.plan_overlay_source_plan_view_id == "pv"
    assert vp.plan_overlay_offset_mm == 4200
    assert vp.plan_overlay_opacity == 0.3
    assert vp.plan_overlay_line_opacity == 0.9
    assert vp.plan_overlay_fill_opacity == 0.12
    assert vp.plan_overlay_annotations_visible is False
    assert vp.plan_overlay_witness_lines_visible is True

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="vp", key="planOverlayOffsetMm", value=""))
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="vp", key="planOverlaySourcePlanViewId", value="")
    )
    vp_clear = doc.elements["vp"]
    assert isinstance(vp_clear, ViewpointElem)
    assert vp_clear.plan_overlay_offset_mm is None
    assert vp_clear.plan_overlay_source_plan_view_id is None

    with pytest.raises(ValueError, match="planOverlaySourcePlanViewId"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(
                elementId="vp", key="planOverlaySourcePlanViewId", value="missing"
            ),
        )


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

    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planShowOpeningTags", value="false")
    )
    pv1 = doc.elements["pv"]
    assert isinstance(pv1, PlanViewElem)
    assert pv1.plan_show_opening_tags is False

    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planShowOpeningTags", value="")
    )
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.plan_show_opening_tags is None

    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="vt", key="planShowOpeningTags", value="false")
    )
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="vt", key="planShowRoomLabels", value="false")
    )
    vt2 = doc.elements["vt"]
    assert isinstance(vt2, ViewTemplateElem)
    assert vt2.plan_show_opening_tags is False
    assert vt2.plan_show_room_labels is False


def test_view_template_plan_detail_level_and_room_fill_via_update_element_property() -> None:
    vt = ViewTemplateElem(
        kind="view_template",
        id="vt",
        name="T",
        plan_detail_level="medium",
        plan_room_fill_opacity_scale=1.0,
    )
    doc = Document(revision=1, elements={"vt": vt})
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="vt", key="planDetailLevel", value="fine")
    )
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
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="vt", key="planRoomFillOpacityScale", value="")
    )
    vt3 = doc.elements["vt"]
    assert isinstance(vt3, ViewTemplateElem)
    assert vt3.plan_detail_level is None
    assert vt3.plan_room_fill_opacity_scale == 1.0


def test_plan_view_plan_tag_style_assign_clear_and_wrong_target() -> None:
    ostyle = PlanTagStyleElem(
        kind="plan_tag_style",
        id="pts-o",
        name="O",
        tagTarget="opening",
        labelFields=[],
    )
    rstyle = PlanTagStyleElem(
        kind="plan_tag_style",
        id="pts-r",
        name="R",
        tagTarget="room",
        labelFields=[],
    )
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "pts-o": ostyle,
        "pts-r": rstyle,
        "pv": PlanViewElem(
            kind="plan_view",
            id="pv",
            name="Test",
            levelId="lv",
        ),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planOpeningTagStyleId", value="pts-o")
    )
    pv = doc.elements["pv"]
    assert isinstance(pv, PlanViewElem)
    assert pv.plan_opening_tag_style_id == "pts-o"

    apply_inplace(
        doc, UpdateElementPropertyCmd(elementId="pv", key="planOpeningTagStyleId", value="")
    )
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.plan_opening_tag_style_id is None

    with pytest.raises(
        ValueError,
        match="plan tag style targets 'room' but this slot expects 'opening'",
    ):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(elementId="pv", key="planOpeningTagStyleId", value="pts-r"),
        )


def test_upsert_plan_view_preserves_tag_styles_when_omitted_from_payload() -> None:
    ostyle = PlanTagStyleElem(
        kind="plan_tag_style",
        id="pts-o2",
        name="O2",
        tagTarget="opening",
        labelFields=[],
    )
    rstyle = PlanTagStyleElem(
        kind="plan_tag_style",
        id="pts-r2",
        name="R2",
        tagTarget="room",
        labelFields=[],
    )
    lv = LevelElem(kind="level", id="lv", name="EG", elevationMm=0)
    doc = Document(
        revision=1,
        elements={
            "lv": lv,
            "pts-o2": ostyle,
            "pts-r2": rstyle,
        },
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id="pv-x",
            name="P",
            levelId="lv",
            planOpeningTagStyleId="pts-o2",
            planRoomTagStyleId="pts-r2",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd.model_validate(
            {
                "type": "upsertPlanView",
                "id": "pv-x",
                "name": "P2",
                "levelId": "lv",
            }
        ),
    )
    pv = doc.elements["pv-x"]
    assert isinstance(pv, PlanViewElem)
    assert pv.plan_opening_tag_style_id == "pts-o2"
    assert pv.plan_room_tag_style_id == "pts-r2"


def test_upsert_plan_tag_style_cmd_replay() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(
        doc,
        UpsertPlanTagStyleCmd(
            id="cat1",
            name="Catalog 1",
            tagTarget="opening",
            labelFields=["elementId", "name"],
            textSizePt=11,
            leaderVisible=False,
            badgeStyle="rounded",
            colorToken="dim",
            sortKey=3,
        ),
    )
    st = doc.elements["cat1"]
    assert isinstance(st, PlanTagStyleElem)
    assert st.label_fields == ["elementId", "name"]
    assert st.text_size_pt == 11
    assert st.leader_visible is False
    assert st.badge_style == "rounded"


def test_plan_view_plan_category_graphics_json_roundtrip() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "pv": PlanViewElem(kind="plan_view", id="pv", name="Test", levelId="lv"),
    }
    doc = Document(revision=1, elements=els)
    payload = json.dumps(
        [{"categoryKey": "wall", "lineWeightFactor": 1.1, "linePatternToken": "dash_long"}]
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="pv", key="planCategoryGraphics", value=payload),
    )
    pv = doc.elements["pv"]
    assert isinstance(pv, PlanViewElem)
    assert len(pv.plan_category_graphics) == 1
    assert pv.plan_category_graphics[0].category_key == "wall"
    assert pv.plan_category_graphics[0].line_weight_factor == pytest.approx(1.1)
    assert pv.plan_category_graphics[0].line_pattern_token == "dash_long"

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="pv", key="planCategoryGraphics", value=""),
    )
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.plan_category_graphics == []


def test_view_template_plan_category_graphics_json() -> None:
    els = {
        "vt": ViewTemplateElem(kind="view_template", id="vt", name="T"),
    }
    doc = Document(revision=1, elements=els)
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="vt",
            key="planCategoryGraphics",
            value=json.dumps([{"categoryKey": "grid_line", "linePatternToken": "dot"}]),
        ),
    )
    vt = doc.elements["vt"]
    assert isinstance(vt, ViewTemplateElem)
    assert len(vt.plan_category_graphics) == 1
    assert vt.plan_category_graphics[0].category_key == "grid_line"
    assert vt.plan_category_graphics[0].line_pattern_token == "dot"


def test_plan_view_crop_enabled_and_region_visible_setters() -> None:
    """PLN-02 — engine setters for cropEnabled / cropRegionVisible flags."""
    els = {
        "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        "pv": PlanViewElem(kind="plan_view", id="pv", name="Test", levelId="lv"),
    }
    doc = Document(revision=1, elements=els)

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="cropEnabled", value="true"))
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="pv", key="cropRegionVisible", value="false"),
    )
    pv = doc.elements["pv"]
    assert isinstance(pv, PlanViewElem)
    assert pv.crop_enabled is True
    assert pv.crop_region_visible is False

    # Empty value clears back to inherit (None).
    apply_inplace(doc, UpdateElementPropertyCmd(elementId="pv", key="cropEnabled", value=""))
    pv2 = doc.elements["pv"]
    assert isinstance(pv2, PlanViewElem)
    assert pv2.crop_enabled is None
