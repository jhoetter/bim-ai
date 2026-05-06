"""VIE-05 — createLevel auto-creates a companion plan_view by default."""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem
from bim_ai.engine import try_commit_bundle


def test_create_level_default_also_emits_plan_view():
    doc = Document(revision=1, elements={})
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLevel",
                "id": "lvl-roof",
                "name": "Roof Deck",
                "elevationMm": 6000,
            }
        ],
    )
    assert ok is True
    assert nd is not None

    lvl = nd.elements["lvl-roof"]
    assert isinstance(lvl, LevelElem)
    assert lvl.name == "Roof Deck"

    plan_views = [el for el in nd.elements.values() if isinstance(el, PlanViewElem)]
    assert len(plan_views) == 1
    pv = plan_views[0]
    assert pv.level_id == "lvl-roof"
    assert pv.name == "Roof Deck — Plan"


def test_create_level_with_explicit_plan_view_id_uses_it():
    doc = Document(revision=1, elements={})
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLevel",
                "id": "lvl-1",
                "name": "Ground",
                "elevationMm": 0,
                "planViewId": "pv-explicit",
            }
        ],
    )
    assert ok is True
    assert nd is not None
    pv = nd.elements["pv-explicit"]
    assert isinstance(pv, PlanViewElem)
    assert pv.level_id == "lvl-1"


def test_create_level_with_also_create_plan_view_false_skips_plan_view():
    doc = Document(revision=1, elements={})
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            {
                "type": "createLevel",
                "id": "lvl-x",
                "name": "Skip",
                "elevationMm": 100,
                "alsoCreatePlanView": False,
            }
        ],
    )
    assert ok is True
    assert nd is not None
    plan_views = [el for el in nd.elements.values() if isinstance(el, PlanViewElem)]
    assert plan_views == []
