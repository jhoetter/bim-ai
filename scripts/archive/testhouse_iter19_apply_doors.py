"""Iter-19 — apply interior door JSON emissions from the 3 door-reader
subagents through the iter-10 pipeline.

Inputs:
  tmp/reverse-bim/iter-19-{alpha,beta,gamma}-doors.json

Run from repo root:  python3 scripts/testhouse_iter19_apply_doors.py
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
    src = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-19-{house}-doors.json"
    if not src.exists():
        return {"house": house, "skipped": "no input file"}
    data = json.loads(src.read_text(encoding="utf-8"))
    commands = data.get("commands") or []
    if not commands:
        return {"house": house, "applied": 0}

    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    live_wall_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "wall"
    }
    existing_door_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict) and e.get("kind") == "door"
    }

    filtered = []
    dropped = []
    for c in commands:
        wid = c.get("wallId")
        cid = c.get("id")
        if wid and wid not in live_wall_ids:
            dropped.append({"reason": "wallId_not_found", "cmd": c}); continue
        if cid and cid in existing_door_ids:
            dropped.append({"reason": "id_already_present", "cmd": c}); continue
        filtered.append(c)

    if not filtered:
        return {"house": house, "applied": 0, "dropped": len(dropped)}

    normalized, records = normalize_bundle(filtered)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "wallId": cmd.get("wallId"), "id": cmd.get("id")}
        if resp.get("error"):
            entry["status"] = "http_error"; entry["body"] = resp.get("body"); failed += 1
        elif resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            entry["status"] = "applied"; applied += 1
        else:
            entry["status"] = "rejected"
            entry["violations"] = resp.get("violations") or resp.get("result", {}).get("violations")
            failed += 1
        per_command.append(entry)

    return {
        "house": house, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "droppedCount": len(dropped),
        "finalRevision": rev,
        "perCommand": per_command,
    }


def main() -> None:
    for house in HOUSES:
        r = apply_house(house)
        out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-19-{house}-doors-apply.json"
        out_path.write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"=== {house} === applied {r.get('appliedCount', 0)}  failed {r.get('failedCount', 0)}  dropped {r.get('droppedCount', 0)}  rev={r.get('finalRevision','-')}")
        # Top failure rules
        rule_counts: dict[str, int] = {}
        for entry in (r.get("perCommand") or []):
            if entry["status"] == "applied":
                continue
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                if err:
                    r0 = err[0].get("ruleId", "?")
                    rule_counts[r0] = rule_counts.get(r0, 0) + 1
        if rule_counts:
            print(f"  failures: {rule_counts}")


if __name__ == "__main__":
    main()
