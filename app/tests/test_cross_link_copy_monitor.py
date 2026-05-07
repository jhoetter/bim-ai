"""FED-03 — Cross-link Copy/Monitor.

Acceptance: copy a structural grid line from a linked Structure model into
the Architecture host; modify the source; reopen the host; see drift advisory
+ structured ``monitor_source.drifted`` flag; reconcile (Accept-source)
updates host fields.
"""

from __future__ import annotations

import pytest

from bim_ai.commands import (
    BumpMonitoredRevisionsCmd,
    ReconcileMonitoredElementCmd,
)
from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    GridLineElem,
    LevelElem,
    LinkModelElem,
    MonitorSourceSpec,
    Vec2Mm,
    Vec3Mm,
)
from bim_ai.engine import apply_inplace


def _level(eid: str = "lvl-0", elev: float = 0.0) -> LevelElem:
    return LevelElem(kind="level", id=eid, name="L0", elevation_mm=elev, datum_kind="story")


def _grid(
    *,
    id: str,
    sx: float,
    sy: float,
    ex: float,
    ey: float,
    name: str = "A",
    label: str = "A",
    monitor_source: MonitorSourceSpec | None = None,
) -> GridLineElem:
    return GridLineElem(
        kind="grid_line",
        id=id,
        name=name,
        label=label,
        start=Vec2Mm(x_mm=sx, y_mm=sy),
        end=Vec2Mm(x_mm=ex, y_mm=ey),
        level_id="lvl-0",
        monitor_source=monitor_source,
    )


def test_monitor_source_round_trip_intra_host():
    """Without a link, an intra-host monitor still works: the host points at
    another grid in the same model."""

    src_grid = _grid(id="g-src", sx=0, sy=0, ex=10000, ey=0, name="A")
    monitored = _grid(
        id="g-host",
        sx=0,
        sy=0,
        ex=10000,
        ey=0,
        name="A",
        monitor_source=MonitorSourceSpec(elementId="g-src", sourceRevisionAtCopy=1),
    )
    doc = Document(
        revision=1,
        elements={"lvl-0": _level(), "g-src": src_grid, "g-host": monitored},
    )
    apply_inplace(doc, BumpMonitoredRevisionsCmd())
    host = doc.elements["g-host"]
    assert isinstance(host, GridLineElem)
    assert host.monitor_source is not None
    assert host.monitor_source.drifted is False


def test_intra_host_drift_detected_after_source_change():
    src_grid = _grid(id="g-src", sx=0, sy=0, ex=10000, ey=0, name="A")
    monitored = _grid(
        id="g-host",
        sx=0,
        sy=0,
        ex=10000,
        ey=0,
        name="A",
        monitor_source=MonitorSourceSpec(elementId="g-src", sourceRevisionAtCopy=1),
    )
    doc = Document(
        revision=1,
        elements={"lvl-0": _level(), "g-src": src_grid, "g-host": monitored},
    )
    # Mutate the source AFTER the copy.
    doc.elements["g-src"] = src_grid.model_copy(
        update={"end": Vec2Mm(x_mm=12000, y_mm=0), "name": "A-prime"}
    )
    doc.revision = 2

    apply_inplace(doc, BumpMonitoredRevisionsCmd())
    host = doc.elements["g-host"]
    assert isinstance(host, GridLineElem)
    assert host.monitor_source is not None
    assert host.monitor_source.drifted is True
    assert set(host.monitor_source.drifted_fields) == {"end", "name"}


def test_drift_advisory_emitted_when_drifted_flag_set():
    monitored = _grid(
        id="g-host",
        sx=0,
        sy=0,
        ex=10000,
        ey=0,
        name="A",
        monitor_source=MonitorSourceSpec(
            elementId="g-src",
            sourceRevisionAtCopy=1,
            drifted=True,
            driftedFields=["end", "name"],
        ),
    )
    doc = Document(revision=2, elements={"lvl-0": _level(), "g-host": monitored})
    viols = evaluate(doc.elements)
    drift = [v for v in viols if v.rule_id == "monitored_source_drift"]
    assert len(drift) == 1
    assert drift[0].element_ids == ["g-host"]
    assert drift[0].severity == "warning"
    assert "end" in drift[0].message and "name" in drift[0].message


# --- Cross-link drift -------------------------------------------------------


def _build_cross_link_setup() -> tuple[Document, Document]:
    """Host has a Structure link; source has a grid 'g-source' that the host
    copy-monitored at revision 1."""

    src = Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            "g-source": _grid(id="g-source", sx=0, sy=0, ex=10000, ey=0, name="A"),
        },
    )
    host = Document(
        revision=1,
        elements={
            "lvl-0": _level(),
            "link-str": LinkModelElem(
                kind="link_model",
                id="link-str",
                name="Structure",
                source_model_id="11111111-1111-1111-1111-111111111111",
                position_mm=Vec3Mm(x_mm=0, y_mm=0, z_mm=0),
                rotation_deg=0.0,
                origin_alignment_mode="origin_to_origin",
            ),
            "g-host": _grid(
                id="g-host",
                sx=0,
                sy=0,
                ex=10000,
                ey=0,
                name="A",
                monitor_source=MonitorSourceSpec(
                    linkId="link-str",
                    elementId="g-source",
                    sourceRevisionAtCopy=1,
                ),
            ),
        },
    )
    return host, src


def test_cross_link_drift_detected_via_provider():
    host, src = _build_cross_link_setup()
    # Modify source AFTER copy.
    src.elements["g-source"] = src.elements["g-source"].model_copy(  # type: ignore[union-attr]
        update={"end": Vec2Mm(x_mm=12000, y_mm=0), "name": "A-prime"}
    )
    src.revision = 2

    def provider(uuid: str, rev: int | None) -> Document | None:
        return src if uuid == "11111111-1111-1111-1111-111111111111" else None

    apply_inplace(host, BumpMonitoredRevisionsCmd(), source_provider=provider)
    h = host.elements["g-host"]
    assert isinstance(h, GridLineElem)
    assert h.monitor_source is not None
    assert h.monitor_source.drifted is True
    assert set(h.monitor_source.drifted_fields) == {"end", "name"}


def test_reconcile_accept_source_copies_source_fields_into_host():
    host, src = _build_cross_link_setup()
    src.elements["g-source"] = src.elements["g-source"].model_copy(  # type: ignore[union-attr]
        update={"end": Vec2Mm(x_mm=12000, y_mm=0), "name": "A-prime"}
    )
    src.revision = 5

    def provider(uuid: str, rev: int | None) -> Document | None:
        return src if uuid == "11111111-1111-1111-1111-111111111111" else None

    apply_inplace(host, BumpMonitoredRevisionsCmd(), source_provider=provider)
    apply_inplace(
        host,
        ReconcileMonitoredElementCmd(elementId="g-host", mode="accept_source"),
        source_provider=provider,
    )
    h = host.elements["g-host"]
    assert isinstance(h, GridLineElem)
    # Host now matches source's monitored fields.
    assert h.end.x_mm == 12000
    assert h.name == "A-prime"
    # Drift cleared and revision-at-copy bumped to source's current.
    assert h.monitor_source is not None
    assert h.monitor_source.drifted is False
    assert h.monitor_source.drifted_fields == []
    assert h.monitor_source.source_revision_at_copy == 5


def test_reconcile_keep_host_bumps_revision_without_changing_fields():
    host, src = _build_cross_link_setup()
    src.elements["g-source"] = src.elements["g-source"].model_copy(  # type: ignore[union-attr]
        update={"name": "A-prime"}
    )
    src.revision = 7

    def provider(uuid: str, rev: int | None) -> Document | None:
        return src if uuid == "11111111-1111-1111-1111-111111111111" else None

    apply_inplace(host, BumpMonitoredRevisionsCmd(), source_provider=provider)
    apply_inplace(
        host,
        ReconcileMonitoredElementCmd(elementId="g-host", mode="keep_host"),
        source_provider=provider,
    )
    h = host.elements["g-host"]
    assert isinstance(h, GridLineElem)
    assert h.name == "A"  # host unchanged
    assert h.monitor_source is not None
    assert h.monitor_source.drifted is False
    assert h.monitor_source.source_revision_at_copy == 7


def test_reconcile_unknown_element_raises():
    host, _src = _build_cross_link_setup()
    with pytest.raises(ValueError, match="elementId unknown"):
        apply_inplace(
            host,
            ReconcileMonitoredElementCmd(elementId="does-not-exist", mode="keep_host"),
        )


def test_reconcile_target_without_monitor_source_raises():
    host, _src = _build_cross_link_setup()
    # The link element has no monitor_source.
    with pytest.raises(ValueError, match="no monitor_source"):
        apply_inplace(
            host,
            ReconcileMonitoredElementCmd(elementId="link-str", mode="keep_host"),
        )


def test_bump_with_no_provider_skips_cross_link_silently():
    """When the bump command runs without a wired provider, cross-link
    monitors stay in their previous drift state instead of crashing — they
    simply can't be re-evaluated."""

    host, _src = _build_cross_link_setup()
    apply_inplace(host, BumpMonitoredRevisionsCmd())
    h = host.elements["g-host"]
    assert isinstance(h, GridLineElem)
    assert h.monitor_source is not None
    # No source available → drift not flipped.
    assert h.monitor_source.drifted is False


def test_intra_host_no_drift_when_fields_match_keeps_clean():
    src_grid = _grid(id="g-src", sx=0, sy=0, ex=10000, ey=0, name="A")
    monitored = _grid(
        id="g-host",
        sx=0,
        sy=0,
        ex=10000,
        ey=0,
        name="A",
        monitor_source=MonitorSourceSpec(
            elementId="g-src", sourceRevisionAtCopy=1, drifted=True, driftedFields=["name"]
        ),
    )
    doc = Document(
        revision=1,
        elements={"lvl-0": _level(), "g-src": src_grid, "g-host": monitored},
    )
    apply_inplace(doc, BumpMonitoredRevisionsCmd())
    h = doc.elements["g-host"]
    assert isinstance(h, GridLineElem)
    assert h.monitor_source is not None
    # Bump cleared the stale flag because fields actually match now.
    assert h.monitor_source.drifted is False
    assert h.monitor_source.drifted_fields == []
