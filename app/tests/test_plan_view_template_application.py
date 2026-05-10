"""WP-C01/C05 plan view template registry, apply, crop and range editing."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    ApplyPlanViewTemplateCmd,
    ApplyViewTemplateCmd,
    CreateViewTemplateCmd,
    UpdatePlanViewCropCmd,
    UpdatePlanViewRangeCmd,
    UpdateViewTemplateCmd,
    UpsertPlanViewCmd,
    UpsertPlanViewTemplateCmd,
)
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    PlanCategoryGraphicRow,
    PlanViewElem,
    Vec2Mm,
    ViewTemplateElem,
)
from bim_ai.engine import apply_inplace
from bim_ai.plan_projection_wire import (
    planViewTemplateApplicationEvidence_v1,
    resolve_plan_projection_wire,
)


def _base_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
            "lv2": LevelElem(kind="level", id="lv2", name="OG", elevationMm=3000),
        },
    )


def _add_plan_view(doc: Document, pv_id: str = "pv") -> None:
    apply_inplace(
        doc,
        UpsertPlanViewCmd(
            id=pv_id,
            name="Test Plan",
            levelId="lv",
            planPresentation="default",
        ),
    )


def _add_template(doc: Document, tmpl_id: str = "tmpl") -> None:
    apply_inplace(
        doc,
        UpsertPlanViewTemplateCmd(
            id=tmpl_id,
            name="Floor plan template",
            viewRangeBottomMm=-500.0,
            viewRangeTopMm=2800.0,
            hiddenCategories=["stair"],
            planShowOpeningTags=True,
        ),
    )


class TestUpsertPlanViewTemplate:
    def test_creates_view_template_elem(self) -> None:
        doc = _base_doc()
        apply_inplace(
            doc,
            UpsertPlanViewTemplateCmd(
                id="tmpl1",
                name="My template",
                viewRangeBottomMm=-400.0,
                viewRangeTopMm=2600.0,
            ),
        )
        tmpl = doc.elements.get("tmpl1")
        assert isinstance(tmpl, ViewTemplateElem)
        assert tmpl.name == "My template"
        assert tmpl.view_range_bottom_mm == -400.0
        assert tmpl.view_range_top_mm == 2600.0

    def test_view_range_persisted_on_upsert(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        tmpl = doc.elements["tmpl"]
        assert isinstance(tmpl, ViewTemplateElem)
        assert tmpl.view_range_bottom_mm == -500.0
        assert tmpl.view_range_top_mm == 2800.0

    def test_upsert_preserves_view_range_when_omitted(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        apply_inplace(
            doc,
            UpsertPlanViewTemplateCmd(id="tmpl", name="Renamed template"),
        )
        tmpl = doc.elements["tmpl"]
        assert isinstance(tmpl, ViewTemplateElem)
        assert tmpl.name == "Renamed template"
        assert tmpl.view_range_bottom_mm == -500.0
        assert tmpl.view_range_top_mm == 2800.0

    def test_category_graphics_stored(self) -> None:
        doc = _base_doc()
        apply_inplace(
            doc,
            UpsertPlanViewTemplateCmd(
                id="tmpl2",
                name="Graphics template",
                planCategoryGraphics=[
                    PlanCategoryGraphicRow(
                        categoryKey="wall",
                        lineWeightFactor=1.5,
                        linePatternToken="dash_short",
                    )
                ],
            ),
        )
        tmpl = doc.elements["tmpl2"]
        assert isinstance(tmpl, ViewTemplateElem)
        assert len(tmpl.plan_category_graphics) == 1
        assert tmpl.plan_category_graphics[0].category_key == "wall"


class TestApplyPlanViewTemplate:
    def test_stamps_template_id_onto_plan_view(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.view_template_id == "tmpl"

    def test_stamps_view_range_from_template(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.view_range_bottom_mm == -500.0
        assert pv.view_range_top_mm == 2800.0

    def test_stamps_hidden_categories_from_template(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert "stair" in pv.categories_hidden

    def test_invalid_plan_view_id_raises(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        with pytest.raises(ValueError, match="applyPlanViewTemplate.planViewId"):
            apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="no_such_pv", templateId="tmpl"))

    def test_invalid_template_id_raises(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        with pytest.raises(ValueError, match="applyPlanViewTemplate.templateId"):
            apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="no_such_tmpl"))

    def test_round_trip_apply_then_crop_then_reapply_resets_crop(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        apply_inplace(
            doc,
            UpdatePlanViewCropCmd(
                planViewId="pv",
                cropMinMm=Vec2Mm(xMm=0, yMm=0),
                cropMaxMm=Vec2Mm(xMm=5000, yMm=4000),
            ),
        )
        pv_mid = doc.elements["pv"]
        assert isinstance(pv_mid, PlanViewElem)
        assert pv_mid.crop_min_mm is not None
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        pv_final = doc.elements["pv"]
        assert isinstance(pv_final, PlanViewElem)
        assert pv_final.crop_min_mm is None
        assert pv_final.crop_max_mm is None

class TestViewTemplateControlMatrix:
    def test_create_view_template_persists_include_lock_matrix(self) -> None:
        doc = _base_doc()
        apply_inplace(
            doc,
            CreateViewTemplateCmd(
                templateId="tpl",
                name="Controlled",
                scale=100,
                templateControlMatrix={"scale": {"included": False, "locked": False}},
            ),
        )
        tpl = doc.elements["tpl"]
        assert isinstance(tpl, ViewTemplateElem)
        assert tpl.template_control_matrix["scale"].included is False
        assert tpl.template_control_matrix["scale"].locked is False

    def test_apply_and_update_skip_excluded_fields_for_bound_views(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        pv_initial = doc.elements["pv"]
        assert isinstance(pv_initial, PlanViewElem)
        doc.elements["pv"] = pv_initial.model_copy(
            update={"scale": 25, "plan_detail_level": "coarse"}
        )
        apply_inplace(
            doc,
            CreateViewTemplateCmd(
                templateId="tpl",
                name="Controlled",
                scale=100,
                detailLevel="fine",
                templateControlMatrix={"scale": {"included": False, "locked": False}},
            ),
        )

        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        pv_after_apply = doc.elements["pv"]
        assert isinstance(pv_after_apply, PlanViewElem)
        assert pv_after_apply.template_id == "tpl"
        assert pv_after_apply.scale == 25
        assert pv_after_apply.plan_detail_level == "fine"

        apply_inplace(doc, UpdateViewTemplateCmd(templateId="tpl", scale=50, detailLevel="medium"))
        pv_after_update = doc.elements["pv"]
        assert isinstance(pv_after_update, PlanViewElem)
        assert pv_after_update.scale == 25
        assert pv_after_update.plan_detail_level == "medium"


class TestUpdatePlanViewCrop:
    def test_sets_crop_corners(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            UpdatePlanViewCropCmd(
                planViewId="pv",
                cropMinMm=Vec2Mm(xMm=100, yMm=200),
                cropMaxMm=Vec2Mm(xMm=6000, yMm=5000),
            ),
        )
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.crop_min_mm is not None
        assert pv.crop_min_mm.x_mm == 100
        assert pv.crop_min_mm.y_mm == 200
        assert pv.crop_max_mm is not None
        assert pv.crop_max_mm.x_mm == 6000

    def test_clears_crop_when_none(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            UpdatePlanViewCropCmd(
                planViewId="pv",
                cropMinMm=Vec2Mm(xMm=0, yMm=0),
                cropMaxMm=Vec2Mm(xMm=5000, yMm=4000),
            ),
        )
        apply_inplace(doc, UpdatePlanViewCropCmd(planViewId="pv", cropMinMm=None, cropMaxMm=None))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.crop_min_mm is None
        assert pv.crop_max_mm is None

    def test_primitive_count_changes_with_crop(self) -> None:
        from bim_ai.commands import CreateWallCmd
        from bim_ai.elements import Vec2Mm as V

        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            CreateWallCmd(
                levelId="lv",
                start=V(xMm=0, yMm=0),
                end=V(xMm=10000, yMm=0),
            ),
        )
        apply_inplace(
            doc,
            CreateWallCmd(
                levelId="lv",
                start=V(xMm=20000, yMm=0),
                end=V(xMm=30000, yMm=0),
            ),
        )
        wire_before = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")
        walls_before = len(wire_before.get("primitives", {}).get("walls", []))
        apply_inplace(
            doc,
            UpdatePlanViewCropCmd(
                planViewId="pv",
                cropMinMm=Vec2Mm(xMm=0, yMm=-500),
                cropMaxMm=Vec2Mm(xMm=12000, yMm=500),
            ),
        )
        wire_after = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")
        walls_after = len(wire_after.get("primitives", {}).get("walls", []))
        assert walls_after < walls_before

    def test_invalid_plan_view_id_raises(self) -> None:
        doc = _base_doc()
        with pytest.raises(ValueError, match="updatePlanViewCrop.planViewId"):
            apply_inplace(
                doc,
                UpdatePlanViewCropCmd(planViewId="missing", cropMinMm=None, cropMaxMm=None),
            )


class TestUpdatePlanViewRange:
    def test_sets_view_range(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            UpdatePlanViewRangeCmd(
                planViewId="pv",
                viewRangeBottomMm=-300.0,
                viewRangeTopMm=3200.0,
            ),
        )
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.view_range_bottom_mm == -300.0
        assert pv.view_range_top_mm == 3200.0

    def test_clears_view_range_when_none(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            UpdatePlanViewRangeCmd(
                planViewId="pv", viewRangeBottomMm=-300.0, viewRangeTopMm=3200.0
            ),
        )
        apply_inplace(
            doc,
            UpdatePlanViewRangeCmd(planViewId="pv", viewRangeBottomMm=None, viewRangeTopMm=None),
        )
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.view_range_bottom_mm is None
        assert pv.view_range_top_mm is None

    def test_vertical_clip_changes_primitive_inclusion(self) -> None:
        from bim_ai.commands import CreateWallCmd
        from bim_ai.elements import Vec2Mm as V

        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            CreateWallCmd(
                levelId="lv",
                start=V(xMm=0, yMm=0),
                end=V(xMm=10000, yMm=0),
                heightMm=3000,
            ),
        )
        apply_inplace(
            doc,
            UpdatePlanViewRangeCmd(
                planViewId="pv", viewRangeBottomMm=-500.0, viewRangeTopMm=3200.0
            ),
        )
        wire_in_range = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")
        count_in_range = wire_in_range.get("visibleElementEligibleCount", 0)
        apply_inplace(
            doc,
            UpdatePlanViewRangeCmd(
                planViewId="pv", viewRangeBottomMm=5000.0, viewRangeTopMm=9000.0
            ),
        )
        wire_above = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")
        count_above = wire_above.get("visibleElementEligibleCount", 0)
        assert count_above < count_in_range

    def test_invalid_plan_view_id_raises(self) -> None:
        doc = _base_doc()
        with pytest.raises(ValueError, match="updatePlanViewRange.planViewId"):
            apply_inplace(
                doc,
                UpdatePlanViewRangeCmd(
                    planViewId="missing",
                    viewRangeBottomMm=-300.0,
                    viewRangeTopMm=3200.0,
                ),
            )


class TestPlanViewTemplateApplicationEvidence:
    def test_evidence_captures_before_after_diff(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        pv_before = doc.elements["pv"]
        assert isinstance(pv_before, PlanViewElem)
        before_snap = {
            "viewTemplateId": pv_before.view_template_id,
            "viewRangeBottomMm": pv_before.view_range_bottom_mm,
            "viewRangeTopMm": pv_before.view_range_top_mm,
            "categoriesHidden": list(pv_before.categories_hidden),
        }
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        pv_after = doc.elements["pv"]
        assert isinstance(pv_after, PlanViewElem)
        after_snap = {
            "viewTemplateId": pv_after.view_template_id,
            "viewRangeBottomMm": pv_after.view_range_bottom_mm,
            "viewRangeTopMm": pv_after.view_range_top_mm,
            "categoriesHidden": list(pv_after.categories_hidden),
        }
        ev = planViewTemplateApplicationEvidence_v1("pv", before_snap, after_snap)
        assert ev["format"] == "planViewTemplateApplicationEvidence_v1"
        assert ev["planViewId"] == "pv"
        assert ev["changedPropertyCount"] > 0
        changed = ev["changedProperties"]
        assert "viewTemplateId" in changed
        assert changed["viewTemplateId"]["before"] is None
        assert changed["viewTemplateId"]["after"] == "tmpl"

    def test_evidence_empty_when_no_change(self) -> None:
        snap = {"viewTemplateId": "t1", "viewRangeBottomMm": -500.0}
        ev = planViewTemplateApplicationEvidence_v1("pv", snap, snap.copy())
        assert ev["changedPropertyCount"] == 0
        assert ev["changedProperties"] == {}

    def test_browser_hierarchy_includes_template_view_range(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        apply_inplace(doc, ApplyPlanViewTemplateCmd(planViewId="pv", templateId="tmpl"))
        wire = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")
        hierarchy = wire.get("planViewBrowserHierarchy_v0")
        assert hierarchy is not None
        assert hierarchy["viewTemplateId"] == "tmpl"
        tmpl_range = hierarchy.get("templateViewRange")
        assert tmpl_range is not None
        assert tmpl_range["viewRangeBottomMm"] == -500.0
        assert tmpl_range["viewRangeTopMm"] == 2800.0

    def test_browser_hierarchy_includes_stored_crop(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            UpdatePlanViewCropCmd(
                planViewId="pv",
                cropMinMm=Vec2Mm(xMm=100, yMm=200),
                cropMaxMm=Vec2Mm(xMm=5000, yMm=4000),
            ),
        )
        wire = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id="lv")
        hierarchy = wire.get("planViewBrowserHierarchy_v0")
        assert hierarchy is not None
        assert hierarchy["storedCropMinMm"] == {"xMm": 100.0, "yMm": 200.0}
        assert hierarchy["storedCropMaxMm"] == {"xMm": 5000.0, "yMm": 4000.0}
