"""Room color scheme override authoring evidence + advisory tests (prompt-2 v1 closeout)."""

from __future__ import annotations

from bim_ai.commands import (
    CreateLevelCmd,
    CreateRoomRectangleCmd,
    UpsertPlanViewCmd,
    UpsertRoomColorSchemeCmd,
    UpsertSheetCmd,
    UpsertSheetViewportsCmd,
)
from bim_ai.constraints import evaluate
from bim_ai.document import Document
from bim_ai.elements import (
    LevelElem,
    RoomColorSchemeElem,
    RoomColorSchemeRow,
    RoomElem,
    Vec2Mm,
)
from bim_ai.engine import apply_inplace
from bim_ai.room_color_scheme_override_evidence import (
    build_room_color_scheme_override_evidence_v1,
    legend_rows_from_scheme_overrides,
)
from bim_ai.sheet_preview_svg import (
    plan_room_programme_legend_hints_v0,
    room_color_scheme_legend_placement_evidence_v1,
)


def _sq(outline_mm: tuple[tuple[float, float], ...]) -> list[Vec2Mm]:
    return [Vec2Mm(x_mm=a, y_mm=b) for a, b in outline_mm]


def _make_scheme_elem(rows: list[dict]) -> RoomColorSchemeElem:
    parsed = [RoomColorSchemeRow(**r) for r in rows]
    return RoomColorSchemeElem(kind="room_color_scheme", id="bim-room-color-scheme", schemeRows=parsed)


# ---------------------------------------------------------------------------
# Override evidence structure
# ---------------------------------------------------------------------------


def test_override_evidence_no_scheme_elem() -> None:
    ev = build_room_color_scheme_override_evidence_v1(None)
    assert ev["format"] == "roomColorSchemeOverrideEvidence_v1"
    assert ev["schemeIdentity"] is None
    assert ev["overrideRowCount"] == 0
    assert ev["rows"] == []
    codes = [f["code"] for f in ev["advisoryFindings"]]
    assert "room_color_scheme_identity_missing" in codes


def test_override_evidence_valid_rows() -> None:
    scheme = _make_scheme_elem([
        {"programmeCode": "LAB", "schemeColorHex": "#FF0000"},
        {"programmeCode": "OFF", "department": "East", "schemeColorHex": "#00FF00"},
        {"department": "Surgery", "schemeColorHex": "#0000FF"},
    ])
    ev = build_room_color_scheme_override_evidence_v1(scheme)
    assert ev["format"] == "roomColorSchemeOverrideEvidence_v1"
    assert ev["schemeIdentity"] == "bim-room-color-scheme"
    assert ev["overrideRowCount"] == 3
    assert len(ev["rows"]) == 3
    assert isinstance(ev["rowDigestSha256"], str) and len(ev["rowDigestSha256"]) == 64
    assert ev["advisoryFindings"] == []
    labels = [r["label"] for r in ev["rows"]]
    assert "LAB" in labels
    assert "Surgery" in labels


def test_override_evidence_duplicate_key_advisory() -> None:
    scheme = _make_scheme_elem([
        {"programmeCode": "LAB", "schemeColorHex": "#FF0000"},
        {"programmeCode": "LAB", "schemeColorHex": "#AABBCC"},
    ])
    ev = build_room_color_scheme_override_evidence_v1(scheme)
    codes = [f["code"] for f in ev["advisoryFindings"]]
    assert "room_color_scheme_row_duplicate_override_key" in codes


def test_override_evidence_ordering_is_stable() -> None:
    rows_a = [
        {"programmeCode": "Z", "schemeColorHex": "#111111"},
        {"programmeCode": "A", "schemeColorHex": "#222222"},
        {"department": "Med", "schemeColorHex": "#333333"},
    ]
    rows_b = [
        {"programmeCode": "A", "schemeColorHex": "#222222"},
        {"department": "Med", "schemeColorHex": "#333333"},
        {"programmeCode": "Z", "schemeColorHex": "#111111"},
    ]
    ev_a = build_room_color_scheme_override_evidence_v1(_make_scheme_elem(rows_a))
    ev_b = build_room_color_scheme_override_evidence_v1(_make_scheme_elem(rows_b))
    assert ev_a["rowDigestSha256"] == ev_b["rowDigestSha256"]
    assert [r["programmeCode"] for r in ev_a["rows"]] == [r["programmeCode"] for r in ev_b["rows"]]


def test_override_evidence_digest_changes_with_color() -> None:
    scheme_a = _make_scheme_elem([{"programmeCode": "LAB", "schemeColorHex": "#FF0000"}])
    scheme_b = _make_scheme_elem([{"programmeCode": "LAB", "schemeColorHex": "#0000FF"}])
    ev_a = build_room_color_scheme_override_evidence_v1(scheme_a)
    ev_b = build_room_color_scheme_override_evidence_v1(scheme_b)
    assert ev_a["rowDigestSha256"] != ev_b["rowDigestSha256"]


# ---------------------------------------------------------------------------
# legend_rows_from_scheme_overrides ordering
# ---------------------------------------------------------------------------


def test_legend_rows_from_overrides_sorted_by_label() -> None:
    scheme = _make_scheme_elem([
        {"programmeCode": "Z", "schemeColorHex": "#111111"},
        {"programmeCode": "A", "schemeColorHex": "#222222"},
        {"programmeCode": "M", "schemeColorHex": "#333333"},
    ])
    rows = legend_rows_from_scheme_overrides(scheme.scheme_rows)
    labels = [r["label"] for r in rows]
    assert labels == sorted(labels)


def test_legend_rows_deduped_by_key() -> None:
    scheme = _make_scheme_elem([
        {"programmeCode": "LAB", "schemeColorHex": "#FF0000"},
        {"programmeCode": "LAB", "schemeColorHex": "#AABBCC"},
    ])
    rows = legend_rows_from_scheme_overrides(scheme.scheme_rows)
    assert len(rows) == 1


# ---------------------------------------------------------------------------
# Constraint advisor integration
# ---------------------------------------------------------------------------


def test_constraints_room_color_scheme_identity_missing_advisory() -> None:
    lv = LevelElem(kind="level", id="lv", name="G", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Office",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (5000.0, 0.0), (5000.0, 4000.0), (0.0, 4000.0))),
    )
    els = {"lv": lv, "rm-1": rm}
    violations = evaluate(els)
    rule_ids = [v.rule_id for v in violations]
    assert "room_color_scheme_identity_missing" in rule_ids


def test_constraints_no_scheme_advisory_without_rooms() -> None:
    lv = LevelElem(kind="level", id="lv", name="G", elevation_mm=0)
    els = {"lv": lv}
    violations = evaluate(els)
    rule_ids = [v.rule_id for v in violations]
    assert "room_color_scheme_identity_missing" not in rule_ids


def test_constraints_no_scheme_advisory_when_scheme_present() -> None:
    lv = LevelElem(kind="level", id="lv", name="G", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Office",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (5000.0, 0.0), (5000.0, 4000.0), (0.0, 4000.0))),
    )
    scheme = _make_scheme_elem([{"programmeCode": "OFF", "schemeColorHex": "#123456"}])
    els = {"lv": lv, "rm-1": rm, "bim-room-color-scheme": scheme}
    violations = evaluate(els)
    rule_ids = [v.rule_id for v in violations]
    assert "room_color_scheme_identity_missing" not in rule_ids


def test_constraints_duplicate_key_advisory() -> None:
    lv = LevelElem(kind="level", id="lv", name="G", elevation_mm=0)
    rm = RoomElem(
        kind="room",
        id="rm-1",
        name="Lab",
        level_id="lv",
        outline_mm=_sq(((0.0, 0.0), (5000.0, 0.0), (5000.0, 4000.0), (0.0, 4000.0))),
    )
    scheme = RoomColorSchemeElem(
        id="bim-room-color-scheme",
        kind="room_color_scheme",
        schemeRows=[
            RoomColorSchemeRow(programmeCode="LAB", schemeColorHex="#FF0000"),
            RoomColorSchemeRow(programmeCode="LAB", schemeColorHex="#AABBCC"),
        ],
    )
    els = {"lv": lv, "rm-1": rm, "bim-room-color-scheme": scheme}
    violations = evaluate(els)
    rule_ids = [v.rule_id for v in violations]
    assert "room_color_scheme_row_duplicate_override_key" in rule_ids


# ---------------------------------------------------------------------------
# Sheet legend placement evidence
# ---------------------------------------------------------------------------


def test_sheet_legend_placement_evidence_no_rooms() -> None:
    doc = Document(revision=1, elements={})
    ev = room_color_scheme_legend_placement_evidence_v1(doc, [])
    assert ev["format"] == "roomColorSchemeLegendPlacementEvidence_v1"
    assert ev["placedLegendCount"] == 0
    assert ev["placedRows"] == []


def test_sheet_legend_placement_evidence_with_plan_viewport() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lv", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-off",
            name="Office",
            levelId="lv",
            origin={"xMm": 0, "yMm": 0},
            widthMm=5000,
            depthMm=4000,
            programmeCode="OFF",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(id="pv-1", name="Floor Plan", levelId="lv", planPresentation="room_scheme"),
    )
    apply_inplace(doc, UpsertSheetCmd(id="sh-1", name="A101"))
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="sh-1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 50,
                    "yMm": 100,
                    "widthMm": 4000,
                    "heightMm": 3000,
                }
            ],
        ),
    )
    apply_inplace(
        doc,
        UpsertRoomColorSchemeCmd(
            id="bim-room-color-scheme",
            schemeRows=[{"programmeCode": "OFF", "schemeColorHex": "#123456"}],
        ),
    )

    sh = doc.elements["sh-1"]
    vps = list(sh.viewports_mm or [])
    ev = room_color_scheme_legend_placement_evidence_v1(doc, vps)

    assert ev["format"] == "roomColorSchemeLegendPlacementEvidence_v1"
    assert ev["placedLegendCount"] >= 1
    assert ev["schemeIdentity"] == "bim-room-color-scheme"
    assert ev["schemeOverrideRowCount"] == 1
    assert isinstance(ev["placementDigestSha256"], str) and len(ev["placementDigestSha256"]) == 64

    placed = ev["placedRows"]
    assert any(r["viewportId"] == "vp-plan" for r in placed)
    row = next(r for r in placed if r["viewportId"] == "vp-plan")
    assert row["planViewRef"] == "pv-1"
    assert row["schemeSource"] == "override"
    assert row["legendRowCount"] >= 1


def test_sheet_legend_placement_digest_is_stable() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lv", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-lab",
            name="Lab",
            levelId="lv",
            origin={"xMm": 0, "yMm": 0},
            widthMm=5000,
            depthMm=4000,
            programmeCode="LAB",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(id="pv-1", name="Floor Plan", levelId="lv", planPresentation="room_scheme"),
    )
    apply_inplace(doc, UpsertSheetCmd(id="sh-1", name="A101"))
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="sh-1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 50,
                    "yMm": 100,
                    "widthMm": 4000,
                    "heightMm": 3000,
                }
            ],
        ),
    )

    sh = doc.elements["sh-1"]
    vps = list(sh.viewports_mm or [])

    ev1 = room_color_scheme_legend_placement_evidence_v1(doc, vps)
    ev2 = room_color_scheme_legend_placement_evidence_v1(doc, vps)

    assert ev1["placementDigestSha256"] == ev2["placementDigestSha256"]


def test_plan_room_legend_hints_includes_override_count() -> None:
    doc = Document(revision=1, elements={})
    apply_inplace(doc, CreateLevelCmd(id="lv", name="G", elevationMm=0))
    apply_inplace(
        doc,
        CreateRoomRectangleCmd(
            roomId="rm-lab",
            name="Lab",
            levelId="lv",
            origin={"xMm": 0, "yMm": 0},
            widthMm=5000,
            depthMm=4000,
            programmeCode="LAB",
        ),
    )
    apply_inplace(
        doc,
        UpsertPlanViewCmd(id="pv-1", name="Plan", levelId="lv", planPresentation="room_scheme"),
    )
    apply_inplace(doc, UpsertSheetCmd(id="sh-1", name="A101"))
    apply_inplace(
        doc,
        UpsertSheetViewportsCmd(
            sheetId="sh-1",
            viewportsMm=[
                {
                    "viewportId": "vp-plan",
                    "viewRef": "plan:pv-1",
                    "xMm": 50,
                    "yMm": 100,
                    "widthMm": 4000,
                    "heightMm": 3000,
                }
            ],
        ),
    )
    apply_inplace(
        doc,
        UpsertRoomColorSchemeCmd(
            id="bim-room-color-scheme",
            schemeRows=[{"programmeCode": "LAB", "schemeColorHex": "#AABBCC"}],
        ),
    )
    sh = doc.elements["sh-1"]
    hints = plan_room_programme_legend_hints_v0(doc, list(sh.viewports_mm or []))
    assert hints
    h0 = hints[0]
    assert h0.get("schemeOverrideRowCount", 0) >= 1
    assert h0.get("schemeOverridesSource") == "bim-room-color-scheme"
