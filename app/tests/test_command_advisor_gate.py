"""PERF-CQ-02: gate the 9 documentation advisor passes on the commit path.

The default behaviour of ``evaluate`` (and thus ``_commit_violations``)
runs nine info-only advisor passes that scan the entire element graph.
PERF-CQ-02 widens the existing PERF-B07 fast-path gate so that ANY
single-element command whose verb is not in the schema-altering deny-
list skips those passes at commit time. Multi-element bundles and any
bundle containing a schema-altering verb keep the full advisor stream
(regression guard).

The tests below spy on the nine advisor functions via monkeypatch and
assert their call counts after running representative commit shapes
through ``try_commit`` / ``try_commit_bundle``.
"""

from __future__ import annotations

from typing import Any

import pytest

from bim_ai import constraints_evaluation
from bim_ai.document import Document
from bim_ai.elements import LevelElem, Vec2Mm, WallElem
from bim_ai.engine import try_commit, try_commit_bundle

# The nine documentation advisor functions gated by
# ``documentation_advisors`` in ``constraints_evaluation.evaluate``.
# Each lives as a module-level symbol on ``bim_ai.constraints_evaluation``,
# which lets us monkeypatch them with a per-test counter wrapper.
_ADVISOR_NAMES: tuple[str, ...] = (
    "_agent_brief_advisory_violations",
    "_exchange_advisory_violations",
    "_gltf_manifest_closure_advisory_violations",
    "_plan_view_tag_style_advisor_violations",
    "_room_color_scheme_advisory_violations",
    "_section_on_sheet_advisory_violations",
    "_monitored_source_drift_advisory_violations",
    "_dormer_overflow_advisory_violations",
    "constructability_advisory_violations",
)


@pytest.fixture
def advisor_spy(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    """Replace each documentation advisor with a counting no-op wrapper.

    Each call to a gated advisor increments its slot in the returned dict.
    The wrapper still returns an empty list so the rest of the evaluator
    runs untouched.
    """

    counts: dict[str, int] = {name: 0 for name in _ADVISOR_NAMES}

    for name in _ADVISOR_NAMES:
        original = getattr(constraints_evaluation, name)

        def _make_spy(spy_name: str, orig: Any) -> Any:
            def _spy(*args: Any, **kwargs: Any) -> list:
                counts[spy_name] += 1
                # Delegate to the real advisor so blocking/info surfaces
                # stay realistic. Returning [] would also be safe for the
                # gate test but slightly hides bugs that depend on
                # advisor output reaching the violation list.
                return orig(*args, **kwargs)

            return _spy

        monkeypatch.setattr(
            constraints_evaluation, name, _make_spy(name, original), raising=True
        )

    return counts


def _level() -> LevelElem:
    return LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0)


def _wall(wid: str, *, x_start: float = 0.0, x_end: float = 4_000.0) -> WallElem:
    return WallElem(
        kind="wall",
        id=wid,
        name=wid,
        levelId="lvl-1",
        start=Vec2Mm(xMm=x_start, yMm=0),
        end=Vec2Mm(xMm=x_end, yMm=0),
        thicknessMm=200,
        heightMm=2_800,
    )


def _baseline_doc() -> Document:
    lvl = _level()
    wall = _wall("seed-wall")
    return Document(revision=1, elements={lvl.id: lvl, wall.id: wall})


def _total_calls(counts: dict[str, int]) -> int:
    return sum(counts.values())


# ---------------------------------------------------------------------------
# Test 1: single-element command via try_commit → advisors skipped
# ---------------------------------------------------------------------------


def test_single_element_createwall_skips_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """createWall is a single-element command — the gate must skip the
    nine info-only advisor passes during commit."""

    doc = Document(revision=1, elements={"lvl-1": _level()})
    ok, _new_doc, _cmd, _viols, code = try_commit(
        doc,
        {
            "type": "createWall",
            "id": "new-wall",
            "name": "new-wall",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 4_000, "yMm": 0},
            "thicknessMm": 200,
            "heightMm": 2_800,
            "physicalRole": "physical",
        },
    )

    assert ok is True, f"expected commit ok, got code={code!r}"
    assert _total_calls(advisor_spy) == 0, (
        "single-element createWall must NOT trigger documentation "
        f"advisor passes; counts={advisor_spy!r}"
    )


def test_single_element_movewall_endpoints_skips_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """moveWallEndpoints (already in the legacy fast-path allowlist) is a
    regression guard that the broader gate keeps it skipped."""

    doc = _baseline_doc()
    ok, _new_doc, _cmd, _viols, code = try_commit(
        doc,
        {
            "type": "moveWallEndpoints",
            "wallId": "seed-wall",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 4_500, "yMm": 0},
        },
    )

    assert ok is True, f"expected commit ok, got code={code!r}"
    assert _total_calls(advisor_spy) == 0


# ---------------------------------------------------------------------------
# Test 2: multi-element bundle → advisors still run (regression guard)
# ---------------------------------------------------------------------------


def test_multi_element_bundle_still_runs_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """A bundle that creates two independent walls touches two element
    ids; the documentation advisor surface is not bounded to a single
    element so the gate MUST keep advisors enabled."""

    doc = Document(revision=1, elements={"lvl-1": _level()})
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createWall",
                "id": "wall-a",
                "name": "wall-a",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 4_000, "yMm": 0},
                "thicknessMm": 200,
                "heightMm": 2_800,
                "physicalRole": "physical",
            },
            {
                "type": "createWall",
                "id": "wall-b",
                "name": "wall-b",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 5_000},
                "end": {"xMm": 4_000, "yMm": 5_000},
                "thicknessMm": 200,
                "heightMm": 2_800,
                "physicalRole": "physical",
            },
        ],
    )

    assert ok is True, f"expected bundle commit ok, got code={code!r}"
    # Each advisor should run at least once on the post-apply document.
    # ``constructability_advisory_violations`` may be called twice if the
    # blocking-violation branch kicks in; only assert ≥ 1.
    for name in _ADVISOR_NAMES:
        assert advisor_spy[name] >= 1, (
            f"multi-element bundle must still run {name!r}; "
            f"counts={advisor_spy!r}"
        )


# ---------------------------------------------------------------------------
# Test 3: schema-altering single command → advisors still run
# ---------------------------------------------------------------------------


def test_schema_altering_single_command_still_runs_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """``createPhase`` is a schema-altering verb — even committed alone
    it mutates a document-wide catalog the advisors scan globally. The
    gate MUST keep advisors enabled for such commands."""

    doc = _baseline_doc()
    ok, _new_doc, _cmd, _viols, code = try_commit(
        doc,
        {
            "type": "createPhase",
            "id": "phase-new",
            "name": "New Phase",
            "ord": 1,
        },
    )

    assert ok is True, f"expected commit ok, got code={code!r}"
    for name in _ADVISOR_NAMES:
        assert advisor_spy[name] >= 1, (
            f"schema-altering createPhase must still run {name!r}; "
            f"counts={advisor_spy!r}"
        )


# ---------------------------------------------------------------------------
# Test 4: schema-altering single command in a bundle → advisors run too
# ---------------------------------------------------------------------------


def test_schema_altering_command_in_bundle_keeps_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """A bundle containing any schema-altering verb falls back to the
    full advisor surface, even if there is only one such command."""

    doc = _baseline_doc()
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createPhase",
                "id": "phase-x",
                "name": "Phase X",
                "ord": 1,
            },
        ],
    )

    assert ok is True, f"expected bundle commit ok, got code={code!r}"
    for name in _ADVISOR_NAMES:
        assert advisor_spy[name] >= 1, (
            f"schema-altering bundle must still run {name!r}; "
            f"counts={advisor_spy!r}"
        )


# ---------------------------------------------------------------------------
# Test 5: single-element bundle (one createWall) → advisors skipped
# ---------------------------------------------------------------------------


def test_single_command_bundle_skips_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """A one-command bundle whose verb is single-element-safe is
    equivalent to ``try_commit`` and must also skip the advisor passes."""

    doc = Document(revision=1, elements={"lvl-1": _level()})
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "createWall",
                "id": "solo-wall",
                "name": "solo-wall",
                "levelId": "lvl-1",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 4_000, "yMm": 0},
                "thicknessMm": 200,
                "heightMm": 2_800,
                "physicalRole": "physical",
            }
        ],
    )

    assert ok is True, f"expected single-cmd bundle commit ok, got code={code!r}"
    assert _total_calls(advisor_spy) == 0


# ---------------------------------------------------------------------------
# Test 6: multi-command bundle hitting a single element id → advisors skipped
# ---------------------------------------------------------------------------


def test_multi_command_single_element_bundle_skips_documentation_advisors(
    advisor_spy: dict[str, int],
) -> None:
    """A bundle whose commands all target one element id (e.g. two
    sequential moves on the same wall) is still single-element."""

    doc = _baseline_doc()
    ok, _new_doc, _cmds, _viols, code = try_commit_bundle(
        doc,
        [
            {
                "type": "moveWallEndpoints",
                "wallId": "seed-wall",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 4_500, "yMm": 0},
            },
            {
                "type": "moveWallEndpoints",
                "wallId": "seed-wall",
                "start": {"xMm": 0, "yMm": 0},
                "end": {"xMm": 4_750, "yMm": 0},
            },
        ],
    )

    assert ok is True, f"expected commit ok, got code={code!r}"
    assert _total_calls(advisor_spy) == 0, (
        "bundle that only edits seed-wall must not re-run advisors; "
        f"counts={advisor_spy!r}"
    )
