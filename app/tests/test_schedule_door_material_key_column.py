"""Door schedule derivation surfaces optional material keys (WP-P01 data-path smoke)."""

from bim_ai.document import Document
from bim_ai.elements import DoorElem, LevelElem, MaterialElem, ScheduleElem, WallElem
from bim_ai.schedule_derivation import derive_schedule_table


def test_door_schedule_includes_material_key_field() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),
            "wa": WallElem(
                kind="wall",
                id="wa",
                name="W",
                levelId="lv",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="wa",
                alongT=0.5,
                widthMm=900,
                materialKey="steel_white",
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Dr", filters={"category": "door"}),
        },
    )

    tbl = derive_schedule_table(doc, "sch")

    rows = tbl.get("rows") or []

    assert len(rows) == 1

    assert rows[0].get("materialKey") == "steel_white"
    assert rows[0].get("materialDisplay") == ""


def test_door_schedule_material_display_builtin_catalog() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),
            "wa": WallElem(
                kind="wall",
                id="wa",
                name="W",
                levelId="lv",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="wa",
                alongT=0.5,
                widthMm=900,
                materialKey="mat-concrete-structure-v1",
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Dr", filters={"category": "door"}),
        },
    )
    tbl = derive_schedule_table(doc, "sch")
    rows = tbl.get("rows") or []
    assert len(rows) == 1
    assert rows[0].get("materialDisplay") == "Concrete structure"


def test_door_schedule_material_contract_fields_from_project_material() -> None:
    doc = Document(
        revision=1,
        elements={
            "lv": LevelElem(kind="level", id="lv", name="L1", elevationMm=0),
            "wa": WallElem(
                kind="wall",
                id="wa",
                name="W",
                levelId="lv",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 5000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "mat-door": MaterialElem(
                kind="material",
                id="mat-door",
                name="Powder coated door",
                appearance={"albedoMapId": "img-door", "uvScaleMm": {"uMm": 500, "vMm": 500}},
                graphics={"surfacePatternId": "solid", "cutPatternId": "steel-cut"},
                physical={"materialClass": "Metal", "densityKgPerM3": 7850},
                thermal={"conductivityWPerMK": 45},
            ),
            "d1": DoorElem(
                kind="door",
                id="d1",
                name="D",
                wallId="wa",
                alongT=0.5,
                widthMm=900,
                materialKey="mat-door",
            ),
            "sch": ScheduleElem(kind="schedule", id="sch", name="Dr", filters={"category": "door"}),
        },
    )

    tbl = derive_schedule_table(doc, "sch")
    row = (tbl.get("rows") or [])[0]

    assert row["materialDisplay"] == "Powder coated door"
    assert row["materialClass"] == "Metal"
    assert row["materialSurfacePattern"] == "solid"
    assert row["materialCutPattern"] == "steel-cut"
    assert row["materialAppearanceStatus"] == "mapped"
    assert row["materialTextureScale"] == "500x500mm"
    assert row["materialDensityKgPerM3"] == 7850
    assert row["materialThermalConductivityWPerMK"] == 45
