"""VG-V3-01 — render-and-compare tool tests."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_SNAPSHOT_A: dict[str, Any] = {
    "elements": {
        "wall-1": {"kind": "wall", "id": "wall-1"},
        "door-1": {"kind": "door", "id": "door-1"},
    }
}

_SNAPSHOT_B: dict[str, Any] = {
    "elements": {
        "wall-1": {"kind": "wall", "id": "wall-1"},
        "door-1": {"kind": "door", "id": "door-1"},
        "window-1": {"kind": "window", "id": "window-1"},
    }
}


def _build_test_app() -> FastAPI:
    app = FastAPI()

    @app.post("/api/v3/compare")
    async def compare_endpoint(body: dict[str, Any]) -> Any:
        from fastapi import HTTPException

        snap_a = body.get("snapshotA")
        snap_b = body.get("snapshotB")
        if snap_a is None or snap_b is None:
            raise HTTPException(status_code=422, detail="snapshotA and snapshotB are required")
        metric = body.get("metric", "ssim")
        if metric not in ("ssim", "mse", "pixel-diff"):
            raise HTTPException(
                status_code=422,
                detail="metric must be one of: ssim, mse, pixel-diff",
            )
        threshold = body.get("threshold")
        region = body.get("region")
        from bim_ai.vg.compare import compare_snapshots

        return compare_snapshots(
            snap_a,
            snap_b,
            metric=metric,
            threshold=float(threshold) if threshold is not None else None,
            region=region,
        )

    @app.get("/api/v3/tools")
    async def list_tools() -> Any:
        from bim_ai.api.registry import get_catalog

        catalog = get_catalog()
        return {
            "schemaVersion": catalog.schemaVersion,
            "tools": [
                {
                    "name": t.name,
                    "category": t.category,
                    "restEndpoint": {
                        "method": t.restEndpoint.method,
                        "path": t.restEndpoint.path,
                    },
                }
                for t in catalog.tools
            ],
        }

    return app


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(_build_test_app())


# ---------------------------------------------------------------------------
# Unit tests for compare_snapshots()
# ---------------------------------------------------------------------------


def test_identical_snapshots_ssim_near_one() -> None:
    """Identical snapshots → SSIM score close to 1."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_A, metric="ssim")
    assert result["schemaVersion"] == "vg-v3.0"
    assert result["metric"] == "ssim"
    assert result["score"] >= 0.99, f"Expected SSIM ≥ 0.99, got {result['score']}"


def test_identical_snapshots_pixel_diff_near_one() -> None:
    """Identical snapshots → pixel-diff score close to 1."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_A, metric="pixel-diff")
    assert result["score"] >= 0.99, f"Expected pixel-diff ≥ 0.99, got {result['score']}"


def test_identical_snapshots_mse_is_zero() -> None:
    """Identical snapshots → MSE score of 0.0."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_A, metric="mse")
    assert result["score"] == 0.0, f"Expected MSE = 0.0, got {result['score']}"


def test_deterministic_same_call_twice() -> None:
    """Same inputs produce byte-identical output (determinism)."""
    from bim_ai.vg.compare import compare_snapshots

    result1 = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_B, metric="ssim")
    result2 = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_B, metric="ssim")
    assert json.dumps(result1, sort_keys=True) == json.dumps(result2, sort_keys=True)


def test_different_snapshots_score_less_than_one() -> None:
    """Different snapshots → SSIM score < 1.0."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_B, metric="ssim")
    assert result["score"] < 1.0, (
        f"Expected score < 1.0 for different snapshots, got {result['score']}"
    )


def test_threshold_passed_when_score_meets_threshold() -> None:
    """thresholdPassed=True when SSIM on identical snapshots meets threshold."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_A, metric="ssim", threshold=0.9)
    assert result.get("thresholdPassed") is True


def test_threshold_failed_when_score_below_threshold() -> None:
    """thresholdPassed=False when different snapshots don't meet a strict threshold."""
    from bim_ai.vg.compare import compare_snapshots

    # Use very strict threshold (1.1 is impossible — always fails)
    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_B, metric="ssim", threshold=1.1)
    assert result.get("thresholdPassed") is False


def test_per_region_scores_key() -> None:
    """perRegionScores uses 'full' when no region specified."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_A, metric="ssim")
    assert "full" in result["perRegionScores"]


def test_per_region_scores_custom_region() -> None:
    """perRegionScores uses the named region key when region= is set."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_A, metric="ssim", region="north-facade")
    assert "north-facade" in result["perRegionScores"]


def test_result_keys_present() -> None:
    """All required CompareResult fields are present in output."""
    from bim_ai.vg.compare import compare_snapshots

    result = compare_snapshots(_SNAPSHOT_A, _SNAPSHOT_B, metric="ssim")
    for key in (
        "schemaVersion",
        "metric",
        "score",
        "perRegionScores",
        "prePngPath",
        "postPngPath",
        "diffPngPath",
    ):
        assert key in result, f"Missing key: {key}"


# ---------------------------------------------------------------------------
# REST endpoint tests
# ---------------------------------------------------------------------------


def test_post_compare_returns_valid_result(client: TestClient) -> None:
    """POST /api/v3/compare returns a valid CompareResult."""
    resp = client.post(
        "/api/v3/compare",
        json={"snapshotA": _SNAPSHOT_A, "snapshotB": _SNAPSHOT_B, "metric": "ssim"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["schemaVersion"] == "vg-v3.0"
    assert data["metric"] == "ssim"
    assert isinstance(data["score"], float)
    assert "perRegionScores" in data


def test_post_compare_missing_snapshot_returns_422(client: TestClient) -> None:
    """POST /api/v3/compare with missing snapshot returns 422."""
    resp = client.post("/api/v3/compare", json={"snapshotA": _SNAPSHOT_A})
    assert resp.status_code == 422


def test_post_compare_with_threshold(client: TestClient) -> None:
    """POST /api/v3/compare with threshold returns thresholdPassed."""
    resp = client.post(
        "/api/v3/compare",
        json={
            "snapshotA": _SNAPSHOT_A,
            "snapshotB": _SNAPSHOT_A,
            "metric": "ssim",
            "threshold": 0.9,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "thresholdPassed" in data
    assert data["thresholdPassed"] is True


def test_post_compare_mse_metric(client: TestClient) -> None:
    """POST /api/v3/compare with metric=mse on identical snapshots → score=0."""
    resp = client.post(
        "/api/v3/compare",
        json={"snapshotA": _SNAPSHOT_A, "snapshotB": _SNAPSHOT_A, "metric": "mse"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 0.0


# ---------------------------------------------------------------------------
# Tool registry tests
# ---------------------------------------------------------------------------


def test_compare_snapshots_tool_in_registry(client: TestClient) -> None:
    """compare-snapshots tool descriptor is present in /api/v3/tools."""
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    data = resp.json()
    tool_names = [t["name"] for t in data.get("tools", [])]
    assert "compare-snapshots" in tool_names, (
        f"'compare-snapshots' not found in tool registry. Available: {tool_names}"
    )


def test_compare_snapshots_tool_endpoint(client: TestClient) -> None:
    """compare-snapshots descriptor has the correct REST endpoint."""
    resp = client.get("/api/v3/tools")
    assert resp.status_code == 200
    data = resp.json()
    tool = next((t for t in data["tools"] if t["name"] == "compare-snapshots"), None)
    assert tool is not None
    assert tool["restEndpoint"]["method"] == "POST"
    assert tool["restEndpoint"]["path"] == "/api/v3/compare"
