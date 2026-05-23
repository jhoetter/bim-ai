"""Iter-16 step 2 — apply the beta + gamma room JSON emissions from the
two floor-plan-reader subagents through the iter-10 pipeline.

Inputs:
  tmp/reverse-bim/iter-16-beta-rooms.json  (17 createRoomOutline commands)
  tmp/reverse-bim/iter-16-gamma-rooms.json (32 createRoomOutline commands)

Run from repo root:  python3 scripts/testhouse_iter16_apply_rooms.py
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

HOUSES = ("beta", "gamma")


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def apply_house(house: str) -> dict[str, Any]:
    rooms_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-16-{house}-rooms.json"
    if not rooms_path.exists():
        return {"house": house, "error": f"missing {rooms_path}"}
    rooms = json.loads(rooms_path.read_text(encoding="utf-8"))
    commands = rooms.get("commands") or []
    if not commands:
        return {"house": house, "skipped": "no commands"}

    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    existing_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict)
    }

    # Drop commands whose ids are already in the model (idempotent re-runs).
    filtered = [c for c in commands if c.get("id") not in existing_ids]
    dropped = len(commands) - len(filtered)

    normalized, records = normalize_bundle(filtered)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "id": cmd.get("id"), "name": cmd.get("name")}
        if resp.get("error"):
            entry["status"] = "http_error"; entry["body"] = resp.get("body"); failed += 1
        elif resp.get("applied"):
            rev = int(resp.get("newRevision") or rev + 1)
            entry["status"] = "applied"; entry["newRevision"] = rev; applied += 1
        else:
            entry["status"] = "rejected"
            entry["violations"] = resp.get("violations") or resp.get("result", {}).get("violations")
            failed += 1
        per_command.append(entry)

    return {
        "house": house, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "droppedCount": dropped,
        "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }


def main() -> None:
    for house in HOUSES:
        result = apply_house(house)
        out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-16-{house}-rooms-apply.json"
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(
            f"=== {house} ===\n"
            f"  applied:  {result.get('appliedCount')}\n"
            f"  failed:   {result.get('failedCount')}\n"
            f"  dropped:  {result.get('droppedCount')}\n"
            f"  rev:      {result.get('finalRevision')}"
        )
        for entry in (result.get("perCommand") or []):
            if entry["status"] != "applied":
                v = entry.get("violations") or entry.get("body") or []
                if isinstance(v, list):
                    err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                    for vi in err[:1]:
                        print(f"    ✗ {entry.get('id')[:50]} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
