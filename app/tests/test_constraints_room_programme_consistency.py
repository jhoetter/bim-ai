"""Room programme workflow: mixed blank vs authored programmes on a level."""

from bim_ai.constraints import evaluate
from bim_ai.elements import LevelElem, RoomElem, Vec2Mm


def _square(outline_mm: tuple[tuple[float, float], ...]) -> list[Vec2Mm]:
    return [Vec2Mm(x_mm=a, y_mm=b) for a, b in outline_mm]


def test_room_programme_inconsistent_within_level_warns_blank_peer() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
        "rm-a": RoomElem(
            kind="room",
            id="rm-a",
            name="A",
            level_id="lv",
            outline_mm=_square(((0.0, 0.0), (3000.0, 0.0), (3000.0, 2000.0), (0.0, 2000.0))),
            programme_code="A1",
            department=None,
            function_label=None,
            finish_set=None,
        ),
        "rm-b": RoomElem(
            kind="room",
            id="rm-b",
            name="B",
            level_id="lv",
            outline_mm=_square(((3100.0, 0.0), (5000.0, 0.0), (5000.0, 2000.0), (3100.0, 2000.0))),
        ),
    }
    vs = evaluate(els)

    ours = [v for v in vs if getattr(v, "rule_id", None) == "room_programme_inconsistent_within_level"]
    assert len(ours) == 1

    ids = getattr(ours[0], "element_ids", []) or []
    assert "rm-b" in ids

