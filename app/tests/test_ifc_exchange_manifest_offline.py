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
from bim_ai.engine import clone_document, try_apply_kernel_ifc_authoritative_replay_v0
from bim_ai.export_ifc import (
    AUTHORITATIVE_REPLAY_KIND_V0,
    IFC_AVAILABLE,
    KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
    build_kernel_ifc_authoritative_replay_sketch_v0,
    ifcopenshell_available,
    inspect_kernel_ifc_semantics,
    summarize_kernel_ifc_semantic_roundtrip,
)
from bim_ai.ifc_stub import IFC_SEMANTIC_IMPORT_SCOPE_V0, build_ifc_exchange_manifest_payload


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
        "summarize_kernel_ifc_semantic_roundtrip" in str(x) for x in (scope.get("semanticReadBackSupported") or [])
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
                    WallTypeLayer(thicknessMm=95, layer_function="structure", material_key="manifest-mat-a"),
                    WallTypeLayer(thicknessMm=55, layer_function="finish", material_key="manifest-mat-b"),
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
    sketch = _sketch_with_commands(cmds=[_minimal_create_wall_cmd(wall_id="w-new", level_id="lvl-g")])
    before = clone_document(doc)
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is True and code == "ok"
    assert new_doc is not None and "w-new" in new_doc.elements
    assert doc.elements == before.elements
    assert len(cmds) == 1


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
    sketch = _sketch_with_commands(cmds=[_minimal_create_wall_cmd(wall_id="w-new", level_id="no-such-level")])
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
