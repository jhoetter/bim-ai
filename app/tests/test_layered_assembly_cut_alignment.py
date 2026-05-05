"""Layered assembly vs cut-thickness alignment evidence (Prompt-6)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    FloorTypeElem,
    LevelElem,
    SectionCutElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)
from bim_ai.material_assembly_resolve import (
    collect_layered_assembly_cut_alignment_evidence_v0,
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
    hint = row["materialCutPatternHint"]
    assert hint["format"] == "sectionMaterialCutPatternHint_v0"
    assert hint["hostKind"] == "wall"
    assert hint["hostElementId"] == "w1"
    assert hint["patternToken"] == "structure+finish"
    assert hint["label"] == "structure / finish"


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
    hint = row["materialCutPatternHint"]
    assert hint["hostKind"] == "floor"
    assert hint["hostElementId"] == "fl"
    assert hint["patternToken"] == "mat-concrete-structure-v1+mat-epoxy-cleanroom-v1"
    assert hint["label"] == "Concrete structure / Epoxy cleanroom flooring"
