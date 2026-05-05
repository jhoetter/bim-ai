"""Pure-Python helper for summarising a CI gate run — no subprocess execution."""
from __future__ import annotations

import hashlib
import json
from typing import Any

_SCHEMA_VERSION = "v1"


def summarize_ci_gate_run_v1(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Return a deterministic ciGateRunSummary_v1 manifest from per-gate result rows.

    Each row must contain at least {"name": str, "result": "ok" | "fail" | "warn"}.
    Verdict is "fail" when any row has result == "fail"; "warn" rows do not flip it.
    """
    gates = [dict(r) for r in rows]
    canonical = json.dumps(gates, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    has_failure = any(r.get("result") == "fail" for r in gates)
    return {
        "format": "ciGateRunSummary_v1",
        "schemaVersion": _SCHEMA_VERSION,
        "gates": gates,
        "aggregateDigestSha256": digest,
        "verdict": "fail" if has_failure else "pass",
    }
