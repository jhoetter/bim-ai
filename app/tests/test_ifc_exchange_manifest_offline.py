"""IFC exchange manifest + semantic inspection stubs without requiring IfcOpenShell.

``test_export_ifc.py`` skips the whole module when ``ifcopenshell`` is absent; these
tests keep manifest skip transparency and inspector stubs green on bare installs.
"""

from __future__ import annotations

import pytest

from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, WallElem
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
        },
    )
    rep = inspect_kernel_ifc_semantics(doc=doc)
    assert rep["available"] is False
    assert rep["reason"] == "ifcopenshell_not_installed"
    assert rep["matrixVersion"] == 1


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
    assert out["authoritativeSubset"] == {"levels": False, "walls": False, "spaces": False}


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


def _minimal_authoritative_replay_sketch_v0() -> dict[str, object]:
    return {
        "available": True,
        "replayKind": AUTHORITATIVE_REPLAY_KIND_V0,
        "schemaVersion": KERNEL_IFC_AUTHORITATIVE_REPLAY_SCHEMA_VERSION,
        "commands": [{"type": "createLevel", "id": "l-offline", "name": "G", "elevationMm": 0}],
    }


def test_try_apply_authoritative_replay_v0_rejects_non_empty_document() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-g": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
        },
    )
    sketch = _minimal_authoritative_replay_sketch_v0()
    before = clone_document(doc)
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(doc, sketch)
    assert ok is False
    assert new_doc is None
    assert code == "document_not_empty"
    assert cmds == []
    assert doc.elements == before.elements


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
        **_minimal_authoritative_replay_sketch_v0(),
        "commands": [{"type": "moveWallDelta", "wallId": "w", "dxMm": 1, "dyMm": 0}],
    }
    ok, new_doc, cmds, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, sketch)
    assert ok is False
    assert new_doc is None
    assert code == "invalid_command"
    assert cmds == []


def test_try_apply_authoritative_replay_v0_invalid_sketch() -> None:
    empty = Document(revision=0, elements={})
    bad_kind = {**_minimal_authoritative_replay_sketch_v0(), "replayKind": "nope"}
    ok, _nd, _c, _v, code = try_apply_kernel_ifc_authoritative_replay_v0(empty, bad_kind)
    assert ok is False and code == "invalid_sketch"
    bad_ver = {**_minimal_authoritative_replay_sketch_v0(), "schemaVersion": 99}
    ok2, _nd2, _c2, _v2, code2 = try_apply_kernel_ifc_authoritative_replay_v0(empty, bad_ver)
    assert ok2 is False and code2 == "invalid_sketch"
