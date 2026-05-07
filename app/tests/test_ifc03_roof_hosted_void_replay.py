"""IFC-03 — roof-hosted IfcOpeningElement export + replay round-trip.

Today the kernel skipped every roof-hosted opening with a
``roof_host_not_supported_v0`` row. This file pins the new behaviour:
``RoofOpeningElem`` exports as an IFC opening hosted on the matching
``IfcRoof`` and the re-parser turns it back into a
``createRoofOpening`` command preserving id, name, host, and footprint.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    LevelElem,
    RoofElem,
    RoofOpeningElem,
    WallElem,
)
from bim_ai.export_ifc import (
    IFC_AVAILABLE,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    export_ifc_model_step,
    inspect_kernel_ifc_semantics,
    summarize_kernel_ifc_semantic_roundtrip,
)

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


def _doc_with_roof_skylight() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="Ground", elevationMm=0),
            "lvl-r": LevelElem(kind="level", id="lvl-r", name="Roof", elevationMm=3000),
            # Anchor wall keeps the kernel export-eligible (`document_kernel_export_eligible`
            # gates on walls + slabs being present).
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl-g": FloorElem(
                kind="floor",
                id="fl-g",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                thicknessMm=200,
            ),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="MainRoof",
                referenceLevelId="lvl-r",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                overhangMm=200,
                slopeDeg=25,
            ),
            "rop-sky": RoofOpeningElem(
                kind="roof_opening",
                id="rop-sky",
                name="Skylight",
                hostRoofId="rf-1",
                boundaryMm=[
                    {"xMm": 2500, "yMm": 2000},
                    {"xMm": 3500, "yMm": 2000},
                    {"xMm": 3500, "yMm": 3000},
                    {"xMm": 2500, "yMm": 3000},
                ],
            ),
        },
    )


def test_roof_opening_export_emits_ifc_opening_hosted_on_roof() -> None:
    doc = _doc_with_roof_skylight()
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "IFCROOF" in u
    assert "IFCOPENINGELEMENT" in u
    # The opening must be related to the IfcRoof via IfcRelVoidsElement.
    assert "IFCRELVOIDSELEMENT" in u


def test_roof_opening_round_trip_preserves_kernel_id_host_and_boundary() -> None:
    doc = _doc_with_roof_skylight()
    step = export_ifc_model_step(doc)

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    roof_op_cmds = [
        cmd for cmd in sketch.get("commands", []) if cmd.get("type") == "createRoofOpening"
    ]
    assert len(roof_op_cmds) == 1, sketch.get("commands")

    cmd = roof_op_cmds[0]
    assert cmd["id"] == "rop-sky"
    assert cmd["hostRoofId"] == "rf-1"

    boundary = cmd["boundaryMm"]
    assert len(boundary) == 4
    xs = sorted(round(p["xMm"]) for p in boundary)
    ys = sorted(round(p["yMm"]) for p in boundary)
    assert xs == [2500, 2500, 3500, 3500]
    assert ys == [2000, 2000, 3000, 3000]


def test_inspection_counts_roof_hosted_openings_separately() -> None:
    doc = _doc_with_roof_skylight()
    step = export_ifc_model_step(doc)
    inspect = inspect_kernel_ifc_semantics(doc=doc, step_text=step)
    by_host = inspect["openingsByHostKind"]
    assert by_host["roof"] == 1
    assert by_host["slab"] == 0
    assert by_host["wall"] == 0


def test_summary_round_trip_check_marks_roof_opening_match() -> None:
    doc = _doc_with_roof_skylight()
    summary = summarize_kernel_ifc_semantic_roundtrip(doc)
    pc = summary["roundtripChecks"]["productCounts"]
    rh = pc["roofHostedOpenings"]
    assert rh["expected"] == 1
    assert rh["inspected"] == 1
    assert rh["match"] is True


def test_replay_skip_no_longer_records_roof_host_not_supported() -> None:
    doc = _doc_with_roof_skylight()
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    skip = sketch["slabRoofHostedVoidReplaySkipped_v0"]
    counts = skip.get("countsByHostKindAndReason") or {}
    # The legacy reason key must not appear once the roof void path replays.
    assert not any("roof_host_not_supported_v0" in k for k in counts.keys()), counts
    assert not any(
        row.get("reason") == "roof_host_not_supported_v0" for row in skip.get("detailRows", [])
    )
