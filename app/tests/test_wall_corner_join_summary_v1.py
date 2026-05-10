"""Wall corner join summary evidence (prompt-1 mission A)."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, PlanViewElem, WallElem
from bim_ai.export_gltf import export_manifest_extension_payload
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    resolve_plan_projection_wire,
)
from bim_ai.sheet_preview_svg import format_plan_projection_export_segment
from bim_ai.wall_join_evidence import collect_wall_corner_join_summary_v1


def test_summary_l_corner_butt_join_ids_and_token() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
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
        },
    )
    s = collect_wall_corner_join_summary_v1(doc)
    assert s is not None
    assert s["format"] == "wallCornerJoinSummary_v1"
    assert len(s["joins"]) == 1
    j0 = s["joins"][0]
    assert j0["joinKind"] == "butt"
    assert j0["planDisplayToken"] == "WJ_BUTT_AA"
    assert j0["joinId"] == "join:lvl:0.0:0.0:wh:wv"
    assert j0["skipReason"] is None
    assert j0["affectedOpeningIds"] == []


def test_summary_disallowed_endpoint_sets_skip_reason() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wh": WallElem(
                kind="wall",
                id="wh",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                joinDisallowStart=True,
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
        },
    )
    s = collect_wall_corner_join_summary_v1(doc)
    assert s is not None
    assert len(s["joins"]) == 1
    j0 = s["joins"][0]
    assert j0["joinKind"] == "butt"
    assert j0["skipReason"] == "join_disallowed"


def test_summary_opening_near_corner_lists_affected_opening_id() -> None:
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
            "d-corner": DoorElem(
                kind="door",
                id="d-corner",
                name="D",
                wallId="wh",
                alongT=0.02,
                widthMm=900,
            ),
        },
    )
    s = collect_wall_corner_join_summary_v1(doc)
    assert s is not None
    assert s["joins"][0]["affectedOpeningIds"] == ["d-corner"]

    wire = plan_projection_wire_from_request(doc, plan_view_id="pv", fallback_level_id=None)
    wjs = wire.get("wallCornerJoinSummary_v1")
    assert isinstance(wjs, dict)
    assert wjs["joins"][0]["affectedOpeningIds"] == ["d-corner"]
    seg = format_plan_projection_export_segment(wire)
    assert "wjSum[n=1 h=" in seg


def test_summary_skew_shared_vertex_is_unsupported_skew() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w_axis": WallElem(
                kind="wall",
                id="w_axis",
                name="H",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w_skew": WallElem(
                kind="wall",
                id="w_skew",
                name="S",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 4000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    s = collect_wall_corner_join_summary_v1(doc)
    assert s is not None
    assert len(s["joins"]) == 1
    j0 = s["joins"][0]
    assert j0["joinKind"] == "unsupported_skew"
    assert j0["planDisplayToken"] == "WJ_UNSUPPORTED_SKEW"
    assert j0["skipReason"] == "non_square_corner"


def test_summary_miter_candidate_perpendicular_skew_walls() -> None:
    """Two non-axis-aligned walls meeting at 90° at one snapped vertex."""
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="A",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 4000},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w2": WallElem(
                kind="wall",
                id="w2",
                name="B",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": -4000, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    s = collect_wall_corner_join_summary_v1(doc)
    assert s is not None
    assert len(s["joins"]) == 1
    j0 = s["joins"][0]
    assert j0["joinKind"] == "miter_candidate"
    assert j0["planDisplayToken"] == "WJ_MITER_CAND"
    assert j0["skipReason"] is None


def test_summary_parallel_overlap_proxy_row() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wa": WallElem(
                kind="wall",
                id="wa",
                name="A",
                levelId="lvl",
                start={"xMm": 1000, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "wb": WallElem(
                kind="wall",
                id="wb",
                name="B",
                levelId="lvl",
                start={"xMm": 2000, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    s = collect_wall_corner_join_summary_v1(doc)
    assert s is not None
    ovs = [j for j in s["joins"] if j["joinKind"] == "proxy_overlap"]
    assert len(ovs) == 1
    ov = ovs[0]
    assert ov["planDisplayToken"] == "WJ_PROXY_OVERLAP"
    assert ov["skipReason"] == "overlap_proxy_join"
    assert ov["wallIds"] == ["wa", "wb"]
    assert ov["joinId"].startswith("joinOv:lvl:wa:wb:h:")


def test_manifest_includes_summary_alongside_v0() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
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
        },
    )
    ext = export_manifest_extension_payload(doc)
    assert "bim_ai_wall_corner_join_summary_v1" in ext["meshEncoding"]
    summ = ext.get("wallCornerJoinSummary_v1")
    assert isinstance(summ, dict)
    assert summ["format"] == "wallCornerJoinSummary_v1"


def test_plan_wire_join_summary_filtered_out_when_crop_excludes_vertex() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "pv": PlanViewElem(
                kind="plan_view",
                id="pv",
                name="P",
                levelId="lvl",
                cropMinMm={"xMm": 5000, "yMm": 5000},
                cropMaxMm={"xMm": 6000, "yMm": 6000},
            ),
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
        },
    )
    wire = resolve_plan_projection_wire(doc, plan_view_id="pv", fallback_level_id=None)
    assert wire.get("wallCornerJoinSummary_v1") is None
