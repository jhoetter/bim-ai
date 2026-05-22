"""Iter-14 step 4b — apply the window-rhythm subagent emissions.

Reads tmp/reverse-bim/iter-14-{house}-windows.json (output from the 3
per-house window-rhythm subagents) and applies each command through the
iter-10 pipeline (normalize → commit_one). Skips any command that
references a wallId not present in the live snapshot (subagent
hallucination guard) and logs per-command result.

Run from repo root:  python3 scripts/testhouse_iter14_apply_windows.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_command_normalize import normalize_bundle  # noqa: E402
from testhouse_iter10_apply import commit_one, http_json, query_snapshot  # noqa: E402

HOUSES = ("alpha", "beta", "gamma")


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def apply_house(house: str) -> dict[str, Any]:
    windows_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-14-{house}-windows.json"
    if not windows_path.exists():
        return {"house": house, "error": f"missing {windows_path}"}
    windows = json.loads(windows_path.read_text(encoding="utf-8"))
    raw_commands: list[dict[str, Any]] = list(windows.get("commands") or [])
    if not raw_commands:
        return {"house": house, "appliedCount": 0, "skipped": "no commands in input"}

    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    live_wall_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "wall"
    }
    live_window_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") in ("window", "door")
    }

    # Pre-flight: drop commands referencing non-existent wallIds (subagent
    # hallucination guard), or commands whose id collides with an existing
    # element (idempotent re-runs).
    filtered: list[dict[str, Any]] = []
    dropped: list[dict[str, Any]] = []
    for cmd in raw_commands:
        wall_id = cmd.get("wallId")
        cmd_id = cmd.get("id")
        if wall_id and wall_id not in live_wall_ids:
            dropped.append({"reason": "wallId_not_found", "cmd": cmd})
            continue
        if cmd_id and cmd_id in live_window_ids:
            dropped.append({"reason": "id_already_present", "cmd": cmd})
            continue
        filtered.append(cmd)

    if not filtered:
        return {
            "house": house, "modelId": model_id,
            "appliedCount": 0, "failedCount": 0, "droppedCount": len(dropped),
            "dropped": dropped[:10],
        }

    normalized, records = normalize_bundle(filtered)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "wallId": cmd.get("wallId"), "id": cmd.get("id")}
        if resp.get("error"):
            entry["status"] = "http_error"
            entry["http_status"] = resp.get("status")
            entry["body"] = resp.get("body")
            failed += 1
        elif resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            entry["status"] = "applied"
            entry["newRevision"] = rev
            applied += 1
        else:
            entry["status"] = "rejected"
            entry["violations"] = resp.get("violations") or resp.get("result", {}).get("violations")
            failed += 1
        per_command.append(entry)

    return {
        "house": house,
        "modelId": model_id,
        "appliedCount": applied,
        "failedCount": failed,
        "droppedCount": len(dropped),
        "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
        "droppedSample": dropped[:5],
    }


def main() -> None:
    summary: dict[str, Any] = {}
    for house in HOUSES:
        result = apply_house(house)
        out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-14-{house}-windows-apply.json"
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        summary[house] = {
            "applied": result.get("appliedCount"),
            "failed": result.get("failedCount"),
            "dropped": result.get("droppedCount"),
            "rev": result.get("finalRevision"),
        }
        print(
            f"=== {house} ===\n"
            f"  applied:  {result.get('appliedCount')}\n"
            f"  failed:   {result.get('failedCount')}\n"
            f"  dropped:  {result.get('droppedCount')}\n"
            f"  rev:      {result.get('finalRevision')}\n"
            f"  details:  iter-14-{house}-windows-apply.json"
        )
        # Show first 3 failures for diagnosis
        for entry in (result.get("perCommand") or []):
            if entry["status"] == "applied":
                continue
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list) and v:
                print(f"    ✗ [{entry['i']}] wall={entry.get('wallId','')[:18]} -> {entry['status']}: sev={v[0].get('severity')} msg={v[0].get('message','')[:120]}")
            else:
                print(f"    ✗ [{entry['i']}] -> {entry['status']}")
    print(f"\nSummary: {json.dumps(summary, indent=2)}")


if __name__ == "__main__":
    main()
