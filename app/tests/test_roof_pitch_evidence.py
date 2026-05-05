"""Pitched gable roof slice: replay validation, section evidence, glTF + manifest."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateLevelCmd, CreateRoofCmd
from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, RoofElem, SectionCutElem
from bim_ai.engine import apply_inplace
from bim_ai.export_gltf import document_to_gltf
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
    for k in SHARED_GABLE_EVIDENCE_KEYS:
        p_v, s_v = plan_row[k], sec_row[k]
        if isinstance(p_v, str):
            assert p_v == s_v
        else:
            assert pytest.approx(float(p_v), rel=1e-9, abs=1e-6) == float(s_v), k


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
    mass_keys = ("roofGeometryMode", "slopeDeg", "overhangMm", "zMidMm", "proxyKind")
    for k in mass_keys:
        p_v, s_v = pr[k], sr[k]
        if isinstance(p_v, str):
            assert p_v == s_v
        else:
            assert pytest.approx(float(p_v), rel=1e-9, abs=1e-6) == float(s_v), k


def test_gltf_manifest_and_mesh_differs_from_mass_box_for_gable_roof() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=2600),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="Roof",
                reference_level_id="lvl",
                footprint_mm=list(_RECT_FP),
                slope_deg=32,
                roof_geometry_mode="gable_pitched_rectangle",
            ),
        },
    )
    g = document_to_gltf(doc)
    ext = g["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["meshEncoding"] == (
        "bim_ai_box_primitive_v0+bim_ai_gable_roof_v0+bim_ai_layered_assembly_witness_v0"
    )
    ev = ext.get("roofGeometryEvidence_v0")
    assert ev is not None and ev.get("format") == "roofGeometryEvidence_v0"
    assert len(ev["roofs"]) == 1
    roof_mesh = next(m for m in g["meshes"] if m["name"] == "roof:r1")
    pos_ix = roof_mesh["primitives"][0]["attributes"]["POSITION"]
    pos_acc = g["accessors"][pos_ix]
    assert pos_acc["count"] == 18


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
        "bim_ai_box_primitive_v0+bim_ai_layered_assembly_witness_v0"
    )
    assert ext.get("roofGeometryEvidence_v0") is None
    roof_mesh = next(m for m in g["meshes"] if m["name"] == "roof:roof-1")
    pos_ix = roof_mesh["primitives"][0]["attributes"]["POSITION"]
    assert g["accessors"][pos_ix]["count"] == 36
