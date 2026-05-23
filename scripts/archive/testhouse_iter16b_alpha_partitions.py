"""Iter-16b — emit interior partition walls between alpha rooms.

`createRoomOutline` creates room polygons but no walls. To make the
interior layout visible in plan/3D views, we need explicit interior
partition walls.

The alpha fact ledger annotates each room boundary edge with a
classification (`exterior-{n,s,e,w}` vs `partition-{...}`). We use that
to emit `createWall` ONLY for edges classified as `partition-*`,
skipping `exterior-*` edges (which already have a wall from iter-5+
exterior emissions) and `party-*` edges (which would conflict with the
party-wall at x=0).

The same wall may be classified as a partition for two adjacent rooms
(e.g. west room's east edge + east room's west edge). We dedupe by
keeping a per-level set of (start, end) tuples seen.

For the iter-12 west-half mirror, partition edges have their x
coordinates negated (same convention as iter-16 rooms).

Run from repo root:  python3 scripts/testhouse_iter16b_alpha_partitions.py
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

LEVEL_REMAP = {
    "alpha-level-eg": "lvl-eg",
    "alpha-level-dg": "lvl-dg",
    "alpha-level-kg": "lvl-kg",
}

PARTITION_THICKNESS_MM = 120.0
PARTITION_HEIGHT_MM = 2700.0


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def load_rooms_with_edges() -> list[dict[str, Any]]:
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
        edges = v.get("boundaryEdges")
        if not isinstance(boundary, list) or not isinstance(edges, list):
            continue
        verts = []
        for p in boundary:
            if not isinstance(p, dict):
                continue
            x = p.get("xMm", p.get("x_mm"))
            y = p.get("yMm", p.get("y_mm"))
            if x is None or y is None:
                continue
            verts.append((float(x), float(y)))
        if len(verts) < 3:
            continue
        if len(verts) != len(edges):
            # Edge labels don't match vertex count — skip.
            continue
        level_id = LEVEL_REMAP.get(v.get("levelId"), v.get("levelId"))
        rooms.append({
            "factId": f.get("factId"),
            "name": v.get("name"),
            "levelId": level_id,
            "vertices": verts,
            "edges": edges,
        })
    return rooms


def edge_segments_from_room(room: dict[str, Any]) -> list[tuple[tuple[float, float], tuple[float, float], str]]:
    """Walk room edges as (start, end, edge_label) tuples."""
    verts = room["vertices"]
    edges = room["edges"]
    n = len(verts)
    out: list[tuple[tuple[float, float], tuple[float, float], str]] = []
    for i in range(n):
        a = verts[i]
        b = verts[(i + 1) % n]
        out.append((a, b, edges[i]))
    return out


def canonical_segment(a: tuple[float, float], b: tuple[float, float]) -> tuple[tuple[float, float], tuple[float, float]]:
    """Return (start, end) canonicalised so (a,b) and (b,a) hash the same."""
    return (a, b) if a <= b else (b, a)


def collect_partition_segments(rooms: list[dict[str, Any]], mirror: bool) -> dict[str, set[tuple[tuple[float, float], tuple[float, float]]]]:
    """Return {level_id: {canonical_segment, ...}} of partition-classified edges."""
    out: dict[str, set[tuple[tuple[float, float], tuple[float, float]]]] = {}
    for room in rooms:
        level = room["levelId"]
        out.setdefault(level, set())
        for a, b, label in edge_segments_from_room(room):
            if not label.startswith("partition"):
                continue
            if mirror:
                a = (-a[0], a[1])
                b = (-b[0], b[1])
            out[level].add(canonical_segment(a, b))
    return out


def main() -> None:
    model_id = model_id_for(HOUSE)
    snapshot = query_snapshot(model_id)
    existing_ids = {
        e.get("id") for e in (snapshot.get("elements") or {}).values()
        if isinstance(e, dict)
    }

    rooms = load_rooms_with_edges()
    print(f"loaded {len(rooms)} alpha rooms with edge classifications")

    east_segs = collect_partition_segments(rooms, mirror=False)
    west_segs = collect_partition_segments(rooms, mirror=True)

    cmds: list[dict[str, Any]] = []
    counter = 0
    for half_name, segs_per_level in (("east", east_segs), ("west", west_segs)):
        for level, segs in segs_per_level.items():
            for (a, b) in sorted(segs):
                wall_id = f"iter16b-alpha-{half_name}-{level}-p{counter:03d}"
                counter += 1
                if wall_id in existing_ids:
                    continue
                cmds.append({
                    "type": "createWall",
                    "id": wall_id,
                    "name": wall_id,
                    "levelId": level,
                    "start": {"xMm": a[0], "yMm": a[1]},
                    "end":   {"xMm": b[0], "yMm": b[1]},
                    "thicknessMm": PARTITION_THICKNESS_MM,
                    "heightMm": PARTITION_HEIGHT_MM,
                    "allowDetached": True,
                    "physicalRole": "interior_partition",
                    "authoringIntent": "iter16b-partition",
                })

    print(f"  partition segments to emit: {len(cmds)}")
    if not cmds:
        return

    normalized, records = normalize_bundle(cmds)
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
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / f"iter-16b-{HOUSE}-partitions-apply.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n=== {HOUSE} partitions === applied {applied}/{applied + failed}  rev={rev}")

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
