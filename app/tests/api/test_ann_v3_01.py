"""ANN-V3-01 — Detail-region drawing-mode authoring tests."""

import uuid

import pytest

from bim_ai.commands import DrawDetailRegionCmd, UpdateDetailRegionCmd
from bim_ai.document import Document
from bim_ai.elements import DetailRegionElem, LevelElem, PlanViewElem
from bim_ai.engine import apply_inplace


def _seed() -> Document:
    return Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="EG", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="GF", levelId="lv"),
        },
    )


def _verts(n: int = 5) -> list[dict]:
    return [{"x": float(i * 1000), "y": float(i * 500)} for i in range(n)]


def test_create_detail_region_stores_element() -> None:
    doc = _seed()
    eid = str(uuid.uuid4())
    apply_inplace(
        doc,
        DrawDetailRegionCmd(
            id=eid,
            viewId="pv",
            vertices=_verts(5),
            closed=True,
            hatchId="brick_45",
        ),
    )
    elem = doc.elements[eid]
    assert isinstance(elem, DetailRegionElem)
    assert elem.kind == "detail_region"
    assert elem.view_id == "pv"
    assert elem.vertices is not None
    assert len(elem.vertices) == 5
    assert elem.closed is True
    assert elem.hatch_id == "brick_45"


def test_update_detail_region_patches_vertices_and_closed() -> None:
    doc = _seed()
    eid = str(uuid.uuid4())
    apply_inplace(
        doc,
        DrawDetailRegionCmd(id=eid, viewId="pv", vertices=_verts(3), closed=False),
    )
    new_verts = _verts(6)
    apply_inplace(
        doc,
        UpdateDetailRegionCmd(id=eid, vertices=new_verts, closed=True),
    )
    elem = doc.elements[eid]
    assert isinstance(elem, DetailRegionElem)
    assert len(elem.vertices) == 6  # type: ignore[arg-type]
    assert elem.closed is True


def test_update_raises_for_missing_element() -> None:
    doc = _seed()
    with pytest.raises(ValueError, match="No detail_region element"):
        apply_inplace(
            doc,
            UpdateDetailRegionCmd(id="nonexistent", vertices=_verts(3)),
        )


def test_create_raises_for_invalid_view() -> None:
    doc = _seed()
    with pytest.raises(ValueError):
        apply_inplace(
            doc,
            DrawDetailRegionCmd(id="dr1", viewId="missing-view", vertices=_verts(3)),
        )


def test_create_raises_for_too_few_vertices() -> None:
    doc = _seed()
    with pytest.raises(ValueError, match="at least 2"):
        apply_inplace(
            doc,
            DrawDetailRegionCmd(id="dr1", viewId="pv", vertices=[{"x": 0.0, "y": 0.0}]),
        )


def test_phase_demolished_marks_element() -> None:
    doc = _seed()
    eid = str(uuid.uuid4())
    apply_inplace(
        doc,
        DrawDetailRegionCmd(id=eid, viewId="pv", vertices=_verts(3), phaseCreated="existing"),
    )
    apply_inplace(
        doc,
        UpdateDetailRegionCmd(id=eid, phaseDemolished="new"),
    )
    elem = doc.elements[eid]
    assert isinstance(elem, DetailRegionElem)
    assert elem.phase_demolished == "new"


def test_round_trip_element_present_in_snapshot() -> None:
    doc = _seed()
    eid = str(uuid.uuid4())
    apply_inplace(
        doc,
        DrawDetailRegionCmd(id=eid, viewId="pv", vertices=_verts(3)),
    )
    assert eid in doc.elements
    elem = doc.elements[eid]
    assert elem.kind == "detail_region"
    assert elem.view_id == "pv"  # type: ignore[union-attr]


def test_draw_detail_region_tool_descriptor_registered() -> None:
    from bim_ai.api.registry import get_descriptor

    descriptor = get_descriptor("draw-detail-region")
    assert descriptor is not None
    assert descriptor.name == "draw-detail-region"
    assert descriptor.category == "mutation"
