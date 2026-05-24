"""MF-driver-17 (#87): every level's ``-openings`` phase actually authors
its IR-declared windows + doors — not just DG.

Pre-fix symptom (house-21 iter-18, after PR #86 closed #85): the IR
carried 17 windows + 1 door spread across KG / EG / OG / DG, but the
snapshot only landed 5 windows + 1 door — a ~30 % authoring rate. The
driver logs showed only the ``dg-openings`` phase producing commands;
KG / EG / OG-openings either fail silently or are skipped.

Root cause: the per-level openings phase in
``_author_level_inside_out`` ran for every level discovered by
``_levels_to_process(ir)`` (the ``--floor ALL`` fan-out from PR #34
landed correctly), BUT ``_openings_bundle`` returned ``None`` for
levels that had opening facts without a matching ``exterior_wall_chain``
fact:

* The canonical wall filter (``levelId == th-{house}-level-{slot}``)
  only matched walls authored by ``_exterior_walls_bundle`` for that
  slot, which in turn only ran when the IR carried an
  ``exterior_wall_chain`` fact for that slot.
* PR #84's suffix fallback (``-level-{slot}``) only caught walls
  authored by the shell phase, and ``_shell_bundle_from_ir`` ONLY
  emits EG-level walls — so KG / OG / DG all returned ``None`` from
  ``_openings_bundle`` and the openings phase committed an empty
  bundle (or no bundle at all).

The fix mirrors the existing partitions-from-EG fallback pattern
(``_partitions_bundle`` already does this for interior walls): when
a non-EG level has door / window / room facts but no
``exterior_wall_chain`` of its own, ``_exterior_walls_bundle`` now
mirrors EG's chain to that level. The mirrored walls land at the
canonical per-level ``levelId`` so ``_openings_bundle`` finds them via
its primary filter — openings then host on real per-level walls at
the correct elevation (NOT on shell EG walls, which would dump every
upper-floor window onto the EG facade).

The dispatch shape (``--floor ALL`` -> per-level fan-out) is pinned by
``test_testhouse_drive_per_level_rooms.py``; this file pins the
density invariant: every level's openings phase fires AND actually
emits the expected number of insert commands.
"""

from __future__ import annotations

import argparse
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


# ---------- helpers ---------------------------------------------------------


def _level(lid: str, name: str, **extra: object) -> dict:
    out: dict = {"id": lid, "name": name, "elevationMM": 0, "heightMM": 2700}
    out.update(extra)
    return out


def _window(*, level_id: str, fact_id: str, x: float, y: float = 100.0) -> dict:
    return {
        "factId": fact_id,
        "kind": "window",
        "levelId": level_id,
        "widthMm": 1200,
        "heightMm": 1500,
        "vertexMm": {"xMm": x, "yMm": y},
    }


def _door(*, level_id: str, fact_id: str, x: float, y: float = 100.0) -> dict:
    return {
        "factId": fact_id,
        "kind": "door",
        "levelId": level_id,
        "widthMm": 900,
        "heightMm": 2100,
        "vertexMm": {"xMm": x, "yMm": y},
    }


def _eg_chain_fact() -> dict:
    """Single ``exterior_wall_chain`` fact for the 20 m × 12 m EG perimeter.

    Wide enough that 5 windows on the south wall don't trip the
    placed-interval overlap check in ``_openings_bundle``.
    """

    return {
        "factId": "eg-chain",
        "kind": "exterior_wall_chain",
        "levelId": "level-EG",
        "polygonMm": [[0, 0], [20000, 0], [20000, 12000], [0, 12000]],
    }


def _multi_level_ir_with_openings_only_on_eg(
    *, windows_per_level: dict[str, int], doors_per_level: dict[str, int] | None = None
) -> dict:
    """Build a 4-level IR (KG / EG / OG / DG) carrying window facts on
    EVERY level but only an ``exterior_wall_chain`` on EG.

    This is the exact IR shape that triggered #87: reader produced
    door / window facts for each storey but only one global
    exterior_wall_chain on EG (since the footprint repeats vertically).
    Pre-fix, only EG-openings actually emitted commands; post-fix the
    EG chain mirrors to KG / OG / DG so each level's openings phase
    hosts on its own per-level walls.
    """

    doors_per_level = doors_per_level or {}
    facts: list[dict] = [_eg_chain_fact()]
    for slot, n_win in windows_per_level.items():
        for i in range(n_win):
            facts.append(
                _window(
                    level_id=f"level-{slot}",
                    fact_id=f"{slot.lower()}-window-{i}",
                    # Spread along the 20 m south wall in 3000 mm steps so
                    # the 1400 mm window footprints never overlap. Start
                    # 2000 mm from the wall start to keep clear of the
                    # corner-margin guard.
                    x=2000.0 + (i * 3000.0),
                )
            )
        for i in range(doors_per_level.get(slot, 0)):
            facts.append(
                _door(
                    level_id=f"level-{slot}",
                    fact_id=f"{slot.lower()}-door-{i}",
                    # Doors on the north wall so they never overlap-conflict
                    # with windows on the south wall (y=12000 less 100 mm
                    # margin inward = y=11900).
                    x=2000.0 + (i * 3000.0),
                    y=11900.0,
                )
            )
    return {
        "house": "h21",
        "levels": [
            _level("level-KG", "Kellergeschoss", elevationMM=-2700),
            _level("level-EG", "Erdgeschoss", elevationMM=0),
            _level("level-OG", "Obergeschoss", elevationMM=2700),
            _level("level-DG", "Dachgeschoss", elevationMM=5400, heightMM=2400),
        ],
        "exteriorWallChainEG": {
            "polygonMM": [[0, 0], [20000, 0], [20000, 12000], [0, 12000]],
            "wallThicknessMM": 365,
        },
        "extractedFacts": facts,
    }


def _per_floor_walls_snapshot(*, house: str, level_short: str) -> dict:
    """Snapshot mirroring what ``_exterior_walls_bundle`` emits for one level.

    Used after running the per-level walls bundle to feed
    ``_openings_bundle`` with realistic per-level walls.
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
            f"th-{house}-i-{level_short}-ext-wall-0": {
                "id": f"th-{house}-i-{level_short}-ext-wall-0",
                "kind": "wall",
                "levelId": canonical_level_id,
                "start": {"xMm": 0.0, "yMm": 0.0},
                "end": {"xMm": 20000.0, "yMm": 0.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
            f"th-{house}-i-{level_short}-ext-wall-2": {
                "id": f"th-{house}-i-{level_short}-ext-wall-2",
                "kind": "wall",
                "levelId": canonical_level_id,
                "start": {"xMm": 20000.0, "yMm": 12000.0},
                "end": {"xMm": 0.0, "yMm": 12000.0},
                "heightMm": 2700.0,
                "thicknessMm": 365.0,
            },
        },
    }


# ---------- 1) exterior wall mirror is the root cause -----------------------


def test_exterior_walls_bundle_mirrors_eg_chain_to_kg_when_kg_has_window_facts() -> None:
    """The core MF-driver-17 (#87) fix.

    Pre-fix: ``_exterior_walls_bundle(level_short='KG')`` returned ``None``
    because there was no KG-level ``exterior_wall_chain`` fact, even
    though the IR clearly declared KG windows. The downstream
    ``_openings_bundle`` then found no KG walls (canonical filter empty,
    and the shell phase only emits EG walls) and dropped every KG window.

    Post-fix: mirror the EG chain to KG so KG gets its own per-level
    wall ring at the canonical ``th-{house}-level-KG`` id. The
    openings phase's primary wall filter now matches and KG windows
    actually host.
    """

    ir = _multi_level_ir_with_openings_only_on_eg(
        windows_per_level={"KG": 3, "EG": 0, "OG": 0, "DG": 0}
    )
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="h21", level_short="KG"
    )
    assert pair is not None, (
        "KG must produce a wall bundle (mirrored from EG) when KG has "
        "opening facts but no exterior_wall_chain fact — pre-fix this "
        "returned None and KG-openings dropped silently."
    )
    bundle, _consumed = pair
    cmds = bundle.get("commands") or []
    walls = [c for c in cmds if c.get("type") == "createWall"]
    slabs = [c for c in cmds if c.get("type") == "createFloor"]
    assert len(walls) == 4, f"4 walls from the 4-edge EG polygon, got {len(walls)}"
    assert len(slabs) == 1, "one slab per chain (mirrored)"
    # Mirrored walls land at the canonical KG levelId so the openings
    # filter finds them.
    for w in walls:
        assert w["levelId"] == "th-h21-level-KG", (
            f"mirrored wall must land at the canonical KG levelId, "
            f"got {w['levelId']!r}"
        )


def test_exterior_walls_bundle_does_not_mirror_when_level_has_no_openings() -> None:
    """Symmetric: an OG level with NEITHER openings NOR rooms still
    returns ``None`` — we only synthesise walls when there's something
    on the level that needs to host against them. This stops
    accidentally authoring redundant floors for attic levels (Spitzboden
    typically has no openings).
    """

    ir = {
        "house": "h21",
        "levels": [
            _level("level-EG", "Erdgeschoss"),
            _level("level-OG", "Obergeschoss"),
        ],
        "exteriorWallChainEG": {
            "polygonMM": [[0, 0], [10000, 0], [10000, 8000], [0, 8000]],
            "wallThicknessMM": 365,
        },
        "extractedFacts": [_eg_chain_fact()],  # only the EG chain — no OG facts
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="h21", level_short="OG"
    )
    assert pair is None, (
        "OG with no openings, no rooms, no chain → bundle stays None; "
        "we don't synthesise walls speculatively."
    )


def test_exterior_walls_bundle_does_not_mirror_when_level_has_its_own_chain() -> None:
    """Back-compat: when a level DOES carry its own ``exterior_wall_chain``
    fact, that chain is used directly — the EG mirror never fires. Pins
    that every currently-shipping testhouse (h13 multi-chain, all alpha
    / beta / gamma single-chain-per-level layouts) keeps the same wall
    output post-fix.
    """

    ir = {
        "house": "h13",
        "levels": [
            _level("level-EG", "Erdgeschoss"),
            _level("level-DG", "Dachgeschoss"),
        ],
        "exteriorWallChainEG": {
            "polygonMM": [[0, 0], [10000, 0], [10000, 8000], [0, 8000]],
            "wallThicknessMM": 365,
        },
        "extractedFacts": [
            _eg_chain_fact(),
            # Distinct DG chain — different polygon to prove DG uses ITS
            # OWN fact, not an EG mirror.
            {
                "factId": "dg-chain",
                "kind": "exterior_wall_chain",
                "levelId": "level-DG",
                "polygonMm": [[0, 0], [8000, 0], [8000, 6000], [0, 6000]],
            },
            # DG also has a window so the mirror PRECONDITION (openings
            # present) is satisfied — proving the back-compat guard
            # (own chain wins) and not the absence of openings.
            _window(level_id="level-DG", fact_id="dg-win", x=4000.0),
        ],
    }
    pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="h13", level_short="DG"
    )
    assert pair is not None
    bundle, _consumed = pair
    walls = [c for c in (bundle.get("commands") or []) if c.get("type") == "createWall"]
    # The DG-own polygon has 4 edges. The EG polygon would have 4 edges
    # too — so check the actual coordinates land on the DG-own polygon
    # (max x = 8000, not 20000 as the helper EG chain uses).
    max_x = max(w["end"]["xMm"] for w in walls)
    assert max_x == 8000.0, (
        f"DG must use its OWN exterior_wall_chain when present (max x=8000, "
        f"the DG polygon), not mirror from EG (would give max x=20000). "
        f"got max x={max_x}"
    )


# ---------- 2) end-to-end: per-level openings density via --floor ALL -------


def test_all_mode_authors_every_levels_windows_not_just_one_level(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """The headline issue test: an IR with windows on EG / DG / OG
    must produce ONE insertWindowOnWall command per IR window across
    ALL levels — not just the DG ones.

    Pre-fix (house-21 iter-18 symptom): 17 IR windows produced 5
    authoring commands (~30 %). Post-fix: 12 IR windows here produce
    12 commands (100 %).

    We pin the dispatch by stubbing every side-effecting helper
    ``_cmd_floor`` touches and recording the bundles that
    ``_apply_slice_v2`` is asked to commit. The recorded bundles let
    us count insert commands per phase.
    """

    ir = _multi_level_ir_with_openings_only_on_eg(
        # 5 EG + 4 DG + 3 OG = 12 IR-declared windows
        windows_per_level={"KG": 0, "EG": 5, "OG": 3, "DG": 4},
    )

    # Record the (phase, bundle) for every commit attempt.
    commits: list[tuple[str, dict]] = []

    def _record_apply(*, phase: str, bundle: dict, **_kw) -> dict:  # type: ignore[no-untyped-def]
        commits.append((phase, bundle))
        return {"ok": True, "skipped": False, "executionState": "committed"}

    # Track the per-level walls a previous phase has authored so the
    # openings phase sees realistic snapshot state. The driver alternates
    # ``_current_revision`` and ``_snapshot`` calls; we update the
    # snapshot in-place as walls land.
    snapshot: dict = {"revision": 1, "elements": {}}

    def _stub_snapshot(**_kw):  # type: ignore[no-untyped-def]
        # Return a fresh copy so the driver doesn't mutate our state in
        # ways that affect later phases.
        return {
            "revision": int(snapshot.get("revision") or 1),
            "elements": dict(snapshot.get("elements") or {}),
        }

    def _stub_current_revision(**_kw) -> int:  # type: ignore[no-untyped-def]
        return int(snapshot.get("revision") or 1)

    # When walls are committed, materialise them in the snapshot so
    # openings have hosts. The ``ext-wall-{i}`` ids the bundle uses
    # match what ``_per_floor_walls_snapshot`` produces — we just copy
    # the bundle's createWall commands into snapshot.elements.
    def _ingest_wall_commits(phase: str, bundle: dict) -> None:
        if not phase.endswith("-exterior-walls"):
            return
        for c in bundle.get("commands") or []:
            if c.get("type") != "createWall":
                continue
            wall = {
                "id": c["id"],
                "kind": "wall",
                "levelId": c["levelId"],
                "start": c["start"],
                "end": c["end"],
                "heightMm": c.get("heightMm"),
                "thicknessMm": c.get("thicknessMm"),
            }
            snapshot["elements"][c["id"]] = wall

    def _record_and_ingest(*, phase: str, bundle: dict, **kw):  # type: ignore[no-untyped-def]
        commits.append((phase, bundle))
        _ingest_wall_commits(phase, bundle)
        return {"ok": True, "skipped": False, "executionState": "committed"}

    monkeypatch.setattr(_DRV, "_load_and_validate_ir", lambda _p: ir)
    monkeypatch.setattr(_DRV, "_ensure_model", lambda **_kw: "model-h21")
    monkeypatch.setattr(_DRV, "_attach_house_run_log_sink", lambda _h: None)
    monkeypatch.setattr(_DRV, "_run_structural_gate", lambda **_kw: None)
    monkeypatch.setattr(_DRV, "_current_revision", _stub_current_revision)
    monkeypatch.setattr(_DRV, "_snapshot", _stub_snapshot)
    monkeypatch.setattr(_DRV, "_apply_slice_v2", _record_and_ingest)
    # The KG branch also calls _apply_slice (v1) for project-setup; stub
    # that too so it's a no-op.
    monkeypatch.setattr(
        _DRV,
        "_apply_slice",
        lambda **_kw: {"ok": True, "skipped": False, "executionState": "committed"},
    )
    monkeypatch.setattr(_DRV, "_project_setup_bundle", lambda **_kw: None)

    args = argparse.Namespace(
        house="h21",
        iter=18,
        floor="ALL",
        api_base="http://example",
        skip_per_iter_capture=True,
    )
    rc = _DRV._cmd_floor(args)
    assert rc == 0

    # 1) Every level's openings phase fired exactly once.
    openings_phases = [
        phase for phase, _bundle in commits if phase.endswith("-openings")
    ]
    assert openings_phases == ["eg-openings", "og-openings", "dg-openings"], (
        # KG has 0 windows -> its bundle stays None and the phase is
        # silently skipped (no _apply_slice_v2 call). The non-empty
        # levels MUST all fire — pre-fix only dg-openings (or fewer)
        # appeared here for h21.
        f"every non-empty level must produce one openings commit in IR "
        f"order, got openings_phases={openings_phases}"
    )

    # 2) The union of all openings commits hosts every IR-declared
    #    window — 12 of 12. Pre-fix the count was ~5/12 (~40 %).
    window_cmd_count = 0
    for phase, bundle in commits:
        if not phase.endswith("-openings"):
            continue
        for c in bundle.get("commands") or []:
            if c.get("type") == "insertWindowOnWall":
                window_cmd_count += 1
    assert window_cmd_count == 12, (
        f"every IR-declared window must produce one insertWindowOnWall "
        f"command (5 EG + 3 OG + 4 DG = 12). pre-fix this was ~5/12 — "
        f"the famous 30 % authoring-rate symptom. got {window_cmd_count}/12"
    )


def test_single_floor_ir_regression_unchanged(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Regression guard: a single-floor IR (only EG, with its own chain)
    still produces the same openings count as before — the mirror
    fallback is gated on ``level_short != 'EG'`` so EG's own chain is
    used directly. Pins testhouse-1 / alpha / beta single-storey
    convergence cases unchanged.
    """

    # Three windows on EG, plus an EG exterior_wall_chain fact.
    ir = {
        "house": "alpha",
        "levels": [_level("level-EG", "Erdgeschoss")],
        "exteriorWallChainEG": {
            "polygonMM": [[0, 0], [20000, 0], [20000, 12000], [0, 12000]],
            "wallThicknessMM": 365,
        },
        "extractedFacts": [
            _eg_chain_fact(),
            _window(level_id="level-EG", fact_id="eg-w-0", x=2000.0),
            _window(level_id="level-EG", fact_id="eg-w-1", x=5500.0),
            _window(level_id="level-EG", fact_id="eg-w-2", x=9000.0),
        ],
    }
    # Snapshot already carries the per-floor EG walls (pre-existing
    # convergence run); openings should match against the canonical
    # levelId without ever consulting the EG-mirror code path.
    snap = _per_floor_walls_snapshot(house="alpha", level_short="EG")

    result = _DRV._openings_bundle(
        ir=ir,
        parent_revision=1,
        house="alpha",
        level_short="EG",
        snapshot=snap,
    )
    assert result is not None
    bundle, consumed, skipped = result
    window_cmds = [
        c for c in bundle.get("commands") or [] if c.get("type") == "insertWindowOnWall"
    ]
    assert len(window_cmds) == 3, (
        f"single-floor IR regression: all 3 EG windows must still host, "
        f"got {len(window_cmds)}/3 (skipped={skipped})"
    )
    assert sorted(consumed) == ["eg-w-0", "eg-w-1", "eg-w-2"]
    # And: ext-walls bundle for the same EG level still uses the IR's
    # OWN chain (mirror path is gated on level_short != 'EG').
    ext_pair = _DRV._exterior_walls_bundle(
        ir=ir, parent_revision=1, house="alpha", level_short="EG"
    )
    assert ext_pair is not None
    ext_bundle, ext_consumed = ext_pair
    # Same evidence string as pre-fix (NOT the mirror evidence) — pins
    # that the back-compat path is the one taken.
    assumption = ext_bundle["assumptions"][0]
    assert "mirror" not in assumption["evidence"].lower(), (
        f"EG must NEVER trigger the mirror fallback (gated on "
        f"level_short != 'EG'), got evidence={assumption['evidence']!r}"
    )
    assert "eg-chain" in ext_consumed
