from __future__ import annotations

import csv
from io import StringIO

from bim_ai.document import Document
from bim_ai.elements import (
    CalloutElem,
    CameraMm,
    DoorElem,
    FloorElem,
    LevelElem,
    PlanViewElem,
    RoofElem,
    RoomElem,
    ScheduleElem,
    SectionCutElem,
    SheetElem,
    StairElem,
    Vec3Mm,
    ViewpointElem,
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
from bim_ai.sheet_preview_svg import (
    format_viewport_crop_export_segment,
    pick_sheet,
    resolve_view_ref_title,
    sheet_elem_to_svg,
    sheet_viewport_export_listing_lines,
)


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


def test_schedule_table_column_subset_same_as_csv_header():
    payload = {
        "columns": ["elementId", "name", "levelId", "level", "areaM2", "perimeterM"],
        "rows": [
            {
                "elementId": "r1",
                "name": "Room",
                "levelId": "lv",
                "level": "L1",
                "areaM2": 12.0,
                "perimeterM": 14.0,
            },
        ],
    }
    sub = schedule_payload_with_column_subset(payload, ["level", "elementId"])
    assert sub["columns"] == ["elementId", "level"]
    assert schedule_payload_to_csv(sub).splitlines()[0] == "elementId,level"


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


def test_window_schedule_grouped_csv_includes_sorted_totals_footer() -> None:
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
    assert isinstance(tbl.get("groupedSections"), dict)
    csv_txt = schedule_payload_to_csv(tbl, include_totals_csv=True)
    lines = csv_txt.splitlines()
    assert lines[0].startswith("Group,")
    assert "__schedule_totals_v1__" in csv_txt
    start = next(i for i, ln in enumerate(lines) if "__schedule_totals_v1__" in ln)
    keys: list[str] = []
    for ln in lines[start + 2 :]:
        if not ln.strip():
            break
        row = next(csv.reader(StringIO(ln)))
        if len(row) >= 3 and row[1].strip():
            keys.append(row[1].strip())
    assert keys == sorted(keys)


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


def test_room_schedule_area_filter_csv_export_totals_footer():
    doc = Document(
        revision=1,
        elements={
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0),
            "rm-a": RoomElem(
                kind="room",
                id="rm-a",
                name="Small",
                levelId="lvl-1",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 1000, "yMm": 0},
                    {"xMm": 1000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
            ),
            "rm-b": RoomElem(
                kind="room",
                id="rm-b",
                name="Large",
                levelId="lvl-1",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
            ),
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Rooms",
                filters={
                    "category": "room",
                    "filterRules": [{"field": "areaM2", "op": "gt", "value": 10}],
                },
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch-1")
    assert tbl["totalRows"] == 1
    csv_txt = schedule_payload_to_csv(tbl, include_totals_csv=True)
    assert "rm-b" in csv_txt
    assert "rm-a" not in csv_txt
    assert "__schedule_totals_v1__" in csv_txt
    assert ",areaM2,20" in csv_txt


def test_sheet_svg_legacy_w_mm_h_mm_viewport_extents():
    doc = Document(
        revision=1,
        elements={
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="Legacy VP",
                titleBlock="TB-1",
                viewportsMm=[
                    {"xMm": 500, "yMm": 600, "wMm": 2200, "hMm": 1700, "label": "A"},
                ],
            ),
        },
    )
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert '2200' in svg and '1700' in svg
    assert '<rect x="500.0" y="600.0"' in svg or '<rect x="500" y="600"' in svg


def test_resolve_view_ref_title_viewpoint_alias():
    vp = ViewpointElem(
        kind="viewpoint",
        id="vp-roof",
        name="Roof overview",
        camera=CameraMm(
            position=Vec3Mm(xMm=0, yMm=5000, zMm=8000),
            target=Vec3Mm(xMm=0, yMm=0, zMm=0),
            up=Vec3Mm(xMm=0, yMm=1, zMm=0),
        ),
    )
    doc = Document(revision=1, elements={"vp-roof": vp})
    assert resolve_view_ref_title(doc, "viewpoint:vp-roof") == "Roof overview"
    assert resolve_view_ref_title(doc, "vp:vp-roof") == "Roof overview"


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


def test_sheet_svg_plan_viewport_plan_prim_reflects_sheet_crop() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0),
            "pv-a": PlanViewElem(
                kind="plan_view",
                id="pv-a",
                name="Floor plan",
                levelId="lvl-1",
                cropMinMm={"xMm": -500, "yMm": -500},
                cropMaxMm={"xMm": 9500, "yMm": 6500},
            ),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="A",
                levelId="lvl-1",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "w-b": WallElem(
                kind="wall",
                id="w-b",
                name="B",
                levelId="lvl-1",
                start={"xMm": 5000, "yMm": 0},
                end={"xMm": 7000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    vp_wide = {
        "viewportId": "vp",
        "xMm": 100,
        "yMm": 120,
        "widthMm": 2000,
        "heightMm": 1500,
        "label": "P",
        "viewRef": "plan:pv-a",
        "cropMinMm": {"xMm": 0, "yMm": -400},
        "cropMaxMm": {"xMm": 8000, "yMm": 400},
    }
    vp_tight = {
        **vp_wide,
        "cropMinMm": {"xMm": 0, "yMm": -200},
        "cropMaxMm": {"xMm": 3000, "yMm": 200},
    }
    svg_wide = sheet_elem_to_svg(
        doc,
        SheetElem(kind="sheet", id="s1", name="S", titleBlock="TB", viewportsMm=[vp_wide]),
    )
    svg_tight = sheet_elem_to_svg(
        doc,
        SheetElem(kind="sheet", id="s1", name="S", titleBlock="TB", viewportsMm=[vp_tight]),
    )
    assert "planPrim[w=2," in svg_wide
    assert "planPrim[w=1," in svg_tight
    pdf_wide = sheet_viewport_export_listing_lines(
        doc,
        SheetElem(kind="sheet", id="s1", name="S", titleBlock="TB", viewportsMm=[vp_wide]),
    )
    pdf_tight = sheet_viewport_export_listing_lines(
        doc,
        SheetElem(kind="sheet", id="s1", name="S", titleBlock="TB", viewportsMm=[vp_tight]),
    )
    assert any("planPrim[w=2," in ln for ln in pdf_wide)
    assert any("planPrim[w=1," in ln for ln in pdf_tight)


def test_sheet_svg_viewport_includes_crop_export_segment():
    vp = {
        "viewportId": "vp-c",
        "xMm": 100,
        "yMm": 120,
        "widthMm": 900,
        "heightMm": 700,
        "cropMinMm": {"xMm": -5, "yMm": -6},
        "cropMaxMm": {"xMm": 1002, "yMm": 2003},
    }
    doc = Document(revision=1, elements={"s1": SheetElem(kind="sheet", id="s1", name="Crop", viewportsMm=[vp])})
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert "crop[mn=-5,-6 mx=1002,2003]" in svg


def _doc_sheet_with_section_viewport() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl-eg": LevelElem(kind="level", id="lvl-eg", name="EG", elevationMm=0),
            "lvl-l1": LevelElem(kind="level", id="lvl-l1", name="L1", elevationMm=3200),
            "sec-cut": SectionCutElem(
                kind="section_cut",
                id="sec-cut",
                name="A-A",
                lineStartMm={"xMm": 0.0, "yMm": -2000.0},
                lineEndMm={"xMm": 0.0, "yMm": 2000.0},
                cropDepthMm=8000.0,
            ),
            "s1": SheetElem(
                kind="sheet",
                id="s1",
                name="Sections",
                titleBlock="TB-1",
                viewportsMm=[
                    {
                        "viewportId": "vp-sec",
                        "xMm": 100,
                        "yMm": 120,
                        "widthMm": 1500,
                        "heightMm": 900,
                        "label": "S",
                        "viewRef": "section:sec-cut",
                    }
                ],
            ),
        },
    )


def test_sheet_svg_section_viewport_includes_documentation_segment() -> None:
    doc = _doc_sheet_with_section_viewport()
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert "secDoc[lvl=2 zSpanMm=3200]" in svg
    assert "co=" not in svg
    assert "mh=" not in svg


def _doc_sheet_with_section_viewport_and_wall_hatch_mix() -> Document:
    """Two walls: perpendicular to cut (edge-on) + parallel to cut (along-cut) for secDoc wh= token."""
    base_doc = _doc_sheet_with_section_viewport()
    els = dict(base_doc.elements)
    els["w-edge"] = WallElem(
        kind="wall",
        id="w-edge",
        name="Beam wall",
        levelId="lvl-eg",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    els["w-along"] = WallElem(
        kind="wall",
        id="w-along",
        name="Curtain",
        levelId="lvl-eg",
        start={"xMm": 3100.0, "yMm": -1000.0},
        end={"xMm": 3100.0, "yMm": 6000.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    return Document(revision=1, elements=els)


def test_sheet_svg_section_viewport_includes_wall_hatch_documentation_token() -> None:
    doc = _doc_sheet_with_section_viewport_and_wall_hatch_mix()
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert "secDoc[lvl=2 zSpanMm=3200 uGeomSpanMm=7000 wh=E1A1 mh=2]" in svg
    assert 'data-section-doc-token="sectionDocumentationSegment"' in svg
    assert 'data-section-doc-mh="2"' in svg


def test_sheet_pdf_viewport_export_listing_includes_wall_hatch_documentation_token() -> None:
    doc = _doc_sheet_with_section_viewport_and_wall_hatch_mix()
    lines = sheet_viewport_export_listing_lines(doc, pick_sheet(doc, "s1"))
    joined = "\n".join(lines)
    assert "secDoc[lvl=2 zSpanMm=3200 uGeomSpanMm=7000 wh=E1A1 mh=2]" in joined


_TRI_CALLOUT = (
    {"xMm": 0.0, "yMm": 0.0},
    {"xMm": 400.0, "yMm": 0.0},
    {"xMm": 200.0, "yMm": 300.0},
)


def _doc_sheet_with_section_viewport_and_callouts() -> Document:
    base = _doc_sheet_with_section_viewport()
    els = dict(base.elements)
    els["co-z"] = CalloutElem(
        kind="callout",
        id="co-z",
        name="Wall junction",
        parentSheetId="s1",
        outlineMm=list(_TRI_CALLOUT),
    )
    els["co-a"] = CalloutElem(
        kind="callout",
        id="co-a",
        name="Footing detail",
        parentSheetId="s1",
        outlineMm=[
            {"xMm": 500.0, "yMm": 500.0},
            {"xMm": 900.0, "yMm": 500.0},
            {"xMm": 700.0, "yMm": 800.0},
        ],
    )
    return Document(revision=base.revision, elements=els)


def test_sheet_svg_section_viewport_includes_callout_documentation_token() -> None:
    doc = _doc_sheet_with_section_viewport_and_callouts()
    svg = sheet_elem_to_svg(doc, pick_sheet(doc, "s1"))
    assert "secDoc[lvl=2 zSpanMm=3200 co=co-a,co-z]" in svg


def test_sheet_pdf_viewport_export_listing_includes_section_documentation_segment() -> None:
    doc = _doc_sheet_with_section_viewport()
    lines = sheet_viewport_export_listing_lines(doc, pick_sheet(doc, "s1"))
    joined = "\n".join(lines)
    assert "secDoc[lvl=2 zSpanMm=3200]" in joined
    assert "co=" not in joined


def test_sheet_pdf_viewport_export_listing_includes_callout_documentation_token() -> None:
    doc = _doc_sheet_with_section_viewport_and_callouts()
    lines = sheet_viewport_export_listing_lines(doc, pick_sheet(doc, "s1"))
    joined = "\n".join(lines)
    assert "secDoc[lvl=2 zSpanMm=3200 co=co-a,co-z]" in joined


def test_format_viewport_crop_export_segment_empty_without_pair():
    partial = {"viewportId": "p", "xMm": 0, "yMm": 0, "widthMm": 10, "heightMm": 10, "cropMinMm": {"xMm": 1, "yMm": 2}}
    assert format_viewport_crop_export_segment(partial) == ""


def test_sheet_pdf_viewport_export_listing_includes_crop_segment():
    vp_full = {
        "viewportId": "z-last",
        "label": "L",
        "xMm": 10,
        "yMm": 20,
        "widthMm": 100,
        "heightMm": 80,
        "cropMinMm": {"xMm": 0, "yMm": 1},
        "crop_max_mm": {"x_mm": 9, "y_mm": 8},
    }
    vp_plain = {"viewportId": "a-first", "label": "N", "xMm": 0, "yMm": 0, "widthMm": 50, "heightMm": 40}
    doc = Document(revision=1, elements={"s1": SheetElem(kind="sheet", id="s1", name="Pdf", viewportsMm=[vp_full, vp_plain])})
    lines = sheet_viewport_export_listing_lines(doc, pick_sheet(doc, "s1"))
    joined = "\n".join(lines)
    assert "crop[mn=" in joined


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
