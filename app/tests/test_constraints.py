"""Smoke tests for constraint evaluation and IFC exchange payloads (prompt validation entry)."""

from __future__ import annotations

import pytest

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import FloorElem, LevelElem, WallElem
from bim_ai.export_ifc import IFC_AVAILABLE
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload


def test_evaluate_returns_list_for_minimal_wall_document() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    viols = evaluate(dict(doc.elements))
    assert isinstance(viols, list)


@pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')")
def test_ifc_manifest_exports_property_coverage_slice_when_kernel_eligible() -> None:
    doc = Document(
        revision=2,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="S",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4500, "yMm": 0},
                    {"xMm": 4500, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                thicknessMm=200,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    ev = mf.get("ifcPropertySetCoverageEvidence_v0") or {}
    assert ev.get("format") == "ifcPropertySetCoverageEvidence_v0"
    assert ev.get("available") is True
