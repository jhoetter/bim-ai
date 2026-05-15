from __future__ import annotations

import struct
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException

from bim_ai import routes_exports
from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem
from bim_ai.evidence_manifest import export_link_map
from bim_ai.export_stl import (
    build_stl_export_manifest,
    document_to_ascii_stl,
    document_to_binary_stl_bytes,
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
