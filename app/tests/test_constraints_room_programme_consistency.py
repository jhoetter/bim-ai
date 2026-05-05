"""Room programme workflow: mixed blank vs authored programmes on a level."""

from bim_ai.constraints import evaluate
from bim_ai.elements import LevelElem, RoomElem, RoomSeparationElem, Vec2Mm, WallElem


def _square(outline_mm: tuple[tuple[float, float], ...]) -> list[Vec2Mm]:
    return [Vec2Mm(x_mm=a, y_mm=b) for a, b in outline_mm]


def test_room_outline_spans_axis_room_separation_info() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
        "sep-1": RoomSeparationElem(
            kind="room_separation",
            id="sep-1",
            name="Sep",
            level_id="lv",
            start={"xMm": 2000.0, "yMm": 500.0},
            end={"xMm": 2000.0, "yMm": 3500.0},
        ),
        "rm-a": RoomElem(
            kind="room",
            id="rm-a",
            name="A",
            level_id="lv",
            outline_mm=_square(((0.0, 0.0), (4000.0, 0.0), (4000.0, 4000.0), (0.0, 4000.0))),
            programme_code="A1",
            department=None,
            function_label=None,
            finish_set=None,
        ),
    }
    vs = evaluate(els)
    ours = [
        v for v in vs if getattr(v, "rule_id", None) == "room_outline_spans_axis_room_separation"
    ]
    assert len(ours) == 1
    assert set(getattr(ours[0], "element_ids", []) or []) == {"rm-a", "sep-1"}


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

    ours = [
        v for v in vs if getattr(v, "rule_id", None) == "room_programme_inconsistent_within_level"
    ]
    assert len(ours) == 1

    ids = getattr(ours[0], "element_ids", []) or []
    assert "rm-b" in ids
    qf = getattr(ours[0], "quick_fix_command", None)
    assert isinstance(qf, dict)
    assert qf.get("type") == "updateElementProperty"
    assert qf.get("elementId") == "rm-b"
    assert qf.get("key") == "programmeCode"
    assert qf.get("value") == "A1"


def test_room_programme_inconsistent_skips_quick_fix_when_peer_has_department_only() -> None:
    els = {
        "lv": LevelElem(kind="level", id="lv", name="L1", elevation_mm=0),
        "rm-a": RoomElem(
            kind="room",
            id="rm-a",
            name="A",
            level_id="lv",
            outline_mm=_square(((0.0, 0.0), (3000.0, 0.0), (3000.0, 2000.0), (0.0, 2000.0))),
            programme_code=None,
            department="North wing",
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
    ours = [
        v for v in vs if getattr(v, "rule_id", None) == "room_programme_inconsistent_within_level"
    ]
    assert len(ours) == 1
    assert ours[0].quick_fix_command is None


def test_room_finish_metadata_hint_peer_finish_quick_fix() -> None:
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
            finish_set="StdPaint",
        ),
    }
    vs = evaluate(els)
    ours = [v for v in vs if getattr(v, "rule_id", None) == "room_finish_metadata_hint"]
    assert len(ours) == 1
    assert ours[0].element_ids == ["rm-a"]
    qf = ours[0].quick_fix_command
    assert isinstance(qf, dict)
    assert qf == {
        "type": "updateElementProperty",
        "elementId": "rm-a",
        "key": "finishSet",
        "value": "StdPaint",
    }


def test_room_finish_metadata_hint_no_quick_fix_without_peer_finish() -> None:
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
            finish_set=None,
        ),
    }
    vs = evaluate(els)
    ours = [v for v in vs if getattr(v, "rule_id", None) == "room_finish_metadata_hint"]
    assert len(ours) == 1
    assert ours[0].quick_fix_command is None


def test_room_boundary_axis_closure_insufficient_segments_rule() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevation_mm=0)
    els = {
        "lvl-1": lvl,
        "w-h": WallElem(
            kind="wall",
            id="w-h",
            name="H",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        "w-v": WallElem(
            kind="wall",
            id="w-v",
            name="V",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    }
    vs = evaluate(els)
    ours = [
        v
        for v in vs
        if getattr(v, "rule_id", None) == "room_boundary_axis_closure_insufficient_segments"
    ]
    assert len(ours) == 1
    assert sorted(ours[0].element_ids) == sorted(["w-h", "w-v"])


def test_room_boundary_non_axis_segments_skipped_rule() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevation_mm=0)
    els = {
        "lvl-1": lvl,
        "w-diag": WallElem(
            kind="wall",
            id="w-diag",
            name="D",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    }
    vs = evaluate(els)
    ours = [
        v for v in vs if getattr(v, "rule_id", None) == "room_boundary_non_axis_segments_skipped"
    ]
    assert len(ours) == 1
    assert ours[0].element_ids == ["w-diag"]


def test_room_derived_interior_separation_ambiguous_rule() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevation_mm=0)
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=2800,
        ),
    )
    sep = RoomSeparationElem(
        kind="room_separation",
        id="rs-mid",
        name="Mid",
        levelId="lvl-1",
        start={"xMm": 2000, "yMm": 500},
        end={"xMm": 2000, "yMm": 3500},
    )
    els = {"lvl-1": lvl, "rs-mid": sep, **{w.id: w for w in walls}}
    vs = evaluate(els)
    ours = [
        v for v in vs if getattr(v, "rule_id", None) == "room_derived_interior_separation_ambiguous"
    ]
    assert len(ours) >= 1
    assert {"rs-mid", "w-s", "w-n", "w-w", "w-e"}.issubset(set(ours[0].element_ids))
