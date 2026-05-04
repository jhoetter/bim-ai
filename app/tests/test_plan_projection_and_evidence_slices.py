"""WP-C01/C02 projection wire + deterministic evidence helpers."""

from __future__ import annotations

from uuid import uuid4

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    FloorElem,
    LevelElem,
    PlanViewElem,
    RoomElem,
    SectionCutElem,
    SheetElem,
    StairElem,
    WallElem,
)
from bim_ai.evidence_manifest import (
    deterministic_sheet_evidence_manifest,
    evidence_package_semantic_digest_sha256,
)
from bim_ai.plan_projection_wire import (
    plan_projection_wire_from_request,
    section_cut_projection_wire,
)
from bim_ai.type_material_registry import merged_registry_payload


def test_plan_projection_wire_counts_visible_walls() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "w": WallElem(
                kind="wall",
                id="w",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    assert out["format"] == "planProjectionWire_v1"
    assert out["activeLevelId"] == "lvl"
    assert out["countsByVisibleKind"].get("wall") == 1
    prim = out.get("primitives") or {}
    assert prim.get("format") == "planProjectionPrimitives_v1"
    assert len(prim.get("walls") or []) == 1


def test_section_projection_wire_reports_missing_section() -> None:
    doc = Document(revision=1, elements={})
    out = section_cut_projection_wire(doc, "nope")
    assert out["format"] == "sectionProjectionWire_v1"
    assert out.get("errors")


def test_section_projection_wire_emits_wall_u_span_for_perpendicular_cut() -> None:
    """Horizontal wall + vertical cut plane: wall is seen 'edge-on' → thickness-sized u span."""
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=300.0)
    wall = WallElem(
        kind="wall",
        id="w1",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -5000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 5000.0},
        cropDepthMm=9000.0,
    )
    doc = Document(revision=1, elements={"lvl": lvl, "w1": wall, "sec-a": sec})
    out = section_cut_projection_wire(doc, "sec-a")
    assert not out.get("errors")
    prim = out.get("primitives") or {}
    assert prim.get("format") == "sectionProjectionPrimitives_v1"
    ws = prim.get("walls") or []
    assert len(ws) == 1
    span = float(ws[0]["uEndMm"]) - float(ws[0]["uStartMm"])
    assert span > 150.0 and span < 260.0
    assert ws[0]["elementId"] == "w1"
    assert out["countsByVisibleKind"]["wall"] == 1


def test_section_projection_wire_emits_door_when_cut_hits_host_wall() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0.0)
    wall = WallElem(
        kind="wall",
        id="w-host",
        name="W",
        levelId="lvl",
        start={"xMm": 0.0, "yMm": 0.0},
        end={"xMm": 6000.0, "yMm": 0.0},
        thicknessMm=200.0,
        heightMm=2800.0,
    )
    door = DoorElem(kind="door", id="d1", name="D", wallId="w-host", alongT=0.5, widthMm=900.0)
    sec = SectionCutElem(
        kind="section_cut",
        id="sec-a",
        name="A-A",
        lineStartMm={"xMm": 3000.0, "yMm": -8000.0},
        lineEndMm={"xMm": 3000.0, "yMm": 8000.0},
        cropDepthMm=12000.0,
    )
    doc = Document(revision=1, elements={"lvl": lvl, "w-host": wall, "d1": door, "sec-a": sec})
    out = section_cut_projection_wire(doc, "sec-a")
    ds = (out.get("primitives") or {}).get("doors") or []
    assert len(ds) == 1
    assert ds[0]["elementId"] == "d1"
    assert out["countsByVisibleKind"]["door"] == 1


def test_merged_registry_has_builtin_format() -> None:
    lvl = LevelElem(kind="level", id="lvl", name="L", elevationMm=0)
    doc = Document(revision=1, elements={"lvl": lvl})
    pay = merged_registry_payload(doc)
    assert pay["format"] == "typeMaterialRegistry_v1"
    assert pay["builtin"]["format"] == "bimAiBuiltinRegistry_v1"


def test_deterministic_sheet_evidence_rows_stable() -> None:
    sid = uuid4()
    doc = Document(
        revision=2,
        elements={
            "sheet-a": SheetElem(kind="sheet", id="sheet-a", name="A1"),
        },
    )
    rows = deterministic_sheet_evidence_manifest(
        model_id=sid,
        doc=doc,
        evidence_artifact_basename="pfx",
        semantic_digest_sha256="a" * 64,
        semantic_digest_prefix16="a" * 16,
    )
    assert len(rows) == 1
    assert rows[0]["sheetId"] == "sheet-a"
    assert "svgHref" in rows[0]
    assert rows[0]["playwrightSuggestedFilenames"]["pngViewport"].startswith("pfx-sheet-sheet-a")
    assert rows[0]["playwrightSuggestedFilenames"]["pngFullSheet"] == "pfx-sheet-sheet-a-full.png"
    corr = rows[0].get("correlation") or {}
    assert corr.get("semanticDigestPrefix16") == "a" * 16
    assert corr.get("modelRevision") == 2
    assert corr.get("suggestedEvidenceBundleEvidencePackageJson") == "pfx-evidence-package.json"


def test_evidence_digest_sorts_nested_registry_and_candidates() -> None:
    cand_a = {
        "candidateId": "zzz",
        "levelId": "l1",
        "wallIds": ["w2"],
        "kind": "axis_aligned_rectangle",
    }
    cand_b = {
        "candidateId": "aaa",
        "levelId": "l1",
        "wallIds": ["w1"],
        "kind": "axis_aligned_rectangle",
    }
    ft_b = {"id": "ft-b", "kind": "family_type", "discipline": "door"}
    ft_a = {"id": "ft-a", "kind": "family_type", "discipline": "door"}
    base = {
        "format": "evidencePackage_v1",
        "revision": 1,
        "modelId": "x",
        "roomDerivationCandidates": {"format": "x", "candidates": [cand_a, cand_b]},
        "typeMaterialRegistry": {"format": "t", "document": {"familyTypes": [ft_b, ft_a], "wallTypes": []}},
    }
    swapped = dict(base)
    swapped["roomDerivationCandidates"] = dict(base["roomDerivationCandidates"])
    swapped["roomDerivationCandidates"]["candidates"] = [cand_b, cand_a]

    swapped_t = dict(swapped["typeMaterialRegistry"])
    swapped_t_doc = dict(swapped_t["document"])
    swapped_t_doc["familyTypes"] = [ft_a, ft_b]
    swapped_t["document"] = swapped_t_doc
    swapped["typeMaterialRegistry"] = swapped_t

    assert evidence_package_semantic_digest_sha256(base) == evidence_package_semantic_digest_sha256(swapped)


def test_plan_projection_wire_includes_floor_count() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl-g", name="G", elevationMm=0),
            "w-a": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl-g",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 3000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
            "fl": FloorElem(
                kind="floor",
                id="fl",
                name="F",
                levelId="lvl-g",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 3000, "yMm": 0},
                    {"xMm": 3000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
        },
    )
    wire = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl-g")
    assert wire["countsByVisibleKind"]["wall"] >= 1
    assert wire["countsByVisibleKind"]["floor"] == 1


def test_plan_projection_room_primitives_include_programme_and_color() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="G", elevationMm=0),
            "rm": RoomElem(
                kind="room",
                id="rm",
                name="Office",
                levelId="lvl",
                programmeCode="OFF",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 2000, "yMm": 0},
                    {"xMm": 2000, "yMm": 2000},
                    {"xMm": 0, "yMm": 2000},
                ],
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="lvl")
    rooms = (out.get("primitives") or {}).get("rooms") or []
    assert len(rooms) == 1
    assert rooms[0].get("programmeCode") == "OFF"
    assert str(rooms[0].get("schemeColorHex", "")).startswith("#")


def test_plan_projection_crop_authored_emits_warning_codes() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L", elevationMm=0),
            "pv1": PlanViewElem(
                kind="plan_view",
                id="pv1",
                name="EG",
                levelId="lvl",
                cropMinMm={"xMm": -500, "yMm": -500},
                cropMaxMm={"xMm": 9500, "yMm": 6500},
                viewRangeBottomMm=-1200,
                viewRangeTopMm=4200,
            ),
            "w": WallElem(
                kind="wall",
                id="w-a",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 2000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id="pv1", fallback_level_id="lvl")
    codes = {w.get("code") for w in out.get("warnings", []) if isinstance(w, dict)}
    assert "cropBoxNotApplied" in codes
    assert "viewRangeNotApplied" in codes


def test_plan_projection_includes_stair_primitive() -> None:
    doc = Document(
        revision=1,
        elements={
            "l0": LevelElem(kind="level", id="l0", name="G", elevationMm=0),
            "l1": LevelElem(kind="level", id="l1", name="OG", elevationMm=2800),
            "st": StairElem(
                kind="stair",
                id="st1",
                name="S",
                baseLevelId="l0",
                topLevelId="l1",
                runStartMm={"xMm": 1000, "yMm": 500},
                runEndMm={"xMm": 1000, "yMm": 3500},
                widthMm=1100,
            ),
        },
    )
    out = plan_projection_wire_from_request(doc, plan_view_id=None, fallback_level_id="l0")
    sts = (out.get("primitives") or {}).get("stairs") or []
    assert len(sts) == 1
    assert sts[0]["id"] == "st1"
