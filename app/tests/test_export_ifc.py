"""IFC STEP export smoke tests (IfcOpenShell optional in local dev bare installs — CI installs `[ifc]`)."""

from __future__ import annotations

from typing import Any

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    FloorTypeElem,
    LevelElem,
    RoofElem,
    RoofTypeElem,
    RoomElem,
    SiteElem,
    SlabOpeningElem,
    StairElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
    WindowElem,
)
from bim_ai.engine import try_apply_kernel_ifc_authoritative_replay_v0
from bim_ai.export_ifc import (
    AUTHORITATIVE_REPLAY_KIND_V0,
    IFC_AVAILABLE,
    IFC_ENCODING_KERNEL_V1,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    build_kernel_ifc_authoritative_replay_sketch_v0_from_model,
    export_ifc_model_step,
    inspect_kernel_ifc_semantics,
    summarize_kernel_ifc_semantic_roundtrip,
)
from bim_ai.ifc_stub import build_ifc_exchange_manifest_payload

pytestmark = pytest.mark.skipif(
    not IFC_AVAILABLE, reason="ifcopenshell not installed (pip install '.[ifc]')"
)


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


def test_ifc_material_layer_set_export_and_readback_matches_document() -> None:
    doc = Document(
        revision=31,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=100, layer_function="structure", material_key="mat-w-structure"
                    ),
                    WallTypeLayer(
                        thicknessMm=50, layer_function="finish", material_key="mat-w-finish"
                    ),
                ],
            ),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=150,
                heightMm=2800,
                wallTypeId="wt",
            ),
            "ft": FloorTypeElem(
                kind="floor_type",
                id="ft",
                name="FT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=120, layer_function="structure", material_key="mat-f-structure"
                    ),
                    WallTypeLayer(
                        thicknessMm=40, layer_function="finish", material_key="mat-f-finish"
                    ),
                ],
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
                thicknessMm=160,
                floorTypeId="ft",
            ),
            "rt": RoofTypeElem(
                kind="roof_type",
                id="rt",
                name="RT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=30, layer_function="structure", material_key="mat-r-structure"
                    ),
                    WallTypeLayer(
                        thicknessMm=80, layer_function="insulation", material_key="mat-r-ins"
                    ),
                ],
            ),
            "rf": RoofElem(
                kind="roof",
                id="rf",
                name="R",
                referenceLevelId="lvl-g",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 1500},
                    {"xMm": 0, "yMm": 1500},
                ],
                roofTypeId="rt",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    upper = step.upper()
    assert "IFCMATERIALLAYERSET" in upper

    ins = inspect_kernel_ifc_semantics(doc=doc)
    ml = ins.get("materialLayerSetReadback_v0") or {}
    assert ml.get("available") is True
    by_id = {
        str(h.get("hostElementId")): h for h in (ml.get("hosts") or []) if h.get("hostElementId")
    }
    assert by_id["w-a"].get("readbackState") == "matched"
    assert by_id["fl"].get("readbackState") == "matched"
    assert by_id["rf"].get("readbackState") == "matched"

    summary = summarize_kernel_ifc_semantic_roundtrip(doc)
    rtc = summary.get("roundtripChecks") or {}
    ml_rb = rtc.get("materialLayerReadback") or {}
    assert ml_rb.get("allMatched") is True
    mf = build_ifc_exchange_manifest_payload(doc)
    ev = mf.get("ifcMaterialLayerSetReadbackEvidence_v0") or {}
    assert ev.get("format") == "ifcMaterialLayerSetReadbackEvidence_v0"
    assert (ev.get("summary") or {}).get("hostsMatched", 0) >= 3


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


def test_ifc_wall_common_load_bearing_roundtrips_to_authoritative_replay() -> None:
    doc = Document(
        revision=3,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-struct": WallElem(
                kind="wall",
                id="w-struct",
                name="Structural Wall",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                loadBearing=True,
                structuralRole="load_bearing",
                analyticalParticipation=True,
                structuralMaterialKey="concrete-c30",
                structuralIntentConfidence=0.75,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    import ifcopenshell
    import ifcopenshell.util.element as elem_util

    model = ifcopenshell.file.from_string(step)
    wall = (model.by_type("IfcWall") or [])[0]
    pset = elem_util.get_psets(wall).get("Pset_WallCommon") or {}
    assert pset.get("Reference") == "w-struct"
    assert pset.get("LoadBearing") is True
    assert pset.get("BimAiStructuralRole") == "load_bearing"

    replay = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    wall_cmd = next(c for c in replay["commands"] if c.get("type") == "createWall")
    assert wall_cmd["id"] == "w-struct"
    assert wall_cmd["loadBearing"] is True
    assert wall_cmd["structuralRole"] == "load_bearing"
    assert wall_cmd["analyticalParticipation"] is True
    assert wall_cmd["structuralMaterialKey"] == "concrete-c30"
    assert wall_cmd["structuralIntentConfidence"] == 0.75


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
    pcov = rep.get("propertySetCoverageEvidence_v0") or {}
    assert pcov.get("available") is True
    assert int((pcov.get("summary") or {}).get("rowsTotal") or 0) >= 1
    wall_rows_cov = [r for r in (pcov.get("rows") or []) if r.get("kernelKind") == "wall"]
    assert wall_rows_cov
    assert wall_rows_cov[0].get("idsGapReasonToken") == "ids_ok"
    room_rows_cov = [r for r in (pcov.get("rows") or []) if r.get("kernelKind") == "room"]
    assert room_rows_cov
    rr_cov = room_rows_cov[0]
    assert rr_cov.get("idsGapReasonToken") == "ids_ok"
    crit_cov = rr_cov.get("criticalPropertiesByPset") or {}
    psc_keys_cov = crit_cov.get("Pset_SpaceCommon") or []
    assert "Reference" in psc_keys_cov
    assert "ProgrammeCode" in psc_keys_cov
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

    sx0 = rep.get("siteExchangeEvidence_v0") or {}
    assert sx0.get("kernelSiteCount") == 0
    assert sx0.get("kernelIdsMatchJoinedReference") is True

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
    rt_pcov = rt["roundtripChecks"].get("propertySetCoverage") or {}
    assert isinstance(rt_pcov, dict)
    assert rt_pcov.get("allRowsGapFree") is True
    assert int(rt_pcov.get("rowsTotal") or 0) >= 1
    assert rt["roundtripChecks"]["allQtoLinksMatch"] is True
    assert rt["roundtripChecks"]["allChecksPass"] is True
    assert rt["commandSketch"] is not None
    assert rt["commandSketch"]["referenceIdsFromIfc"]["IfcWall"]
    assert rt["commandSketch"]["referenceIdsFromIfc"]["IfcSpace"]
    assert rt["commandSketch"]["referenceIdsFromIfc"]["IfcSite"] == []
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


def test_ifc_site_identity_reference_pset_and_exchange_evidence_v0() -> None:
    doc = Document(
        revision=905,
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
            "site-a": SiteElem(
                kind="site",
                id="site-a",
                name="AlphaLot",
                referenceLevelId="lvl-g",
                boundaryMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=6000, yMm=0),
                    Vec2Mm(xMm=6000, yMm=4000),
                    Vec2Mm(xMm=0, yMm=4000),
                ],
                padThicknessMm=100,
            ),
            "site-b": SiteElem(
                kind="site",
                id="site-b",
                referenceLevelId="lvl-g",
                boundaryMm=[
                    Vec2Mm(xMm=0, yMm=0),
                    Vec2Mm(xMm=4000, yMm=0),
                    Vec2Mm(xMm=4000, yMm=4000),
                    Vec2Mm(xMm=0, yMm=4000),
                ],
                padThicknessMm=100,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    kinds = mf.get("kernelExpectedIfcKinds") or {}
    assert kinds.get("site") == 2

    step = export_ifc_model_step(doc)
    import ifcopenshell
    import ifcopenshell.util.element as elem_util

    model = ifcopenshell.file.from_string(step)
    sites = model.by_type("IfcSite") or []
    assert len(sites) >= 1
    site_el = sites[0]
    assert str(getattr(site_el, "Name", None) or "") == "AlphaLot"
    ps = elem_util.get_psets(site_el)
    bucket = ps.get("Pset_SiteCommon") or {}
    assert bucket.get("Reference") == "site-a,site-b"

    rep = inspect_kernel_ifc_semantics(doc=doc)
    sx = rep.get("siteExchangeEvidence_v0") or {}
    assert sx["kernelSiteCount"] == 2
    assert sx["joinedKernelSiteIdsExpected"] == "site-a,site-b"
    assert sx["kernelIdsMatchJoinedReference"] is True
    assert rep["identityPsets"]["siteWithPsetSiteCommonReference"] >= 1

    rt = summarize_kernel_ifc_semantic_roundtrip(doc)
    assert rt["roundtripChecks"]["identityCoverage"]["site"]["match"] is True
    site_refs = rt["commandSketch"]["referenceIdsFromIfc"]["IfcSite"]
    assert "site-a,site-b" in site_refs

    ar = rt["commandSketch"]["authoritativeReplay_v0"]
    assert ar["available"] is True
    cmds = ar["commands"]
    assert all(c.get("type") != "upsertSite" for c in cmds)


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
        "floors": False,
        "slabVoids": False,
        "roofs": False,
        "stairs": False,
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
    assert sketch["authoritativeSubset"].get("floors") is True
    assert sketch["authoritativeSubset"].get("slabVoids") is False
    assert sketch["authoritativeSubset"].get("stairs") is False
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
    assert ids_map.get("roofs") == []
    assert len(ids_map.get("floors") or []) == 1
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
    want_floors = sum(1 for c in sketch["commands"] if c["type"] == "createFloor")
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
    assert by_kind.get("floor", 0) == want_floors
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

    skip_ev = sketch.get("slabRoofHostedVoidReplaySkipped_v0") or {}
    assert skip_ev.get("schemaVersion") == 0
    counts = skip_ev.get("countsByHostKindAndReason") or {}
    assert counts.get("IfcWall:wall_host_opening_handled_by_door_window_path_v0") == 2

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True and code == "ok" and new_doc is not None
    assert "d-1" in new_doc.elements and "win-1" in new_doc.elements
    assert not viols or not any(v.blocking or v.severity == "error" for v in viols)


def test_ifc_authoritative_replay_v0_slab_floor_and_opening_roundtrip() -> None:
    doc = Document(
        revision=508,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
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
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"].get("floors") is True
    assert sketch["authoritativeSubset"].get("slabVoids") is True

    floor_cmds = [c for c in sketch["commands"] if c["type"] == "createFloor"]
    void_cmds = [c for c in sketch["commands"] if c["type"] == "createSlabOpening"]
    assert len(floor_cmds) == 1 and floor_cmds[0].get("id") == "fl-1"
    assert len(void_cmds) == 1
    assert void_cmds[0].get("id") == "so-1" and void_cmds[0].get("hostFloorId") == "fl-1"

    typ_order = [c["type"] for c in sketch["commands"]]
    assert typ_order.index("createFloor") < typ_order.index("createWall")
    assert typ_order.index("createWall") < typ_order.index("createSlabOpening")

    counts = (sketch.get("slabRoofHostedVoidReplaySkipped_v0") or {}).get(
        "countsByHostKindAndReason"
    ) or {}
    assert counts.get("IfcWall:wall_host_opening_handled_by_door_window_path_v0", 0) == 0

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True and code == "ok" and new_doc is not None
    assert "fl-1" in new_doc.elements and "so-1" in new_doc.elements
    assert not viols or not any(v.blocking or v.severity == "error" for v in viols)


def test_ifc_authoritative_replay_v0_typed_floor_ids_map_floor_type_id_command() -> None:
    doc = Document(
        revision=530,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "ft-1": FloorTypeElem(
                kind="floor_type",
                id="ft-1",
                name="Concrete 220",
                layers=[WallTypeLayer(thicknessMm=220, function="structure", materialKey=None)],
            ),
            "fl-t": FloorElem(
                kind="floor",
                id="fl-t",
                name="typed",
                levelId="l0",
                floorTypeId="ft-1",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                thicknessMm=220,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    ids_map = sketch["idsAuthoritativeReplayMap_v0"]
    floors = ids_map.get("floors") or []
    assert len(floors) == 1
    assert floors[0]["identityReference"] == "fl-t"
    assert floors[0]["floorTypeIdentityReference"] == "ft-1"
    assert floors[0]["qtoSlabBaseQuantitiesLinked"] is True

    floor_cmds = [c for c in sketch["commands"] if c["type"] == "createFloor"]
    assert len(floor_cmds) == 1
    assert floor_cmds[0]["id"] == "fl-t"
    assert floor_cmds[0]["floorTypeId"] == "ft-1"

    tf_ev = sketch.get("typedFloorAuthoritativeReplayEvidence_v0") or {}
    assert tf_ev.get("schemaVersion") == 0
    assert tf_ev.get("createFloorReplayCommandCount") == 1
    assert tf_ev.get("idsFloorRowsCount") == 1


def test_ifc_authoritative_replay_v0_typed_floor_preflight_floor_type_must_exist() -> None:
    doc = Document(
        revision=531,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "ft-1": FloorTypeElem(
                kind="floor_type",
                id="ft-1",
                name="Concrete 220",
                layers=[WallTypeLayer(thicknessMm=220, function="structure", materialKey=None)],
            ),
            "fl-t": FloorElem(
                kind="floor",
                id="fl-t",
                name="typed",
                levelId="l0",
                floorTypeId="ft-1",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3500, "yMm": 0},
                    {"xMm": 3500, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
                thicknessMm=220,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert any(
        c.get("type") == "createFloor" and c.get("floorTypeId") == "ft-1"
        for c in sketch["commands"]
    )

    empty = Document(revision=0, elements={})
    ok, _nd, _c, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is False and code == "merge_reference_unresolved"

    seeded = Document(
        revision=3,
        elements={
            "ft-1": FloorTypeElem(
                kind="floor_type",
                id="ft-1",
                name="Concrete 220",
                layers=[WallTypeLayer(thicknessMm=220, function="structure", materialKey=None)],
            ),
        },
    )
    ok2, new_doc, _c2, _v2, code2 = try_apply_kernel_ifc_authoritative_replay_v0(seeded, sketch)
    assert ok2 is True and code2 == "ok" and new_doc is not None
    fl_applied = new_doc.elements.get("fl-t")
    assert isinstance(fl_applied, FloorElem)
    assert fl_applied.floor_type_id == "ft-1"


def _replay_stair_assign_extrusion_depth_mm(product: Any, depth_mm: float) -> None:
    rep = getattr(product, "Representation", None)
    if rep is None:
        return
    for r in rep.Representations or []:
        try:
            if getattr(r, "RepresentationIdentifier", None) != "Body":
                continue
        except Exception:
            continue
        for it in r.Items or []:
            try:
                if it.is_a("IfcExtrudedAreaSolid"):
                    it.Depth = float(depth_mm)
                    return
            except Exception:
                continue


def test_ifc_authoritative_replay_v0_stair_roundtrip_and_apply() -> None:
    doc = Document(
        revision=511,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="U", elevationMm=3000),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4500, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "st-1": StairElem(
                kind="stair",
                id="st-1",
                name="Main",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 500, "yMm": 800},
                runEndMm={"xMm": 2800, "yMm": 800},
                widthMm=1100,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"]["stairs"] is True
    assert sketch.get("kernelStairSkippedNoReference") == 0
    stair_cmds = [c for c in sketch["commands"] if c["type"] == "createStair"]
    assert len(stair_cmds) == 1
    sc = stair_cmds[0]
    assert sc["id"] == "st-1"
    assert "riserMm" not in sc and "treadMm" not in sc
    level_cmds = [c for c in sketch["commands"] if c["type"] == "createLevel"]
    by_elev = {float(c["elevationMm"]): c["id"] for c in level_cmds}
    assert sc["baseLevelId"] == by_elev[0.0]
    assert sc["topLevelId"] == by_elev[3000.0]
    assert abs(sc["runStartMm"]["xMm"] - 500) < 0.15
    assert abs(sc["runStartMm"]["yMm"] - 800) < 0.15
    assert abs(sc["runEndMm"]["xMm"] - 2800) < 0.15
    assert abs(sc["runEndMm"]["yMm"] - 800) < 0.15
    assert abs(float(sc["widthMm"]) - 1100) < 0.15

    typ_order = [c["type"] for c in sketch["commands"]]
    assert typ_order.index("createWall") < typ_order.index("createStair")

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True and code == "ok" and new_doc is not None
    st_el = new_doc.elements.get("st-1")
    assert isinstance(st_el, StairElem)
    assert st_el.base_level_id == sc["baseLevelId"]
    assert st_el.top_level_id == sc["topLevelId"]
    assert abs(st_el.run_start.x_mm - sc["runStartMm"]["xMm"]) < 0.2
    assert abs(st_el.width_mm - float(sc["widthMm"])) < 0.2


def test_ifc_authoritative_replay_v0_stair_missing_reference_skipped() -> None:
    import ifcopenshell
    import ifcopenshell.util.element as ue
    from ifcopenshell.api.pset.edit_pset import edit_pset

    doc = Document(
        revision=512,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="U", elevationMm=3000),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3500, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "st-1": StairElem(
                kind="stair",
                id="st-1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 100, "yMm": 100},
                runEndMm={"xMm": 2000, "yMm": 100},
                widthMm=1000,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    st = model.by_type("IfcStair")[0]
    pinfo = ue.get_psets(st, psets_only=False)["Pset_StairCommon"]
    ps = model.by_id(pinfo["id"])
    edit_pset(model, pset=ps, properties={"Reference": ""})

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0_from_model(model)
    assert sketch["available"] is True
    assert [c for c in sketch["commands"] if c["type"] == "createStair"] == []
    assert sketch.get("kernelStairSkippedNoReference") == 1
    assert any(
        g.get("reason") == "stair_missing_pset_reference"
        for g in sketch.get("extractionGaps") or []
    )


def test_ifc_authoritative_replay_v0_stair_top_level_unresolved_skipped() -> None:
    import ifcopenshell

    doc = Document(
        revision=513,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="U", elevationMm=3000),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3500, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "st-1": StairElem(
                kind="stair",
                id="st-1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 100, "yMm": 100},
                runEndMm={"xMm": 2000, "yMm": 100},
                widthMm=1000,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    st = model.by_type("IfcStair")[0]
    _replay_stair_assign_extrusion_depth_mm(st, 2800.0)

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0_from_model(model)
    assert sketch["available"] is True
    assert [c for c in sketch["commands"] if c["type"] == "createStair"] == []
    assert any(
        g.get("reason") == "stair_top_level_unresolved" for g in sketch.get("extractionGaps") or []
    )


def test_ifc_authoritative_replay_v0_stairs_before_hosted_openings_in_command_order() -> None:
    doc = Document(
        revision=514,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="U", elevationMm=3000),
            "w-main": WallElem(
                kind="wall",
                id="w-main",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d-1": DoorElem(
                kind="door",
                id="d-1",
                name="D1",
                wallId="w-main",
                alongT=0.4,
                widthMm=900,
            ),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="R",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2500, "yMm": 0},
                    {"xMm": 2500, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
                overhangMm=300,
                slopeDeg=30,
            ),
            "st-1": StairElem(
                kind="stair",
                id="st-1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 4100, "yMm": 200},
                runEndMm={"xMm": 5200, "yMm": 200},
                widthMm=1000,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    typ_order = [c["type"] for c in sketch["commands"]]
    assert typ_order.index("createWall") < typ_order.index("createRoof")
    assert typ_order.index("createRoof") < typ_order.index("createStair")
    assert typ_order.index("createStair") < typ_order.index("insertDoorOnWall")


def test_ifc_authoritative_replay_v0_roof_roundtrip_and_apply() -> None:
    doc = Document(
        revision=520,
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
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    assert sketch["available"] is True
    assert sketch["authoritativeSubset"]["roofs"] is True
    assert sketch.get("kernelRoofSkippedNoReference") == 0
    roof_cmds = [c for c in sketch["commands"] if c["type"] == "createRoof"]
    assert len(roof_cmds) == 1
    rc = roof_cmds[0]
    assert rc["id"] == "rf-1"
    assert rc["roofGeometryMode"] == "mass_box"
    level_cmds = [c for c in sketch["commands"] if c["type"] == "createLevel"]
    by_elev = {float(c["elevationMm"]): c["id"] for c in level_cmds}
    assert rc["referenceLevelId"] == by_elev[2800.0]
    assert abs(float(rc["slopeDeg"]) - 30.0) < 0.2
    assert abs(float(rc["overhangMm"]) - 300.0) < 2.0
    want_fp = [(0.0, 0.0), (6500.0, 0.0), (6500.0, 5500.0), (0.0, 5500.0)]
    got = [(float(p["xMm"]), float(p["yMm"])) for p in rc["footprintMm"]]
    assert len(got) == 4
    for ex, ey in want_fp:
        assert any(abs(px - ex) < 0.2 and abs(py - ey) < 0.2 for px, py in got)

    ids_map = sketch["idsAuthoritativeReplayMap_v0"]
    assert len(ids_map["roofs"]) == 1
    assert ids_map.get("floors") == []
    assert ids_map["roofs"][0]["identityReference"] == "rf-1"

    typ_order = [c["type"] for c in sketch["commands"]]
    assert typ_order.index("createWall") < typ_order.index("createRoof")

    empty = Document(revision=0, elements={})
    ok, new_doc, _cmds, viols, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is True and code == "ok" and new_doc is not None
    r_el = new_doc.elements.get("rf-1")
    assert isinstance(r_el, RoofElem)
    assert r_el.reference_level_id == rc["referenceLevelId"]
    assert abs(float(r_el.slope_deg or 0) - float(rc["slopeDeg"])) < 0.25
    assert abs(float(r_el.overhang_mm) - float(rc["overhangMm"])) < 2.5
    assert not viols or not any(v.blocking or v.severity == "error" for v in viols)


def test_ifc_authoritative_replay_v0_roof_missing_reference_skipped() -> None:
    import ifcopenshell
    import ifcopenshell.util.element as ue
    from ifcopenshell.api.pset.edit_pset import edit_pset

    doc = Document(
        revision=521,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="l0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3500, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="R",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                overhangMm=250,
                slopeDeg=28,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs_m = model.by_type("IfcRoof") or []
    assert len(roofs_m) == 1
    rf = roofs_m[0]
    pinfo = ue.get_psets(rf, psets_only=False)["Pset_RoofCommon"]
    ps = model.by_id(pinfo["id"])
    edit_pset(model, pset=ps, properties={"Reference": ""})

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0_from_model(model)
    assert sketch["available"] is True
    assert [c for c in sketch["commands"] if c["type"] == "createRoof"] == []
    assert sketch.get("kernelRoofSkippedNoReference") == 1
    assert any(
        g.get("reason") == "roof_missing_pset_reference" for g in sketch.get("extractionGaps") or []
    )


def test_ifc_roof_type_id_round_trips_through_pset_bim_ai_kernel() -> None:
    """IFC-01: roofTypeId is preserved across export → re-parse → replay."""

    doc = Document(
        revision=600,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rt-gable": RoofTypeElem(
                kind="roof_type",
                id="rt-gable",
                name="Gable Deck",
                layers=[
                    WallTypeLayer(thicknessMm=18, layer_function="structure"),
                    WallTypeLayer(thicknessMm=120, layer_function="insulation"),
                ],
            ),
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
            "rf-typed": RoofElem(
                kind="roof",
                id="rf-typed",
                name="Typed Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6500, "yMm": 0},
                    {"xMm": 6500, "yMm": 5500},
                    {"xMm": 0, "yMm": 5500},
                ],
                overhangMm=300,
                slopeDeg=30,
                roofTypeId="rt-gable",
            ),
        },
    )

    step = export_ifc_model_step(doc)

    # Inspection counter sees the roof carrying the new property.
    insp = inspect_kernel_ifc_semantics(doc=doc, step_text=step)
    assert insp["identityPsets"]["roofWithBimAiRoofTypeId"] == 1

    # Authoritative replay sketch now carries the kernel roofTypeId on createRoof.
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    roof_cmds = [c for c in sketch["commands"] if c["type"] == "createRoof"]
    assert len(roof_cmds) == 1
    rc = roof_cmds[0]
    assert rc["id"] == "rf-typed"
    assert rc["roofTypeId"] == "rt-gable"


def test_ifc_roof_without_roof_type_id_does_not_emit_pset_bim_ai_kernel() -> None:
    """IFC-01: untyped roofs do not get a Pset_BimAiKernel.BimAiRoofTypeId property."""

    doc = Document(
        revision=601,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-1": RoofElem(
                kind="roof",
                id="rf-1",
                name="R",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                overhangMm=250,
                slopeDeg=28,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    insp = inspect_kernel_ifc_semantics(doc=doc, step_text=step)
    assert insp["identityPsets"]["roofWithBimAiRoofTypeId"] == 0

    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    roof_cmds = [c for c in sketch["commands"] if c["type"] == "createRoof"]
    assert len(roof_cmds) == 1
    # Default after replay is None — no roof_type_id should be emitted.
    assert roof_cmds[0].get("roofTypeId") in (None, "", False)


def test_ifc_gable_roof_emits_triangular_extrusion_body() -> None:
    """IFC-02: gable_pitched_rectangle roofs export with a 3-vertex triangular profile."""
    import ifcopenshell

    doc = Document(
        revision=700,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-gable": RoofElem(
                kind="roof",
                id="rf-gable",
                name="Gable Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                overhangMm=400,
                slopeDeg=35,
                roofGeometryMode="gable_pitched_rectangle",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    model = ifcopenshell.file.from_string(step)
    roofs_m = model.by_type("IfcRoof") or []
    assert len(roofs_m) == 1
    rf = roofs_m[0]
    rep = rf.Representation
    body = None
    for r in rep.Representations or []:
        if getattr(r, "RepresentationIdentifier", None) == "Body":
            body = r
            break
    assert body is not None
    items = list(body.Items or [])
    assert len(items) == 1
    extrusion = items[0]
    assert extrusion.is_a("IfcExtrudedAreaSolid")
    profile = extrusion.SweptArea
    assert profile.is_a("IfcArbitraryClosedProfileDef")
    pts = list(profile.OuterCurve.Points)
    # 3 unique gable vertices + closure → 4 entries.
    assert len(pts) == 4
    # Footprint 6000 × 4000: kernel ridge convention parallels the shorter span
    # (alongZ, 4000), so the cross-section spans the longer axis = 6000 mm.
    xs = [p.Coordinates[0] for p in pts]
    ys = [p.Coordinates[1] for p in pts]
    assert pytest.approx(max(xs) - min(xs), abs=1e-3) == 6.0
    # Symmetric ridge at offset 0, slope 35° → rise = 3.0 * tan(35°)
    import math as _m

    expected_rise_m = 3.0 * _m.tan(_m.radians(35))
    assert pytest.approx(max(ys), abs=1e-2) == expected_rise_m

    insp = inspect_kernel_ifc_semantics(doc=doc, step_text=step)
    assert insp["identityPsets"]["roofWithGablePitchedBodyV0"] == 1


def test_ifc_flat_roof_does_not_emit_gable_body() -> None:
    """IFC-02: flat (mass_box) roofs keep the existing slab-style extrusion."""
    doc = Document(
        revision=701,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "rf-flat": RoofElem(
                kind="roof",
                id="rf-flat",
                name="Flat Roof",
                referenceLevelId="l0",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                overhangMm=200,
                slopeDeg=2,
                roofGeometryMode="mass_box",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    insp = inspect_kernel_ifc_semantics(doc=doc, step_text=step)
    assert insp["identityPsets"]["roofWithGablePitchedBodyV0"] == 0


def test_ifc_gable_roof_geometry_mode_round_trips_through_replay() -> None:
    """IFC-02: roofGeometryMode + footprint round-trip through export → replay."""
    doc = Document(
        revision=702,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-gable": RoofElem(
                kind="roof",
                id="rf-gable",
                name="Gable Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6500, "yMm": 0},
                    {"xMm": 6500, "yMm": 4500},
                    {"xMm": 0, "yMm": 4500},
                ],
                overhangMm=300,
                slopeDeg=30,
                roofGeometryMode="gable_pitched_rectangle",
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    roof_cmds = [c for c in sketch["commands"] if c["type"] == "createRoof"]
    assert len(roof_cmds) == 1
    rc = roof_cmds[0]
    assert rc["roofGeometryMode"] == "gable_pitched_rectangle"
    # Footprint is recovered from Pset_BimAiKernel.BimAiRoofPlanFootprintMm.
    fp = [(float(p["xMm"]), float(p["yMm"])) for p in rc["footprintMm"]]
    assert (0.0, 0.0) in fp
    assert (6500.0, 0.0) in fp
    assert (6500.0, 4500.0) in fp
    assert (0.0, 4500.0) in fp


def test_ifc_asymmetric_gable_roof_round_trips_offset_and_eaves() -> None:
    """IFC-02: asymmetric_gable mode + ridge offset + per-side eaves round-trip."""
    doc = Document(
        revision=703,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "rf-asym": RoofElem(
                kind="roof",
                id="rf-asym",
                name="Asymmetric Roof",
                referenceLevelId="l1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                overhangMm=300,
                slopeDeg=40,
                roofGeometryMode="asymmetric_gable",
                ridgeOffsetTransverseMm=1500,
                eaveHeightLeftMm=2400,
                eaveHeightRightMm=3200,
            ),
        },
    )
    step = export_ifc_model_step(doc)
    sketch = build_kernel_ifc_authoritative_replay_sketch_v0(step)
    roof_cmds = [c for c in sketch["commands"] if c["type"] == "createRoof"]
    assert len(roof_cmds) == 1
    rc = roof_cmds[0]
    assert rc["roofGeometryMode"] == "asymmetric_gable"
    assert rc["ridgeOffsetTransverseMm"] == pytest.approx(1500.0)
    assert rc["eaveHeightLeftMm"] == pytest.approx(2400.0)
    assert rc["eaveHeightRightMm"] == pytest.approx(3200.0)
