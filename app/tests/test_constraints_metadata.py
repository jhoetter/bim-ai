from __future__ import annotations

from bim_ai.constraints import (
    _MATERIAL_CATALOG_AUDIT_MESSAGES,
    _MATERIAL_CATALOG_AUDIT_RULE_IDS,
    _RULE_BLOCKING_CLASS,
    _RULE_DISCIPLINE,
    AdvisorBlockingClass,
)
from bim_ai.constraints_metadata import (
    MATERIAL_CATALOG_AUDIT_MESSAGES,
    MATERIAL_CATALOG_AUDIT_RULE_IDS,
    RULE_BLOCKING_CLASS,
    RULE_DISCIPLINE,
)


def test_constraints_metadata_preserves_legacy_exports() -> None:
    assert _RULE_DISCIPLINE is RULE_DISCIPLINE
    assert _RULE_BLOCKING_CLASS is RULE_BLOCKING_CLASS
    assert _MATERIAL_CATALOG_AUDIT_RULE_IDS is MATERIAL_CATALOG_AUDIT_RULE_IDS
    assert _MATERIAL_CATALOG_AUDIT_MESSAGES is MATERIAL_CATALOG_AUDIT_MESSAGES
    assert {cls.value for cls in AdvisorBlockingClass} == {
        "geometry",
        "exchange",
        "documentation",
        "schedule",
        "sheet",
        "evidence",
    }


def test_constraints_metadata_contains_representative_rule_mappings() -> None:
    assert RULE_DISCIPLINE["wall_overlap"] == "coordination"
    assert RULE_DISCIPLINE["exchange_ifc_qto_stair_gap"] == "exchange"
    assert RULE_BLOCKING_CLASS["door_off_wall"] == "geometry"
    assert RULE_BLOCKING_CLASS["schedule_sheet_viewport_missing"] == "schedule"
    assert RULE_BLOCKING_CLASS["section_on_sheet_cut_line_missing"] == "sheet"
    assert (
        MATERIAL_CATALOG_AUDIT_RULE_IDS["missing_material"] == "material_catalog_missing_material"
    )
    assert "catalog materialKey" in MATERIAL_CATALOG_AUDIT_MESSAGES["missing_material"]
