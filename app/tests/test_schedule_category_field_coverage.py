"""Schedule category field coverage and CSV/JSON parity (WP-D01, WP-D02, WP-D04)."""

from __future__ import annotations

import csv
from io import StringIO

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    FloorTypeElem,
    LevelElem,
    RoofElem,
    RoofTypeElem,
    ScheduleElem,
    WallElem,
    WallTypeElem,
    WindowElem,
)
from bim_ai.schedule_csv import schedule_payload_to_csv, scheduleCsvExportParityEvidence_v1
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.schedule_field_registry import (
    SCHEDULE_COLUMN_METADATA,
    SCHEDULE_COLUMN_ORDER,
    scheduleFieldRegistryCoverageEvidence_v1,
)

# --- Registry coverage ---


def test_floor_registry_includes_floor_type_id() -> None:
    assert "floorTypeId" in SCHEDULE_COLUMN_ORDER["floor"]
    assert "floorTypeId" in SCHEDULE_COLUMN_METADATA["floor"]


def test_floor_registry_includes_type_material_fields() -> None:
    for field in ("typeName", "materialAssemblyLayers", "totalThicknessMm"):
        assert field in SCHEDULE_COLUMN_ORDER["floor"], f"missing from floor order: {field}"
        assert field in SCHEDULE_COLUMN_METADATA["floor"], f"missing from floor metadata: {field}"


def test_roof_registry_includes_pitch_deg() -> None:
    assert "pitchDeg" in SCHEDULE_COLUMN_ORDER["roof"]
    assert "pitchDeg" in SCHEDULE_COLUMN_METADATA["roof"]


def test_roof_registry_includes_type_material_fields() -> None:
    for field in ("typeName", "materialAssemblyLayers"):
        assert field in SCHEDULE_COLUMN_ORDER["roof"], f"missing from roof order: {field}"
        assert field in SCHEDULE_COLUMN_METADATA["roof"], f"missing from roof metadata: {field}"


def test_stair_registry_includes_quantity_fields() -> None:
    for field in ("riserCount", "treadCount", "riserHeightMm", "treadDepthMm"):
        assert field in SCHEDULE_COLUMN_ORDER["stair"], f"missing from stair order: {field}"
        assert field in SCHEDULE_COLUMN_METADATA["stair"], f"missing from stair metadata: {field}"


def test_door_registry_includes_host_wall_type_name() -> None:
    assert "hostWallTypeName" in SCHEDULE_COLUMN_ORDER["door"]
    assert "hostWallTypeName" in SCHEDULE_COLUMN_METADATA["door"]


def test_window_registry_includes_host_wall_type_name() -> None:
    assert "hostWallTypeName" in SCHEDULE_COLUMN_ORDER["window"]
    assert "hostWallTypeName" in SCHEDULE_COLUMN_METADATA["window"]


def test_schedule_field_registry_coverage_evidence_structure() -> None:
    ev = scheduleFieldRegistryCoverageEvidence_v1()
    assert ev["format"] == "scheduleFieldRegistryCoverageEvidence_v1"
    cats = ev["categories"]
    assert "floor" in cats
    assert "roof" in cats
    assert "stair" in cats
    for cat_data in cats.values():
        assert "coveragePct" in cat_data
        assert isinstance(cat_data["coveragePct"], float)
        assert 0.0 <= cat_data["coveragePct"] <= 100.0


def test_schedule_field_registry_coverage_evidence_floor_coverage() -> None:
    ev = scheduleFieldRegistryCoverageEvidence_v1()
    floor_cov = ev["categories"]["floor"]
    assert floor_cov["coveragePct"] >= 50.0
    assert "floorTypeId" in floor_cov["coveredFields"]
    assert "typeName" in floor_cov["coveredFields"]
    assert "materialAssemblyLayers" in floor_cov["coveredFields"]


# --- Type/material propagation into schedule rows ---


def _floor_doc_with_type() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "ft1": FloorTypeElem(kind="floor_type", id="ft1", name="Reinforced Slab"),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                name="Slab",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                thicknessMm=200,
                floorTypeId="ft1",
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Floors",
                filters={"category": "floor"},
            ),
        },
    )


def test_floor_schedule_row_includes_floor_type_id_and_type_name() -> None:
    doc = _floor_doc_with_type()
    tbl = derive_schedule_table(doc, "sch")
    assert tbl["category"] == "floor"
    assert len(tbl["rows"]) == 1
    row = tbl["rows"][0]
    assert row["floorTypeId"] == "ft1"
    assert row["typeName"] == "Reinforced Slab"


def test_floor_schedule_row_includes_material_assembly_fields() -> None:
    doc = _floor_doc_with_type()
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert "materialAssemblyLayers" in row
    assert isinstance(row["materialAssemblyLayers"], int)
    assert row["materialAssemblyLayers"] >= 1
    assert "totalThicknessMm" in row
    assert row["totalThicknessMm"] > 0


def test_floor_schedule_row_without_type_has_empty_floor_type_id() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                name="Slab",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
                thicknessMm=180,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Floors",
                filters={"category": "floor"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert row["floorTypeId"] == ""
    assert row["typeName"] == ""
    assert row["materialAssemblyLayers"] == 1
    assert row["totalThicknessMm"] == 180.0


def test_roof_schedule_row_includes_type_name_and_material_assembly_layers() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rt1": RoofTypeElem(kind="roof_type", id="rt1", name="Warm Roof"),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                name="Main Roof",
                referenceLevelId="lvl",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 8000, "yMm": 0},
                    {"xMm": 8000, "yMm": 6000},
                    {"xMm": 0, "yMm": 6000},
                ],
                roofTypeId="rt1",
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Roofs",
                filters={"category": "roof"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    assert tbl["category"] == "roof"
    row = tbl["rows"][0]
    assert row["roofTypeId"] == "rt1"
    assert row["typeName"] == "Warm Roof"
    assert "materialAssemblyLayers" in row
    assert isinstance(row["materialAssemblyLayers"], int)


def test_roof_schedule_row_includes_pitch_deg_matching_slope_deg() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                name="Flat Roof",
                referenceLevelId="lvl",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 5000, "yMm": 0},
                    {"xMm": 5000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                slopeDeg=15.0,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Roofs",
                filters={"category": "roof"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert "pitchDeg" in row
    assert row["pitchDeg"] == row["slopeDeg"]
    assert "pitchDeg" in tbl["columns"]


def test_roof_schedule_row_always_has_roof_type_id_field() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                name="No Type Roof",
                referenceLevelId="lvl",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Roofs",
                filters={"category": "roof"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert "roofTypeId" in row
    assert row["roofTypeId"] == ""
    assert row["typeName"] == ""


def _door_doc_with_wall_type() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "wt1": WallTypeElem(kind="wall_type", id="wt1", name="Interior Partition 100"),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=100,
                heightMm=2800,
                wallTypeId="wt1",
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={"category": "door"},
            ),
        },
    )


def test_door_schedule_row_includes_host_wall_type_name() -> None:
    doc = _door_doc_with_wall_type()
    tbl = derive_schedule_table(doc, "sch")
    assert tbl["category"] == "door"
    row = tbl["rows"][0]
    assert "hostWallTypeName" in row
    assert row["hostWallTypeName"] == "Interior Partition 100"
    assert "hostWallTypeName" in tbl["columns"]


def test_window_schedule_row_includes_host_wall_type_name() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "wt1": WallTypeElem(kind="wall_type", id="wt1", name="Exterior Masonry 200"),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                wallTypeId="wt1",
            ),
            "win1": WindowElem(
                kind="window",
                id="win1",
                name="Win",
                wallId="w1",
                alongT=0.5,
                widthMm=1200,
                heightMm=1500,
                sillHeightMm=900,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Windows",
                filters={"category": "window"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert "hostWallTypeName" in row
    assert row["hostWallTypeName"] == "Exterior Masonry 200"
    assert "hostWallTypeName" in tbl["columns"]


def test_door_host_wall_type_name_empty_when_no_wall_type() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "w1": WallElem(
                kind="wall",
                id="w1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="w1",
                alongT=0.5,
                widthMm=900,
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Doors",
                filters={"category": "door"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    row = tbl["rows"][0]
    assert row["hostWallTypeName"] == ""


# --- CSV / JSON parity ---


def test_floor_csv_header_matches_json_columns() -> None:
    doc = _floor_doc_with_type()
    tbl = derive_schedule_table(doc, "sch")
    csv_txt = schedule_payload_to_csv(tbl)
    header = next(csv.reader(StringIO(csv_txt)))
    assert header == tbl["columns"]


def test_roof_csv_header_matches_json_columns() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                name="R",
                referenceLevelId="lvl",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 5000},
                    {"xMm": 0, "yMm": 5000},
                ],
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Roofs",
                filters={"category": "roof"},
            ),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    csv_txt = schedule_payload_to_csv(tbl)
    header = next(csv.reader(StringIO(csv_txt)))
    assert header == tbl["columns"]


def test_door_csv_header_matches_json_columns() -> None:
    doc = _door_doc_with_wall_type()
    tbl = derive_schedule_table(doc, "sch")
    csv_txt = schedule_payload_to_csv(tbl)
    header = next(csv.reader(StringIO(csv_txt)))
    assert header == tbl["columns"]


# --- scheduleCsvExportParityEvidence_v1 ---


def _multi_schedule_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "lvl1": LevelElem(kind="level", id="lvl1", name="L1", elevationMm=3000),
            "fl1": FloorElem(
                kind="floor",
                id="fl1",
                name="Slab",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                thicknessMm=200,
            ),
            "rf1": RoofElem(
                kind="roof",
                id="rf1",
                name="Roof",
                referenceLevelId="lvl1",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
            "sch-fl": ScheduleElem(
                kind="schedule",
                id="sch-fl",
                name="Floors",
                filters={"category": "floor"},
            ),
            "sch-rf": ScheduleElem(
                kind="schedule",
                id="sch-rf",
                name="Roofs",
                filters={"category": "roof"},
            ),
        },
    )


def test_schedule_csv_export_parity_evidence_format() -> None:
    doc = _multi_schedule_doc()
    ev = scheduleCsvExportParityEvidence_v1(doc)
    assert ev["format"] == "scheduleCsvExportParityEvidence_v1"
    assert "categories" in ev
    assert "floor" in ev["categories"]
    assert "roof" in ev["categories"]


def test_schedule_csv_export_parity_evidence_row_parity_aligned() -> None:
    doc = _multi_schedule_doc()
    ev = scheduleCsvExportParityEvidence_v1(doc)
    for cat_data in ev["categories"].values():
        assert cat_data["parityAligned"], f"parity mismatch for {cat_data['category']}"
        assert cat_data["csvRowCount"] == cat_data["jsonRowCount"]


def test_schedule_csv_export_parity_evidence_digest_stability() -> None:
    doc = _multi_schedule_doc()
    ev1 = scheduleCsvExportParityEvidence_v1(doc)
    ev2 = scheduleCsvExportParityEvidence_v1(doc)
    for cat in ev1["categories"]:
        d1 = ev1["categories"][cat]["csvContentDigestSha256"]
        d2 = ev2["categories"][cat]["csvContentDigestSha256"]
        assert d1 == d2, f"digest not stable for category {cat}"
        assert len(d1) == 64


def test_schedule_csv_export_parity_evidence_columns_match_derived() -> None:
    doc = _multi_schedule_doc()
    ev = scheduleCsvExportParityEvidence_v1(doc)
    floor_data = ev["categories"]["floor"]
    tbl = derive_schedule_table(doc, "sch-fl")
    assert floor_data["columns"] == tbl["columns"]
    assert floor_data["columnCount"] == len(tbl["columns"])
