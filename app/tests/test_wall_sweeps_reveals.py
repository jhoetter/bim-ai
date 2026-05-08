"""KRN-V3-08 — Wall sweeps & reveals engine tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    CreateEdgeProfileRunCmd,
    CreateLevelCmd,
    CreateRoofCmd,
    CreateWallCmd,
    DeleteElementCmd,
    SetEdgeProfileRunModeCmd,
)
from bim_ai.document import Document
from bim_ai.elements import EdgeProfileRunElem, WallEdgeFixed, WallEdgeSpan, WallElem
from bim_ai.engine import apply_inplace, compute_wall_corner_mitre_angle

_OFFSET = {"xMm": 0, "yMm": 0}
_ROOF_FP = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 8000, "yMm": 0},
    {"xMm": 8000, "yMm": 6000},
    {"xMm": 0, "yMm": 6000},
]


def _base_doc() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateWallCmd(
            id="w-1",
            name="Exterior wall",
            levelId="lvl",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 8000, "yMm": 0},
            heightMm=3000,
        ),
    )
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="r-1",
            name="Roof",
            referenceLevelId="lvl",
            footprintMm=_ROOF_FP,
            slopeDeg=25.0,
            roofGeometryMode="gable_pitched_rectangle",
        ),
    )
    return doc


# ---------------------------------------------------------------------------
# Sweep mode — wall host
# ---------------------------------------------------------------------------


def test_wall_sweep_top_edge_creates_run_with_sweep_mode() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-1",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
            mode="sweep",
        ),
    )
    elem = doc.elements["epr-1"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert elem.mode == "sweep"
    assert elem.host_element_id == "w-1"


def test_wall_reveal_bottom_edge_creates_run_with_reveal_mode() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-2",
            hostElementId="w-1",
            hostEdge={"kind": "bottom"},
            profileFamilyId="plinth",
            offsetMm=_OFFSET,
            mode="reveal",
        ),
    )
    elem = doc.elements["epr-2"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert elem.mode == "reveal"


# ---------------------------------------------------------------------------
# SetEdgeProfileRunModeCmd
# ---------------------------------------------------------------------------


def test_set_mode_toggles_sweep_to_reveal() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-3",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
            mode="sweep",
        ),
    )
    apply_inplace(doc, SetEdgeProfileRunModeCmd(runId="epr-3", mode="reveal"))
    assert doc.elements["epr-3"].mode == "reveal"  # type: ignore[union-attr]


def test_set_mode_toggles_reveal_to_sweep() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-4",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
            mode="reveal",
        ),
    )
    apply_inplace(doc, SetEdgeProfileRunModeCmd(runId="epr-4", mode="sweep"))
    assert doc.elements["epr-4"].mode == "sweep"  # type: ignore[union-attr]


def test_set_mode_rejects_non_edge_profile_run_id() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="EdgeProfileRun"):
        apply_inplace(doc, SetEdgeProfileRunModeCmd(runId="w-1", mode="reveal"))


# ---------------------------------------------------------------------------
# WallEdgeSpan validation
# ---------------------------------------------------------------------------


def test_wall_edge_span_valid_range_accepted() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-5",
            hostElementId="w-1",
            hostEdge={"startMm": 0, "endMm": 1500},
            profileFamilyId="water_table",
            offsetMm=_OFFSET,
        ),
    )
    assert isinstance(doc.elements["epr-5"], EdgeProfileRunElem)


def test_wall_edge_span_end_exceeds_wall_height_rejected() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="endMm"):
        apply_inplace(
            doc,
            CreateEdgeProfileRunCmd(
                id="epr-6",
                hostElementId="w-1",
                hostEdge={"startMm": 0, "endMm": 5000},
                profileFamilyId="water_table",
                offsetMm=_OFFSET,
            ),
        )


# ---------------------------------------------------------------------------
# WallEdgeFixed
# ---------------------------------------------------------------------------


def test_wall_edge_fixed_top_accepted() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-7",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
        ),
    )
    assert isinstance(doc.elements["epr-7"], EdgeProfileRunElem)


def test_wall_edge_fixed_bottom_accepted() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-8",
            hostElementId="w-1",
            hostEdge={"kind": "bottom"},
            profileFamilyId="plinth",
            offsetMm=_OFFSET,
        ),
    )
    assert isinstance(doc.elements["epr-8"], EdgeProfileRunElem)


# ---------------------------------------------------------------------------
# Non-wall non-roof host rejection
# ---------------------------------------------------------------------------


def test_non_wall_non_roof_host_raises() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="Wall or Roof"):
        apply_inplace(
            doc,
            CreateEdgeProfileRunCmd(
                id="epr-9",
                hostElementId="lvl",
                hostEdge={"kind": "top"},
                profileFamilyId="cornice",
                offsetMm=_OFFSET,
            ),
        )


# ---------------------------------------------------------------------------
# compute_wall_corner_mitre_angle
# ---------------------------------------------------------------------------


def test_mitre_angle_90_degree_corner() -> None:
    assert compute_wall_corner_mitre_angle(0, 90) == 45.0


def test_mitre_angle_interior_symmetry() -> None:
    assert compute_wall_corner_mitre_angle(0, 270) == 45.0


def test_mitre_angle_parallel_walls() -> None:
    assert compute_wall_corner_mitre_angle(0, 0) == 0.0


def test_mitre_angle_45_degree_corner() -> None:
    assert compute_wall_corner_mitre_angle(0, 45) == 22.5


# ---------------------------------------------------------------------------
# Default mode is sweep (backward-compatible)
# ---------------------------------------------------------------------------


def test_default_mode_is_sweep() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-10",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
        ),
    )
    assert doc.elements["epr-10"].mode == "sweep"  # type: ignore[union-attr]


# ---------------------------------------------------------------------------
# Regression — existing roof edge profile run tests still pass
# ---------------------------------------------------------------------------


def test_roof_edge_profile_run_regression() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-roof",
            hostElementId="r-1",
            hostEdge="eave",
            profileFamilyId="fascia",
            offsetMm=_OFFSET,
            miterMode="auto",
        ),
    )
    elem = doc.elements["epr-roof"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert elem.host_element_id == "r-1"
    assert elem.host_edge == "eave"
    assert elem.mode == "sweep"


# ---------------------------------------------------------------------------
# WallEdgeFixed / WallEdgeSpan model construction
# ---------------------------------------------------------------------------


def test_wall_edge_fixed_model() -> None:
    edge = WallEdgeFixed(kind="top")
    assert edge.kind == "top"


def test_wall_edge_span_model() -> None:
    edge = WallEdgeSpan(startMm=100, endMm=500)
    assert edge.start_mm == 100
    assert edge.end_mm == 500


# ---------------------------------------------------------------------------
# Delete sweep — wall remains intact
# ---------------------------------------------------------------------------


def test_delete_sweep_leaves_wall_intact() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-del",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
            mode="sweep",
        ),
    )
    assert "epr-del" in doc.elements
    apply_inplace(doc, DeleteElementCmd(elementId="epr-del"))
    assert "epr-del" not in doc.elements
    assert "w-1" in doc.elements
    assert isinstance(doc.elements["w-1"], WallElem)


# ---------------------------------------------------------------------------
# Round-trip serialisation
# ---------------------------------------------------------------------------


def test_wall_with_sweep_round_trips() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateEdgeProfileRunCmd(
            id="epr-rt",
            hostElementId="w-1",
            hostEdge={"kind": "top"},
            profileFamilyId="cornice",
            offsetMm=_OFFSET,
            mode="sweep",
        ),
    )
    wire = doc.model_dump(by_alias=True)
    doc2 = Document.model_validate(wire)
    elem = doc2.elements["epr-rt"]
    assert isinstance(elem, EdgeProfileRunElem)
    assert elem.mode == "sweep"
    assert elem.host_element_id == "w-1"
    # host_edge is typed Any so round-trips as its serialised dict form
    assert elem.host_edge == {"kind": "top"}
