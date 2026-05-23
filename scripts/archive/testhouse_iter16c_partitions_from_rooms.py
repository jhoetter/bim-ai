"""Iter-16c — derive interior partitions for beta + gamma from the
iter-16 room polygons (which were authored by floor-plan-reader subagents
without edge classifications).

Algorithm: for each pair of rooms on the same level, find shared edges
(one room's segment equals another's reversed). Each shared edge becomes
a partition wall. Skip edges that lie on or near the exterior envelope
(within 200 mm of the building's xmin/xmax/ymin/ymax for that level).

Emits `createWall` with allowDetached=true + physicalRole=interior_partition.

Run from repo root:  python3 scripts/testhouse_iter16c_partitions_from_rooms.py
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

PARTITION_THICKNESS_MM = 120.0
PARTITION_HEIGHT_MM = 2700.0
EXTERIOR_TOL_MM = 200.0


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def rooms_for_house(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict) or e.get("kind") != "room":
            continue
        outline = e.get("outlineMm") or []
        if not outline:
            continue
        verts: list[tuple[float, float]] = []
        for p in outline:
            x = p.get("xMm")
            y = p.get("yMm")
            if x is None or y is None:
                continue
            verts.append((float(x), float(y)))
        if len(verts) >= 3:
            out.append({
                "id": e.get("id"),
                "name": e.get("name"),
                "levelId": e.get("levelId"),
                "verts": verts,
            })
    return out


def exterior_bbox(rooms_on_level: list[dict[str, Any]]) -> tuple[float, float, float, float]:
    xs: list[float] = []
    ys: list[float] = []
    for r in rooms_on_level:
        for (x, y) in r["verts"]:
            xs.append(x); ys.append(y)
    if not xs:
        return (0, 0, 0, 0)
    return min(xs), max(xs), min(ys), max(ys)


def edges_of(room: dict[str, Any]) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    out: list[tuple[tuple[float, float], tuple[float, float]]] = []
    verts = room["verts"]
    n = len(verts)
    for i in range(n):
        a = verts[i]
        b = verts[(i + 1) % n]
        out.append((a, b))
    return out


def canon(a: tuple[float, float], b: tuple[float, float]) -> tuple[tuple[float, float], tuple[float, float]]:
    return (a, b) if a <= b else (b, a)


def on_exterior(seg: tuple[tuple[float, float], tuple[float, float]], bbox: tuple[float, float, float, float]) -> bool:
    a, b = seg
    xmin, xmax, ymin, ymax = bbox
    # Vertical segment (same x): exterior if x near xmin or xmax
    if abs(a[0] - b[0]) < 1.0:
        x = a[0]
        if abs(x - xmin) < EXTERIOR_TOL_MM or abs(x - xmax) < EXTERIOR_TOL_MM:
            return True
    # Horizontal: y near ymin/ymax
    if abs(a[1] - b[1]) < 1.0:
        y = a[1]
        if abs(y - ymin) < EXTERIOR_TOL_MM or abs(y - ymax) < EXTERIOR_TOL_MM:
            return True
    return False


def derive_partitions_for_house(house: str) -> dict[str, Any]:
    model_id = model_id_for(house)
    snapshot = query_snapshot(model_id)
    rooms = rooms_for_house(snapshot)

    # Group rooms by level
    by_level: dict[str, list[dict[str, Any]]] = {}
    for r in rooms:
        by_level.setdefault(r["levelId"], []).append(r)

    cmds: list[dict[str, Any]] = []
    counter = 0
    existing_ids = {e.get("id") for e in (snapshot.get("elements") or {}).values() if isinstance(e, dict)}

    for level, level_rooms in by_level.items():
        if not level_rooms:
            continue
        bbox = exterior_bbox(level_rooms)

        # Collect all unique non-exterior edges (one wall per unique edge)
        unique_edges: set[tuple[tuple[float, float], tuple[float, float]]] = set()
        for r in level_rooms:
            for seg in edges_of(r):
                c = canon(seg[0], seg[1])
                if on_exterior(c, bbox):
                    continue
                unique_edges.add(c)

        for (a, b) in sorted(unique_edges):
            wall_id = f"iter16c-{house}-{level}-p{counter:03d}"
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
                "authoringIntent": f"iter16c-{house}-partition",
            })

    if not cmds:
        return {"house": house, "applied": 0, "note": "no partitions to emit"}

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

    return {
        "house": house, "modelId": model_id,
        "appliedCount": applied, "failedCount": failed, "finalRevision": rev,
        "perCommand": per_command,
    }


def main() -> None:
    overall: dict[str, Any] = {}
    for house in HOUSES:
        result = derive_partitions_for_house(house)
        overall[house] = {
            "applied": result.get("appliedCount"),
            "failed": result.get("failedCount"),
            "rev": result.get("finalRevision"),
        }
        print(
            f"=== {house} ===  applied {result.get('appliedCount')}/{result.get('appliedCount', 0) + result.get('failedCount', 0)}  rev={result.get('finalRevision','-')}",
        )
        rule_counts: dict[str, int] = {}
        for entry in result.get("perCommand") or []:
            if entry["status"] == "applied":
                continue
            v = entry.get("violations") or entry.get("body") or []
            if isinstance(v, list):
                err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                if err:
                    r = err[0].get("ruleId", "?")
                    rule_counts[r] = rule_counts.get(r, 0) + 1
        if rule_counts:
            print(f"  failures by rule: {rule_counts}")
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-16c-partitions-apply.json"
    out_path.write_text(json.dumps(overall, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
