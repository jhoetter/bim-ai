"""Iter-14 step 4c — retry the 20 alpha DG windows that failed with
`hosted_opening_lintel_clearance` because sill=1500 + height=1200 = top
at 2700 mm in a 2750 mm wall left only 50 mm head clearance.

Fix: lower sillHeightMm from 1500 to 1300 (top now 2500, head clearance
250 mm — within the kernel's lintel requirement).

Re-emits with NEW ids (`iter14b-alpha-dg-win-*`) so the original commands
remain in the apply log for methodology trace.

Run from repo root:  python3 scripts/testhouse_iter14_alpha_dg_windows_retry.py
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

HOUSE = "alpha"
MODEL_MANIFEST = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{HOUSE}" / "iter-5-canonical-model.json"

# New sill/height that fits under the 2750 wall top with adequate clearance.
NEW_SILL_MM = 1300
NEW_HEIGHT_MM = 1100  # top at 2400, head clearance 350 mm — comfortable.


def main() -> None:
    model_id = json.loads(MODEL_MANIFEST.read_text(encoding="utf-8"))["modelId"]
    snapshot = query_snapshot(model_id)

    # Find the 20 failed DG commands from the iter-14 alpha windows JSON.
    src = json.loads((REPO_ROOT / "tmp/reverse-bim/iter-14-alpha-windows.json").read_text(encoding="utf-8"))
    apply_log = json.loads((REPO_ROOT / "tmp/reverse-bim/iter-14-alpha-windows-apply.json").read_text(encoding="utf-8"))
    failed_ids = {c.get("id") for c in apply_log.get("perCommand", []) if c.get("status") != "applied"}

    # Already-emitted iter14b ids — skip on re-run.
    existing_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict)
    }

    new_cmds: list[dict[str, Any]] = []
    for cmd in src.get("commands", []):
        if cmd.get("id") not in failed_ids:
            continue
        # Already retried? — skip.
        new_id = cmd.get("id", "").replace("iter14-alpha-", "iter14b-alpha-dg-")
        if new_id in existing_ids:
            continue
        new_cmds.append({
            **cmd,
            "id": new_id,
            "sillHeightMm": NEW_SILL_MM,
            "heightMm": NEW_HEIGHT_MM,
        })

    if not new_cmds:
        print(f"=== {HOUSE} DG retry === no commands to retry.")
        return

    normalized, records = normalize_bundle(new_cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "id": cmd.get("id")}
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

    result = {
        "house": HOUSE, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-14-{HOUSE}-dg-retry-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"=== {HOUSE} DG retry === applied {applied}/{applied + failed}  rev={rev}  details={out_path.relative_to(REPO_ROOT)}")
    for entry in per_command:
        marker = "✓" if entry["status"] == "applied" else "✗"
        print(f"  [{entry['i']}] {marker} {entry['id'][:50]} -> {entry['status']}")
        if entry["status"] != "applied":
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                # Filter to error/blocking only
                err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                for vi in err[:3]:
                    print(f"      sev={vi.get('severity')} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")


if __name__ == "__main__":
    main()
