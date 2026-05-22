"""Iter-16 — inside-out methodology pivot, alpha. Author all 45 fact-ledger
rooms via createRoomPoly. Each room emit creates N perimeter wall segments
(interior partitions, with duplicates on shared edges) + 1 RoomElem with
the polygon outline.

Alpha's fact ledger (`tmp/reverse-bim/house-alpha/understanding/
source-fact-ledger.json`) has 45 rooms with full numeric `boundaryMm`
coordinates and `areaM2` annotations — extracted by iter-1's AI vision
pass. We trust those boundaries directly and emit them as kernel rooms.

Key methodology learning from iter-1: the boundary coords use `x_mm` /
`y_mm` (snake_case) instead of the kernel's `xMm` / `yMm` (camelCase).
We normalize on read.

Alpha is a Doppelhaus = two mirrored units. The fact ledger labels rooms
"west half" but their coordinates are in the iter-12 east half range
(0..9700). We:
  1. Author the fact-ledger rooms AS-IS at their original coordinates
     (which fall in the iter-12 east half x=0..+9935).
  2. Mirror each room across x=0 for the iter-12 west half (negating
     x coords) so the full Doppelhaus is populated.

Run from repo root:  python3 scripts/testhouse_iter16_alpha_rooms.py
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

# Fact ledger uses `alpha-level-{eg,dg,kg}` as levelId; live model uses `lvl-{eg,dg,kg}`.
LEVEL_REMAP = {
    "alpha-level-eg": "lvl-eg",
    "alpha-level-dg": "lvl-dg",
    "alpha-level-kg": "lvl-kg",
}

INTERIOR_PARTITION_THICKNESS_MM = 150.0
INTERIOR_WALL_HEIGHT_MM = 2750.0


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def load_rooms() -> list[dict[str, Any]]:
    ledger = json.loads(
        (REPO_ROOT / "tmp/reverse-bim/house-alpha/understanding/source-fact-ledger.json")
        .read_text(encoding="utf-8")
    )
    rooms: list[dict[str, Any]] = []
    for f in ledger.get("facts", []):
        if f.get("kind") != "room":
            continue
        v = f.get("value") or {}
        boundary = v.get("boundaryMm")
        if not isinstance(boundary, list) or not boundary:
            continue
        # Normalize keys snake_case → camelCase
        verts = []
        for p in boundary:
            if not isinstance(p, dict):
                continue
            x = p.get("xMm", p.get("x_mm"))
            y = p.get("yMm", p.get("y_mm"))
            if x is None or y is None:
                continue
            verts.append({"xMm": float(x), "yMm": float(y)})
        if len(verts) < 3:
            continue
        level_raw = v.get("levelId")
        level_id = LEVEL_REMAP.get(level_raw, level_raw)
        rooms.append({
            "factId": f.get("factId"),
            "name": v.get("name") or "Room",
            "levelId": level_id,
            "areaM2": v.get("areaM2"),
            "vertices": verts,
        })
    return rooms


def mirror_vertices(verts: list[dict[str, float]]) -> list[dict[str, float]]:
    """Mirror across x=0 (negate x). Reverse order so the polygon stays CCW
    after the mirror (otherwise the kernel may see a self-intersecting poly)."""
    mirrored = [{"xMm": -v["xMm"], "yMm": v["yMm"]} for v in verts]
    return list(reversed(mirrored))


def emit_room_cmd(room: dict[str, Any], room_id: str) -> dict[str, Any]:
    """Use createRoomOutline (room polygon only, no walls) so we don't
    collide with existing exterior walls or create duplicate interior
    partitions on shared edges between adjacent rooms. Partition walls
    can be added as a separate pass once we know which edges are interior."""
    return {
        "type": "createRoomOutline",
        "id": room_id,
        "name": room.get("name") or "Room",
        "levelId": room.get("levelId"),
        "outlineMm": room["vertices"],
        "functionLabel": room.get("name") or None,
        "targetAreaM2": room.get("areaM2"),
    }


def main() -> None:
    model_id = model_id_for(HOUSE)
    snapshot = query_snapshot(model_id)
    existing_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict)
    }

    rooms = load_rooms()
    print(f"loaded {len(rooms)} alpha rooms from fact ledger")

    cmds: list[dict[str, Any]] = []
    east_seen = 0
    west_seen = 0
    for r in rooms:
        # East-half emission (uses fact-ledger coords as-is)
        east_id = f"iter16-room-east-{r['factId']}"
        if east_id not in existing_ids:
            cmds.append(emit_room_cmd(r, east_id))
            east_seen += 1
        # West-half emission (mirrored across x=0)
        mirrored = mirror_vertices(r["vertices"])
        mirrored_room = {**r, "vertices": mirrored}
        west_id = f"iter16-room-west-{r['factId']}"
        if west_id not in existing_ids:
            cmds.append(emit_room_cmd(mirrored_room, west_id))
            west_seen += 1

    print(f"  east half: {east_seen} rooms to emit; west half: {west_seen} rooms (mirrored)")
    if not cmds:
        print("nothing to emit")
        return

    normalized, records = normalize_bundle(cmds)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)

    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type"), "roomId": cmd.get("roomId"), "name": cmd.get("name")}
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
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-16-{HOUSE}-rooms-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n=== {HOUSE} ===  applied {applied}/{applied + failed}  rev={rev}  details={out_path.relative_to(REPO_ROOT)}")

    # Show top 5 failures by rule
    rule_counts: dict[str, int] = {}
    for entry in per_command:
        if entry["status"] == "applied":
            continue
        v = entry.get("violations") or entry.get("body") or []
        if isinstance(v, list):
            err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
            if err:
                r = err[0].get("ruleId", "?")
                rule_counts[r] = rule_counts.get(r, 0) + 1
    if rule_counts:
        print("Failure rule counts:")
        for rule, ct in sorted(rule_counts.items(), key=lambda kv: -kv[1]):
            print(f"  {ct:3d}× {rule}")


if __name__ == "__main__":
    main()
