"""Room programme workflow: unbounded-room detection, programme/department metadata, colour-scheme legend evidence."""

from __future__ import annotations

from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    RoomColorSchemeElem,
    RoomColorSchemeRow,
    RoomElem,
    RoomSeparationElem,
    ScheduleElem,
    Vec2Mm,
    WallElem,
)
from bim_ai.room_color_scheme_override_evidence import roomColourSchemeLegendEvidence_v1
from bim_ai.room_derivation import detect_unbounded_rooms_v1
from bim_ai.schedule_derivation import derive_schedule_table


def _sq(pts: list[tuple[float, float]]) -> list[Vec2Mm]:
    return [Vec2Mm(x_mm=x, y_mm=y) for x, y in pts]


def _box4(x0: float, y0: float, x1: float, y1: float) -> list[Vec2Mm]:
    return _sq([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def _enclosing_walls(level_id: str, x0: float, y0: float, x1: float, y1: float) -> dict[str, WallElem]:
    def _w(wid: str, sx: float, sy: float, ex: float, ey: float) -> WallElem:
        return WallElem(
            kind="wall",
            id=wid,
            name=wid,
            levelId=level_id,
            start={"xMm": sx, "yMm": sy},
            end={"xMm": ex, "yMm": ey},
            thicknessMm=200,
            heightMm=2800,
        )
    return {
        "w-s": _w("w-s", x0, y0, x1, y0),
        "w-n": _w("w-n", x0, y1, x1, y1),
        "w-w": _w("w-w", x0, y0, x0, y1),
        "w-e": _w("w-e", x1, y0, x1, y1),
    }


# ── Unbounded room detection ───────────────────────────────────────────────────


def test_detect_unbounded_room_no_walls() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-1", name="Open Room", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    doc = Document(revision=1, elements={"lv": lvl, "rm-1": room})
    unbounded = detect_unbounded_rooms_v1(doc)
    assert "rm-1" in unbounded


def test_detect_bounded_room_with_enclosing_walls() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-1", name="Enclosed Room", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    walls = _enclosing_walls("lv", 0, 0, 4000, 4000)
    doc = Document(revision=1, elements={"lv": lvl, "rm-1": room, **walls})
    unbounded = detect_unbounded_rooms_v1(doc)
    assert "rm-1" not in unbounded


def test_detect_unbounded_room_with_walls_on_different_level() -> None:
    lv1 = LevelElem(kind="level", id="lv1", name="G", elevationMm=0)
    lv2 = LevelElem(kind="level", id="lv2", name="L1", elevationMm=3000)
    room = RoomElem(
        kind="room", id="rm-1", name="Open", levelId="lv1",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    walls = _enclosing_walls("lv2", 0, 0, 4000, 4000)
    doc = Document(revision=1, elements={"lv1": lv1, "lv2": lv2, "rm-1": room, **walls})
    unbounded = detect_unbounded_rooms_v1(doc)
    assert "rm-1" in unbounded


def test_detect_unbounded_room_with_room_separations() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-1", name="Sep Enclosed", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    seps = {
        "sep-s": RoomSeparationElem(kind="room_separation", id="sep-s", name="S", levelId="lv",
                                    start={"xMm": 0, "yMm": 0}, end={"xMm": 4000, "yMm": 0}),
        "sep-n": RoomSeparationElem(kind="room_separation", id="sep-n", name="N", levelId="lv",
                                    start={"xMm": 0, "yMm": 4000}, end={"xMm": 4000, "yMm": 4000}),
        "sep-w": RoomSeparationElem(kind="room_separation", id="sep-w", name="W", levelId="lv",
                                    start={"xMm": 0, "yMm": 0}, end={"xMm": 0, "yMm": 4000}),
        "sep-e": RoomSeparationElem(kind="room_separation", id="sep-e", name="E", levelId="lv",
                                    start={"xMm": 4000, "yMm": 0}, end={"xMm": 4000, "yMm": 4000}),
    }
    doc = Document(revision=1, elements={"lv": lvl, "rm-1": room, **seps})
    unbounded = detect_unbounded_rooms_v1(doc)
    assert "rm-1" not in unbounded


def test_detect_unbounded_room_degenerate_outline() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-degen", name="Degen", levelId="lv",
        outlineMm=[Vec2Mm(x_mm=0, y_mm=0)],
    )
    doc = Document(revision=1, elements={"lv": lvl, "rm-degen": room})
    unbounded = detect_unbounded_rooms_v1(doc)
    assert "rm-degen" in unbounded


def test_unbounded_room_ids_in_room_derivation_bundle() -> None:
    from bim_ai.room_derivation import compute_room_boundary_derivation

    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-open", name="Open", levelId="lv",
        outlineMm=_box4(0, 0, 3000, 3000),
    )
    doc = Document(revision=1, elements={"lv": lvl, "rm-open": room})
    bundle = compute_room_boundary_derivation(doc)
    assert "unboundedRoomIds" in bundle
    assert "rm-open" in bundle["unboundedRoomIds"]


# ── Advisor rule room_boundary_open ──────────────────────────────────────────


def test_advisor_room_boundary_open_fires_for_unbounded() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-1", name="Open Room", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    violations = evaluate({"lv": lvl, "rm-1": room})
    open_viols = [v for v in violations if v.rule_id == "room_boundary_open"]
    assert len(open_viols) >= 1
    assert any("rm-1" in v.element_ids for v in open_viols)


def test_advisor_room_boundary_open_silent_for_bounded() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-1", name="Bounded", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    walls = _enclosing_walls("lv", 0, 0, 4000, 4000)
    violations = evaluate({"lv": lvl, "rm-1": room, **walls})
    open_viols = [v for v in violations if v.rule_id == "room_boundary_open"]
    assert len(open_viols) == 0


def test_advisor_room_boundary_open_discipline_is_architecture() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-1", name="Open", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    violations = evaluate({"lv": lvl, "rm-1": room})
    open_viols = [v for v in violations if v.rule_id == "room_boundary_open"]
    assert all(v.discipline == "architecture" for v in open_viols)


# ── Department and programmeGroup in schedule rows ───────────────────────────


def _make_room_schedule_doc(
    *,
    department: str | None = None,
    programme_group: str | None = None,
) -> tuple[Document, str]:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    walls = _enclosing_walls("lv", 0, 0, 4000, 4000)
    room = RoomElem(
        kind="room", id="rm-1", name="Test Room", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
        programmeCode="A1",
        department=department,
        programmeGroup=programme_group,
    )
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms", filters={"category": "room"})
    doc = Document(revision=1, elements={"lv": lvl, "rm-1": room, "sch-1": sch, **walls})
    return doc, "sch-1"


def test_schedule_room_row_includes_department() -> None:
    doc, sid = _make_room_schedule_doc(department="North Wing")
    out = derive_schedule_table(doc, sid)
    rows = out.get("rows") or []
    assert rows
    row = next(r for r in rows if r["elementId"] == "rm-1")
    assert row["department"] == "North Wing"


def test_schedule_room_row_includes_programme_group() -> None:
    doc, sid = _make_room_schedule_doc(programme_group="Clinical")
    out = derive_schedule_table(doc, sid)
    rows = out.get("rows") or []
    assert rows
    row = next(r for r in rows if r["elementId"] == "rm-1")
    assert row["programmeGroup"] == "Clinical"


def test_schedule_room_row_includes_is_boundary_open_false_for_bounded() -> None:
    doc, sid = _make_room_schedule_doc()
    out = derive_schedule_table(doc, sid)
    rows = out.get("rows") or []
    assert rows
    row = next(r for r in rows if r["elementId"] == "rm-1")
    assert row["isBoundaryOpen"] is False


def test_schedule_room_row_includes_is_boundary_open_true_for_unbounded() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(
        kind="room", id="rm-open", name="Open", levelId="lv",
        outlineMm=_box4(0, 0, 4000, 4000),
    )
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms", filters={"category": "room"})
    doc = Document(revision=1, elements={"lv": lvl, "rm-open": room, "sch-1": sch})
    out = derive_schedule_table(doc, "sch-1")
    rows = out.get("rows") or []
    assert rows
    row = next(r for r in rows if r["elementId"] == "rm-open")
    assert row["isBoundaryOpen"] is True


def test_schedule_filter_equals_by_department() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    walls_a = _enclosing_walls("lv", 0, 0, 4000, 4000)
    walls_b = {k + "b": WallElem(
        kind="wall", id=k + "b", name=k + "b", levelId="lv",
        start={"xMm": v.start.x_mm + 5000, "yMm": v.start.y_mm},
        end={"xMm": v.end.x_mm + 5000, "yMm": v.end.y_mm},
        thicknessMm=200, heightMm=2800,
    ) for k, v in walls_a.items()}
    rm_a = RoomElem(kind="room", id="rm-a", name="A", levelId="lv",
                    outlineMm=_box4(0, 0, 4000, 4000), department="North")
    rm_b = RoomElem(kind="room", id="rm-b", name="B", levelId="lv",
                    outlineMm=_box4(5000, 0, 9000, 4000), department="South")
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms",
                       filters={"category": "room", "filterEquals": {"department": "North"}})
    doc = Document(revision=1, elements={
        "lv": lvl, "rm-a": rm_a, "rm-b": rm_b, "sch-1": sch,
        **walls_a, **walls_b,
    })
    out = derive_schedule_table(doc, "sch-1")
    rows = out.get("rows") or []
    ids = {r["elementId"] for r in rows}
    assert ids == {"rm-a"}


def test_schedule_filter_equals_by_programme_group() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    walls_a = _enclosing_walls("lv", 0, 0, 4000, 4000)
    walls_b = {k + "b": WallElem(
        kind="wall", id=k + "b", name=k + "b", levelId="lv",
        start={"xMm": v.start.x_mm + 5000, "yMm": v.start.y_mm},
        end={"xMm": v.end.x_mm + 5000, "yMm": v.end.y_mm},
        thicknessMm=200, heightMm=2800,
    ) for k, v in walls_a.items()}
    rm_a = RoomElem(kind="room", id="rm-a", name="A", levelId="lv",
                    outlineMm=_box4(0, 0, 4000, 4000), programmeGroup="Clinical")
    rm_b = RoomElem(kind="room", id="rm-b", name="B", levelId="lv",
                    outlineMm=_box4(5000, 0, 9000, 4000), programmeGroup="Admin")
    sch = ScheduleElem(kind="schedule", id="sch-1", name="Rooms",
                       filters={"category": "room", "filterEquals": {"programmeGroup": "Clinical"}})
    doc = Document(revision=1, elements={
        "lv": lvl, "rm-a": rm_a, "rm-b": rm_b, "sch-1": sch,
        **walls_a, **walls_b,
    })
    out = derive_schedule_table(doc, "sch-1")
    rows = out.get("rows") or []
    ids = {r["elementId"] for r in rows}
    assert ids == {"rm-a"}


# ── updateElementProperty for programmeGroup ─────────────────────────────────


def test_update_element_property_programme_group() -> None:
    from bim_ai.commands import UpdateElementPropertyCmd
    from bim_ai.engine import apply_inplace

    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    room = RoomElem(kind="room", id="rm-1", name="Room", levelId="lv",
                    outlineMm=_box4(0, 0, 3000, 3000))
    doc = Document(revision=1, elements={"lv": lvl, "rm-1": room})
    cmd = UpdateElementPropertyCmd(
        type="updateElementProperty",
        elementId="rm-1",
        key="programmeGroup",
        value="Residential",
    )
    apply_inplace(doc, cmd)
    rm = doc.elements["rm-1"]
    assert isinstance(rm, RoomElem)
    assert rm.programme_group == "Residential"


# ── Room colour scheme legend evidence ───────────────────────────────────────


def _make_legend_doc() -> Document:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    scheme = RoomColorSchemeElem(
        kind="room_color_scheme",
        id="bim-room-color-scheme",
        schemeRows=[
            RoomColorSchemeRow(programmeCode="A1", schemeColorHex="#FF0000"),
            RoomColorSchemeRow(department="Admin", schemeColorHex="#00FF00"),
        ],
    )
    walls_a = _enclosing_walls("lv", 0, 0, 4000, 4000)
    walls_b = {k + "b": WallElem(
        kind="wall", id=k + "b", name=k + "b", levelId="lv",
        start={"xMm": v.start.x_mm + 5000, "yMm": v.start.y_mm},
        end={"xMm": v.end.x_mm + 5000, "yMm": v.end.y_mm},
        thicknessMm=200, heightMm=2800,
    ) for k, v in walls_a.items()}
    rm_a = RoomElem(kind="room", id="rm-a", name="Office A", levelId="lv",
                    outlineMm=_box4(0, 0, 4000, 4000), programmeCode="A1")
    rm_b = RoomElem(kind="room", id="rm-b", name="Admin B", levelId="lv",
                    outlineMm=_box4(5000, 0, 9000, 4000), department="Admin")
    return Document(revision=1, elements={
        "lv": lvl,
        "bim-room-color-scheme": scheme,
        "rm-a": rm_a,
        "rm-b": rm_b,
        **walls_a,
        **walls_b,
    })


def test_legend_evidence_format() -> None:
    doc = _make_legend_doc()
    ev = roomColourSchemeLegendEvidence_v1(doc)
    assert ev["format"] == "roomColourSchemeLegendEvidence_v1"
    assert ev["schemeIdentity"] == "bim-room-color-scheme"
    assert isinstance(ev["legendRowCount"], int)
    assert isinstance(ev["legendRows"], list)
    assert isinstance(ev["legendDigestSha256"], str)
    assert len(ev["legendDigestSha256"]) == 64


def test_legend_evidence_rows_match_rooms() -> None:
    doc = _make_legend_doc()
    ev = roomColourSchemeLegendEvidence_v1(doc)
    rows = ev["legendRows"]
    prog_row = next(r for r in rows if r.get("programmeCode") == "A1")
    dept_row = next(r for r in rows if r.get("department") == "Admin")
    matching_a = [m["roomId"] for m in prog_row["matchingRooms"]]
    matching_b = [m["roomId"] for m in dept_row["matchingRooms"]]
    assert "rm-a" in matching_a
    assert "rm-b" in matching_b


def test_legend_evidence_digest_deterministic() -> None:
    doc = _make_legend_doc()
    ev1 = roomColourSchemeLegendEvidence_v1(doc)
    ev2 = roomColourSchemeLegendEvidence_v1(doc)
    assert ev1["legendDigestSha256"] == ev2["legendDigestSha256"]


def test_legend_evidence_digest_changes_with_different_rooms() -> None:
    doc1 = _make_legend_doc()
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    scheme = RoomColorSchemeElem(
        kind="room_color_scheme",
        id="bim-room-color-scheme",
        schemeRows=[RoomColorSchemeRow(programmeCode="A1", schemeColorHex="#FF0000")],
    )
    doc2 = Document(revision=1, elements={"lv": lvl, "bim-room-color-scheme": scheme})
    ev1 = roomColourSchemeLegendEvidence_v1(doc1)
    ev2 = roomColourSchemeLegendEvidence_v1(doc2)
    assert ev1["legendDigestSha256"] != ev2["legendDigestSha256"]


def test_legend_evidence_no_scheme_returns_empty() -> None:
    lvl = LevelElem(kind="level", id="lv", name="G", elevationMm=0)
    doc = Document(revision=1, elements={"lv": lvl})
    ev = roomColourSchemeLegendEvidence_v1(doc)
    assert ev["format"] == "roomColourSchemeLegendEvidence_v1"
    assert ev["schemeIdentity"] is None
    assert ev["legendRowCount"] == 0
    assert ev["legendRows"] == []


def test_legend_evidence_total_area_m2_sums_rooms() -> None:
    doc = _make_legend_doc()
    ev = roomColourSchemeLegendEvidence_v1(doc)
    rows = ev["legendRows"]
    for row in rows:
        total = row["totalAreaM2"]
        computed = round(sum(r["areaM2"] for r in row["matchingRooms"]), 3)
        assert abs(total - computed) < 0.001
