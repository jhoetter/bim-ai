"""Pitched gable roof slice: replay validation, section evidence, glTF + manifest."""

from __future__ import annotations

import math

import pytest

from bim_ai.commands import CreateLevelCmd, CreateRoofCmd
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    PlanViewElem,
    RoofElem,
    RoofTypeElem,
    SectionCutElem,
    WallTypeLayer,
)
from bim_ai.engine import apply_inplace
from bim_ai.export_gltf import document_to_gltf, export_manifest_extension_payload
from bim_ai.plan_projection_wire import resolve_plan_projection_wire
from bim_ai.section_projection_primitives import build_section_projection_primitives

_RECT_FP = (
    {"xMm": 0, "yMm": 0},
    {"xMm": 6000, "yMm": 0},
    {"xMm": 6000, "yMm": 4000},
    {"xMm": 0, "yMm": 4000},
)


def test_replay_create_roof_gable_persists_geometry_mode() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoofCmd(
            id="r-gable",
            name="Roof",
            reference_level_id="lvl",
            footprint_mm=[dict(xMm=p["xMm"], yMm=p["yMm"]) for p in _RECT_FP],
            slope_deg=30.0,
            roof_geometry_mode="gable_pitched_rectangle",
        ),
    )
    r = doc.elements["r-gable"]
    assert isinstance(r, RoofElem)
    assert r.roof_geometry_mode == "gable_pitched_rectangle"


def test_create_roof_gable_rejects_non_rectangle_footprint() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl", name="G", elevationMm=0))
    bad_vertices = [{"xMm": 0, "yMm": 0}, {"xMm": 3000, "yMm": 0}, {"xMm": 1500, "yMm": 2000}]
    with pytest.raises(ValueError, match="exactly 4 vertices"):
        apply_inplace(
            doc,
            CreateRoofCmd(
                reference_level_id="lvl",
                footprint_mm=bad_vertices,
                roof_geometry_mode="gable_pitched_rectangle",
            ),
        )


def test_section_roof_primitive_gable_carries_pitch_fields() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2600),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="R",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                overhang_mm=400,
                slope_deg=35,
                roof_geometry_mode="gable_pitched_rectangle",
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-1",
                name="Sec",
                line_start_mm={"xMm": 500, "yMm": 2000},
                line_end_mm={"xMm": 5500, "yMm": 2000},
                crop_depth_mm=6000,
            ),
        },
    )
    prim, _w = build_section_projection_primitives(doc, doc.elements["sec"])
    assert len(prim["roofs"]) == 1
    row = prim["roofs"][0]
    assert row["proxyKind"] == "gablePitchedRectangleChord"
    assert row["roofGeometryMode"] == "gable_pitched_rectangle"
    assert row["ridgeAxisPlan"] in {"alongX", "alongZ"}
    assert pytest.approx(row["slopeDeg"], rel=1e-6) == 35
    assert row["layerStackSkipReason"] == "roof_missing_roof_type_id"
    assert row["roofFasciaEdgePlanToken"] == (
        "eaveParallelPlanZ_gableRakeParallelPlanX"
        if row["ridgeAxisPlan"] == "alongZ"
        else "eaveParallelPlanX_gableRakeParallelPlanZ"
    )
    assert row["roofGeometrySupportToken"] == "gable_pitched_rectangle_supported"
    assert row["roofPlanGeometryReadout_v0"] == "gable_projection_supported"
    assert row["roofLayeredPrismWitnessSkipReason_v0"] == "roof_missing_roof_type_id"
    scw = row["roofSectionCutWitness_v0"]
    assert scw["format"] == "roofSectionCutWitness_v0"
    assert scw["sectionCutIntersectsRoofFootprintStrip"] is True
    assert scw["sectionProfileToken_v0"] == "gableLayeredPrismChord_partial_v1"
    assert scw["roofSectionCutSupportToken_v0"] == "skipped_prism_roof_missing_roof_type_id"
    assert scw["layerReadouts"] == []


SHARED_GABLE_EVIDENCE_KEYS = (
    "roofGeometryMode",
    "ridgeAxisPlan",
    "slopeDeg",
    "overhangMm",
    "planSpanXmMm",
    "planSpanZmMm",
    "ridgeRiseMm",
    "ridgeZMm",
    "eavePlateZMm",
    "proxyKind",
    "layerStackSkipReason",
    "roofFasciaEdgePlanToken",
    "roofGeometrySupportToken",
    "roofPlanGeometryReadout_v0",
)


def test_plan_wire_gable_roof_geometry_matches_section_primitives_overlap() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2600),
            "pv": PlanViewElem(kind="plan_view", id="pv-roof-t", name="P", levelId="lvl"),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="R",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                overhang_mm=400,
                slope_deg=35,
                roof_geometry_mode="gable_pitched_rectangle",
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-1",
                name="Sec",
                line_start_mm={"xMm": 500, "yMm": 2000},
                line_end_mm={"xMm": 5500, "yMm": 2000},
                crop_depth_mm=6000,
            ),
        },
    )
    pw = resolve_plan_projection_wire(doc, plan_view_id="pv-roof-t", fallback_level_id="lvl")
    prim_pw = pw.get("primitives") or {}
    plan_roofs = prim_pw.get("roofs") or []
    assert len(plan_roofs) == 1
    plan_row = plan_roofs[0]
    sec_prim, _w = build_section_projection_primitives(doc, doc.elements["sec"])
    sec_row = (sec_prim.get("roofs") or [])[0]
    assert (
        plan_row["roofPlanGeometryReadout_v0"]
        == sec_row["roofPlanGeometryReadout_v0"]
        == "gable_projection_supported"
    )
    for k in SHARED_GABLE_EVIDENCE_KEYS:
        p_v, s_v = plan_row[k], sec_row[k]
        if isinstance(p_v, str):
            assert p_v == s_v
        else:
            assert pytest.approx(float(p_v), rel=1e-9, abs=1e-6) == float(s_v), k
    assert (
        plan_row["roofLayeredPrismWitnessSkipReason_v0"]
        == sec_row["roofLayeredPrismWitnessSkipReason_v0"]
        == "roof_missing_roof_type_id"
    )


def test_plan_wire_mass_box_roof_z_mid_matches_section_primitive() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="OG", elevationMm=2800),
            "pv": PlanViewElem(kind="plan_view", id="pv-r2", name="P", levelId="lvl"),
            "roof-m": RoofElem(
                kind="roof",
                id="roof-m",
                name="R",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                slope_deg=31,
                overhang_mm=350,
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-m",
                name="Sec",
                line_start_mm={"xMm": 500, "yMm": 2000},
                line_end_mm={"xMm": 5500, "yMm": 2000},
                crop_depth_mm=6000,
            ),
        },
    )
    pw = resolve_plan_projection_wire(doc, plan_view_id="pv-r2", fallback_level_id="lvl")
    plan_row = (pw.get("primitives") or {}).get("roofs") or []
    assert len(plan_row) == 1
    pr = plan_row[0]
    sec_prim, _w = build_section_projection_primitives(doc, doc.elements["sec"])
    sr = (sec_prim.get("roofs") or [])[0]
    mass_keys = (
        "roofGeometryMode",
        "slopeDeg",
        "overhangMm",
        "zMidMm",
        "proxyKind",
        "layerStackSkipReason",
        "roofPlanGeometryReadout_v0",
    )
    for k in mass_keys:
        p_v, s_v = pr[k], sr[k]
        if isinstance(p_v, str):
            assert p_v == s_v
        else:
            assert pytest.approx(float(p_v), rel=1e-9, abs=1e-6) == float(s_v), k
    assert "roofGeometrySupportToken" not in pr
    assert "roofGeometrySupportToken" not in sr
    assert pr["roofLayeredPrismWitnessSkipReason_v0"] == sr["roofLayeredPrismWitnessSkipReason_v0"]
    sr_scw = sr["roofSectionCutWitness_v0"]
    assert sr_scw["sectionProfileToken_v0"] == "footprintChord_skipLayeredPrism_v1"
    assert (
        sr_scw["roofSectionCutSupportToken_v0"]
        == "skipped_prism_skipped_not_gable_elevation_supported_v1"
    )
    assert sr_scw["layerReadouts"] == []


def test_gltf_manifest_and_mesh_differs_from_mass_box_for_gable_roof() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2600),
            "rt-shingle": RoofTypeElem(kind="roof_type", id="rt-shingle", name="Asphalt"),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="Roof",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                slope_deg=32,
                roof_geometry_mode="gable_pitched_rectangle",
                roof_type_id="rt-shingle",
            ),
        },
    )
    g = document_to_gltf(doc)
    ext = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["meshEncoding"] == (
        "bim_ai_box_primitive_v0+bim_ai_gable_roof_v0+bim_ai_roof_geometry_evidence_v1"
        "+bim_ai_layered_assembly_witness_v0"
    )
    assert "+bim_ai_roof_layered_prism_witness_v1" not in ext["meshEncoding"]
    ev = ext.get("roofGeometryEvidence_v1")
    assert ev is not None and ev.get("format") == "roofGeometryEvidence_v1"
    assert len(ev["roofs"]) == 1
    row = ev["roofs"][0]
    assert row["roofTopologyToken"] == "gable"
    assert row["footprintVertexCount"] == 4
    assert row["footprintPlanWinding"] == "ccw"
    assert row["roofTypeId"] == "rt-shingle"
    assert row["roofTypeName"] == "Asphalt"
    assert row["ridgeAxisPlan"] == "alongZ"
    assert row["ridgeSegmentPlanMm"] == [[3000.0, 0.0], [3000.0, 4000.0]]
    rise_expect = 3000.0 * math.tan(math.radians(32.0))
    assert pytest.approx(row["ridgeRiseMm"], rel=1e-6) == rise_expect
    assert pytest.approx(row["ridgeZMm"], rel=1e-6) == 2600.0 + rise_expect
    assert row["layerStackSkipReason"] == "roof_type_without_layers"
    assert row["roofFasciaEdgePlanToken"] == "eaveParallelPlanZ_gableRakeParallelPlanX"
    assert row["roofGeometrySupportToken"] == "gable_pitched_rectangle_supported"
    assert row["roofPlanGeometryReadout_v0"] == "gable_projection_supported"
    assert row["roofLayeredPrismWitnessSkipReason_v0"] == "roof_type_without_layers"
    assert "roofLayeredPrismWitness_v1" not in row
    assert "layerStackCount" not in row
    roof_mesh = next(m for m in g["meshes"] if m["name"] == "roof:r1")
    pos_ix = roof_mesh["primitives"][0]["attributes"]["POSITION"]
    pos_acc = g["accessors"][pos_ix]
    assert pos_acc["count"] == 18
    node = next(n for n in g["nodes"] if n.get("name") == "roof:r1")
    nx = node.get("extras") or {}
    assert nx.get("bimAiRoofGeometryEvidence_v1") == row


def test_gltf_mass_box_roof_has_base_mesh_encoding_only() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="OG", elevationMm=2800),
            "roof-1": RoofElem(
                kind="roof",
                id="roof-1",
                name="Roof",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                slope_deg=28,
            ),
        },
    )
    g = document_to_gltf(doc)
    ext = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["meshEncoding"] == (
        "bim_ai_box_primitive_v0+bim_ai_roof_geometry_evidence_v1+bim_ai_layered_assembly_witness_v0"
    )
    ev = ext.get("roofGeometryEvidence_v1")
    assert ev is not None and ev.get("format") == "roofGeometryEvidence_v1"
    mb = ev["roofs"][0]
    assert mb["roofTopologyToken"] == "mass_box_proxy"
    assert mb["ridgeInferable"] is False
    assert mb["layerStackSkipReason"] == "roof_missing_roof_type_id"
    assert mb["roofPlanGeometryReadout_v0"] == "mass_box_peak_proxy"
    assert "ridgeSegmentPlanMm" not in mb
    assert "roofGeometrySupportToken" not in mb
    roof_mesh = next(m for m in g["meshes"] if m["name"] == "roof:roof-1")
    pos_ix = roof_mesh["primitives"][0]["attributes"]["POSITION"]
    assert g["accessors"][pos_ix]["count"] == 36


def test_mass_box_hex_footprint_emits_hip_candidate_deferred_token() -> None:
    cx_m = 5000.0
    cz_m = 5000.0
    r_mm = 2500.0
    hex_fp: list[dict[str, float]] = []
    for i in range(6):
        ang = (math.pi / 3.0) * float(i) - math.pi / 6.0
        hex_fp.append(
            {
                "xMm": round(cx_m + r_mm * math.cos(ang), 6),
                "yMm": round(cz_m + r_mm * math.sin(ang), 6),
            }
        )
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2400),
            "r-hex": RoofElem(
                kind="roof",
                id="r-hex",
                name="Hip-ish",
                reference_level_id="lvl",
                footprint_mm=hex_fp,
                slope_deg=30.0,
                roof_geometry_mode="mass_box",
            ),
        },
    )
    g = document_to_gltf(doc)
    row = g["extensions"]["BIM_AI_exportManifest_v0"]["roofGeometryEvidence_v1"]["roofs"][0]
    assert row["roofGeometrySupportToken"] == "hip_candidate_deferred"
    assert row["roofPlanGeometryReadout_v0"] == "footprint_proxy_deferred"
    assert row["roofTopologyToken"] == "mass_box_proxy"
    ext0 = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert "+bim_ai_roof_unsupported_shape_summary_v0" in ext0["meshEncoding"]
    summ0 = ext0.get("roofGeometryUnsupportedShapeSummary_v0")
    assert isinstance(summ0, dict)
    assert summ0["format"] == "roofGeometryUnsupportedShapeSummary_v0"
    assert summ0["deferredInstanceCount"] == 1
    assert summ0["countsBySupportToken"] == {"hip_candidate_deferred": 1}


_L_SHAPED_FP = (
    {"xMm": 0, "yMm": 0},
    {"xMm": 6000, "yMm": 0},
    {"xMm": 6000, "yMm": 3000},
    {"xMm": 3000, "yMm": 3000},
    {"xMm": 3000, "yMm": 6000},
    {"xMm": 0, "yMm": 6000},
)


def test_mass_box_concave_footprint_emits_valley_candidate_token() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2200),
            "r-L": RoofElem(
                kind="roof",
                id="r-L",
                name="L-roof",
                reference_level_id="lvl",
                footprint_mm=list(_L_SHAPED_FP),
                slope_deg=28.0,
                roof_geometry_mode="mass_box",
            ),
        },
    )
    row = document_to_gltf(doc)["extensions"]["BIM_AI_exportManifest_v0"][
        "roofGeometryEvidence_v1"
    ]["roofs"][0]
    assert row["roofGeometrySupportToken"] == "valley_candidate_deferred"
    assert row["roofPlanGeometryReadout_v0"] == "footprint_proxy_deferred"


def test_export_manifest_roof_unsupported_shape_summary_two_tokens() -> None:
    cx_m = 5000.0
    cz_m = 5000.0
    r_mm = 2500.0
    hex_fp: list[dict[str, float]] = []
    for i in range(6):
        ang = (math.pi / 3.0) * float(i) - math.pi / 6.0
        hex_fp.append(
            {
                "xMm": round(cx_m + r_mm * math.cos(ang), 6),
                "yMm": round(cz_m + r_mm * math.sin(ang), 6),
            }
        )
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2400),
            "r-hex": RoofElem(
                kind="roof",
                id="r-hex",
                name="Hip-ish",
                reference_level_id="lvl",
                footprint_mm=hex_fp,
                slope_deg=30.0,
                roof_geometry_mode="mass_box",
            ),
            "r-L": RoofElem(
                kind="roof",
                id="r-L",
                name="L-roof",
                reference_level_id="lvl",
                footprint_mm=list(_L_SHAPED_FP),
                slope_deg=28.0,
                roof_geometry_mode="mass_box",
            ),
        },
    )
    ext = export_manifest_extension_payload(doc)
    summ = ext.get("roofGeometryUnsupportedShapeSummary_v0")
    assert isinstance(summ, dict)
    assert summ["format"] == "roofGeometryUnsupportedShapeSummary_v0"
    assert summ["deferredInstanceCount"] == 2
    assert summ["countsBySupportToken"] == {
        "hip_candidate_deferred": 1,
        "valley_candidate_deferred": 1,
    }
    assert "+bim_ai_roof_unsupported_shape_summary_v0" in ext["meshEncoding"]


def test_triangle_footprint_emits_non_rectangular_token() -> None:
    tri = (
        {"xMm": 0, "yMm": 0},
        {"xMm": 5000, "yMm": 0},
        {"xMm": 2500, "yMm": 3500},
    )
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2100),
            "r-tri": RoofElem(
                kind="roof",
                id="r-tri",
                name="Tri",
                reference_level_id="lvl",
                footprint_mm=list(tri),
                slope_deg=27.0,
                roof_geometry_mode="mass_box",
            ),
        },
    )
    row = document_to_gltf(doc)["extensions"]["BIM_AI_exportManifest_v0"][
        "roofGeometryEvidence_v1"
    ]["roofs"][0]
    assert row["roofGeometrySupportToken"] == "non_rectangular_footprint_deferred"


def test_roof_missing_reference_level_emits_missing_slope_or_level_token() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2000),
            "r-bad": RoofElem(
                kind="roof",
                id="r-bad",
                name="R",
                reference_level_id="missing-level",
                footprint_mm=list(_RECT_FP),
                slope_deg=25.0,
                roof_geometry_mode="mass_box",
            ),
        },
    )
    row = document_to_gltf(doc)["extensions"]["BIM_AI_exportManifest_v0"][
        "roofGeometryEvidence_v1"
    ]["roofs"][0]
    assert row["roofGeometrySupportToken"] == "missing_slope_or_level"


def test_roof_explicit_none_slope_emits_missing_slope_or_level_token() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2000),
            "r-ns": RoofElem(
                kind="roof",
                id="r-ns",
                name="R",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                slope_deg=None,
                roof_geometry_mode="mass_box",
            ),
        },
    )
    row = document_to_gltf(doc)["extensions"]["BIM_AI_exportManifest_v0"][
        "roofGeometryEvidence_v1"
    ]["roofs"][0]
    assert row["roofGeometrySupportToken"] == "missing_slope_or_level"


def test_deferred_gable_non_rectangle_footprint_uses_box_mesh_skips_gable_encoding() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2600),
            "rt-shingle": RoofTypeElem(kind="roof_type", id="rt-shingle", name="Asphalt"),
            "r-defer": RoofElem(
                kind="roof",
                id="r-defer",
                name="Roof",
                reference_level_id="lvl",
                footprint_mm=list(_L_SHAPED_FP),
                slope_deg=30.0,
                roof_geometry_mode="gable_pitched_rectangle",
                roof_type_id="rt-shingle",
            ),
        },
    )
    g = document_to_gltf(doc)
    ext = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert "bim_ai_gable_roof_v0" not in ext["meshEncoding"]
    row = ext["roofGeometryEvidence_v1"]["roofs"][0]
    assert row["roofGeometrySupportToken"] == "valley_candidate_deferred"
    assert row["roofTopologyToken"] == "skipped_invalid_gable_footprint"
    roof_mesh = next(m for m in g["meshes"] if m["name"] == "roof:r-defer")
    pos_ix = roof_mesh["primitives"][0]["attributes"]["POSITION"]
    assert g["accessors"][pos_ix]["count"] == 36


def test_gable_roof_typed_layers_surface_evidence_manifest_plan_section_agree() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2600),
            "pv": PlanViewElem(kind="plan_view", id="pv-rt", name="P", levelId="lvl"),
            "rt-deck": RoofTypeElem(
                kind="roof_type",
                id="rt-deck",
                name="Built-up",
                layers=[
                    WallTypeLayer(
                        thickness_mm=18.0,
                        layer_function="structure",
                        material_key="mat-osb-roof-deck-v1",
                    ),
                    WallTypeLayer(
                        thickness_mm=120.0,
                        layer_function="insulation",
                        material_key="mat-insulation-roof-board-v1",
                    ),
                ],
            ),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="Roof",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                overhang_mm=400,
                slope_deg=35,
                roof_geometry_mode="gable_pitched_rectangle",
                roof_type_id="rt-deck",
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-1",
                name="Sec",
                line_start_mm={"xMm": 500, "yMm": 2000},
                line_end_mm={"xMm": 5500, "yMm": 2000},
                crop_depth_mm=6000,
            ),
        },
    )
    g = document_to_gltf(doc)
    row = g["extensions"]["BIM_AI_exportManifest_v0"]["roofGeometryEvidence_v1"]["roofs"][0]
    assert row["layerStackSkipReason"] is None
    assert row["layerStackCount"] == 2
    assert row["layerStackTotalThicknessMm"] == 138.0
    assert row["primaryMaterialKey"] == "mat-osb-roof-deck-v1"
    assert row["primaryMaterialLabel"] == "OSB structural deck"
    assert row["roofFasciaEdgePlanToken"] == "eaveParallelPlanZ_gableRakeParallelPlanX"
    assert row["roofGeometrySupportToken"] == "gable_pitched_rectangle_supported"

    pw = resolve_plan_projection_wire(doc, plan_view_id="pv-rt", fallback_level_id="lvl")
    plan_row = (pw.get("primitives") or {}).get("roofs") or []
    assert len(plan_row) == 1
    pr = plan_row[0]
    sec_row = (build_section_projection_primitives(doc, doc.elements["sec"])[0].get("roofs") or [])[
        0
    ]
    for k in (
        "layerStackSkipReason",
        "layerStackCount",
        "layerStackTotalThicknessMm",
        "primaryMaterialKey",
        "primaryMaterialLabel",
        "roofFasciaEdgePlanToken",
        "roofGeometrySupportToken",
        "roofPlanGeometryReadout_v0",
    ):
        assert pr[k] == sec_row[k] == row[k]
    assert (
        "+bim_ai_roof_layered_prism_witness_v1"
        in g["extensions"]["BIM_AI_exportManifest_v0"]["meshEncoding"]
    )
    prism = row["roofLayeredPrismWitness_v1"]
    assert prism["format"] == "roofLayeredPrismWitness_v1"
    assert prism["roofLayeredPrismStackModel_v0"] == "vertical_stack_from_eave"
    assert prism["assemblyTotalThicknessMm"] == 138.0
    assert len(prism["layerReadouts"]) == 2
    assert pr["roofLayeredPrismWitness_v1"] == sec_row["roofLayeredPrismWitness_v1"] == prism
    scw_m = sec_row["roofSectionCutWitness_v0"]
    assert scw_m["sectionProfileToken_v0"] == "gableLayeredPrismChord_v1"
    assert scw_m["roofSectionCutSupportToken_v0"] == "gable_rectangle_layered_prism_v1"
    assert scw_m["layerReadouts"] == prism["layerReadouts"]
