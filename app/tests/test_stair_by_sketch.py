"""KRN-V3-05: stair by sketch — unit + round-trip tests."""

from __future__ import annotations

import pytest

from bim_ai.commands import CreateLevelCmd, CreateStairCmd
from bim_ai.document import Document
from bim_ai.elements import StairElem, StairTreadLine, Vec2Mm
from bim_ai.engine import (
    _balance_tread_risers,
    _materialize_stair_runs_and_landings,
    _validate_stair_boundary,
    apply_inplace,
    try_commit,
)
from bim_ai.sketch_session import SketchSession, finish_session
from bim_ai.sketch_validation import SketchInvalidError

# ─────────────────────────── helpers ────────────────────────────────────────

def _tl(from_x: float, to_x: float, y: float, riser: float | None = None) -> StairTreadLine:
    return StairTreadLine(
        from_mm=Vec2Mm(xMm=from_x, yMm=y),
        to_mm=Vec2Mm(xMm=to_x, yMm=y),
        riser_height_mm=riser,
    )


def _doc_with_levels() -> Document:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lvl-0", name="L0", elevationMm=0))
    apply_inplace(doc, CreateLevelCmd(id="lvl-1", name="L1", elevationMm=2800))
    return doc


def _sketch_stair_cmd(**kwargs) -> CreateStairCmd:
    """Build a minimal by_sketch CreateStairCmd with overrides."""
    defaults = dict(
        id="s1",
        base_level_id="lvl-0",
        top_level_id="lvl-1",
        run_start_mm={"xMm": 0, "yMm": 0},
        run_end_mm={"xMm": 0, "yMm": 0},
        authoringMode="by_sketch",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 3000, "yMm": 0},
            {"xMm": 3000, "yMm": 1200},
            {"xMm": 0, "yMm": 1200},
        ],
        treadLines=[
            {"fromMm": {"xMm": 0, "yMm": i * 250}, "toMm": {"xMm": 3000, "yMm": i * 250}}
            for i in range(12)
        ],
        totalRiseMm=2800,
    )
    defaults.update(kwargs)
    return CreateStairCmd(**defaults)


def _open_stair_by_sketch_session() -> SketchSession:
    return SketchSession(
        session_id="sess-1",
        model_id="model-1",
        element_kind="stair_by_sketch",
        level_id="lvl-0",
    )


# ─────────────────────────── _balance_tread_risers ───────────────────────────


def test_balance_all_nulls() -> None:
    """All riserHeightMm null → equal distribution."""
    lines = [_tl(0, 1000, float(i) * 250) for i in range(4)]
    result = _balance_tread_risers(lines, 800.0)
    assert result == [200.0, 200.0, 200.0, 200.0]


def test_balance_pinned_and_nulls() -> None:
    """2 pinned + 3 null → nulls share remainder."""
    lines = [
        _tl(0, 1000, 0, 200.0),
        _tl(0, 1000, 250, None),
        _tl(0, 1000, 500, 150.0),
        _tl(0, 1000, 750, None),
        _tl(0, 1000, 1000, None),
    ]
    result = _balance_tread_risers(lines, 1000.0)
    assert result[0] == pytest.approx(200.0)
    assert result[2] == pytest.approx(150.0)
    remaining = 1000.0 - 200.0 - 150.0
    share = remaining / 3
    assert result[1] == pytest.approx(share)
    assert result[3] == pytest.approx(share)
    assert result[4] == pytest.approx(share)


def test_balance_pinned_exceeds_total_rise() -> None:
    """Pinned sum > totalRiseMm must raise ValueError."""
    lines = [_tl(0, 1000, 0, 300.0), _tl(0, 1000, 300, None)]
    with pytest.raises(ValueError, match="exceeds totalRiseMm"):
        _balance_tread_risers(lines, 200.0)


def test_balance_no_nulls() -> None:
    """All pinned and sum matches total → returns values as-is."""
    lines = [_tl(0, 1000, float(i * 200), 175.0) for i in range(4)]
    result = _balance_tread_risers(lines, 700.0)
    assert all(r == pytest.approx(175.0) for r in result)


# ─────────────────────────── _validate_stair_boundary ───────────────────────


def test_boundary_must_have_3_plus_points() -> None:
    """2-point boundary raises."""
    with pytest.raises(ValueError, match="≥ 3"):
        _validate_stair_boundary([Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=1000, yMm=0)])


def test_boundary_self_intersection_rejected() -> None:
    """Figure-8 / bowtie boundary raises."""
    pts = [
        Vec2Mm(xMm=0, yMm=0),
        Vec2Mm(xMm=1000, yMm=1000),
        Vec2Mm(xMm=1000, yMm=0),
        Vec2Mm(xMm=0, yMm=1000),
    ]
    with pytest.raises(ValueError, match="self-intersecting"):
        _validate_stair_boundary(pts)


def test_boundary_zero_area_rejected() -> None:
    """Collinear points give zero area and must raise."""
    pts = [Vec2Mm(xMm=0, yMm=0), Vec2Mm(xMm=500, yMm=0), Vec2Mm(xMm=1000, yMm=0)]
    with pytest.raises(ValueError, match="zero area"):
        _validate_stair_boundary(pts)


# ─────────────────────────── CreateStairCmd validation ──────────────────────


def test_by_sketch_requires_boundary() -> None:
    """Missing boundaryMm raises."""
    with pytest.raises(ValueError, match="boundaryMm"):
        CreateStairCmd(
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            authoringMode="by_sketch",
            treadLines=[{"fromMm": {"xMm": 0, "yMm": 0}, "toMm": {"xMm": 1000, "yMm": 0}}],
            totalRiseMm=2800,
        )


def test_by_sketch_requires_tread_lines() -> None:
    """Missing treadLines raises."""
    with pytest.raises(ValueError, match="treadLines"):
        CreateStairCmd(
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            authoringMode="by_sketch",
            boundaryMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
            ],
            totalRiseMm=2800,
        )


def test_by_sketch_requires_positive_total_rise() -> None:
    """totalRiseMm=0 raises."""
    with pytest.raises(ValueError, match="totalRiseMm"):
        CreateStairCmd(
            base_level_id="lvl-0",
            top_level_id="lvl-1",
            run_start_mm={"xMm": 0, "yMm": 0},
            run_end_mm={"xMm": 0, "yMm": 0},
            authoringMode="by_sketch",
            boundaryMm=[
                {"xMm": 0, "yMm": 0},
                {"xMm": 1000, "yMm": 0},
                {"xMm": 1000, "yMm": 1000},
            ],
            treadLines=[{"fromMm": {"xMm": 0, "yMm": 0}, "toMm": {"xMm": 1000, "yMm": 0}}],
            totalRiseMm=0,
        )


# ─────────────────────────── engine round-trip ──────────────────────────────


def test_create_stair_by_sketch_round_trip() -> None:
    """CreateStairCmd(authoringMode='by_sketch') → try_commit → StairElem has correct fields."""
    doc = _doc_with_levels()
    cmd = _sketch_stair_cmd()
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    s = new_doc.elements["s1"]
    assert isinstance(s, StairElem)
    assert s.authoring_mode == "by_sketch"
    assert s.boundary_mm is not None and len(s.boundary_mm) == 4
    assert s.tread_lines is not None and len(s.tread_lines) == 12
    assert s.total_rise_mm == pytest.approx(2800.0)
    # All riser heights must be filled in (balanced).
    assert all(tl.riser_height_mm is not None for tl in s.tread_lines)


def test_winder_stair_12_risers() -> None:
    """12 tread lines, 3 non-parallel (winder), auto-balance distributes uniformly."""
    tread_lines_input = []
    for i in range(12):
        y = float(i * 250)
        if i in (4, 5, 6):
            # Non-parallel winder tread lines
            tread_lines_input.append(
                {"fromMm": {"xMm": 0, "yMm": y}, "toMm": {"xMm": 2000, "yMm": y + 200}}
            )
        else:
            tread_lines_input.append(
                {"fromMm": {"xMm": 0, "yMm": y}, "toMm": {"xMm": 3000, "yMm": y}}
            )
    cmd = _sketch_stair_cmd(id="winder", treadLines=tread_lines_input)
    doc = _doc_with_levels()
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    s = new_doc.elements["winder"]
    assert isinstance(s, StairElem)
    assert s.tread_lines is not None and len(s.tread_lines) == 12
    expected_riser = 2800.0 / 12
    for tl in s.tread_lines:
        assert tl.riser_height_mm == pytest.approx(expected_riser)


def test_winder_drag_rebalance() -> None:
    """Pin one tread's riserHeightMm, call _balance_tread_risers, verify others rebalance."""
    lines = [_tl(0, 1000, float(i * 250)) for i in range(12)]
    # Pin the 6th tread to a non-uniform height.
    lines[5] = _tl(0, 1000, 5 * 250, 300.0)
    result = _balance_tread_risers(lines, 2800.0)
    assert result[5] == pytest.approx(300.0)
    remaining = 2800.0 - 300.0
    share = remaining / 11
    for i, r in enumerate(result):
        if i == 5:
            continue
        assert r == pytest.approx(share)


def test_stair_runs_materialised_from_tread_lines() -> None:
    """_materialize_stair_runs_and_landings with tread lines creates one run per tread cell."""
    cmd = CreateStairCmd(
        id="mat1",
        base_level_id="lvl-0",
        top_level_id="lvl-1",
        run_start_mm={"xMm": 0, "yMm": 0},
        run_end_mm={"xMm": 0, "yMm": 0},
        authoringMode="by_sketch",
        boundaryMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 3000, "yMm": 0},
            {"xMm": 3000, "yMm": 1000},
            {"xMm": 0, "yMm": 1000},
        ],
        treadLines=[
            {"fromMm": {"xMm": 0, "yMm": i * 250}, "toMm": {"xMm": 3000, "yMm": i * 250}}
            for i in range(5)
        ],
        totalRiseMm=1000.0,
    )
    runs, landings = _materialize_stair_runs_and_landings(cmd)
    # 5 tread lines → 4 cells → 4 runs
    assert len(runs) == 4
    assert len(landings) == 0
    for run in runs:
        assert run.riser_count == 1


# ─────────────────────────── sketch session emitter ─────────────────────────


def test_sketch_session_stair_by_sketch_emit() -> None:
    """finish_session with authoringMode='by_sketch' opts emits correct command dict."""
    session = _open_stair_by_sketch_session()
    cmds = finish_session(
        session,
        {
            "authoringMode": "by_sketch",
            "topLevelId": "lvl-1",
            "baseLevelId": "lvl-0",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 3000, "yMm": 0},
                {"xMm": 3000, "yMm": 1200},
            ],
            "treadLines": [
                {"fromMm": {"xMm": 0, "yMm": 0}, "toMm": {"xMm": 3000, "yMm": 0}}
            ],
            "totalRiseMm": 2800,
        },
    )
    assert len(cmds) == 1
    cmd = cmds[0]
    assert cmd["type"] == "createStair"
    assert cmd["authoringMode"] == "by_sketch"
    assert len(cmd["boundaryMm"]) == 3
    assert len(cmd["treadLines"]) == 1
    assert cmd["totalRiseMm"] == 2800


def test_sketch_session_stair_by_sketch_requires_boundary() -> None:
    """finish_session without boundaryMm raises SketchInvalidError."""
    session = _open_stair_by_sketch_session()
    with pytest.raises(SketchInvalidError, match="boundaryMm"):
        finish_session(
            session,
            {
                "authoringMode": "by_sketch",
                "topLevelId": "lvl-1",
                "treadLines": [
                    {"fromMm": {"xMm": 0, "yMm": 0}, "toMm": {"xMm": 3000, "yMm": 0}}
                ],
                "totalRiseMm": 2800,
            },
        )


# ─────────────────────────── by_component backward compat ───────────────────


def test_by_component_path_unchanged() -> None:
    """Existing by_component round-trip still passes after all changes."""
    doc = _doc_with_levels()
    cmd = CreateStairCmd(
        id="s-straight",
        base_level_id="lvl-0",
        top_level_id="lvl-1",
        run_start_mm={"xMm": 0, "yMm": 0},
        run_end_mm={"xMm": 0, "yMm": 3000},
        widthMm=1000,
        riserMm=175,
        treadMm=275,
    )
    ok, new_doc, _, violations, _ = try_commit(doc, cmd.model_dump(by_alias=True))
    assert ok, violations
    s = new_doc.elements["s-straight"]
    assert isinstance(s, StairElem)
    assert s.authoring_mode == "by_component"
    assert s.boundary_mm is None
    assert s.tread_lines is None
    assert s.total_rise_mm is None
    assert len(s.runs) == 1
