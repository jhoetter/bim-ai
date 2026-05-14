"""EXP-V3-01 — Render-pipeline export tool tests.

Tests cover:
- metadata-only → schemaVersion "exp-v3.0", no primaryAsset
- gltf → primaryAsset {kind:"gltf", pathInArchive:"model.glb"}
- gltf-pbr → primaryAsset kind "gltf"
- ifc-bundle → primaryAsset {kind:"ifc"}
- invalid format → 400
- viewId filter → cameras filtered to matching viewId
- viewpoint elements → cameras populated
- material elements → materials populated
- project_settings sun → sunSettings match
- exportTimestamp is valid ISO 8601
- empty model → empty cameras+materials, metadata present
- to_dict() keys are camelCase
"""

from __future__ import annotations

import re
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.document import Document
from bim_ai.engine import ensure_internal_origin
from bim_ai.exp.render_export import build_export_bundle

MODEL_ID = str(uuid.uuid4())

# ---------------------------------------------------------------------------
# Stub FastAPI app for REST endpoint tests
# ---------------------------------------------------------------------------


def _build_test_app() -> FastAPI:
    _models: dict[str, dict[str, Any]] = {}

    def _seed(model_id: str) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.get("/api/v3/models/{model_id}/export")
    async def export_render(
        model_id: str, format: str = "metadata-only", viewId: str | None = None
    ) -> Any:
        from fastapi import HTTPException

        from bim_ai.exp.render_export import build_export_bundle

        valid_formats = {"gltf", "gltf-pbr", "ifc-bundle", "metadata-only"}
        if format not in valid_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid export format '{format}'.",
            )
        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = _models[model_id]["doc"]
        elements_list = [v.model_dump(by_alias=True) for v in doc.elements.values()]
        model_state = {"elements": elements_list}
        bundle = build_export_bundle(model_state, format, view_id=viewId)  # type: ignore[arg-type]
        return bundle.to_dict()

    @app.post("/api/models/{model_id}/elements")
    async def set_elements(model_id: str, body: dict[str, Any]) -> Any:
        """Test helper — replace model elements dict."""
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        _models[model_id]["elements_override"] = body.get("elements", {})
        return {"ok": True}

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _get_export(client: TestClient, fmt: str = "metadata-only", view_id: str | None = None) -> dict:
    params: dict[str, str] = {"format": fmt}
    if view_id:
        params["viewId"] = view_id
    resp = client.get(f"/api/v3/models/{MODEL_ID}/export", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Unit tests — build_export_bundle + RenderExportBundle
# ---------------------------------------------------------------------------


class TestBuildExportBundleUnit:
    def test_metadata_only_schema_version(self) -> None:
        bundle = build_export_bundle({}, "metadata-only")
        d = bundle.to_dict()
        assert d["schemaVersion"] == "exp-v3.0"

    def test_metadata_only_no_primary_asset(self) -> None:
        bundle = build_export_bundle({}, "metadata-only")
        d = bundle.to_dict()
        assert d["primaryAsset"] is None

    def test_gltf_primary_asset(self) -> None:
        bundle = build_export_bundle({}, "gltf")
        d = bundle.to_dict()
        assert d["primaryAsset"] is not None
        assert d["primaryAsset"]["kind"] == "gltf"
        assert d["primaryAsset"]["pathInArchive"] == "model.glb"

    def test_gltf_pbr_primary_asset_kind_gltf(self) -> None:
        bundle = build_export_bundle({}, "gltf-pbr")
        d = bundle.to_dict()
        assert d["primaryAsset"] is not None
        assert d["primaryAsset"]["kind"] == "gltf"

    def test_ifc_bundle_primary_asset(self) -> None:
        bundle = build_export_bundle({}, "ifc-bundle")
        d = bundle.to_dict()
        assert d["primaryAsset"] is not None
        assert d["primaryAsset"]["kind"] == "ifc"
        assert d["primaryAsset"]["pathInArchive"] == "model.ifc"

    def test_viewpoint_elements_populate_cameras(self) -> None:
        model_state = {
            "elements": [
                {
                    "kind": "viewpoint",
                    "id": "vp-01",
                    "cameraState": {
                        "positionMm": {"xMm": 1.0, "yMm": 2.0, "zMm": 3.0},
                        "targetMm": {"xMm": 0.0, "yMm": 0.0, "zMm": 0.0},
                        "fovDeg": 55.0,
                    },
                }
            ]
        }
        bundle = build_export_bundle(model_state, "metadata-only")
        cameras = bundle.metadata["cameras"]
        assert len(cameras) == 1
        assert cameras[0]["viewId"] == "vp-01"
        assert cameras[0]["fovDeg"] == 55.0

    def test_saved_view_elements_populate_cameras(self) -> None:
        model_state = {
            "elements": [
                {
                    "kind": "saved_view",
                    "id": "sv-front",
                    "cameraState": {
                        "positionMm": {"xMm": 0.0, "yMm": -5000.0, "zMm": 1500.0},
                        "targetMm": {"xMm": 0.0, "yMm": 0.0, "zMm": 0.0},
                        "fovDeg": 60.0,
                    },
                }
            ]
        }
        bundle = build_export_bundle(model_state, "metadata-only")
        cameras = bundle.metadata["cameras"]
        assert len(cameras) == 1
        assert cameras[0]["viewId"] == "sv-front"

    def test_view_id_filter_cameras(self) -> None:
        model_state = {
            "elements": [
                {"kind": "saved_view", "id": "sv-a", "cameraState": {}},
                {"kind": "saved_view", "id": "sv-b", "cameraState": {}},
            ]
        }
        bundle = build_export_bundle(model_state, "metadata-only", view_id="sv-a")
        cameras = bundle.metadata["cameras"]
        assert len(cameras) == 1
        assert cameras[0]["viewId"] == "sv-a"

    def test_material_elements_populate_materials(self) -> None:
        model_state = {
            "elements": [
                {"kind": "material", "id": "mat-wood", "pbr": {"roughness": 0.8, "metalness": 0.0}},
                {
                    "kind": "material",
                    "id": "mat-steel",
                    "pbr": {"roughness": 0.2, "metalness": 1.0},
                },
            ]
        }
        bundle = build_export_bundle(model_state, "metadata-only")
        materials = bundle.metadata["materials"]
        assert len(materials) == 2
        ids = {m["id"] for m in materials}
        assert "mat-wood" in ids
        assert "mat-steel" in ids

    def test_gltf_material_manifest_includes_texture_maps_and_missing_assets(self) -> None:
        model_state = {
            "elements": [
                {
                    "kind": "material",
                    "id": "mat-brick",
                    "appearance": {"albedoMapId": "img-albedo", "normalMapId": "img-missing"},
                },
                {
                    "kind": "image_asset",
                    "id": "img-albedo",
                    "filename": "brick.png",
                    "mimeType": "image/png",
                    "byteSize": 1,
                    "contentHash": "sha256:a",
                    "mapUsageHint": "albedo",
                },
            ]
        }
        bundle = build_export_bundle(model_state, "gltf-pbr")
        material = bundle.metadata["materials"][0]
        assert material["textureMaps"]["albedo"] == "img-albedo"
        assert material["textureMaps"]["normal"] == "img-missing"
        assert bundle.metadata["missingMaterialAssets"] == [
            {"materialId": "mat-brick", "usage": "normal", "imageAssetId": "img-missing"}
        ]

    def test_project_settings_sun_overrides(self) -> None:
        model_state = {
            "elements": [
                {
                    "kind": "project_settings",
                    "id": "ps-01",
                    "sunAzimuthDeg": 270.0,
                    "sunElevationDeg": 30.0,
                }
            ]
        }
        bundle = build_export_bundle(model_state, "metadata-only")
        sun = bundle.metadata["sunSettings"]
        assert sun["azimuthDeg"] == 270.0
        assert sun["elevationDeg"] == 30.0

    def test_export_timestamp_iso_8601(self) -> None:
        bundle = build_export_bundle({}, "metadata-only")
        ts = bundle.to_dict()["exportTimestamp"]
        # Basic ISO 8601 pattern: YYYY-MM-DDTHH:MM:SSZ
        pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
        assert re.match(pattern, ts), f"exportTimestamp '{ts}' is not ISO 8601"

    def test_empty_model_metadata_present(self) -> None:
        bundle = build_export_bundle({}, "metadata-only")
        d = bundle.to_dict()
        assert "metadata" in d
        assert d["metadata"]["cameras"] == []
        assert d["metadata"]["materials"] == []
        assert d["metadata"]["annotations"] == []
        assert "sunSettings" in d["metadata"]

    def test_to_dict_keys_are_camel_case(self) -> None:
        bundle = build_export_bundle({}, "gltf")
        d = bundle.to_dict()
        # Top-level camelCase keys
        assert "schemaVersion" in d
        assert "primaryAsset" in d
        assert "exportTimestamp" in d
        # metadata keys
        assert "sunSettings" in d["metadata"]
        # primaryAsset keys
        assert "pathInArchive" in d["primaryAsset"]
        # No snake_case keys at top level
        assert "schema_version" not in d
        assert "primary_asset" not in d
        assert "export_timestamp" not in d


# ---------------------------------------------------------------------------
# REST endpoint tests
# ---------------------------------------------------------------------------


class TestRenderExportEndpoint:
    def test_metadata_only_returns_200(self, client: TestClient) -> None:
        d = _get_export(client, "metadata-only")
        assert d["schemaVersion"] == "exp-v3.0"
        assert d["format"] == "metadata-only"

    def test_gltf_returns_primary_asset(self, client: TestClient) -> None:
        d = _get_export(client, "gltf")
        assert d["primaryAsset"]["kind"] == "gltf"

    def test_invalid_format_returns_400(self, client: TestClient) -> None:
        resp = client.get(
            f"/api/v3/models/{MODEL_ID}/export",
            params={"format": "svg"},
        )
        assert resp.status_code == 400

    def test_model_not_found_returns_404(self, client: TestClient) -> None:
        resp = client.get(
            f"/api/v3/models/{uuid.uuid4()}/export",
            params={"format": "metadata-only"},
        )
        assert resp.status_code == 404
