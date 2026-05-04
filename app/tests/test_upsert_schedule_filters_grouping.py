"""upsertScheduleFilters merges filters and optional grouping."""

from bim_ai.commands import UpsertScheduleFiltersCmd
from bim_ai.document import Document
from bim_ai.elements import ScheduleElem
from bim_ai.engine import apply_inplace


def test_upsert_schedule_filters_merges_grouping() -> None:
    doc = Document(
        revision=1,
        elements={
            "sch-1": ScheduleElem(
                kind="schedule",
                id="sch-1",
                name="Doors",
                filters={"category": "door", "groupingHint": ["levelId"]},
                grouping={"sortBy": "name"},
            ),
        },
    )
    apply_inplace(
        doc,
        UpsertScheduleFiltersCmd(
            scheduleId="sch-1",
            filters={"sortBy": "widthMm", "groupingHint": ["familyTypeId"]},
            grouping={"sortBy": "widthMm"},
        ),
    )
    sch = doc.elements["sch-1"]
    assert isinstance(sch, ScheduleElem)
    assert sch.filters["category"] == "door"
    assert sch.filters["sortBy"] == "widthMm"
    assert sch.filters["groupingHint"] == ["familyTypeId"]
    assert sch.grouping.get("sortBy") == "widthMm"
