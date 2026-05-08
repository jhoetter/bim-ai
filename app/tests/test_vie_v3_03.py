"""VIE-V3-03 — View templates v3: create / update / apply / unbind / delete + propagation."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    ApplyViewTemplateCmd,
    CreateViewTemplateCmd,
    DeleteViewTemplateCmd,
    UnbindViewTemplateCmd,
    UpdateViewTemplateCmd,
    UpsertPlanViewCmd,
)
from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, ViewTemplateElem
from bim_ai.engine import apply_inplace, clone_document, compute_view_template_propagation


def _base_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
        },
    )


def _add_plan_view(doc: Document, pv_id: str = "pv") -> None:
    apply_inplace(
        doc,
        UpsertPlanViewCmd(id=pv_id, name="Test Plan", levelId="lv"),
    )


def _add_template(doc: Document, tpl_id: str = "tpl", scale: int = 100) -> None:
    apply_inplace(
        doc,
        CreateViewTemplateCmd(templateId=tpl_id, name="My Template", scale=scale),
    )


class TestCreateViewTemplate:
    def test_creates_template_in_elements(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        tpl = doc.elements.get("tpl")
        assert isinstance(tpl, ViewTemplateElem)
        assert tpl.name == "My Template"
        assert tpl.scale == 100

    def test_duplicate_id_raises(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        with pytest.raises(ValueError, match="duplicate element id"):
            _add_template(doc)

    def test_stores_detail_level(self) -> None:
        doc = _base_doc()
        apply_inplace(
            doc,
            CreateViewTemplateCmd(
                templateId="tpl2", name="Fine", scale=50, detailLevel="fine"
            ),
        )
        tpl = doc.elements["tpl2"]
        assert isinstance(tpl, ViewTemplateElem)
        assert tpl.detail_level == "fine"

    def test_stores_phase_and_phase_filter(self) -> None:
        doc = _base_doc()
        apply_inplace(
            doc,
            CreateViewTemplateCmd(
                templateId="tpl3", name="Phase", phase="new", phaseFilter="new"
            ),
        )
        tpl = doc.elements["tpl3"]
        assert isinstance(tpl, ViewTemplateElem)
        assert tpl.phase == "new"
        assert tpl.phase_filter == "new"


class TestApplyViewTemplate:
    def test_sets_view_template_id(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.template_id == "tpl"

    def test_propagates_scale_immediately(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc, scale=200)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.scale == 200

    def test_propagates_detail_level(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        apply_inplace(
            doc,
            CreateViewTemplateCmd(templateId="tpl", name="T", detailLevel="coarse"),
        )
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.plan_detail_level == "coarse"

    def test_invalid_view_id_raises(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        with pytest.raises(ValueError, match="ApplyViewTemplate.viewId"):
            apply_inplace(doc, ApplyViewTemplateCmd(viewId="no_such_pv", templateId="tpl"))

    def test_invalid_template_id_raises(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        with pytest.raises(ValueError, match="ApplyViewTemplate.templateId"):
            apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="no_such_tpl"))


class TestUpdateViewTemplate:
    def test_propagates_scale_to_all_bound_views(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc, "pv1")
        _add_plan_view(doc, "pv2")
        _add_template(doc, scale=100)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv1", templateId="tpl"))
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv2", templateId="tpl"))
        apply_inplace(doc, UpdateViewTemplateCmd(templateId="tpl", scale=50))
        pv1 = doc.elements["pv1"]
        pv2 = doc.elements["pv2"]
        assert isinstance(pv1, PlanViewElem)
        assert isinstance(pv2, PlanViewElem)
        assert pv1.scale == 50
        assert pv2.scale == 50

    def test_returns_propagation_affected_list(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc, "pv1")
        _add_plan_view(doc, "pv2")
        _add_template(doc, scale=100)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv1", templateId="tpl"))
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv2", templateId="tpl"))
        doc_before = clone_document(doc)
        apply_inplace(doc, UpdateViewTemplateCmd(templateId="tpl", scale=50))
        prop = compute_view_template_propagation(doc_before, doc, UpdateViewTemplateCmd(templateId="tpl", scale=50))
        assert prop is not None
        assert prop["event"] == "ViewTemplatePropagation"
        assert set(prop["affected"]) == {"pv1", "pv2"}
        assert prop["unbound"] == []

    def test_no_bound_views_returns_empty_affected(self) -> None:
        doc = _base_doc()
        _add_template(doc, scale=100)
        doc_before = clone_document(doc)
        apply_inplace(doc, UpdateViewTemplateCmd(templateId="tpl", scale=50))
        prop = compute_view_template_propagation(doc_before, doc, UpdateViewTemplateCmd(templateId="tpl", scale=50))
        assert prop is not None
        assert prop["affected"] == []

    def test_unbound_view_not_propagated(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc, "pv1")
        _add_plan_view(doc, "pv2")
        _add_template(doc, scale=100)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv1", templateId="tpl"))
        # pv2 is NOT bound
        apply_inplace(doc, UpdateViewTemplateCmd(templateId="tpl", scale=50))
        pv2 = doc.elements["pv2"]
        assert isinstance(pv2, PlanViewElem)
        assert pv2.scale is None

    def test_invalid_template_raises(self) -> None:
        doc = _base_doc()
        with pytest.raises(ValueError, match="UpdateViewTemplate.templateId"):
            apply_inplace(doc, UpdateViewTemplateCmd(templateId="no_such", scale=50))


class TestUnbindViewTemplate:
    def test_clears_template_id(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc, scale=100)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        apply_inplace(doc, UnbindViewTemplateCmd(viewId="pv"))
        pv = doc.elements["pv"]
        assert isinstance(pv, PlanViewElem)
        assert pv.template_id is None

    def test_view_retains_current_values_after_unbind(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc, scale=200)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        pv_mid = doc.elements["pv"]
        assert isinstance(pv_mid, PlanViewElem)
        assert pv_mid.scale == 200
        apply_inplace(doc, UnbindViewTemplateCmd(viewId="pv"))
        pv_final = doc.elements["pv"]
        assert isinstance(pv_final, PlanViewElem)
        assert pv_final.scale == 200  # retained, not reverted

    def test_returns_propagation_with_unbound_view(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc)
        _add_template(doc, scale=100)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv", templateId="tpl"))
        doc_before = clone_document(doc)
        cmd = UnbindViewTemplateCmd(viewId="pv")
        apply_inplace(doc, cmd)
        prop = compute_view_template_propagation(doc_before, doc, cmd)
        assert prop is not None
        assert prop["event"] == "ViewTemplatePropagation"
        assert prop["affected"] == []
        assert prop["unbound"] == ["pv"]

    def test_invalid_view_raises(self) -> None:
        doc = _base_doc()
        with pytest.raises(ValueError, match="UnbindViewTemplate.viewId"):
            apply_inplace(doc, UnbindViewTemplateCmd(viewId="no_such_pv"))


class TestDeleteViewTemplate:
    def test_removes_template_from_elements(self) -> None:
        doc = _base_doc()
        _add_template(doc)
        apply_inplace(doc, DeleteViewTemplateCmd(templateId="tpl"))
        assert "tpl" not in doc.elements

    def test_bound_views_get_template_id_cleared(self) -> None:
        doc = _base_doc()
        _add_plan_view(doc, "pv1")
        _add_plan_view(doc, "pv2")
        _add_template(doc)
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv1", templateId="tpl"))
        apply_inplace(doc, ApplyViewTemplateCmd(viewId="pv2", templateId="tpl"))
        apply_inplace(doc, DeleteViewTemplateCmd(templateId="tpl"))
        pv1 = doc.elements["pv1"]
        pv2 = doc.elements["pv2"]
        assert isinstance(pv1, PlanViewElem)
        assert isinstance(pv2, PlanViewElem)
        assert pv1.template_id is None
        assert pv2.template_id is None

    def test_invalid_template_raises(self) -> None:
        doc = _base_doc()
        with pytest.raises(ValueError):
            apply_inplace(doc, DeleteViewTemplateCmd(templateId="no_such_tpl"))
