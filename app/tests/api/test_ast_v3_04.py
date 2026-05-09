"""AST-V3-04 — parametric kitchen kit tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.cmd.apply_bundle import apply_bundle as _apply_bundle
from bim_ai.cmd.types import CommandBundle
from bim_ai.document import Document
from bim_ai.elements import FamilyKitInstanceElem
from bim_ai.engine import ensure_internal_origin
from bim_ai.kits.kitchen import solve_chain

MODEL_ID = str(uuid.uuid4())

_VALID_ASSUMPTION = {
    "key": "ast_kit_test",
    "value": True,
    "confidence": 0.99,
    "source": "test",
}

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0}
_CREATE_WALL = {
    "type": "createWall",
    "id": "wall-1",
    "name": "Kitchen Wall",
    "levelId": "lvl-1",
    "start": {"xMm": 0, "yMm": 0},
    "end": {"xMm": 4200, "yMm": 0},
    "thicknessMm": 200,
    "heightMm": 2800,
}


def _build_test_app() -> FastAPI:
    _models: dict[str, dict[str, Any]] = {}

    def _seed(model_id: str) -> None:
        doc = Document(revision=1, elements={})  # type: ignore[arg-type]
        ensure_internal_origin(doc)
        _models[model_id] = {"revision": doc.revision, "doc": doc}

    _seed(MODEL_ID)

    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        bundle_raw = body.get("bundle")
        if bundle_raw is None:
            raise HTTPException(status_code=422, detail="bundle required")
        try:
            bundle = CommandBundle.model_validate(bundle_raw)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        stored = _models[model_id]
        doc = stored["doc"]
        bundle.parent_revision = doc.revision
        result, new_doc = _apply_bundle(doc, bundle, "commit")
        if result.applied and new_doc is not None:
            _models[model_id] = {"revision": new_doc.revision, "doc": new_doc}
        return {
            "accepted": result.applied,
            "revision": new_doc.revision
            if result.applied and new_doc is not None
            else doc.revision,
        }

    @app.get("/api/v3/models/{model_id}/snapshot")
    async def snapshot_route(model_id: str) -> Any:
        from fastapi import HTTPException

        if model_id not in _models:
            raise HTTPException(status_code=404)
        doc = _models[model_id]["doc"]
        return {"elements": {eid: el.model_dump(by_alias=True) for eid, el in doc.elements.items()}}

    @app.get("/api/v3/tools")
    async def list_tools() -> Any:
        from bim_ai.api.registry import get_catalog

        catalog = get_catalog()
        return {"tools": [{"name": t.name} for t in catalog.tools]}

    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_build_test_app())


def _bundle(cmds: list[dict], assumptions: list[dict] | None = None) -> dict:
    return {
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": cmds,
            "assumptions": assumptions or [_VALID_ASSUMPTION],
            "parentRevision": 0,
        }
    }


# ---------------------------------------------------------------------------
# Unit tests for solve_chain
# ---------------------------------------------------------------------------


def _make_kit(
    components: list[dict],
    start_mm: float = 0.0,
    end_mm: float = 4200.0,
) -> FamilyKitInstanceElem:
    from bim_ai.elements import KitComponent

    return FamilyKitInstanceElem(
        id="kit-1",
        kitId="kitchen_modular",
        hostWallId="wall-1",
        startMm=start_mm,
        endMm=end_mm,
        components=[KitComponent(**c) for c in components],
    )


def test_solve_chain_auto_fill_distributes_equally() -> None:
    """Two auto-fill bases share 4200 mm equally: each 2100 mm."""
    kit = _make_kit(
        [
            {"componentKind": "base"},
            {"componentKind": "base"},
        ]
    )
    result = solve_chain(kit)
    assert len(result) == 2
    assert result[0]["widthMm"] == pytest.approx(2100.0)
    assert result[1]["widthMm"] == pytest.approx(2100.0)
    assert result[0]["xStartMm"] == pytest.approx(0.0)
    assert result[1]["xStartMm"] == pytest.approx(2100.0)


def test_solve_chain_explicit_widths_sum_correctly() -> None:
    """All explicit widths -- positions accumulate without panic."""
    kit = _make_kit(
        [
            {"componentKind": "base", "widthMm": 600},
            {"componentKind": "oven_housing", "widthMm": 600},
            {"componentKind": "sink", "widthMm": 600},
            {"componentKind": "base", "widthMm": 600},
            {"componentKind": "dishwasher", "widthMm": 600},
            {"componentKind": "base", "widthMm": 600},
        ],
        end_mm=3600.0,
    )
    result = solve_chain(kit)
    assert len(result) == 6
    total = sum(r["widthMm"] for r in result)
    assert total == pytest.approx(3600.0)
    assert result[0]["xStartMm"] == pytest.approx(0.0)
    assert result[5]["xStartMm"] == pytest.approx(3000.0)


def test_solve_chain_mixed_explicit_and_auto() -> None:
    """Explicit base 600 mm + 1 auto-fill base: auto-fill gets 3600 mm."""
    kit = _make_kit(
        [
            {"componentKind": "base", "widthMm": 600},
            {"componentKind": "base"},
        ],
        end_mm=4200.0,
    )
    result = solve_chain(kit)
    assert result[1]["widthMm"] == pytest.approx(3600.0)


def test_solve_chain_countertop_excluded() -> None:
    """Countertop components are excluded from the resolved list."""
    kit = _make_kit(
        [
            {"componentKind": "countertop"},
            {"componentKind": "base", "widthMm": 4200},
        ]
    )
    result = solve_chain(kit)
    assert len(result) == 1
    assert result[0]["componentKind"] == "base"


def test_solve_chain_zero_run_returns_empty() -> None:
    """Zero or negative run returns empty list."""
    kit = _make_kit([{"componentKind": "base"}], start_mm=0, end_mm=0)
    assert solve_chain(kit) == []


def test_solve_chain_default_heights() -> None:
    """Default heights are set per component kind."""
    from bim_ai.kits.kitchen import BASE_HEIGHT_MM, UPPER_HEIGHT_MM

    kit = _make_kit(
        [
            {"componentKind": "base"},
            {"componentKind": "upper"},
        ]
    )
    result = solve_chain(kit)
    assert result[0]["heightMm"] == pytest.approx(BASE_HEIGHT_MM)
    assert result[1]["heightMm"] == pytest.approx(UPPER_HEIGHT_MM)


# ---------------------------------------------------------------------------
# Engine integration tests
# ---------------------------------------------------------------------------


def test_place_kit_stores_family_kit_instance(client: TestClient) -> None:
    """PlaceKitCmd stores a FamilyKitInstanceElem in the element store."""
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )
    assert r.status_code == 200
    assert r.json()["accepted"]

    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "place_kit",
                    "id": "kit-1",
                    "kitId": "kitchen_modular",
                    "hostWallId": "wall-1",
                    "startMm": 0,
                    "endMm": 4200,
                    "components": [
                        {"componentKind": "base", "widthMm": 600},
                        {"componentKind": "oven_housing", "widthMm": 600},
                        {"componentKind": "sink", "widthMm": 600},
                        {"componentKind": "base"},
                        {"componentKind": "base"},
                        {"componentKind": "dishwasher", "widthMm": 600},
                    ],
                }
            ]
        ),
    )
    assert r.status_code == 200
    assert r.json()["accepted"]

    snap = client.get(f"/api/v3/models/{MODEL_ID}/snapshot")
    assert snap.status_code == 200
    elements = snap.json()["elements"]
    assert "kit-1" in elements
    kit = elements["kit-1"]
    assert kit["kind"] == "family_kit_instance"
    assert kit["hostWallId"] == "wall-1"


def test_update_kit_component_patches_width(client: TestClient) -> None:
    """UpdateKitComponentCmd patches widthMm on component at index 1."""
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "place_kit",
                    "id": "kit-upd",
                    "kitId": "kitchen_modular",
                    "hostWallId": "wall-1",
                    "startMm": 0,
                    "endMm": 4200,
                    "components": [
                        {"componentKind": "base", "widthMm": 600},
                        {"componentKind": "oven_housing", "widthMm": 600},
                        {"componentKind": "sink", "widthMm": 600},
                    ],
                }
            ]
        ),
    )
    assert r.json()["accepted"]

    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "update_kit_component",
                    "id": "kit-upd",
                    "componentIndex": 1,
                    "widthMm": 900,
                }
            ]
        ),
    )
    assert r.status_code == 200
    assert r.json()["accepted"]

    snap2 = client.get(f"/api/v3/models/{MODEL_ID}/snapshot")
    updated_kit = snap2.json()["elements"]["kit-upd"]
    assert updated_kit["components"][1]["widthMm"] == pytest.approx(900.0)


def test_engine_raises_if_host_wall_not_found(client: TestClient) -> None:
    """Engine raises ValueError when hostWallId does not exist."""
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "place_kit",
                    "id": "kit-err-1",
                    "kitId": "kitchen_modular",
                    "hostWallId": "nonexistent-wall",
                    "startMm": 0,
                    "endMm": 4200,
                }
            ]
        ),
    )
    body = r.json()
    assert not body.get("accepted", True) or r.status_code >= 400


def test_engine_raises_if_component_index_out_of_range(client: TestClient) -> None:
    """Engine raises ValueError when componentIndex is out of range."""
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "place_kit",
                    "id": "kit-oor",
                    "kitId": "kitchen_modular",
                    "hostWallId": "wall-1",
                    "startMm": 0,
                    "endMm": 4200,
                    "components": [{"componentKind": "base", "widthMm": 600}],
                }
            ]
        ),
    )
    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "update_kit_component",
                    "id": "kit-oor",
                    "componentIndex": 999,
                    "widthMm": 600,
                }
            ]
        ),
    )
    body = r.json()
    assert not body.get("accepted", True) or r.status_code >= 400


def test_place_kitchen_kit_tool_in_registry(client: TestClient) -> None:
    """place-kitchen-kit descriptor is present in /api/v3/tools."""
    r = client.get("/api/v3/tools")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()["tools"]]
    assert "place-kitchen-kit" in names


def test_round_trip_family_kit_instance(client: TestClient) -> None:
    """Place + fetch snapshot: family_kit_instance present with correct kind + hostWallId."""
    client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle([_CREATE_LEVEL, _CREATE_WALL]),
    )

    r = client.post(
        f"/api/models/{MODEL_ID}/bundles",
        json=_bundle(
            [
                {
                    "type": "place_kit",
                    "id": "kit-rt",
                    "kitId": "kitchen_modular",
                    "hostWallId": "wall-1",
                    "startMm": 0,
                    "endMm": 4200,
                    "components": [
                        {"componentKind": "base", "widthMm": 600},
                        {"componentKind": "sink", "widthMm": 600},
                    ],
                }
            ]
        ),
    )
    assert r.json()["accepted"]

    snap = client.get(f"/api/v3/models/{MODEL_ID}/snapshot")
    elements = snap.json()["elements"]
    assert "kit-rt" in elements
    assert elements["kit-rt"]["kind"] == "family_kit_instance"
    assert elements["kit-rt"]["hostWallId"] == "wall-1"
