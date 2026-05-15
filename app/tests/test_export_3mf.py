from __future__ import annotations

import zipfile
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID

import pytest

from bim_ai import routes_exports
from bim_ai.document import Document
from bim_ai.elements import LevelElem, WallElem
from bim_ai.evidence_manifest import export_link_map
from bim_ai.export_3mf import (
    THREEMF_MODEL_PATH,
    build_3mf_export_manifest,
    document_to_3mf_bytes,
    document_to_3mf_model_xml,
)
from bim_ai.export_stl import stl_export_options


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


def test_document_to_3mf_bytes_has_required_package_parts() -> None:
    blob = document_to_3mf_bytes(_wall_doc())
    with zipfile.ZipFile(BytesIO(blob)) as zf:
        names = set(zf.namelist())
        assert "[Content_Types].xml" in names
        assert "_rels/.rels" in names
        assert THREEMF_MODEL_PATH in names
        model_xml = zf.read(THREEMF_MODEL_PATH).decode("utf-8")

    assert '<model unit="millimeter"' in model_xml
    assert '<object id="1" type="model" name="wall:wall-1">' in model_xml
    assert '<metadata name="bim-ai-kind">wall</metadata>' in model_xml
    assert model_xml.count("<triangle ") == 12
    assert 'z="3000"' in model_xml


def test_3mf_manifest_reuses_print_options_and_mesh_counts() -> None:
    options = stl_export_options(exclude_kinds="wall")
    manifest = build_3mf_export_manifest(_wall_doc(), options=options)

    assert manifest["format"] == "threeMfPrintExportManifest_v1"
    assert manifest["units"] == "millimeter"
    assert manifest["encoding"] == "3mf_zip"
    assert manifest["exportOptions"]["excludeKinds"] == ["wall"]
    assert manifest["objectCount"] == 0
    assert manifest["triangleCount"] == 0


def test_3mf_model_xml_is_deterministic() -> None:
    a = document_to_3mf_model_xml(_wall_doc())
    b = document_to_3mf_model_xml(_wall_doc())

    assert a == b


@pytest.mark.asyncio
async def test_3mf_export_routes_return_manifest_and_package(monkeypatch: pytest.MonkeyPatch) -> None:
    model_id = UUID("00000000-0000-4000-8000-0000000003a1")
    row = SimpleNamespace(revision=7, document=_wall_doc().model_dump(by_alias=True))

    async def load_row(_session: object, requested_id: UUID) -> object:
        assert requested_id == model_id
        return row

    monkeypatch.setattr(routes_exports, "load_model_row", load_row)

    manifest = await routes_exports.export_3mf_manifest(model_id, session=object())  # type: ignore[arg-type]
    response = await routes_exports.export_model_3mf_bundle(model_id, session=object())  # type: ignore[arg-type]

    assert manifest["triangleCount"] == 12
    assert response.media_type == "model/3mf"
    assert response.headers["content-disposition"] == 'attachment; filename="model.3mf"'
    with zipfile.ZipFile(BytesIO(response.body)) as zf:
        assert THREEMF_MODEL_PATH in zf.namelist()


def test_export_link_map_includes_3mf_artifacts() -> None:
    model_id = UUID("00000000-0000-4000-8000-0000000003b1")
    links = export_link_map(model_id)

    assert links["threeMfManifest"] == f"/api/models/{model_id}/exports/3mf-manifest"
    assert links["threeMfModel"] == f"/api/models/{model_id}/exports/model.3mf"
