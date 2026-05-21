"""v3 meta routes: visual compare, checkpoint, tool registry, advisor rules, version.

Routes mounted here cover ``/api/v3/compare``, ``/api/v3/skb/checkpoint``,
``/api/v3/tools``, ``/api/v3/advisor-rules``, ``/api/v3/commands``, and
``/api/v3/version``. Extracted from ``routes_api.py`` as part of the
sub-3000 LOC reduction tracker.
"""

from __future__ import annotations

# ruff: noqa: B008
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from bim_ai.advisor_rule_registry import advisor_rule_catalog_payload
from bim_ai.api.registry import get_catalog, get_descriptor
from bim_ai.command_schemas import export_command_schemas, get_command_schema

v3_meta_router = APIRouter()


def _descriptor_to_dict(d: Any) -> dict[str, Any]:
    from dataclasses import asdict

    return asdict(d)


# ---------------------------------------------------------------------------
# VG-V3-01 — Render-and-compare
# ---------------------------------------------------------------------------


@v3_meta_router.post("/v3/compare")
async def compare_snapshots_endpoint(body: dict) -> dict:
    """VG-V3-01 — Deterministic visual diff between two model snapshots.

    Accepts JSON body with snapshotA, snapshotB, and optional metric / threshold / region.
    Returns a CompareResult. Same inputs → byte-identical output.
    """
    snap_a = body.get("snapshotA")
    snap_b = body.get("snapshotB")
    if snap_a is None or snap_b is None:
        raise HTTPException(status_code=422, detail="snapshotA and snapshotB are required")
    metric = body.get("metric", "ssim")
    if metric not in ("ssim", "mse", "pixel-diff"):
        raise HTTPException(
            status_code=422,
            detail="metric must be one of: ssim, mse, pixel-diff",
        )
    threshold = body.get("threshold")
    region = body.get("region")
    from bim_ai.vg.compare import compare_snapshots

    return compare_snapshots(
        snap_a,
        snap_b,
        metric=metric,
        threshold=float(threshold) if threshold is not None else None,
        region=region,
    )


# ---------------------------------------------------------------------------
# SKB-03 — Visual Checkpoint
# ---------------------------------------------------------------------------


@v3_meta_router.post("/v3/skb/checkpoint")
async def skb_visual_checkpoint(body: dict) -> dict:
    """SKB-03 — visual checkpoint tool (image-to-image comparison).

    Accepts body with actualPng, targetPng, and optional threshold.
    Returns a CheckpointReport.
    """
    actual_png = body.get("actualPng")
    target_png = body.get("targetPng")
    threshold = body.get("threshold", 0.05)
    if not actual_png or not target_png:
        raise HTTPException(status_code=422, detail="actualPng and targetPng are required")

    from bim_ai.skb.visual_checkpoint import compare_pngs

    report = compare_pngs(actual_png, target_png, threshold=float(threshold))
    return report.to_dict()


@v3_meta_router.get("/v3/tools")
async def v3_list_tools() -> dict[str, Any]:
    catalog = get_catalog()
    return {
        "schemaVersion": catalog.schemaVersion,
        "tools": [_descriptor_to_dict(t) for t in catalog.tools],
    }


@v3_meta_router.get("/v3/tools/{name}")
async def v3_inspect_tool(name: str) -> dict[str, Any]:
    descriptor = get_descriptor(name)
    if descriptor is None:
        raise HTTPException(status_code=404, detail=f"Tool '{name}' not found in registry.")
    return _descriptor_to_dict(descriptor)


@v3_meta_router.get("/v3/advisor-rules")
async def v3_advisor_rules(
    profile: str | None = Query(default=None),
    surface: str | None = Query(default=None),
) -> dict[str, object]:
    return advisor_rule_catalog_payload(profile=profile, surface=surface)


@v3_meta_router.get("/v3/commands")
async def v3_list_command_schemas() -> dict[str, Any]:
    return export_command_schemas()


@v3_meta_router.get("/v3/commands/{name}")
async def v3_inspect_command_schema(name: str) -> dict[str, Any]:
    command_schema = get_command_schema(name)
    if command_schema is None:
        raise HTTPException(status_code=404, detail=f"Command '{name}' not found.")
    return command_schema


@v3_meta_router.get("/v3/version")
async def v3_api_version() -> dict[str, str]:
    import subprocess

    try:
        build_ref = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        build_ref = "unknown"
    return {"schemaVersion": "api-v3.0", "buildRef": build_ref}
