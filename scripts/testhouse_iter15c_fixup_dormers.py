"""Iter-15c — fix-up the missing dormers from iter-15b.

The iter-15b re-emit accidentally collapsed 8 alpha dormers (and 4 gamma
dormers) into a smaller set of unique-suffix ids because the collision-
detection used a stale pre-bundle snapshot. After iter-15b:
  - alpha has 4 dormers (need 8); missing 4 (the iter-13 berg-w, berg-e,
    tal-w, tal-e duplicates of the iter-14 c1/c2 suffixes)
  - gamma has 2 dormers (need 4); missing 2

Re-emit the missing ones with distinct iter-15c ids.

Alpha layout (8 dormers, roof footprint -9935..+9935 × 0..8100):
  Berg slope (across=+2200):  along=-7200, -2400, +2400, +7200
  Tal  slope (across=-2200):  along=-7200, -2400, +2400, +7200

Gamma layout (4 dormers, roof footprint 0..18000 × 0..8000):
  iter-9 emitted positions need reconstructing from iter-9 corrector.

Run from repo root:  python3 scripts/testhouse_iter15c_fixup_dormers.py
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

ALPHA_HOST = "iter15-alpha-roof-tiled"
GAMMA_HOST = "iter15-gamma-roof-tiled"


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def existing_dormer_positions(snapshot: dict[str, Any], host: str) -> set[tuple[float, float]]:
    out: set[tuple[float, float]] = set()
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and e.get("kind") == "dormer" and e.get("hostRoofId") == host:
            pos = e.get("positionOnRoof") or {}
            out.add((float(pos.get("alongRidgeMm", 0)), float(pos.get("acrossRidgeMm", 0))))
    return out


def emit_alpha_missing() -> list[dict[str, Any]]:
    model_id = model_id_for("alpha")
    snapshot = query_snapshot(model_id)
    have = existing_dormer_positions(snapshot, ALPHA_HOST)

    want = []
    for across, side in ((2200.0, "berg"), (-2200.0, "tal")):
        for along, label in ((-7200.0, "w"), (-2400.0, "c1"), (2400.0, "c2"), (7200.0, "e")):
            want.append((along, across, side, label))

    cmds: list[dict[str, Any]] = []
    for along, across, side, label in want:
        if (along, across) in have:
            continue
        cmds.append({
            "type": "createDormer",
            "id": f"iter15c-alpha-dormer-{side}-{label}",
            "name": f"Schleppgaube — {side.title()} slope, {label}",
            "hostRoofId": ALPHA_HOST,
            "positionOnRoof": {"alongRidgeMm": along, "acrossRidgeMm": across},
            "widthMm": 1800.0,
            "wallHeightMm": 1200.0,
            "depthMm": 1800.0,
            "dormerRoofKind": "shed",
            "dormerRoofPitchDeg": 20.0,
        })
    return cmds


def emit_gamma_missing() -> list[dict[str, Any]]:
    model_id = model_id_for("gamma")
    snapshot = query_snapshot(model_id)
    have = existing_dormer_positions(snapshot, GAMMA_HOST)

    # Source gamma had 4 dormers (2 per slope). Emit at equally-spaced
    # positions across the 18m ridge.
    want = []
    for across, side in ((1500.0, "north"), (-1500.0, "south")):
        for along, label in ((-4500.0, "w"), (4500.0, "e")):
            want.append((along, across, side, label))

    cmds: list[dict[str, Any]] = []
    for along, across, side, label in want:
        if (along, across) in have:
            continue
        cmds.append({
            "type": "createDormer",
            "id": f"iter15c-gamma-dormer-{side}-{label}",
            "name": f"Dachgaube — {side} slope, {label}",
            "hostRoofId": GAMMA_HOST,
            "positionOnRoof": {"alongRidgeMm": along, "acrossRidgeMm": across},
            "widthMm": 1600.0,
            "wallHeightMm": 1300.0,
            "depthMm": 1600.0,
            "dormerRoofKind": "shed",
            "dormerRoofPitchDeg": 20.0,
        })
    return cmds


def run_house(house: str, commands: list[dict[str, Any]]) -> dict[str, Any]:
    if not commands:
        return {"house": house, "applied": 0, "skipped": "no missing dormers"}
    model_id = model_id_for(house)
    normalized, records = normalize_bundle(commands)
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
    return {"house": house, "applied": applied, "failed": failed, "rev": rev, "perCommand": per_command}


def main() -> None:
    overall: dict[str, Any] = {}
    for house, fn in (("alpha", emit_alpha_missing), ("gamma", emit_gamma_missing)):
        cmds = fn()
        result = run_house(house, cmds)
        overall[house] = {"applied": result.get("applied"), "failed": result.get("failed"), "rev": result.get("rev")}
        print(
            f"=== {house} ===  applied {result.get('applied')}/{result.get('applied', 0) + result.get('failed', 0)}  rev={result.get('rev','-')}",
        )
        for entry in result.get("perCommand") or []:
            marker = "✓" if entry["status"] == "applied" else "✗"
            print(f"  [{entry['i']}] {marker} {entry.get('id','?')[:40]} -> {entry['status']}")
            if entry["status"] != "applied":
                v = entry.get("violations") or entry.get("body") or []
                if isinstance(v, list):
                    err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                    for vi in err[:1]:
                        print(f"      rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-15c-fixup-dormers-apply.json"
    out_path.write_text(json.dumps(overall, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
