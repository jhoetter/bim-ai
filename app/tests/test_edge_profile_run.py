"""KRN-V3-03 G12 — CreateEdgeProfileRun engine dispatch tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateEdgeProfileRunCmd, CreateLevelCmd, CreateRoofCmd
from bim_ai.document import Document
from bim_ai.elements import EdgeProfileRunElem
from bim_ai.engine import apply_inplace

_FP = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 8000, "yMm": 0},
    {"xMm": 8000, "yMm": 6000},
    {"xMm": 0, "yMm": 6000},
]

_OFFSET = {"xMm": 0, "yMm": 0}


def _base_doc() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="r-1",
            name="Roof",
            referenceLevelId="lvl",
            footprintMm=_FP,
            slopeDeg=25.0,
            roofGeometryMode="gable_pitched_rectangle",
        ),
    )
    return doc


def test_edge_profile_run_fascia_on_eave_happy_path() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-1",
            hostElementId="r-1",
            hostEdge="eave",
            profileFamilyId="fascia",
            offsetMm=_OFFSET,
            miterMode="auto",
        ),
    )
    elem = doc.elements["epr-1"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert elem.host_element_id == "r-1"
    assert elem.host_edge == "eave"
    assert elem.profile_family_id == "fascia"
    assert elem.miter_mode == "auto"


def test_edge_profile_run_rake_miter_manual() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-2",
            hostElementId="r-1",
            hostEdge="rake",
            profileFamilyId="gutter",
            offsetMm=_OFFSET,
            miterMode="manual",
        ),
    )
    elem = doc.elements["epr-2"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert elem.miter_mode == "manual"


def test_edge_profile_run_custom_host_edge_dict() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-3",
            hostElementId="r-1",
            hostEdge={"startMm": 0, "endMm": 4000},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
        ),
    )
    elem = doc.elements["epr-3"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert isinstance(elem.host_edge, dict)


def test_edge_profile_run_rejects_unknown_host_element() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(
            doc,
            CreateEdgeProfileRunCmd(
                hostElementId="no-such",
                hostEdge="eave",
                profileFamilyId="fascia",
                offsetMm=_OFFSET,
            ),
        )


def test_edge_profile_run_rejects_empty_profile_family_id() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="profileFamilyId"):
        apply_inplace(
            doc,
            CreateEdgeProfileRunCmd(
                hostElementId="r-1",
                hostEdge="eave",
                profileFamilyId="",
                offsetMm=_OFFSET,
            ),
        )


def test_edge_profile_run_miter_mode_stored_correctly() -> None:
    doc = _base_doc()
    for mode in ("auto", "manual"):
        eid = f"epr-{mode}"
        apply_inplace(
            doc,
            CreateEdgeProfileRunCmd(
                id=eid,
                hostElementId="r-1",
                hostEdge="eave",
                profileFamilyId="fascia",
                offsetMm=_OFFSET,
                miterMode=mode,
            ),
        )
        assert doc.elements[eid].miter_mode == mode  # type: ignore[union-attr]
