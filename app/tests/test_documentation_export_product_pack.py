from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    FrameElem,
    LevelElem,
    PlanViewElem,
    RailingElem,
    RoomElem,
    SheetElem,
    WallElem,
)
from bim_ai.engine import try_commit_bundle
from bim_ai.evidence.export_documentation_evidence import (
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
        {
            "type": "create_brand_template",
            "id": "bt-client",
            "name": "Client Brand",
            "accentHex": "#2563eb",
            "accentForegroundHex": "#ffffff",
        },
        {
            "type": "upsertViewTemplate",
            "id": "vt-client-docs",
            "name": "Client docs",
            "scale": "scale_100",
            "hiddenCategories": ["analytical"],
            "planDetailLevel": "fine",
            "planShowRoomLabels": True,
        },
        {
            "type": "applyPlanViewTemplate",
            "planViewId": "plan-gf",
            "templateId": "vt-client-docs",
        },
        {
            "type": "create_schedule_view",
            "id": "sch-rooms-advanced",
            "name": "Room Schedule Advanced",
            "category": "room",
            "columns": [{"key": "name", "label": "Name"}],
            "filterExpr": 'category == "room"',
            "sortKey": "name",
            "sortDir": "asc",
        },
        {
            "type": "createRevisionCloud",
            "id": "rev-cloud-01",
            "hostViewId": "plan-gf",
            "boundaryMm": [
                {"xMm": 500, "yMm": 500},
                {"xMm": 2500, "yMm": 500},
                {"xMm": 2500, "yMm": 1500},
            ],
        },
        {"type": "create_presentation_canvas", "id": "deck-client", "name": "Client Deck"},
        {
            "type": "create_frame",
            "id": "frame-plan",
            "presentationCanvasId": "deck-client",
            "viewId": "plan-gf",
            "positionMm": {"xMm": 0, "yMm": 0},
            "sizeMm": {"widthMm": 210, "heightMm": 118},
            "caption": "Ground floor plan",
            "brandTemplateId": "bt-client",
            "sortOrder": 0,
        },
        {
            "type": "create_frame",
            "id": "frame-schedule",
            "presentationCanvasId": "deck-client",
            "viewId": "sch-rooms",
            "positionMm": {"xMm": 0, "yMm": 118},
            "sizeMm": {"widthMm": 210, "heightMm": 80},
            "caption": "Room schedule",
            "brandTemplateId": "bt-client",
            "sortOrder": 1,
        },
    ]

    ok, candidate, _cmds, violations, code = try_commit_bundle(doc, commands)
    assert ok, (code, violations)
    assert candidate is not None
    assert {
        "A101",
        "sch-rooms",
        "tag-room-101",
        "dim-overall",
        "bt-client",
        "deck-client",
        "frame-plan",
        "rev-cloud-01",
    } <= set(candidate.elements)

    sheet = candidate.elements["A101"]
    assert isinstance(sheet, SheetElem)
    assert len(sheet.viewports_mm) == 2
    frame = candidate.elements["frame-plan"]
    assert isinstance(frame, FrameElem)
    assert frame.brand_template_id == "bt-client"

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
        "scheduleCount": 2,
        "tagCount": 1,
        "dimensionCount": 1,
        "presentationCanvasCount": 1,
        "presentationFrameCount": 2,
        "brandTemplateCount": 1,
        "renderBundleCount": 3,
        "viewTemplateCount": 1,
        "revisionCloudCount": 1,
        "pdfArtifactCount": 1,
        "printRasterPngArtifactCount": 1,
        "ifcArtifactCount": 1,
        "gltfArtifactCount": 1,
        "glbArtifactCount": 1,
        "documentationExportParityRowCount": 6,
        "documentationExportUnsupportedRowCount": 1,
        "documentationExportDroppedRowCount": 0,
        "externalExportMarkerCount": 15,
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
        "sheet_png",
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
        artifact["href"].startswith("/api/models/00000000-0000-0000-0000-000000000123/exports/")
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

    presentation_row = evidence["presentationCanvases"][0]
    assert presentation_row["canvasId"] == "deck-client"
    assert presentation_row["frameCount"] == 2
    assert presentation_row["slideCount"] == 2
    assert presentation_row["href"].endswith("/presentation-canvases/deck-client/export")
    assert {row["brandTemplateId"] for row in presentation_row["frames"]} == {"bt-client"}

    branded_export = evidence["brandedExports"][0]
    assert branded_export["brandTemplateId"] == "bt-client"
    assert branded_export["sheetCount"] == 1
    assert branded_export["invariantCheck"] == "layer-c-only"
    assert branded_export["href"].endswith("/export/pdf?brandTemplateId=bt-client")

    assert evidence["advancedDocumentation"]["viewTemplateCount"] == 1
    assert evidence["advancedDocumentation"]["revisionCloudCount"] == 1
    assert evidence["advancedDocumentation"]["revisionClouds"][0]["hostViewId"] == "plan-gf"

    render_formats = {row["format"]: row for row in evidence["renderExports"]}
    assert {"metadata-only", "gltf-pbr", "ifc-bundle"} <= set(render_formats)
    assert all(row["pass"] is True for row in render_formats.values())
    assert render_formats["gltf-pbr"]["primaryAsset"] == {
        "kind": "gltf",
        "pathInArchive": "model.glb",
    }

    documentation_unsupported = evidence["documentationExportUnsupportedSkipped_v1"]
    assert documentation_unsupported["format"] == "documentationExportUnsupportedSkipped_v1"
    assert documentation_unsupported["summary"]["unsupportedRowCount"] == 1
    assert documentation_unsupported["rows"] == [
        {
            "artifactId": "sheet:A101:png",
            "documentationExportKind": "sheet_png",
            "rowType": "unsupported_renderer",
            "sourceExportFormat": "documentation",
            "elementKind": "sheet",
            "feature": "full-sheet-raster",
            "reasonCode": "unsupported_full_raster_renderer_unavailable",
            "count": 1,
            "elementIds": [],
            "trackerItems": ["BIR-K01", "BIR-R05", "BIR-K06"],
        }
    ]
    parity = evidence["documentationExportParity_v1"]
    assert parity["format"] == "documentationExportParity_v1"
    assert parity["status"] == "warn"
    assert parity["pass"] is True
    parity_rows = {row["scopeId"]: row for row in parity["rows"]}
    assert parity_rows["sheet:A101:svg"]["digestsMatch"] is True
    assert parity_rows["sheet:A101:pdf"]["digestBasis"] == "viewport-listing-parity"
    assert parity_rows["sheet:A101:png"]["status"] == "warn"
    assert parity_rows["sheet:A101:png"]["unsupportedFeatures"] == [
        "unsupported_full_raster_renderer_unavailable"
    ]

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
        "sheet:A101:png",
        "model:ifc",
        "model:gltf",
        "model:glb",
        "schedule:sch-rooms",
        "tag:tag-room-101",
        "dimension:dim-overall",
        "presentation:deck-client",
        "brand-export:bt-client",
        "render:gltf-pbr",
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

    monkeypatch.setattr("bim_ai.evidence.export_documentation_evidence.IFC_AVAILABLE", False)
    monkeypatch.setattr(
        "bim_ai.evidence.export_documentation_evidence.serialize_ifc_artifact",
        lambda _doc: (
            "ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n",
            "empty_ifc_skeleton_v0",
            False,
        ),
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


def test_documentation_exports_reveal_pdf_like_unsupported_geometry_rows() -> None:
    doc = Document(
        revision=2,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="Ground", elevationMm=0),
            "plan": PlanViewElem(kind="plan_view", id="plan", name="Plan", levelId="lvl-0"),
            "rail": RailingElem(
                kind="railing",
                id="rail",
                pathMm=[{"xMm": 0, "yMm": 0}, {"xMm": 3000, "yMm": 0}],
            ),
            "sheet": SheetElem(
                kind="sheet",
                id="A101",
                name="A101",
                viewportsMm=[
                    {
                        "viewportId": "vp-plan",
                        "viewRef": "plan:plan",
                        "widthMm": 120,
                        "heightMm": 80,
                        "scale": 100,
                    }
                ],
            ),
        },
    )

    evidence = build_documentation_export_production_evidence_v1(doc)
    manifest = evidence["documentationExportUnsupportedSkipped_v1"]
    by_artifact = {
        row["artifactId"]: row
        for row in manifest["rows"]
        if row["reasonCode"] == "gltf_railing_geometry_unsupported"
    }

    assert {"sheet:A101:svg", "sheet:A101:pdf", "sheet:A101:png"} <= set(by_artifact)
    assert by_artifact["sheet:A101:pdf"]["elementIds"] == ["rail"]
    parity_rows = {row["scopeId"]: row for row in evidence["documentationExportParity_v1"]["rows"]}
    assert "gltf_railing_geometry_unsupported" in parity_rows["sheet:A101:pdf"][
        "listedUnsupportedFeatures"
    ]
    assert "gltf_railing_geometry_unsupported" in parity_rows["render:gltf-pbr"][
        "listedUnsupportedFeatures"
    ]
