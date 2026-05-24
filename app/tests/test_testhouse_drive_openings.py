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
