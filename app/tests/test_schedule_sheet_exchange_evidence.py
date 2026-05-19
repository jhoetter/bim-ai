from __future__ import annotations

from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    DoorElem,
    LevelElem,
    MaterialElem,
    PlanViewElem,
    RoomElem,
    ScheduleElem,
    SheetElem,
    Vec3Mm,
    ViewpointElem,
    WallElem,
    WindowElem,
)
from bim_ai.evidence_manifest import deterministic_sheet_evidence_manifest
from bim_ai.export_documentation_evidence import build_documentation_export_production_evidence_v1
from bim_ai.schedule_sheet_exchange_evidence import (
    FORMAT_V1,
    build_schedule_sheet_exchange_evidence_v1,
)


def _room(rid: str, level_id: str = "lvl") -> RoomElem:
    return RoomElem(
        kind="room",
        id=rid,
        name=rid,
        levelId=level_id,
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 3000, "yMm": 0},
            {"xMm": 3000, "yMm": 2000},
            {"xMm": 0, "yMm": 2000},
        ],
    )


def _base_exchange_doc() -> Document:
    return Document(
        revision=4,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Ground", elevationMm=0),
            "wall": WallElem(
                kind="wall",
                id="wall",
                name="Wall",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "door": DoorElem(
                kind="door",
                id="door",
                name="D1",
                wallId="wall",
                alongT=0.35,
                widthMm=900,
            ),
            "window": WindowElem(
                kind="window",
                id="window",
                name="W1",
                wallId="wall",
                alongT=0.7,
                widthMm=1200,
                heightMm=900,
                sillHeightMm=900,
            ),
            "room": _room("room"),
            "plan": PlanViewElem(
                kind="plan_view",
                id="plan",
                name="Ground plan",
                levelId="lvl",
                scale=100,
            ),
            "view-3d": ViewpointElem(
                kind="viewpoint",
                id="view-3d",
                name="Axon",
                camera=CameraMm(
                    position=Vec3Mm(x_mm=0, y_mm=-8000, z_mm=4000),
                    target=Vec3Mm(x_mm=0, y_mm=0, z_mm=0),
                    up=Vec3Mm(x_mm=0, y_mm=0, z_mm=1),
                ),
            ),
            "sch-room": ScheduleElem(
                kind="schedule",
                id="sch-room",
                name="Rooms",
                filters={"category": "room"},
            ),
            "sch-door": ScheduleElem(
                kind="schedule",
                id="sch-door",
                name="Doors",
                filters={"category": "door"},
            ),
            "sch-window": ScheduleElem(
                kind="schedule",
                id="sch-window",
                name="Windows",
                filters={"category": "window"},
            ),
            "sch-material": ScheduleElem(
                kind="schedule",
                id="sch-material",
                name="Material quantities",
                filters={"category": "material_assembly"},
            ),
            "sch-quantity": ScheduleElem(
                kind="schedule",
                id="sch-quantity",
                name="Quantity takeoff",
                filters={"category": "quantity_takeoff"},
            ),
            "sch-sheet": ScheduleElem(
                kind="schedule",
                id="sch-sheet",
                name="Sheet list",
                filters={"category": "sheet"},
            ),
            "sch-view": ScheduleElem(
                kind="schedule",
                id="sch-view",
                name="View list",
                filters={"category": "view"},
            ),
            "sheet": SheetElem(
                kind="sheet",
                id="sheet",
                name="A101",
                viewportsMm=[
                    {
                        "viewportId": "vp-plan",
                        "viewRef": "plan:plan",
                        "xMm": 0,
                        "yMm": 0,
                        "widthMm": 120,
                        "heightMm": 80,
                        "scale": 100,
                    },
                    {
                        "viewportId": "vp-3d",
                        "viewRef": "viewpoint:view-3d",
                        "xMm": 140,
                        "yMm": 0,
                        "widthMm": 80,
                        "heightMm": 80,
                    },
                ],
            ),
        },
    )


def test_schedule_sheet_exchange_evidence_clean_with_current_packets() -> None:
    doc = _base_exchange_doc()
    sheet_rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="exchange",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    doc_export = build_documentation_export_production_evidence_v1(doc, model_id=uuid4())

    evidence = build_schedule_sheet_exchange_evidence_v1(
        doc,
        deterministic_sheet_evidence=sheet_rows,
        documentation_export_evidence=doc_export,
        semantic_digest_sha256="a" * 64,
    )

    assert evidence["format"] == FORMAT_V1
    assert evidence["status"] == "clean"
    assert evidence["pass"] is True
    assert evidence["summary"]["findingCount"] == 0
    by_category = {row["category"]: row for row in evidence["scheduleChecks"]}
    assert by_category["room"]["status"] == "matched"
    assert by_category["door"]["status"] == "matched"
    assert by_category["window"]["status"] == "matched"
    assert by_category["material_assembly"]["expectedModelRowCount"] == 1
    assert by_category["quantity_takeoff"]["expectedModelRowCount"] == 4
    assert evidence["sheetViewChecks"][0]["status"] == "matched"
    assert {row["status"] for row in evidence["renderBundleChecks"]} == {"matched"}
    assert len(evidence["exchangeEvidenceDigestSha256"]) == 64


def test_schedule_exchange_evidence_exposes_missing_filtered_rows_and_stale_packets() -> None:
    doc = Document(
        revision=1,
        elements={
            "l1": LevelElem(kind="level", id="l1", name="L1", elevationMm=0),
            "l2": LevelElem(kind="level", id="l2", name="L2", elevationMm=3000),
            "r1": _room("r1", "l1"),
            "r2": _room("r2", "l2"),
            "sch-room": ScheduleElem(
                kind="schedule",
                id="sch-room",
                name="Rooms",
                filters={"category": "room", "filterEquals": {"levelId": "l1"}},
            ),
            "sheet": SheetElem(kind="sheet", id="sheet", name="A101"),
        },
    )
    sheet_rows = deterministic_sheet_evidence_manifest(
        model_id=uuid4(),
        doc=doc,
        evidence_artifact_basename="exchange",
        semantic_digest_sha256="b" * 64,
        semantic_digest_prefix16="b" * 16,
    )
    doc_export = build_documentation_export_production_evidence_v1(doc, model_id=uuid4())
    changed = doc.model_copy(
        update={
            "revision": 2,
            "elements": {
                **doc.elements,
                "r1": RoomElem(
                    kind="room",
                    id="r1",
                    name="r1-renamed",
                    levelId="l1",
                    outlineMm=[
                        {"xMm": 0, "yMm": 0},
                        {"xMm": 3000, "yMm": 0},
                        {"xMm": 3000, "yMm": 2000},
                        {"xMm": 0, "yMm": 2000},
                    ],
                ),
                "r3": _room("r3", "l2"),
            },
        }
    )

    evidence = build_schedule_sheet_exchange_evidence_v1(
        changed,
        deterministic_sheet_evidence=sheet_rows,
        documentation_export_evidence=doc_export,
        evidence_packet={"revision": 1, "semanticDigestSha256": "b" * 64},
    )

    codes = {row["code"] for row in evidence["findings"]}
    assert "evidence_packet_revision_stale" in codes
    assert "sheet_evidence_revision_stale" in codes
    assert "schedule_missing_model_rows" in codes
    assert "schedule_payload_digest_stale" in codes
    room_check = next(row for row in evidence["scheduleChecks"] if row["scheduleId"] == "sch-room")
    assert room_check["status"] == "row_mismatch"
    assert room_check["missingModelRowIds"] == ["r2", "r3"]
    assert room_check["documentationEvidenceStatus"] == "stale_digest"


def test_schedule_exchange_evidence_exposes_unsupported_categories_and_missing_schedules() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Ground", elevationMm=0),
            "room": _room("room"),
            "sch-custom": ScheduleElem(
                kind="schedule",
                id="sch-custom",
                name="Custom",
                filters={"category": "unsupported_exchange_category"},
            ),
        },
    )

    evidence = build_schedule_sheet_exchange_evidence_v1(doc)

    codes = {row["code"] for row in evidence["findings"]}
    assert "schedule_exchange_unsupported_category" in codes
    assert "exchange_schedule_missing" in codes
    unsupported = next(
        row for row in evidence["scheduleChecks"] if row["scheduleId"] == "sch-custom"
    )
    assert unsupported["status"] == "unsupported_schedule_category"
    missing_room = next(
        row
        for row in evidence["scheduleChecks"]
        if row["category"] == "room" and row["scheduleId"] is None
    )
    assert missing_room["missingModelRowIds"] == ["room"]


def test_sheet_exchange_evidence_exposes_stale_viewport_refs_and_missing_scales() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="Ground", elevationMm=0),
            "plan": PlanViewElem(kind="plan_view", id="plan", name="Plan", levelId="lvl"),
            "sheet": SheetElem(
                kind="sheet",
                id="sheet",
                name="A101",
                viewportsMm=[
                    {"viewportId": "vp-plan", "viewRef": "plan:plan"},
                    {"viewportId": "vp-missing", "viewRef": "plan:missing"},
                ],
            ),
        },
    )

    evidence = build_schedule_sheet_exchange_evidence_v1(doc)

    codes = {row["code"] for row in evidence["findings"]}
    assert "sheet_viewport_stale_view_ref" in codes
    assert "sheet_viewport_scale_missing" in codes
    assert "sheet_evidence_row_missing" in codes
    sheet_check = evidence["sheetViewChecks"][0]
    by_vp = {row["viewportId"]: row for row in sheet_check["viewports"]}
    assert by_vp["vp-plan"]["scaleStatus"] == "missing"
    assert by_vp["vp-missing"]["resolvesViewRef"] is False


def test_render_exchange_evidence_exposes_missing_material_texture_assets() -> None:
    doc = Document(
        revision=1,
        elements={
            "mat": MaterialElem(
                kind="material",
                id="mat",
                name="Broken material",
                albedoMapId="img-missing",
            ),
        },
    )

    evidence = build_schedule_sheet_exchange_evidence_v1(doc)

    assert "render_bundle_missing_material_assets" in {
        row["code"] for row in evidence["findings"]
    }
    assert all(row["missingMaterialAssetCount"] == 1 for row in evidence["renderBundleChecks"])
