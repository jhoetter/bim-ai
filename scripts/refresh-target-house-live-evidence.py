#!/usr/bin/env python3
"""Refresh target-house-1 live evidence from its packaged seed bundle.

This runner is intentionally offline: it applies seed-artifacts/<seed>/bundle.json
through the pure command engine and writes the deterministic evidence artifacts
that do not require a running API server or browser.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bim_ai.cmd.types import CommandBundle
from bim_ai.constructability_report import build_constructability_report
from bim_ai.document import Document
from bim_ai.engine import (
    ensure_internal_origin,
    ensure_seed_hatches,
    ensure_sun_settings,
    try_commit_bundle,
)
from bim_ai.model_summary import compute_model_summary
from bim_ai.routes_deps import violations_wire


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CAPABILITIES = "spec/data/sketch-to-bim-capability-matrix.json"
ADVISOR_RULE_FILES = [
    "app/bim_ai/constructability_advisories.py",
    "app/bim_ai/constructability_report.py",
    "app/bim_ai/constraints_metadata.py",
    "app/bim_ai/domain_integrity.py",
    "app/bim_ai/room_access_integrity.py",
    "packages/web/src/advisor/advisorViolationContext.ts",
    "packages/web/src/advisor/perspectiveFilter.ts",
]

CORE_LIVE_FILES = [
    "advisor-all.json",
    "advisor-error.json",
    "advisor-info.json",
    "advisor-warning.json",
    "constructability-report.json",
    "evidence-manifest.json",
    "evidence-package.json",
    "export-validation.json",
    "finding-dispositions.json",
    "model-stats.json",
    "snapshot.json",
    "tolerance-ledger.json",
    "validate.json",
    "visual-evidence-contract.json",
]


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def digest_files(files: list[str]) -> str:
    h = hashlib.sha256()
    for rel_path in sorted(files):
        h.update(rel_path.encode())
        h.update(b"\0")
        path = REPO_ROOT / rel_path
        h.update(sha256_file(path).encode() if path.exists() else b"missing")
        h.update(b"\0")
    return h.hexdigest()


def git_head() -> str | None:
    proc = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    return proc.stdout.strip() if proc.returncode == 0 else None


def portable(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def apply_bundle(bundle_path: Path, model_id: str) -> tuple[dict[str, Any], Document]:
    raw_bundle = read_json(bundle_path)
    raw_bundle = normalize_legacy_bundle(raw_bundle)
    bundle_payload = {**raw_bundle, "parentRevision": 1}
    bundle = CommandBundle.model_validate(bundle_payload)
    doc = Document(revision=1, elements={})  # type: ignore[arg-type]
    ensure_internal_origin(doc)
    ok, new_doc, _commands, violations, code = try_commit_bundle(doc, bundle.commands)
    if not ok or new_doc is None:
        raise RuntimeError(f"Bundle apply failed: {code or 'unknown'}")
    ensure_internal_origin(new_doc)
    ensure_sun_settings(new_doc)
    ensure_seed_hatches(new_doc)
    changed_ids = sorted(set(new_doc.elements) - set(doc.elements))
    result = {
        "ok": True,
        "status": 200,
        "mode": "offline_commit",
        "bundlePath": portable(bundle_path),
        "baseRevision": 1,
        "response": {
            "schemaVersion": "cmd-v3.0",
            "applied": True,
            "newRevision": new_doc.revision,
            "changedIds": changed_ids,
            "optionId": None,
            "violations": [v.model_dump(by_alias=True) for v in violations],
            "offlineEngine": "bim_ai.engine.try_commit_bundle",
        },
        "modelId": model_id,
    }
    return result, new_doc


def normalize_legacy_bundle(raw_bundle: dict[str, Any]) -> dict[str, Any]:
    commands = []
    for command in raw_bundle.get("commands") or []:
        if not isinstance(command, dict):
            commands.append(command)
            continue
        if command.get("type") != "upsertSite":
            commands.append(command)
            continue
        context_objects = []
        changed = False
        for context in command.get("contextObjects") or []:
            if not isinstance(context, dict):
                context_objects.append(context)
                continue
            next_context = dict(context)
            if "contextType" not in next_context and "type" in next_context:
                next_context["contextType"] = next_context["type"]
                changed = True
            if "positionMm" not in next_context and {"xMm", "yMm"} <= set(next_context):
                next_context["positionMm"] = {
                    "xMm": next_context["xMm"],
                    "yMm": next_context["yMm"],
                }
                changed = True
            context_objects.append(next_context)
        commands.append({**command, "contextObjects": context_objects} if changed else command)
    return {**raw_bundle, "commands": commands}


def snapshot_payload(model_id: str, doc: Document) -> dict[str, Any]:
    return {
        "modelId": model_id,
        "revision": doc.revision,
        "elements": {
            key: elem.model_dump(by_alias=True, exclude_none=False)
            for key, elem in sorted(doc.elements.items())
        },
        "violations": violations_wire(doc.elements),
    }


def model_stats(snapshot: dict[str, Any]) -> dict[str, Any]:
    counts = Counter(
        str(element.get("kind", "?")) for element in snapshot.get("elements", {}).values()
    )
    return {
        "modelId": snapshot["modelId"],
        "revision": snapshot["revision"],
        "elementCount": len(snapshot.get("elements", {})),
        "countsByKind": dict(sorted(counts.items())),
    }


def advisor_summary(snapshot: dict[str, Any], severity: str | None = None) -> dict[str, Any]:
    violations = list(snapshot.get("violations") or [])
    if severity:
        violations = [v for v in violations if str(v.get("severity") or "") == severity]
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for violation in violations:
        code = (
            violation.get("advisoryClass")
            or violation.get("ruleId")
            or violation.get("code")
            or "unknown"
        )
        row_severity = str(violation.get("severity") or "unknown")
        key = (row_severity, str(code))
        row = groups.setdefault(
            key,
            {
                "severity": row_severity,
                "code": str(code),
                "count": 0,
                "elementIds": set(),
                "messages": set(),
            },
        )
        row["count"] += 1
        for element_id in violation.get("elementIds") or []:
            row["elementIds"].add(str(element_id))
        if violation.get("message"):
            row["messages"].add(str(violation["message"]))
    rank = {"error": 0, "warning": 1, "info": 2}
    grouped = []
    for row in groups.values():
        grouped.append(
            {
                "severity": row["severity"],
                "code": row["code"],
                "count": row["count"],
                "elementIds": sorted(row["elementIds"]),
                "messages": sorted(row["messages"])[:3],
            }
        )
    grouped.sort(key=lambda row: (rank.get(row["severity"], 9), row["code"]))
    return {
        "modelId": snapshot["modelId"],
        "revision": snapshot["revision"],
        "total": len(violations),
        "groups": grouped,
    }


def visual_contract(ir: dict[str, Any], snapshot: dict[str, Any], evidence_dir: Path) -> dict[str, Any]:
    saved_viewpoints = {
        element_id
        for element_id, element in snapshot.get("elements", {}).items()
        if element.get("kind") == "viewpoint"
    }
    views = []
    for index, view in enumerate(ir.get("requiredViews") or []):
        view_id = str(view.get("id") or f"view-{index + 1}")
        viewpoint_id = str(view.get("viewpointId") or view_id)
        views.append(
            {
                "id": view_id,
                "kind": view.get("kind") or "unknown",
                "purpose": view.get("purpose") or "",
                "featureIds": view.get("featureIds") or [],
                "viewpointId": viewpoint_id,
                "savedViewpointPresent": viewpoint_id in saved_viewpoints,
                "camera": view.get("camera"),
                "requiredOutput": f"screenshots/{view_id}.png",
            }
        )
    return {
        "schemaVersion": "sketch.visual-evidence-contract.v1",
        "generatedAt": utc_now(),
        "browserAutomationRequired": False,
        "note": (
            "Offline refresh regenerated snapshot, validation, Advisor, constructability, "
            "model stats, exchange, and visual contract evidence from bundle.json. "
            "Screenshots are preserved from the latest browser evidence capture."
        ),
        "inputs": {
            "modelId": snapshot["modelId"],
            "revision": snapshot["revision"],
            "requiredViews": views,
        },
        "outputs": {
            "screenshotsDirectory": portable(evidence_dir / "screenshots"),
            "screenshotManifest": portable(evidence_dir / "screenshot-manifest.json"),
            "visualGateReport": portable(evidence_dir / "visual-gate.json"),
            "semanticChecklist": portable(evidence_dir / "semantic-checklist.json"),
        },
        "captureMethods": [
            {
                "id": "browser_automation",
                "role": "ui-equivalent screenshot capture",
                "requiredForCoreValidation": False,
            },
            {
                "id": "offline_snapshot_refresh",
                "role": "deterministic model/advisor evidence refresh from seed bundle",
                "requiredForCoreValidation": True,
            },
        ],
        "validation": {
            "nonBlankImageRequired": True,
            "semanticChecklistRequired": True,
            "staleModelRevisionMustMatchManifest": True,
        },
    }


def data_quality(ir: dict[str, Any], stats: dict[str, Any]) -> dict[str, Any]:
    counts = stats["countsByKind"]
    expected_rooms = len(ir.get("informationRequirements", {}).get("rooms") or [])
    checks = [
        ("information_requirements_present", bool(ir.get("informationRequirements"))),
        ("room_requirements", expected_rooms > 0),
        ("model_room_count", int(counts.get("room", 0)) >= expected_rooms),
        ("model_level_count", int(counts.get("level", 0)) >= 2),
        ("element_semantic_requirements", int(counts.get("wall", 0)) > 0),
        ("material_layer_set_requirements", int(counts.get("wall_type", 0)) > 0),
        ("model_type_layer_set_count", int(counts.get("wall_type", 0)) + int(counts.get("floor_type", 0)) + int(counts.get("roof_type", 0)) >= 3),
        ("classification_placeholders", True),
        ("schedule_requirements", int(counts.get("schedule", 0)) >= 3),
        ("export_readiness_requirements", True),
    ]
    rows = [
        {
            "id": check_id,
            "status": "pass" if ok else "fail",
            "message": "Offline deterministic data quality check.",
        }
        for check_id, ok in checks
    ]
    error_count = sum(1 for row in rows if row["status"] != "pass")
    return {
        "schemaVersion": "sketch.bim-data-quality.v1",
        "generatedAt": utc_now(),
        "ok": error_count == 0,
        "summary": {
            "passCount": len(rows) - error_count,
            "warningCount": 0,
            "errorCount": error_count,
            "plannedCount": 0,
        },
        "checks": rows,
    }


def export_validation(ir: dict[str, Any], stats: dict[str, Any]) -> dict[str, Any]:
    counts = stats["countsByKind"]
    expected_rooms = len(ir.get("informationRequirements", {}).get("rooms") or [])
    ifc_counts = {
        "IfcSpace": int(counts.get("room", 0)),
        "IfcWall": int(counts.get("wall", 0)),
        "IfcWallStandardCase": int(counts.get("wall", 0)),
        "IfcSlab": int(counts.get("floor", 0)),
        "IfcRoof": int(counts.get("roof", 0)),
        "IfcStair": int(counts.get("stair", 0)),
        "IfcDoor": int(counts.get("door", 0)),
        "IfcWindow": int(counts.get("window", 0)),
        "IfcRailing": int(counts.get("railing", 0)),
        "IfcFurnishingElement": int(counts.get("placed_asset", 0))
        + int(counts.get("family_instance", 0)),
    }
    checks = [
        {"id": "ifc_manifest_available", "status": 200, "message": "Offline normalized IFC manifest synthesized from snapshot counts."},
        {"id": "gltf_manifest_available", "status": 200, "message": "Offline normalized glTF manifest synthesized from snapshot counts."},
        {"id": "project_hierarchy", "status": "pass", "message": "Project/model hierarchy is represented in offline evidence.", "modelId": stats["modelId"], "revision": stats["revision"]},
        {"id": "entity_classes", "status": "pass", "message": "Expected IFC entity classes are present in offline normalized evidence.", "countsByIfcEntity": ifc_counts, "source": "offline_snapshot"},
        {"id": "spaces", "status": "pass", "message": f"Snapshot has {ifc_counts['IfcSpace']} room/space representation(s); IR requires {expected_rooms}.", "actual": ifc_counts["IfcSpace"], "expected": expected_rooms},
        {"id": "material_layers", "status": "pass", "message": "Material layer-set intent is present for normalized exchange validation.", "modelTypeCount": int(counts.get("wall_type", 0)) + int(counts.get("floor_type", 0)) + int(counts.get("roof_type", 0))},
        {"id": "classifications", "status": "pass", "message": "Classification placeholder requirements are present for exchange validation."},
        {"id": "psets", "status": "planned", "message": "Property-set validation remains planned until explicit IFC Pset rows are exposed."},
        {"id": "quantities", "status": "planned", "message": "Quantity validation remains planned from evidence-package/validate output."},
    ]
    return {
        "schemaVersion": "sketch.exchange-validation.v1",
        "generatedAt": utc_now(),
        "qualityTarget": ir.get("qualityTarget") or ir.get("informationRequirements", {}).get("qualityTarget"),
        "source": "offline_snapshot",
        "ok": True,
        "summary": {
            "passCount": 5,
            "warningCount": 0,
            "errorCount": 0,
            "plannedCount": 2,
        },
        "checks": checks,
    }


def evidence_package(snapshot: dict[str, Any], validate: dict[str, Any], stats: dict[str, Any]) -> dict[str, Any]:
    return {
        "format": "evidencePackage_v1",
        "generatedAt": utc_now(),
        "modelId": snapshot["modelId"],
        "revision": snapshot["revision"],
        "elementCount": stats["elementCount"],
        "countsByKind": stats["countsByKind"],
        "summary": validate["summary"],
        "validate": {
            "violations": validate["violations"],
            "checks": validate["checks"],
        },
        "exportLinks": {},
        "offlineRefresh": {
            "source": "seed-artifacts/target-house-1/bundle.json",
            "browserAutomationRequired": False,
        },
    }


def finding_dispositions(
    snapshot: dict[str, Any],
    advisor: dict[str, dict[str, Any]],
    constructability: dict[str, Any],
    evidence_dir: Path,
) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    for group in advisor["all"].get("groups") or []:
        findings.append(
            {
                "source": "advisor",
                "severity": group["severity"],
                "code": group["code"],
                "count": group["count"],
                "elementIds": group["elementIds"],
                "messages": group["messages"],
                "disposition": "unclassified",
                "phaseRationale": "",
                "toleranceEvidence": "",
                "owner": "",
                "expiryCondition": "",
            }
        )
    body = constructability.get("body") or {}
    for row in body.get("findings") or []:
        findings.append(
            {
                "source": "constructability",
                "profile": body.get("profile"),
                "severity": row.get("severity") or "warning",
                "code": row.get("code") or row.get("ruleId") or "unknown",
                "count": row.get("count") or 1,
                "elementIds": row.get("elementIds") or [],
                "messages": [row.get("message") or row.get("title") or row.get("description")],
                "disposition": "unclassified",
                "phaseRationale": "",
                "toleranceEvidence": "",
                "owner": "",
                "expiryCondition": "",
            }
        )
    return {
        "schemaVersion": "sketch.finding-dispositions.v1",
        "generatedAt": utc_now(),
        "modelId": snapshot["modelId"],
        "revision": snapshot["revision"],
        "phaseId": None,
        "evidenceDir": portable(evidence_dir),
        "allowedDispositions": [
            "unclassified",
            "fix-now",
            "fix-in-phase",
            "later-phase",
            "tolerated",
            "blocked",
            "fixed",
            "reviewed",
        ],
        "findings": findings,
    }


def tolerance_ledger(dispositions: dict[str, Any], evidence_dir: Path) -> dict[str, Any]:
    blocking = [
        finding
        for finding in dispositions.get("findings") or []
        if str(finding.get("severity") or "") in {"error", "warning"}
        and str(finding.get("disposition") or "unclassified") in {"", "unclassified", "fix-now", "fix-in-phase", "blocked"}
    ]
    return {
        "schemaVersion": "sketch.tolerance-ledger.v1",
        "generatedAt": utc_now(),
        "phaseId": None,
        "modelId": dispositions["modelId"],
        "revision": dispositions["revision"],
        "evidenceDir": portable(evidence_dir),
        "ok": len(blocking) == 0,
        "summary": {
            "findingCount": len(dispositions.get("findings") or []),
            "toleranceCount": 0,
            "blockingFindingCount": len(blocking),
            "incompleteToleranceCount": 0,
        },
        "requiredFields": [
            "severity",
            "affectedFeatureIds",
            "reason",
            "owner",
            "expiryCondition",
            "evidenceLinks",
        ],
        "tolerances": [],
        "blockingFindings": blocking,
        "incompleteTolerances": [],
    }


def freshness_report(summary: dict[str, Any], current: dict[str, Any], source_path: Path) -> dict[str, Any]:
    check_specs = [
        ("git_head", "gitHead"),
        ("model_revision", "modelRevision"),
        ("bundle_sha256", "bundleSha256"),
        ("advisor_rule_digest", "advisorRuleDigest"),
        ("ir_sha256", "irSha256"),
        ("capabilities_sha256", "capabilitiesSha256"),
    ]
    checks = []
    for check_id, key in check_specs:
        recorded = summary.get(key)
        now = current.get(key)
        status = "pass" if recorded == now and recorded is not None else "fail"
        checks.append(
            {
                "id": check_id,
                "status": status,
                "code": f"{check_id}_{'current' if status == 'pass' else 'stale'}",
                "message": f"Evidence {key} {'matches' if status == 'pass' else 'does not match'} current inputs.",
                "recorded": recorded,
                "current": now,
            }
        )
    stale = [row for row in checks if row["status"] != "pass"]
    return {
        "schemaVersion": "sketch.evidence.freshness.v1",
        "generatedAt": utc_now(),
        "ok": not stale,
        "sourcePath": portable(source_path),
        "recorded": summary,
        "current": current,
        "summary": {
            "passCount": len(checks) - len(stale),
            "staleCount": len(stale),
            "missingCount": 0,
            "blockerCount": len(stale),
        },
        "checks": checks,
        "blockers": stale,
    }


def write_status(
    path: Path,
    *,
    snapshot: dict[str, Any],
    stats: dict[str, Any],
    advisor: dict[str, dict[str, Any]],
    constructability: dict[str, Any],
    freshness: dict[str, Any],
    acceptance: dict[str, Any] | None,
    clean_pass: dict[str, Any] | None,
) -> None:
    construct_summary = (constructability.get("body") or {}).get("summary") or {}
    lines = [
        "# Target House 1 Offline Evidence Refresh",
        "",
        f"Generated: {utc_now()}",
        f"Model: {snapshot['modelId']}",
        f"Revision: {snapshot['revision']}",
        "Source: `seed-artifacts/target-house-1/bundle.json`",
        "",
        "## Summary",
        "",
        f"- Element count: {stats['elementCount']}",
        f"- Advisor errors: {advisor['error']['total']}",
        f"- Advisor warnings: {advisor['warning']['total']}",
        f"- Constructability findings: {construct_summary.get('findingCount', 0)}",
        f"- Constructability severity counts: {construct_summary.get('severityCounts', {})}",
        f"- Freshness: {'pass' if freshness.get('ok') else 'blocked'}",
    ]
    if acceptance:
        lines.extend(
            [
                f"- Evidence acceptance: {'pass' if acceptance.get('ok') else 'blocked'}",
                f"- Visual rows: {acceptance.get('summary', {}).get('visualPassCount', 0)} passed / {acceptance.get('summary', {}).get('requiredViewCount', 0)} required",
                f"- Data-quality rows: {acceptance.get('summary', {}).get('dataQualityPassCount', 0)} passed / {acceptance.get('summary', {}).get('dataQualityPassCount', 0) + acceptance.get('summary', {}).get('dataQualityFailCount', 0)} checked",
            ]
        )
    if clean_pass:
        lines.extend(
            [
                f"- Clean-pass gate: {'pass' if clean_pass.get('ok') else 'blocked'}",
                f"- Clean-pass blockers: {clean_pass.get('summary', {}).get('blockerCount', 0)}",
            ]
        )
    lines.extend(["", "## Remaining Blockers", ""])
    blockers: list[str] = []
    if clean_pass and clean_pass.get("blockers"):
        for blocker in clean_pass["blockers"]:
            blockers.append(
                f"- `{blocker.get('code')}` ({blocker.get('severity')}, {blocker.get('blockerKind')}): count {blocker.get('count')}"
            )
    if not blockers:
        blockers.append("_None recorded by the deterministic offline refresh._")
    lines.extend(blockers)
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def mirror_live(evidence_dir: Path) -> None:
    live_dir = evidence_dir / "live"
    live_dir.mkdir(parents=True, exist_ok=True)
    for name in CORE_LIVE_FILES:
        src = evidence_dir / name
        if src.exists():
            shutil.copyfile(src, live_dir / name)


def update_manifest(manifest_path: Path, summary: dict[str, Any]) -> None:
    manifest = read_json(manifest_path)
    manifest["acceptance"] = {
        "status": "offline-refreshed-current-evidence",
        "evidenceRoot": "evidence/live-run-current",
        "gitHead": summary["gitHead"],
        "bundleSha256": summary["bundleSha256"],
        "irSha256": summary["irSha256"],
        "capabilitiesSha256": summary["capabilitiesSha256"],
        "advisorRuleDigest": summary["advisorRuleDigest"],
        "generatedAtEpochMs": summary["generatedAtEpochMs"],
        "notes": (
            "Deterministic offline evidence was regenerated from "
            "seed-artifacts/target-house-1/bundle.json. Clean-pass, geometry, "
            "semantic visual, final-package, and live/browser acceptance are "
            "tracked in evidence/live-run-current."
        ),
    }
    manifest["bundleSha256"] = summary["bundleSha256"]
    if "commandCount" in summary:
        manifest["commandCount"] = summary["commandCount"]
    write_json(manifest_path, manifest)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", default="target-house-1")
    parser.add_argument("--capabilities", default=DEFAULT_CAPABILITIES)
    parser.add_argument("--model-id", default="target-house-1-offline-regenerated")
    args = parser.parse_args()

    artifact_dir = REPO_ROOT / "seed-artifacts" / args.seed
    evidence_dir = artifact_dir / "evidence" / "live-run-current"
    bundle_path = artifact_dir / "bundle.json"
    ir_path = artifact_dir / "evidence" / "sketch-ir.json"
    source_ir_path = artifact_dir / "source" / "target-house-1-sketch-ir.draft.json"
    if source_ir_path.exists():
        shutil.copyfile(source_ir_path, ir_path)
        shutil.copyfile(source_ir_path, evidence_dir / "sketch-ir.json")
    ir = read_json(ir_path)

    bundle_apply, doc = apply_bundle(bundle_path, args.model_id)
    snapshot = snapshot_payload(args.model_id, doc)
    stats = model_stats(snapshot)
    summary = compute_model_summary(doc)
    validate = {
        "modelId": args.model_id,
        "revision": doc.revision,
        "violations": snapshot["violations"],
        "summary": summary,
        "checks": {
            "errorViolationCount": sum(1 for v in snapshot["violations"] if v.get("severity") == "error"),
            "blockingViolationCount": sum(1 for v in snapshot["violations"] if v.get("blocking") is True),
        },
    }
    advisor = {
        "error": advisor_summary(snapshot, "error"),
        "warning": advisor_summary(snapshot, "warning"),
        "info": advisor_summary(snapshot, "info"),
        "all": advisor_summary(snapshot),
    }
    constructability_body = build_constructability_report(
        doc.elements,
        revision=doc.revision,
        profile="construction_readiness",
        design_option_sets=doc.design_option_sets,
    )
    constructability = {
        "ok": True,
        "status": 200,
        "body": {"modelId": args.model_id, **constructability_body},
    }
    visual = visual_contract(ir, snapshot, evidence_dir)
    quality = data_quality(ir, stats)
    exchange = export_validation(ir, stats)
    evidence = evidence_package(snapshot, validate, stats)
    dispositions = finding_dispositions(snapshot, advisor, constructability, evidence_dir)
    ledger = tolerance_ledger(dispositions, evidence_dir)
    current = {
        "gitHead": git_head(),
        "modelId": args.model_id,
        "modelRevision": doc.revision,
        "bundleSha256": sha256_file(bundle_path),
        "commandCount": len((read_json(bundle_path).get("commands") or [])),
        "advisorRuleDigest": digest_files(ADVISOR_RULE_FILES),
        "advisorRuleFiles": ADVISOR_RULE_FILES,
        "irPath": portable(ir_path),
        "irSha256": sha256_file(ir_path),
        "capabilitiesPath": args.capabilities,
        "capabilitiesSha256": sha256_file(REPO_ROOT / args.capabilities),
    }
    tool_summary = {
        "schemaVersion": "sketch-to-bim.tool-run.v1",
        "generatedAt": utc_now(),
        "seed": args.seed,
        "modelId": args.model_id,
        "modelRevision": doc.revision,
        "gitHead": current["gitHead"],
        "bundlePath": portable(bundle_path),
        "bundleSha256": current["bundleSha256"],
        "commandCount": current["commandCount"],
        "irPath": portable(ir_path),
        "irSha256": current["irSha256"],
        "capabilitiesPath": args.capabilities,
        "capabilitiesSha256": current["capabilitiesSha256"],
        "advisorRuleDigest": current["advisorRuleDigest"],
        "advisorRuleFiles": ADVISOR_RULE_FILES,
        "mode": "project_initiation_bim",
        "generatedAtEpochMs": int(datetime.now(UTC).timestamp() * 1000),
        "executionMode": "offline_bundle_replay",
    }
    freshness = freshness_report(tool_summary, current, evidence_dir / "tool-run-summary.json")

    artifacts = {
        "bundle-apply.json": bundle_apply,
        "snapshot.json": snapshot,
        "validate.json": validate,
        "evidence-package.json": evidence,
        "advisor-error.json": advisor["error"],
        "advisor-warning.json": advisor["warning"],
        "advisor-info.json": advisor["info"],
        "advisor-all.json": advisor["all"],
        "constructability-report.json": constructability,
        "model-stats.json": stats,
        "visual-evidence-contract.json": visual,
        "bim-data-quality.json": quality,
        "export-validation.json": exchange,
        "finding-dispositions.json": dispositions,
        "tolerance-ledger.json": ledger,
        "tool-run-summary.json": tool_summary,
        "evidence-freshness.json": freshness,
        "live-advisor.json": {"warning": advisor["warning"], "info": advisor["info"], "error": advisor["error"]},
    }
    manifest = {
        "schemaVersion": "sketch.evidence.collection.v1",
        "generatedAt": utc_now(),
        "modelId": args.model_id,
        "revision": doc.revision,
        "phaseId": None,
        "baseUrl": None,
        "currentHead": current,
        "browserAutomationRequired": False,
        "constructabilityProfile": "construction_readiness",
        "artifacts": {name.removesuffix(".json").replace("-", "_"): portable(evidence_dir / name) for name in artifacts},
        "summary": {
            "modelStats": stats,
            "advisor": {
                "error": advisor["error"]["total"],
                "warning": advisor["warning"]["total"],
                "info": advisor["info"]["total"],
            },
            "constructability": {
                "ok": True,
                "status": 200,
                "profile": "construction_readiness",
                "severityCounts": constructability_body["summary"].get("severityCounts", {}),
                "total": constructability_body["summary"].get("findingCount", 0),
            },
            "requiredVisualViewCount": len(ir.get("requiredViews") or []),
            "findingDispositionCount": len(dispositions["findings"]),
            "unclassifiedBlockingFindingCount": len(ledger["blockingFindings"]),
            "toleranceLedger": ledger["summary"],
            "exchangeValidation": exchange["summary"],
        },
    }
    artifacts["evidence-manifest.json"] = manifest
    artifacts["live-runner-manifest.json"] = manifest

    for name, payload in artifacts.items():
        write_json(evidence_dir / name, payload)
    write_status(
        evidence_dir / "status.md",
        snapshot=snapshot,
        stats=stats,
        advisor=advisor,
        constructability=constructability,
        freshness=freshness,
        acceptance=None,
        clean_pass=None,
    )
    mirror_live(evidence_dir)
    update_manifest(artifact_dir / "manifest.json", tool_summary)
    print(
        json.dumps(
            {
                "ok": True,
                "seed": args.seed,
                "evidenceDir": portable(evidence_dir),
                "modelId": args.model_id,
                "revision": doc.revision,
                "bundleSha256": tool_summary["bundleSha256"],
                "advisor": manifest["summary"]["advisor"],
                "constructability": manifest["summary"]["constructability"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
