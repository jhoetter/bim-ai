"""MF-driver-20 (#93) — dormer facts in the IR must reach the bundle.

Pre-fix, ``scripts/testhouse_drive`` had no phase that consumed
``extractedFacts[kind=dormer]`` — h23's reader IR carried 6 dormer
facts and the snapshot landed 0 dormer elements (the building read
as a windowless attic). ``_dormers_bundle`` now:

  1. Emits one ``createDormer`` per IR dormer fact hosted on the
     main roof we just authored.
  2. Honours an explicit ``positionOnRoof.alongRidgeMm`` /
     ``acrossRidgeMm`` pin from the IR when present.
  3. Auto-distributes N≥2 facts along the ridge when none of them
     carry any position hint (mirrors PR #90 for openings).
  4. Maps both ``roofKind`` and ``dormerRoofKind`` aliases to the
     engine's ``DormerRoofKind`` literal.
  5. Returns ``None`` + a warning log when the main roof has not
     been authored yet — graceful skip, no exception.
"""

from __future__ import annotations

import importlib.util
import logging
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


# ---------- shared fixtures -------------------------------------------------


def _main_roof_snapshot(house: str = "h23") -> dict:
    """Snapshot containing one main roof with a 13990 × 8984 footprint.

    Matches the h23 DG bbox the reader produces — width along x,
    depth along y, ridge runs E-W per the span heuristic.
    """

    return {
        "revision": 7,
        "elements": {
            f"th-{house}-main-roof": {
                "id": f"th-{house}-main-roof",
                "kind": "roof",
                "footprintMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 13990, "yMm": 0},
                    {"xMm": 13990, "yMm": 8984},
                    {"xMm": 0, "yMm": 8984},
                ],
            },
        },
    }


def _empty_snapshot() -> dict:
    return {"revision": 2, "elements": {}}


def _dormer_fact(
    *,
    factId: str,  # noqa: N803 — IR uses camelCase
    roofKind: str = "shed",  # noqa: N803
    widthMm: float = 1500,  # noqa: N803
    heightMm: float = 1500,  # noqa: N803
    facadeSide: str | None = "north",  # noqa: N803
    vertexMm: list[float] | None = None,  # noqa: N803
    alongRidgeMm: float | None = None,  # noqa: N803
    acrossRidgeMm: float | None = None,  # noqa: N803
    materialKey: str | None = None,  # noqa: N803
) -> dict:
    fact: dict = {
        "factId": factId,
        "kind": "dormer",
        "levelId": "level-DG",
        "roofKind": roofKind,
        "widthMm": widthMm,
        "heightMm": heightMm,
    }
    if facadeSide is not None:
        fact["facadeSide"] = facadeSide
    if vertexMm is not None:
        fact["vertexMm"] = vertexMm
    if alongRidgeMm is not None:
        fact["alongRidgeMm"] = alongRidgeMm
    if acrossRidgeMm is not None:
        fact["acrossRidgeMm"] = acrossRidgeMm
    if materialKey is not None:
        fact["materialKey"] = materialKey
    return fact


def _ir(dormers: list[dict]) -> dict:
    return {
        "levels": [{"id": "level-DG", "name": "Dachgeschoss"}],
        "extractedFacts": dormers,
    }


# ---------- core conversion -------------------------------------------------


def test_six_dormer_facts_produce_six_create_dormer_commands() -> None:
    # h23 case: 6 dormer facts, all hosting on the main roof.
    facts = [
        _dormer_fact(
            factId=f"f-d{i}",
            facadeSide="south" if i < 3 else "north",
            vertexMm=[2000 + 2000 * i, 1500 if i < 3 else 7500],
        )
        for i in range(6)
    ]
    pair = _DRV._dormers_bundle(
        ir=_ir(facts),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    assert pair is not None, "expected a bundle, got None"
    bundle, consumed = pair
    cmds = [c for c in bundle["commands"] if c["type"] == "createDormer"]
    assert len(cmds) == 6, f"expected 6 createDormer, got {len(cmds)}"
    assert len(consumed) == 6, f"expected 6 consumed factIds, got {len(consumed)}"
    # All hosted on the live main roof we found in the snapshot.
    assert {c["hostRoofId"] for c in cmds} == {"th-h23-main-roof"}
    # Each authored dormer element has a unique id (no collisions).
    assert len({c["id"] for c in cmds}) == 6


def test_dormers_without_fact_ids_get_unique_ids() -> None:
    # MF-driver-21 (#95): mirrors PR #86 for openings. When dormer
    # facts arrive without a ``factId`` (or any slug-able field),
    # ``_slugify(None)`` collapses to the literal ``"x"`` and every
    # dormer used to author as ``th-{house}-dormer-x`` — N facts
    # produced 1 element and the apply call failed with
    # ``duplicate element id 'th-{house}-dormer-x'``. The fix threads
    # the enumerate idx into the id template.
    facts: list[dict] = []
    for i in range(6):
        fact = _dormer_fact(
            factId="",  # noqa — intentionally empty to drive _slugify(None) → "x"
            facadeSide="south" if i < 3 else "north",
            vertexMm=[2000 + 2000 * i, 1500 if i < 3 else 7500],
        )
        # _dormer_fact always writes factId; strip it so _slugify falls
        # through to "x" and we exercise the collision path.
        fact.pop("factId", None)
        facts.append(fact)
    pair = _DRV._dormers_bundle(
        ir=_ir(facts),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    assert pair is not None, "expected a bundle, got None"
    bundle, _ = pair
    cmds = [c for c in bundle["commands"] if c["type"] == "createDormer"]
    assert len(cmds) == 6, f"expected 6 createDormer, got {len(cmds)}"
    ids = [c["id"] for c in cmds]
    assert len(set(ids)) == 6, f"expected 6 unique ids, got {ids}"
    # None of the authored ids may match the bare ``th-…-dormer-x``
    # collapse — that was the exact collision signature on h23 iter-22
    # (mirrors PR #86's ``-window-x`` guard for openings).
    assert all(not i.endswith("-dormer-x") for i in ids), (
        f"no id may end in the literal '-dormer-x' (the slugify-None "
        f"collapse), got {ids}"
    )


def test_explicit_along_ridge_offsets_are_honoured_verbatim() -> None:
    # Reader pinned each dormer in roof-local coords — _dormers_bundle
    # must NOT recompute from world XY; it must use the pin.
    facts = [
        _dormer_fact(
            factId="f-a",
            alongRidgeMm=-4000,
            acrossRidgeMm=2000,
            facadeSide=None,
            vertexMm=None,
        ),
        _dormer_fact(
            factId="f-b",
            alongRidgeMm=0,
            acrossRidgeMm=-2000,
            facadeSide=None,
            vertexMm=None,
        ),
        _dormer_fact(
            factId="f-c",
            alongRidgeMm=4000,
            acrossRidgeMm=2000,
            facadeSide=None,
            vertexMm=None,
        ),
    ]
    pair = _DRV._dormers_bundle(
        ir=_ir(facts),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    assert pair is not None
    bundle, _ = pair
    pos_by_id = {c["id"]: c["positionOnRoof"] for c in bundle["commands"]}
    alongs = sorted(p["alongRidgeMm"] for p in pos_by_id.values())
    assert alongs == [-4000.0, 0.0, 4000.0], (
        f"expected explicit alongRidgeMm honoured verbatim, got {alongs}"
    )


def test_autodistribute_when_no_position_hint_spreads_along_ridge() -> None:
    # 4 dormers, NONE with vertexMm / facadeSide / alongRidgeMm /
    # centerXMm. Pre-fix every dormer landed on the roof center and
    # only the first survived the renderer's overlap merge. The
    # bundle must spread them evenly along the ridge.
    facts = [
        _dormer_fact(factId=f"f-noinfo-{i}", facadeSide=None, vertexMm=None)
        for i in range(4)
    ]
    pair = _DRV._dormers_bundle(
        ir=_ir(facts),
        parent_revision=7,
        house="h21",
        snapshot=_main_roof_snapshot("h21"),
    )
    assert pair is not None
    bundle, _ = pair
    alongs = [c["positionOnRoof"]["alongRidgeMm"] for c in bundle["commands"]]
    # All distinct (the whole point of autodistribute).
    assert len(set(alongs)) == 4, f"expected 4 distinct alongRidgeMm, got {alongs}"
    # Sorted, the spread is symmetric around 0 inside the ridge span.
    sorted_alongs = sorted(alongs)
    assert sorted_alongs[0] < 0 < sorted_alongs[-1]
    assert abs(sorted_alongs[0] + sorted_alongs[-1]) < 1.0, (
        f"expected symmetric spread around 0, got {sorted_alongs}"
    )


def test_roof_kind_alias_maps_to_dormer_roof_kind_literal() -> None:
    # Reader's ``roofKind`` field is honoured as an alias for
    # ``dormerRoofKind``. "flat" / "shed" / "gable" / "hipped" map
    # verbatim; junk values fall back to "shed".
    facts = [
        _dormer_fact(factId="f-flat", roofKind="flat", alongRidgeMm=-3000),
        _dormer_fact(factId="f-shed", roofKind="shed", alongRidgeMm=-1000),
        _dormer_fact(factId="f-gable", roofKind="gable", alongRidgeMm=1000),
        _dormer_fact(factId="f-hip", roofKind="hipped", alongRidgeMm=3000),
        _dormer_fact(factId="f-garbage", roofKind="banana", alongRidgeMm=5000),
    ]
    pair = _DRV._dormers_bundle(
        ir=_ir(facts),
        parent_revision=7,
        house="h21",
        snapshot=_main_roof_snapshot("h21"),
    )
    assert pair is not None
    bundle, _ = pair
    kind_by_id = {c["id"].split("-")[-1]: c["dormerRoofKind"] for c in bundle["commands"]}
    assert kind_by_id["flat"] == "flat"
    assert kind_by_id["shed"] == "shed"
    assert kind_by_id["gable"] == "gable"
    assert kind_by_id["hip"] == "hipped"
    # Garbage maps to shed (engine literal would otherwise reject).
    assert kind_by_id["garbage"] == "shed"
    # Gable / hipped variants set the required ridgeHeightMm.
    for cmd in bundle["commands"]:
        if cmd["dormerRoofKind"] in ("gable", "hipped"):
            assert cmd.get("ridgeHeightMm", 0) > cmd["wallHeightMm"], (
                f"gable/hipped dormer must carry a ridge above its walls: {cmd}"
            )


# ---------- graceful-degrade paths ------------------------------------------


def test_no_dormer_facts_returns_none() -> None:
    # h22 case: IR carries no dormer facts at all. Function must
    # return None silently — no exception, no bogus command.
    ir = {
        "levels": [{"id": "level-DG", "name": "Dachgeschoss"}],
        "extractedFacts": [
            {"factId": "f-r", "kind": "ridge_height", "valueMm": 9500},
        ],
    }
    out = _DRV._dormers_bundle(
        ir=ir, parent_revision=7, house="h22", snapshot=_main_roof_snapshot("h22")
    )
    assert out is None


def test_main_roof_missing_skips_with_warning() -> None:
    # ROOF phase skipped (e.g. _roof_bundle returned None because the
    # DG chain was malformed). Dormer phase must not raise and must
    # surface a structured warning the operator can grep on.
    #
    # The driver's logger sets ``propagate=False`` and attaches its
    # own JSON-to-stderr handler at import time, so ``caplog`` /
    # ``capsys`` both miss the record (the handler holds the
    # PRE-pytest stderr reference). Instead, attach a transient
    # in-memory ``Handler`` for the duration of the call and inspect
    # what it captured.
    captured: list[logging.LogRecord] = []

    class _CaptureHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

    handler = _CaptureHandler(level=logging.WARNING)
    _DRV.logger.addHandler(handler)
    try:
        facts = [_dormer_fact(factId=f"f-d{i}") for i in range(3)]
        out = _DRV._dormers_bundle(
            ir=_ir(facts),
            parent_revision=3,
            house="h23",
            snapshot=_empty_snapshot(),
        )
    finally:
        _DRV.logger.removeHandler(handler)

    assert out is None, "expected graceful skip when main roof missing"
    warnings = [r for r in captured if r.levelno >= logging.WARNING]
    assert any("dormers_skipped_no_roof" in r.getMessage() for r in warnings), (
        f"expected 'dormers_skipped_no_roof' warning, got: "
        f"{[r.getMessage() for r in warnings]}"
    )
    # The warning carries the dormer fact count so the operator can
    # see exactly how many facts were dropped.
    rec = next(r for r in warnings if "dormers_skipped_no_roof" in r.getMessage())
    assert getattr(rec, "dormer_fact_count", None) == 3


# ---------- world-XY conversion + ridge orientation -------------------------


def test_world_xy_vertex_projects_to_signed_along_across() -> None:
    # vertexMm at (10000, 1500) on a 13990 × 8984 roof centred at
    # (6995, 4492). Ridge runs E-W (span_x > span_y), so along =
    # x - center_x = +3005, across = y - center_y = -2992.
    facts = [_dormer_fact(factId="f-pos", facadeSide="south", vertexMm=[10000, 1500])]
    pair = _DRV._dormers_bundle(
        ir=_ir(facts),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    assert pair is not None
    bundle, _ = pair
    pos = bundle["commands"][0]["positionOnRoof"]
    assert abs(pos["alongRidgeMm"] - 3005.0) < 1.0, pos
    # vertex y=1500 is near the south wall (y=0), so it's shifted
    # inward to y≈8084 by the wall-edge guard... actually y=1500 is
    # NOT within 100 mm of the y=0 wall, so it stays put → across
    # ≈ 1500 - 4492 = -2992.
    assert abs(pos["acrossRidgeMm"] - (-2992.0)) < 1.0, pos


# ---------- MF-driver-22 (#97): single-dormer wallStartMm hint --------------


def test_single_dormer_with_wall_start_list_resolves_to_one_command() -> None:
    # Pre-fix: a lone dormer fact carrying ONLY ``wallStartMm`` (list
    # shape) — no vertexMm / polygonMm / centerXMm / explicit pin —
    # fell through ``_dormer_center_xy`` (returns None) and the
    # ``>= 2`` autodistribute floor never engaged for N=1, so the
    # bundle silently dropped the fact and returned None.
    fact = _dormer_fact(
        factId="f-ws-list",
        facadeSide=None,
        vertexMm=None,
    )
    fact["wallStartMm"] = [5000, 0]  # list shape (alpha)
    pair = _DRV._dormers_bundle(
        ir=_ir([fact]),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    assert pair is not None, (
        "expected wallStartMm-list to resolve into 1 createDormer (was None)"
    )
    bundle, consumed = pair
    cmds = [c for c in bundle["commands"] if c["type"] == "createDormer"]
    assert len(cmds) == 1, f"expected 1 createDormer, got {len(cmds)}"
    assert len(consumed) == 1


def test_single_dormer_with_wall_start_dict_resolves_to_one_command() -> None:
    # Same as above but PR #28's dict shape: ``{xMm, yMm}`` instead of
    # the list pair. ``_coerce_vertex_mm`` normalises both into the
    # same ``[x, y]`` float list before the wall-edge inward shift.
    fact = _dormer_fact(
        factId="f-ws-dict",
        facadeSide=None,
        vertexMm=None,
    )
    fact["wallStartMm"] = {"xMm": 5000, "yMm": 0}  # dict shape (beta/gamma)
    pair = _DRV._dormers_bundle(
        ir=_ir([fact]),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    assert pair is not None, (
        "expected wallStartMm-dict to resolve into 1 createDormer (was None)"
    )
    bundle, consumed = pair
    cmds = [c for c in bundle["commands"] if c["type"] == "createDormer"]
    assert len(cmds) == 1, f"expected 1 createDormer, got {len(cmds)}"
    assert len(consumed) == 1


def test_single_dormer_with_no_position_hint_at_all_is_still_skipped() -> None:
    # Guardrail: the issue explicitly says NOT to lower the ``>= 2``
    # autodistribute floor. A lone dormer with no position hint
    # whatsoever (no vertexMm / polygonMm / centerXMm / wallStartMm /
    # facadeSide / explicit pin) must still be skipped — we only added
    # ``wallStartMm`` as an additional resolution path, not a default
    # "drop it in the middle" fallback for N=1.
    fact = _dormer_fact(
        factId="f-nohint",
        facadeSide=None,
        vertexMm=None,
    )
    pair = _DRV._dormers_bundle(
        ir=_ir([fact]),
        parent_revision=7,
        house="h23",
        snapshot=_main_roof_snapshot("h23"),
    )
    # With no hint at all and N=1, autodistribute floor (>= 2) does
    # not engage and _dormer_center_xy returns None → fact dropped,
    # commands list empty, bundle returns None.
    assert pair is None, (
        "single dormer with no position hint must still be skipped — "
        "we did NOT lower the >= 2 autodistribute floor"
    )
