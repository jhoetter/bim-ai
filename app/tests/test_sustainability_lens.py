from __future__ import annotations

from bim_ai.document import DesignOption, DesignOptionSet, Document
from bim_ai.elements import (
    CircularityProperties,
    FloorElem,
    LevelElem,
    MaterialElem,
    MaterialImpactProperties,
    ScheduleElem,
    Vec2Mm,
    WallElem,
    WallTypeElem,
    WallTypeLayer,
)
from bim_ai.schedule_derivation import derive_schedule_table
from bim_ai.sustainability_lca import sustainability_lca_export_v1, sustainability_lens_manifest_v1


def _doc() -> Document:
    return Document(
        revision=1,
        designOptionSets=[
            DesignOptionSet(
                id="opt-set",
                name="Envelope scenarios",
                options=[
                    DesignOption(id="base", name="Baseline", isPrimary=True),
                    DesignOption(id="alt", name="Low carbon"),
                ],
            )
        ],
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "mat-conc": MaterialElem(
                kind="material",
                id="mat-conc",
                name="Concrete EPD",
                source="project",
                physical={"densityKgPerM3": 2400},
                sustainability=MaterialImpactProperties(
                    epdReference="EPD-CONC-001",
                    epdSourceUrl="https://example.test/epd/concrete",
                    gwpPerUnit=300,
                    gwpUnit="kgco2e_per_m3",
                    dataQualityLevel="verified_epd",
                    recycledContentPercent=20,
                    serviceLifeYears=60,
                    endOfLifeScenario="recycling",
                ),
                circularity=CircularityProperties(
                    demountability="low",
                    recyclability="medium",
                    hazardousMaterialWarning="chromate review required",
                ),
            ),
            "mat-gwb": MaterialElem(
                kind="material",
                id="mat-gwb",
                name="GWB missing EPD",
                source="project",
            ),
            "wt": WallTypeElem(
                kind="wall_type",
                id="wt",
                name="Two layer wall",
                layers=[
                    WallTypeLayer(
                        thicknessMm=100,
                        function="structure",
                        materialKey="mat-conc",
                    ),
                    WallTypeLayer(thicknessMm=50, function="finish", materialKey="mat-gwb"),
                ],
            ),
            "w-base": WallElem(
                kind="wall",
                id="w-base",
                name="Baseline wall",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=150,
                heightMm=3000,
                wallTypeId="wt",
                optionSetId="opt-set",
                optionId="base",
                circularity=CircularityProperties(
                    reusedComponent=True,
                    demountability="high",
                    recyclability="medium",
                    materialPassportNotes="salvaged frame",
                ),
            ),
            "w-alt": WallElem(
                kind="wall",
                id="w-alt",
                name="Alt wall",
                levelId="lvl",
                start=Vec2Mm(x_mm=0, y_mm=4000),
                end=Vec2Mm(x_mm=1000, y_mm=4000),
                thicknessMm=150,
                heightMm=3000,
                wallTypeId="wt",
                optionSetId="opt-set",
                optionId="alt",
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="Slab",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 1000},
                    {"xMm": 0, "yMm": 1000},
                ],
                thicknessMm=100,
                floorTypeId=None,
                optionSetId="opt-set",
                optionId="base",
            ),
            "sch-assembly": ScheduleElem(
                kind="schedule",
                id="sch-assembly",
                name="Assembly carbon schedule",
                filters={"category": "assembly_carbon"},
            ),
            "sch-material": ScheduleElem(
                kind="schedule",
                id="sch-material",
                name="Material impact schedule",
                filters={"category": "material_impact"},
            ),
            "sch-element": ScheduleElem(
                kind="schedule",
                id="sch-element",
                name="Element carbon schedule",
                filters={"category": "element_carbon"},
            ),
            "sch-circ": ScheduleElem(
                kind="schedule",
                id="sch-circ",
                name="Reuse/circularity schedule",
                filters={"category": "circularity"},
            ),
            "sch-missing": ScheduleElem(
                kind="schedule",
                id="sch-missing",
                name="Missing EPD/data-quality report",
                filters={"category": "missing_sustainability_data"},
            ),
            "sch-scenario": ScheduleElem(
                kind="schedule",
                id="sch-scenario",
                name="Scenario impact comparison",
                filters={"category": "scenario_impact_comparison"},
            ),
        },
    )


def test_assembly_carbon_schedule_is_source_backed_and_traceable() -> None:
    table = derive_schedule_table(_doc(), "sch-assembly")
    assert table["category"] == "assembly_carbon"
    rows = table["rows"]

    concrete = next(r for r in rows if r["hostElementId"] == "w-base" and r["layerIndex"] == 0)
    assert concrete["epdReference"] == "EPD-CONC-001"
    assert concrete["epdSourceUrl"] == "https://example.test/epd/concrete"
    assert concrete["impactStatus"] == "calculated"
    assert concrete["embodiedCarbonKgCO2e"] == 270.0
    assert concrete["embodiedCarbonIntensityKgCO2ePerM2"] == 30.0
    assert len(concrete["assemblyMaterialKeysDigest"]) == 64

    missing = next(r for r in rows if r["hostElementId"] == "w-base" and r["layerIndex"] == 1)
    assert missing["materialKey"] == "mat-gwb"
    assert missing["impactStatus"] == "missing_impact_data"


def test_material_element_and_missing_data_schedules_aggregate_impact() -> None:
    doc = _doc()
    material_table = derive_schedule_table(doc, "sch-material")
    concrete = next(r for r in material_table["rows"] if r["materialKey"] == "mat-conc")
    assert concrete["hostCount"] == 2
    assert concrete["embodiedCarbonKgCO2e"] == 360.0
    assert concrete["dataQualityLevel"] == "verified_epd"

    element_table = derive_schedule_table(doc, "sch-element")
    baseline = next(r for r in element_table["rows"] if r["elementId"] == "w-base")
    assert baseline["impactStatus"] == "incomplete"
    assert baseline["embodiedCarbonKgCO2e"] == 270.0

    missing_table = derive_schedule_table(doc, "sch-missing")
    assert {r["impactStatus"] for r in missing_table["rows"]} >= {
        "missing_impact_data",
        "missing_material",
    }


def test_circularity_and_scenario_schedules_cover_passport_and_delta() -> None:
    doc = _doc()
    circularity = derive_schedule_table(doc, "sch-circ")["rows"]
    baseline = next(r for r in circularity if r["elementId"] == "w-base")
    assert baseline["reusedComponent"] is True
    assert baseline["demountability"] == "high"
    assert "salvaged frame" in baseline["materialPassportNotes"]
    assert "chromate review" in baseline["hazardousMaterialWarning"]

    scenario = derive_schedule_table(doc, "sch-scenario")["rows"]
    base = next(r for r in scenario if r["optionId"] == "base")
    alt = next(r for r in scenario if r["optionId"] == "alt")
    assert base["isBaseline"] is True
    assert base["embodiedCarbonKgCO2e"] == 270.0
    assert alt["embodiedCarbonKgCO2e"] == 90.0
    assert alt["scenarioDeltaKgCO2e"] == -180.0


def test_sustainability_lens_manifest_and_export_contract() -> None:
    doc = _doc()
    manifest = sustainability_lens_manifest_v1(doc)
    assert manifest["lensId"] == "sustainability"
    assert {s["category"] for s in manifest["schedules"]} >= {
        "material_impact",
        "element_carbon",
        "assembly_carbon",
        "circularity",
        "scenario_impact_comparison",
        "missing_sustainability_data",
    }
    assert manifest["apiContract"]["epdReferences"] is True
    assert manifest["summary"]["embodiedCarbonKgCO2e"] == 360.0

    export = sustainability_lca_export_v1(doc)
    assert export["format"] == "sustainabilityLcaExport_v1"
    assert export["elementCarbonRows"]
    assert export["scenarioImpactComparisonRows"]
