"""IFC STEP export smoke tests (IfcOpenShell optional in local dev bare installs — CI installs `[ifc]`)."""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    RoofElem,
    RoomElem,
    SlabOpeningElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.export_ifc import (
    IFC_AVAILABLE,
    IFC_ENCODING_KERNEL_V1,
    export_ifc_model_step,
    inspect_kernel_ifc_semantics,
)
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload

pytestmark = pytest.mark.skipif(not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')")


def test_ifc_exchange_manifest_signals_kernel_wall_slice():
    doc = Document(
        revision=9,
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
    mf = build_ifc_exchange_manifest_payload(doc)
    assert mf["ifcEncoding"] == IFC_ENCODING_KERNEL_V1
    assert mf["artifactHasGeometryEntities"] is True
    assert mf["exportedIfcKindsInArtifact"] == {"level": 1, "wall": 1}


def test_export_ifc_wall_step_contains_ifc_wall_product():
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
    step = export_ifc_model_step(doc)
    upper = step.upper()
    assert "IFCWALL" in upper


def test_ifc_read_back_surface_has_walls_storeys_and_spaces():
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
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="S",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": -500, "yMm": -500},
                    {"xMm": 5000, "yMm": -500},
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": -500, "yMm": 5000},
                ],
                thicknessMm=220,
            ),
            "rm": RoomElem(
                kind="room",
                id="rm",
                name="Rm",
                levelId="lvl-g",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3500, "yMm": 0},
                    {"xMm": 3500, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
                programmeCode="READBACK",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    import ifcopenshell

    model = ifcopenshell.file.from_string(step)

    walls = model.by_type("IfcWall") or []
    storeys = model.by_type("IfcBuildingStorey") or []
    spaces = model.by_type("IfcSpace") or []
    assert len(walls) >= 1, "read-back expected at least one IfcWall"
    assert len(storeys) >= 1, "read-back expected at least one IfcBuildingStorey"
    assert len(spaces) >= 1, "read-back expected at least one IfcSpace from room"


def test_ifc_read_back_wall_and_space_psets_expose_reference_ids() -> None:
    """IFS/IDS-style read path: IFC property sets carry kernel ``Reference`` ↔ element id."""
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
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "rm-space": RoomElem(
                kind="room",
                id="rm-space",
                name="Rm",
                levelId="lvl-g",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3500, "yMm": 0},
                    {"xMm": 3500, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
                programmeCode="READBACK",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    import ifcopenshell
    import ifcopenshell.util.element as elem_util

    model = ifcopenshell.file.from_string(step)
    walls = model.by_type("IfcWall") or []
    spaces = model.by_type("IfcSpace") or []
    assert walls
    assert spaces
    w_ps = elem_util.get_psets(walls[0])
    assert (w_ps.get("Pset_WallCommon") or {}).get("Reference") == "w-a"
    s_ps = elem_util.get_psets(spaces[0])
    assert (s_ps.get("Pset_SpaceCommon") or {}).get("Reference") == "rm-space"
    assert (s_ps.get("Pset_SpaceCommon") or {}).get("ProgrammeCode") == "READBACK"


def test_export_ifc_wall_encoding_kernel_string():
    assert IFC_ENCODING_KERNEL_V1 == "bim_ai_ifc_kernel_v1"


def test_export_ifc_wall_step_contains_voids_fillings_hosts():
    doc = Document(
        revision=12,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-host": WallElem(
                kind="wall",
                id="w-host",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w-host",
                alongT=0.5,
                widthMm=900,
            ),
            "z1": WindowElem(
                kind="window",
                id="z1",
                name="Z",
                wallId="w-host",
                alongT=0.15,
                widthMm=900,
                sillHeightMm=900,
                heightMm=1200,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "IFCOPENINGELEMENT" in u
    assert "IFCDOOR" in u
    assert "IFCWINDOW" in u
    assert "IFCRELVOIDSELEMENT" in u
    assert "IFCRELFILLSELEMENT" in u


def test_export_ifc_emits_roof_stair_and_slab_hosted_openings():
    doc = Document(
        revision=30,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5500, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl-1": FloorElem(
                kind="floor",
                id="fl-1",
                name="S",
                levelId="l0",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
                thicknessMm=220,
            ),
            "so-1": SlabOpeningElem(
                kind="slab_opening",
                id="so-1",
                name="O",
                hostFloorId="fl-1",
                boundaryMm=[
                    {"xMm": 900, "yMm": 900},
                    {"xMm": 1900, "yMm": 900},
                    {"xMm": 1900, "yMm": 1700},
                    {"xMm": 900, "yMm": 1700},
                ],
            ),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="R",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6500, "yMm": 0},
                    {"xMm": 6500, "yMm": 5500},
                    {"xMm": 0, "yMm": 5500},
                ],
                overhangMm=300,
                slopeDeg=30,
            ),
            "st-1": StairElem(
                kind="stair",
                id="st-1",
                name="St",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 4200, "yMm": 800},
                runEndMm={"xMm": 4200, "yMm": 3200},
                widthMm=1100,
                riserMm=175,
                treadMm=280,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    u = step.upper()
    assert "IFCWALL" in u
    assert "IFCSLAB" in u
    assert "IFCROOF" in u
    assert "IFCSTAIR" in u
    assert "IFCOPENINGELEMENT" in u
    assert "IFCRELVOIDSELEMENT" in u


def test_ifc_manifest_reports_kernel_geometry_skip_counts_on_orphan_door():
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


def test_export_ifc_kernel_wall_step_includes_pset_relationships() -> None:
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
    step = export_ifc_model_step(doc).upper()
    assert "IFCRELDEFINESBYPROPERTIES" in step
    assert "IFCPROPERTYSET" in step


def test_export_ifc_kernel_qto_matrix_for_wall_slab_space_door_window() -> None:
    """When IfcOpenShell QTO helpers succeed, expect narrow ``Qto_*BaseQuantities`` templates."""
    doc = Document(
        revision=101,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-host": WallElem(
                kind="wall",
                id="w-host",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 8000, "yMm": 0},
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
                    {"xMm": 9000, "yMm": 0},
                    {"xMm": 9000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                thicknessMm=220,
            ),
            "rm": RoomElem(
                kind="room",
                id="rm",
                name="Lab",
                levelId="lvl-g",
                outlineMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 7000, "yMm": 1000},
                    {"xMm": 7000, "yMm": 5500},
                    {"xMm": 1000, "yMm": 5500},
                ],
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w-host",
                alongT=0.52,
                widthMm=900,
            ),
            "z1": WindowElem(
                kind="window",
                id="z1",
                name="Z",
                wallId="w-host",
                alongT=0.22,
                widthMm=900,
                sillHeightMm=900,
                heightMm=1200,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    import ifcopenshell

    model = ifcopenshell.file.from_string(step)

    qtys = model.by_type("IfcElementQuantity")
    names = {q.Name for q in qtys if getattr(q, "Name", None)}

    expected = {
        "Qto_WallBaseQuantities",
        "Qto_SlabBaseQuantities",
        "Qto_SpaceBaseQuantities",
        "Qto_DoorBaseQuantities",
        "Qto_WindowBaseQuantities",
    }
    missing = sorted(expected - names)
    assert not missing, f"Missing QTO templates: {missing}; have {sorted(names)!r}"

    rels = model.by_type("IfcRelDefinesByProperties")
    qty_ids = {q.id() for q in qtys}
    linked_any = any(
        getattr(rel, "RelatingPropertyDefinition", None) is not None
        and rel.RelatingPropertyDefinition.id() in qty_ids
        for rel in rels
    )

    assert len(qtys) == 0 or linked_any

def test_ifc_inspection_matrix_covers_storeys_spaces_qtos_and_programme_fields() -> None:
    """``inspect_kernel_ifc_semantics`` collapses read-back smoke into a single matrix dict."""

    doc = Document(
        revision=202,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
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
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
                thicknessMm=220,
            ),
            "rm": RoomElem(
                kind="room",
                id="rm-id",
                name="Clean Lab",
                levelId="lvl-g",
                outlineMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 5000, "yMm": 1000},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 1000, "yMm": 4000},
                ],
                programmeCode="ISO7",
                department="Process",
                functionLabel="Airlock ante",
                finishSet="Epoxy_C3",
            ),
        },
    )
    rep = inspect_kernel_ifc_semantics(doc=doc)
    assert rep["available"] is True
    assert rep["matrixVersion"] == 1
    assert rep["buildingStorey"]["count"] >= 1
    assert rep["buildingStorey"]["elevationsPresent"] >= 1
    assert rep["products"]["IfcWall"] >= 1
    assert rep["products"]["IfcSpace"] >= 1
    assert rep["identityPsets"]["wallWithPsetWallCommonReference"] >= 1
    assert rep["identityPsets"]["spaceWithPsetSpaceCommonReference"] >= 1
    sf = rep["spaceProgrammeFields"]
    assert sf["ProgrammeCode"] >= 1
    assert sf["Department"] >= 1
    assert sf["FunctionLabel"] >= 1
    assert sf["FinishSet"] >= 1

    step = export_ifc_model_step(doc)
    import ifcopenshell
    import ifcopenshell.util.element as elem_util

    model = ifcopenshell.file.from_string(step)
    spaces = model.by_type("IfcSpace") or []
    assert spaces
    s_ps = elem_util.get_psets(spaces[0])
    pc = s_ps.get("Pset_SpaceCommon") or {}
    assert pc.get("ProgrammeCode") == "ISO7"
    assert pc.get("Department") == "Process"
    assert pc.get("FunctionLabel") == "Airlock ante"
    assert pc.get("FinishSet") == "Epoxy_C3"

    rep2 = inspect_kernel_ifc_semantics(step_text=step)
    assert rep2["available"] is True
    assert rep2["products"]["IfcSpace"] == rep["products"]["IfcSpace"]


def test_ifc_inspection_matrix_includes_geometry_skip_counts_on_eligible_doc() -> None:
    doc = Document(
        revision=203,
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
    rep = inspect_kernel_ifc_semantics(doc=doc)
    assert rep["available"] is True
    assert (rep.get("ifcKernelGeometrySkippedCounts") or {}).get("door_missing_host_wall") == 1

