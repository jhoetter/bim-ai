"""MF-driver-5 (#15): per-level rooms routing for 4-/5-level houses.

The driver's ``floor`` subcommand previously dispatched off a hard-coded
``KG|EG|DG`` slot list, so a 5-level house IR (KG/EG/OG/DG/Spitzboden)
silently dropped every room on OG + Spitzboden because no ``--floor OG``
value existed.

The fix introduces:

* ``_levels_to_process(ir)`` — discovers level entries from ``ir["levels"]``
  (filtering for the ``id`` + ``name`` fields the ``_IRSchema`` validator
  requires).
* ``_level_short_from_id(level_id)`` — extracts the slot suffix
  (``level-OG`` -> ``OG``).
* ``_author_level_inside_out(...)`` — runs rooms + partitions + ext-walls
  + openings for a single level. Used by both the legacy
  ``--floor KG|EG|DG`` entry points and the new ``--floor ALL`` mode.

Tests below pin the dispatch behaviour without invoking any MCP /
snapshot side effects — only the per-level filtering logic.
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


# ---------- _level_short_from_id ---------------------------------------------


def test_level_short_from_id_handles_stable_form() -> None:
    assert _DRV._level_short_from_id("level-KG") == "KG"
    assert _DRV._level_short_from_id("level-OG") == "OG"
    assert _DRV._level_short_from_id("level-SB") == "SB"
    assert _DRV._level_short_from_id("level-DG") == "DG"


def test_level_short_from_id_strips_prefixed_ids() -> None:
    # Some reader IRs prefix with 'th-{house}-' — strip down to the
    # last hyphenated token so the downstream short-name still works.
    assert _DRV._level_short_from_id("th-gamma-level-OG") == "OG"


def test_level_short_from_id_handles_unconventional_ids() -> None:
    assert _DRV._level_short_from_id("OG") == "OG"
    assert _DRV._level_short_from_id("") == ""


# ---------- _levels_to_process ----------------------------------------------


def _level(lid: str, name: str, **extra: object) -> dict:
    out: dict = {"id": lid, "name": name}
    out.update(extra)
    return out


def test_levels_to_process_returns_one_entry_per_level_in_order() -> None:
    ir = {
        "levels": [
            _level("level-KG", "Kellergeschoss"),
            _level("level-EG", "Erdgeschoss"),
            _level("level-DG", "Dachgeschoss"),
        ]
    }
    out = _DRV._levels_to_process(ir)
    assert [lvl["id"] for lvl in out] == ["level-KG", "level-EG", "level-DG"]


def test_levels_to_process_returns_five_entries_for_a_5_level_house() -> None:
    # testhouse-3 (gamma) shape: KG / EG / OG / DG / Spitzboden.
    # Pre-fix the driver only saw KG+EG (3 of 5 dropped); post-fix
    # ``_levels_to_process`` returns all 5 so ``--floor ALL`` can
    # author them in order.
    ir = {
        "levels": [
            _level("level-KG", "Kellergeschoss"),
            _level("level-EG", "Erdgeschoss"),
            _level("level-OG", "Obergeschoss"),
            _level("level-DG", "Dachgeschoss"),
            _level("level-SB", "Spitzboden"),
        ]
    }
    out = _DRV._levels_to_process(ir)
    assert len(out) == 5
    shorts = [_DRV._level_short_from_id(lvl["id"]) for lvl in out]
    assert shorts == ["KG", "EG", "OG", "DG", "SB"]


def test_levels_to_process_skips_malformed_entries() -> None:
    ir = {
        "levels": [
            _level("level-EG", "Erdgeschoss"),
            {"id": "level-broken"},  # missing name
            {"name": "no id"},  # missing id
            "not-a-dict",
            _level("level-DG", "Dachgeschoss"),
        ]
    }
    out = _DRV._levels_to_process(ir)
    # Only the two well-formed entries survive — but ordering is
    # preserved so EG is still authored before DG.
    assert [lvl["id"] for lvl in out] == ["level-EG", "level-DG"]


def test_levels_to_process_returns_empty_when_ir_has_no_levels() -> None:
    assert _DRV._levels_to_process({}) == []
    assert _DRV._levels_to_process({"levels": []}) == []
    assert _DRV._levels_to_process({"levels": None}) == []


# ---------- _rooms_bundle scopes to per-level facts -------------------------


def _room_fact(*, level_id: str, fact_id: str, text: str) -> dict:
    return {
        "factId": fact_id,
        "kind": "room_outline",
        "levelId": level_id,
        "text": text,
        "polygonMm": [[0, 0], [3000, 0], [3000, 4000], [0, 4000]],
    }


def test_rooms_bundle_only_sees_facts_for_the_requested_level() -> None:
    # 5-level IR. Each level has exactly one room outline. The bundle
    # for level-OG must consume the OG fact only — pre-fix this case
    # was never even reached because the argparse layer rejected
    # ``--floor OG``.
    ir = {
        "house": "gamma",
        "levels": [
            _level("level-KG", "Kellergeschoss", elevationMM=-2700, heightMM=2700),
            _level("level-EG", "Erdgeschoss", elevationMM=0, heightMM=2700),
            _level("level-OG", "Obergeschoss", elevationMM=2700, heightMM=2700),
            _level("level-DG", "Dachgeschoss", elevationMM=5400, heightMM=2400),
            _level("level-SB", "Spitzboden", elevationMM=7800, heightMM=1800),
        ],
        "extractedFacts": [
            _room_fact(level_id="level-KG", fact_id="kg-1", text="Keller"),
            _room_fact(level_id="level-EG", fact_id="eg-1", text="Wohnzimmer"),
            _room_fact(level_id="level-OG", fact_id="og-1", text="Schlafzimmer"),
            _room_fact(level_id="level-DG", fact_id="dg-1", text="Dachzimmer"),
            _room_fact(level_id="level-SB", fact_id="sb-1", text="Spitzboden-Stauraum"),
        ],
    }
    for short in ("KG", "EG", "OG", "DG", "SB"):
        result = _DRV._rooms_bundle(
            ir=ir, parent_revision=1, house="gamma", level_short=short
        )
        assert result is not None, f"expected a bundle for level-{short}"
        _bundle, consumed = result
        # Exactly one room consumed, and it's the one belonging to
        # that level — not leakage from another level.
        assert consumed == [f"{short.lower()}-1"], (
            f"level-{short} should consume only its own fact, got {consumed}"
        )


def test_rooms_bundle_returns_none_when_level_has_no_room_facts() -> None:
    # An empty level (Spitzboden as a pure attic, no rooms) returns
    # None so the driver records the phase as a no-op rather than
    # crashing — same behaviour the legacy KG/EG/DG paths relied on.
    ir = {
        "house": "gamma",
        "levels": [
            _level("level-EG", "Erdgeschoss", elevationMM=0, heightMM=2700),
            _level("level-SB", "Spitzboden", elevationMM=5400, heightMM=1800),
        ],
        "extractedFacts": [
            _room_fact(level_id="level-EG", fact_id="eg-1", text="Wohnzimmer"),
        ],
    }
    assert (
        _DRV._rooms_bundle(ir=ir, parent_revision=1, house="gamma", level_short="SB")
        is None
    )


# ---------- end-to-end shape: ALL-mode dispatch authors every level ---------


def test_all_mode_drives_every_level_in_ir_levels(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """The ``--floor ALL`` code path calls ``_author_level_inside_out``
    once per discovered level, in source order.

    We can't run the real ``_cmd_floor`` end-to-end here (it touches
    MCP, snapshots, structural-gate readouts, etc.), so instead we
    pin the dispatch by:

      * stubbing ``_load_and_validate_ir`` to return our 5-level IR,
      * stubbing ``_ensure_model`` to short-circuit the MCP call,
      * stubbing every side-effecting helper that ``_cmd_floor``
        also touches (structural gate, ortho captures, log sinks),
      * monkeypatching ``_author_level_inside_out`` itself to record
        the ``floor_short`` values it's invoked with.

    Pre-fix (#15): only KG / EG were authored when the IR had 5
    levels, because the dispatch hard-coded ``{KG, EG, DG}``. Post-
    fix: ``ALL`` mode authors every level (5 here, including OG and
    SB), each with the correct slot name.
    """

    import argparse

    five_level_ir = {
        "house": "gamma",
        "levels": [
            _level("level-KG", "Kellergeschoss", elevationMM=-2700, heightMM=2700),
            _level("level-EG", "Erdgeschoss", elevationMM=0, heightMM=2700),
            _level("level-OG", "Obergeschoss", elevationMM=2700, heightMM=2700),
            _level("level-DG", "Dachgeschoss", elevationMM=5400, heightMM=2400),
            _level("level-SB", "Spitzboden", elevationMM=7800, heightMM=1800),
        ],
        "extractedFacts": [],
    }

    seen: list[str] = []

    def _record(*, house, iter_n, floor_short, ir, api_base, model_id):  # type: ignore[no-untyped-def]
        seen.append(floor_short)

    monkeypatch.setattr(_DRV, "_load_and_validate_ir", lambda _p: five_level_ir)
    monkeypatch.setattr(_DRV, "_ensure_model", lambda **_kw: "model-gamma")
    monkeypatch.setattr(_DRV, "_author_level_inside_out", _record)
    monkeypatch.setattr(_DRV, "_attach_house_run_log_sink", lambda _h: None)
    monkeypatch.setattr(_DRV, "_run_structural_gate", lambda **_kw: None)

    args = argparse.Namespace(
        house="gamma",
        iter=9,
        floor="ALL",
        api_base="http://example",
        skip_per_iter_capture=True,
    )

    rc = _DRV._cmd_floor(args)
    assert rc == 0
    # All 5 levels, in source order — OG and SB now authored (the
    # core MF-driver-5 fix).
    assert seen == ["KG", "EG", "OG", "DG", "SB"]


def test_legacy_named_slot_dispatch_still_calls_helper_once(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """``--floor EG`` still works for backwards compatibility — it
    just delegates to ``_author_level_inside_out`` for the single
    EG slot rather than running the inlined block it used to."""

    import argparse

    three_level_ir = {
        "house": "alpha",
        "levels": [
            _level("level-KG", "Kellergeschoss", elevationMM=-2700, heightMM=2700),
            _level("level-EG", "Erdgeschoss", elevationMM=0, heightMM=2700),
            _level("level-DG", "Dachgeschoss", elevationMM=2700, heightMM=2400),
        ],
        "extractedFacts": [],
    }
    seen: list[str] = []

    def _record(*, house, iter_n, floor_short, ir, api_base, model_id):  # type: ignore[no-untyped-def]
        seen.append(floor_short)

    monkeypatch.setattr(_DRV, "_load_and_validate_ir", lambda _p: three_level_ir)
    monkeypatch.setattr(_DRV, "_ensure_model", lambda **_kw: "model-alpha")
    monkeypatch.setattr(_DRV, "_author_level_inside_out", _record)
    monkeypatch.setattr(_DRV, "_attach_house_run_log_sink", lambda _h: None)
    monkeypatch.setattr(_DRV, "_run_structural_gate", lambda **_kw: None)
    # KG branch checks the live snapshot for an existing level — stub
    # it to "no levels" so it tries to seed, then stub the seed too.
    monkeypatch.setattr(_DRV, "_snapshot", lambda **_kw: {"revision": 1, "elements": {}})
    monkeypatch.setattr(_DRV, "_project_setup_bundle", lambda **_kw: None)

    args = argparse.Namespace(
        house="alpha",
        iter=4,
        floor="EG",
        api_base="http://example",
        skip_per_iter_capture=True,
    )
    rc = _DRV._cmd_floor(args)
    assert rc == 0
    assert seen == ["EG"]
