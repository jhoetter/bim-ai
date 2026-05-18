from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, RoomElem, SheetElem, WallElem
from bim_ai.engine import try_commit_bundle
from bim_ai.export_documentation_evidence import (
    DOCUMENTATION_EXPORT_PRODUCTION_EVIDENCE_V1,
    build_documentation_export_production_evidence_v1,
)
from bim_ai.export_gltf import build_visual_export_manifest, document_to_gltf
from bim_ai.export_ifc import IFC_AVAILABLE, export_ifc_model_step
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.sheet_preview_pdf import sheet_elem_to_pdf_bytes


def test_documentation_pack_commands_produce_exportable_drawing_set() -> None:
    doc = Document(
        revision=7,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="Ground", elevationMm=0),
            "plan-gf": PlanViewElem(
                kind="plan_view",
                id="plan-gf",
                name="Ground floor plan",
                levelId="lvl-0",
            ),
            "wall-n": WallElem(
                kind="wall",
                id="wall-n",
                levelId="lvl-0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=3000,
            ),
            "room-101": RoomElem(
                kind="room",
                id="room-101",
                name="Office 101",
                levelId="lvl-0",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                programmeCode="office",
            ),
        },
    )

    commands = [
        {
            "type": "upsertSheet",
            "id": "A101",
            "name": "GA Plan",
            "titleBlock": "A1-titleblock",
            "titleblockParameters": {"sheetNumber": "A101", "revisionCode": "P1"},
        },
        {
            "type": "upsertSchedule",
            "id": "sch-rooms",
            "name": "Room Schedule",
            "sheetId": "A101",
            "filters": {"category": "room"},
            "grouping": {"sortBy": "name"},
        },
        {
            "type": "upsertSheetViewports",
            "sheetId": "A101",
            "viewportsMm": [
                {
                    "viewportId": "vp-plan",
                    "viewRef": "plan:plan-gf",
                    "label": "Ground floor plan",
                    "xMm": 20,
                    "yMm": 20,
                    "widthMm": 160,
                    "heightMm": 110,
                },
                {
                    "viewportId": "vp-sch-rooms",
                    "viewRef": "schedule:sch-rooms",
                    "label": "Room Schedule",
                    "xMm": 20,
                    "yMm": 190,
                    "widthMm": 160,
                    "heightMm": 70,
                },
            ],
        },
        {
            "type": "placeTag",
            "id": "tag-room-101",
            "hostElementId": "room-101",
            "hostViewId": "plan-gf",
            "positionMm": {"xMm": 3000, "yMm": 2000},
            "textOverride": "101",
        },
        {
            "type": "createDimension",
            "id": "dim-overall",
            "levelId": "lvl-0",
            "aMm": {"xMm": 0, "yMm": 0},
            "bMm": {"xMm": 6000, "yMm": 0},
            "offsetMm": {"xMm": 0, "yMm": -500},
            "refElementIdA": "wall-n",
            "refElementIdB": "wall-n",
        },
    ]

    ok, candidate, _cmds, violations, code = try_commit_bundle(doc, commands)
    assert ok, (code, violations)
    assert candidate is not None
    assert {"A101", "sch-rooms", "tag-room-101", "dim-overall"} <= set(candidate.elements)

    sheet = candidate.elements["A101"]
    assert isinstance(sheet, SheetElem)
    assert len(sheet.viewports_mm) == 2

    schedule = derive_schedule_table(candidate, "sch-rooms")
    assert schedule["schedulePlacement"] == {"sheetId": "A101", "sheetName": "GA Plan"}
    assert schedule["rows"][0]["elementId"] == "room-101"

    pdf_bytes = sheet_elem_to_pdf_bytes(candidate, sheet)
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 1000

    ifc_step = export_ifc_model_step(candidate)
    assert ifc_step.startswith("ISO-10303-21;")
    if IFC_AVAILABLE:
        assert "IFCWALL" in ifc_step.upper()

    gltf = document_to_gltf(candidate)
    assert gltf["asset"]["version"] == "2.0"
    manifest = build_visual_export_manifest(candidate)
    manifest_ext = manifest["extensions"]["BIM_AI_exportManifest_v0"]
    assert manifest_ext["elementCount"] >= 1
    assert manifest_ext["exportedGeometryKinds"]["wall"] == 1

    evidence = build_documentation_export_production_evidence_v1(
        candidate,
        model_id="00000000-0000-0000-0000-000000000123",
    )
    assert evidence["format"] == DOCUMENTATION_EXPORT_PRODUCTION_EVIDENCE_V1
    assert evidence["coverage"] == {
        "sheetCount": 1,
        "scheduleCount": 1,
        "tagCount": 1,
        "dimensionCount": 1,
        "pdfArtifactCount": 1,
        "ifcArtifactCount": 1,
        "gltfArtifactCount": 1,
        "glbArtifactCount": 1,
        "externalExportMarkerCount": 8,
    }
    assert len(evidence["evidenceDigestSha256"]) == 64
    assert evidence["artifactClosure_v1"]["format"] == "documentationExportArtifactClosure_v1"
    assert evidence["artifactClosure_v1"]["pass"] is True
    assert len(evidence["artifactClosure_v1"]["digestSha256"]) == 64

    sheet_row = evidence["sheets"][0]
    assert sheet_row["sheetId"] == "A101"
    assert sheet_row["viewportCount"] == 2
    assert sheet_row["listingLineCount"] >= 2
    assert {artifact["kind"] for artifact in sheet_row["artifacts"]} == {
        "sheet_pdf",
        "sheet_svg",
    }
    assert all(artifact["byteLength"] > 100 for artifact in sheet_row["artifacts"])
    assert all(len(artifact["digestSha256"]) == 64 for artifact in sheet_row["artifacts"])
    assert all(artifact["status"] == "artifact-returned" for artifact in sheet_row["artifacts"])
    assert all(artifact["pass"] is True for artifact in sheet_row["artifacts"])
    assert all(
        artifact["nonPlaceholderProof"]["pass"] is True for artifact in sheet_row["artifacts"]
    )
    assert all(
        artifact["href"].startswith(
            "/api/models/00000000-0000-0000-0000-000000000123/exports/"
        )
        for artifact in sheet_row["artifacts"]
    )

    schedule_row = evidence["schedules"][0]
    assert schedule_row["scheduleId"] == "sch-rooms"
    assert schedule_row["rowCount"] == 1
    assert schedule_row["columnCount"] >= 1
    assert schedule_row["schedulePlacement"] == {"sheetId": "A101", "sheetName": "GA Plan"}

    tag_row = evidence["tags"][0]
    assert tag_row["tagId"] == "tag-room-101"
    assert tag_row["resolvesHostElement"] is True
    assert tag_row["resolvesHostView"] is True

    dimension_row = evidence["dimensions"][0]
    assert dimension_row["dimensionId"] == "dim-overall"
    assert dimension_row["refElementIdA"] == "wall-n"
    assert dimension_row["resolvesRefElementA"] is True
    assert dimension_row["resolvesRefElementB"] is True

    exports_by_kind = {row["kind"]: row for row in evidence["modelExports"]}
    assert {"ifc", "gltf", "glb"} <= set(exports_by_kind)
    assert exports_by_kind["ifc"]["href"].endswith("/exports/model.ifc")
    assert exports_by_kind["gltf"]["status"] == "artifact-returned"
    assert exports_by_kind["gltf"]["manifestExtension"]["exportedGeometryKinds"]["wall"] == 1
    assert exports_by_kind["gltf"]["nonPlaceholderProof"]["pass"] is True
    assert exports_by_kind["glb"]["status"] == "artifact-returned"
    assert exports_by_kind["glb"]["byteLength"] > 20

    ifc_export = exports_by_kind["ifc"]
    assert ifc_export["ifcOpenShellAvailable"] is IFC_AVAILABLE
    assert ifc_export["semanticReadback"]["available"] is IFC_AVAILABLE
    if IFC_AVAILABLE:
        assert ifc_export["status"] == "artifact-returned"
        assert ifc_export["pass"] is True
        assert ifc_export["artifactHasPhysicalGeometry"] is True
        assert ifc_export["manifestHints"]["exportedIfcKindsInArtifact"]["wall"] == 1
        assert "optionalBackendManifest_v1" not in ifc_export
    else:
        assert ifc_export["status"] == "optional-backend-manifest"
        assert ifc_export["pass"] is True
        assert ifc_export["artifactHasPhysicalGeometry"] is False
        assert ifc_export["semanticReadback"]["reason"] == "ifcopenshell_not_installed"
        assert ifc_export["optionalBackendManifest_v1"] == {
            "backend": "ifcopenshell",
            "available": False,
            "reason": "ifcopenshell_not_installed",
            "stableFallback": "minimal_empty_ifc_skeleton",
            "overclaimProtection": (
                "artifactHasPhysicalGeometry=false and status=optional-backend-manifest; "
                "the skeleton digest is provided only as fallback-manifest evidence."
            ),
        }

    marker_ids = {row["markerId"] for row in evidence["externalExportMarkers_v1"]["markers"]}
    assert {
        "sheet:A101:pdf",
        "model:ifc",
        "model:gltf",
        "model:glb",
        "schedule:sch-rooms",
        "tag:tag-room-101",
        "dimension:dim-overall",
    } <= marker_ids
    markers_by_id = {
        row["markerId"]: row for row in evidence["externalExportMarkers_v1"]["markers"]
    }
    assert markers_by_id["model:ifc"]["pass"] is True
    assert markers_by_id["sheet:A101:pdf"]["status"] == "artifact-returned"


def test_documentation_export_ifc_optional_backend_manifest_is_stable(monkeypatch) -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="Ground", elevationMm=0),
            "wall-a": WallElem(
                kind="wall",
                id="wall-a",
                levelId="lvl-0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 1000, "yMm": 0},
                thicknessMm=200,
                heightMm=3000,
            ),
        },
    )

    monkeypatch.setattr("bim_ai.export_documentation_evidence.IFC_AVAILABLE", False)
    monkeypatch.setattr(
        "bim_ai.export_documentation_evidence.serialize_ifc_artifact",
        lambda _doc: ("ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n", "empty_ifc_skeleton_v0", False),
    )

    evidence_a = build_documentation_export_production_evidence_v1(doc)
    evidence_b = build_documentation_export_production_evidence_v1(doc)
    ifc_a = {row["kind"]: row for row in evidence_a["modelExports"]}["ifc"]
    ifc_b = {row["kind"]: row for row in evidence_b["modelExports"]}["ifc"]

    assert ifc_a["status"] == "optional-backend-manifest"
    assert ifc_a["pass"] is True
    assert ifc_a["artifactHasPhysicalGeometry"] is False
    assert ifc_a["optionalBackendManifest_v1"]["reason"] == "ifcopenshell_not_installed"
    assert ifc_a["digestSha256"] == ifc_b["digestSha256"]
    assert evidence_a["artifactClosure_v1"]["pass"] is True
