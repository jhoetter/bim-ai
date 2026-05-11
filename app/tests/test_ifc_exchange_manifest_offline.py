"""IFC exchange manifest + semantic inspection stubs without requiring IfcOpenShell.

``test_export_ifc.py`` skips the whole module when ``ifcopenshell`` is absent; these
tests keep manifest skip transparency and inspector stubs green on bare installs.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    FloorTypeElem,
    LevelElem,
    SiteElem,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)
from bim_ai.engine import clone_document, try_apply_kernel_ifc_authoritative_replay_v0, try_commit
from bim_ai.export_ifc import (
    AUTHORITATIVE_REPLAY_KIND_V0,
    IFC_AVAILABLE,
    KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
    build_ifc_import_preview_v0,
    build_ifc_unsupported_merge_map_v0,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    ifcopenshell_available,
    inspect_kernel_ifc_semantics,
    summarize_kernel_ifc_semantic_roundtrip,
)
from bim_ai.ifc_stub import (
    IFC_SEMANTIC_IMPORT_SCOPE_V0,
    build_ifc_exchange_manifest_closure_v0,
    build_ifc_exchange_manifest_payload,
    build_ifc_import_preview_v0_for_manifest,
    build_ifc_unsupported_merge_map_v0_for_manifest,
)


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
    if IFC_AVAILABLE:
        assert "ifcPropertySetCoverageEvidence_v0" in mf
    else:
        assert "ifcPropertySetCoverageEvidence_v0" not in mf
    skips = mf.get("ifcKernelGeometrySkippedCounts") or {}
    assert skips.get("door_missing_host_wall") == 1
    asm = mf.get("materialAssemblyEvidence_v0")
    assert asm is not None
    assert asm.get("format") == "materialAssemblyEvidence_v0"
    assert len(asm.get("hosts") or []) >= 2
    cat = mf.get("materialCatalogAuditEvidence_v0")
    assert cat is not None
    assert cat.get("format") == "materialCatalogAuditEvidence_v0"
    assert len(cat.get("rows") or []) >= 2


def test_ifc_manifest_includes_semantic_import_scope_and_expected_kinds_hint() -> None:
    doc = Document(
        revision=61,
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
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    scope = mf.get("ifcSemanticImportScope_v0") or {}
    assert scope.get("schemaVersion") == IFC_SEMANTIC_IMPORT_SCOPE_V0["schemaVersion"]
    assert any(
        "summarize_kernel_ifc_semantic_roundtrip" in str(x)
        for x in (scope.get("semanticReadBackSupported") or [])
    )
    assert any(
        "importScopeUnsupportedIfcProducts_v0" in str(x)
        for x in (scope.get("semanticReadBackSupported") or [])
    )
    kinds = mf.get("kernelExpectedIfcKinds") or {}
    assert kinds.get("wall") == 1 and kinds.get("floor") == 1 and kinds.get("level") == 1


def test_ifc_semantic_scope_mentions_material_layer_readback_evidence() -> None:
    supported = IFC_SEMANTIC_IMPORT_SCOPE_V0.get("semanticReadBackSupported") or []
    blob = "\n".join(str(x) for x in supported)
    assert "materialLayerSetReadback_v0" in blob
    assert "ifcMaterialLayerSetReadbackEvidence_v0" in blob
    assert "propertySetCoverageEvidence_v0" in blob


def test_ifc_manifest_includes_material_layer_readback_when_ifc_installed() -> None:
    if not IFC_AVAILABLE:
        pytest.skip("ifcopenshell not installed (pip install '.[ifc]')")

    doc = Document(
        revision=203,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="WT",
                layers=[
                    WallTypeLayer(
                        thicknessMm=95, layer_function="structure", material_key="manifest-mat-a"
                    ),
                    WallTypeLayer(
                        thicknessMm=55, layer_function="finish", material_key="manifest-mat-b"
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
                    WallTypeLayer(thicknessMm=90, layer_function="structure"),
                    WallTypeLayer(thicknessMm=30, layer_function="finish"),
                ],
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="S",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3500, "yMm": 0},
                    {"xMm": 3500, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
                thicknessMm=130,
                floorTypeId="ft",
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    ev = mf.get("ifcMaterialLayerSetReadbackEvidence_v0")
    assert isinstance(ev, dict)
    assert ev.get("format") == "ifcMaterialLayerSetReadbackEvidence_v0"
    assert ev.get("available") is True
    assert (ev.get("summary") or {}).get("hostsCompared", 0) >= 1


def test_ifc_manifest_includes_property_set_coverage_when_ifc_installed() -> None:
    if not IFC_AVAILABLE:
        pytest.skip("ifcopenshell not installed (pip install '.[ifc]')")

    doc = Document(
        revision=204,
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
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3500, "yMm": 0},
                    {"xMm": 3500, "yMm": 2500},
                    {"xMm": 0, "yMm": 2500},
                ],
                thicknessMm=130,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    cov = mf.get("ifcPropertySetCoverageEvidence_v0") or {}
    assert cov.get("format") == "ifcPropertySetCoverageEvidence_v0"
    assert cov.get("available") is True
    assert int((cov.get("summary") or {}).get("rowsTotal") or 0) >= 1


def test_summarize_kernel_ifc_semantic_roundtrip_stub_when_ifcopenshell_missing() -> None:
    if ifcopenshell_available():
        pytest.skip("ifcopenshell installed — roundtrip covered in test_export_ifc")

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
    summ = summarize_kernel_ifc_semantic_roundtrip(doc)
    assert summ["roundtripChecks"] is None
    assert summ["commandSketch"] is None
    assert summ["inspection"]["available"] is False


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
            "sx": SiteElem(
                kind="site",
                id="sx",
                referenceLevelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                padThicknessMm=80,
            ),
        },
    )
    rep = inspect_kernel_ifc_semantics(doc=doc)
    assert rep["available"] is False
    assert rep["reason"] == "ifcopenshell_not_installed"
    assert rep["matrixVersion"] == 1
    pc0 = rep.get("propertySetCoverageEvidence_v0") or {}
    assert pc0.get("available") is False
    assert pc0.get("reason") == "ifcopenshell_not_installed"
    sx = rep.get("siteExchangeEvidence_v0") or {}
    assert sx.get("kernelSiteCount") == 1
    assert sx["reason"] == "ifcopenshell_not_installed"


def test_ifc_manifest_scope_lists_qto_linked_products_read_back() -> None:
    doc = Document(
        revision=71,
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
    scope = mf.get("ifcSemanticImportScope_v0") or {}
    supported = scope.get("semanticReadBackSupported") or []
    assert any("qtoLinkedProducts" in str(x) for x in supported)


def test_authoritative_replay_sketch_unavailable_when_ifcopenshell_missing() -> None:
    """``build_kernel_ifc_authoritative_replay_sketch_v0`` stubs cleanly on bare installs."""

    if IFC_AVAILABLE:
        pytest.skip("ifcopenshell installed — full replay covered in test_export_ifc")

    out = build_kernel_ifc_authoritative_replay_sketch_v0("")
    assert out["available"] is False
    assert out["reason"] == "ifcopenshell_not_installed"
    assert out["replayKind"] == "authoritative_kernel_slice_v0"
    assert out["authoritativeSubset"] == {
        "levels": False,
        "walls": False,
        "spaces": False,
        "openings": False,
        "floors": False,
        "slabVoids": False,
        "roofs": False,
        "stairs": False,
    }


def test_ifc_manifest_scope_lists_authoritative_replay_bullet() -> None:
    doc = Document(
        revision=72,
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
    scope = mf.get("ifcSemanticImportScope_v0") or {}
    supported = scope.get("semanticReadBackSupported") or []
    assert any("authoritativeReplay_v0" in str(x) for x in supported)
    assert any("createRoomOutline" in str(x) for x in supported)
    assert any("idsAuthoritativeReplayMap_v0" in str(x) for x in supported)
    assert any("try_apply_kernel_ifc_authoritative_replay_v0" in str(x) for x in supported)
    assert any("insertDoorOnWall" in str(x) for x in supported)
    assert any("createStair" in str(x) for x in supported)
    unsupported = scope.get("importMergeUnsupported") or []
    assert any("try_apply_kernel_ifc_authoritative_replay_v0" in str(x) for x in unsupported)


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
    sx = rep.get("siteExchangeEvidence_v0") or {}
    assert sx.get("kernelSiteCount") == 0


def test_ifc_manifest_site_exchange_when_kernel_not_eligible_site_only_doc() -> None:
    doc = Document(
        revision=92,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "site-only": SiteElem(
                kind="site",
                id="site-only",
                referenceLevelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                padThicknessMm=80,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    assert mf["artifactHasGeometryEntities"] is False
    assert mf.get("kernelExpectedIfcKinds") == {}
    sx = mf.get("siteExchangeEvidence_v0") or {}
    assert sx.get("kernelSiteCount") == 1
    assert sx.get("kernelIfcExportEligible") is False
    assert sx.get("joinedKernelSiteIdsExpected") == "site-only"
    assert sx.get("note")


def test_ifc_manifest_kernel_expected_includes_site_when_geometry_eligible() -> None:
    doc = Document(
        revision=93,
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
            "sx": SiteElem(
                kind="site",
                id="sx",
                referenceLevelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                padThicknessMm=80,
            ),
        },
    )
    mf = build_ifc_exchange_manifest_payload(doc)
    kinds = mf.get("kernelExpectedIfcKinds") or {}
    assert kinds.get("wall") == 1
    assert kinds.get("site") == 1
    msx = mf.get("siteExchangeEvidence_v0") or {}
    assert msx.get("kernelIfcExportEligible") is True
    assert msx.get("kernelSiteCount") == 1


def _sketch_with_commands(*, cmds: list[dict[str, object]]) -> dict[str, object]:
    return {
        "available": True,
        "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
        "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
        "commands": cmds,
    }


def _minimal_create_wall_cmd(*, wall_id: str, level_id: str) -> dict[str, object]:
    return {
        "type": "createWall",
        "id": wall_id,
        "name": wall_id,
        "levelId": level_id,
        "start": {"xMm": 0, "yMm": 0},
        "end": {"xMm": 3000, "yMm": 0},
        "thicknessMm": 200,
        "heightMm": 2800,
    }


def test_try_apply_authoritative_replay_v0_additive_merge_ok() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        },
    )
    sketch = _sketch_with_commands(
        cmds=[_minimal_create_wall_cmd(wall_id="w-new", level_id="lvl-g")]
    )
    before = clone_document(doc)
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is True and code == "ok"
    assert new_doc is not None and "w-new" in new_doc.elements
    assert doc.elements == before.elements
    assert len(cmds) == 1


def test_create_wall_command_preserves_structural_intent_fields() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        },
    )

    ok, new_doc, _cmds, _violations, code = try_commit(
        doc,
        {
            **_minimal_create_wall_cmd(wall_id="w-struct", level_id="lvl-g"),
            "loadBearing": True,
            "structuralRole": "load_bearing",
            "analyticalParticipation": True,
            "structuralMaterialKey": "concrete-c30",
            "structuralIntentConfidence": 0.7,
        },
    )

    assert ok is True and code == "ok"
    assert new_doc is not None
    wall = new_doc.elements["w-struct"]
    assert isinstance(wall, WallElem)
    assert wall.load_bearing is True
    assert wall.structural_role == "load_bearing"
    assert wall.analytical_participation is True
    assert wall.structural_material_key == "concrete-c30"
    assert wall.structural_intent_confidence == 0.7


def test_try_apply_authoritative_replay_v0_merge_id_collision() -> None:
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
                end={"xMm": 1000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    sketch = _sketch_with_commands(cmds=[_minimal_create_wall_cmd(wall_id="w-a", level_id="lvl-g")])
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is False and new_doc is None and code == "merge_id_collision"
    assert len(cmds) == 1


def test_try_apply_authoritative_replay_v0_merge_reference_unresolved() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        },
    )
    sketch = _sketch_with_commands(
        cmds=[_minimal_create_wall_cmd(wall_id="w-new", level_id="no-such-level")]
    )
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is False and new_doc is None and code == "merge_reference_unresolved"
    assert len(cmds) == 1


def test_try_apply_authoritative_replay_v0_roof_reference_level_unresolved() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        },
    )
    sketch = _sketch_with_commands(
        cmds=[
            {
                "type": "createRoof",
                "id": "r-new",
                "name": "R",
                "referenceLevelId": "no-level",
                "footprintMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 500, "yMm": 800},
                ],
                "overhangMm": 0,
                "slopeDeg": 25,
                "roofGeometryMode": "mass_box",
            },
        ]
    )
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is False and new_doc is None and code == "merge_reference_unresolved"
    assert len(cmds) == 1


def test_try_apply_authoritative_replay_v0_floor_floor_type_unresolved() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        },
    )
    sketch = _sketch_with_commands(
        cmds=[
            {
                "type": "createFloor",
                "id": "fl-new",
                "name": "F",
                "levelId": "lvl-g",
                "boundaryMm": [
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
                "thicknessMm": 220,
                "floorTypeId": "missing-floor-type-id",
            },
        ]
    )
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is False and new_doc is None and code == "merge_reference_unresolved"
    assert len(cmds) == 1


def test_try_apply_authoritative_replay_v0_sketch_unavailable() -> None:
    empty = Document(revision=0, elements={})
    sketch = {"available": False, "reason": "ifcopenshell_not_installed"}
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is False
    assert new_doc is None
    assert code == "sketch_unavailable"
    assert cmds == []


def test_try_apply_authoritative_replay_v0_invalid_command() -> None:
    empty = Document(revision=0, elements={})
    sketch = {
        "available": True,
        "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
        "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
        "commands": [{"type": "moveWallDelta", "wallId": "w", "dxMm": 1, "dyMm": 0}],
    }
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is False
    assert new_doc is None
    assert code == "invalid_command"
    assert cmds == []


def test_try_apply_authoritative_replay_v0_invalid_sketch() -> None:
    empty = Document(revision=0, elements={})
    base = {
        "available": True,
        "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
        "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
        "commands": [{"type": "createLevel", "id": "l-offline", "name": "G", "elevationMm": 0}],
    }
    bad_kind = {**base, "replayKind": "nope"}
    ok, _nd, _c, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, bad_kind)
    assert ok is False and code == "invalid_sketch"
    bad_ver = {**base, "schemaVersion": 99}
    ok2, _nd2, _c2, _v2, code2 = try_apply_kernel_ifc_authoritative_replay_v0(empty, bad_ver)
    assert ok2 is False and code2 == "invalid_sketch"


# ---------------------------------------------------------------------------
# IFC import preview and unsupported merge map — offline / stub tests
# ---------------------------------------------------------------------------


def test_ifc_import_preview_stub_when_ifcopenshell_missing() -> None:
    """``build_ifc_import_preview_v0`` returns a stable stub on bare installs."""

    if IFC_AVAILABLE:
        pytest.skip("ifcopenshell installed — full preview covered by test_export_ifc")

    preview = build_ifc_import_preview_v0("")
    assert preview["available"] is False
    assert preview["reason"] == "ifcopenshell_not_installed"
    assert preview["commandCountsByKind"] == {}
    assert preview["commandCountTotal"] == 0
    assert preview["unresolvedReferences"] == []
    assert preview["unresolvedReferenceCount"] == 0
    assert preview["skipCountsByReason"] == {}
    assert preview["authoritativeProducts"] == {}
    assert preview["unsupportedProducts"] == {"schemaVersion": 0, "countsByClass": {}}
    ids_cov = preview["idsPointerCoverage"]
    assert ids_cov["available"] is False
    sa = preview["safeApplyClassification"]
    assert sa["authoritativeSliceSafeApply"] is False
    assert "ifcopenshell_not_installed" in sa["notApplyReasons"]


def test_ifc_unsupported_merge_map_stub_when_ifcopenshell_missing() -> None:
    """``build_ifc_unsupported_merge_map_v0`` always returns mergeConstraints offline."""

    if IFC_AVAILABLE:
        pytest.skip("ifcopenshell installed")

    merge_map = build_ifc_unsupported_merge_map_v0("")
    assert merge_map["available"] is False
    assert merge_map["reason"] == "ifcopenshell_not_installed"
    assert merge_map["unsupportedIfcProductsByClass"] == {}
    assert merge_map["extractionGapsByReason"] == {}
    assert merge_map["extractionGapTotal"] == 0
    constraints = merge_map.get("mergeConstraints") or []
    assert len(constraints) >= 1
    assert any("arbitrary" in str(c).lower() or "merge" in str(c).lower() for c in constraints)


def _doc_with_wall_and_level() -> Document:
    return Document(
        revision=100,
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


def test_ifc_manifest_includes_import_preview_stub_offline() -> None:
    """Manifest always includes ``ifcImportPreview_v0`` key regardless of IfcOpenShell."""

    doc = _doc_with_wall_and_level()
    mf = build_ifc_exchange_manifest_payload(doc)
    preview = mf.get("ifcImportPreview_v0")
    assert isinstance(preview, dict)
    assert "available" in preview
    assert "safeApplyClassification" in preview
    assert "commandCountsByKind" in preview
    assert "idsPointerCoverage" in preview


def test_ifc_manifest_includes_unsupported_merge_map_stub_offline() -> None:
    """Manifest always includes ``ifcUnsupportedMergeMap_v0`` with mergeConstraints."""

    doc = _doc_with_wall_and_level()
    mf = build_ifc_exchange_manifest_payload(doc)
    mm = mf.get("ifcUnsupportedMergeMap_v0")
    assert isinstance(mm, dict)
    assert "available" in mm
    assert "mergeConstraints" in mm
    constraints = mm.get("mergeConstraints") or []
    assert len(constraints) >= 1


def test_ifc_manifest_import_preview_for_manifest_stub_when_kernel_not_eligible() -> None:
    """Preview stub returns kernel_not_eligible reason when doc has no kernel geometry."""

    doc = Document(revision=1, elements={})
    preview = build_ifc_import_preview_v0_for_manifest(doc)
    assert preview["available"] is False
    if IFC_AVAILABLE:
        assert preview["reason"] == "kernel_not_eligible"
    else:
        assert preview["reason"] == "ifcopenshell_not_installed"


def test_ifc_manifest_unsupported_merge_map_for_manifest_always_has_merge_constraints() -> None:
    """Unsupported merge map always carries mergeConstraints from the semantic import scope."""

    doc = Document(revision=1, elements={})
    mm = build_ifc_unsupported_merge_map_v0_for_manifest(doc)
    assert isinstance(mm.get("mergeConstraints"), list)
    assert len(mm["mergeConstraints"]) >= 1
    blob = " ".join(mm["mergeConstraints"])
    assert "merge" in blob.lower()


def test_ifc_semantic_scope_mentions_import_preview_and_unsupported_map() -> None:
    """``IFC_SEMANTIC_IMPORT_SCOPE_V0.semanticReadBackSupported`` documents the new functions."""

    supported = IFC_SEMANTIC_IMPORT_SCOPE_V0.get("semanticReadBackSupported") or []
    blob = "\n".join(str(x) for x in supported)
    assert "build_ifc_import_preview_v0" in blob
    assert "commandCountsByKind" in blob
    assert "unresolvedReferences" in blob
    assert "safeApplyClassification" in blob
    assert "build_ifc_unsupported_merge_map_v0" in blob
    assert "unsupportedIfcProductsByClass" in blob
    assert "ifcImportPreview_v0" in blob
    assert "ifcUnsupportedMergeMap_v0" in blob


def test_ifc_import_preview_safe_apply_classification_structure() -> None:
    """Preview safe-apply dict has the required keys regardless of IFC availability."""

    doc = _doc_with_wall_and_level()
    preview = build_ifc_import_preview_v0_for_manifest(doc)
    sa = preview.get("safeApplyClassification") or {}
    assert "authoritativeSliceSafeApply" in sa
    assert "notApplyReasons" in sa
    assert isinstance(sa["notApplyReasons"], list)
    assert "note" in sa


def test_ifc_import_preview_includes_id_collision_classes_key() -> None:
    """``idCollisionClasses`` is always present in the import preview regardless of IfcOpenShell."""

    doc = _doc_with_wall_and_level()
    preview = build_ifc_import_preview_v0_for_manifest(doc)
    assert "idCollisionClasses" in preview
    assert isinstance(preview["idCollisionClasses"], dict)


def test_ifc_import_preview_stub_includes_id_collision_classes_when_ifcopenshell_missing() -> None:
    """Offline stubs include an empty ``idCollisionClasses`` dict."""

    if IFC_AVAILABLE:
        pytest.skip("ifcopenshell installed — offline stub not exercised")

    preview = build_ifc_import_preview_v0("")
    assert "idCollisionClasses" in preview
    assert preview["idCollisionClasses"] == {}


def test_ifc_manifest_import_preview_id_collision_classes_empty_when_no_collisions() -> None:
    """``idCollisionClasses`` is empty for a well-formed document with unique kernel IDs."""

    doc = _doc_with_wall_and_level()
    preview = build_ifc_import_preview_v0_for_manifest(doc)
    assert preview["idCollisionClasses"] == {}


def test_ifc_semantic_scope_mentions_id_collision_classes() -> None:
    """``IFC_SEMANTIC_IMPORT_SCOPE_V0.semanticReadBackSupported`` documents idCollisionClasses."""

    supported = IFC_SEMANTIC_IMPORT_SCOPE_V0.get("semanticReadBackSupported") or []
    blob = "\n".join(str(x) for x in supported)
    assert "idCollisionClasses" in blob


# ---------------------------------------------------------------------------
# IFC exchange manifest closure — offline / stub tests
# ---------------------------------------------------------------------------


def test_ifc_manifest_includes_closure_always() -> None:
    """``ifcExchangeManifestClosure_v0`` is always present on the manifest."""

    doc = _doc_with_wall_and_level()
    mf = build_ifc_exchange_manifest_payload(doc)
    closure = mf.get("ifcExchangeManifestClosure_v0")
    assert isinstance(closure, dict)
    assert "authoritativeProductsAlignmentToken" in closure
    assert "unsupportedClassAlignmentToken" in closure
    assert "idsPointerCoverageAlignmentToken" in closure
    assert "ifcExchangeManifestClosureDigestSha256" in closure


def test_ifc_closure_digest_is_64_hex_chars() -> None:
    """Closure SHA-256 digest is a valid 64-character hex string."""

    doc = _doc_with_wall_and_level()
    mf = build_ifc_exchange_manifest_payload(doc)
    digest = mf["ifcExchangeManifestClosure_v0"]["ifcExchangeManifestClosureDigestSha256"]
    assert isinstance(digest, str)
    assert len(digest) == 64
    assert all(c in "0123456789abcdef" for c in digest.lower())


def test_ifc_closure_offline_tokens_when_ifcopenshell_missing() -> None:
    """When IfcOpenShell is absent, all three tokens are ``unavailable_offline``."""

    if IFC_AVAILABLE:
        pytest.skip("ifcopenshell installed — offline stub not exercised")

    doc = _doc_with_wall_and_level()
    mf = build_ifc_exchange_manifest_payload(doc)
    closure = mf["ifcExchangeManifestClosure_v0"]
    assert closure["authoritativeProductsAlignmentToken"] == "unavailable_offline"
    assert closure["unsupportedClassAlignmentToken"] == "unavailable_offline"
    assert closure["idsPointerCoverageAlignmentToken"] == "unavailable_offline"


def test_ifc_closure_build_from_unavailable_stubs() -> None:
    """``build_ifc_exchange_manifest_closure_v0`` handles unavailable preview/merge-map stubs."""

    unavailable_preview = {
        "available": False,
        "reason": "ifcopenshell_not_installed",
        "authoritativeProducts": {},
        "unsupportedProducts": {"schemaVersion": 0, "countsByClass": {}},
        "idsPointerCoverage": {"schemaVersion": 0, "available": False},
    }
    unavailable_merge_map = {
        "available": False,
        "reason": "ifcopenshell_not_installed",
        "unsupportedIfcProductsByClass": {},
        "mergeConstraints": [],
    }
    closure = build_ifc_exchange_manifest_closure_v0(unavailable_preview, unavailable_merge_map)
    assert closure["schemaVersion"] == 0
    assert closure["authoritativeProductsAlignmentToken"] == "unavailable_offline"
    assert closure["unsupportedClassAlignmentToken"] == "unavailable_offline"
    assert closure["idsPointerCoverageAlignmentToken"] == "unavailable_offline"
    digest = closure["ifcExchangeManifestClosureDigestSha256"]
    assert len(digest) == 64


def test_ifc_closure_digest_is_deterministic() -> None:
    """Closure digest is the same across repeated calls for the same document."""

    doc = _doc_with_wall_and_level()
    mf1 = build_ifc_exchange_manifest_payload(doc)
    mf2 = build_ifc_exchange_manifest_payload(doc)
    assert (
        mf1["ifcExchangeManifestClosure_v0"]["ifcExchangeManifestClosureDigestSha256"]
        == mf2["ifcExchangeManifestClosure_v0"]["ifcExchangeManifestClosureDigestSha256"]
    )


def test_ifc_closure_aligned_when_well_formed_document() -> None:
    """Well-formed kernel-eligible doc produces aligned or unavailable_offline tokens (never drift)."""

    doc = _doc_with_wall_and_level()
    mf = build_ifc_exchange_manifest_payload(doc)
    closure = mf["ifcExchangeManifestClosure_v0"]
    for key in (
        "authoritativeProductsAlignmentToken",
        "unsupportedClassAlignmentToken",
        "idsPointerCoverageAlignmentToken",
    ):
        token = closure[key]
        assert token in ("aligned", "unavailable_offline"), (
            f"{key} = {token!r} — expected 'aligned' or 'unavailable_offline'"
        )


def test_ifc_semantic_scope_mentions_closure() -> None:
    """``IFC_SEMANTIC_IMPORT_SCOPE_V0.semanticReadBackSupported`` documents the closure."""

    supported = IFC_SEMANTIC_IMPORT_SCOPE_V0.get("semanticReadBackSupported") or []
    blob = "\n".join(str(x) for x in supported)
    assert "ifcExchangeManifestClosure_v0" in blob
    assert "authoritativeProductsAlignmentToken" in blob
    assert "unsupportedClassAlignmentToken" in blob
    assert "idsPointerCoverageAlignmentToken" in blob
