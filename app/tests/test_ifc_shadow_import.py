"""FED-04 — IFC → shadow-model link import.

Acceptance: an IFC STEP file produces (a) a fresh bim-ai shadow model whose
elements come from the IFC's authoritative-replay bundle, and (b) a
``link_model`` element in the host pointing at that shadow's UUID.

The route handler in ``routes_api.import_ifc_to_shadow_link`` does the same
flow with DB persistence + websocket broadcast; this test exercises the pure
data path so it runs without a live Postgres.
"""

from __future__ import annotations

import uuid

import pytest

from bim_ai.document import Document
from bim_ai.elements import LevelElem, LinkModelElem, WallElem
from bim_ai.engine import (
    clone_document,
    ensure_internal_origin,
    try_apply_kernel_ifc_authoritative_replay_v0,
    try_commit,
)
from bim_ai.export_ifc import (
    AUTHORITATIVE_REPLAY_KIND_V0,
    IFC_AVAILABLE,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    export_ifc_model_step,
)

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


def _seed_doc() -> Document:
    """A minimal exporter-eligible doc — one storey + one wall."""
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="Ground", elevationMm=0),
            "w-1": WallElem(
                kind="wall",
                id="w-1",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )


def test_authoritative_replay_round_trip_through_shadow_model():
    """Export → re-parse → apply: the shadow model contains the kernel
    elements (level + wall) reconstructed from the IFC bundle."""

    seed = _seed_doc()
    step_text = export_ifc_model_step(seed)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step_text)

    assert sketch.get("available") is True
    assert sketch.get("replayKind") == AUTHORITATIVE_REPLAY_KIND_V0
    assert isinstance(sketch.get("commands"), list) and sketch["commands"], "no replay commands"

    shadow_doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(shadow_doc)
    ok, replayed_doc, _cmds, _viols, code = try_apply_kernel_ifc_authoritative_replay_v0(
        shadow_doc, sketch
    )
    assert ok, code
    assert replayed_doc is not None

    # The shadow model holds at least one level (from the IFC storey) and one
    # wall (reconstructed via createWall).
    kinds = {e.kind for e in replayed_doc.elements.values()}
    assert "level" in kinds
    assert "wall" in kinds


def test_host_gains_link_model_pointing_at_shadow_uuid():
    """Simulating the route's last step: applying createLinkModel against the
    host produces exactly one new ``link_model`` whose source is the shadow
    UUID."""

    host = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(host)
    host_before = clone_document(host)

    shadow_uuid = str(uuid.uuid4())
    create_link = {
        "type": "createLinkModel",
        "name": "Linked IFC",
        "sourceModelId": shadow_uuid,
        "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
        "rotationDeg": 0.0,
        "originAlignmentMode": "origin_to_origin",
    }
    ok, new_host, _c, _v, code = try_commit(host, create_link)
    assert ok, code
    assert new_host is not None

    new_link_ids = set(new_host.elements.keys()) - set(host_before.elements.keys())
    # internal_origin already existed; sun_settings is auto-created by
    # ensure_sun_settings() inside try_commit; the only truly new element
    # should be the link_model row.
    new_link_ids.discard("internal_origin")
    new_link_ids.discard("sun_settings")
    assert len(new_link_ids) == 1
    link = new_host.elements[next(iter(new_link_ids))]
    assert isinstance(link, LinkModelElem)
    assert link.source_model_id == shadow_uuid
    assert link.origin_alignment_mode == "origin_to_origin"
    assert link.position_mm.x_mm == 0
    assert link.position_mm.y_mm == 0
    assert link.position_mm.z_mm == 0


def test_full_import_pipeline_end_to_end():
    """Glue test: seed doc → export STEP → re-parse → apply replay to shadow
    → createLinkModel on host. End state matches what the API returns."""

    seed = _seed_doc()
    step_text = export_ifc_model_step(seed)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step_text)
    assert sketch.get("available") is True

    shadow_doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(shadow_doc)
    ok, shadow_after, _c, _v, _code = try_apply_kernel_ifc_authoritative_replay_v0(
        shadow_doc, sketch
    )
    assert ok and shadow_after is not None

    shadow_uuid = str(uuid.uuid4())
    host = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(host)
    ok2, host_after, _c2, _v2, _code2 = try_commit(
        host,
        {
            "type": "createLinkModel",
            "name": "Linked IFC",
            "sourceModelId": shadow_uuid,
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
            "rotationDeg": 0.0,
            "originAlignmentMode": "origin_to_origin",
        },
    )
    assert ok2 and host_after is not None

    # Host has exactly one link_model; shadow has the IFC-derived elements.
    links = [e for e in host_after.elements.values() if isinstance(e, LinkModelElem)]
    assert len(links) == 1
    assert links[0].source_model_id == shadow_uuid

    shadow_kinds = {e.kind for e in shadow_after.elements.values()}
    assert "level" in shadow_kinds


def test_create_link_model_against_unrelated_uuid_does_not_validate_existence():
    """The engine alone doesn't know about other DB rows — existence is the
    route's job. So a `createLinkModel` against any non-empty UUID succeeds
    at the engine level. (The route layer adds the cross-row checks.)"""

    host = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(host)
    bogus_uuid = str(uuid.uuid4())
    ok, _new, _c, _v, _code = try_commit(
        host,
        {
            "type": "createLinkModel",
            "name": "ghost",
            "sourceModelId": bogus_uuid,
            "positionMm": {"xMm": 0, "yMm": 0, "zMm": 0},
        },
    )
    assert ok


def test_unavailable_sketch_returns_failure_without_mutation():
    """An unavailable replay sketch (no IFC parser, or unrelated payload) is
    a clean ``False`` from ``try_apply_kernel_ifc_authoritative_replay_v0``;
    the doc is left untouched."""

    shadow_doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(shadow_doc)
    snapshot = {eid: el for eid, el in shadow_doc.elements.items()}

    ok, _new, _cmds, _viols, code = try_apply_kernel_ifc_authoritative_replay_v0(
        shadow_doc, {"available": False, "reason": "ifcopenshell_not_installed"}
    )
    assert ok is False
    assert code == "sketch_unavailable"
    # Doc unchanged.
    assert {eid: el for eid, el in shadow_doc.elements.items()} == snapshot
