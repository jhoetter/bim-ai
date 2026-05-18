from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import LevelElem, PlanViewElem, RoomElem, SheetElem, WallElem
from bim_ai.engine import try_commit_bundle
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
