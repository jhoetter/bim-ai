"""MF-mcp-2 — bundle commit must reject missing dryRunEvidence (issue #134).

The route used to silently demote ``mode="commit"`` to dry_run when an
agent/MCP caller forgot ``dryRunEvidence``; the only signal was buried at
``transactionPreflightAudit.mode``. We now emit a clean 422 with
``loc=["body", "dryRunEvidence"]`` and a directive message.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from bim_ai.engine_helpers import coerce_command
from bim_ai.routes.bundles import CommandBundleRequest

_CREATE_LEVEL = {"type": "createLevel", "id": "lvl-g", "name": "Ground", "elevationMm": 0}
_VALID_ASSUMPTION = {
    "key": "ground_level_mm",
    "value": 0,
    "confidence": 0.95,
    "source": "brief",
}
_BUNDLE_BODY = {
    "schemaVersion": "cmd-v3.0",
    "commands": [_CREATE_LEVEL],
    "assumptions": [_VALID_ASSUMPTION],
    "parentRevision": 1,
}
_VALID_DRY_RUN_EVIDENCE = {
    "schemaVersion": "dryRunEvidence_v1",
    "parentRevision": 1,
    "commandDigestSha256": "0" * 64,
    "ok": True,
}


# ---------------------------------------------------------------------------
# Unit-level: model validator
# ---------------------------------------------------------------------------


class TestCommandBundleRequestValidator:
    """The CommandBundleRequest model itself must reject the bad shape."""

    def test_agent_commit_without_evidence_is_rejected(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            CommandBundleRequest.model_validate(
                {
                    "bundle": _BUNDLE_BODY,
                    "mode": "commit",
                    "actorKind": "agent",
                }
            )
        errors = exc_info.value.errors(include_url=False)
        assert len(errors) == 1
        err = errors[0]
        assert err["loc"] == ("dryRunEvidence",)
        assert err["type"] == "missing"
        assert "mode='commit'" in err["msg"]
        assert "dryRunEvidence" in err["msg"]

    def test_mcp_client_commit_without_evidence_is_rejected(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            CommandBundleRequest.model_validate(
                {
                    "bundle": _BUNDLE_BODY,
                    "mode": "commit",
                    "actorKind": "mcp-client",
                }
            )
        errors = exc_info.value.errors(include_url=False)
        assert errors[0]["loc"] == ("dryRunEvidence",)

    def test_human_commit_without_evidence_is_allowed(self) -> None:
        # Humans were always allowed to commit directly — only agents/mcp
        # require dry-run replay.
        req = CommandBundleRequest.model_validate(
            {
                "bundle": _BUNDLE_BODY,
                "mode": "commit",
                "actorKind": "human",
            }
        )
        assert req.mode == "commit"
        assert req.actor_kind == "human"
        assert req.dry_run_evidence is None

    def test_agent_dry_run_without_evidence_is_allowed(self) -> None:
        # Dry-run is the workflow that *produces* the evidence; agents must be
        # able to call it without already having any.
        req = CommandBundleRequest.model_validate(
            {
                "bundle": _BUNDLE_BODY,
                "mode": "dry_run",
                "actorKind": "agent",
            }
        )
        assert req.mode == "dry_run"

    def test_agent_commit_with_evidence_is_allowed(self) -> None:
        req = CommandBundleRequest.model_validate(
            {
                "bundle": _BUNDLE_BODY,
                "mode": "commit",
                "actorKind": "agent",
                "dryRunEvidence": _VALID_DRY_RUN_EVIDENCE,
            }
        )
        assert req.dry_run_evidence == _VALID_DRY_RUN_EVIDENCE

    def test_unknown_mode_is_rejected_not_silently_demoted(self) -> None:
        # Pre-fix: the route would silently demote any non-{"dry_run","commit"}
        # value to "dry_run", which is how this bug manifested.
        with pytest.raises(ValidationError):
            CommandBundleRequest.model_validate(
                {"bundle": _BUNDLE_BODY, "mode": "COMMIT"}
            )


# ---------------------------------------------------------------------------
# Integration: real model behind a FastAPI route → 422 with correct loc
# ---------------------------------------------------------------------------


def _build_app() -> FastAPI:
    app = FastAPI()

    @app.post("/api/models/{model_id}/bundles")
    async def apply_bundle_route(model_id: str, body: CommandBundleRequest) -> dict[str, Any]:
        return {"applied": False, "mode": body.mode}

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_app())


class TestApplyBundleRoute422:
    def test_agent_commit_without_evidence_returns_422_with_correct_loc(
        self, client: TestClient
    ) -> None:
        res = client.post(
            "/api/models/00000000-0000-0000-0000-000000000001/bundles",
            json={
                "bundle": _BUNDLE_BODY,
                "mode": "commit",
                "actorKind": "agent",
            },
        )
        assert res.status_code == 422
        detail = res.json()["detail"]
        assert isinstance(detail, list)
        assert len(detail) >= 1
        # Find the dryRunEvidence-loc'd error
        evidence_errors = [
            err for err in detail if list(err.get("loc", [])) == ["body", "dryRunEvidence"]
        ]
        assert evidence_errors, f"expected dryRunEvidence loc, got: {detail}"
        err = evidence_errors[0]
        assert err["type"] == "missing"
        # Caller should be able to learn what to do from the msg alone.
        assert "mode='commit'" in err["msg"]
        assert "/dry-run" in err["msg"]

    def test_agent_commit_with_evidence_passes_validation(self, client: TestClient) -> None:
        res = client.post(
            "/api/models/00000000-0000-0000-0000-000000000001/bundles",
            json={
                "bundle": _BUNDLE_BODY,
                "mode": "commit",
                "actorKind": "agent",
                "dryRunEvidence": _VALID_DRY_RUN_EVIDENCE,
            },
        )
        assert res.status_code == 200
        assert res.json()["mode"] == "commit"

    def test_unknown_mode_returns_422_not_silent_demotion(self, client: TestClient) -> None:
        res = client.post(
            "/api/models/00000000-0000-0000-0000-000000000001/bundles",
            json={"bundle": _BUNDLE_BODY, "mode": "Commit"},
        )
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# Problem 3: bundle_apply_failed message must front-load loc / input_value
# ---------------------------------------------------------------------------


class TestCoerceCommandErrorFormat:
    """Pydantic's stringified discriminated-union ValidationError used to begin
    with a multi-thousand-character ``tagged-union[Cmd1,Cmd2,...]`` preamble
    that pushed loc=/input_value=/input_type= past the response truncation
    point. We now front-load the structured fields."""

    def test_unknown_command_type_message_is_short_and_structured(self) -> None:
        with pytest.raises(ValueError) as exc_info:
            coerce_command({"type": "createToposolid"})
        msg = str(exc_info.value)
        # Front-loaded: loc/input_value/input_type appear before any long list.
        assert "type=union_tag_invalid" in msg
        assert "input_value=" in msg
        assert "input_type=dict" in msg
        # The pre-fix preamble was ~3000 chars; the new message is well under.
        assert len(msg) < 1000, f"message too long ({len(msg)} chars): {msg[:200]}..."
        # The variant list is gone.
        assert "tagged-union[" not in msg
        # Caller can see what they tried.
        assert "createToposolid" in msg

    def test_missing_field_message_front_loads_loc(self) -> None:
        with pytest.raises(ValueError) as exc_info:
            coerce_command({"type": "createWall"})
        msg = str(exc_info.value)
        assert "type=missing" in msg
        # Pydantic stamps each missing-field error with loc=<variant>.<field>.
        assert "loc=createWall." in msg
        assert "tagged-union[" not in msg
        assert len(msg) < 2000
