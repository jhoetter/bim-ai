"""Tests for `bim_ai._errors.RouteError` (BRT-06)."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai._errors import RouteError, register_route_error_handler


def _app() -> TestClient:
    app = FastAPI()
    register_route_error_handler(app)

    @app.get("/raise-required")
    async def _raise_required() -> dict[str, str]:
        raise RouteError(code="missing_field", message="x is required", fields=["x"])

    @app.get("/raise-conflict")
    async def _raise_conflict() -> dict[str, str]:
        raise RouteError(
            code="model_locked",
            message="model has a pending revision",
            status=409,
            extra={"modelId": "m-1", "revision": 7},
        )

    @app.get("/raise-bare")
    async def _raise_bare() -> dict[str, str]:
        raise RouteError(code="unauthorized", message="auth required", status=401)

    return TestClient(app)


def test_route_error_envelope_shape() -> None:
    client = _app()
    response = client.get("/raise-required")
    assert response.status_code == 422
    assert response.json() == {
        "ok": False,
        "error": {
            "code": "missing_field",
            "message": "x is required",
            "status": 422,
            "fields": ["x"],
        },
    }


def test_route_error_extra_fields_merge() -> None:
    client = _app()
    response = client.get("/raise-conflict")
    assert response.status_code == 409
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "model_locked"
    assert body["error"]["status"] == 409
    assert body["error"]["modelId"] == "m-1"
    assert body["error"]["revision"] == 7


def test_route_error_omits_optional_fields() -> None:
    client = _app()
    response = client.get("/raise-bare")
    assert response.status_code == 401
    body = response.json()
    assert "fields" not in body["error"]
    # No extras → no extra keys beyond code/message/status
    assert set(body["error"].keys()) == {"code", "message", "status"}


def test_route_error_extra_cannot_override_core_keys() -> None:
    # If a caller passes extra={"code": "evil"} it must NOT shadow the
    # explicit code argument.
    err = RouteError(code="real", message="m", extra={"code": "evil", "extra_field": "ok"})
    envelope = err.to_envelope()
    assert envelope["error"]["code"] == "real"
    assert envelope["error"]["extra_field"] == "ok"
