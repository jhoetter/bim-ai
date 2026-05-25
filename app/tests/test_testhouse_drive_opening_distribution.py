"""MF-driver-18 (#89): auto-distribute openings sharing a host wall.

Reader IRs sometimes emit N opening facts that all share the same
``wallStartMm`` / ``wallEndMm`` endpoints — the reader knows the host
wall but didn't compute per-window offsets. Pre-fix, ``_openings_bundle``
snapped each fact to the wall midpoint, the first one committed, and
the other N-1 were silently dropped with
``overlaps_existing_opening_on_wall`` — a 6-window facade rendered as 1.

This test file pins the new group-distribution behaviour:

1. N facts sharing a wall with no per-fact position → evenly spaced
   along the wall at ``wall_length * i / (N+1)`` for ``i`` in ``1..N``.
2. Facts carrying an explicit ``offsetAlongWallMm`` field are placed
   at exactly that offset (readers that DO know positions opt-in).
3. Mixed groups (some explicit + some not) keep the explicit anchors
   and evenly fill the gaps between them.
4. When a wall is too short to fit the requested N openings, the
   overflow tail is surfaced in ``skipped[]`` with the structured
   reason ``wall_too_short_for_N_openings``.
5. Single openings per wall (the alpha-style happy path) are
   unchanged — the pre-pass is a no-op for groups of size < 2.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "scripts" / "testhouse_drive.py"


def _load_driver():
    spec = importlib.util.spec_from_file_location("testhouse_drive", SCRIPT_PATH)
    assert spec and spec.loader, "could not build importlib spec for testhouse_drive.py"
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("testhouse_drive", mod)
    spec.loader.exec_module(mod)
    return mod


_DRV = _load_driver()


# ---- shared fixtures ----------------------------------------------------

# 12 m south wall — 10800 mm length keeps 6 windows of 1200 mm + 200 mm
# clearance each (8400 mm needed) comfortably inside the wall, with
# 2400 mm of slack to even-space across.
SOUTH_WALL_LEN_MM = 10800.0
HOUSE = "h21"
LEVEL = "EG"


def _snapshot() -> dict:
    """Snapshot with one 10.8 m south wall sized for 6 windows."""

    level_id = f"th-{HOUSE}-level-{LEVEL}"
    return {
        "elements": {
            "th-h21-ext-wall-south": {
                "id": "th-h21-ext-wall-south",
                "kind": "wall",
                "levelId": level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": SOUTH_WALL_LEN_MM, "yMm": 0.0},
                "heightMm": 2700.0,
            },
            "th-h21-ext-wall-north": {
                "id": "th-h21-ext-wall-north",
                "kind": "wall",
                "levelId": level_id,
                "start": {"xMm": 0.0, "yMm": 8000.0},
                "end": {"xMm": SOUTH_WALL_LEN_MM, "yMm": 8000.0},
                "heightMm": 2700.0,
            },
        }
    }


def _ir(facts: list[dict]) -> dict:
    return {
        "house": HOUSE,
        "levels": [
            {
                "id": f"level-{LEVEL}",
                "name": "Erdgeschoss",
                "elevationMM": 0,
                "heightMM": 2700,
            },
        ],
        "exteriorWallChainEG": {
            "polygonMM": [
                [0, 0],
                [SOUTH_WALL_LEN_MM, 0],
                [SOUTH_WALL_LEN_MM, 8000],
                [0, 8000],
            ],
            "wallThicknessMM": 365,
        },
        "extractedFacts": facts,
    }


def _window_fact_shared_wall(fact_id: str, extras: dict | None = None) -> dict:
    """A window fact whose only position info is the shared wall endpoint pair."""

    f = {
        "factId": fact_id,
        "kind": "window",
        "levelId": f"level-{LEVEL}",
        "wallStartMm": {"xMm": 0.0, "yMm": 0.0},
        "wallEndMm": {"xMm": SOUTH_WALL_LEN_MM, "yMm": 0.0},
    }
    if extras:
        f.update(extras)
    return f


def _run() -> tuple[dict, list[str], list[dict]]:
    facts = _IR_FACTS  # set by each test
    result = _DRV._openings_bundle(
        ir=_ir(facts),
        parent_revision=1,
        house=HOUSE,
        level_short=LEVEL,
        snapshot=_snapshot(),
    )
    assert result is not None, "expected a non-empty bundle for the test inputs"
    return result


# ---- 1. N windows, no offsets, even-distribute -------------------------


_IR_FACTS: list[dict] = []


def test_six_windows_no_offsets_evenly_spaced() -> None:
    # Six identical reader-emitted facts that all share the south wall's
    # endpoint pair. Pre-fix: 1 commits, 5 dropped as overlaps. Post-fix:
    # all 6 commit at alongT = i/7 for i in 1..6.
    global _IR_FACTS
    _IR_FACTS = [_window_fact_shared_wall(f"window-{i}") for i in range(6)]
    bundle, consumed, skipped = _run()

    cmds = bundle["commands"]
    assert len(cmds) == 6, (
        f"expected 6 commands for 6-window facade, got {len(cmds)} — "
        "auto-distribution must place every fact when the wall has room"
    )
    assert all(c["type"] == "insertWindowOnWall" for c in cmds)
    assert all(c["wallId"] == "th-h21-ext-wall-south" for c in cmds)
    assert skipped == [], f"no overflow expected, got skipped={skipped}"
    assert sorted(consumed) == sorted(f"window-{i}" for i in range(6))

    # Even spacing at i/(N+1).
    expected_t = [round((i + 1) / 7.0, 4) for i in range(6)]
    actual_t = sorted(c["alongT"] for c in cmds)
    for got, want in zip(actual_t, expected_t, strict=True):
        assert abs(got - want) < 1e-3, (
            f"alongT {got} not within tolerance of even-spaced {want}"
        )


# ---- 2. Explicit offsetAlongWallMm honoured exactly ---------------------


def test_three_windows_with_explicit_offsets_committed_at_those_offsets() -> None:
    # Reader supplied per-window offsets — driver must honour them
    # verbatim (project them back to alongT against the wall length).
    global _IR_FACTS
    offsets = [1500.0, 3000.0, 6000.0]
    _IR_FACTS = [
        _window_fact_shared_wall(f"window-{i}", {"offsetAlongWallMm": off})
        for i, off in enumerate(offsets)
    ]
    bundle, consumed, skipped = _run()
    cmds = sorted(bundle["commands"], key=lambda c: c["alongT"])
    assert len(cmds) == 3
    assert skipped == []
    expected_t = [round(o / SOUTH_WALL_LEN_MM, 4) for o in offsets]
    actual_t = [c["alongT"] for c in cmds]
    for got, want in zip(actual_t, expected_t, strict=True):
        assert abs(got - want) < 1e-3, (
            f"explicit offset {want * SOUTH_WALL_LEN_MM:.0f} mm projected to {got}, "
            f"expected {want}"
        )


# ---- 3. Mix of explicit + un-positioned -- gaps filled evenly -----------


def test_mixed_explicit_and_unpositioned_windows() -> None:
    # 2 explicit anchors at 1/3 and 2/3 of the wall, + 3 un-positioned
    # facts. Post-fix: 2 land at their anchors, the 3 fill the three
    # gaps (0..1/3, 1/3..2/3, 2/3..1) with one each.
    global _IR_FACTS
    a1 = SOUTH_WALL_LEN_MM / 3.0
    a2 = 2 * SOUTH_WALL_LEN_MM / 3.0
    _IR_FACTS = [
        _window_fact_shared_wall("explicit-1", {"offsetAlongWallMm": a1}),
        _window_fact_shared_wall("explicit-2", {"offsetAlongWallMm": a2}),
        _window_fact_shared_wall("free-1"),
        _window_fact_shared_wall("free-2"),
        _window_fact_shared_wall("free-3"),
    ]
    bundle, consumed, skipped = _run()
    cmds = bundle["commands"]
    assert len(cmds) == 5, f"expected 5 windows authored, got {len(cmds)}"
    assert skipped == [], f"no overflow expected, got skipped={skipped}"
    ts = sorted(c["alongT"] for c in cmds)

    # The two explicit anchors must be present unchanged (project to t=1/3, 2/3).
    explicit_t = {round(1 / 3, 4), round(2 / 3, 4)}
    found_explicit = {t for t in ts if any(abs(t - e) < 1e-3 for e in explicit_t)}
    assert len(found_explicit) == 2, (
        f"expected both explicit anchors in {ts}, found {found_explicit}"
    )

    # The 3 free facts must be evenly distributed across the 3 gaps
    # between/around the anchors: gap centres are at 1/6, 3/6=1/2, 5/6.
    free_t = [t for t in ts if not any(abs(t - e) < 1e-3 for e in explicit_t)]
    assert len(free_t) == 3
    expected_free = [round(1 / 6, 4), round(3 / 6, 4), round(5 / 6, 4)]
    for got, want in zip(free_t, expected_free, strict=True):
        assert abs(got - want) < 5e-3, (
            f"un-positioned fact lands at {got}, expected ~{want} (gap centre)"
        )


# ---- 4. Wall too short for N openings -- overflow tail skipped ---------


def test_too_many_openings_overflow_logged_as_wall_too_short() -> None:
    # A 4 m wall fits 2 windows comfortably (each: 1200 + 200 mm = 1400 mm,
    # 2 of them = 2800 mm ≤ 4000 mm) but cannot fit 4 (4 * 1400 = 5600 mm).
    # Pre-fix overflow: silent overlap drop. Post-fix: explicit
    # ``wall_too_short_for_N_openings`` skip entries.
    global _IR_FACTS
    short_wall_len = 4000.0
    snapshot = _snapshot()
    snapshot["elements"]["th-h21-ext-wall-south"]["end"] = {
        "xMm": short_wall_len,
        "yMm": 0.0,
    }
    snapshot["elements"]["th-h21-ext-wall-north"]["end"] = {
        "xMm": short_wall_len,
        "yMm": 8000.0,
    }
    facts = [
        {
            "factId": f"window-{i}",
            "kind": "window",
            "levelId": f"level-{LEVEL}",
            "wallStartMm": {"xMm": 0.0, "yMm": 0.0},
            "wallEndMm": {"xMm": short_wall_len, "yMm": 0.0},
        }
        for i in range(4)
    ]
    ir = _ir(facts)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=HOUSE,
        level_short=LEVEL,
        snapshot=snapshot,
    )
    assert result is not None
    bundle, consumed, skipped = result
    cmds = bundle["commands"]
    # 2 must fit, the other 2 logged as overflow.
    assert len(cmds) == 2, (
        f"a 4 m wall fits 2 windows of 1400 mm extent, got {len(cmds)} authored"
    )
    overflow = [s for s in skipped if s.get("reason") == "wall_too_short_for_N_openings"]
    assert len(overflow) == 2, (
        f"expected 2 overflow entries with reason wall_too_short_for_N_openings, "
        f"got skipped={skipped}"
    )
    for entry in overflow:
        assert entry["kind"] == "window"
        assert entry["factId"] in {"window-2", "window-3"}, (
            "overflow tail should be the LAST facts in input order, not the first"
        )


# ---- 5. Single opening per wall -- unchanged (back-compat) -------------


def test_single_opening_per_wall_unchanged() -> None:
    # The alpha-style happy path: one window with an explicit vertex on
    # the south wall. Pre- and post-fix the command must be identical
    # (the group pre-pass is a no-op for groups of size 1).
    global _IR_FACTS
    _IR_FACTS = [
        {
            "factId": "lone-window",
            "kind": "window",
            "levelId": f"level-{LEVEL}",
            "vertexMm": [5000.0, 100.0],
        }
    ]
    bundle, consumed, skipped = _run()
    cmds = bundle["commands"]
    assert len(cmds) == 1
    assert cmds[0]["wallId"] == "th-h21-ext-wall-south"
    # Mid-wall vertex projects to t ≈ 0.4630 (5000 / 10800).
    assert abs(cmds[0]["alongT"] - 5000.0 / SOUTH_WALL_LEN_MM) < 1e-3
    assert consumed == ["lone-window"]
    assert skipped == []


def test_single_window_per_wall_via_endpoint_pair_unchanged() -> None:
    # A SINGLE fact carrying only wallStartMm/wallEndMm (no per-fact
    # position) is still placed at the wall midpoint — the pre-pass
    # only kicks in for groups of size >= 2. This guards against
    # regressions where the new path leaks into single-opening IRs.
    global _IR_FACTS
    _IR_FACTS = [_window_fact_shared_wall("only-one")]
    bundle, consumed, skipped = _run()
    cmds = bundle["commands"]
    assert len(cmds) == 1
    assert cmds[0]["wallId"] == "th-h21-ext-wall-south"
    # Midpoint of the wall: t = 0.5.
    assert abs(cmds[0]["alongT"] - 0.5) < 1e-3
    assert consumed == ["only-one"]
    assert skipped == []


# ---- helpers' contracts (lightweight micro-tests) -----------------------


def test_wall_segment_from_fact_dict_shape() -> None:
    seg = _DRV._wall_segment_from_fact(
        {"wallStartMm": {"xMm": 1.0, "yMm": 2.0}, "wallEndMm": {"xMm": 3.0, "yMm": 4.0}}
    )
    assert seg == ((1.0, 2.0), (3.0, 4.0))


def test_wall_segment_from_fact_list_shape() -> None:
    seg = _DRV._wall_segment_from_fact({"startMm": [1, 2], "endMm": [3, 4]})
    assert seg == ((1.0, 2.0), (3.0, 4.0))


def test_wall_endpoint_key_direction_invariant() -> None:
    # Same wall described start->end vs end->start collapses into one key.
    f_fwd = {"wallStartMm": {"xMm": 0, "yMm": 0}, "wallEndMm": {"xMm": 10, "yMm": 0}}
    f_rev = {"wallStartMm": {"xMm": 10, "yMm": 0}, "wallEndMm": {"xMm": 0, "yMm": 0}}
    assert _DRV._wall_endpoint_key(f_fwd) == _DRV._wall_endpoint_key(f_rev)


def test_fact_has_explicit_position_true_for_vertex_and_offset() -> None:
    assert _DRV._fact_has_explicit_position({"vertexMm": [1.0, 2.0]}) is True
    assert _DRV._fact_has_explicit_position({"offsetAlongWallMm": 1500.0}) is True
    assert _DRV._fact_has_explicit_position({"centerXMm": 3000.0}) is True
    assert _DRV._fact_has_explicit_position({"polygonMm": [[0, 0], [1, 1]]}) is True


def test_fact_has_explicit_position_false_for_endpoint_only() -> None:
    # The exact shape that triggers the #89 regression: a fact whose
    # only position info is the host wall endpoint pair.
    f = {
        "wallStartMm": {"xMm": 0, "yMm": 0},
        "wallEndMm": {"xMm": 10000, "yMm": 0},
    }
    assert _DRV._fact_has_explicit_position(f) is False


# ---- MF-driver-19 (#91): ``wallStartMm``-only group auto-distribution --
#
# When a reader emits N opening facts that each carry ONLY ``wallStartMm``
# (no ``wallEndMm``) and they all anchor to the same host wall, the
# autodistribute pre-pass from PR #90 must still kick in — pre-fix the
# first commits and the rest are dropped with
# ``overlaps_existing_opening_on_wall`` (h23 hit this with 14 facts → 1
# commit, 13 dropped). Post-fix all 14 commit, evenly spaced along the
# wall the resolver snapped them to.


def _window_fact_wall_start_only(fact_id: str, anchor: list[float] | dict) -> dict:
    """A window fact whose only position info is ``wallStartMm`` (no end)."""

    return {
        "factId": fact_id,
        "kind": "window",
        "levelId": f"level-{LEVEL}",
        "wallStartMm": anchor,
    }


def test_fourteen_wall_start_only_windows_same_wall_autodistribute() -> None:
    # The h23 case from issue #91: 14 anchor-only window facts that all
    # snap to the same south wall. Pre-fix: 1 commits, 13 dropped with
    # ``overlaps_existing_opening_on_wall``. Post-fix: all 14 commit, at
    # evenly-spaced positions along the wall (alongT = i/(N+1) for i in
    # 1..14). The south wall here is 10.8 m, plenty of room for 14
    # windows of 1400 mm extent (14 * 1400 = 19.6 m) — wait, that's TOO
    # tight. Make the wall long enough: 25 m fits 14 windows comfortably.
    global _IR_FACTS
    wall_len = 25000.0
    snapshot = _snapshot()
    snapshot["elements"]["th-h21-ext-wall-south"]["end"] = {"xMm": wall_len, "yMm": 0.0}
    snapshot["elements"]["th-h21-ext-wall-north"]["end"] = {
        "xMm": wall_len,
        "yMm": 8000.0,
    }
    # 14 facts, each carrying only an anchor near the south wall. The
    # anchors differ slightly in x so a reader-style sweep along the
    # facade is faithfully represented; what matters for the test is
    # that they all snap to the SAME wall and so share one bucket.
    facts = [
        _window_fact_wall_start_only(
            f"win-anchor-{i}",
            {"xMm": 500.0 + i * 100.0, "yMm": 0.0},
        )
        for i in range(14)
    ]
    ir = _ir(facts)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=HOUSE,
        level_short=LEVEL,
        snapshot=snapshot,
    )
    assert result is not None
    bundle, consumed, skipped = result
    cmds = bundle["commands"]
    assert len(cmds) == 14, (
        f"all 14 wallStartMm-only facts must commit (h23 regression); got {len(cmds)}, "
        f"skipped={skipped}"
    )
    assert all(c["wallId"] == "th-h21-ext-wall-south" for c in cmds)
    assert skipped == [], f"no overflow expected on a 25 m wall, got {skipped}"
    assert sorted(consumed) == sorted(f"win-anchor-{i}" for i in range(14))

    # Distribution check: positions should be the even-spaced
    # ``i/(N+1)`` set, not clustered at the resolver's snapped anchor.
    expected_t = sorted(round((i + 1) / 15.0, 4) for i in range(14))
    actual_t = sorted(round(c["alongT"], 4) for c in cmds)
    for got, want in zip(actual_t, expected_t, strict=True):
        assert abs(got - want) < 5e-3, (
            f"alongT {got} not within tolerance of even-spaced {want} — "
            "auto-distribute pre-pass must run on anchor-only groups too"
        )


def test_single_wall_start_only_window_per_wall_unchanged() -> None:
    # The N=1 anchor-only case: a single fact carrying only wallStartMm
    # must host where the resolver snaps it (no autodistribute needed).
    # Guards against the new wall-id bucketing leaking into single-fact
    # IRs.
    global _IR_FACTS
    _IR_FACTS = [
        _window_fact_wall_start_only("only-anchor", [3000.0, 0.0]),
    ]
    bundle, consumed, skipped = _run()
    cmds = bundle["commands"]
    assert len(cmds) == 1
    assert cmds[0]["wallId"] == "th-h21-ext-wall-south"
    # x=3000 on a 10800 mm wall → t ≈ 0.2778.
    assert abs(cmds[0]["alongT"] - 3000.0 / SOUTH_WALL_LEN_MM) < 1e-3
    assert consumed == ["only-anchor"]
    assert skipped == []
