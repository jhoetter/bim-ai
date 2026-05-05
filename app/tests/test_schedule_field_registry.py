from __future__ import annotations

from bim_ai.schedule_field_registry import stable_column_keys


def test_stable_column_orders_known_fields_then_extras():
    cols = stable_column_keys(
        "room",
        {"perimeterM", "name", "areaM2", "extraBizField", "elementId"},
    )
    assert cols[0] == "elementId"
    assert "extraBizField" in cols
    assert cols[-1] == "extraBizField"


def test_stable_column_orders_door_host_and_rough_opening_fields():
    observed = {
        "elementId",
        "wallId",
        "hostWallTypeId",
        "hostWallTypeDisplay",
        "roughOpeningWidthMm",
        "roughOpeningHeightMm",
        "widthMm",
    }
    cols = stable_column_keys("door", observed)
    assert cols.index("wallId") < cols.index("hostWallTypeId")
    assert cols.index("hostWallTypeDisplay") < cols.index("widthMm")
    assert cols.index("widthMm") < cols.index("roughOpeningWidthMm")
    assert cols.index("roughOpeningWidthMm") < cols.index("roughOpeningHeightMm")
