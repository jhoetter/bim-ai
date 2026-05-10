"""Room derivation preview heuristic (orthogonal wall loops)."""

from __future__ import annotations

import pytest

import bim_ai.room_derivation as room_derivation
from bim_ai.document import Document
from bim_ai.elements import LevelElem, ProjectSettingsElem, RoomElem, RoomSeparationElem, WallElem
from bim_ai.room_derivation_preview import (
    room_derivation_candidates_review,
    room_derivation_preview,
)


def test_finds_rectangle_from_four_axis_walls():
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
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
    doc = Document(revision=1, elements={"lvl-1": lvl, **{w.id: w for w in walls}})
    prev = room_derivation_preview(doc)
    assert prev["candidateCount"] >= 1
    assert prev.get("authoritativeCandidateCount", 0) >= 1
    cand = prev["axisAlignedRectangleCandidates"][0]
    assert cand.get("derivationAuthority") == "authoritative"
    assert cand["approxAreaM2"] == pytest.approx(16.0, rel=1e-2)
    assert sorted(cand["wallIds"]) == sorted(w.id for w in walls)
    warns = prev.get("warnings") or []
    assert any(w.get("code") == "derivedRectangleWithoutAuthoredRoom" for w in warns)


def test_volume_computed_at_core_faces_shrinks_derived_volume_area() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    lvl2 = LevelElem(kind="level", id="lvl-2", name="OG", elevationMm=3000)
    settings = ProjectSettingsElem(
        kind="project_settings",
        id="project-settings",
        volumeComputedAt="core_faces",
    )
    walls = (
        WallElem(
            kind="wall",
            id="w-s",
            name="S",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 4000, "yMm": 0},
            thicknessMm=200,
            heightMm=3000,
        ),
        WallElem(
            kind="wall",
            id="w-n",
            name="N",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 4000},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=3000,
        ),
        WallElem(
            kind="wall",
            id="w-w",
            name="W",
            levelId="lvl-1",
            start={"xMm": 0, "yMm": 0},
            end={"xMm": 0, "yMm": 4000},
            thicknessMm=200,
            heightMm=3000,
        ),
        WallElem(
            kind="wall",
            id="w-e",
            name="E",
            levelId="lvl-1",
            start={"xMm": 4000, "yMm": 0},
            end={"xMm": 4000, "yMm": 4000},
            thicknessMm=200,
            heightMm=3000,
        ),
    )
    doc = Document(
        revision=1,
        elements={
            "lvl-1": lvl,
            "lvl-2": lvl2,
            "project-settings": settings,
            **{w.id: w for w in walls},
        },
    )
    prev = room_derivation_preview(doc)
    cand = prev["axisAlignedRectangleCandidates"][0]

    assert cand["volumeComputedAt"] == "core_faces"
    assert cand["volumeAreaInsetMm"] == pytest.approx(100.0)
    assert cand["approxAreaM2"] == pytest.approx(16.0, rel=1e-2)
    assert cand["approxVolumeM3"] == pytest.approx(43.32, rel=1e-3)


def test_room_derivation_flags_overlap_with_authored_room_bbox() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
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

    rm = RoomElem(
        kind="room",
        id="rm-live",
        name="Existing",
        levelId="lvl-1",
        outlineMm=[
            {"xMm": 0, "yMm": 0},
            {"xMm": 4000, "yMm": 0},
            {"xMm": 4000, "yMm": 4000},
            {"xMm": 0, "yMm": 4000},
        ],
    )

    doc = Document(revision=5, elements={"lvl-1": lvl, "rm-live": rm, **{w.id: w for w in walls}})
    prev = room_derivation_preview(doc)
    assert not any(
        w.get("code") == "derivedRectangleWithoutAuthoredRoom" for w in (prev.get("warnings") or [])
    )
    rev = room_derivation_candidates_review(doc)
    c0 = rev["candidates"][0]
    assert c0["perimeterApproxM"] == pytest.approx(16.0, rel=1e-2)
    assert any(w.get("code") == "overlap_authored_room" for w in (c0.get("warnings") or []))
    comps = c0.get("comparisonToAuthoredRooms") or []

    assert comps and comps[0]["roomId"] == "rm-live"


def test_room_derivation_candidates_review_has_stable_ids_and_commands():
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
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
    doc = Document(revision=1, elements={"lvl-1": lvl, **{w.id: w for w in walls}})
    rev = room_derivation_candidates_review(doc)
    assert rev["format"] == "roomDerivationCandidates_v1"
    assert rev["candidateCount"] >= 1
    c0 = rev["candidates"][0]
    assert len(str(c0.get("candidateId", ""))) >= 8
    assert c0["suggestedCommand"]["type"] == "createRoomOutline"
    assert (
        isinstance(c0["suggestedBundleCommands"], list) and len(c0["suggestedBundleCommands"]) == 1
    )
    assert c0["perimeterApproxM"] == pytest.approx(16.0, rel=1e-2)


def test_room_derivation_warns_interior_axis_room_separation():
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
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
    doc = Document(revision=1, elements={"lvl-1": lvl, "rs-mid": sep, **{w.id: w for w in walls}})
    prev = room_derivation_preview(doc)
    assert prev["heuristicVersion"] == "room_deriv_preview_v4"
    warns = prev.get("warnings") or []
    cand0 = prev["axisAlignedRectangleCandidates"][0]
    assert cand0.get("derivationAuthority") == "preview_heuristic"
    assert "ambiguous_interior_separation" in (cand0.get("authorityReasonCodes") or [])
    assert any(w.get("code") == "derivedRectangleInteriorRoomSeparation" for w in warns)

    rev = room_derivation_candidates_review(doc)
    c0 = rev["candidates"][0]
    assert any(
        w.get("code") == "derivedRectangleInteriorRoomSeparation"
        for w in (c0.get("warnings") or [])
    )


def test_insufficient_segments_emits_axis_closure_diagnostic() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    docs = Document(
        revision=3,
        elements={
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
        },
    )
    prev = room_derivation_preview(docs)
    diag = prev.get("diagnostics") or []
    assert prev["candidateCount"] == 0
    ours = [d for d in diag if d.get("code") == "axis_segments_insufficient_for_closure"]
    assert len(ours) == 1
    assert sorted(ours[0].get("elementIds") or []) == sorted(["w-h", "w-v"])


def test_axis_boundary_segment_enum_cap_diagnostic(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(room_derivation, "ROOM_AX_RECT_SEGMENT_ENUM_CAP", 3)
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
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
    doc = Document(revision=1, elements={"lvl-1": lvl, **{w.id: w for w in walls}})
    prev = room_derivation_preview(doc)
    assert prev["candidateCount"] == 0
    caps = [
        d
        for d in (prev.get("diagnostics") or [])
        if d.get("code") == "axis_boundary_segment_enum_cap"
    ]
    assert len(caps) == 1
    assert caps[0].get("cap") == 3


def test_axis_segments_missing_orientation_mix_diagnostic() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    ys = (0.0, 1000.0, 2000.0, 3000.0)
    els: dict[str, object] = {"lvl-1": lvl}
    for i, y in enumerate(ys):
        wid = f"w-h-{i}"
        els[wid] = WallElem(
            kind="wall",
            id=wid,
            name=wid,
            levelId="lvl-1",
            start={"xMm": 0, "yMm": y},
            end={"xMm": 4000, "yMm": y},
            thicknessMm=200,
            heightMm=2800,
        )
    doc = Document(revision=1, elements=els)
    prev = room_derivation_preview(doc)
    mix = [
        d
        for d in (prev.get("diagnostics") or [])
        if d.get("code") == "axis_segments_missing_orientation_mix"
    ]
    assert len(mix) == 1


def test_non_axis_boundary_segments_skipped_diagnostic() -> None:
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)
    doc = Document(
        revision=1,
        elements={
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
        },
    )
    prev = room_derivation_preview(doc)
    skipped = [
        d
        for d in (prev.get("diagnostics") or [])
        if d.get("code") == "non_axis_boundary_segments_skipped"
    ]
    assert len(skipped) == 1
    assert "w-diag" in (skipped[0].get("elementIds") or [])


def test_overlapping_derived_rectangles_downgrade_to_preview() -> None:
    """Two offset 4×4 m footprints overlap enough to mark both as preview_heuristic."""
    lvl = LevelElem(kind="level", id="lvl-1", name="EG", elevationMm=0)

    def ring(x0: float, y0: float, x1: float, y1: float, prefix: str) -> tuple[WallElem, ...]:
        return (
            WallElem(
                kind="wall",
                id=f"{prefix}-s",
                name="S",
                levelId="lvl-1",
                start={"xMm": x0, "yMm": y0},
                end={"xMm": x1, "yMm": y0},
                thicknessMm=200,
                heightMm=2800,
            ),
            WallElem(
                kind="wall",
                id=f"{prefix}-n",
                name="N",
                levelId="lvl-1",
                start={"xMm": x0, "yMm": y1},
                end={"xMm": x1, "yMm": y1},
                thicknessMm=200,
                heightMm=2800,
            ),
            WallElem(
                kind="wall",
                id=f"{prefix}-w",
                name="W",
                levelId="lvl-1",
                start={"xMm": x0, "yMm": y0},
                end={"xMm": x0, "yMm": y1},
                thicknessMm=200,
                heightMm=2800,
            ),
            WallElem(
                kind="wall",
                id=f"{prefix}-e",
                name="E",
                levelId="lvl-1",
                start={"xMm": x1, "yMm": y0},
                end={"xMm": x1, "yMm": y1},
                thicknessMm=200,
                heightMm=2800,
            ),
        )

    walls_a = ring(0.0, 0.0, 4000.0, 4000.0, "a")
    walls_b = ring(2000.0, 2000.0, 6000.0, 6000.0, "b")
    doc = Document(revision=1, elements={"lvl-1": lvl, **{w.id: w for w in walls_a + walls_b}})
    prev = room_derivation_preview(doc)
    assert prev.get("candidateCount", 0) >= 2
    cands = prev.get("axisAlignedRectangleCandidates") or []
    assert all(c.get("derivationAuthority") == "preview_heuristic" for c in cands)
    assert any(
        "overlapping_derived_candidate_footprint" in (c.get("authorityReasonCodes") or [])
        for c in cands
    )
