"""Tests for the request-ID middleware (BRT-62)."""

from __future__ import annotations

import os

import pytest


@pytest.fixture
def client():
    os.environ.setdefault("BIM_AI_SKIP_DB_INIT", "1")
    from fastapi.testclient import TestClient

    from bim_ai.main import app

    return TestClient(app)


def test_response_includes_request_id_header(client) -> None:
    response = client.get("/bill-of-rights")
    rid = response.headers.get("x-request-id")
    assert rid
    assert len(rid) >= 8


def test_client_provided_request_id_is_echoed(client) -> None:
    response = client.get("/bill-of-rights", headers={"X-Request-ID": "test-req-007"})
    assert response.headers["x-request-id"] == "test-req-007"


def test_blank_client_header_falls_back_to_minted_id(client) -> None:
    response = client.get("/bill-of-rights", headers={"X-Request-ID": "   "})
    assert response.headers["x-request-id"].strip() != ""
    assert response.headers["x-request-id"].strip() != ""
