"""Snapshot test for the FastAPI OpenAPI schema (BRT-07).

The schema is the API contract clients integrate against. This test
freezes the *paths* exposed by the app and the *response/request
model names* attached to them so that an accidental route removal,
shape change, or implicit-Any reintroduction fails CI.

Refresh the snapshot after an intentional API change:

    cd app && UPDATE_OPENAPI_SNAPSHOT=1 PYTHONPATH=. \\
        uv run python -m pytest tests/test_openapi_snapshot.py

The snapshot intentionally stores a *shape digest* rather than the
full schema:
- The full OpenAPI doc churns every time any tiny detail changes
  (e.g. Pydantic descriptions, internal model names), causing
  noisy diffs.
- The snapshot captures the things that genuinely break clients:
  the set of method+path tuples, and which Pydantic schema names
  are referenced. That is the contract.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import pytest

SNAPSHOT_PATH = Path(__file__).parent / "fixtures" / "openapi_snapshot.json"


def _build_app() -> Any:
    """Construct the FastAPI app without firing the lifespan db init."""
    os.environ.setdefault("BIM_AI_SKIP_DB_INIT", "1")
    # Importing here keeps the cost off the test collection phase for
    # the rest of the suite.
    from bim_ai.main import app

    return app


def _normalize_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Extract the breaking-change-sensitive subset of an OpenAPI doc.

    We keep:
    - `paths`: just the method names per path (the route surface)
    - For each path+method: the operationId, the request body model
      name (if any), and the 2xx response schema name (if any). Model
      names move only when someone renames a Pydantic class — exactly
      the signal we want.
    - `components.schemas`: just the sorted list of model names, not
      their full JSON-schema body. That body churns with descriptions
      and field re-orderings.
    """

    out: dict[str, Any] = {"paths": {}, "schemas": []}
    paths = schema.get("paths") or {}
    for path, methods in sorted(paths.items()):
        if not isinstance(methods, dict):
            continue
        out["paths"][path] = {}
        for method in sorted(methods.keys()):
            op = methods.get(method)
            if not isinstance(op, dict):
                continue
            entry: dict[str, Any] = {"operationId": op.get("operationId")}
            request_body = op.get("requestBody") or {}
            content = (request_body.get("content") or {}).get("application/json") or {}
            ref = (content.get("schema") or {}).get("$ref")
            if isinstance(ref, str):
                entry["requestModel"] = ref.split("/")[-1]
            responses = op.get("responses") or {}
            for code in ("200", "201", "default"):
                resp = responses.get(code)
                if not isinstance(resp, dict):
                    continue
                resp_content = (resp.get("content") or {}).get("application/json") or {}
                resp_ref = (resp_content.get("schema") or {}).get("$ref")
                if isinstance(resp_ref, str):
                    entry["responseModel"] = resp_ref.split("/")[-1]
                    break
            out["paths"][path][method] = entry
    schemas = (schema.get("components") or {}).get("schemas") or {}
    out["schemas"] = sorted(schemas.keys())
    return out


def _digest(payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def test_openapi_schema_snapshot_is_stable() -> None:
    app = _build_app()
    schema = app.openapi()
    normalized = _normalize_schema(schema)
    digest = _digest(normalized)
    payload = {"digest": digest, "shape": normalized}

    update = os.environ.get("UPDATE_OPENAPI_SNAPSHOT") == "1"
    if update or not SNAPSHOT_PATH.exists():
        SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_PATH.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        if not update:
            pytest.fail(
                "OpenAPI snapshot did not exist; created "
                f"{SNAPSHOT_PATH.relative_to(SNAPSHOT_PATH.parent.parent.parent)}. "
                "Re-run the suite to confirm the snapshot is the contract you want."
            )
        return

    stored = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    stored_digest = stored.get("digest")
    if stored_digest == digest:
        return

    # Build a focused diff message so the failure tells the operator
    # exactly which paths or models drifted.
    stored_shape = stored.get("shape") or {}
    stored_paths = set(stored_shape.get("paths", {}).keys())
    current_paths = set(normalized["paths"].keys())
    added_paths = sorted(current_paths - stored_paths)
    removed_paths = sorted(stored_paths - current_paths)
    stored_schemas = set(stored_shape.get("schemas", []))
    current_schemas = set(normalized["schemas"])
    added_schemas = sorted(current_schemas - stored_schemas)
    removed_schemas = sorted(stored_schemas - current_schemas)

    parts = ["OpenAPI schema digest drift."]
    if added_paths:
        parts.append(f"  + added paths ({len(added_paths)}):")
        parts.extend(f"      {p}" for p in added_paths[:20])
        if len(added_paths) > 20:
            parts.append(f"      … and {len(added_paths) - 20} more")
    if removed_paths:
        parts.append(f"  - removed paths ({len(removed_paths)}):")
        parts.extend(f"      {p}" for p in removed_paths[:20])
        if len(removed_paths) > 20:
            parts.append(f"      … and {len(removed_paths) - 20} more")
    if added_schemas:
        parts.append(f"  + added models ({len(added_schemas)}):")
        parts.extend(f"      {s}" for s in added_schemas[:20])
        if len(added_schemas) > 20:
            parts.append(f"      … and {len(added_schemas) - 20} more")
    if removed_schemas:
        parts.append(f"  - removed models ({len(removed_schemas)}):")
        parts.extend(f"      {s}" for s in removed_schemas[:20])
        if len(removed_schemas) > 20:
            parts.append(f"      … and {len(removed_schemas) - 20} more")
    if not (added_paths or removed_paths or added_schemas or removed_schemas):
        parts.append("  Method-level entries changed for an existing path.")
    parts.append("")
    parts.append("If this drift is intentional, refresh the snapshot:")
    parts.append(
        "    cd app && UPDATE_OPENAPI_SNAPSHOT=1 PYTHONPATH=. "
        "uv run python -m pytest tests/test_openapi_snapshot.py"
    )

    pytest.fail("\n".join(parts))
