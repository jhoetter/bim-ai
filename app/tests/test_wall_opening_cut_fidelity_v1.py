"""Wall / hosted opening cut fidelity evidence (prompt-1 slice)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, PlanViewElem, SectionCutElem, WallElem
from bim_ai.export_gltf import export_manifest_extension_payload
from bim_ai.plan_projection_wire import plan_projection_wire_from_request
from bim_ai.section_projection_primitives import build_section_projection_primitives
from bim_ai.wall_opening_cut_fidelity import collect_wall_opening_cut_fidelity_evidence_v1


def _axis_aligned_wall_door_doc(*, door_along_t: float = 0.5, wall_len_mm: float = 6000.0) -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
            "w": WallElem(
                kind="wall",
                id="w",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": wall_len_mm, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w",
                alongT=door_along_t,
                widthMm=900,
            ),
        },
    )


def test_plan_wire_and_manifest_full_cut_axis_aligned_host() -> None:
    doc = _axis_aligned_wall_door_doc()
    out = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id=None)
    fed = out.get("wallOpeningCutFidelityEvidence_v1")
    assert isinstance(fed, dict)
    assert fed["format"] == "wallOpeningCutFidelityEvidence_v1"
    rows = fed["rows"]
    assert len(rows) == 1
    assert rows[0]["cutStatus"] == "full_cut"
    assert rows[0]["openingId"] == "d1"
    assert rows[0]["hostWallId"] == "w"
    assert rows[0]["cornerInteractionToken"] is None

    ext = export_manifest_extension_payload(doc)
    assert "bim_ai_wall_opening_cut_fidelity_v1" in ext["meshEncoding"]
    mrows = ext["wallOpeningCutFidelityEvidence_v1"]["rows"]
    assert mrows == rows


def test_near_l_corner_sets_corner_token_and_adjacent_wall() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "pv": PlanViewElem(kind="plan_view", id="pv", name="P", levelId="lvl"),
            "wh": WallElem(
                kind="wall",
                id="wh",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wv": WallElem(
                kind="wall",
                id="wv",
                name="V",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 0, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d": DoorElem(
                kind="door",
                id="d-corner",
                name="D",
                wallId="wh",
                alongT=0.02,
                widthMm=900,
            ),
        },
    )
    row = collect_wall_opening_cut_fidelity_evidence_v1(doc)["rows"][0]
    assert row["cutStatus"] == "full_cut"
    assert row["cornerInteractionToken"] == "nearLCornerJoin"
    assert row["cornerAdjacentWallId"] == "wv"
    assert row["cornerVertexMm"] == {"xMm": 0.0, "yMm": 0.0}


def test_skew_wall_host_emits_proxy_cut() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
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
        },
    )
    rows = collect_wall_opening_cut_fidelity_evidence_v1(doc)["rows"]
    assert len(rows) == 1
    assert rows[0]["cutStatus"] == "proxy_cut"
    assert rows[0]["skipReason"] is None
    assert rows[0]["openingTSpanNormalized"] is not None


def test_opening_wider_than_wall_span_is_outside_host() -> None:
    doc = _axis_aligned_wall_door_doc(door_along_t=0.5, wall_len_mm=800.0)
    row = collect_wall_opening_cut_fidelity_evidence_v1(doc)["rows"][0]
    assert row["cutStatus"] == "outside_host"
    assert row["skipReason"] == "opening_exceeds_wall_clear_span"
    assert row["openingTSpanNormalized"] is None


def test_missing_host_wall_is_unsafe_host() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "d": DoorElem(
                kind="door",
                id="d-orphan",
                name="D",
                wallId="missing-wall",
                alongT=0.5,
                widthMm=900,
            ),
        },
    )
    row = collect_wall_opening_cut_fidelity_evidence_v1(doc)["rows"][0]
    assert row["cutStatus"] == "unsafe_host"
    assert row["skipReason"] == "missing_host_wall"


def test_section_primitives_include_filtered_fidelity_rows() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w": WallElem(
                kind="wall",
                id="w",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 2000},
                end={"xMm": 6000, "yMm": 2000},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d": DoorElem(kind="door", id="d1", name="D", wallId="w", alongT=0.5, widthMm=900),
            "sec": SectionCutElem(
                kind="section_cut",
                id="sec1",
                name="S",
                line_start_mm={"xMm": 0, "yMm": 2000},
                line_end_mm={"xMm": 7000, "yMm": 2000},
                crop_depth_mm=6000,
            ),
        },
    )
    sec_elem = doc.elements["sec"]
    assert isinstance(sec_elem, SectionCutElem)
    prim, _w = build_section_projection_primitives(doc, sec_elem)
    ev = prim["wallOpeningCutFidelityEvidence_v1"]
    assert ev["format"] == "wallOpeningCutFidelityEvidence_v1"
    assert len(ev["rows"]) == 1
    assert ev["rows"][0]["openingId"] == "d1"
