from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.api.registry import get_descriptor
from bim_ai.routes_api import api_router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(api_router)
    return TestClient(app)


def _valid_ir() -> dict:
    return {
        "schemaVersion": "sketch-understanding-ir.v0",
        "projectType": "single_family_house",
        "qualityTarget": "project_initiation_bim",
        "sourceInputs": {"images": ["sketch.png"]},
        "features": [
            {
                "id": "roof_terrace",
                "kind": "roof_opening_with_occupied_terrace",
                "visualPriority": "critical",
                "mustRenderInViews": ["main"],
            }
        ],
        "requiredViews": [{"id": "main", "kind": "3d", "purpose": "sketch match"}],
    }


def test_sketch_m3f_tool_descriptors_are_registered() -> None:
    expected = {
        "sketch.ir.validate": "implemented",
        "sketch.seed.compile": "unsupported",
        "sketch.phase.apply": "unsupported",
        "sketch.phase.accept": "implemented",
    }
    for name, status in expected.items():
        descriptor = get_descriptor(name)
        assert descriptor is not None
        assert descriptor.implementationStatus == status
        assert "sketch-to-bim" in descriptor.resourceGroups
        assert descriptor.restEndpoint.path.startswith("/api/v3/sketch/")


def test_sketch_ir_validate_route_returns_contract_result() -> None:
    response = _client().post("/api/v3/sketch/ir/validate", json={"ir": _valid_ir()})
    assert response.status_code == 200
    payload = response.json()
    assert payload["schemaVersion"] == "sketch.ir.validate.result.v0"
    assert payload["ok"] is True
    assert payload["summary"]["errorCount"] == 0
    assert "bim-ai sketch ir validate" in payload["cliEquivalent"]


def test_sketch_ir_validate_route_reports_schema_errors() -> None:
    ir = _valid_ir()
    ir["schemaVersion"] = "wrong"
    response = _client().post("/api/v3/sketch/ir/validate", json={"ir": ir})
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["issues"][0]["code"] == "schema_version"


def test_seed_compile_route_is_precisely_blocked() -> None:
    response = _client().post(
        "/api/v3/sketch/seed/compile",
        json={"recipe": {"schemaVersion": "seed-dsl.v0", "levels": []}},
    )
    assert response.status_code == 501
    detail = response.json()["detail"]
    assert detail["code"] == "backend_seed_compiler_blocked"
    assert "bim-ai sketch seed compile" in detail["cliEquivalent"]


def test_phase_apply_route_returns_transaction_delegation_blocker() -> None:
    response = _client().post(
        "/api/v3/sketch/phase/apply",
        json={
            "modelId": "model-1",
            "phaseId": "phase-1",
            "bundle": {"schemaVersion": "cmd-v3.0", "commands": [], "assumptions": []},
            "mode": "dry_run",
            "parentRevision": 7,
        },
    )
    assert response.status_code == 501
    detail = response.json()["detail"]
    assert detail["code"] == "backend_phase_apply_wrapper_blocked"
    assert detail["bundleRequest"]["bundle"]["parentRevision"] == 7


def test_phase_accept_route_blocks_stale_or_missing_evidence() -> None:
    response = _client().post(
        "/api/v3/sketch/phase/accept",
        json={
            "phaseId": "phase-1",
            "packet": {
                "coverage": {"summary": {"errorCount": 0}},
                "acceptanceGates": {"ok": True, "blockers": []},
                "evidenceHead": 4,
                "currentHead": 5,
            },
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is False
    assert payload["blockers"][0]["code"] == "stale_evidence_head"
