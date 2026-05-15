from __future__ import annotations

import struct
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException

from bim_ai import routes_exports
from bim_ai.document import Document
from bim_ai.elements import (
    BalconyElem,
    BeamElem,
    CeilingElem,
    ColumnElem,
    DoorElem,
    DormerElem,
    FloorElem,
    LevelElem,
    RailingElem,
    RoofElem,
    RoomElem,
    SiteElem,
    SlabOpeningElem,
    WallElem,
)
from bim_ai.evidence_manifest import export_link_map
from bim_ai.export_stl import (
    build_stl_export_manifest,
    document_to_ascii_stl,
    document_to_binary_stl_bytes,
    document_to_stl_triangles,
)


def _wall_doc() -> Document:
    return Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                name="W",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 1000, "yMm": 0},
                thicknessMm=200,
                heightMm=3000,
            ),
        },
    )


def _binary_triangle_count(blob: bytes) -> int:
    return struct.unpack_from("<I", blob, 80)[0]


def _binary_vertices(blob: bytes) -> list[tuple[float, float, float]]:
    out: list[tuple[float, float, float]] = []
    tri_count = _binary_triangle_count(blob)
    off = 84
    for _ in range(tri_count):
        off += 12
        for _vertex in range(3):
            out.append(struct.unpack_from("<fff", blob, off))
            off += 12
        off += 2
    return out


def test_document_to_binary_stl_has_binary_header_count_and_mm_coordinates() -> None:
    blob = document_to_binary_stl_bytes(_wall_doc())

    assert len(blob[:80]) == 80
    assert blob[:10] == b"bim-ai STL"
    assert _binary_triangle_count(blob) == 12
    assert len(blob) == 84 + 12 * 50

    vertices = _binary_vertices(blob)
    xs = [v[0] for v in vertices]
    ys = [v[1] for v in vertices]
    zs = [v[2] for v in vertices]

    assert min(xs) == pytest.approx(0)
    assert max(xs) == pytest.approx(1000)
    assert min(ys) == pytest.approx(-100)
    assert max(ys) == pytest.approx(100)
    assert min(zs) == pytest.approx(0)
    assert max(zs) == pytest.approx(3000)


def test_document_to_ascii_stl_is_deterministic_and_uses_safe_solid_name() -> None:
    a = document_to_ascii_stl(_wall_doc(), solid_name="Model 1")
    b = document_to_ascii_stl(_wall_doc(), solid_name="Model 1")

    assert a == b
    assert a.startswith("solid Model_1\n")
    assert a.endswith("endsolid Model_1\n")
    assert a.count("facet normal") == 12
    assert "vertex 1000" in a


def test_stl_export_manifest_reports_print_ready_candidate_for_simple_wall() -> None:
    manifest = build_stl_export_manifest(_wall_doc())

    assert manifest["format"] == "stlPrintExportManifest_v1"
    assert manifest["meshSource"] == "dedicated_print_mesh_v2"
    assert manifest["units"] == "millimeter"
    assert manifest["readiness"] == "print_ready_candidate"
    assert manifest["triangleCount"] == 12
    assert manifest["binaryByteLength"] == 84 + 12 * 50
    assert manifest["trianglesByKind"] == {"wall": 12}
    assert manifest["elementCountsByKind"] == {"wall": 1}
    assert manifest["diagnostics"]["boundaryEdgeCount"] == 0
    assert manifest["diagnostics"]["nonManifoldEdgeCount"] == 0
    assert manifest["diagnostics"]["componentCountApprox"] == 1
    assert manifest["boundsMm"]["sizeMm"]["xMm"] == pytest.approx(1000)
    assert manifest["boundsMm"]["sizeMm"]["zMm"] == pytest.approx(3000)
    assert "wall" in manifest["coverage"]["printableSolidKinds"]


def test_stl_print_mesh_exports_browser_visible_solids_and_excludes_visual_markers() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=3000,
            ),
            "floor-1": FloorElem(
                kind="floor",
                id="floor-1",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                thicknessMm=200,
            ),
            "opening-1": SlabOpeningElem(
                kind="slab_opening",
                id="opening-1",
                hostFloorId="floor-1",
                boundaryMm=[
                    {"xMm": 1500, "yMm": 1000},
                    {"xMm": 2500, "yMm": 1000},
                    {"xMm": 2500, "yMm": 2000},
                    {"xMm": 1500, "yMm": 2000},
                ],
            ),
            "roof-1": RoofElem(
                kind="roof",
                id="roof-1",
                referenceLevelId="lvl",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                roofGeometryMode="gable_pitched_rectangle",
                overhangMm=200,
                slopeDeg=30,
            ),
            "railing-1": RailingElem(
                kind="railing",
                id="railing-1",
                pathMm=[{"xMm": 0, "yMm": 3500}, {"xMm": 4000, "yMm": 3500}],
            ),
            "column-1": ColumnElem(
                kind="column",
                id="column-1",
                levelId="lvl",
                positionMm={"xMm": 500, "yMm": 500},
                bMm=300,
                hMm=300,
                heightMm=3000,
            ),
            "beam-1": BeamElem(
                kind="beam",
                id="beam-1",
                levelId="lvl",
                startMm={"xMm": 0, "yMm": 3200},
                endMm={"xMm": 4000, "yMm": 3200},
                widthMm=200,
                heightMm=400,
            ),
            "ceiling-1": CeilingElem(
                kind="ceiling",
                id="ceiling-1",
                levelId="lvl",
                boundaryMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
                heightOffsetMm=2700,
                thicknessMm=30,
            ),
            "balcony-1": BalconyElem(
                kind="balcony",
                id="balcony-1",
                wallId="wall-1",
                elevationMm=2800,
                projectionMm=800,
                slabThicknessMm=150,
            ),
            "site-1": SiteElem(
                kind="site",
                id="site-1",
                referenceLevelId="lvl",
                boundaryMm=[
                    {"xMm": -1000, "yMm": -1000},
                    {"xMm": 5000, "yMm": -1000},
                    {"xMm": 5000, "yMm": 4500},
                    {"xMm": -1000, "yMm": 4500},
                ],
                padThicknessMm=80,
            ),
            "room-1": RoomElem(
                kind="room",
                id="room-1",
                levelId="lvl",
                outlineMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 4000, "yMm": 0},
                    {"xMm": 4000, "yMm": 3000},
                    {"xMm": 0, "yMm": 3000},
                ],
            ),
        },
    )

    manifest = build_stl_export_manifest(doc)

    expected = {"wall", "floor", "roof", "railing", "column", "beam", "ceiling", "balcony", "site"}
    assert expected.issubset(set(manifest["elementCountsByKind"]))
    assert "room" not in manifest["elementCountsByKind"]
    assert "slab_opening" not in manifest["elementCountsByKind"]
    assert manifest["coverage"]["excludedNonPrintableKindsPresent"]["room"] == 1
    assert manifest["coverage"]["excludedNonPrintableKindsPresent"]["slab_opening"] == 1


def test_stl_wall_honors_datums_location_line_and_hosted_door_cut() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl-0": LevelElem(kind="level", id="lvl-0", name="L0", elevationMm=1000),
            "lvl-1": LevelElem(kind="level", id="lvl-1", name="L1", elevationMm=4500),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                levelId="lvl-0",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 4000, "yMm": 0},
                thicknessMm=200,
                heightMm=2800,
                locationLine="finish-face-exterior",
                baseConstraintOffsetMm=200,
                topConstraintLevelId="lvl-1",
                topConstraintOffsetMm=300,
            ),
            "door-1": DoorElem(
                kind="door",
                id="door-1",
                wallId="wall-1",
                alongT=0.5,
                widthMm=1000,
            ),
        },
    )

    triangles = document_to_stl_triangles(doc)
    wall_vertices = [v for tri in triangles if tri.kind == "wall" for v in tri.vertices]
    xs = [v[0] for v in wall_vertices]
    ys = [v[1] for v in wall_vertices]
    zs = [v[2] for v in wall_vertices]

    assert min(xs) == pytest.approx(0)
    assert max(xs) == pytest.approx(4000)
    assert min(ys) == pytest.approx(-200)
    assert max(ys) == pytest.approx(0, abs=1e-4)
    assert min(zs) == pytest.approx(1200)
    assert max(zs) == pytest.approx(4800)
    assert {tri.kind for tri in triangles} == {"wall", "door"}


def test_stl_roof_uses_wall_top_eave_and_exports_dormer_proxy() -> None:
    doc = Document(
        revision=1,
        elements={
            "lvl": LevelElem(kind="level", id="lvl", name="L0", elevationMm=0),
            "wall-1": WallElem(
                kind="wall",
                id="wall-1",
                levelId="lvl",
                start={"xMm": 0, "yMm": 0},
                end={"xMm": 6000, "yMm": 0},
                thicknessMm=200,
                heightMm=3200,
            ),
            "roof-1": RoofElem(
                kind="roof",
                id="roof-1",
                referenceLevelId="lvl",
                footprintMm=[
                    {"xMm": 0, "yMm": 0},
                    {"xMm": 6000, "yMm": 0},
                    {"xMm": 6000, "yMm": 4000},
                    {"xMm": 0, "yMm": 4000},
                ],
                roofGeometryMode="gable_pitched_rectangle",
                overhangMm=0,
                slopeDeg=30,
            ),
            "dormer-1": DormerElem(
                kind="dormer",
                id="dormer-1",
                hostRoofId="roof-1",
                positionOnRoof={"alongRidgeMm": -1200, "acrossRidgeMm": 1200},
                widthMm=1200,
                depthMm=900,
                wallHeightMm=900,
                dormerRoofKind="shed",
            ),
        },
    )

    triangles = document_to_stl_triangles(doc)
    roof_vertices = [v for tri in triangles if tri.kind == "roof" for v in tri.vertices]
    dormer_vertices = [v for tri in triangles if tri.kind == "dormer" for v in tri.vertices]
    manifest = build_stl_export_manifest(doc)

    assert min(v[2] for v in roof_vertices) == pytest.approx(3200)
    assert max(v[2] for v in roof_vertices) > 4300
    assert min(v[2] for v in dormer_vertices) >= 3199.999
    assert manifest["elementCountsByKind"]["dormer"] == 1


def test_empty_document_exports_valid_empty_stl_and_empty_manifest() -> None:
    doc = Document(revision=1, elements={})
    blob = document_to_binary_stl_bytes(doc)
    manifest = build_stl_export_manifest(doc)

    assert len(blob) == 84
    assert _binary_triangle_count(blob) == 0
    assert manifest["readiness"] == "empty_model"
    assert manifest["triangleCount"] == 0
    assert manifest["boundsMm"] is None
    assert manifest["diagnostics"]["componentCountApprox"] == 0


@pytest.mark.asyncio
async def test_stl_export_routes_return_manifest_and_binary_stl(monkeypatch: pytest.MonkeyPatch) -> None:
    model_id = UUID("00000000-0000-4000-8000-0000000000a1")
    row = SimpleNamespace(revision=7, document=_wall_doc().model_dump(by_alias=True))

    async def load_row(_session: object, requested_id: UUID) -> object:
        assert requested_id == model_id
        return row

    monkeypatch.setattr(routes_exports, "load_model_row", load_row)

    manifest = await routes_exports.export_stl_manifest(model_id, session=object())  # type: ignore[arg-type]
    response = await routes_exports.export_model_stl_bundle(model_id, session=object())  # type: ignore[arg-type]

    assert manifest["triangleCount"] == 12
    assert response.media_type == "model/stl"
    assert response.headers["content-disposition"] == 'attachment; filename="model.stl"'
    assert _binary_triangle_count(response.body) == 12


@pytest.mark.asyncio
async def test_stl_export_route_returns_404_for_missing_model(monkeypatch: pytest.MonkeyPatch) -> None:
    async def load_row(_session: object, _requested_id: UUID) -> None:
        return None

    monkeypatch.setattr(routes_exports, "load_model_row", load_row)

    with pytest.raises(HTTPException) as exc:
        await routes_exports.export_model_stl_bundle(
            UUID("00000000-0000-4000-8000-0000000000ff"),
            session=object(),  # type: ignore[arg-type]
        )
    assert exc.value.status_code == 404


def test_export_link_map_includes_stl_artifacts() -> None:
    model_id = UUID("00000000-0000-4000-8000-0000000000b1")
    links = export_link_map(model_id)

    assert links["stlManifest"] == f"/api/models/{model_id}/exports/stl-manifest"
    assert links["stlModel"] == f"/api/models/{model_id}/exports/model.stl"
