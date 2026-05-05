"""Layered assembly vs cut-thickness alignment evidence (Prompt-6)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    FloorTypeElem,
    LevelElem,
    RoofElem,
    RoofTypeElem,
    SectionCutElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)
from bim_ai.material_assembly_resolve import (
    collect_layered_assembly_cut_alignment_evidence_v0,
    collect_layered_assembly_witness_v0,
    layer_stack_cut_metrics_for_wall,
)
from bim_ai.section_projection_primitives import build_section_projection_primitives


def test_collect_alignment_evidence_includes_typed_multilayer_wall_when_thickness_matches() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(thicknessMm=100, layer_function="structure"),
                    WallTypeLayer(thicknessMm=50, layer_function="finish"),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=150,
                heightMm=2800,
                wallTypeId="wt",
            ),
        },
    )
    ev = collect_layered_assembly_cut_alignment_evidence_v0(doc)
    assert ev is not None
    assert ev["format"] == "layeredAssemblyCutAlignmentEvidence_v0"
    hosts = ev["hosts"]
    assert len(hosts) == 1
    row = hosts[0]
    assert row["hostElementId"] == "w1"
    assert row["hostKind"] == "wall"
    assert row["assemblyTypeId"] == "wt"
    assert row["layerCount"] == 2
    assert row["layerTotalThicknessMm"] == 150.0
    assert row["cutThicknessMm"] == 150.0
    assert row["layerStackMatchesCutThickness"] is True


def test_collect_alignment_evidence_excludes_untyped_wall() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    assert collect_layered_assembly_cut_alignment_evidence_v0(doc) is None


def test_layer_stack_cut_metrics_detects_thickness_mismatch() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(thicknessMm=100, layer_function="structure"),
                    WallTypeLayer(thicknessMm=50, layer_function="finish"),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                wallTypeId="wt",
            ),
        },
    )
    w = doc.elements["w1"]
    assert isinstance(w, WallElem)
    m = layer_stack_cut_metrics_for_wall(doc, w)
    assert m["layerTotalThicknessMm"] == 150.0
    assert m["cutThicknessMm"] == 200.0
    assert m["layerStackMatchesCutThickness"] is False

    ev = collect_layered_assembly_cut_alignment_evidence_v0(doc)
    assert ev is not None
    assert ev["hosts"][0]["layerStackMatchesCutThickness"] is False


def test_section_wall_row_includes_assembly_fields_for_typed_wall() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(thicknessMm=90, layer_function="structure"),
                    WallTypeLayer(thicknessMm=60, layer_function="finish"),
                ],
            ),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=150,
                heightMm=2800,
                wallTypeId="wt",
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-1",
                name="S",
                line_start_mm={"xMm": -1000, "yMm": 0},
                line_end_mm={"xMm": 6000, "yMm": 0},
                crop_depth_mm=8000,
            ),
        },
    )
    sec = doc.elements["sec"]
    assert isinstance(sec, SectionCutElem)
    prim, _w = build_section_projection_primitives(doc, sec)
    walls = prim.get("walls") or []
    assert len(walls) >= 1
    row = walls[0]
    assert row["elementId"] == "w1"
    assert row["assemblyLayerCount"] == 2
    assert row["assemblyLayerTotalThicknessMm"] == 150.0
    assert row["assemblyCutThicknessMm"] == 150.0
    assert row["assemblyLayerStackMatchesCutThickness"] is True
    wit = row.get("layerAssemblyWitness_v0") or {}
    assert wit.get("layerSource") == "type_stack"
    assert wit.get("skipReason") is None
    assert wit.get("layerSummaries") == [
        {"function": "structure", "materialKey": "", "thicknessMm": 90.0},
        {"function": "finish", "materialKey": "", "thicknessMm": 60.0},
    ]


def test_section_floor_row_includes_assembly_fields_for_typed_floor() -> None:
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
                        materialKey="mat-concrete-structure-v1",
                    ),
                    WallTypeLayer(
                        thicknessMm=40,
                        layer_function="finish",
                        materialKey="mat-epoxy-cleanroom-v1",
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
                    Vec2Mm(x_mm=6000, y_mm=0),
                    Vec2Mm(x_mm=6000, y_mm=4000),
                    Vec2Mm(x_mm=0, y_mm=4000),
                ],
                thickness_mm=200,
                floor_type_id="ft",
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-f",
                name="S",
                line_start_mm={"xMm": 3000, "yMm": -1000},
                line_end_mm={"xMm": 3000, "yMm": 5000},
                crop_depth_mm=8000,
            ),
        },
    )
    sec = doc.elements["sec"]
    assert isinstance(sec, SectionCutElem)
    prim, _w = build_section_projection_primitives(doc, sec)
    floors = prim.get("floors") or []
    assert len(floors) >= 1
    row = floors[0]
    assert row["elementId"] == "fl"
    assert row["assemblyLayerCount"] == 2
    assert row["assemblyLayerTotalThicknessMm"] == 200.0
    assert row["assemblyCutThicknessMm"] == 200.0
    assert row["assemblyLayerStackMatchesCutThickness"] is True
    wit = row.get("layerAssemblyWitness_v0") or {}
    assert wit.get("layerSource") == "type_stack"
    assert len(wit.get("layerSummaries") or []) == 2
    assert (wit.get("layerSummaries") or [{}])[0]["materialKey"] == "mat-concrete-structure-v1"


def test_collect_layered_assembly_witness_v0_stable_sort_floor_before_walls_alphabetical() -> None:
    wt = WallTypeElem(
        kind="wall_type",
        id="wt",
        name="WT",
        layers=[WallTypeLayer(thicknessMm=100, layer_function="structure")],
    )
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wt": wt,
            "w-z": WallElem(
                kind="wall",
                id="w-z",
                name="Wz",
                levelId="lvl",
                start={"xMm": 0, "yMm": 3000},
                end={"xMm": 6000, "yMm": 3000},
                thicknessMm=100,
                heightMm=2800,
                wallTypeId="wt",
            ),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="Wa",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=100,
                heightMm=2800,
                wallTypeId="wt",
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl-z",
                name="F",
                level_id="lvl",
                boundary_mm=[
                    Vec2Mm(x_mm=0, y_mm=4000),
                    Vec2Mm(x_mm=6000, y_mm=4000),
                    Vec2Mm(x_mm=6000, y_mm=5000),
                    Vec2Mm(x_mm=0, y_mm=5000),
                ],
                thickness_mm=150,
                floor_type_id=None,
            ),
        },
    )
    ev = collect_layered_assembly_witness_v0(doc)
    assert ev is not None
    hosts = ev["witnesses"]
    assert [str(r["hostKind"]) + ":" + str(r["hostElementId"]) for r in hosts] == [
        "floor:fl-z",
        "wall:w-a",
        "wall:w-z",
    ]


def test_collect_layered_assembly_witness_v0_untyped_wall_is_instance_fallback() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    ev = collect_layered_assembly_witness_v0(doc)
    assert ev is not None
    wit = ev["witnesses"][0]
    assert wit["hostElementId"] == "w1"
    assert wit["layerSource"] == "instance_fallback"
    assert wit["skipReason"] is None
    assert wit["layerSummaries"] == [
        {"function": "structure", "materialKey": "", "thicknessMm": 200.0},
    ]
    assert wit["layerStackMatchesCutThickness"] is True


def test_collect_layered_assembly_witness_v0_roof_without_type_has_skip_reason() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="R",
                reference_level_id="lvl",
                footprint_mm=[
                    Vec2Mm(x_mm=0, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=2000),
                    Vec2Mm(x_mm=0, y_mm=2000),
                ],
                roof_geometry_mode="mass_box",
            ),
        },
    )
    ev = collect_layered_assembly_witness_v0(doc)
    assert ev is not None
    row = ev["witnesses"][0]
    assert row["hostKind"] == "roof"
    assert row["layerSource"] == "none"
    assert row["skipReason"] == "roof_missing_roof_type_id"


def test_collect_layered_assembly_witness_v0_roof_type_without_layers_skip_reason() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "rt-empty": RoofTypeElem(kind="roof_type", id="rt-empty", name="E", layers=[]),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="R",
                reference_level_id="lvl",
                footprint_mm=[
                    Vec2Mm(x_mm=0, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=2000),
                    Vec2Mm(x_mm=0, y_mm=2000),
                ],
                roof_geometry_mode="mass_box",
                roof_type_id="rt-empty",
            ),
        },
    )
    ev = collect_layered_assembly_witness_v0(doc)
    assert ev is not None
    row = ev["witnesses"][0]
    assert row["layerSource"] == "none"
    assert row["skipReason"] == "roof_type_without_layers"


def test_section_roof_row_includes_layer_assembly_witness_for_typed_roof() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "rt": RoofTypeElem(
                kind="roof_type",
                id="rt",
                name="RT",
                layers=[
                    WallTypeLayer(thicknessMm=18, layer_function="structure"),
                    WallTypeLayer(thicknessMm=120, layer_function="insulation"),
                ],
            ),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="R",
                reference_level_id="lvl",
                footprint_mm=[
                    Vec2Mm(x_mm=0, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=0),
                    Vec2Mm(x_mm=2000, y_mm=2000),
                    Vec2Mm(x_mm=0, y_mm=2000),
                ],
                roof_geometry_mode="mass_box",
                roof_type_id="rt",
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-r",
                name="S",
                line_start_mm={"xMm": -500, "yMm": 1000},
                line_end_mm={"xMm": 2500, "yMm": 1000},
                crop_depth_mm=8000,
            ),
        },
    )
    sec = doc.elements["sec"]
    assert isinstance(sec, SectionCutElem)
    prim, _w = build_section_projection_primitives(doc, sec)
    roofs = prim.get("roofs") or []
    assert len(roofs) == 1
    rw = roofs[0]
    assert rw["elementId"] == "r1"
    wit = rw.get("layerAssemblyWitness_v0") or {}
    assert wit.get("layerSource") == "roof_type_stack"
    assert wit.get("skipReason") is None
    assert wit.get("cutProxyThicknessMm") is None
    assert wit.get("layerStackMatchesCutThickness") is None
    assert len(wit.get("layerSummaries") or []) == 2
    assert float((wit.get("layerSummaries") or [{}])[0]["thicknessMm"]) == 18.0
