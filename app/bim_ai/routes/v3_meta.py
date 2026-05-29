"""v3 meta routes: visual compare, checkpoint, tool registry, advisor rules, version.

Routes mounted here cover ``/api/v3/compare``, ``/api/v3/skb/checkpoint``,
``/api/v3/tools``, ``/api/v3/advisor-rules``, ``/api/v3/commands``, and
``/api/v3/version``. Extracted from ``routes_api.py`` as part of the
sub-3000 LOC reduction tracker.
"""

from __future__ import annotations

from typing import Annotated, Any

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
    profile: Annotated[str | None, Query()] = None,
    surface: Annotated[str | None, Query()] = None,
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


@v3_meta_router.post("/v3/models/delete")
async def v3_delete_models(body: dict) -> dict[str, Any]:
    """Cascade-delete every bim_models row matching `slug_like` (SQL LIKE pattern).

    Replaces the agent's direct asyncpg purge (testhouse_purge.py) with a
    REST endpoint. The MCP server exposes this as the `delete-models` tool.

    Body: `{slug_like: str, dry_run: bool = false}` — `slug_like` accepts
    SQL `%` wildcards. With `dry_run=true` reports targets without
    touching the DB.

    Cascade order (same as the old purge script):
      1. NULL parent_commit_id on bim_model_commits (self-FK)
      2. NULL snapshot_id on bim_model_commits (commits ↔ snapshots cycle)
      3. DELETE from bim_undo_stack, bim_redo_stack, bim_comments
      4. DELETE from bim_model_snapshots
      5. DELETE from activity_rows, milestones, role_assignments, public_links
      6. DELETE from bim_model_commits
      7. DELETE from bim_models WHERE slug LIKE :pat

    Returns `{removed: int, remaining: int, step_counts: {table: rows_affected}, target_count, dry_run}`.
    """
    from sqlalchemy import text

    from bim_ai.db import SessionMaker

    slug_like = body.get("slug_like")
    if not isinstance(slug_like, str) or not slug_like.strip():
        raise HTTPException(status_code=422, detail="slug_like is required")
    dry_run = bool(body.get("dry_run", False))

    counts: dict[str, int] = {}
    async with SessionMaker() as session:
        rs = await session.execute(
            text("SELECT id FROM bim_models WHERE slug LIKE :pat"), {"pat": slug_like}
        )
        targets = [str(r[0]) for r in rs.fetchall()]
        target_count = len(targets)

        if dry_run or not targets:
            return {
                "ok": True,
                "dry_run": dry_run,
                "target_count": target_count,
                "removed": 0,
                "remaining": target_count,
                "step_counts": {},
            }

        cascade = [
            ("bim_undo_stack",
             "DELETE FROM bim_undo_stack WHERE commit_id IN "
             "(SELECT id FROM bim_model_commits WHERE model_id = ANY(:ids))"),
            ("bim_redo_stack",
             "DELETE FROM bim_redo_stack WHERE commit_id IN "
             "(SELECT id FROM bim_model_commits WHERE model_id = ANY(:ids))"),
            ("bim_comments", "DELETE FROM bim_comments WHERE model_id = ANY(:ids)"),
            ("bim_model_commits.snapshot_id",
             "UPDATE bim_model_commits SET snapshot_id = NULL WHERE model_id = ANY(:ids)"),
            ("bim_model_commits.parent_commit_id",
             "UPDATE bim_model_commits SET parent_commit_id = NULL WHERE model_id = ANY(:ids)"),
            ("bim_model_snapshots", "DELETE FROM bim_model_snapshots WHERE model_id = ANY(:ids)"),
            ("activity_rows", "DELETE FROM activity_rows WHERE model_id = ANY(:ids)"),
            ("milestones", "DELETE FROM milestones WHERE model_id = ANY(:ids)"),
            ("role_assignments", "DELETE FROM role_assignments WHERE model_id = ANY(:ids)"),
            ("public_links", "DELETE FROM public_links WHERE model_id = ANY(:ids)"),
            ("bim_model_commits", "DELETE FROM bim_model_commits WHERE model_id = ANY(:ids)"),
            ("bim_models", "DELETE FROM bim_models WHERE id = ANY(:ids)"),
        ]
        for label, stmt in cascade:
            try:
                r = await session.execute(text(stmt), {"ids": targets})
                counts[label] = r.rowcount or 0
            except Exception as exc:  # noqa: BLE001
                counts[label] = -1
                counts[f"{label}__error"] = str(exc)[:200]
        await session.commit()

        rs = await session.execute(text("SELECT count(*) FROM bim_models"))
        remaining = int(rs.scalar() or 0)

    return {
        "ok": True,
        "dry_run": False,
        "target_count": target_count,
        "remaining": remaining,
        "removed": target_count - remaining,
        "step_counts": counts,
    }
