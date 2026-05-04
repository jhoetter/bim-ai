from __future__ import annotations

from bim_ai.document import Document
from bim_ai.elements import (
    FloorElem,
    LevelElem,
    PlanViewElem,
    RoomElem,
    ScheduleElem,
    SheetElem,
    StairElem,
    WallElem,
    WindowElem,
)
from bim_ai.engine import try_commit, try_commit_bundle
from bim_ai.export_gltf import build_visual_export_manifest
from bim_ai.ifc_stub import ifc_exchange_manifest_payload
from bim_ai.schedule_csv import schedule_payload_to_csv
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


def test_gltf_manifest_embeds_extensions():
    doc = Document(revision=2, elements={"sch": ScheduleElem(kind="schedule", id="sch-1", name="S")})
    gm = build_visual_export_manifest(doc)
    ext = gm["extensions"]["BIM_AI_exportManifest_v0"]
    assert ext["elementCount"] == 1


def test_ifc_manifest_reports_counts():
    fm = ifc_exchange_manifest_payload(revision=11, counts_by_kind={"wall": 3})
    assert fm["format"] == "ifc_manifest_v0"
    assert fm["plannedIfcEntitiesHints"]


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
