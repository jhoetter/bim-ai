"""Tests for the per-house Wave 2 endpoints in routes_agent_runs.

The DB-touching surfaces (sessions/timeline) are covered by
test_agent_run_parser. Here we cover the filesystem-backed routes
against a synthetic ``tmp/reverse-bim/`` tree pointed at via the
BIM_AI_REVERSE_BIM_DIR env var.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bim_ai.routes.agent_runs import (
    _enumerate_iterations,
    _validate_capture_filename,
    _validate_house,
    _validate_iteration,
)
from fastapi import HTTPException


def _build_tree(root: Path) -> None:
    """Build a synthetic per-house artifact tree.

    Layout mirrors the real tmp/reverse-bim/ — see
    spec/agent-run-inspector-tracker.md "Data Sources".
    """

    (root / "house-alpha" / "understanding").mkdir(parents=True)
    (root / "house-alpha" / "understanding" / "existing-building-ir.json").write_text(
        json.dumps(
            {
                "format": "irV1",
                "extractedFacts": [
                    {"kind": "wall", "status": "accepted"},
                    {"kind": "wall", "status": "blocked"},
                    {"kind": "door", "status": "accepted"},
                ],
            }
        ),
        encoding="utf-8",
    )
    (root / "house-alpha" / "validation").mkdir(parents=True)
    (root / "house-alpha" / "validation" / "coordinate-frame-report.json").write_text("{}")
    (root / "house-alpha" / "rendered-pages" / "srcdoc-abc").mkdir(parents=True)
    (root / "house-alpha" / "ai-reading" / "responses" / "reader-pass-01").mkdir(parents=True)
    (root / "house-alpha" / "ai-reading" / "responses" / "reader-pass-02").mkdir(parents=True)

    # Two iterations with captures, one with a scoring report.
    (root / "iter-12-captures").mkdir(parents=True)
    (root / "iter-12-captures" / "alpha-3d-full.png").write_bytes(b"\x89PNG\r\nfake")
    (root / "iter-12-captures" / "alpha-3d-crop.png").write_bytes(b"\x89PNG\r\nfake")
    (root / "iter-12-captures" / "beta-3d-full.png").write_bytes(b"\x89PNG\r\nfake")
    (root / "iter-13-captures").mkdir(parents=True)
    (root / "iter-13-captures" / "alpha-3d-full.png").write_bytes(b"\x89PNG\r\nfake")
    (root / "iter-13-scoring").mkdir(parents=True)
    (root / "iter-13-scoring" / "alpha-subagent-report.md").write_text(
        "# alpha iter-13\nscore 6/10\n", encoding="utf-8"
    )


@pytest.fixture()
def fake_tree(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "reverse-bim"
    _build_tree(root)
    monkeypatch.setenv("BIM_AI_REVERSE_BIM_DIR", str(root))
    return root


@pytest.fixture()
def client(fake_tree: Path) -> TestClient:  # noqa: ARG001 — fixture autouses tree
    from bim_ai.main import app

    return TestClient(app)


def test_validate_house_accepts_known_set() -> None:
    assert _validate_house("alpha") == "alpha"


def test_validate_house_rejects_garbage() -> None:
    for bad in ("../escape", "AAAA", "alpha/", ""):
        with pytest.raises(HTTPException):
            _validate_house(bad)


def test_validate_iteration_normalizes() -> None:
    assert _validate_iteration("iter-12") == "iter-12"
    assert _validate_iteration("ITER-12B") == "iter-12b"


def test_validate_iteration_rejects_garbage() -> None:
    for bad in ("iter12", "12", "iter-foo", "../"):
        with pytest.raises(HTTPException):
            _validate_iteration(bad)


def test_validate_capture_filename_rejects_traversal() -> None:
    for bad in ("../alpha-3d-full.png", "alpha/3d.png", "..", "alpha-3d-full.tar"):
        with pytest.raises(HTTPException):
            _validate_capture_filename(bad)


def test_enumerate_iterations_orders_numerically(fake_tree: Path) -> None:
    items = _enumerate_iterations("alpha")
    assert [it["iteration"] for it in items] == ["iter-12", "iter-13"]
    iter13 = next(it for it in items if it["iteration"] == "iter-13")
    assert iter13["scoringReportPresent"] is True
    assert iter13["captures"] == ["alpha-3d-full.png"]
    assert iter13["captureCount"] == 1


def test_list_houses_endpoint(client: TestClient) -> None:
    res = client.get("/api/agent-runs/houses")
    assert res.status_code == 200
    payload = res.json()
    names = [item["name"] for item in payload["items"]]
    assert "alpha" in names
    alpha = next(item for item in payload["items"] if item["name"] == "alpha")
    assert alpha["present"] is True


def test_list_iterations_endpoint(client: TestClient) -> None:
    res = client.get("/api/agent-runs/houses/alpha/iterations")
    assert res.status_code == 200
    payload = res.json()
    assert payload["house"] == "alpha"
    assert [it["iteration"] for it in payload["iterations"]] == ["iter-12", "iter-13"]


def test_iteration_capture_served(client: TestClient) -> None:
    res = client.get(
        "/api/agent-runs/houses/alpha/iterations/iter-13/captures/alpha-3d-full.png"
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content.startswith(b"\x89PNG")


def test_iteration_capture_404_for_missing_file(client: TestClient) -> None:
    res = client.get(
        "/api/agent-runs/houses/alpha/iterations/iter-13/captures/alpha-elev-east-full.png"
    )
    assert res.status_code == 404


def test_iteration_capture_rejects_wrong_house_prefix(client: TestClient) -> None:
    res = client.get(
        "/api/agent-runs/houses/alpha/iterations/iter-12/captures/beta-3d-full.png"
    )
    # capture file exists but does not start with the path-house's prefix.
    assert res.status_code == 400


def test_scoring_endpoint_returns_markdown(client: TestClient) -> None:
    res = client.get("/api/agent-runs/houses/alpha/iterations/iter-13/scoring")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/markdown")
    assert "alpha iter-13" in res.text


def test_scoring_endpoint_404_when_missing(client: TestClient) -> None:
    res = client.get("/api/agent-runs/houses/alpha/iterations/iter-12/scoring")
    assert res.status_code == 404


def test_dashboard_endpoint_includes_fact_stats(client: TestClient) -> None:
    res = client.get("/api/agent-runs/houses/alpha/dashboard")
    assert res.status_code == 200
    payload = res.json()
    assert payload["house"] == "alpha"
    assert payload["present"] is True
    assert payload["factCountsByKind"] == {"wall": 2, "door": 1}
    assert payload["factCountsByStatus"] == {"accepted": 2, "blocked": 1}
    assert payload["factTotal"] == 3
    assert payload["renderedPageGroups"] == 1
    assert payload["readerPassCount"] == 2
    assert payload["validationReports"] == ["coordinate-frame-report.json"]
    assert len(payload["iterations"]) == 2
