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


def parse_optional_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


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
