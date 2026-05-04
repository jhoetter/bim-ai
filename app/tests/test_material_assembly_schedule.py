"""Material assembly schedules, type propagation (prompt-4 slice)."""

from __future__ import annotations

from bim_ai.commands import (
    CreateFloorCmd,
    UpsertFloorTypeCmd,
    UpsertScheduleFiltersCmd,
    UpsertWallTypeCmd,
)
from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    FloorTypeElem,
    LevelElem,
    ScheduleElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)
from bim_ai.engine import apply_inplace
from bim_ai.schedule_derivation import derive_schedule_table


def test_upsert_wall_type_propagates_instance_thickness():
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="T",
                layers=[
                    WallTypeLayer(thicknessMm=100, layer_function="structure"),
                    WallTypeLayer(thicknessMm=50, layer_function="finish"),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                level_id="lvl",
                start=Vec2Mm(x_mm=0, y_mm=0),
                end=Vec2Mm(x_mm=4000, y_mm=0),
                thickness_mm=999,
                height_mm=2800,
                wall_type_id="wt",
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertWallTypeCmd(
            type="upsertWallType",
            id="wt",
            name="T2",
            layers=[
                WallTypeLayer(thicknessMm=120, layer_function="structure"),
                WallTypeLayer(thicknessMm=30, layer_function="finish"),
                WallTypeLayer(thicknessMm=20, layer_function="insulation"),
            ],
        ),
    )
    w = doc.elements["w1"]
    assert isinstance(w, WallElem)
    assert w.thickness_mm == 170


def test_upsert_floor_type_propagates_slab_dims():
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "ft": FloorTypeElem(
                kind="floor_type",
                id="ft",
                name="FT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=160,
                        layer_function="structure",
                        material_key="mat-concrete-structure-v1",
                    ),
                    WallTypeLayer(
                        thicknessMm=40,
                        layer_function="finish",
                        material_key="mat-epoxy-cleanroom-v1",
                    ),
                ],
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                level_id="lvl",
                boundary_mm=[
                    Vec2Mm(x_mm=0, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=1000),
                    Vec2Mm(x_mm=0, y_mm=1000),
                ],
                thickness_mm=1,
                structure_thickness_mm=1,
                finish_thickness_mm=1,
                floor_type_id="ft",
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertFloorTypeCmd(
            type="upsertFloorType",
            id="ft",
            name="FT2",
            layers=[
                WallTypeLayer(thicknessMm=180, layer_function="structure"),
                WallTypeLayer(thicknessMm=50, layer_function="finish"),
            ],
        ),
    )
    fl = doc.elements["fl"]
    assert isinstance(fl, FloorElem)
    assert fl.thickness_mm == 230
    assert fl.structure_thickness_mm == 180
    assert fl.finish_thickness_mm == 50


def test_material_assembly_schedule_quantities():
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=100,
                        layer_function="structure",
                        material_key="mat-concrete-structure-v1",
                    ),
                    WallTypeLayer(
                        thicknessMm=50,
                        layer_function="finish",
                        material_key="mat-gwb-finish-v1",
                    ),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                level_id="lvl",
                start=Vec2Mm(x_mm=0, y_mm=0),
                end=Vec2Mm(x_mm=3000, y_mm=0),
                thickness_mm=150,
                height_mm=2800,
                wall_type_id="wt",
            ),
            "ft": FloorTypeElem(
                kind="floor_type",
                id="ft",
                name="FT",
                layers=[
                    WallTypeLayer(thicknessMm=100, layer_function="structure"),
                    WallTypeLayer(thicknessMm=40, layer_function="finish"),
                ],
            ),
            "sch-mat": ScheduleElem(kind="schedule", id="sch-mat", name="Materials"),
        },
    )
    apply_inplace(
        doc,
        CreateFloorCmd(
            type="createFloor",
            id="fl1",
            name="Slab",
            level_id="lvl",
            boundary_mm=[
                Vec2Mm(x_mm=0, y_mm=0),
                Vec2Mm(x_mm=2000, y_mm=0),
                Vec2Mm(x_mm=2000, y_mm=1000),
                Vec2Mm(x_mm=0, y_mm=1000),
            ],
            floor_type_id="ft",
            thickness_mm=999,
            structure_thickness_mm=999,
            finish_thickness_mm=999,
        ),
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
    rows = table["rows"]
    assert table["category"] == "material_assembly"
    wall_rows = [r for r in rows if r.get("hostKind") == "wall"]
    floor_rows = [r for r in rows if r.get("hostKind") == "floor"]
    assert len(wall_rows) == 2
    assert len(floor_rows) == 2

    face_m2 = 3.0 * 2.8
    w_struct = next(r for r in wall_rows if r["layerIndex"] == 0)
    assert abs(float(w_struct["grossAreaM2"]) - face_m2) < 1e-5
    vol_struct = face_m2 * 0.1
    assert abs(float(w_struct["grossVolumeM3"]) - vol_struct) < 1e-8

    slab_m2 = 2.0 * 1.0
    fl0 = next(r for r in floor_rows if r["layerIndex"] == 0)
    assert abs(float(fl0["grossAreaM2"]) - slab_m2) < 1e-5
    assert abs(float(fl0["grossVolumeM3"]) - slab_m2 * 0.1) < 1e-8

    w0 = next(r for r in wall_rows if r["layerIndex"] == 0)
    w1 = next(r for r in wall_rows if r["layerIndex"] == 1)
    assert float(w0["assemblyTotalThicknessMm"]) == 150.0
    assert float(w0["layerOffsetFromExteriorMm"]) == 0.0
    assert float(w1["assemblyTotalThicknessMm"]) == 150.0
    assert float(w1["layerOffsetFromExteriorMm"]) == 100.0

    f0 = next(r for r in floor_rows if r["layerIndex"] == 0)
    f1 = next(r for r in floor_rows if r["layerIndex"] == 1)
    assert float(f0["assemblyTotalThicknessMm"]) == 140.0
    assert float(f0["layerOffsetFromExteriorMm"]) == 0.0
    assert float(f1["assemblyTotalThicknessMm"]) == 140.0
    assert float(f1["layerOffsetFromExteriorMm"]) == 100.0
