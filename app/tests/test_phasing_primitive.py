"""KRN-V3-01 — phasing primitive tests.

Covers: CreatePhase, RenamePhase, ReorderPhase, DeletePhase,
        SetElementPhase, SetViewPhase, SetViewPhaseFilter.
"""

from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import PhaseElem, PlanViewElem
from bim_ai.engine import try_commit_bundle


def _seed() -> Document:
    return Document(revision=1, elements={})


def _create_phase(name: str, ord_: int, id_: str | None = None) -> dict:
    cmd: dict = {"type": "createPhase", "name": name, "ord": ord_}
    if id_ is not None:
        cmd["id"] = id_
    return cmd


def _create_level(id_: str = "lvl-1", name: str = "Ground") -> dict:
    return {"type": "createLevel", "id": id_, "name": name, "elevationMm": 0}


def _create_wall(id_: str = "w-1", level_id: str = "lvl-1") -> dict:
    return {
        "type": "createWall",
        "id": id_,
        "levelId": level_id,
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 5000, "yMm": 0},
    }


# ---------------------------------------------------------------------------
# CreatePhase
# ---------------------------------------------------------------------------


def test_create_phase_happy_path() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("Existing", 0, "ph-ex")])
    assert ok
    ph = nd.elements["ph-ex"]
    assert isinstance(ph, PhaseElem)
    assert ph.name == "Existing"
    assert ph.ord == 0


def test_create_phase_auto_id() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("New", 2)])
    assert ok
    phases = [el for el in nd.elements.values() if isinstance(el, PhaseElem)]
    assert len(phases) == 1
    assert phases[0].name == "New"


def test_create_phase_duplicate_id_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("Existing", 0, "ph-ex")])
    assert ok
    ok2, *_ = try_commit_bundle(nd, [_create_phase("Demolition", 1, "ph-ex")])
    assert not ok2


def test_create_phase_duplicate_ord_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("Existing", 0, "ph-ex")])
    assert ok
    ok2, *_ = try_commit_bundle(nd, [_create_phase("Demolition", 0, "ph-dem")])
    assert not ok2


# ---------------------------------------------------------------------------
# RenamePhase
# ---------------------------------------------------------------------------


def test_rename_phase() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("Existing", 0, "ph-ex")])
    assert ok
    ok2, nd2, *_ = try_commit_bundle(
        nd, [{"type": "renamePhase", "phaseId": "ph-ex", "name": "As-Built"}]
    )
    assert ok2
    assert nd2.elements["ph-ex"].name == "As-Built"


def test_rename_phase_bad_id() -> None:
    ok, *_ = try_commit_bundle(
        _seed(), [{"type": "renamePhase", "phaseId": "nonexistent", "name": "X"}]
    )
    assert not ok


# ---------------------------------------------------------------------------
# ReorderPhase
# ---------------------------------------------------------------------------


def test_reorder_phase() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc, [_create_phase("Existing", 0, "ph-ex"), _create_phase("New", 2, "ph-new")]
    )
    assert ok
    ok2, nd2, *_ = try_commit_bundle(
        nd, [{"type": "reorderPhase", "phaseId": "ph-new", "ord": 1}]
    )
    assert ok2
    assert nd2.elements["ph-new"].ord == 1


def test_reorder_phase_ord_collision_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc, [_create_phase("Existing", 0, "ph-ex"), _create_phase("New", 1, "ph-new")]
    )
    assert ok
    ok2, *_ = try_commit_bundle(
        nd, [{"type": "reorderPhase", "phaseId": "ph-new", "ord": 0}]
    )
    assert not ok2


# ---------------------------------------------------------------------------
# DeletePhase
# ---------------------------------------------------------------------------


def test_delete_phase_no_elements() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("Existing", 0, "ph-ex")])
    assert ok
    ok2, nd2, *_ = try_commit_bundle(nd, [{"type": "deletePhase", "phaseId": "ph-ex"}])
    assert ok2
    assert "ph-ex" not in nd2.elements


def test_delete_phase_with_elements_requires_retarget() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            _create_phase("Existing", 0, "ph-ex"),
            _create_phase("New", 1, "ph-new"),
            _create_level(),
            _create_wall(),
            {"type": "setElementPhase", "elementId": "w-1", "phaseCreatedId": "ph-ex"},
        ],
    )
    assert ok
    ok2, *_ = try_commit_bundle(nd, [{"type": "deletePhase", "phaseId": "ph-ex"}])
    assert not ok2
    ok3, nd3, *_ = try_commit_bundle(
        nd, [{"type": "deletePhase", "phaseId": "ph-ex", "retargetToPhaseId": "ph-new"}]
    )
    assert ok3
    assert "ph-ex" not in nd3.elements
    assert nd3.elements["w-1"].phase_created == "ph-new"


# ---------------------------------------------------------------------------
# SetElementPhase
# ---------------------------------------------------------------------------


def test_set_element_phase_created() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            _create_phase("Existing", 0, "ph-ex"),
            _create_level(),
            _create_wall(),
            {"type": "setElementPhase", "elementId": "w-1", "phaseCreatedId": "ph-ex"},
        ],
    )
    assert ok
    assert nd.elements["w-1"].phase_created == "ph-ex"


def test_set_element_phase_demolished() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            _create_phase("Existing", 0, "ph-ex"),
            _create_phase("Demolition", 1, "ph-dem"),
            _create_level(),
            _create_wall(),
            {
                "type": "setElementPhase",
                "elementId": "w-1",
                "phaseCreatedId": "ph-ex",
                "phaseDemolishedId": "ph-dem",
            },
        ],
    )
    assert ok
    w = nd.elements["w-1"]
    assert w.phase_created == "ph-ex"
    assert w.phase_demolished == "ph-dem"


def test_set_element_phase_demolished_ord_validation() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            _create_phase("Existing", 0, "ph-ex"),
            _create_phase("New", 2, "ph-new"),
            _create_level(),
            _create_wall(),
            {"type": "setElementPhase", "elementId": "w-1", "phaseCreatedId": "ph-new"},
        ],
    )
    assert ok
    ok2, *_ = try_commit_bundle(
        nd,
        [{"type": "setElementPhase", "elementId": "w-1", "phaseDemolishedId": "ph-ex"}],
    )
    assert not ok2


def test_set_element_phase_clear_demolished() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc,
        [
            _create_phase("Existing", 0, "ph-ex"),
            _create_phase("Demolition", 1, "ph-dem"),
            _create_level(),
            _create_wall(),
            {
                "type": "setElementPhase",
                "elementId": "w-1",
                "phaseCreatedId": "ph-ex",
                "phaseDemolishedId": "ph-dem",
            },
        ],
    )
    assert ok
    ok2, nd2, *_ = try_commit_bundle(
        nd, [{"type": "setElementPhase", "elementId": "w-1", "clearDemolished": True}]
    )
    assert ok2
    assert nd2.elements["w-1"].phase_demolished is None


def test_set_element_phase_bad_element_rejected() -> None:
    ok, *_ = try_commit_bundle(
        _seed(), [{"type": "setElementPhase", "elementId": "nonexistent"}]
    )
    assert not ok


# ---------------------------------------------------------------------------
# SetViewPhase
# ---------------------------------------------------------------------------


def test_set_view_phase() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(
        doc, [_create_phase("Existing", 0, "ph-ex"), _create_level("lvl-1")]
    )
    assert ok
    pv = next(el for el in nd.elements.values() if isinstance(el, PlanViewElem))
    ok2, nd2, *_ = try_commit_bundle(
        nd, [{"type": "setViewPhase", "viewId": pv.id, "phaseId": "ph-ex"}]
    )
    assert ok2
    assert nd2.elements[pv.id].phase_id == "ph-ex"


def test_set_view_phase_bad_view_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_phase("Existing", 0, "ph-ex")])
    assert ok
    ok2, *_ = try_commit_bundle(
        nd, [{"type": "setViewPhase", "viewId": "nonexistent", "phaseId": "ph-ex"}]
    )
    assert not ok2


# ---------------------------------------------------------------------------
# SetViewPhaseFilter
# ---------------------------------------------------------------------------


def test_set_view_phase_filter() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level("lvl-1")])
    assert ok
    pv = next(el for el in nd.elements.values() if isinstance(el, PlanViewElem))
    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [{"type": "setViewPhaseFilter", "viewId": pv.id, "phaseFilter": "existing"}],
    )
    assert ok2
    assert nd2.elements[pv.id].phase_filter == "existing"


def test_set_view_phase_filter_bad_filter_rejected() -> None:
    doc = _seed()
    ok, nd, *_ = try_commit_bundle(doc, [_create_level("lvl-1")])
    assert ok
    pv = next(el for el in nd.elements.values() if isinstance(el, PlanViewElem))
    ok2, *_ = try_commit_bundle(
        nd,
        [{"type": "setViewPhaseFilter", "viewId": pv.id, "phaseFilter": "invalid_filter"}],
    )
    assert not ok2


def test_set_view_phase_filter_bad_view_rejected() -> None:
    ok, *_ = try_commit_bundle(
        _seed(),
        [{"type": "setViewPhaseFilter", "viewId": "nonexistent", "phaseFilter": "all"}],
    )
    assert not ok
