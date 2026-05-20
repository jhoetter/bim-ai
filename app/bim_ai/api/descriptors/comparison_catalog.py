from __future__ import annotations

from bim_ai.api.registry_core import ExitCode, RestEndpoint, ToolDescriptor, register

register(
    ToolDescriptor(
        name="compare-snapshots",
        category="query",
        inputSchema={
            "type": "object",
            "required": ["snapshotA", "snapshotB"],
            "properties": {
                "snapshotA": {"type": "object", "description": "First model snapshot"},
                "snapshotB": {"type": "object", "description": "Second model snapshot"},
                "metric": {
                    "type": "string",
                    "enum": ["ssim", "mse", "pixel-diff"],
                    "default": "ssim",
                },
                "threshold": {"type": "number", "description": "Pass/fail threshold"},
                "region": {"type": "string", "description": "Named region mask"},
            },
        },
        outputSchema={
            "type": "object",
            "properties": {
                "schemaVersion": {"type": "string"},
                "metric": {"type": "string"},
                "score": {"type": "number"},
                "thresholdPassed": {"type": "boolean"},
                "perRegionScores": {"type": "object"},
            },
        },
        exitCodes={
            "ok": ExitCode(code=0, meaning="Comparison complete; score returned"),
            "threshold_fail": ExitCode(code=1, meaning="Score below threshold"),
        },
        cliExample="bim-ai compare pre.json post.json --metric ssim --threshold 0.7",
        restEndpoint=RestEndpoint(method="POST", path="/api/v3/compare"),
        sideEffects="none",
        agentSafetyNotes="Safe to call any number of times. Same inputs → byte-identical output.",
    )
)

# ---------------------------------------------------------------------------
# CTL-V3-01 — Catalog query
# ---------------------------------------------------------------------------

register(
    ToolDescriptor(
        name="catalog-query",
        category="query",
        inputSchema={
            "type": "object",
            "properties": {
                "kind": {
                    "type": "string",
                    "description": "Element kind to filter (e.g. 'door', 'window', 'sofa')",
                },
                "maxWidthMm": {"type": "number"},
                "minWidthMm": {"type": "number"},
                "tag": {"type": "string"},
                "style": {"type": "string"},
                "page": {"type": "integer", "default": 0},
                "pageSize": {"type": "integer", "default": 50},
            },
        },
        outputSchema={
            "type": "object",
            "properties": {
                "schemaVersion": {"type": "string"},
                "items": {"type": "array"},
                "total": {"type": "integer"},
                "page": {"type": "integer"},
                "pageSize": {"type": "integer"},
            },
        },
        exitCodes={"ok": ExitCode(code=0, meaning="Query successful")},
        cliExample="bim-ai catalog query --kind door --max-width 900 --output json",
        restEndpoint=RestEndpoint(method="GET", path="/api/v3/catalog"),
        sideEffects="none",
        agentSafetyNotes=(
            "Safe to call any number of times. Deterministic — same query → identical result. "
            "Use to discover catalog keys before emitting bundles."
        ),
    )
)
