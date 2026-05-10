"""Plan template/tag matrix advisor rules and browser hierarchy payload (WP-C01/C02/C05/V01)."""

from __future__ import annotations

from bim_ai.constraints import _plan_view_tag_style_advisor_violations, evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    PlanTagStyleElem,
    PlanViewElem,
    ViewTemplateElem,
)
from bim_ai.plan_projection_wire import plan_projection_wire_from_request

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tag_style(
    eid: str,
    target: str = "opening",
    name: str = "Tag",
) -> PlanTagStyleElem:
    return PlanTagStyleElem(kind="plan_tag_style", id=eid, name=name, tagTarget=target)


def _minimal_doc_with_plan_view(
    pv_id: str = "pv1",
    tmpl_id: str | None = None,
    opening_style_id: str | None = None,
    room_style_id: str | None = None,
    show_opening_tags: bool | None = None,
    show_room_labels: bool | None = None,
    extra_elements: dict | None = None,
) -> Document:
    els: dict = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        pv_id: PlanViewElem(
            kind="plan_view",
            id=pv_id,
            name="Test Plan",
            levelId="lvl",
            viewTemplateId=tmpl_id,
            planOpeningTagStyleId=opening_style_id,
            planRoomTagStyleId=room_style_id,
            planShowOpeningTags=show_opening_tags,
            planShowRoomLabels=show_room_labels,
        ),
    }
    if extra_elements:
        els.update(extra_elements)
    return Document(revision=1, elements=els)


# ---------------------------------------------------------------------------
# _plan_view_tag_style_advisor_violations
# ---------------------------------------------------------------------------


def test_no_violations_for_plan_view_without_tags() -> None:
    doc = _minimal_doc_with_plan_view()
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    assert viols == []


def test_plan_view_tag_style_fallback_when_opening_tags_enabled_no_style() -> None:
    doc = _minimal_doc_with_plan_view(show_opening_tags=True)
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    rule_ids = [v.rule_id for v in viols]
    assert "plan_view_tag_style_fallback" in rule_ids


def test_plan_view_tag_style_fallback_when_room_labels_enabled_no_style() -> None:
    doc = _minimal_doc_with_plan_view(show_room_labels=True)
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    rule_ids = [v.rule_id for v in viols]
    assert "plan_view_tag_style_fallback" in rule_ids


def test_no_fallback_advisory_when_tags_off() -> None:
    """If tags are off the fallback advisory must not fire."""
    doc = _minimal_doc_with_plan_view(show_opening_tags=False, show_room_labels=False)
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    assert not any(v.rule_id == "plan_view_tag_style_fallback" for v in viols)


def test_no_fallback_advisory_when_valid_plan_view_style_assigned() -> None:
    style = _make_tag_style("ts-open", "opening")
    doc = _minimal_doc_with_plan_view(
        opening_style_id="ts-open",
        show_opening_tags=True,
        extra_elements={"ts-open": style},
    )
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    assert not any(v.rule_id == "plan_view_tag_style_fallback" for v in viols)


def test_plan_view_tag_style_ref_invalid_when_ref_missing() -> None:
    doc = _minimal_doc_with_plan_view(opening_style_id="nonexistent-id")
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    rule_ids = [v.rule_id for v in viols]
    assert "plan_view_tag_style_ref_invalid" in rule_ids


def test_plan_view_tag_style_ref_invalid_when_ref_wrong_kind() -> None:
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="Test",
            levelId="lvl",
            planOpeningTagStyleId="lvl",
        ),
    }
    viols = _plan_view_tag_style_advisor_violations(els)
    rule_ids = [v.rule_id for v in viols]
    assert "plan_view_tag_style_ref_invalid" in rule_ids


def test_plan_view_tag_style_target_mismatch() -> None:
    room_style_used_for_opening = _make_tag_style("ts-room", "room")
    doc = _minimal_doc_with_plan_view(
        opening_style_id="ts-room",
        extra_elements={"ts-room": room_style_used_for_opening},
    )
    viols = _plan_view_tag_style_advisor_violations(dict(doc.elements))
    rule_ids = [v.rule_id for v in viols]
    assert "plan_view_tag_style_target_mismatch" in rule_ids


def test_plan_template_tag_style_ref_invalid() -> None:
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="tmpl1",
        name="T1",
        defaultPlanOpeningTagStyleId="nonexistent",
    )
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "tmpl1": tmpl,
        "pv1": PlanViewElem(
            kind="plan_view", id="pv1", name="P", levelId="lvl", viewTemplateId="tmpl1"
        ),
    }
    viols = _plan_view_tag_style_advisor_violations(els)
    rule_ids = [v.rule_id for v in viols]
    assert "plan_template_tag_style_ref_invalid" in rule_ids


def test_plan_view_tag_style_override_advisory() -> None:
    tmpl_style = _make_tag_style("ts-tmpl", "opening", name="TemplateStyle")
    pv_style = _make_tag_style("ts-pv", "opening", name="PlanViewStyle")
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="tmpl1",
        name="T1",
        defaultPlanOpeningTagStyleId="ts-tmpl",
    )
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "tmpl1": tmpl,
        "ts-tmpl": tmpl_style,
        "ts-pv": pv_style,
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            viewTemplateId="tmpl1",
            planOpeningTagStyleId="ts-pv",
        ),
    }
    viols = _plan_view_tag_style_advisor_violations(els)
    rule_ids = [v.rule_id for v in viols]
    assert "plan_view_tag_style_override" in rule_ids


def test_no_override_advisory_when_plan_view_matches_template_default() -> None:
    """Same style on both plan view and template should not fire override advisory."""
    style = _make_tag_style("ts-shared", "opening")
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="tmpl1",
        name="T1",
        defaultPlanOpeningTagStyleId="ts-shared",
    )
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "tmpl1": tmpl,
        "ts-shared": style,
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            viewTemplateId="tmpl1",
            planOpeningTagStyleId="ts-shared",
        ),
    }
    viols = _plan_view_tag_style_advisor_violations(els)
    assert not any(v.rule_id == "plan_view_tag_style_override" for v in viols)


def test_no_fallback_when_template_provides_valid_style() -> None:
    """Fallback advisory must NOT fire when template provides a valid style."""
    style = _make_tag_style("ts-open", "opening")
    tmpl = ViewTemplateElem(
        kind="view_template",
        id="tmpl1",
        name="T1",
        defaultPlanOpeningTagStyleId="ts-open",
        planShowOpeningTags=True,
    )
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "tmpl1": tmpl,
        "ts-open": style,
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            viewTemplateId="tmpl1",
        ),
    }
    viols = _plan_view_tag_style_advisor_violations(els)
    assert not any(v.rule_id == "plan_view_tag_style_fallback" for v in viols)


def test_evaluate_includes_plan_tag_style_violations() -> None:
    """Top-level evaluate() must include plan tag style advisor violations."""
    doc = _minimal_doc_with_plan_view(
        show_opening_tags=True,
        opening_style_id="missing-ref",
    )
    viols = evaluate(dict(doc.elements))
    rule_ids = {v.rule_id for v in viols}
    assert "plan_view_tag_style_ref_invalid" in rule_ids


def test_plan_tag_style_violations_have_architecture_discipline() -> None:
    doc = _minimal_doc_with_plan_view(show_opening_tags=True)
    viols = evaluate(dict(doc.elements))
    tag_viols = [v for v in viols if v.rule_id == "plan_view_tag_style_fallback"]
    assert tag_viols
    for v in tag_viols:
        assert v.discipline == "architecture"


# ---------------------------------------------------------------------------
# planViewBrowserHierarchy_v0 in projection wire
# ---------------------------------------------------------------------------


def test_plan_view_browser_hierarchy_v0_emitted_for_pinned_view() -> None:
    doc = _minimal_doc_with_plan_view()
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    assert "planViewBrowserHierarchy_v0" in out
    hier = out["planViewBrowserHierarchy_v0"]
    assert hier["format"] == "planViewBrowserHierarchy_v0"
    assert hier["planViewId"] == "pv1"


def test_area_plan_browser_hierarchy_includes_scheme_metadata() -> None:
    doc = _minimal_doc_with_plan_view()
    pv = doc.elements["pv1"]
    assert isinstance(pv, PlanViewElem)
    doc.elements["pv1"] = pv.model_copy(
        update={"plan_view_subtype": "area_plan", "area_scheme": "gross_building"}
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    assert hier["planViewSubtype"] == "area_plan"
    assert hier["areaScheme"] == "gross_building"


def test_plan_view_browser_hierarchy_absent_for_unpinned() -> None:
    doc = _minimal_doc_with_plan_view()
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    assert "planViewBrowserHierarchy_v0" not in out


def test_plan_view_browser_hierarchy_reflects_template_link() -> None:
    style = _make_tag_style("ts-open", "opening")
    tmpl_with_style = ViewTemplateElem(
        kind="view_template",
        id="tmpl1",
        name="MyTemplate",
        defaultPlanOpeningTagStyleId="ts-open",
    )
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "tmpl1": tmpl_with_style,
        "ts-open": style,
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            viewTemplateId="tmpl1",
        ),
    }
    doc = Document(revision=1, elements=els)
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    assert hier["viewTemplateId"] == "tmpl1"
    assert hier["viewTemplateName"] == "MyTemplate"


def test_plan_view_browser_hierarchy_tag_style_source_builtin_when_no_style() -> None:
    doc = _minimal_doc_with_plan_view()
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    tag_styles = {ts["lane"]: ts for ts in hier["tagStyles"]}
    assert tag_styles["opening"]["effectiveSource"] == "builtin"
    assert tag_styles["room"]["effectiveSource"] == "builtin"


def test_plan_view_browser_hierarchy_tag_style_source_plan_view_when_explicit() -> None:
    style = _make_tag_style("ts-open", "opening")
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "ts-open": style,
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            planOpeningTagStyleId="ts-open",
        ),
    }
    doc = Document(revision=1, elements=els)
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    tag_styles = {ts["lane"]: ts for ts in hier["tagStyles"]}
    assert tag_styles["opening"]["effectiveSource"] == "plan_view"


def test_plan_view_browser_hierarchy_category_source_counts_all_default() -> None:
    doc = _minimal_doc_with_plan_view()
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    counts = hier["categoryGraphicsSourceCounts"]
    assert counts["default"] == 10
    assert counts.get("template", 0) == 0
    assert counts.get("plan_view", 0) == 0


def test_plan_view_browser_hierarchy_category_source_counts_with_template_override() -> None:
    from bim_ai.elements import PlanCategoryGraphicRow

    tmpl = ViewTemplateElem(
        kind="view_template",
        id="tmpl1",
        name="T1",
        planCategoryGraphics=[
            PlanCategoryGraphicRow(categoryKey="wall", lineWeightFactor=2.0),
            PlanCategoryGraphicRow(categoryKey="door", linePatternToken="dash_short"),
        ],
    )
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "tmpl1": tmpl,
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            viewTemplateId="tmpl1",
        ),
    }
    doc = Document(revision=1, elements=els)
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    counts = hier["categoryGraphicsSourceCounts"]
    assert counts["template"] >= 2
    assert counts["default"] <= 8


def test_plan_view_browser_hierarchy_category_rows_length() -> None:
    doc = _minimal_doc_with_plan_view()
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    assert len(hier["categoryGraphicsRows"]) == 10


def test_plan_view_browser_hierarchy_annotation_hints() -> None:
    els = {
        "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
        "pv1": PlanViewElem(
            kind="plan_view",
            id="pv1",
            name="P",
            levelId="lvl",
            planShowOpeningTags=True,
            planShowRoomLabels=False,
        ),
    }
    doc = Document(revision=1, elements=els)
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1")
    hier = out["planViewBrowserHierarchy_v0"]
    ann = hier["annotationHints"]
    assert ann["openingTagsVisible"] is True
    assert ann["openingTagsSource"] == "plan_view"
    assert ann["roomLabelsVisible"] is False
    assert ann["roomLabelsSource"] == "plan_view"
