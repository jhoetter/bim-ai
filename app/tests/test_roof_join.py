"""KRN-V3-03 G11 — CreateRoofJoin engine dispatch tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateLevelCmd, CreateRoofCmd, CreateRoofJoinCmd
from bim_ai.document import Document
from bim_ai.elements import RoofJoinElem
from bim_ai.engine import apply_inplace

_FP_A = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 8000, "yMm": 0},
    {"xMm": 8000, "yMm": 6000},
    {"xMm": 0, "yMm": 6000},
]

_FP_B = [
    {"xMm": 6000, "yMm": 4000},
    {"xMm": 12000, "yMm": 4000},
    {"xMm": 12000, "yMm": 10000},
    {"xMm": 6000, "yMm": 10000},
]

_FP_C = [
    {"xMm": 20000, "yMm": 20000},
    {"xMm": 26000, "yMm": 20000},
    {"xMm": 26000, "yMm": 26000},
    {"xMm": 20000, "yMm": 26000},
]


def _base_doc() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="r-a",
            name="Roof A",
            referenceLevelId="lvl",
            footprintMm=_FP_A,
            slopeDeg=25.0,
            roofGeometryMode="gable_pitched_rectangle",
        ),
    )
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="r-b",
            name="Roof B",
            referenceLevelId="lvl",
            footprintMm=_FP_B,
            slopeDeg=25.0,
            roofGeometryMode="gable_pitched_rectangle",
        ),
    )
    return doc


def test_roof_join_happy_path_emits_elem() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateRoofJoinCmd(
            id="j-1",
            primaryRoofId="r-a",
            secondaryRoofId="r-b",
            seamMode="clip_secondary_into_primary",
        ),
    )
    elem = doc.elements["j-1"]
    assert isinstance(elem, RoofJoinElem)
    assert elem.primary_roof_id == "r-a"
    assert elem.secondary_roof_id == "r-b"
    assert elem.seam_mode == "clip_secondary_into_primary"


def test_roof_join_merge_at_ridge_roundtrips() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateRoofJoinCmd(
            id="j-2",
            primaryRoofId="r-a",
            secondaryRoofId="r-b",
            seamMode="merge_at_ridge",
        ),
    )
    elem = doc.elements["j-2"]
    assert isinstance(elem, RoofJoinElem)
    assert elem.seam_mode == "merge_at_ridge"


def test_roof_join_auto_id_generated() -> None:
    doc = _base_doc()
    before = set(doc.elements.keys())
    apply_inplace(
        doc,
        CreateRoofJoinCmd(
            primaryRoofId="r-a",
            secondaryRoofId="r-b",
        ),
    )
    new_ids = set(doc.elements.keys()) - before
    assert len(new_ids) == 1
    assert isinstance(doc.elements[next(iter(new_ids))], RoofJoinElem)


def test_roof_join_rejects_same_primary_and_secondary() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="must differ"):
        apply_inplace(
            doc,
            CreateRoofJoinCmd(
                primaryRoofId="r-a",
                secondaryRoofId="r-a",
            ),
        )


def test_roof_join_rejects_missing_primary() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="primaryRoofId"):
        apply_inplace(
            doc,
            CreateRoofJoinCmd(
                primaryRoofId="no-such",
                secondaryRoofId="r-b",
            ),
        )


def test_roof_join_rejects_missing_secondary() -> None:
    doc = _base_doc()
    with pytest.raises(ValueError, match="secondaryRoofId"):
        apply_inplace(
            doc,
            CreateRoofJoinCmd(
                primaryRoofId="r-a",
                secondaryRoofId="no-such",
            ),
        )


def test_roof_join_rejects_non_intersecting_footprints() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="r-c",
            name="Roof C",
            referenceLevelId="lvl",
            footprintMm=_FP_C,
            slopeDeg=25.0,
            roofGeometryMode="gable_pitched_rectangle",
        ),
    )
    with pytest.raises(ValueError, match="do not intersect"):
        apply_inplace(
            doc,
            CreateRoofJoinCmd(
                primaryRoofId="r-a",
                secondaryRoofId="r-c",
            ),
        )


def test_roof_join_rejects_duplicate_id() -> None:
    doc = _base_doc()
    apply_inplace(
        doc,
        CreateRoofJoinCmd(
            id="j-dup",
            primaryRoofId="r-a",
            secondaryRoofId="r-b",
        ),
    )
    with pytest.raises(ValueError, match="duplicate element id"):
        apply_inplace(
            doc,
            CreateRoofJoinCmd(
                id="j-dup",
                primaryRoofId="r-a",
                secondaryRoofId="r-b",
            ),
        )
