"""updateElementProperty for roof type and geometry mode (Prompt-3)."""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    CreateRoofCmd,
    UpdateElementPropertyCmd,
    UpsertRoofTypeCmd,
    UpsertScheduleFiltersCmd,
)
from bim_ai.document import Document
from bim_ai.elements import LevelElem, RoofElem, ScheduleElem, Vec2Mm, WallTypeLayer
from bim_ai.engine import apply_inplace
from bim_ai.schedule_derivation import derive_schedule_table

_RECT = [
    Vec2Mm(x_mm=0, y_mm=0),
    Vec2Mm(x_mm=4000, y_mm=0),
    Vec2Mm(x_mm=4000, y_mm=3000),
    Vec2Mm(x_mm=0, y_mm=3000),
]

_L5 = [
    Vec2Mm(x_mm=0, y_mm=0),
    Vec2Mm(x_mm=4000, y_mm=0),
    Vec2Mm(x_mm=4000, y_mm=2000),
    Vec2Mm(x_mm=2000, y_mm=2000),
    Vec2Mm(x_mm=2000, y_mm=4000),
    Vec2Mm(x_mm=0, y_mm=4000),
]


def test_update_roof_roof_type_id_assigns_and_clears() -> None:
    doc = Document(revision=1, elements={"lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0)})
    apply_inplace(
        doc,
        UpsertRoofTypeCmd(
            type="upsertRoofType",
            id="rt-1",
            name="Deck",
            layers=[
                WallTypeLayer(thicknessMm=20, layer_function="structure", material_key="mat-osb-roof-deck-v1"),
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateRoofCmd(
            type="createRoof",
            id="r1",
            name="Roof",
            reference_level_id="lvl",
            footprint_mm=list(_RECT),
            roof_geometry_mode="mass_box",
        ),
    )
    r0 = doc.elements["r1"]
    assert isinstance(r0, RoofElem)
    assert r0.roof_type_id is None

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="r1", key="roofTypeId", value="rt-1"))
    r1 = doc.elements["r1"]
    assert isinstance(r1, RoofElem)
    assert r1.roof_type_id == "rt-1"

    apply_inplace(doc, UpdateElementPropertyCmd(elementId="r1", key="roofTypeId", value=""))
    r2 = doc.elements["r1"]
    assert isinstance(r2, RoofElem)
    assert r2.roof_type_id is None


def test_update_roof_roof_type_id_rejects_non_type() -> None:
    doc = Document(revision=1, elements={"lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0)})
    apply_inplace(
        doc,
        CreateRoofCmd(
            type="createRoof",
            id="r1",
            name="Roof",
            reference_level_id="lvl",
            footprint_mm=list(_RECT),
        ),
    )
    with pytest.raises(ValueError, match="roofTypeId must reference"):
        apply_inplace(doc, UpdateElementPropertyCmd(elementId="r1", key="roofTypeId", value="x"))


def test_update_roof_geometry_mode_gable_requires_rectangle_footprint() -> None:
    doc = Document(revision=1, elements={"lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0)})
    apply_inplace(
        doc,
        CreateRoofCmd(
            type="createRoof",
            id="r1",
            name="Roof",
            reference_level_id="lvl",
            footprint_mm=list(_L5),
            roof_geometry_mode="mass_box",
        ),
    )
    with pytest.raises(ValueError, match="axis-aligned rectangle"):
        apply_inplace(
            doc,
            UpdateElementPropertyCmd(
                elementId="r1",
                key="roofGeometryMode",
                value="gable_pitched_rectangle",
            ),
        )


def test_update_roof_roof_type_id_material_assembly_schedule_preserved() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "sch-mat": ScheduleElem(kind="schedule", id="sch-mat", name="Materials"),
        },
    )
    apply_inplace(
        doc,
        UpsertRoofTypeCmd(
            type="upsertRoofType",
            id="rt-1",
            name="Warm deck",
            layers=[
                WallTypeLayer(
                    thicknessMm=22,
                    layer_function="structure",
                    material_key="mat-osb-roof-deck-v1",
                ),
                WallTypeLayer(
                    thicknessMm=140,
                    layer_function="insulation",
                    material_key="mat-insulation-roof-board-v1",
                ),
            ],
        ),
    )
    apply_inplace(
        doc,
        CreateRoofCmd(
            type="createRoof",
            id="r1",
            name="Roof",
            reference_level_id="lvl",
            footprint_mm=list(_RECT),
            roof_geometry_mode="mass_box",
        ),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="r1", key="roofTypeId", value="rt-1"),
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            type="upsertScheduleFilters",
            schedule_id="sch-mat",
            filters={"category": "material_assembly"},
            grouping=None,
        ),
    )
    table = derive_schedule_table(doc, "sch-mat")
    roof_rows = [r for r in table["rows"] if r.get("hostKind") == "roof"]
    assert len(roof_rows) == 2
    assert all(r.get("hostElementId") == "r1" for r in roof_rows)
    fp_m2 = 4.0 * 3.0
    r0 = next(r for r in roof_rows if r["layerIndex"] == 0)
    assert abs(float(r0["grossVolumeM3"]) - fp_m2 * 0.022) < 1e-8


def test_update_roof_geometry_mode_to_gable_ok_for_rectangle() -> None:
    doc = Document(revision=1, elements={"lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0)})
    apply_inplace(
        doc,
        CreateRoofCmd(
            type="createRoof",
            id="r1",
            name="Roof",
            reference_level_id="lvl",
            footprint_mm=list(_RECT),
            roof_geometry_mode="mass_box",
        ),
    )
    apply_inplace(
        doc,
        UpdateElementPropertyCmd(
            elementId="r1",
            key="roofGeometryMode",
            value="gable_pitched_rectangle",
        ),
    )
    r = doc.elements["r1"]
    assert isinstance(r, RoofElem)
    assert r.roof_geometry_mode == "gable_pitched_rectangle"
