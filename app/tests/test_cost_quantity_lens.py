from __future__ import annotations

from bim_ai.cost_quantity import (
    derive_cost_estimate_rows,
    derive_quantity_takeoff_rows,
    derive_scenario_delta_rows,
)
from bim_ai.document import Document
from bim_ai.elements import DoorElem, FloorElem, LevelElem, ScheduleElem, Vec2Mm, WallElem
from bim_ai.schedule_derivation import derive_schedule_table


def _rect_points(size_mm: float) -> list[Vec2Mm]:
    return [
        Vec2Mm(xMm=0, yMm=0),
        Vec2Mm(xMm=size_mm, yMm=0),
        Vec2Mm(xMm=size_mm, yMm=size_mm),
        Vec2Mm(xMm=0, yMm=size_mm),
    ]


def test_quantity_takeoff_wall_tracks_openings_and_cost_props() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                name="Cost wall",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                heightMm=3000,
                thicknessMm=200,
                wallTypeId="wt-200",
                props={
                    "cost": {
                        "costGroup": "300",
                        "workPackage": "Shell",
                        "trade": "Masonry",
                        "unit": "m2",
                        "unitRate": 120,
                        "source": "Estimator A 2026-05-14",
                    }
                },
            ),
            "door-1": DoorElem(
                kind="door",
                id="door-1",
                name="Door",
                wallId="wall-1",
                alongT=0.5,
                widthMm=1000,
            ),
        },
    )

    rows = derive_quantity_takeoff_rows(doc)
    wall_row = next(row for row in rows if row["elementId"] == "wall-1")

    assert wall_row["typeId"] == "wt-200"
    assert wall_row["lengthM"] == 5
    assert wall_row["grossAreaM2"] == 15
    assert wall_row["netAreaM2"] == 12
    assert wall_row["openingCount"] == 1
    assert wall_row["costGroup"] == "300"
    assert wall_row["traceability"] == "model_element"


def test_cost_estimate_requires_source_before_totaling_unit_rate() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "floor-1": FloorElem(
                kind="floor",
                id="floor-1",
                name="Screed",
                levelId="lvl",
                boundaryMm=[p.model_dump(by_alias=True) for p in _rect_points(2000)],
                thicknessMm=100,
                props={
                    "cost": {
                        "costGroup": "325",
                        "workPackage": "Finishes",
                        "unit": "m2",
                        "unitRate": 40,
                    }
                },
            ),
        },
    )

    row = derive_cost_estimate_rows(doc)[0]

    assert row["quantity"] == 4
    assert row["unitRate"] == 40
    assert row["totalCost"] == ""
    assert row["costDataStatus"] == "rate_missing_source"


def test_cost_schedule_exposes_snapshot_totals_and_traceable_rows() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "floor-1": FloorElem(
                kind="floor",
                id="floor-1",
                name="Floor",
                levelId="lvl",
                boundaryMm=[p.model_dump(by_alias=True) for p in _rect_points(2000)],
                thicknessMm=100,
                props={
                    "cost": {
                        "costGroup": "320",
                        "workPackage": "Slabs",
                        "trade": "Concrete",
                        "unit": "m2",
                        "unitRate": 55,
                        "source": "QS library 2026",
                    }
                },
            ),
            "sch": ScheduleElem(
                kind="schedule",
                id="sch",
                name="Cost estimate",
                filters={"category": "cost_estimate"},
            ),
        },
    )

    table = derive_schedule_table(doc, "sch")

    assert table["category"] == "cost_estimate"
    assert table["scheduleEngine"]["lensId"] == "cost-quantity"
    assert table["scheduleEngine"]["snapshotKind"] == "exportable_cost_snapshot"
    assert table["rows"][0]["elementId"] == "floor-1"
    assert table["rows"][0]["totalCost"] == 220
    assert table["totals"]["totalCost"] == 220
    assert "costSource" in table["columns"]


def test_scenario_delta_groups_by_package_and_uses_baseline_cost() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="EG", elevationMm=0),
            "base": FloorElem(
                kind="floor",
                id="base",
                name="Existing slab",
                levelId="lvl",
                boundaryMm=[p.model_dump(by_alias=True) for p in _rect_points(1000)],
                thicknessMm=100,
                props={
                    "cost": {
                        "scenarioId": "as-is",
                        "costGroup": "320",
                        "workPackage": "Slabs",
                        "unit": "m2",
                        "unitRate": 50,
                        "source": "baseline",
                    }
                },
            ),
            "renovation": FloorElem(
                kind="floor",
                id="renovation",
                name="Renovated slab",
                levelId="lvl",
                boundaryMm=[p.model_dump(by_alias=True) for p in _rect_points(2000)],
                thicknessMm=100,
                props={
                    "cost": {
                        "scenarioId": "renovation-a",
                        "costGroup": "320",
                        "workPackage": "Slabs",
                        "unit": "m2",
                        "unitRate": 60,
                        "source": "scenario",
                    }
                },
            ),
        },
    )

    rows = derive_scenario_delta_rows(doc)
    renovation = next(row for row in rows if row["scenarioId"] == "renovation-a")

    assert renovation["scenarioCost"] == 240
    assert renovation["baselineCost"] == 50
    assert renovation["deltaCost"] == 190
    assert renovation["sourceElementIds"] == "renovation"

