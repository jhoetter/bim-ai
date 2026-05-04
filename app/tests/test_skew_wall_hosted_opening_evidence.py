"""Skew-wall hosted opening evidence: plan, section, and glTF manifest (Prompt-6 slice)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, PlanViewElem, SectionCutElem, WallElem
from bim_ai.export_gltf import export_manifest_extension_payload
from bim_ai.opening_cut_primitives import (
    hosted_opening_half_span_mm,
    hosted_opening_t_span_normalized,
)
from bim_ai.plan_projection_wire import plan_projection_wire_from_request
from bim_ai.section_projection_primitives import build_section_projection_primitives


def _skew_wall_door_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv-skew", name="P", levelId="lvl"),
            "w45": WallElem(
                kind="wall",
                id="w45",
                name="Diag",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 5000},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w45",
                alongT=0.5,
                widthMm=900,
            ),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec-skew",
                name="Sec",
                line_start_mm={"xMm": 0, "yMm": 2000},
                line_end_mm={"xMm": 6000, "yMm": 2000},
                crop_depth_mm=6000,
            ),
        },
    )


def test_skew_wall_door_section_emits_t_span_and_u_projection_scale() -> None:
    doc = _skew_wall_door_doc()
    w = doc.elements["w45"]
    assert isinstance(w, WallElem)
    d = doc.elements["d1"]
    assert isinstance(d, DoorElem)
    sec = doc.elements["sec"]
    assert isinstance(sec, SectionCutElem)

    prim, _w = build_section_projection_primitives(doc, sec)
    doors = prim.get("doors") or []
    assert len(doors) == 1
    row = doors[0]
    ts = hosted_opening_t_span_normalized(d, w)
    assert ts is not None
    assert row["openingTSpanNormalized"] == [round(ts[0], 6), round(ts[1], 6)]
    scale = float(row["uProjectionScale"])
    assert scale == pytest.approx(2**0.5 / 2, rel=1e-6)
    half = hosted_opening_half_span_mm(d)
    assert float(row["openingHalfWidthAlongUMm"]) == pytest.approx(half * scale, rel=1e-6)


def test_skew_wall_plan_wire_includes_wall_yaw_deg() -> None:
    doc = _skew_wall_door_doc()
    out = plan_projection_wire_from_request(doc, plan_view_id="pv-skew", fallback_level_id=None)
    prim = out.get("primitives") or {}
    doors = prim.get("doors") or []
    assert len(doors) == 1
    assert doors[0]["wallYawDeg"] == 45.0


def test_export_manifest_skew_wall_hosted_opening_evidence_v0() -> None:
    doc = _skew_wall_door_doc()
    ext = export_manifest_extension_payload(doc)
    assert "bim_ai_skew_wall_hosted_openings_v0" in ext["meshEncoding"]
    skew = ext.get("skewWallHostedOpeningEvidence_v0")
    assert skew is not None
    assert skew["format"] == "skewWallHostedOpeningEvidence_v0"
    w = doc.elements["w45"]
    d = doc.elements["d1"]
    assert isinstance(w, WallElem)
    assert isinstance(d, DoorElem)
    ts = hosted_opening_t_span_normalized(d, w)
    assert ts is not None
    assert skew["openings"] == [
        {
            "openingId": "d1",
            "kind": "door",
            "wallId": "w45",
            "openingTSpanNormalized": [round(float(ts[0]), 6), round(float(ts[1]), 6)],
            "wallYawDeg": 45.0,
            "halfSpanAlongWallMm": 450.0,
        },
    ]
