"""MF-driver-14 (#78): per-floor authoring tolerates absent ``room_outline`` facts.

Real-world scenario: a reader IR may extract `kind=window` / `kind=door`
facts for level-EG (and elevations) without producing any
`kind=room_outline` facts — readers can read exterior elevations and
infer windows without doing floor-plan room decomposition. Pre-fix,
``_author_level_inside_out`` ran each phase independently but
``_openings_bundle`` filtered walls by the canonical
``th-{house}-level-{level_short}`` levelId; when the per-floor
``_exterior_walls_bundle`` was also skipped (no
``exterior_wall_chain`` facts), the only walls in the snapshot were
the shell phase's iter-prefixed ones (``th-{house}-i{iter}-level-EG``)
which the filter ignored. So the openings bundle returned ``None`` and
the model rendered as a windowless barn even though the IR carried 9
EG windows + 1 EG door.

Post-fix:

* ``_openings_bundle`` first tries the canonical levelId; if zero
  walls match it falls back to any wall whose levelId ends with
  ``-level-{level_short}``. Shell walls now qualify as hosts.
* IRs that DO carry ``room_outline`` (and per-floor ``ext_walls``)
  behave identically to pre-fix — the canonical filter still finds
  per-floor walls first and the fallback never fires.
* IRs with neither rooms nor openings nor walls return gracefully —
  the bundle stays ``None``, no exception, no 409 from a stray empty
  commit.
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


# ---------- Snapshot + IR helpers ------------------------------------------


def _shell_walls_snapshot(house: str, iter_n: int, level_short: str) -> dict:
    """Snapshot that mirrors what ``_shell_bundle_from_ir`` would produce.

    Shell walls live at the ITER-PREFIXED levelId
    (``th-{house}-i{iter_n}-level-EG``) — not the canonical
    ``th-{house}-level-EG`` that per-floor authoring uses. Pre-fix this
    levelId mismatch caused openings to ignore shell walls entirely.
    """

    shell_level_id = f"th-{house}-i{iter_n}-level-{level_short}"
    return {
        "revision": 1,
        "elements": {
            shell_level_id: {
                "id": shell_level_id,
                "kind": "level",
                "elevationMm": 0.0,
            },
            f"th-{house}-i{iter_n}-eg-wall-south": {
                "id": f"th-{house}-i{iter_n}-eg-wall-south",
                "kind": "wall",
                "levelId": shell_level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 10000.0, "yMm": 0.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
            f"th-{house}-i{iter_n}-eg-wall-north": {
                "id": f"th-{house}-i{iter_n}-eg-wall-north",
                "kind": "wall",
                "levelId": shell_level_id,
                "start": {"xMm": 0.0, "yMm": 8000.0},
                "end": {"xMm": 10000.0, "yMm": 8000.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
        },
    }


def _per_floor_walls_snapshot(house: str, level_short: str) -> dict:
    """Snapshot that mirrors what ``_exterior_walls_bundle`` would produce.

    Per-floor walls live at the CANONICAL levelId
    (``th-{house}-level-EG``) — the levelId the openings filter was
    written against. Used to pin the pre-fix happy path: when per-floor
    walls exist the new fallback never fires and the bundle picks them
    in preference to anything else.
    """

    canonical_level_id = f"th-{house}-level-{level_short}"
    return {
        "revision": 1,
        "elements": {
            canonical_level_id: {
                "id": canonical_level_id,
                "kind": "level",
                "elevationMm": 0.0,
            },
            f"th-{house}-i-{level_short}-ext-wall-south": {
                "id": f"th-{house}-i-{level_short}-ext-wall-south",
                "kind": "wall",
                "levelId": canonical_level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 10000.0, "yMm": 0.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
            f"th-{house}-i-{level_short}-ext-wall-north": {
                "id": f"th-{house}-i-{level_short}-ext-wall-north",
                "kind": "wall",
                "levelId": canonical_level_id,
                "start": {"xMm": 0.0, "yMm": 8000.0},
                "end": {"xMm": 10000.0, "yMm": 8000.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
        },
    }


def _ir_with_openings_only(
    house: str, level_short: str, *, doors: int = 1, windows: int = 1
) -> dict:
    """IR carrying ONLY ``door`` + ``window`` facts on level-<level_short>.

    No ``room_outline``, no ``interior_partition``, no
    ``exterior_wall_chain`` — the realistic reader output described in
    issue #78 where readers infer windows from exterior elevations
    without doing room decomposition.
    """

    facts: list[dict] = []
    # Spread openings out along the 10 000 mm south wall so the
    # placed-interval overlap check in ``_openings_bundle`` doesn't
    # reject neighbours. Doors are 800 mm wide + 200 mm clearance =
    # 1000 mm footprint; windows are 1200 mm + 200 mm = 1400 mm
    # footprint. A ~2000 mm spacing leaves comfortable margin between
    # every pair.
    for i in range(doors):
        facts.append(
            {
                "factId": f"door-{i}",
                "kind": "door",
                "levelId": f"level-{level_short}",
                "widthMm": 900,
                "heightMm": 2100,
                # Sit 100 mm "into" the room off the south wall (y=0),
                # well inside the 1000 mm hosting threshold.
                "vertexMm": {"xMm": 1000.0 + (i * 2000.0), "yMm": 100.0},
            }
        )
    for i in range(windows):
        facts.append(
            {
                "factId": f"window-{i}",
                "kind": "window",
                "levelId": f"level-{level_short}",
                "widthMm": 1200,
                "heightMm": 1500,
                # Spread further to the right of the doors so the
                # 1400 mm window footprints don't overlap any door.
                "vertexMm": {"xMm": 5000.0 + (i * 2000.0), "yMm": 100.0},
            }
        )
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
        "extractedFacts": facts,
    }


# ---------- Primary regression: openings hosted on shell walls --------------


def test_openings_bundle_hosts_on_shell_walls_when_no_rooms_or_per_floor_ext_walls() -> None:
    """Issue #78 — the regression case.

    IR has 1 door + 2 windows on level-EG but NO room_outline and NO
    exterior_wall_chain facts. The snapshot contains only the shell's
    iter-prefixed walls. Pre-fix: openings bundle returned None and the
    EG facade had zero openings. Post-fix: the levelId fallback finds
    the shell walls, hosts the openings, and returns a non-None bundle
    so the per-floor authoring actually authors something.
    """

    house, iter_n, level_short = "h21", 16, "EG"
    ir = _ir_with_openings_only(house, level_short, doors=1, windows=2)
    snapshot = _shell_walls_snapshot(house, iter_n, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )

    assert result is not None, (
        "IR with door+window facts must produce an openings bundle even when only "
        "shell walls (iter-prefixed levelId) exist — pre-fix this returned None and "
        "the model rendered as a windowless barn (issue #78)."
    )
    bundle, consumed, skipped = result
    cmds = bundle.get("commands") or []
    door_cmds = [c for c in cmds if c.get("type") == "insertDoorOnWall"]
    window_cmds = [c for c in cmds if c.get("type") == "insertWindowOnWall"]
    # All three openings host (each one is well within the hosting
    # threshold) — exactly the scenario where the pre-fix dropped 9 EG
    # windows + 1 EG door on house-21 iter-16.
    assert len(door_cmds) == 1
    assert len(window_cmds) == 2
    # Wall ids must point at the SHELL walls (the only walls in the
    # snapshot) — pre-fix the filter didn't see them at all.
    shell_wall_ids = {
        f"th-{house}-i{iter_n}-eg-wall-south",
        f"th-{house}-i{iter_n}-eg-wall-north",
    }
    for c in cmds:
        assert c.get("wallId") in shell_wall_ids, (
            f"opening must host on a shell wall, got wallId={c.get('wallId')!r}"
        )
    assert "door-0" in consumed
    assert "window-0" in consumed
    assert "window-1" in consumed
    assert skipped == []


def test_openings_bundle_back_compat_prefers_canonical_per_floor_walls() -> None:
    """Pre-#78 happy path: per-floor walls (canonical levelId) authored.

    When the canonical ``th-{house}-level-EG`` filter matches walls,
    the new shell-wall fallback never fires. This pins back-compat for
    every IR that DOES carry ``exterior_wall_chain`` facts — the
    universe of currently-shipping testhouses.
    """

    house, level_short = "alpha", "EG"
    ir = _ir_with_openings_only(house, level_short, doors=1, windows=1)
    snapshot = _per_floor_walls_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )

    assert result is not None
    bundle, consumed, _skipped = result
    cmds = bundle.get("commands") or []
    canonical_wall_ids = {
        f"th-{house}-i-{level_short}-ext-wall-south",
        f"th-{house}-i-{level_short}-ext-wall-north",
    }
    for c in cmds:
        assert c.get("wallId") in canonical_wall_ids, (
            "back-compat: openings must host on canonical per-floor walls when present, "
            f"got wallId={c.get('wallId')!r}"
        )
    assert "door-0" in consumed
    assert "window-0" in consumed


def test_openings_bundle_prefers_canonical_walls_when_both_sets_present() -> None:
    """When both shell walls AND per-floor walls exist on the level, the
    canonical filter wins — the fallback is only triggered when the
    canonical match returns empty. This protects testhouses that run
    BOTH ``author-shell`` AND per-floor ``_exterior_walls_bundle`` from
    accidentally hosting openings on the redundant shell set.
    """

    house, iter_n, level_short = "alpha", 16, "EG"
    ir = _ir_with_openings_only(house, level_short, doors=1, windows=0)

    canonical_level_id = f"th-{house}-level-{level_short}"
    shell_level_id = f"th-{house}-i{iter_n}-level-{level_short}"
    snapshot = {
        "revision": 1,
        "elements": {
            canonical_level_id: {
                "id": canonical_level_id,
                "kind": "level",
                "elevationMm": 0.0,
            },
            shell_level_id: {
                "id": shell_level_id,
                "kind": "level",
                "elevationMm": 0.0,
            },
            # Per-floor wall — canonical levelId
            f"th-{house}-i-{level_short}-ext-wall-south": {
                "id": f"th-{house}-i-{level_short}-ext-wall-south",
                "kind": "wall",
                "levelId": canonical_level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 10000.0, "yMm": 0.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
            # Shell wall — iter-prefixed levelId, same XY geometry.
            f"th-{house}-i{iter_n}-eg-wall-south": {
                "id": f"th-{house}-i{iter_n}-eg-wall-south",
                "kind": "wall",
                "levelId": shell_level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 10000.0, "yMm": 0.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
        },
    }

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is not None
    bundle, _consumed, _skipped = result
    cmds = bundle.get("commands") or []
    assert len(cmds) == 1
    # Must pick the canonical per-floor wall, not the shell wall — the
    # canonical filter is non-empty so the fallback never triggers.
    assert cmds[0]["wallId"] == f"th-{house}-i-{level_short}-ext-wall-south", (
        "back-compat: canonical per-floor walls take precedence over shell walls"
    )


# ---------- IR with neither rooms nor openings: no exception, no commit -----


def test_openings_bundle_returns_none_when_ir_has_no_openings_at_all() -> None:
    """An IR with neither rooms nor openings nor walls returns None —
    not an exception, not a 409 from a stray empty commit. The per-floor
    flow already gates each ``_apply_slice_v2`` on a non-None bundle;
    None here means the openings phase is silently skipped.
    """

    house, level_short = "beta", "EG"
    ir = {
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
        # No room_outline, no interior_partition, no exterior_wall_chain,
        # no door, no window — only the levels declaration.
        "extractedFacts": [],
    }
    # Empty snapshot — nothing to host on either.
    snapshot: dict = {"revision": 1, "elements": {}}

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is None, (
        "neither walls nor opening facts → bundle stays None (no empty commit, "
        "no 409 from hybrid-slice-execute rejecting an empty phase)"
    )


def test_openings_bundle_returns_none_when_walls_exist_but_no_opening_facts() -> None:
    """Symmetric case: per-floor walls were authored but no door/window
    facts exist for the level. Bundle returns None — the openings phase
    must silently no-op rather than commit an empty command list.
    """

    house, level_short = "beta", "EG"
    ir = {
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
        "extractedFacts": [],
    }
    snapshot = _per_floor_walls_snapshot(house, level_short)

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house=house,
        level_short=level_short,
        snapshot=snapshot,
    )
    assert result is None


# ---------- Driver-level integration: rooms-None doesn't short-circuit ------


def test_author_level_inside_out_continues_to_openings_when_rooms_bundle_is_none(
    monkeypatch,  # type: ignore[no-untyped-def]
) -> None:
    """``_author_level_inside_out`` must NOT short-circuit when
    ``_rooms_bundle`` returns None — the openings phase still has to run
    so reader IRs without room_outline facts can still author windows
    and doors. Pre-fix-suspect (issue #78): driver was hypothesized to
    short-circuit; post-fix: this test pins that it doesn't.

    Stub every side-effecting helper so we can observe exactly which
    phases ``_apply_slice_v2`` is called for.
    """

    house, iter_n, level_short = "h21", 16, "EG"
    ir = _ir_with_openings_only(house, level_short, doors=1, windows=2)

    phases_committed: list[str] = []

    def _record_apply(*, phase: str, **_kw) -> dict:  # type: ignore[no-untyped-def]
        phases_committed.append(phase)
        return {"ok": True, "skipped": False, "executionState": "committed"}

    # Re-snapshot inside _author_level_inside_out — return the shell-walls
    # snapshot so the openings bundle has the iter-prefixed shell walls
    # to fall back to.
    snap = _shell_walls_snapshot(house, iter_n, level_short)
    monkeypatch.setattr(_DRV, "_current_revision", lambda **_kw: 1)
    monkeypatch.setattr(_DRV, "_snapshot", lambda **_kw: snap)
    monkeypatch.setattr(_DRV, "_apply_slice_v2", _record_apply)

    _DRV._author_level_inside_out(
        house=house,
        iter_n=iter_n,
        floor_short=level_short,
        ir=ir,
        api_base="http://example",
        model_id="model-h21",
    )

    # rooms / partitions / ext-walls all skipped (no facts of those
    # kinds) — only the openings phase committed. The crucial assertion:
    # ``eg-openings`` is in the list — pre-fix it never reached
    # _apply_slice_v2 because the bundle was None.
    assert f"{level_short.lower()}-openings" in phases_committed, (
        f"openings phase must commit even when rooms/partitions/ext-walls all "
        f"return None, got phases_committed={phases_committed}"
    )
    # And the OTHER phases did NOT commit (their bundles correctly returned None).
    assert f"{level_short.lower()}-rooms" not in phases_committed
    assert f"{level_short.lower()}-partitions" not in phases_committed
    assert f"{level_short.lower()}-exterior-walls" not in phases_committed
