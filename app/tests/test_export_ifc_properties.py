from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    BeamElem,
    CeilingElem,
    ColumnElem,
    LevelElem,
    RailingElem,
    StairElem,
    Vec2Mm,
)
from bim_ai.export_ifc_properties import (
    beam_common_pset_properties,
    ceiling_common_pset_properties,
    column_common_pset_properties,
    railing_common_pset_properties,
    stair_common_pset_properties,
)


def test_stair_common_pset_properties_use_level_rise() -> None:
    stair = StairElem(
        id="st-1",
        baseLevelId="lvl-0",
        topLevelId="lvl-1",
        runStartMm=Vec2Mm(xMm=0, yMm=0),
        runEndMm=Vec2Mm(xMm=5000, yMm=0),
        riserMm=175,
        treadMm=280,
    )
    doc = Document(
        elements={
            "lvl-0": LevelElem(id="lvl-0", elevationMm=0),
            "lvl-1": LevelElem(id="lvl-1", elevationMm=3150),
        }
    )

    assert stair_common_pset_properties(stair, doc) == {
        "NumberOfRiser": 18,
        "NumberOfTreads": 17,
        "RiserHeight": 0.175,
        "TreadLength": 0.28,
    }


def test_structural_common_pset_properties_are_stable() -> None:
    column = ColumnElem(
        id="col-1",
        levelId="lvl-0",
        positionMm=Vec2Mm(xMm=1000, yMm=2000),
    )
    beam = BeamElem(
        id="beam-1",
        levelId="lvl-0",
        startMm=Vec2Mm(xMm=0, yMm=0),
        endMm=Vec2Mm(xMm=3000, yMm=4000),
    )

    assert column_common_pset_properties(column) == {
        "Reference": "col-1",
        "LoadBearing": True,
        "IsExternal": False,
    }
    assert beam_common_pset_properties(beam) == {
        "Reference": "beam-1",
        "Span": pytest.approx(5.0),
        "LoadBearing": True,
        "IsExternal": False,
    }


def test_finish_and_railing_common_pset_properties_are_stable() -> None:
    ceiling = CeilingElem(
        id="ceil-1",
        levelId="lvl-0",
        boundaryMm=[
            Vec2Mm(xMm=0, yMm=0),
            Vec2Mm(xMm=1000, yMm=0),
            Vec2Mm(xMm=1000, yMm=1000),
        ],
    )
    railing = RailingElem(
        id="rail-1",
        pathMm=[Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=1000, yMm=0)],
        guardHeightMm=1100,
    )

    assert ceiling_common_pset_properties(ceiling) == {
        "Reference": "ceil-1",
        "IsExternal": False,
    }
    assert railing_common_pset_properties(railing) == {
        "Reference": "rail-1",
        "Height": 1.1,
        "IsExternal": False,
    }
