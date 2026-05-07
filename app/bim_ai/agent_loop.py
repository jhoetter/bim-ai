"""AGT-01 — closed iterative-correction agent loop.

This module hosts the *server-side* patch generator used by the
``POST /api/models/:id/agent-iterate`` endpoint and the ``bim-ai
agent-loop`` CLI subcommand.

A single backend abstraction — ``generate_patch(request) -> response`` —
hides *how* the patch is produced. Selection is driven by the
``BIM_AI_AGENT_BACKEND`` environment variable:

* ``test`` (or unset in CI) — deterministic backend that extracts the
  first ```` ```json ... ``` `` code block from the goal markdown and
  returns it as the patch. Lets tests run without a live model.
* ``claude`` (default in production) — shells out to the ``claude`` CLI
  with the goal + snapshot + advisories as context. The CLI is expected
  to print a JSON object ``{ "commands": [...], "rationale": "...",
  "confidence": 0.0..1.0 }`` on stdout.

The "claude" backend is intentionally a thin wrapper: the loop only
needs deterministic JSON in / out, and shelling out keeps API-key
plumbing out of the server. Other backends can be added by extending
``_BACKENDS``.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

AGENT_BACKEND_ENV_VAR = "BIM_AI_AGENT_BACKEND"

# ---------------------------------------------------------------------------
# Wire types
# ---------------------------------------------------------------------------


class AgentIterateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    goal: str
    current_snapshot: dict[str, Any] = Field(
        default_factory=dict, alias="currentSnapshot"
    )
    current_validate: dict[str, Any] = Field(
        default_factory=dict, alias="currentValidate"
    )
    evidence: dict[str, Any] = Field(default_factory=dict)
    iteration: int = 0
    backend_override: str | None = Field(default=None, alias="backendOverride")


class AgentIterateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    patch: list[dict[str, Any]] = Field(default_factory=list)
    rationale: str = ""
    confidence: float = 0.0
    backend: str = "test"


# ---------------------------------------------------------------------------
# Backend implementations
# ---------------------------------------------------------------------------


_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)


def _extract_json_blocks(markdown: str) -> list[Any]:
    """Return every JSON value parsed from fenced code blocks in ``markdown``."""
    out: list[Any] = []
    for match in _FENCED_JSON_RE.finditer(markdown):
        body = match.group(1).strip()
        try:
            out.append(json.loads(body))
        except json.JSONDecodeError:
            continue
    return out


def _commands_from_blocks(blocks: list[Any]) -> tuple[list[dict[str, Any]], str, float]:
    """Pick out the first patch-shaped JSON block.

    Accepted shapes (in order):
      * ``{ "commands": [...], "rationale": "...", "confidence": 0.x }``
      * ``[ ... ]`` (treated as the bare command list)
      * ``{ "patch": [...] }``
    """
    for blk in blocks:
        if isinstance(blk, dict) and isinstance(blk.get("commands"), list):
            return (
                [c for c in blk["commands"] if isinstance(c, dict)],
                str(blk.get("rationale", "")),
                float(blk.get("confidence", 0.5)),
            )
        if isinstance(blk, dict) and isinstance(blk.get("patch"), list):
            return (
                [c for c in blk["patch"] if isinstance(c, dict)],
                str(blk.get("rationale", "")),
                float(blk.get("confidence", 0.5)),
            )
        if isinstance(blk, list):
            return (
                [c for c in blk if isinstance(c, dict)],
                "",
                0.5,
            )
    return ([], "", 0.0)


def _backend_test(request: AgentIterateRequest) -> AgentIterateResponse:
    """Deterministic backend: read commands from the first JSON block in ``goal``.

    A goal markdown shaped like::

        # Goal: place one level

        ```json
        {
          "commands": [
            { "type": "createLevel", "id": "lvl-g", "name": "G", "elevationMm": 0 }
          ],
          "rationale": "seed ground level",
          "confidence": 0.9
        }
        ```

    yields ``patch=[{ type: createLevel, ... }]`` deterministically.
    """
    blocks = _extract_json_blocks(request.goal)
    commands, rationale, confidence = _commands_from_blocks(blocks)
    return AgentIterateResponse(
        patch=commands,
        rationale=rationale or "test backend: extracted from goal markdown",
        confidence=confidence,
        backend="test",
    )


def _backend_claude(request: AgentIterateRequest) -> AgentIterateResponse:
    """Shell out to ``claude -p <prompt>`` and parse JSON from stdout."""
    prompt = (
        "You are a BIM-AI design assistant. Given the goal, snapshot and current "
        "validation advisories, return ONE JSON object inside a ```json code "
        "block with shape `{ \"commands\": [...], \"rationale\": \"...\", "
        "\"confidence\": 0.0..1.0 }`. The commands array uses the bim-ai "
        "command schema (see /api/schema).\n\n"
        f"## Goal\n{request.goal}\n\n"
        f"## Snapshot\n```json\n{json.dumps(request.current_snapshot)[:8000]}\n```\n\n"
        f"## Validate\n```json\n{json.dumps(request.current_validate)[:4000]}\n```\n\n"
        f"## Evidence\n```json\n{json.dumps(request.evidence)[:4000]}\n```\n"
    )
    try:
        proc = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "claude CLI not found on PATH; set BIM_AI_AGENT_BACKEND=test for "
            "deterministic fallback."
        ) from exc
    blocks = _extract_json_blocks(proc.stdout)
    commands, rationale, confidence = _commands_from_blocks(blocks)
    return AgentIterateResponse(
        patch=commands,
        rationale=rationale or proc.stdout.strip()[:400],
        confidence=confidence,
        backend="claude",
    )


_BACKENDS = {
    "test": _backend_test,
    "claude": _backend_claude,
}


def resolve_backend_name(override: str | None = None) -> str:
    """Pick the backend identifier; ``override`` wins, then env, then default."""
    name = (override or os.environ.get(AGENT_BACKEND_ENV_VAR) or "claude").strip()
    return name


def generate_patch(request: AgentIterateRequest) -> AgentIterateResponse:
    """Dispatch to the configured backend and return the patch payload."""
    name = resolve_backend_name(request.backend_override)
    impl = _BACKENDS.get(name)
    if impl is None:
        raise ValueError(
            f"Unknown agent backend {name!r}; known: {sorted(_BACKENDS)}"
        )
    return impl(request)


# ---------------------------------------------------------------------------
# Progress heuristic — used by the CLI loop to decide whether to continue
# ---------------------------------------------------------------------------


def count_blocking_advisories(validate_payload: dict[str, Any]) -> int:
    """Count violations whose severity is blocking (or 'high')."""
    violations = validate_payload.get("violations") or []
    if not isinstance(violations, list):
        return 0
    blocking = 0
    for v in violations:
        if not isinstance(v, dict):
            continue
        sev = str(v.get("severity") or v.get("level") or "").lower()
        if sev in {"blocking", "block", "error", "critical", "high"}:
            blocking += 1
    return blocking


def goal_keyword_overlap(goal: str, snapshot: dict[str, Any]) -> int:
    """Crude heuristic: number of distinct goal keywords present in snapshot.

    Used as a tie-breaker when blocking-advisory delta is zero.
    """
    keywords = {
        w.lower()
        for w in re.findall(r"[A-Za-z_][A-Za-z0-9_]{3,}", goal)
        if not w.isnumeric()
    }
    if not keywords:
        return 0
    elements = snapshot.get("elements")
    blob = json.dumps(elements).lower() if isinstance(elements, dict) else ""
    return sum(1 for kw in keywords if kw in blob)


def progress_score(
    request: AgentIterateRequest, snapshot: dict[str, Any], validate: dict[str, Any]
) -> int:
    """Higher = closer to goal.

    Score = (-blocking_advisories) * 100 + keyword_overlap. Negative weight
    on blocking advisories matches the AGT-01 spec ("fewer blocking
    advisories OR a model-side diff that matches goal keywords").
    """
    blocking = count_blocking_advisories(validate)
    overlap = goal_keyword_overlap(request.goal, snapshot)
    return -blocking * 100 + overlap


__all__ = [
    "AGENT_BACKEND_ENV_VAR",
    "AgentIterateRequest",
    "AgentIterateResponse",
    "count_blocking_advisories",
    "generate_patch",
    "goal_keyword_overlap",
    "progress_score",
    "resolve_backend_name",
]
