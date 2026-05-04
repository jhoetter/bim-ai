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
from bim_ai.engine import try_apply_kernel_ifc_authoritative_replay_v0
from bim_ai.export_ifc import (
    AUTHORITATIVE_REPLAY_KIND_V0,
    IFC_AVAILABLE,
    IFC_ENCODING_KERNEL_V1,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    export_ifc_model_step,
    inspect_kernel_ifc_semantics,
    summarize_kernel_ifc_semantic_roundtrip,
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
    us0 = rep.get("importScopeUnsupportedIfcProducts_v0") or {}
    assert us0.get("schemaVersion") == 0
    assert us0.get("countsByClass") == {}
    assert rep["buildingStorey"]["count"] >= 1
    assert rep["buildingStorey"]["elevationsPresent"] >= 1
    assert rep["products"]["IfcWall"] >= 1
    assert rep["products"]["IfcSlab"] >= 1
    assert rep["products"]["IfcSpace"] >= 1
    assert rep["identityPsets"]["wallWithPsetWallCommonReference"] >= 1
    assert rep["identityPsets"]["spaceWithPsetSpaceCommonReference"] >= 1
    assert rep["identityPsets"]["slabWithPsetSlabCommonReference"] >= 1
    ql = rep.get("qtoLinkedProducts") or {}
    assert ql.get("IfcWall", 0) >= 1
    assert ql.get("IfcSlab", 0) >= 1
    assert ql.get("IfcSpace", 0) >= 1
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

    rt = summarize_kernel_ifc_semantic_roundtrip(doc)
    assert rt["roundtripChecks"] is not None
    assert rt["roundtripChecks"]["allQtoLinksMatch"] is True
    assert rt["roundtripChecks"]["allChecksPass"] is True
    assert rt["commandSketch"] is not None
    assert rt["commandSketch"]["referenceIdsFromIfc"]["IfcWall"]
    assert rt["commandSketch"]["referenceIdsFromIfc"]["IfcSpace"]
    sk = rt["commandSketch"]
    assert sk["levelsFromDocument"] == [{"id": "lvl-g", "name": "G", "elevationMm": 0.0}]
    assert any(s.get("name") == "G" for s in sk["storeysFromIfc"])
    assert set(sk["qtoTemplatesFromIfc"]) >= {
        "Qto_WallBaseQuantities",
        "Qto_SlabBaseQuantities",
        "Qto_SpaceBaseQuantities",
    }
    assert sk["spaceProgrammeSampleFromIfc"]
    sample0 = sk["spaceProgrammeSampleFromIfc"][0]
    assert sample0.get("programmeFields", {}).get("ProgrammeCode") == "ISO7"
    rt_us = (rt["inspection"] or {}).get("importScopeUnsupportedIfcProducts_v0") or {}
    assert rt_us.get("countsByClass") == {}


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


def test_ifc_authoritative_replay_v0_same_step_is_deterministic() -> None:
    doc = Document(
        revision=501,
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
    a1 = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    a2 = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert a1 == a2
    assert a1["available"] is True
    assert a1["replayKind"] == AUTHORITATIVE_REPLAY_KIND_V0


def test_ifc_authoritative_replay_v0_wall_geometry_roundtrip() -> None:
    doc = Document(
        revision=502,
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
            "w-diag": WallElem(
                kind="wall",
                id="w-diag",
                name="D",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 3000},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["unsupportedIfcProducts"]["countsByClass"] == {}
    cmds = sketch["commands"]
    wall_cmds = [c for c in cmds if c["type"] == "createWall"]
    assert len(wall_cmds) == 2
    by_id = {str(c["id"]): c for c in wall_cmds}
    w0 = by_id["w-a"]
    assert abs(w0["thicknessMm"] - 200) < 0.1
    assert abs(w0["heightMm"] - 2800) < 0.2
    assert abs(w0["start"]["xMm"] - 0) < 0.01
    assert abs(w0["start"]["yMm"] - 0) < 0.01
    assert abs(w0["end"]["xMm"] - 3000) < 0.01
    assert abs(w0["end"]["yMm"] - 0) < 0.01

    wd = by_id["w-diag"]
    assert abs(wd["end"]["xMm"] - 3000) < 0.05
    assert abs(wd["end"]["yMm"] - 3000) < 0.05
    assert not sketch.get("extractionGaps")


def test_ifc_authoritative_replay_v0_wall_on_second_level_references_level_id() -> None:
    doc = Document(
        revision=503,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=3000),
            "w-up": WallElem(
                kind="wall",
                id="w-up",
                name="W",
                levelId="l1",
                start={"xMm": 100, "yMm": 200},
                end={"xMm": 4100, "yMm": 200},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    level_cmds = [c for c in sketch["commands"] if c["type"] == "createLevel"]
    wall_cmds = [c for c in sketch["commands"] if c["type"] == "createWall"]
    assert len(level_cmds) == 2
    assert len(wall_cmds) == 1
    og_level_id = next(c["id"] for c in level_cmds if c.get("name") == "OG")
    assert wall_cmds[0]["levelId"] == og_level_id
    assert wall_cmds[0]["id"] == "w-up"
    assert abs(wall_cmds[0]["start"]["xMm"] - 100) < 0.05
    assert abs(wall_cmds[0]["end"]["xMm"] - 4100) < 0.05


def test_ifc_summarize_command_sketch_includes_authoritative_replay_v0() -> None:
    doc = Document(
        revision=504,
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
    rt = summarize_kernel_ifc_semantic_roundtrip(doc)
    assert rt["commandSketch"] is not None
    auth = rt["commandSketch"]["authoritativeReplay_v0"]
    assert auth["available"] is True
    assert auth["authoritativeSubset"] == {
        "levels": True,
        "walls": True,
        "spaces": True,
        "openings": False,
    }
    assert any(c.get("type") == "createLevel" for c in auth["commands"])
    assert any(c.get("type") == "createWall" for c in auth["commands"])


def test_ifc_authoritative_replay_v0_space_outline_and_ids_map() -> None:
    doc = Document(
        revision=505,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
            ),
            "rm-1": RoomElem(
                kind="room",
                id="rm-1",
                name="Office",
                levelId="lvl-g",
                outlineMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 4000, "yMm": 1000},
                    {"xMm": 4000, "yMm": 4000},
                    {"xMm": 1000, "yMm": 4000},
                ],
                programmeCode="PC1",
                department="DeptA",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"]["spaces"] is True
    assert sketch["authoritativeSubset"].get("openings") is False
    assert sketch.get("kernelSpaceSkippedNoReference") == 0

    room_cmds = [c for c in sketch["commands"] if c["type"] == "createRoomOutline"]
    assert len(room_cmds) == 1
    rc = room_cmds[0]
    assert rc["id"] == "rm-1"
    assert rc["name"] == "Office"
    assert rc["programmeCode"] == "PC1"
    assert rc["department"] == "DeptA"

    level_ids = {c["id"] for c in sketch["commands"] if c["type"] == "createLevel"}
    assert rc["levelId"] in level_ids

    exp_outline = [(1000, 1000), (4000, 1000), (4000, 4000), (1000, 4000)]
    got = [(float(p["xMm"]), float(p["yMm"])) for p in rc["outlineMm"]]
    assert len(got) == 4
    for ex, ey in exp_outline:
        assert any(abs(px - ex) < 0.15 and abs(py - ey) < 0.15 for px, py in got)

    ids_map = sketch["idsAuthoritativeReplayMap_v0"]
    assert ids_map["schemaVersion"] == 0
    assert len(ids_map["spaces"]) == 1
    row = ids_map["spaces"][0]
    assert row["identityReference"] == "rm-1"
    assert row["programmeFields"]["programmeCode"] == "PC1"
    assert row["programmeFields"]["department"] == "DeptA"
    assert row["qtoSpaceBaseQuantitiesLinked"] is True


def test_ifc_authoritative_replay_v0_apply_to_empty_document() -> None:
    doc = Document(
        revision=506,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
            ),
            "rm-1": RoomElem(
                kind="room",
                id="rm-1",
                name="Office",
                levelId="lvl-g",
                outlineMm=[
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 4000, "yMm": 1000},
                    {"xMm": 4000, "yMm": 4000},
                    {"xMm": 1000, "yMm": 4000},
                ],
                programmeCode="PC1",
                department="DeptA",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"].get("openings") is False
    want_levels = sum(1 for c in sketch["commands"] if c["type"] == "createLevel")
    want_walls = sum(1 for c in sketch["commands"] if c["type"] == "createWall")
    want_rooms = sum(1 for c in sketch["commands"] if c["type"] == "createRoomOutline")
    assert want_levels >= 1 and want_rooms >= 1

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True
    assert code == "ok"
    assert new_doc is not None
    assert new_doc.elements
    by_kind: dict[str, int] = {}
    for el in new_doc.elements.values():
        k = getattr(el, "kind", None)
        if isinstance(k, str):
            by_kind[k] = by_kind.get(k, 0) + 1
    assert by_kind.get("level", 0) == want_levels
    assert by_kind.get("wall", 0) == want_walls
    assert by_kind.get("room", 0) == want_rooms
    assert not viols or not any(v.blocking or v.severity == "error" for v in viols)


def test_ifc_authoritative_replay_v0_hosted_openings_roundtrip() -> None:
    doc = Document(
        revision=507,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-main": WallElem(
                kind="wall",
                id="w-main",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d-1": DoorElem(
                kind="door",
                id="d-1",
                name="D1",
                wallId="w-main",
                alongT=0.35,
                widthMm=900,
            ),
            "win-1": WindowElem(
                kind="window",
                id="win-1",
                name="W1",
                wallId="w-main",
                alongT=0.72,
                widthMm=1200,
                sillHeightMm=900,
                heightMm=1500,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"]["openings"] is True
    assert sketch.get("kernelDoorSkippedNoReference") == 0
    assert sketch.get("kernelWindowSkippedNoReference") == 0
    door_cmds = [c for c in sketch["commands"] if c["type"] == "insertDoorOnWall"]
    win_cmds = [c for c in sketch["commands"] if c["type"] == "insertWindowOnWall"]
    assert len(door_cmds) == 1
    assert door_cmds[0].get("wallId") == "w-main" and door_cmds[0].get("id") == "d-1"
    assert len(win_cmds) == 1
    assert win_cmds[0].get("wallId") == "w-main" and win_cmds[0].get("id") == "win-1"

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True and code == "ok" and new_doc is not None
    assert "d-1" in new_doc.elements and "win-1" in new_doc.elements
    assert not viols or not any(v.blocking or v.severity == "error" for v in viols)


def test_ifc_authoritative_replay_v0_slab_opening_roundtrip() -> None:
    doc = Document(
        revision=508,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "fl-host": FloorElem(
                kind="floor",
                id="fl-host",
                name="Slab",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
                thicknessMm=220,
            ),
            "void-1": SlabOpeningElem(
                kind="slab_opening",
                id="void-1",
                name="Shaft",
                hostFloorId="fl-host",
                boundaryMm=[
                    {"xMm": 1000, "yMm": 900},
                    {"xMm": 2100, "yMm": 900},
                    {"xMm": 2100, "yMm": 1800},
                    {"xMm": 1000, "yMm": 1800},
                ],
                isShaft=True,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"]["floors"] is True
    assert sketch["authoritativeSubset"]["slabOpenings"] is True
    assert sketch.get("kernelSlabSkippedNoReference") == 0
    assert sketch.get("kernelSlabOpeningSkippedNoReference") == 0

    floor_cmds = [c for c in sketch["commands"] if c["type"] == "createFloor"]
    opening_cmds = [c for c in sketch["commands"] if c["type"] == "createSlabOpening"]
    assert len(floor_cmds) == 1
    assert floor_cmds[0]["id"] == "fl-host"
    assert abs(floor_cmds[0]["thicknessMm"] - 220) < 0.2
    assert len(opening_cmds) == 1
    assert opening_cmds[0]["id"] == "void-1"
    assert opening_cmds[0]["hostFloorId"] == "fl-host"

    exp_outline = [(1000, 900), (2100, 900), (2100, 1800), (1000, 1800)]
    got = [(float(p["xMm"]), float(p["yMm"])) for p in opening_cmds[0]["boundaryMm"]]
    assert len(got) == 4
    for ex, ey in exp_outline:
        assert any(abs(px - ex) < 0.2 and abs(py - ey) < 0.2 for px, py in got)

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True and code == "ok" and new_doc is not None
    assert "fl-host" in new_doc.elements and "void-1" in new_doc.elements
    assert new_doc.elements["void-1"].kind == "slab_opening"
    assert not viols or not any(v.blocking or v.severity == "error" for v in viols)

