"""EDT-V3-11 — phase-filter-as-view-as-lens tests.

Covers element_passes_phase_filter and phase_render_style pure helpers.
"""

from __future__ import annotations

from bim_ai.engine import element_passes_phase_filter, phase_render_style


class _Wall:
    def __init__(
        self,
        phase_created: str = "existing",
        phase_demolished: str | None = None,
    ) -> None:
        self.phase_created = phase_created
        self.phase_demolished = phase_demolished


# ---------------------------------------------------------------------------
# element_passes_phase_filter
# ---------------------------------------------------------------------------


def test_existing_wall_passes_existing_filter() -> None:
    assert element_passes_phase_filter(_Wall("existing"), "existing") is True


def test_existing_wall_fails_demolition_filter() -> None:
    assert element_passes_phase_filter(_Wall("existing"), "demolition") is False


def test_existing_wall_fails_new_filter() -> None:
    assert element_passes_phase_filter(_Wall("existing"), "new") is False


def test_new_wall_passes_new_filter() -> None:
    assert element_passes_phase_filter(_Wall("new"), "new") is True


def test_new_wall_fails_existing_filter() -> None:
    assert element_passes_phase_filter(_Wall("new"), "existing") is False


def test_demolished_wall_passes_demolition_filter() -> None:
    assert element_passes_phase_filter(_Wall("existing", "demolition"), "demolition") is True


def test_demolished_wall_fails_existing_filter() -> None:
    assert element_passes_phase_filter(_Wall("existing", "demolition"), "existing") is False


def test_all_filter_passes_existing() -> None:
    assert element_passes_phase_filter(_Wall("existing"), "all") is True


def test_all_filter_passes_new() -> None:
    assert element_passes_phase_filter(_Wall("new"), "all") is True


def test_all_filter_passes_demolished() -> None:
    assert element_passes_phase_filter(_Wall("existing", "demolition"), "all") is True


def test_unknown_filter_defaults_to_visible() -> None:
    assert element_passes_phase_filter(_Wall("existing"), "unknown") is True


# ---------------------------------------------------------------------------
# phase_render_style
# ---------------------------------------------------------------------------


def test_render_style_demolished_is_dashed() -> None:
    style = phase_render_style(_Wall("existing", "demolition"), "all")
    assert style["stroke"] == "var(--phase-demolition)"
    assert style["strokeDashArray"] == "4 4"
    assert style["strokeWidth"] == "var(--draft-lw-projection)"


def test_render_style_new_is_bold_black() -> None:
    style = phase_render_style(_Wall("new"), "all")
    assert style["stroke"] == "var(--phase-new)"
    assert style["strokeDashArray"] == "none"
    assert style["strokeWidth"] == "var(--draft-lw-cut)"


def test_render_style_existing_is_grey_solid() -> None:
    style = phase_render_style(_Wall("existing"), "all")
    assert style["stroke"] == "var(--phase-existing)"
    assert style["strokeDashArray"] == "none"
    assert style["strokeWidth"] == "var(--draft-lw-projection)"


# ---------------------------------------------------------------------------
# phaseFilter round-trip on PlanViewElem
# ---------------------------------------------------------------------------


def test_plan_view_phase_filter_default_all() -> None:
    from bim_ai.document import Document
    from bim_ai.elements import PlanViewElem
    from bim_ai.engine import try_commit_bundle

    doc = Document(revision=1, elements={})
    ok, nd, *_ = try_commit_bundle(
        doc,
        [{"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}],
    )
    assert ok
    pv = next(el for el in nd.elements.values() if isinstance(el, PlanViewElem))
    assert pv.phase_filter == "all"


def test_plan_view_set_phase_filter_round_trips() -> None:
    from bim_ai.document import Document
    from bim_ai.elements import PlanViewElem
    from bim_ai.engine import try_commit_bundle

    doc = Document(revision=1, elements={})
    ok, nd, *_ = try_commit_bundle(
        doc,
        [{"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}],
    )
    assert ok
    pv = next(el for el in nd.elements.values() if isinstance(el, PlanViewElem))
    ok2, nd2, *_ = try_commit_bundle(
        nd,
        [{"type": "setViewPhaseFilter", "viewId": pv.id, "phaseFilter": "demolition"}],
    )
    assert ok2
    assert nd2.elements[pv.id].phase_filter == "demolition"


# ---------------------------------------------------------------------------
# Combined: phase_filter + no-phase-created attribute (attr-missing fallback)
# ---------------------------------------------------------------------------


def test_passes_filter_no_phase_attr_fallback() -> None:
    class _NoPhase:
        pass

    assert element_passes_phase_filter(_NoPhase(), "existing") is True
    assert element_passes_phase_filter(_NoPhase(), "all") is True
