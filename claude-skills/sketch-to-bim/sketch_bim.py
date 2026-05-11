#!/usr/bin/env python3
"""Skill-local sketch-to-BIM operational helper.

This is the sketch-to-BIM equivalent of the watch-yt helper script: keep the
skill instructions short, and give the agent one reliable command surface for
the live feedback loop.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
CLI = ["node", "packages/cli/cli.mjs"]
DEFAULT_CAPABILITIES = "spec/sketch-to-bim-capability-matrix.json"
DEFAULT_ARCHETYPES = "spec/sketch-to-bim-archetypes.json"
TOOL_MANIFEST = ROOT / "claude-skills" / "sketch-to-bim" / "tools.json"
BLOCKING_SEVERITIES = {"warning", "error"}
ADVISOR_RULE_FILES = [
    "app/bim_ai/constructability_advisories.py",
    "app/bim_ai/constructability_report.py",
    "app/bim_ai/constraints_metadata.py",
    "packages/web/src/advisor/advisorViolationContext.ts",
    "packages/web/src/advisor/perspectiveFilter.ts",
]
UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)


def rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def json_dump(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True)


def file_sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def digest_files(paths: list[str]) -> str:
    h = hashlib.sha256()
    for rel_path in sorted(paths):
        path = ROOT / rel_path
        h.update(rel_path.encode("utf8"))
        h.update(b"\0")
        if path.is_file():
            h.update((file_sha256(path) or "").encode("utf8"))
        else:
            h.update(b"missing")
        h.update(b"\0")
    return h.hexdigest()


def run(
    cmd: list[str],
    *,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(cmd), file=sys.stderr)
    proc = subprocess.run(
        cmd,
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.stdout:
        print(proc.stdout, end="")
    if proc.stderr:
        print(proc.stderr, end="", file=sys.stderr)
    if check and proc.returncode != 0:
        raise SystemExit(proc.returncode)
    return proc


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json_dump(data) + "\n", encoding="utf8")


def http_json(url: str, timeout: float = 2.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf8")
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        parsed = {"raw": body[:500]}
    return {"ok": True, "url": url, "status": resp.status, "body": parsed}


def http_probe(url: str, timeout: float = 2.0) -> dict[str, Any]:
    try:
        return http_json(url, timeout=timeout)
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        return {"ok": False, "url": url, "error": str(exc)}


def git_head() -> str | None:
    proc = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return proc.stdout.strip() if proc.returncode == 0 else None


def seed_paths(seed: str) -> dict[str, Path]:
    base = ROOT / "seed-artifacts" / seed
    return {
        "base": base,
        "recipe": base / "evidence" / f"{seed}.recipe.json",
        "bundle": base / "bundle.json",
        "ir": base / "evidence" / "sketch-ir.json",
        "live_current": base / "evidence" / "live-run-current",
    }


def extract_seed_model_id(output: str, seed: str) -> str | None:
    for line in output.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{seed}:"):
            match = UUID_RE.search(stripped)
            if match:
                return match.group(0)
    matches = UUID_RE.findall(output)
    return matches[-1] if matches else None


def cmd_doctor(args: argparse.Namespace) -> None:
    base_url = args.base_url.rstrip("/")
    web_url = args.web_url.rstrip("/")
    checks: dict[str, Any] = {
        "repo": str(ROOT),
        "gitHead": git_head(),
        "apiHealth": http_probe(f"{base_url}/api/health"),
        "web": http_probe(web_url),
        "files": {
            "methodology": (ROOT / "spec/sketch-to-bim-methodology.md").is_file(),
            "tracker": (ROOT / "spec/sketch-to-bim-process-audit-tracker.md").is_file(),
            "capabilityMatrix": (ROOT / DEFAULT_CAPABILITIES).is_file(),
            "skill": (ROOT / "claude-skills/sketch-to-bim/SKILL.md").is_file(),
        },
    }
    if args.model:
        env = os.environ.copy()
        env["BIM_AI_MODEL_ID"] = args.model
        env["BIM_AI_BASE_URL"] = base_url
        proc = run([*CLI, "advisor", "--output", "json", "--severity", "warning"], env=env, check=False)
        checks["advisorWarnings"] = {
            "ok": proc.returncode == 0,
            "exitCode": proc.returncode,
            "json": parse_optional_json(proc.stdout),
        }
    checks["ok"] = bool(
        checks["apiHealth"].get("ok")
        and checks["web"].get("ok")
        and all(checks["files"].values())
    )
    if args.out:
        write_json((ROOT / args.out).resolve(), checks)
    print(json_dump(checks))
    if args.require_live and not checks["ok"]:
        raise SystemExit(2)


def cmd_tools(_args: argparse.Namespace) -> None:
    print(json_dump(read_json(TOOL_MANIFEST)))


def cmd_archetypes(args: argparse.Namespace) -> None:
    archetypes = read_json(ROOT / args.manifest)
    if args.query:
        q = args.query.lower()
        rows = []
        for row in archetypes.get("archetypes") or []:
            haystack = " ".join(
                [
                    str(row.get("id") or ""),
                    str(row.get("title") or ""),
                    " ".join(str(x) for x in (row.get("matchHints") or [])),
                ]
            ).lower()
            if q in haystack:
                rows.append(row)
        archetypes = {**archetypes, "archetypes": rows}
    print(json_dump(archetypes))


def parse_optional_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def advisory_code(v: dict[str, Any]) -> str:
    return str(v.get("advisoryClass") or v.get("ruleId") or v.get("code") or "unknown")


def advisor_groups_from_violations(violations: list[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[str, dict[str, Any]] = {}
    for violation in violations:
        severity = str(violation.get("severity") or "unknown")
        code = advisory_code(violation)
        key = f"{severity}:{code}"
        row = groups.setdefault(
            key,
            {
                "severity": severity,
                "code": code,
                "count": 0,
                "elementIds": set(),
                "messages": set(),
            },
        )
        row["count"] += 1
        for element_id in violation.get("elementIds") or []:
            row["elementIds"].add(str(element_id))
        message = violation.get("message")
        if message:
            row["messages"].add(str(message))

    severity_rank = {"error": 0, "warning": 1, "info": 2}
    grouped = [
        {
            "severity": row["severity"],
            "code": row["code"],
            "count": row["count"],
            "elementIds": sorted(row["elementIds"]),
            "messages": sorted(row["messages"])[:3],
        }
        for row in groups.values()
    ]
    grouped.sort(key=lambda row: (severity_rank.get(row["severity"], 9), row["code"]))
    return {"total": len(violations), "groups": grouped}


def load_advisor_file(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"total": 0, "groups": []}
    data = read_json(path)
    if isinstance(data, dict) and isinstance(data.get("payload"), dict):
        data = data["payload"]
    if isinstance(data, dict) and isinstance(data.get("groups"), list):
        return data
    if isinstance(data, dict) and isinstance(data.get("violations"), list):
        return advisor_groups_from_violations(data["violations"])
    return {"total": 0, "groups": []}


def normalized_advisor_groups(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for group in payload.get("groups") or []:
        rows.append(
            {
                "severity": str(group.get("severity") or "unknown"),
                "code": str(group.get("code") or "unknown"),
                "count": int(group.get("count") or 0),
                "elementIds": sorted(str(x) for x in (group.get("elementIds") or [])),
                "messages": sorted(str(x) for x in (group.get("messages") or [])),
            }
        )
    return sorted(rows, key=lambda row: (row["severity"], row["code"], row["elementIds"]))


def find_text_occurrences(path: Path, needles: list[str]) -> dict[str, list[int]]:
    if not path.is_file():
        return {}
    lines = path.read_text(encoding="utf8").splitlines()
    out: dict[str, list[int]] = {}
    for needle in needles:
        if not needle:
            continue
        hits = [idx + 1 for idx, line in enumerate(lines) if needle in line]
        if hits:
            out[needle] = hits[:12]
    return out


def screenshot_rows_from_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    data = read_json(path)
    rows = data.get("screenshots") if isinstance(data, dict) else data
    if not isinstance(rows, list):
        return []
    normalized = []
    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        screenshot = row.get("path") or row.get("file") or row.get("screenshotPath")
        normalized.append(
            {
                "id": str(row.get("id") or row.get("viewId") or row.get("name") or f"view-{idx + 1}"),
                "label": str(row.get("label") or row.get("name") or row.get("viewId") or f"View {idx + 1}"),
                "screenshot": screenshot,
            }
        )
    return normalized


def phase_dir_for(args: argparse.Namespace) -> Path:
    if args.dir:
        return Path(args.dir).resolve()
    if not args.seed:
        raise SystemExit("--dir or --seed is required.")
    phase = str(args.phase).strip()
    if not phase:
        raise SystemExit("--phase is required.")
    return (ROOT / "seed-artifacts" / args.seed / "evidence" / f"phase-{phase}").resolve()


def cmd_compile(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed)
    recipe = Path(args.recipe) if args.recipe else paths["recipe"]
    bundle = Path(args.bundle) if args.bundle else paths["bundle"]
    run([*CLI, "seed-dsl", "compile", "--recipe", rel(recipe), "--out", rel(bundle)])
    print(json_dump({"seed": args.seed, "recipe": rel(recipe), "bundle": rel(bundle)}))


def cmd_seed(args: argparse.Namespace) -> None:
    if args.clear:
        run(["make", "seed-clear"])
    proc = run(["make", "seed", f"name={args.seed}"])
    model_id = extract_seed_model_id(proc.stdout, args.seed)
    result = {"seed": args.seed, "modelId": model_id}
    print(json_dump(result))
    if args.out:
        write_json((ROOT / args.out).resolve(), result)
    if not model_id:
        raise SystemExit("Could not detect seeded model id from make seed output.")


def cmd_advisor(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("advisor requires --model or BIM_AI_MODEL_ID.")
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model
    env["BIM_AI_BASE_URL"] = args.base_url.rstrip("/")
    out_dir = Path(args.out).resolve() if args.out else None
    results: dict[str, Any] = {"modelId": model}
    for severity in ("warning", "info"):
        proc = run([*CLI, "advisor", "--output", "json", "--severity", severity], env=env, check=False)
        parsed = parse_optional_json(proc.stdout)
        results[severity] = {"exitCode": proc.returncode, "payload": parsed}
        if out_dir:
            write_json(out_dir / f"advisor-{severity}.json", parsed or {"raw": proc.stdout})
    print(json_dump(results))
    warning_total = int(((results.get("warning") or {}).get("payload") or {}).get("total") or 0)
    if args.fail_on_warning and warning_total > 0:
        raise SystemExit(3)


def cmd_advisor_parity(args: argparse.Namespace) -> None:
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if not model:
        raise SystemExit("advisor-parity requires --model or BIM_AI_MODEL_ID.")
    base_url = args.base_url.rstrip("/")
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model
    env["BIM_AI_BASE_URL"] = base_url
    cli_proc = run([*CLI, "advisor", "--output", "json"], env=env, check=False)
    cli_payload = parse_optional_json(cli_proc.stdout) or {"total": 0, "groups": []}
    snap = http_json(f"{base_url}/api/models/{model}/snapshot")
    body = snap.get("body") if isinstance(snap, dict) else {}
    violations = body.get("violations") if isinstance(body, dict) else []
    if not isinstance(violations, list):
        violations = []
    ui_payload = advisor_groups_from_violations([v for v in violations if isinstance(v, dict)])
    ui_payload["modelId"] = body.get("modelId") if isinstance(body, dict) else model
    ui_payload["revision"] = body.get("revision") if isinstance(body, dict) else None
    cli_groups = normalized_advisor_groups(cli_payload)
    ui_groups = normalized_advisor_groups(ui_payload)
    result = {
        "schemaVersion": "sketch-to-bim.advisor-parity.v1",
        "modelId": model,
        "source": "snapshot-violations-vs-cli-advisor",
        "note": "AdvisorPanel renders snapshot violations after client-side perspective filtering; this compares the unfiltered right-rail source payload with CLI grouping.",
        "ok": cli_groups == ui_groups,
        "cli": cli_payload,
        "rightRailSource": ui_payload,
    }
    if args.out:
        write_json(Path(args.out).resolve(), result)
    print(json_dump(result))
    if args.fail_on_mismatch and not result["ok"]:
        raise SystemExit(5)


def cmd_browser_evidence(args: argparse.Namespace) -> None:
    out_dir = Path(args.out).resolve() if args.out else phase_dir_for(args)
    command = [
        "node",
        "packages/web/scripts/capture-skb-browser-evidence.mjs",
        "--url",
        args.web_url.rstrip("/"),
        "--out",
        rel(out_dir),
    ]
    model = args.model or os.environ.get("BIM_AI_MODEL_ID")
    if model:
        command.extend(["--model", model])
    if args.timeout_ms:
        command.extend(["--timeout-ms", str(args.timeout_ms)])
    run(command)


def cmd_semantic_checklist(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    manifest = Path(args.manifest).resolve() if args.manifest else out_dir / "screenshot-manifest.json"
    rows = screenshot_rows_from_manifest(manifest)
    if not rows:
        rows = [
            {"id": "main", "label": "Main sketch-matched view", "screenshot": None},
            {"id": "front", "label": "Front/elevation view", "screenshot": None},
            {"id": "plan", "label": "Plan diagnostic view", "screenshot": None},
        ]
    checks = []
    default_criteria = [
        "Silhouette and volume hierarchy match the sketch.",
        "Roof, openings, terraces/loggias, stairs, and other visible special features render as real geometry.",
        "Materials and facade zones match the visual intent.",
        "Rooms, access, and interior programme are usable for project initiation.",
        "No visual issue contradicts Advisor acceptance.",
    ]
    for row in rows:
        checks.append(
            {
                "viewId": row["id"],
                "label": row["label"],
                "screenshot": row["screenshot"],
                "criteria": default_criteria,
                "verdict": "pending",
                "notes": "",
            }
        )
    payload = {
        "schemaVersion": "sketch-to-bim.semantic-checklist.v1",
        "phase": args.phase,
        "seed": args.seed,
        "manifest": rel(manifest),
        "checks": checks,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "semantic-checklist.json"
    write_json(output, payload)
    print(json_dump({"semanticChecklist": rel(output), "checkCount": len(checks)}))


def cmd_issue_ledger(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    paths = seed_paths(args.seed) if args.seed else {}
    recipe = Path(args.recipe).resolve() if args.recipe else paths.get("recipe")
    bundle = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    warning = load_advisor_file(Path(args.advisor_warning).resolve() if args.advisor_warning else out_dir / "advisor-warning.json")
    info = load_advisor_file(Path(args.advisor_info).resolve() if args.advisor_info else out_dir / "advisor-info.json")
    entries = []
    for severity, payload in (("warning", warning), ("info", info)):
        for group in payload.get("groups") or []:
            ids = [str(x) for x in group.get("elementIds") or []]
            entries.append(
                {
                    "severity": severity,
                    "code": group.get("code"),
                    "count": group.get("count"),
                    "elementIds": ids,
                    "messages": group.get("messages") or [],
                    "recipeMatches": find_text_occurrences(recipe, ids) if recipe else {},
                    "bundleMatches": find_text_occurrences(bundle, ids) if bundle else {},
                    "status": "pending" if severity in BLOCKING_SEVERITIES else "reviewed",
                    "sourceEdit": "",
                    "toleranceRationale": "",
                }
            )
    payload = {
        "schemaVersion": "sketch-to-bim.issue-ledger.v1",
        "phase": args.phase,
        "seed": args.seed,
        "recipe": rel(recipe) if recipe else None,
        "bundle": rel(bundle) if bundle else None,
        "entries": entries,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "issue-ledger.json"
    write_json(output, payload)
    print(json_dump({"issueLedger": rel(output), "entryCount": len(entries)}))
    pending_blockers = [
        e for e in entries if e["severity"] in BLOCKING_SEVERITIES and e["status"] == "pending"
    ]
    if args.fail_on_pending and pending_blockers:
        raise SystemExit(6)


def cmd_material_check(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed) if args.seed else {}
    recipe_path = Path(args.recipe).resolve() if args.recipe else paths.get("recipe")
    bundle_path = Path(args.bundle).resolve() if args.bundle else paths.get("bundle")
    if not recipe_path or not recipe_path.is_file():
        raise SystemExit("material-check requires --recipe or --seed with evidence/<seed>.recipe.json.")
    if not bundle_path or not bundle_path.is_file():
        raise SystemExit("material-check requires --bundle or --seed with bundle.json.")
    recipe = read_json(recipe_path)
    bundle = read_json(bundle_path)
    commands = bundle if isinstance(bundle, list) else bundle.get("commands") or []
    bundle_text = json_dump(commands)
    intents = recipe.get("materialIntent") or []
    assignments = recipe.get("materialAssignments") or []
    missing = []
    for row in intents:
        material_key = row.get("materialKey")
        if material_key and material_key not in bundle_text:
            missing.append({"kind": "intent_not_represented", "materialKey": material_key, "surface": row.get("surface")})
    for row in assignments:
        element_id = row.get("elementId")
        material_key = row.get("materialKey")
        if element_id and material_key and (element_id not in bundle_text or material_key not in bundle_text):
            missing.append({"kind": "assignment_not_represented", "elementId": element_id, "materialKey": material_key})
    payload = {
        "schemaVersion": "sketch-to-bim.material-check.v1",
        "seed": args.seed,
        "recipe": rel(recipe_path),
        "bundle": rel(bundle_path),
        "ok": not missing,
        "intentCount": len(intents),
        "assignmentCount": len(assignments),
        "missing": missing,
    }
    if args.out:
        write_json(Path(args.out).resolve(), payload)
    print(json_dump(payload))
    if args.fail_on_missing and missing:
        raise SystemExit(8)


def cmd_phase_accept(args: argparse.Namespace) -> None:
    out_dir = phase_dir_for(args)
    required = {
        "advisor-warning": out_dir / "advisor-warning.json",
        "advisor-info": out_dir / "advisor-info.json",
        "screenshot-manifest": out_dir / "screenshot-manifest.json",
        "semantic-checklist": out_dir / "semantic-checklist.json",
        "visual-readout": out_dir / "visual-readout.md",
        "corrections": out_dir / "corrections.md",
        "issue-ledger": out_dir / "issue-ledger.json",
    }
    missing = {name: rel(path) for name, path in required.items() if not path.is_file()}
    warning = load_advisor_file(required["advisor-warning"])
    warnings_total = int(warning.get("total") or 0)
    semantic_failures: list[dict[str, Any]] = []
    if required["semantic-checklist"].is_file():
        checklist = read_json(required["semantic-checklist"])
        for check in checklist.get("checks") or []:
            verdict = str(check.get("verdict") or "pending")
            if verdict not in {"pass", "accepted_tolerance"}:
                semantic_failures.append(
                    {
                        "viewId": check.get("viewId"),
                        "verdict": verdict,
                        "notes": check.get("notes") or "",
                    }
                )
    pending_issues: list[dict[str, Any]] = []
    if required["issue-ledger"].is_file():
        ledger = read_json(required["issue-ledger"])
        for entry in ledger.get("entries") or []:
            if (
                str(entry.get("severity")) in BLOCKING_SEVERITIES
                and str(entry.get("status") or "pending") not in {"fixed", "tolerated", "software_rule_defect"}
            ):
                pending_issues.append(
                    {
                        "severity": entry.get("severity"),
                        "code": entry.get("code"),
                        "elementIds": entry.get("elementIds") or [],
                        "status": entry.get("status") or "pending",
                    }
                )
    parity_path = out_dir / "advisor-parity.json"
    parity_ok = True
    if args.require_parity:
        if not parity_path.is_file():
            missing["advisor-parity"] = rel(parity_path)
            parity_ok = False
        else:
            parity_ok = bool(read_json(parity_path).get("ok"))

    ok = not missing and warnings_total == 0 and not semantic_failures and not pending_issues and parity_ok
    packet = {
        "schemaVersion": "sketch-to-bim.phase-packet.v1",
        "phase": args.phase,
        "seed": args.seed,
        "ok": ok,
        "generatedAtEpochMs": int(time.time() * 1000),
        "gitHead": git_head(),
        "files": {name: rel(path) for name, path in required.items()},
        "missing": missing,
        "advisorWarningTotal": warnings_total,
        "semanticFailures": semantic_failures,
        "pendingIssues": pending_issues,
        "advisorParityOk": parity_ok,
    }
    output = Path(args.out).resolve() if args.out else out_dir / "phase-packet.json"
    write_json(output, packet)
    print(json_dump(packet))
    if not ok:
        raise SystemExit(7)


def cmd_accept(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed)
    if not args.no_compile:
        cmd_compile(argparse.Namespace(seed=args.seed, recipe=args.recipe, bundle=None))
    if args.clear:
        run(["make", "seed-clear"])
    seed_proc = run(["make", "seed", f"name={args.seed}"])
    model_id = args.model or extract_seed_model_id(seed_proc.stdout, args.seed)
    if not model_id:
        raise SystemExit("Could not detect model id; pass --model explicitly.")
    if args.require_live:
        doctor = http_probe(f"{args.base_url.rstrip('/')}/api/health")
        if not doctor.get("ok"):
            print(json_dump({"apiHealth": doctor}), file=sys.stderr)
            raise SystemExit("API is not reachable. Start make dev before acceptance.")

    out_dir = Path(args.out).resolve() if args.out else paths["live_current"]
    command = [
        *CLI,
        "initiation-run",
        "--ir",
        rel(Path(args.ir) if args.ir else paths["ir"]),
        "--capabilities",
        args.capabilities,
        "--model",
        model_id,
        "--mode",
        args.mode,
        "--fail-on-warning",
        "--fail-on-acceptance",
        "--out",
        rel(out_dir),
    ]
    if args.target_image:
        command.extend(["--target-image", args.target_image, "--fail-on-visual"])
    if args.target_map:
        command.extend(["--target-map", args.target_map, "--fail-on-visual"])
    env = os.environ.copy()
    env["BIM_AI_MODEL_ID"] = model_id
    env["BIM_AI_BASE_URL"] = args.base_url.rstrip("/")
    run(command, env=env)
    summary = {
        "schemaVersion": "sketch-to-bim.tool-run.v1",
        "seed": args.seed,
        "modelId": model_id,
        "gitHead": git_head(),
        "bundlePath": rel(paths["bundle"]),
        "bundleSha256": file_sha256(paths["bundle"]),
        "irPath": rel(paths["ir"]),
        "irSha256": file_sha256(paths["ir"]),
        "capabilitiesPath": args.capabilities,
        "capabilitiesSha256": file_sha256(ROOT / args.capabilities),
        "advisorRuleDigest": digest_files(ADVISOR_RULE_FILES),
        "advisorRuleFiles": ADVISOR_RULE_FILES,
        "mode": args.mode,
        "generatedAtEpochMs": int(time.time() * 1000),
    }
    write_json(out_dir / "tool-run-summary.json", summary)
    print(json_dump(summary))


def cmd_stale_check(args: argparse.Namespace) -> None:
    paths = seed_paths(args.seed)
    evidence = Path(args.evidence).resolve() if args.evidence else paths["live_current"]
    summary_path = evidence / "tool-run-summary.json"
    if not summary_path.is_file():
        raise SystemExit(f"Missing tool-run summary: {rel(summary_path)}")
    summary = read_json(summary_path)
    current = {
        "gitHead": git_head(),
        "bundleSha256": file_sha256(paths["bundle"]),
        "irSha256": file_sha256(paths["ir"]),
        "capabilitiesSha256": file_sha256(ROOT / summary.get("capabilitiesPath", DEFAULT_CAPABILITIES)),
        "advisorRuleDigest": digest_files(summary.get("advisorRuleFiles") or ADVISOR_RULE_FILES),
    }
    stale = {
        key: {"recorded": summary.get(key), "current": value}
        for key, value in current.items()
        if summary.get(key) != value
    }
    result = {"seed": args.seed, "evidence": rel(evidence), "stale": stale, "ok": not stale}
    print(json_dump(result))
    if stale:
        raise SystemExit(4)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sketch-to-BIM skill operational helper.")
    sub = parser.add_subparsers(dest="command", required=True)

    tools = sub.add_parser("tools", help="Print typed skill tool descriptors.")
    tools.set_defaults(func=cmd_tools)

    archetypes = sub.add_parser("archetypes", help="Print reusable sketch-to-BIM archetype baselines.")
    archetypes.add_argument("--manifest", default=DEFAULT_ARCHETYPES)
    archetypes.add_argument("--query")
    archetypes.set_defaults(func=cmd_archetypes)

    doctor = sub.add_parser("doctor", help="Check live app/tool prerequisites.")
    doctor.add_argument("--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500"))
    doctor.add_argument("--web-url", default=os.environ.get("BIM_AI_WEB_URL", "http://127.0.0.1:2000"))
    doctor.add_argument("--model")
    doctor.add_argument("--out")
    doctor.add_argument("--require-live", action="store_true")
    doctor.set_defaults(func=cmd_doctor)

    compile_cmd = sub.add_parser("compile", help="Compile seed DSL recipe to bundle.")
    compile_cmd.add_argument("--seed", required=True)
    compile_cmd.add_argument("--recipe")
    compile_cmd.add_argument("--bundle")
    compile_cmd.set_defaults(func=cmd_compile)

    seed_cmd = sub.add_parser("seed", help="Load a named seed artifact and print its model id.")
    seed_cmd.add_argument("--seed", required=True)
    seed_cmd.add_argument("--clear", action="store_true")
    seed_cmd.add_argument("--out")
    seed_cmd.set_defaults(func=cmd_seed)

    advisor = sub.add_parser("advisor", help="Capture warning and info Advisor payloads.")
    advisor.add_argument("--model")
    advisor.add_argument("--out")
    advisor.add_argument("--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500"))
    advisor.add_argument("--fail-on-warning", action="store_true")
    advisor.set_defaults(func=cmd_advisor)

    parity = sub.add_parser("advisor-parity", help="Compare CLI Advisor groups with right-rail source payload.")
    parity.add_argument("--model")
    parity.add_argument("--out")
    parity.add_argument("--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500"))
    parity.add_argument("--fail-on-mismatch", action="store_true")
    parity.set_defaults(func=cmd_advisor_parity)

    browser = sub.add_parser("browser-evidence", help="Capture browser/right-rail screenshots and review text.")
    browser.add_argument("--phase")
    browser.add_argument("--seed")
    browser.add_argument("--dir")
    browser.add_argument("--out")
    browser.add_argument("--model")
    browser.add_argument("--web-url", default=os.environ.get("BIM_AI_WEB_URL", "http://127.0.0.1:2000"))
    browser.add_argument("--timeout-ms", type=int, default=30000)
    browser.set_defaults(func=cmd_browser_evidence)

    semantic = sub.add_parser("semantic-checklist", help="Create a required semantic screenshot review checklist.")
    semantic.add_argument("--phase", required=True)
    semantic.add_argument("--seed")
    semantic.add_argument("--dir")
    semantic.add_argument("--manifest")
    semantic.add_argument("--out")
    semantic.set_defaults(func=cmd_semantic_checklist)

    ledger = sub.add_parser("issue-ledger", help="Map Advisor findings to recipe/bundle source references.")
    ledger.add_argument("--phase", required=True)
    ledger.add_argument("--seed")
    ledger.add_argument("--dir")
    ledger.add_argument("--recipe")
    ledger.add_argument("--bundle")
    ledger.add_argument("--advisor-warning")
    ledger.add_argument("--advisor-info")
    ledger.add_argument("--out")
    ledger.add_argument("--fail-on-pending", action="store_true")
    ledger.set_defaults(func=cmd_issue_ledger)

    materials = sub.add_parser("material-check", help="Verify recipe material intent is represented in the bundle.")
    materials.add_argument("--seed")
    materials.add_argument("--recipe")
    materials.add_argument("--bundle")
    materials.add_argument("--out")
    materials.add_argument("--fail-on-missing", action="store_true")
    materials.set_defaults(func=cmd_material_check)

    phase = sub.add_parser("phase-accept", help="Fail unless the phase evidence packet is complete and clean.")
    phase.add_argument("--phase", required=True)
    phase.add_argument("--seed")
    phase.add_argument("--dir")
    phase.add_argument("--out")
    phase.add_argument("--require-parity", action="store_true")
    phase.set_defaults(func=cmd_phase_accept)

    accept = sub.add_parser("accept", help="Run strict current-HEAD live acceptance for a seed.")
    accept.add_argument("--seed", required=True)
    accept.add_argument("--model")
    accept.add_argument("--recipe")
    accept.add_argument("--ir")
    accept.add_argument("--out")
    accept.add_argument("--capabilities", default=DEFAULT_CAPABILITIES)
    accept.add_argument("--base-url", default=os.environ.get("BIM_AI_BASE_URL", "http://127.0.0.1:8500"))
    accept.add_argument("--mode", default="project_initiation_bim")
    accept.add_argument("--target-image")
    accept.add_argument("--target-map")
    accept.add_argument("--clear", action="store_true")
    accept.add_argument("--no-compile", action="store_true")
    accept.add_argument("--no-require-live", dest="require_live", action="store_false")
    accept.set_defaults(func=cmd_accept, require_live=True)

    stale = sub.add_parser("stale-check", help="Fail when accepted evidence does not match HEAD inputs.")
    stale.add_argument("--seed", required=True)
    stale.add_argument("--evidence")
    stale.set_defaults(func=cmd_stale_check)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
