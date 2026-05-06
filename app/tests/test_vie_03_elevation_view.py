"""VIE-03 — first-class elevation_view kind + section-line derivation."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import ElevationViewElem, LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit_bundle
from bim_ai.section_projection_primitives import elevation_view_to_section_cut


def _seed_with_box() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
            "w-N": WallElem(
                kind="wall",
                id="w-N",
                name="N",
                levelId="lvl-1",
                start=Vec2Mm(xMm=0, yMm=10000),
                end=Vec2Mm(xMm=8000, yMm=10000),
                thicknessMm=200,
                heightMm=2800,
            ),
            "w-S": WallElem(
                kind="wall",
                id="w-S",
                name="S",
                levelId="lvl-1",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=8000, yMm=0),
                thicknessMm=200,
                heightMm=2800,
            ),
            "w-E": WallElem(
                kind="wall",
                id="w-E",
                name="E",
                levelId="lvl-1",
                start=Vec2Mm(xMm=8000, yMm=0),
                end=Vec2Mm(xMm=8000, yMm=10000),
                thicknessMm=200,
                heightMm=2800,
            ),
            "w-W": WallElem(
                kind="wall",
                id="w-W",
                name="W",
                levelId="lvl-1",
                start=Vec2Mm(xMm=0, yMm=0),
                end=Vec2Mm(xMm=0, yMm=10000),
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )


def test_create_elevation_view_default_north():
    doc = _seed_with_box()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createElevationView",
                "id": "elev-N",
                "name": "North Elevation",
                "direction": "north",
            }
        ],
    )
    assert ok is True and nd is not None
    ev = nd.elements["elev-N"]
    assert isinstance(ev, ElevationViewElem)
    assert ev.direction == "north"
    assert ev.name == "North Elevation"


def test_custom_direction_requires_angle():
    doc = _seed_with_box()
    with pytest.raises(ValueError, match="customAngleDeg required"):
        try_commit_bundle(
            doc,
            [
                {
                    "type": "createElevationView",
                    "id": "elev-X",
                    "name": "Oblique",
                    "direction": "custom",
                }
            ],
        )


def test_elevation_to_section_cut_north_lies_above_box():
    doc = _seed_with_box()
    ev = ElevationViewElem(
        kind="elevation_view", id="elev-N", name="North", direction="north"
    )
    sec = elevation_view_to_section_cut(doc, ev, margin_mm=2000.0)
    # The bounding box top is y=10000; the section line should sit above it.
    assert sec.line_start_mm.y_mm == sec.line_end_mm.y_mm
    assert sec.line_start_mm.y_mm > 10000
    # And it should span at least the box width (0..8000).
    xs = sorted([sec.line_start_mm.x_mm, sec.line_end_mm.x_mm])
    assert xs[0] <= 0
    assert xs[1] >= 8000


def test_elevation_to_section_cut_east_runs_north_south():
    doc = _seed_with_box()
    ev = ElevationViewElem(
        kind="elevation_view", id="elev-E", name="East", direction="east"
    )
    sec = elevation_view_to_section_cut(doc, ev, margin_mm=1500.0)
    assert sec.line_start_mm.x_mm == sec.line_end_mm.x_mm
    assert sec.line_start_mm.x_mm > 8000


def test_elevation_to_section_cut_falls_back_with_empty_doc():
    empty = Document(revision=1, elements={})
    ev = ElevationViewElem(
        kind="elevation_view", id="ev", name="Empty", direction="north"
    )
    sec = elevation_view_to_section_cut(empty, ev)
    # No crash, sensible defaults.
    assert sec.line_start_mm.y_mm == sec.line_end_mm.y_mm
