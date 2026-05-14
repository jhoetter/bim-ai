from __future__ import annotations

from bim_ai.commands import UpdateElementPropertyCmd
from bim_ai.constructability_advisories import constructability_advisory_violations
from bim_ai.document import Document
from bim_ai.elements import ColumnElem, WallElem
from bim_ai.engine import apply_inplace
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.structure_lens import structure_analysis_export


def _structure_doc() -> Document:
    return Document.model_validate(
        {
            "revision": 1,
            "elements": {
                "lvl-1": {
                    "kind": "level",
                    "id": "lvl-1",
                    "name": "Ground",
                    "elevationMm": 0,
                },
                "grid-a": {
                    "kind": "grid_line",
                    "id": "grid-a",
                    "name": "Grid A",
                    "label": "A",
                    "start": {"xMm": 0, "yMm": -1000},
                    "end": {"xMm": 0, "yMm": 5000},
                    "levelId": "lvl-1",
                },
                "wall-1": {
                    "kind": "wall",
                    "id": "wall-1",
                    "name": "Bearing wall",
                    "levelId": "lvl-1",
                    "start": {"xMm": 0, "yMm": 0},
                    "end": {"xMm": 5000, "yMm": 0},
                    "wallTypeId": "wt-struct",
                    "loadBearing": True,
                    "structuralRole": "bearing_wall",
                    "structuralMaterial": "masonry",
                    "analysisStatus": "needs_review",
                    "fireResistanceRating": "REI 90",
                },
                "door-1": {
                    "kind": "door",
                    "id": "door-1",
                    "name": "Opening in bearing wall",
                    "wallId": "wall-1",
                    "alongT": 0.5,
                    "widthMm": 1200,
                },
                "floor-1": {
                    "kind": "floor",
                    "id": "floor-1",
                    "name": "Structural slab",
                    "levelId": "lvl-1",
                    "boundaryMm": [
                        {"xMm": 0, "yMm": 0},
                        {"xMm": 5000, "yMm": 0},
                        {"xMm": 5000, "yMm": 4000},
                        {"xMm": 0, "yMm": 4000},
                    ],
                    "floorTypeId": "ft-slab",
                    "loadBearing": True,
                    "structuralRole": "slab",
                    "structuralMaterial": "concrete",
                    "analysisStatus": "ready_for_export",
                },
                "footing-1": {
                    "kind": "floor",
                    "id": "footing-1",
                    "name": "Strip footing",
                    "levelId": "lvl-1",
                    "boundaryMm": [
                        {"xMm": -250, "yMm": -250},
                        {"xMm": 5250, "yMm": -250},
                        {"xMm": 5250, "yMm": 250},
                        {"xMm": -250, "yMm": 250},
                    ],
                    "floorTypeId": "ft-footing",
                    "loadBearing": True,
                    "structuralRole": "foundation",
                    "structuralMaterial": "concrete",
                },
                "col-1": {
                    "kind": "column",
                    "id": "col-1",
                    "name": "C1",
                    "levelId": "lvl-1",
                    "positionMm": {"xMm": 0, "yMm": 0},
                    "bMm": 300,
                    "hMm": 300,
                    "heightMm": 3000,
                    "structuralMaterial": "steel",
                    "analysisStatus": "ready_for_export",
                },
                "beam-1": {
                    "kind": "beam",
                    "id": "beam-1",
                    "name": "B1",
                    "levelId": "lvl-1",
                    "startMm": {"xMm": 0, "yMm": 0},
                    "endMm": {"xMm": 5000, "yMm": 0},
                    "widthMm": 250,
                    "heightMm": 500,
                    "structuralMaterial": "steel",
                    "analysisStatus": "ready_for_export",
                },
                "sch-structure": {
                    "kind": "schedule",
                    "id": "sch-structure",
                    "name": "Structural elements",
                    "category": "structural_element",
                },
                "sch-openings": {
                    "kind": "schedule",
                    "id": "sch-openings",
                    "name": "Openings in load-bearing walls",
                    "category": "opening_load_bearing_wall",
                },
            },
        }
    )


def test_structure_schedule_rows_classify_structural_elements() -> None:
    doc = _structure_doc()

    table = derive_schedule_table(doc, "sch-structure")
    ids = {row["elementId"] for row in table["rows"]}

    assert {"wall-1", "floor-1", "footing-1", "col-1", "beam-1"}.issubset(ids)
    assert "structuralRole" in table["columns"]
    assert table["columnMetadata"]["fields"]["structuralMaterial"]["label"] == (
        "Structural material"
    )
    assert table["totals"]["rowCount"] == table["totalRows"]
    assert table["totals"]["needsReviewCount"] == 1


def test_structure_opening_schedule_flags_bearing_wall_review() -> None:
    doc = _structure_doc()

    table = derive_schedule_table(doc, "sch-openings")

    assert table["rows"] == [
        {
            "elementId": "door-1",
            "name": "Opening in bearing wall",
            "category": "door",
            "wallId": "wall-1",
            "wallName": "Bearing wall",
            "levelId": "lvl-1",
            "level": "Ground",
            "openingWidthMm": 1200.0,
            "hostLoadBearing": "true",
            "reviewStatus": "needs_review",
        }
    ]


def test_structure_analysis_export_is_handoff_not_calculation_engine() -> None:
    doc = _structure_doc()

    payload = structure_analysis_export(doc)

    assert payload["format"] == "structureAnalysisExport_v1"
    assert payload["calculationEngine"] is False
    assert payload["elementCount"] == len(payload["elements"])
    assert payload["grids"] == [
        {
            "id": "grid-a",
            "label": "A",
            "startMm": {"xMm": 0.0, "yMm": -1000.0},
            "endMm": {"xMm": 0.0, "yMm": 5000.0},
            "levelId": "lvl-1",
        }
    ]
    assert payload["levels"] == [{"id": "lvl-1", "name": "Ground", "elevationMm": 0.0}]
    wall_export = next(e for e in payload["elements"] if e["elementId"] == "wall-1")
    assert wall_export["geometry"]["kind"] == "wall_axis"
    assert wall_export["structuralRole"] == "bearing_wall"


def test_structural_fields_roundtrip_on_wall_and_column() -> None:
    wall = WallElem.model_validate(
        {
            "kind": "wall",
            "id": "wall-roundtrip",
            "name": "Wall",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0},
            "end": {"xMm": 1000, "yMm": 0},
            "loadBearing": True,
            "structuralRole": "shear_wall",
            "structuralMaterial": "concrete",
            "analysisStatus": "ready_for_export",
            "fireResistanceRating": "REI 120",
        }
    )
    column = ColumnElem.model_validate(
        {
            "kind": "column",
            "id": "column-roundtrip",
            "name": "Column",
            "levelId": "lvl-1",
            "positionMm": {"xMm": 0, "yMm": 0},
            "structuralMaterial": "steel",
            "analysisStatus": "ready_for_export",
            "fireResistanceRating": "R 90",
        }
    )

    assert wall.model_dump(by_alias=True)["structuralMaterial"] == "concrete"
    exported_column = column.model_dump(by_alias=True)
    assert exported_column["loadBearing"] is True
    assert exported_column["structuralRole"] == "column"
    assert exported_column["structuralMaterial"] == "steel"
    assert exported_column["analysisStatus"] == "ready_for_export"


def test_structure_authoring_commands_update_structural_intent() -> None:
    doc = _structure_doc()

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="floor-1", key="structuralRole", value="foundation"),
    )
    assert doc.elements["floor-1"].structural_role == "foundation"

    apply_inplace(
        doc,
        UpdateElementPropertyCmd(elementId="floor-1", key="loadBearing", value=True),
    )
    assert doc.elements["floor-1"].load_bearing is True



def test_constructability_flags_inconsistent_structural_material_by_type() -> None:
    doc = Document.model_validate(
        {
            "revision": 1,
            "elements": {
                "wall-a": {
                    "kind": "wall",
                    "id": "wall-a",
                    "name": "Wall A",
                    "levelId": "lvl-1",
                    "start": {"xMm": 0, "yMm": 0},
                    "end": {"xMm": 3000, "yMm": 0},
                    "wallTypeId": "wt-bearing",
                    "loadBearing": True,
                    "structuralRole": "bearing_wall",
                    "structuralMaterial": "concrete",
                },
                "wall-b": {
                    "kind": "wall",
                    "id": "wall-b",
                    "name": "Wall B",
                    "levelId": "lvl-1",
                    "start": {"xMm": 0, "yMm": 1000},
                    "end": {"xMm": 3000, "yMm": 1000},
                    "wallTypeId": "wt-bearing",
                    "loadBearing": True,
                    "structuralRole": "bearing_wall",
                    "structuralMaterial": "masonry",
                },
            },
        }
    )

    rule_ids = {v.rule_id for v in constructability_advisory_violations(doc.elements)}

    assert "structural_material_inconsistent_by_type" in rule_ids


def test_constructability_flags_repeated_structural_bays_without_grids() -> None:
    doc = Document.model_validate(
        {
            "revision": 1,
            "elements": {
                f"col-{index}": {
                    "kind": "column",
                    "id": f"col-{index}",
                    "name": f"C{index}",
                    "levelId": "lvl-1",
                    "positionMm": {
                        "xMm": (index % 2) * 4000,
                        "yMm": (index // 2) * 4000,
                    },
                    "bMm": 300,
                    "hMm": 300,
                    "heightMm": 3000,
                }
                for index in range(4)
            },
        }
    )

    rule_ids = {v.rule_id for v in constructability_advisory_violations(doc.elements)}

    assert "structural_bays_missing_grids" in rule_ids
