from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from bim_ai.constraints_metadata import (
    MATERIAL_CATALOG_AUDIT_MESSAGES,
    MATERIAL_CATALOG_AUDIT_RULE_IDS,
    RULE_BLOCKING_CLASS,
    RULE_DISCIPLINE,
    AdvisorBlockingClass,
)
from bim_ai.constraints_sheet_viewports import (
    SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM,
    SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM,
    SCHEDULE_VIEWPORT_AUTOPLACE_X_MM,
    SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM,
    SHEET_DEFAULT_TITLEBLOCK_SYMBOL,
    SHEET_VIEWPORT_MIN_SIDE_MM,
)


class Violation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rule_id: str = Field(alias="ruleId")
    severity: str
    message: str
    element_ids: list[str] = Field(default_factory=list, alias="elementIds")
    blocking: bool = Field(default=False, alias="blocking")
    quick_fix_command: dict[str, Any] | None = Field(default=None, alias="quickFixCommand")
    discipline: str | None = Field(default=None, alias="discipline")
    blocking_class: str | None = Field(default=None, alias="blockingClass")


_RULE_DISCIPLINE = RULE_DISCIPLINE
_RULE_BLOCKING_CLASS = RULE_BLOCKING_CLASS

_MATERIAL_CATALOG_AUDIT_RULE_IDS = MATERIAL_CATALOG_AUDIT_RULE_IDS
_MATERIAL_CATALOG_AUDIT_MESSAGES = MATERIAL_CATALOG_AUDIT_MESSAGES

_SCHEDULE_VIEWPORT_AUTOPLACE_X_MM = SCHEDULE_VIEWPORT_AUTOPLACE_X_MM
_SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM = SCHEDULE_VIEWPORT_AUTOPLACE_Y_MM
_SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM = SCHEDULE_VIEWPORT_AUTOPLACE_WIDTH_MM
_SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM = SCHEDULE_VIEWPORT_AUTOPLACE_HEIGHT_MM
_SHEET_VIEWPORT_MIN_SIDE_MM = SHEET_VIEWPORT_MIN_SIDE_MM
_SHEET_DEFAULT_TITLEBLOCK_SYMBOL = SHEET_DEFAULT_TITLEBLOCK_SYMBOL


def annotate_violation_disciplines(violations: list[Violation]) -> list[Violation]:
    out: list[Violation] = []
    for v in violations:
        d = _RULE_DISCIPLINE.get(v.rule_id, "architecture")
        out.append(v.model_copy(update={"discipline": d}))
    return out


def annotate_violation_blocking_classes(violations: list[Violation]) -> list[Violation]:
    out: list[Violation] = []
    for v in violations:
        bc = _RULE_BLOCKING_CLASS.get(v.rule_id, AdvisorBlockingClass.documentation.value)
        out.append(v.model_copy(update={"blocking_class": bc}))
    return out
