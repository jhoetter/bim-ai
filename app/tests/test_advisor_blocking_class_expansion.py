"""Tests for advisor blocking class expansion (WP-V01 wave-4 prompt-7)."""

from __future__ import annotations

from bim_ai.constraints import (
    _RULE_BLOCKING_CLASS,
    _RULE_DISCIPLINE,
    AdvisorBlockingClass,
    advisorBlockingClassSummary_v1,
    evaluate,
    fix_schedule_sheet_placement,
    fix_sheet_viewport_refresh,
)
from bim_ai.document import Document
from bim_ai.elements import LevelElem, ScheduleElem, SheetElem


def test_all_existing_rules_have_blocking_class() -> None:
    for rule_id in _RULE_DISCIPLINE:
        assert rule_id in _RULE_BLOCKING_CLASS, (
            f"Rule {rule_id!r} is in _RULE_DISCIPLINE but has no entry in _RULE_BLOCKING_CLASS"
        )


def test_advisor_blocking_class_enum_values() -> None:
    expected = {"geometry", "exchange", "documentation", "schedule", "sheet", "evidence"}
    assert {c.value for c in AdvisorBlockingClass} == expected


def _doc_with_unplaced_schedule() -> Document:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms", sheetId="")
    return Document(revision=0, elements={"lvl-1": lvl, "sch-1": sch})  # type: ignore[arg-type]


def _doc_with_unplaced_schedule_and_sheet() -> Document:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms", sheetId="")
    sh = SheetElem(kind="sheet", id="sh-1", name="S1", viewportsMm=[])
    return Document(  # type: ignore[arg-type]
        revision=0, elements={"lvl-1": lvl, "sch-1": sch, "sh-1": sh}
    )


def test_schedule_not_placed_on_sheet_fires() -> None:
    doc = _doc_with_unplaced_schedule()
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    rule_ids = [v.rule_id for v in viols]
    assert "schedule_not_placed_on_sheet" in rule_ids


def test_schedule_not_placed_on_sheet_absent_when_placed() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sh = SheetElem(
        kind="sheet",
        id="sh-1",
        name="S1",
        viewportsMm=[
            {
                "viewportId": "vp-sch-1",
                "viewRef": "schedule:sch-1",
                "xMm": 10,
                "yMm": 10,
                "widthMm": 100,
                "heightMm": 80,
            }
        ],
    )
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms", sheetId="sh-1")
    doc = Document(revision=0, elements={"lvl-1": lvl, "sh-1": sh, "sch-1": sch})  # type: ignore[arg-type]
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    assert not any(v.rule_id == "schedule_not_placed_on_sheet" for v in viols)


def test_fix_schedule_sheet_placement_applied_for_unplaced() -> None:
    doc = _doc_with_unplaced_schedule_and_sheet()
    result = fix_schedule_sheet_placement(doc)
    assert result["applied"] is True
    assert result["skipped"] is False


def test_fix_schedule_sheet_placement_skipped_no_sheets() -> None:
    doc = _doc_with_unplaced_schedule()
    result = fix_schedule_sheet_placement(doc)
    assert result["applied"] is False
    assert result["skipped"] is True
    assert result["reason"] == "no_sheets_available"


def test_fix_schedule_sheet_placement_skipped_already_placed() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="G", elevationMm=0)
    sh = SheetElem(kind="sheet", id="sh-1", name="S1", viewportsMm=[])
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms", sheetId="sh-1")
    doc = Document(revision=0, elements={"lvl-1": lvl, "sh-1": sh, "sch-1": sch})  # type: ignore[arg-type]
    result = fix_schedule_sheet_placement(doc)
    assert result["applied"] is False
    assert result["skipped"] is True
    assert result["reason"] == "no_unplaced_schedules"


def test_schedule_not_placed_on_sheet_has_quick_fix_when_sheet_exists() -> None:
    doc = _doc_with_unplaced_schedule_and_sheet()
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    v = next(x for x in viols if x.rule_id == "schedule_not_placed_on_sheet")
    assert v.quick_fix_command is not None
    assert v.quick_fix_command["type"] == "upsertSheetViewports"


def test_fix_sheet_viewport_refresh_skipped_when_no_stale() -> None:
    doc = _doc_with_unplaced_schedule_and_sheet()
    result = fix_sheet_viewport_refresh(doc)
    assert result["skipped"] is True
    assert result["reason"] == "no_stale_viewports"


def test_advisor_blocking_class_summary_v1_format() -> None:
    doc = _doc_with_unplaced_schedule()
    summary = advisorBlockingClassSummary_v1(doc)
    assert summary["format"] == "advisorBlockingClassSummary_v1"
    assert "perClass" in summary
    for cls in AdvisorBlockingClass:
        assert cls.value in summary["perClass"]
        assert "error" in summary["perClass"][cls.value]
        assert "warning" in summary["perClass"][cls.value]
        assert "info" in summary["perClass"][cls.value]


def test_advisor_blocking_class_summary_counts_schedule_violations() -> None:
    doc = _doc_with_unplaced_schedule()
    summary = advisorBlockingClassSummary_v1(doc)
    # schedule_not_placed_on_sheet is warning, blocking class = schedule
    assert summary["perClass"]["schedule"]["warning"] >= 1


def test_prd_matrix_includes_new_rules() -> None:
    from bim_ai.prd_blocking_advisor_matrix import build_prd_blocking_advisor_matrix

    matrix = build_prd_blocking_advisor_matrix()
    assert matrix.get("validationErrors") == []
    all_rules: set[str] = set()
    for row in matrix["rows"]:
        all_rules.update(row.get("requiredRuleIds", []))
    for rule in (
        "schedule_not_placed_on_sheet",
        "sheet_viewport_schedule_stale",
        "schedule_field_registry_gap",
    ):
        assert rule in all_rules, f"New rule {rule!r} not found in PRD matrix"


def test_schedule_not_placed_on_sheet_blocking_class_is_schedule() -> None:
    assert _RULE_BLOCKING_CLASS.get("schedule_not_placed_on_sheet") == "schedule"
    assert _RULE_BLOCKING_CLASS.get("sheet_viewport_schedule_stale") == "schedule"
    assert _RULE_BLOCKING_CLASS.get("schedule_field_registry_gap") == "schedule"


def test_violation_has_blocking_class_field() -> None:
    doc = _doc_with_unplaced_schedule()
    viols = evaluate(doc.elements)  # type: ignore[arg-type]
    for v in viols:
        assert v.blocking_class is not None, f"Violation {v.rule_id!r} has no blocking_class"
