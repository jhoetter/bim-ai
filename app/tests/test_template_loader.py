"""VIE-06: project template loader + residential-eu template instantiation."""

from __future__ import annotations

import pytest

from bim_ai.elements import (
    GridLineElem,
    InternalOriginElem,
    LevelElem,
    PlanViewElem,
    ProjectBasePointElem,
    Text3dElem,
)
from bim_ai.template_loader import (
    list_templates,
    load_template_snapshot,
    template_exists,
)


def test_list_templates_includes_residential_eu():
    rows = list_templates()
    ids = {t.id for t in rows}
    assert "residential-eu" in ids
    eu = next(t for t in rows if t.id == "residential-eu")
    assert eu.name
    assert eu.description


def test_template_exists_smoke():
    assert template_exists("residential-eu") is True
    assert template_exists("does-not-exist") is False


def test_load_residential_eu_snapshot():
    doc = load_template_snapshot("residential-eu")
    els = doc.elements

    # Three levels at the prescribed elevations.
    levels = [e for e in els.values() if isinstance(e, LevelElem)]
    assert len(levels) == 3
    by_name = {l.name: l for l in levels}
    assert by_name["Ground Floor"].elevation_mm == 0
    assert by_name["First Floor"].elevation_mm == 3000
    assert by_name["Roof"].elevation_mm == 6000

    # Plan view per level.
    plan_views = [e for e in els.values() if isinstance(e, PlanViewElem)]
    assert len(plan_views) == 3

    # 6 grid lines (3 vertical 1/2/3 + 3 horizontal A/B/C).
    grid_lines = [e for e in els.values() if isinstance(e, GridLineElem)]
    assert len(grid_lines) == 6
    labels = {g.label for g in grid_lines}
    assert labels == {"1", "2", "3", "A", "B", "C"}

    # Project base point at origin.
    pbps = [e for e in els.values() if isinstance(e, ProjectBasePointElem)]
    assert len(pbps) == 1
    assert pbps[0].position_mm.x_mm == 0
    assert pbps[0].position_mm.y_mm == 0
    assert pbps[0].position_mm.z_mm == 0

    # Internal origin singleton.
    origins = [e for e in els.values() if isinstance(e, InternalOriginElem)]
    assert len(origins) == 1

    # Sample text_3d label.
    texts = [e for e in els.values() if isinstance(e, Text3dElem)]
    assert len(texts) == 1
    assert texts[0].text == "Kerala House"
    assert texts[0].font_family == "helvetiker"


def test_load_template_unknown_raises():
    with pytest.raises(FileNotFoundError):
        load_template_snapshot("unknown-template-xyz")


def test_grid_spacing_4000mm_in_residential_eu():
    """Vertical grids at 0/4000/8000 X; horizontal at 0/4000/8000 Y."""
    doc = load_template_snapshot("residential-eu")
    grids = [e for e in doc.elements.values() if isinstance(e, GridLineElem)]

    vertical_x = sorted(g.start.x_mm for g in grids if g.label in {"1", "2", "3"})
    horizontal_y = sorted(g.start.y_mm for g in grids if g.label in {"A", "B", "C"})
    assert vertical_x == [0.0, 4000.0, 8000.0]
    assert horizontal_y == [0.0, 4000.0, 8000.0]
