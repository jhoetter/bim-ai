from __future__ import annotations

import base64

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.material_image_assets import ImageAssetUpload, build_image_asset_from_upload
from bim_ai.routes_api import api_router

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def test_build_image_asset_from_upload_hashes_dimensions_and_provenance() -> None:
    asset = build_image_asset_from_upload(
        ImageAssetUpload(
            filename="brick-albedo.png",
            mime_type="image/png",
            data=PNG_1X1,
            map_usage_hint="albedo",
            source="manufacturer",
            license="CC0",
            provenance="uploaded by test",
        )
    )

    assert asset.kind == "image_asset"
    assert asset.filename == "brick-albedo.png"
    assert asset.mime_type == "image/png"
    assert asset.width_px == 1
    assert asset.height_px == 1
    assert asset.content_hash.startswith("sha256:")
    assert asset.map_usage_hint == "albedo"
    assert asset.license == "CC0"
    assert asset.data_url is not None and asset.data_url.startswith("data:image/png;base64,")


def test_build_image_asset_rejects_unsupported_upload() -> None:
    with pytest.raises(ValueError, match="PNG, JPEG, or WebP"):
        build_image_asset_from_upload(
            ImageAssetUpload(
                filename="notes.txt",
                mime_type="text/plain",
                data=b"not an image",
                map_usage_hint="albedo",
            )
        )


def test_material_asset_upload_validation_route() -> None:
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    response = client.post(
        "/api/material-assets/validate-upload",
        files={"file": ("brick-albedo.png", PNG_1X1, "image/png")},
        data={"mapUsageHint": "albedo", "license": "CC0", "provenance": "unit test"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "image_asset"
    assert body["filename"] == "brick-albedo.png"
    assert body["mimeType"] == "image/png"
    assert body["widthPx"] == 1
    assert body["heightPx"] == 1
    assert body["mapUsageHint"] == "albedo"
    assert body["license"] == "CC0"


def test_material_asset_upload_validation_route_rejects_bad_usage() -> None:
    app = FastAPI()
    app.include_router(api_router)
    client = TestClient(app)

    response = client.post(
        "/api/material-assets/validate-upload",
        files={"file": ("brick-albedo.png", PNG_1X1, "image/png")},
        data={"mapUsageHint": "diffuse"},
    )

    assert response.status_code == 400
