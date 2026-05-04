"""IFC exchange manifest + semantic inspection stubs without requiring IfcOpenShell.

``test_export_ifc.py`` skips the whole module when ``ifcopenshell`` is absent; these
tests keep manifest skip transparency and inspector stubs green on bare installs.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, WallElem
from bim_ai.export_ifc import ifcopenshell_available, inspect_kernel_ifc_semantics
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload


def test_ifc_manifest_reports_kernel_geometry_skip_counts_without_ifcopenshell() -> None:
    """``ifcKernelGeometrySkippedCounts`` is document-derived; no STEP parse."""

    doc = Document(
        revision=55,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "d-bad": DoorElem(
                kind="door",
                id="d-bad",
                name="Bad",
                wallId="no-wall",
                alongT=0.5,
                widthMm=900,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    skips = mf.get("ifcKernelGeometrySkippedCounts") or {}
    assert skips.get("door_missing_host_wall") == 1


def test_inspect_kernel_ifc_semantics_stub_when_ifcopenshell_missing() -> None:
    if ifcopenshell_available():
        pytest.skip("ifcopenshell installed — full matrix covered in test_export_ifc")

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
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    rep = inspect_kernel_ifc_semantics(doc=doc)
    assert rep["available"] is False
    assert rep["reason"] == "ifcopenshell_not_installed"
    assert rep["matrixVersion"] == 1


def test_inspect_kernel_ifc_semantics_kernel_not_eligible_when_ifc_present() -> None:
    if not ifcopenshell_available():
        pytest.skip("requires ifcopenshell")

    doc = Document(
        revision=2,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "d-bad": DoorElem(
                kind="door",
                id="d-bad",
                name="Bad",
                wallId="ghost",
                alongT=0.5,
                widthMm=900,
            ),
        },
    )
    rep = inspect_kernel_ifc_semantics(doc=doc)
    assert rep["available"] is False
    assert rep["reason"] == "kernel_not_eligible"
    assert (rep.get("ifcKernelGeometrySkippedCounts") or {}).get("door_missing_host_wall") == 1
