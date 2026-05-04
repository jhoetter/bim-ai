from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    PlanViewElem,
    RoofElem,
    RoomElem,
    ScheduleElem,
    SheetElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.engine import try_commit, try_commit_bundle
from bim_ai.export_gltf import build_visual_export_manifest
from bim_ai.ifc_stub import (
    IFC_ENCODING_EMPTY_SHELL,
    build_ifc_exchange_manifest_payload,
    ifc_exchange_manifest_payload,
)
from bim_ai.schedule_csv import schedule_payload_to_csv, schedule_payload_with_column_subset
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.sheet_preview_svg import pick_sheet, sheet_elem_to_svg


def test_floor_opening_and_stair_apply_chain():
    doc = Document(
        revision=1,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="EG", elevationMm=0),
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="OG", elevationMm=2800),
        },
    )

    ok, doc_a, *_ = try_commit(
        doc,
        {
            "type": "createFloor",
            "id": "fl-eg",
            "name": "EG slab",
            "levelId": "lvl-0",
            "boundaryMm": [
                {"xMm": 0, "yMm": 0},
                {"xMm": 9000, "yMm": 0},
                {"xMm": 9000, "yMm": 9000},
                {"xMm": 0, "yMm": 9000},
            ],
            "thicknessMm": 240,
            "structureThicknessMm": 180,
            "finishThicknessMm": 0,
        },
    )
    assert ok and isinstance(doc_a.elements.get("fl-eg"), FloorElem)

    ok2, doc_b, *_ = try_commit(
        doc_a,
        {
            "type": "createSlabOpening",
            "id": "op-1",
            "name": "Shaft void",
            "hostFloorId": "fl-eg",
            "boundaryMm": [
                {"xMm": 3200, "yMm": 3200},
                {"xMm": 6200, "yMm": 3200},
                {"xMm": 6200, "yMm": 5900},
            ],
            "isShaft": True,
        },
    )
    assert ok2

    ok3, doc_c, *_ = try_commit(
        doc_b,
        {
            "type": "createStair",
            "id": "st-1",
            "name": "Main",
            "baseLevelId": "lvl-0",
            "topLevelId": "lvl-1",
            "runStartMm": {"xMm": 4400, "yMm": 4200},
            "runEndMm": {"xMm": 7400, "yMm": 4200},
            "widthMm": 1100,
            "riserMm": 175,
            "treadMm": 280,
        },
    )
    assert ok3 and isinstance(doc_c.elements.get("st-1"), StairElem)


def test_schedule_csv_column_subset_keeps_payload_order():
    payload = {"columns": ["a", "b", "c"], "rows": [{"a": 1, "b": 2, "c": 3}]}
    sub = schedule_payload_with_column_subset(payload, ["c", "a"])
    csv_txt = schedule_payload_to_csv(sub)
    assert csv_txt.splitlines()[0] == "a,c"


def test_gltf_manifest_warns_on_diagonal_wall_with_opening():
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "wskew": WallElem(
                kind="wall",
                id="wskew",
                name="Skew host",
                levelId="lvl",
                start={"xMm": 0.0, "yMm": 0.0},
                end={"xMm": 3000.0, "yMm": 1800.0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "door-a": DoorElem(
                kind="door",
                id="door-a",
                name="D",
                wallId="wskew",
                alongT=0.55,
                widthMm=900,
            ),
        },
    )
    gm = build_visual_export_manifest(doc)
    ext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    warns = ext.get("hostedCutApproximationWarnings") or []
    assert any(w.get("code") == "nonAxisAlignedWallHostedCutsApproximated" for w in warns)
    hit = next(w for w in warns if w.get("wallId") == "wskew")
    assert "door-a" in (hit.get("hostedOpeningIds") or [])


def test_gltf_manifest_embeds_extensions():
    doc = Document(revision=2, elements={"sch": ScheduleElem(kind="schedule", id="sch-1", name="S")})
    gm = build_visual_export_manifest(doc)
    ext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["elementCount"] == 1


def test_ifc_manifest_reports_counts():
    fm = ifc_exchange_manifest_payload(revision=11, counts_by_kind={"wall": 3})
    assert fm["format"] == "ifc_manifest_v0"
    assert fm["plannedIfcEntitiesHints"] == ["wall"]
    assert fm["elementCount"] == 3
    assert fm["exportedGeometryKinds"] == {"wall": 3}
    assert fm["ifcEncoding"] == IFC_ENCODING_EMPTY_SHELL
    assert fm["artifactHasGeometryEntities"] is False
    assert fm["exportedIfcKindsInArtifact"] == {}
    assert fm["ifcEmittedKernelKinds"] == []


def test_build_ifc_exchange_manifest_aligned_with_schedule_only_doc():
    doc = Document(revision=2, elements={"sch": ScheduleElem(kind="schedule", id="sch-1", name="S")})
    im = build_ifc_exchange_manifest_payload(doc)
    gm = build_visual_export_manifest(doc)
    gext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    assert im["elementCount"] == gext["elementCount"]
    assert im["exportedGeometryKinds"] == gext["exportedGeometryKinds"]
    assert im["unsupportedDocumentKindsDetailed"] == gext["unsupportedDocumentKindsDetailed"]


def test_floor_schedule_engine_meta_and_sort():
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "f-b": FloorElem(
                kind="floor",
                id="f-b",
                name="Beta slab",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
                thicknessMm=200,
            ),
            "f-a": FloorElem(
                kind="floor",
                id="f-a",
                name="Alpha slab",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 2000},
                    {"xMm": 3000, "yMm": 2000},
                ],
                thicknessMm=200,
            ),
            "sch-f": ScheduleElem(
                kind="schedule",
                id="sch-f",
                name="Floors",
                filters={"category": "floor", "sortBy": "name"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch-f")
    assert tbl["scheduleEngine"]["format"] == "scheduleDerivationEngine_v1"
    assert tbl["scheduleEngine"]["sortBy"] == "name"
    names = [r["name"] for r in tbl["rows"]]
    assert names == sorted(names)
    assert tbl["columnMetadata"]["fields"]["areaM2"]["label"]


def test_roof_and_stair_totals_rollups():
    doc = Document(
        revision=1,
        elements={
            "lvl0": LevelElem(kind="level", id="lvl0", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="O", elevationMm=2800),
            "r1": RoofElem(
                kind="roof",
                id="r1",
                name="R",
                referenceLevelId="lvl1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "st1": StairElem(
                kind="stair",
                id="st1",
                name="S",
                baseLevelId="lvl0",
                topLevelId="lvl1",
                runStartMm={"xMm": 0, "yMm": 0},
                runEndMm={"xMm": 3000, "yMm": 0},
                widthMm=1000,
            ),
            "sch-r": ScheduleElem(kind="schedule", id="sch-r", name="Roofs", filters={"category": "roof"}),
            "sch-s": ScheduleElem(kind="schedule", id="sch-s", name="Stairs", filters={"category": "stair"}),
        },
    )
    tr = derive_schedule_table(doc, "sch-r")
    assert tr["totals"]["kind"] == "roof"
    assert tr["totals"]["rowCount"] == 1
    ts = derive_schedule_table(doc, "sch-s")
    assert ts["totals"]["kind"] == "stair"
    assert ts["totals"]["totalRunMm"] > 0


def test_window_schedule_group_alias():
    doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl-1",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "win-a": WindowElem(
                kind="window",
                id="win-a",
                name="A",
                wallId="w1",
                alongT=0.33,
                widthMm=900,
                sillHeightMm=900,
                heightMm=1200,
                familyTypeId="ft-ab",
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="WinSch",
                filters={"category": "window", "groupingHint": ["levelId", "familyTypeMark"]},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch-1")
    assert tbl["category"] == "window"
    assert tbl["totalRows"] == 1


def test_upsert_plan_view_command():
    doc = Document(revision=1, elements={"lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)})
    ok, new_doc, *_ = try_commit(
        doc,
        {
            "type": "upsertPlanView",
            "id": "pv-eg",
            "name": "EG plan",
            "levelId": "lvl-1",
            "planPresentation": "opening_focus",
        },
    )
    assert ok
    pv = new_doc.elements.get("pv-eg")
    assert pv is not None and getattr(pv, "kind", None) == "plan_view"


def test_move_level_moves_stair_baselines_where_bound():
    from bim_ai.elements import StairElem as SE

    stair = SE(
        kind="stair",
        id="s1",
        name="Main",
        baseLevelId="a",
        topLevelId="b",
        runStartMm={"xMm": 0, "yMm": 0},
        runEndMm={"xMm": 4000, "yMm": 0},
        widthMm=1000,
        riserMm=175,
        treadMm=280,
    )

    doc = Document(
        revision=1,
        elements={
            "a": LevelElem(kind="level", id="a", name="Low", elevationMm=0),
            "b": LevelElem(kind="level", id="b", name="High", elevationMm=2800),
            "s1": stair,
        },
    )
    ok, after, *_ = try_commit(doc, {"type": "moveLevelElevation", "levelId": "b", "elevationMm": 3000})
    assert ok
    lvl_b = after.elements["b"]

    assert isinstance(lvl_b, LevelElem)

    assert abs(lvl_b.elevation_mm - 3000) < 1e-6


def test_schedule_csv_contains_room_headers():
    doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0),
            "rm": RoomElem(
                kind="room",
                id="rm",
                name="Kitchen",
                levelId="lvl-1",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Rooms",
                filters={"category": "room"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch-1")
    assert tbl["columns"][0] == "elementId"
    assert tbl["columnMetadata"]["category"] == "room"
    csv_txt = schedule_payload_to_csv(tbl)
    header = csv_txt.splitlines()[0]
    assert "elementId" in header


def test_sheet_preview_svg_is_deterministic():
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="Test sheet",
                titleBlock="TB-1",
                viewportsMm=[{"xMm": 100, "yMm": 120, "widthMm": 2000, "heightMm": 1500}],
            ),
        },
    )
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert "<?xml" in svg
    assert "A1 metaphor" in svg
    assert pick_sheet(doc, None).id == "s1"


def test_sheet_svg_resolves_plan_view_ref_for_viewport_label():
    doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0),
            "pv-a": PlanViewElem(
                kind="plan_view",
                id="pv-a",
                name="EG openings",
                level_id="lvl-1",
                plan_presentation="opening_focus",
            ),
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="Test sheet",
                titleBlock="TB-1",
                viewportsMm=[
                    {
                        "xMm": 100,
                        "yMm": 120,
                        "widthMm": 2000,
                        "heightMm": 1500,
                        "label": "Fallback",
                        "viewRef": "plan:pv-a",
                    }
                ],
            ),
        },
    )
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert "EG openings" in svg
    assert "plan:pv-a" in svg


def test_bcf_topics_apply_via_bundle():
    doc = Document(
        revision=1,
        elements={"lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)},
    )
    ok1, d1, *_ = try_commit_bundle(
        doc,
        [{"type": "createBcfTopic", "id": "bcf-a", "title": "Coord clash"}],
    )
    assert ok1
    assert d1.elements.get("bcf-a") is not None
    ok2, d2, *_ = try_commit_bundle(
        d1,
        [{"type": "createBcfTopic", "id": "bcf-b", "title": "Second", "viewpointRef": "vp-99"}],
    )
    assert ok2
    b = d2.elements["bcf-b"]
    assert getattr(b, "kind", None) == "bcf"


def test_wall_batch_commit_budget_smoke():
    doc = Document(
        revision=1,
        elements={"lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)},
    )
    cmds: list[dict] = []
    for i in range(120):
        x0 = i * 4200
        cmds.append(
            {
                "type": "createWall",
                "id": f"w{i}",
                "levelId": "lvl-1",
                "start": {"xMm": x0, "yMm": 0},
                "end": {"xMm": x0 + 3000, "yMm": 0},
                "heightMm": 2600,
            },
        )

    ok, new_doc, *_ = try_commit_bundle(doc, cmds)
    assert ok
    walls = sum(1 for e in new_doc.elements.values() if getattr(e, "kind", None) == "wall")
    assert walls == 120
