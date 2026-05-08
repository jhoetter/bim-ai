"""MAT-V3-01 — Material PBR map slots + DecalElem tests.

Covers:
- UpdateMaterialPbrCmd patches albedoMapId and normalMapId on a material element.
- CreateDecalCmd stores a DecalElem with correct parentElementId, surface, uvRect.
- update-material-pbr tool descriptor present in /api/v3/tools.
- Engine raises for unknown material id.
- Round-trip: create decal → fetch snapshot → decal present with correct kind.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.api.registry import get_catalog
from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import DecalElem, MaterialElem
from bim_ai.engine import apply_inplace, ensure_internal_origin

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "mat_v3_01_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}
_CREATE_WALL = {
    "type": "createWall",
    "id": "wall-1",
    "levelId": "lvl-1",
    "start": {"xMm": 0, "yMm": 0},
    "end": {"xMm": 5000, "yMm": 0},
}

_BLOCKING_ADVISORY_CLASSES = {
    "revision_conflict",
    "assumption_log_required",
    "assumption_log_malformed",
    "assumption_log_duplicate_key",
    "direct_main_commit_forbidden",
    "option_routing_not_yet_implemented",
}


def _build_test_app() -> FastAPI:
    """Stub app with in-memory model store — no DB required."""
    _models: dict[str, dict[str, Any]] = {}

    def _seed(model_id: str, revision: int = 1) -> None:
        doc = Document(revision=revision, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")

        bundle_raw = body.get("bundle")
        if not isinstance(bundle_raw, dict):
            raise HTTPException(status_code=422, detail="bundle field required")

        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        mode_raw = body.get("mode", "dry_run")
        mode = mode_raw if mode_raw in ("dry_run", "commit") else "dry_run"

        doc = _models[model_id]["doc"]
        result, new_doc = _apply_bundle(doc, bundle, mode)  # type: ignore[arg-type]

        if not result.applied and result.violations:
            blocking_classes = {v.get("advisoryClass") for v in result.violations}
            if blocking_classes & _BLOCKING_ADVISORY_CLASSES:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "result": result.model_dump(by_alias=True),
                        "violations": result.violations,
                    },
                )

        if result.applied and result.new_revision is not None and new_doc is not None:
            _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}

        return result.model_dump(by_alias=True)

    @app.get("/api/models/{model_id}/snapshot")
    async def snapshot(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404, detail="Model not found")
        doc = _models[model_id]["doc"]
        elements_out = {eid: el.model_dump(by_alias=True) for eid, el in doc.elements.items()}
        return {"modelId": model_id, "revision": doc.revision, "elements": elements_out}

    @app.get("/api/v3/tools")
    async def list_tools() -> Any:
        from dataclasses import asdict

        catalog = get_catalog()
        return {
            "schemaVersion": catalog.schemaVersion,
            "tools": [asdict(t) for t in catalog.tools],
        }

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_test_app())


def _bundle(commands: list[dict[str, Any]], revision: int = 1) -> dict[str, Any]:
    return {
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": commands,
            "assumptions": [_VALID_ASSUMPTION],
            "parentRevision": revision,
        },
        "mode": "commit",
    }


def _make_doc_with_level_and_wall() -> Document:
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    from bim_ai.commands import CreateLevelCmd, CreateWallCmd
    from pydantic import TypeAdapter

    apply_inplace(doc, TypeAdapter(CreateLevelCmd).validate_python(_CREATE_LEVEL))
    apply_inplace(doc, TypeAdapter(CreateWallCmd).validate_python(_CREATE_WALL))
    return doc


# ---------------------------------------------------------------------------
# Unit-level engine tests (no HTTP layer)
# ---------------------------------------------------------------------------


def test_update_material_pbr_patches_map_ids() -> None:
    from bim_ai.commands import UpdateMaterialPbrCmd
    from pydantic import TypeAdapter

    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)

    # Pre-populate a MaterialElem
    mat = MaterialElem(kind="material", id="mat-1", name="Concrete")
    doc.elements["mat-1"] = mat

    cmd = TypeAdapter(UpdateMaterialPbrCmd).validate_python(
        {
            "type": "update_material_pbr",
            "id": "mat-1",
            "albedoMapId": "img-albedo-1",
            "normalMapId": "img-normal-1",
        }
    )
    apply_inplace(doc, cmd)

    updated = doc.elements["mat-1"]
    assert isinstance(updated, MaterialElem)
    assert updated.albedo_map_id == "img-albedo-1"
    assert updated.normal_map_id == "img-normal-1"
    assert updated.roughness_map_id is None


def test_update_material_pbr_raises_for_unknown_id() -> None:
    from bim_ai.commands import UpdateMaterialPbrCmd
    from pydantic import TypeAdapter

    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)

    cmd = TypeAdapter(UpdateMaterialPbrCmd).validate_python(
        {"type": "update_material_pbr", "id": "nonexistent-mat"}
    )
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(doc, cmd)


def test_create_decal_stores_elem() -> None:
    from bim_ai.commands import CreateDecalCmd
    from pydantic import TypeAdapter

    doc = _make_doc_with_level_and_wall()

    cmd = TypeAdapter(CreateDecalCmd).validate_python(
        {
            "type": "create_decal",
            "id": "decal-1",
            "parentElementId": "wall-1",
            "parentSurface": "front",
            "imageAssetId": "img-logo",
            "uvRect": {"u0": 0.1, "v0": 0.1, "u1": 0.5, "v1": 0.5},
            "opacity": 0.8,
        }
    )
    apply_inplace(doc, cmd)

    decal = doc.elements.get("decal-1")
    assert isinstance(decal, DecalElem)
    assert decal.parent_element_id == "wall-1"
    assert decal.parent_surface == "front"
    assert decal.image_asset_id == "img-logo"
    assert decal.uv_rect == {"u0": 0.1, "v0": 0.1, "u1": 0.5, "v1": 0.5}
    assert decal.opacity == pytest.approx(0.8)


def test_create_decal_raises_for_missing_parent() -> None:
    from bim_ai.commands import CreateDecalCmd
    from pydantic import TypeAdapter

    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)

    cmd = TypeAdapter(CreateDecalCmd).validate_python(
        {
            "type": "create_decal",
            "parentElementId": "nonexistent",
            "parentSurface": "front",
            "imageAssetId": "img-1",
            "uvRect": {"u0": 0.0, "v0": 0.0, "u1": 1.0, "v1": 1.0},
        }
    )
    with pytest.raises(ValueError, match="not found"):
        apply_inplace(doc, cmd)


# ---------------------------------------------------------------------------
# HTTP-level / round-trip tests
# ---------------------------------------------------------------------------


def test_update_material_pbr_tool_descriptor_in_catalog(client: TestClient) -> None:
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    tool_names = {t["name"] for t in resp.json()["tools"]}
    assert "update-material-pbr" in tool_names


def test_create_decal_round_trip(client: TestClient) -> None:
    # Step 1: seed level + wall
    resp = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )
    assert resp.status_code == 200

    # Step 2: create decal
    resp2 = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "create_decal",
                    "id": "decal-rt-1",
                    "parentElementId": "wall-1",
                    "parentSurface": "back",
                    "imageAssetId": "img-rt-logo",
                    "uvRect": {"u0": 0.0, "v0": 0.0, "u1": 1.0, "v1": 1.0},
                }
            ],
            revision=2,
        ),
    )
    assert resp2.status_code == 200

    # Step 3: snapshot should contain decal with correct kind
    snap = client.get(f"/api/models/{MODEL_ID}/snapshot")
    assert snap.status_code == 200
    elements = snap.json()["elements"]
    assert "decal-rt-1" in elements
    decal_data = elements["decal-rt-1"]
    assert decal_data["kind"] == "decal"
    assert decal_data["parentElementId"] == "wall-1"
    assert decal_data["parentSurface"] == "back"
    assert decal_data["imageAssetId"] == "img-rt-logo"
