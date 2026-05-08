"""KRN-V3-03 G13 — CreateSoffit engine dispatch tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateLevelCmd, CreateRoofCmd, CreateSoffitCmd
from bim_ai.document import Document
from bim_ai.elements import SoffitElem
from bim_ai.engine import apply_inplace

_FP = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 8000, "yMm": 0},
    {"xMm": 8000, "yMm": 6000},
    {"xMm": 0, "yMm": 6000},
]

_SOFFIT_BOUNDARY = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 2000, "yMm": 0},
    {"xMm": 2000, "yMm": 1000},
    {"xMm": 0, "yMm": 1000},
]


def _base_doc() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=3000))
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


def test_soffit_happy_path_with_explicit_z_mm() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateSoffitCmd(
            id="sof-1",
            boundaryMm=_SOFFIT_BOUNDARY,
            hostRoofId="r-1",
            thicknessMm=50,
            zMm=2800,
        ),
    )
    elem = doc.elements["sof-1"]
    assert isinstance(elem, SoffitElem)
    assert elem.thickness_mm == 50
    assert elem.z_mm == 2800
    assert elem.host_roof_id == "r-1"


def test_soffit_snap_to_eave_z_derived_from_host_roof_level() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateSoffitCmd(
            id="sof-snap",
            boundaryMm=_SOFFIT_BOUNDARY,
            hostRoofId="r-1",
            thicknessMm=50,
        ),
    )
    elem = doc.elements["sof-snap"]
    assert isinstance(elem, SoffitElem)
    assert elem.z_mm == 3000.0


def test_soffit_no_host_roof_z_defaults_to_zero() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateSoffitCmd(
            id="sof-noh",
            boundaryMm=_SOFFIT_BOUNDARY,
            thicknessMm=30,
        ),
    )
    elem = doc.elements["sof-noh"]
    assert isinstance(elem, SoffitElem)
    assert elem.z_mm == 0.0
    assert elem.host_roof_id is None


def test_soffit_rejects_fewer_than_three_boundary_vertices() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="≥3 vertices"):
        apply_inplace(
            doc,
            CreateSoffitCmd(
                boundaryMm=[{"xMm": 0, "yMm": 0}, {"xMm": 1000, "yMm": 0}],
                thicknessMm=50,
                zMm=0,
            ),
        )


def test_soffit_rejects_zero_thickness() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="thicknessMm"):
        apply_inplace(
            doc,
            CreateSoffitCmd(
                boundaryMm=_SOFFIT_BOUNDARY,
                thicknessMm=0,
                zMm=0,
            ),
        )


def test_soffit_rejects_negative_thickness() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="thicknessMm"):
        apply_inplace(
            doc,
            CreateSoffitCmd(
                boundaryMm=_SOFFIT_BOUNDARY,
                thicknessMm=-10,
                zMm=0,
            ),
        )


def test_soffit_rejects_invalid_host_roof_id() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="must reference a roof"):
        apply_inplace(
            doc,
            CreateSoffitCmd(
                boundaryMm=_SOFFIT_BOUNDARY,
                hostRoofId="no-such",
                thicknessMm=50,
                zMm=0,
            ),
        )
