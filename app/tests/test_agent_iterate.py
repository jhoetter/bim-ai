"""AGT-01 — endpoint shape + deterministic test backend.

Covers:
  * The "test" backend pulls commands from the first JSON code block in
    the goal markdown and ignores everything else (so CI is hermetic).
  * The endpoint wires the request through the backend and returns the
    canonical {patch, rationale, confidence, backend} payload.
  * Bad goal markdown (no JSON) is handled — empty patch, no crash.
  * The progress heuristic moves in the right direction.
"""

from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bim_ai.agent_loop import (
    AGENT_BACKEND_ENV_VAR,
    AgentIterateRequest,
    AgentIterateResponse,
    count_blocking_advisories,
    generate_patch,
    progress_score,
    resolve_backend_name,
)

GOAL_WITH_JSON = """\
# Goal — seed one level

Place a single ground level.

```json
{
  "commands": [
    { "type": "createLevel", "id": "lvl-g", "name": "G", "elevationMm": 0 }
  ],
  "rationale": "seed ground level",
  "confidence": 0.9
}
```
"""


GOAL_WITH_PATCH_KEY = """\
```json
{ "patch": [ { "type": "noop" } ], "rationale": "patch alias", "confidence": 0.4 }
```
"""


GOAL_WITH_BARE_LIST = """\
```json
[
  { "type": "createLevel", "id": "lvl-up", "name": "Upper", "elevationMm": 3000 },
  { "type": "createLevel", "id": "lvl-roof", "name": "Roof", "elevationMm": 6000 }
]
```
"""


GOAL_WITHOUT_JSON = "# Goal\n\nNo JSON here, just prose."


def test_test_backend_extracts_first_command_block() -> None:
    res = generate_patch(
        AgentIterateRequest(goal=GOAL_WITH_JSON, backendOverride="test")
    )
    assert isinstance(res, AgentIterateResponse)
    assert res.backend == "test"
    assert len(res.patch) == 1
    assert res.patch[0]["type"] == "createLevel"
    assert res.patch[0]["id"] == "lvl-g"
    assert res.rationale == "seed ground level"
    assert res.confidence == pytest.approx(0.9)


def test_test_backend_accepts_patch_key() -> None:
    res = generate_patch(
        AgentIterateRequest(goal=GOAL_WITH_PATCH_KEY, backendOverride="test")
    )
    assert res.patch == [{"type": "noop"}]
    assert res.rationale == "patch alias"


def test_test_backend_accepts_bare_command_list() -> None:
    res = generate_patch(
        AgentIterateRequest(goal=GOAL_WITH_BARE_LIST, backendOverride="test")
    )
    assert len(res.patch) == 2
    assert {c["id"] for c in res.patch} == {"lvl-up", "lvl-roof"}


def test_test_backend_returns_empty_patch_on_no_json() -> None:
    res = generate_patch(
        AgentIterateRequest(goal=GOAL_WITHOUT_JSON, backendOverride="test")
    )
    assert res.patch == []
    assert res.confidence == 0.0


def test_resolve_backend_name_prefers_override_over_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(AGENT_BACKEND_ENV_VAR, "claude")
    assert resolve_backend_name("test") == "test"
    monkeypatch.delenv(AGENT_BACKEND_ENV_VAR, raising=False)
    assert resolve_backend_name("test") == "test"


def test_resolve_backend_name_falls_back_to_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(AGENT_BACKEND_ENV_VAR, "test")
    assert resolve_backend_name() == "test"
    monkeypatch.delenv(AGENT_BACKEND_ENV_VAR, raising=False)
    assert resolve_backend_name() == "claude"  # documented default


def test_unknown_backend_raises() -> None:
    with pytest.raises(ValueError, match="Unknown agent backend"):
        generate_patch(AgentIterateRequest(goal="", backendOverride="not-real"))


def test_count_blocking_advisories_recognises_severities() -> None:
    payload = {
        "violations": [
            {"severity": "blocking"},
            {"severity": "high"},
            {"severity": "warn"},
            {"severity": "info"},
            {"severity": "ERROR"},
            "garbage-not-a-dict",
        ]
    }
    assert count_blocking_advisories(payload) == 3


def test_progress_score_rewards_keyword_overlap_and_penalises_blocking() -> None:
    goal = "Build a kitchen counter and sink in the model."
    snap_match = {"elements": {"el-1": {"kind": "wall", "name": "kitchen counter"}}}
    snap_empty: dict[str, object] = {"elements": {}}
    val_clean: dict[str, object] = {"violations": []}
    val_blocked: dict[str, object] = {"violations": [{"severity": "blocking"}]}
    req = AgentIterateRequest(goal=goal)

    s_match_clean = progress_score(req, snap_match, val_clean)
    s_empty_clean = progress_score(req, snap_empty, val_clean)
    s_match_blocked = progress_score(req, snap_match, val_blocked)

    assert s_match_clean > s_empty_clean
    assert s_match_blocked < s_match_clean


# --- endpoint integration ----------------------------------------------------


def _build_endpoint_app() -> FastAPI:
    """Endpoint test that bypasses the DB by mounting the route on a stub app."""
    from bim_ai.agent_loop import generate_patch as gp

    app = FastAPI()

    @app.post("/api/models/{model_id}/agent-iterate")
    async def agent_iterate_route(
        model_id: str, body: AgentIterateRequest
    ) -> dict[str, object]:
        # Match the production handler shape: backend is honored, model id is
        # echoed back via the response payload (so the test can assert it
        # without a DB).
        res = gp(body)
        out = res.model_dump(by_alias=True)
        out["modelId"] = model_id
        return out

    return app


def test_endpoint_returns_patch_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(AGENT_BACKEND_ENV_VAR, "test")
    client = TestClient(_build_endpoint_app())
    body = {
        "goal": GOAL_WITH_JSON,
        "currentSnapshot": {"elements": {}},
        "currentValidate": {"violations": []},
        "evidence": {"counts": {}},
        "iteration": 0,
    }
    res = client.post(
        "/api/models/00000000-0000-0000-0000-0000000000aa/agent-iterate",
        json=body,
    )
    assert res.status_code == 200
    out = res.json()
    assert out["backend"] == "test"
    assert isinstance(out["patch"], list) and len(out["patch"]) == 1
    assert out["patch"][0]["id"] == "lvl-g"
    assert out["rationale"] == "seed ground level"
    assert out["confidence"] == pytest.approx(0.9)


def test_endpoint_honors_backend_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(AGENT_BACKEND_ENV_VAR, raising=False)
    client = TestClient(_build_endpoint_app())
    res = client.post(
        "/api/models/00000000-0000-0000-0000-0000000000aa/agent-iterate",
        json={"goal": GOAL_WITH_JSON, "backendOverride": "test"},
    )
    assert res.status_code == 200
    assert res.json()["backend"] == "test"


def test_env_var_constant_is_documented() -> None:
    assert AGENT_BACKEND_ENV_VAR == "BIM_AI_AGENT_BACKEND"
    # Sanity: should also be the env var the implementation actually reads.
    os.environ.pop(AGENT_BACKEND_ENV_VAR, None)
