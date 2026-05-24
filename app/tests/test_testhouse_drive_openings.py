"""MF-driver-6 (#20): ``vertexMm`` dict shape acceptance in ``_openings_bundle``.

Reader IRs may emit opening positions with ``vertexMm`` as either
``[x, y]`` (alpha shape) or ``{"xMm": ..., "yMm": ...}`` (beta/gamma
shape). The driver previously only accepted the list shape, so dict-
shape readers silently lost every opening — at iter-4 all three test
houses authored 0/N openings.

These tests pin the small ``_coerce_vertex_mm`` helper that
``_openings_bundle._try_host`` now delegates to.
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


# ---- _coerce_vertex_mm --------------------------------------------------


def test_coerce_accepts_list_shape() -> None:
    # Alpha shape: ``[x, y]`` — already a list of numbers.
    assert _DRV._coerce_vertex_mm([1234.5, 6789.0]) == [1234.5, 6789.0]


def test_coerce_accepts_dict_shape_xmm_ymm() -> None:
    # Beta/gamma shape: dict carrying ``xMm`` + ``yMm`` as separate keys.
    # This is the case that used to be silently rejected (issue #20).
    out = _DRV._coerce_vertex_mm({"xMm": 1234.5, "yMm": 6789.0})
    assert out == [1234.5, 6789.0]


def test_coerce_coerces_ints_to_floats() -> None:
    out = _DRV._coerce_vertex_mm({"xMm": 1234, "yMm": 6789})
    assert out == [1234.0, 6789.0]
    assert all(isinstance(v, float) for v in out)


def test_coerce_accepts_list_longer_than_two() -> None:
    # Some readers may emit ``[x, y, z]`` — driver only cares about XY.
    assert _DRV._coerce_vertex_mm([1.0, 2.0, 3.0]) == [1.0, 2.0]


def test_coerce_rejects_dict_missing_keys() -> None:
    # A dict without both ``xMm`` and ``yMm`` is not a vertex; the caller
    # should fall back to ``wallStartMm/wallEndMm`` or ``startMm/endMm``.
    assert _DRV._coerce_vertex_mm({"xMm": 1.0}) is None
    assert _DRV._coerce_vertex_mm({"yMm": 1.0}) is None
    assert _DRV._coerce_vertex_mm({}) is None


def test_coerce_rejects_short_list() -> None:
    assert _DRV._coerce_vertex_mm([1.0]) is None
    assert _DRV._coerce_vertex_mm([]) is None


def test_coerce_rejects_non_numeric_values() -> None:
    # Non-numeric strings should not blow up — return ``None`` so the
    # caller can fall back to the endpoint-midpoint paths.
    assert _DRV._coerce_vertex_mm({"xMm": "abc", "yMm": 1.0}) is None
    assert _DRV._coerce_vertex_mm(["abc", "def"]) is None


def test_coerce_rejects_other_types() -> None:
    assert _DRV._coerce_vertex_mm(None) is None
    assert _DRV._coerce_vertex_mm("[1,2]") is None
    assert _DRV._coerce_vertex_mm(42) is None


# ---- _openings_bundle (end-to-end via _try_host) ------------------------


def _wall_snapshot(house: str, level_short: str) -> dict:
    """Snapshot with two exterior walls long enough to host a door/window."""

    level_id = f"th-{house}-level-{level_short}"
    return {
        "elements": {
            "th-h-ext-wall-south": {
                "id": "th-h-ext-wall-south",
                "kind": "wall",
                "levelId": level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 10000.0, "yMm": 0.0},
                "heightMm": 2700.0,
            },
            "th-h-ext-wall-north": {
                "id": "th-h-ext-wall-north",
                "kind": "wall",
                "levelId": level_id,
                "start": {"xMm": 0.0, "yMm": 8000.0},
                "end": {"xMm": 10000.0, "yMm": 8000.0},
                "heightMm": 2700.0,
            },
        }
    }


def _ir_with_one_door(house: str, level_short: str, vertex_mm: object) -> dict:
    """Minimal IR carrying a single ``door`` fact on ``level-<level_short>``.

    The door sits 100 mm inside the south wall (y=100) and 5000 mm along
    it, which is within the 500 mm hosting tolerance.
    """

    return {
        "house": house,
        "levels": [
            {
                "id": f"level-{level_short}",
                "name": "Erdgeschoss",
                "elevationMM": 0,
                "heightMM": 2700,
            },
        ],
        "exteriorWallChainEG": {
            "polygonMM": [[0, 0], [10000, 0], [10000, 8000], [0, 8000]],
            "wallThicknessMM": 365,
        },
        "extractedFacts": [
            {
                "factId": "door-1",
                "kind": "door",
                "levelId": f"level-{level_short}",
                "widthMm": 900,
                "heightMm": 2100,
                "vertexMm": vertex_mm,
            },
        ],
    }


def test_openings_bundle_authors_door_with_dict_vertex() -> None:
    # The regression: dict-shaped ``vertexMm`` used to be silently dropped.
    house, level_short = "alpha", "EG"
    ir = _ir_with_one_door(house, level_short, {"xMm": 5000.0, "yMm": 100.0})
    snapshot = _wall_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is not None, "dict-shaped vertexMm must not drop the only door"
    bundle, consumed, skipped = result
    assert len(bundle["commands"]) == 1
    assert "door-1" in consumed
    assert skipped == []


def test_openings_bundle_authors_door_with_list_vertex_regression() -> None:
    # Sanity: the existing list shape must keep working (no regression).
    house, level_short = "alpha", "EG"
    ir = _ir_with_one_door(house, level_short, [5000.0, 100.0])
    snapshot = _wall_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is not None
    bundle, consumed, skipped = result
    assert len(bundle["commands"]) == 1
    assert "door-1" in consumed
    assert skipped == []


def test_openings_bundle_dict_and_list_produce_same_command_geometry() -> None:
    # Two IRs that differ only in vertex shape must yield the same
    # authored opening (same host wall, same alongT, same width).
    house, level_short = "alpha", "EG"
    snapshot = _wall_snapshot(house, level_short)

    dict_ir = _ir_with_one_door(house, level_short, {"xMm": 5000.0, "yMm": 100.0})
    list_ir = _ir_with_one_door(house, level_short, [5000.0, 100.0])

    dict_result = _DRV._openings_bundle(
        ir=dict_ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    list_result = _DRV._openings_bundle(
        ir=list_ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert dict_result is not None and list_result is not None
    dict_cmd = dict_result[0]["commands"][0]
    list_cmd = list_result[0]["commands"][0]
    # Geometry-bearing fields must match across shapes — same host wall,
    # same parametric position along it, same width.
    for key in ("type", "wallId", "alongT", "widthMm"):
        assert dict_cmd.get(key) == list_cmd.get(key), (
            f"{key} differs between dict-shape and list-shape vertexMm"
        )


# ---- MF-driver-4 (#13): host-distance threshold + per-fact skip log ----
#
# Reader vertexMm coords often sit on the room boundary while the
# authored wall is offset by ``thicknessMm/2`` (and a second offset on
# the opposite side adds up). A 500 mm threshold silently dropped every
# opening on iter-4 testhouses. The threshold is now 1000 mm, and every
# skip-log entry carries the actual nearest wall id + miss distance.


def test_resolve_opening_host_hits_within_threshold() -> None:
    # The south wall runs y=0 from x=0..10000. A vertex 800 mm "into"
    # the room (y=800) used to fall outside the 500 mm threshold and so
    # got dropped — under #13 it must now host on that wall.
    walls = list(_wall_snapshot("alpha", "EG")["elements"].values())
    wall, t, dist, reason = _DRV._resolve_opening_host(
        [5000.0, 800.0], walls, threshold_mm=1000.0
    )
    assert wall is not None, "800 mm offset must host under the 1000 mm threshold"
    assert wall.get("id") == "th-h-ext-wall-south"
    assert 0.0 <= t <= 1.0
    assert dist == 800.0
    assert reason is None


def test_resolve_opening_host_misses_beyond_threshold() -> None:
    # 1200 mm > 1000 mm threshold → miss, but the nearest wall + distance
    # are still reported so the caller can build a useful skip-log entry.
    walls = list(_wall_snapshot("alpha", "EG")["elements"].values())
    wall, t, dist, reason = _DRV._resolve_opening_host(
        [5000.0, 1200.0], walls, threshold_mm=1000.0
    )
    assert wall is None, "1200 mm offset must NOT host under the 1000 mm threshold"
    assert t == 0.0
    assert dist == 1200.0
    assert reason is not None
    # Reason must be the structured shape the operator-facing log expects.
    assert "nearest_wall_distance_1200mm" in reason
    assert "threshold_1000mm" in reason


def test_resolve_opening_host_reports_no_walls() -> None:
    wall, t, dist, reason = _DRV._resolve_opening_host(
        [5000.0, 0.0], [], threshold_mm=1000.0
    )
    assert wall is None
    assert t == 0.0
    assert dist == float("inf")
    assert reason == "no_walls_at_level"


def test_openings_bundle_hosts_door_800mm_off_wall() -> None:
    # The regression #13 was fixing: a vertex 800 mm off the nearest
    # authored wall used to be silently dropped at the old 500 mm
    # threshold. Under the new 1000 mm threshold it must be hosted.
    house, level_short = "alpha", "EG"
    ir = _ir_with_one_door(house, level_short, {"xMm": 5000.0, "yMm": 800.0})
    snapshot = _wall_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is not None, "800 mm-off-wall door must now author under #13"
    bundle, consumed, skipped = result
    assert len(bundle["commands"]) == 1
    assert bundle["commands"][0]["wallId"] == "th-h-ext-wall-south"
    assert "door-1" in consumed
    assert skipped == []


def test_openings_bundle_skips_door_1200mm_off_wall_with_structured_log() -> None:
    # 1200 mm is past the 1000 mm threshold → still skipped. But the
    # skip entry must now carry the operator-facing fields documented
    # in #13: factId, reason (with distance + threshold), nearestWallId,
    # and the raw vertexMm so a human can correlate the miss.
    house, level_short = "alpha", "EG"
    ir = _ir_with_one_door(house, level_short, {"xMm": 5000.0, "yMm": 1200.0})
    snapshot = _wall_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    # The bundle returns None when no openings authored (no commands).
    assert result is None, "1200 mm-off-wall door must NOT author"


def test_openings_bundle_skip_log_shape_for_out_of_range_window() -> None:
    # Same as above but with a window + a door pair so the bundle has
    # at least one authored command and so returns a non-None tuple
    # (which is the path that surfaces the skipped[] log to the caller).
    house, level_short = "alpha", "EG"
    ir = _ir_with_one_door(house, level_short, {"xMm": 5000.0, "yMm": 100.0})
    # Add an out-of-range window so the bundle has 1 authored + 1 skipped.
    ir["extractedFacts"].append(
        {
            "factId": "window-far",
            "kind": "window",
            "levelId": f"level-{level_short}",
            "widthMm": 1200,
            "heightMm": 1500,
            # Y=4000 sits 4000 mm off the south wall and 4000 mm off the
            # north wall (at y=8000) — well beyond the 1000 mm threshold.
            "vertexMm": {"xMm": 5000.0, "yMm": 4000.0},
        }
    )
    snapshot = _wall_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is not None
    _bundle, consumed, skipped = result
    assert "door-1" in consumed
    assert len(skipped) == 1
    entry = skipped[0]
    # Required fields per the #13 spec.
    assert entry["factId"] == "window-far"
    assert "nearestWallId" in entry
    assert entry["nearestWallId"] in {
        "th-h-ext-wall-south",
        "th-h-ext-wall-north",
    }, "nearest wall id must be surfaced even though it was out of range"
    assert "vertexMm" in entry
    assert entry["vertexMm"] == [5000.0, 4000.0]
    assert "reason" in entry
    # The reason must encode both the actual miss distance and the
    # threshold so an operator can read it without re-running the driver.
    assert "nearest_wall_distance_" in entry["reason"]
    assert "threshold_1000mm" in entry["reason"]


def test_openings_bundle_old_500mm_threshold_no_longer_drops_800mm() -> None:
    # Cross-check vs the pre-#13 behaviour: at the old 500 mm threshold
    # the 800 mm-off vertex would not host. We assert via the helper
    # (so the test pins behaviour, not just the constant) that the same
    # vertex hosts at 1000 mm but misses at 500 mm.
    walls = list(_wall_snapshot("alpha", "EG")["elements"].values())
    miss_wall, _t, _d, miss_reason = _DRV._resolve_opening_host(
        [5000.0, 800.0], walls, threshold_mm=500.0
    )
    hit_wall, _t2, _d2, hit_reason = _DRV._resolve_opening_host(
        [5000.0, 800.0], walls, threshold_mm=1000.0
    )
    assert miss_wall is None, "old 500 mm threshold must reject 800 mm offset"
    assert miss_reason and "threshold_500mm" in miss_reason
    assert hit_wall is not None, "new 1000 mm threshold must accept 800 mm offset"
    assert hit_reason is None


def test_default_host_distance_constant_is_1000mm() -> None:
    # Pin the constant explicitly: the #13 fix is "bump 500 → 1000". If
    # someone reverts to 500 mm, this test names the regression.
    assert _DRV.DEFAULT_HOST_DISTANCE_MM == 1000.0
