"""Level datum chain propagation, validation advisers, replay diagnostics."""

from __future__ import annotations

import os
import time

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem
from bim_ai.engine import bundle_replay_diagnostics, clone_document, try_commit_bundle
from bim_ai.level_datum_propagation_evidence import build_level_elevation_propagation_evidence_v0


def test_create_level_derives_child_elevation_from_parent_offset_and_propagates_on_move():
    doc = Document(
        revision=1,
        elements={
            "lvl-a": LevelElem(kind="level", id="lvl-a", name="A", elevationMm=100),
            "lvl-gr": LevelElem(kind="level", id="lvl-gr", name="Root", elevationMm=-50),
            "lvl-b": LevelElem(
                kind="level",
                id="lvl-b",
                name="B",
                elevationMm=-50 + 2750,
                parentLevelId="lvl-gr",
                offsetFromParentMm=2750,
            ),
        },
    )

    cmds: list[dict[str, object]] = [
        {
            "type": "createLevel",
            "id": "lvl-dep",
            "name": "Dep",
            "elevationMm": 77_777,
            "parentLevelId": "lvl-a",
            "offsetFromParentMm": 3200,
        },
        {"type": "moveLevelElevation", "levelId": "lvl-gr", "elevationMm": 0},
    ]
    ok, new_doc, _c, _v, code = try_commit_bundle(doc, cmds)
    assert ok is True
    assert code == "ok"
    assert new_doc is not None
    dep = new_doc.elements["lvl-dep"]
    assert isinstance(dep, LevelElem)
    assert abs(dep.elevation_mm - (100 + 3200)) < 1e-3

    b = new_doc.elements["lvl-b"]
    assert isinstance(b, LevelElem)
    assert abs(b.elevation_mm - (0 + 2750)) < 1e-3

    cmds2 = [{"type": "moveLevelElevation", "levelId": "lvl-a", "elevationMm": 250}]
    ok2, nd2, *_ = try_commit_bundle(new_doc, cmds2)
    assert ok2 is True
    assert nd2 is not None
    dep2 = nd2.elements["lvl-dep"]
    assert isinstance(dep2, LevelElem)
    assert abs(dep2.elevation_mm - (250 + 3200)) < 1e-3
    bb = nd2.elements["lvl-b"]
    assert isinstance(bb, LevelElem)
    assert abs(bb.elevation_mm - 2750) < 1e-3


def test_wall_height_tracks_dependent_levels_after_chain_propagation():
    doc = Document(
        revision=1,
        elements={"lvl-bot": LevelElem(kind="level", id="lvl-bot", name="Bot", elevationMm=0)},
    )
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLevel",
                "id": "lvl-top",
                "name": "Top",
                "parentLevelId": "lvl-bot",
                "offsetFromParentMm": 3000,
                "elevationMm": 0,
            },
            {
                "type": "createWall",
                "id": "w1",
                "name": "Hosted",
                "levelId": "lvl-bot",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 5000, "yMm": 0},
                "thicknessMm": 200,
                "baseConstraintLevelId": "lvl-bot",
                "topConstraintLevelId": "lvl-top",
            },
        ],
    )
    assert ok is True
    assert nd is not None
    w = nd.elements["w1"]
    assert isinstance(w, WallElem)
    assert abs(w.height_mm - 3000.0) < 1.0

    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [{"type": "moveLevelElevation", "levelId": "lvl-bot", "elevationMm": 200}],
    )
    assert ok2 is True
    assert nd2 is not None
    w2 = nd2.elements["w1"]
    assert isinstance(w2, WallElem)
    assert abs(w2.height_mm - 3000.0) < 1.0
    lt = nd2.elements["lvl-top"]
    assert isinstance(lt, LevelElem)
    assert abs(lt.elevation_mm - 3200.0) < 1e-3


def test_constraints_level_datum_parent_offset_mismatch_sorted_ids():
    p = LevelElem(kind="level", id="lvl-p", name="P", elevationMm=0)
    c = LevelElem(
        kind="level",
        id="lvl-c",
        name="C",
        elevationMm=5000,
        parentLevelId="lvl-p",
        offsetFromParentMm=3000,
    )
    viols = evaluate({"lvl-p": p, "lvl-c": c})
    v = next(x for x in viols if x.rule_id == "level_datum_parent_offset_mismatch")
    assert v.element_ids == sorted(["lvl-c", "lvl-p"])


def test_constraints_level_datum_parent_cycle_sorted_ids():
    a = LevelElem(
        kind="level",
        id="lvl-loop-a",
        name="LA",
        elevationMm=0,
        parentLevelId="lvl-loop-b",
        offsetFromParentMm=100,
    )
    b = LevelElem(
        kind="level",
        id="lvl-loop-b",
        name="LB",
        elevationMm=200,
        parentLevelId="lvl-loop-a",
        offsetFromParentMm=150,
    )
    viols = evaluate({"lvl-loop-a": a, "lvl-loop-b": b})
    v = next(x for x in viols if x.rule_id == "level_datum_parent_cycle")
    assert v.element_ids == sorted(["lvl-loop-a", "lvl-loop-b"])
    assert v.severity == "error"


def test_constraints_wall_constraint_levels_inverted_sorted_ids():
    lo = LevelElem(kind="level", id="lvl-lo", name="Lo", elevationMm=4000)
    hi = LevelElem(kind="level", id="lvl-hi", name="Hi", elevationMm=0)
    wall = WallElem(
        kind="wall",
        id="wall-x",
        name="W",
        levelId="lvl-hi",
        start=Vec2Mm(xMm=0, yMm=0),
        end=Vec2Mm(xMm=3000, yMm=0),
        thicknessMm=200,
        heightMm=2800,
        baseConstraintLevelId="lvl-lo",
        topConstraintLevelId="lvl-hi",
        baseConstraintOffsetMm=0,
        topConstraintOffsetMm=0,
    )
    viols = evaluate({"lvl-lo": lo, "lvl-hi": hi, "wall-x": wall})
    v = next(x for x in viols if x.rule_id == "wall_constraint_levels_inverted")
    assert v.element_ids == sorted(["lvl-hi", "lvl-lo", "wall-x"])


def test_bundle_replay_diagnostics_datum_commands_large_mix_under_budget() -> None:
    """WP-P01 / WP-X01: diagnostic scan scales with datum-related command payloads."""
    cmds: list[dict[str, object]] = []
    for i in range(2500):
        cmds.append({"type": "moveLevelElevation", "levelId": "a", "elevationMm": float(i)})
        cmds.append(
            {
                "type": "createLevel",
                "id": f"lvl-{i}",
                "parentLevelId": "p",
                "offsetFromParentMm": 1200,
            }
        )

    start = time.perf_counter()
    diag = bundle_replay_diagnostics(cmds)
    elapsed = time.perf_counter() - start

    assert diag["commandCount"] == 5000
    assert diag["commandTypesInOrder"][0] == "moveLevelElevation"
    assert diag["commandTypesInOrder"][1] == "createLevel"
    assert diag["replayPerformanceBudget_v1"]["largeBundleWarn"] is True

    if os.environ.get("CI") == "true" or os.environ.get("GITHUB_ACTIONS") == "true":
        assert elapsed < 1.0
    else:
        assert elapsed < 0.35


def test_level_elevation_propagation_evidence_labels_direct_and_datum_roles():
    doc = Document(
        revision=1,
        elements={
            "lvl-a": LevelElem(kind="level", id="lvl-a", name="A", elevationMm=100),
            "lvl-gr": LevelElem(kind="level", id="lvl-gr", name="Root", elevationMm=-50),
            "lvl-b": LevelElem(
                kind="level",
                id="lvl-b",
                name="B",
                elevationMm=-50 + 2750,
                parentLevelId="lvl-gr",
                offsetFromParentMm=2750,
            ),
        },
    )
    before = clone_document(doc)
    cmds: list[dict[str, object]] = [
        {"type": "moveLevelElevation", "levelId": "lvl-gr", "elevationMm": 0}
    ]
    ok, new_doc, _c, _v, code = try_commit_bundle(doc, cmds)
    assert ok is True
    assert new_doc is not None
    ev = build_level_elevation_propagation_evidence_v0(before, new_doc, applied_commands=cmds)
    assert ev["format"] == "levelElevationPropagationEvidence_v0"
    assert ev["datumPropagationBlocked"] is False
    by_id = {r["levelId"]: r for r in ev["rows"]}
    assert by_id["lvl-gr"]["role"] == "direct_move"
    assert by_id["lvl-b"]["role"] == "datum_propagated"
    assert by_id["lvl-a"]["role"] == "unchanged"
