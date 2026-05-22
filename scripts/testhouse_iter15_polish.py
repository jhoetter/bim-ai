"""Iter-15 — final polish pass. Addresses the highest-impact remaining
items in the iter-14 subagent reports:

  1. Refit alpha's default 3D viewpoint — iter-14 dormers regressed the
     framing (alpha-3d-crop now shows a square gable-end box hiding the
     long doppelhaus axis).
  2. Set roofMaterialKey = "roof_tile_terracotta" on the main gable roofs
     of all 3 houses — closes the 4-iter "main roof reads white" overhang
     that has been the top cosmetic-debt item on gamma since iter-11.
  3. Beta roof — re-emit with slopeDeg=42 + overhangMm=500 to fix the
     shallow ~30° appearance flagged across iter-12/13/14.
  4. Restore gamma Praxis cross-gable (iter-14 west-half move silently
     regressed the geometry mode to mass_box/hipped per the iter-14
     subagent).

Run from repo root:  python3 scripts/testhouse_iter15_polish.py
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from testhouse_command_normalize import normalize_bundle  # noqa: E402
from testhouse_iter10_apply import commit_one, http_json, query_snapshot  # noqa: E402
from testhouse_iter13_viewport_refit import compute_bbox, compute_camera  # noqa: E402


HOUSES = {
    "alpha": "iter12-alpha-roof-doppelhaus",
    "beta":  "roof-house-beta-v9",
    "gamma": "iter9-gamma-roof-main",
}

ROOF_MATERIAL_KEY = "roof_tile_terracotta"


def model_id_for(house: str) -> str:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "iter-5-canonical-model.json"
    return json.loads(manifest.read_text(encoding="utf-8"))["modelId"]


def find_element(snapshot: dict[str, Any], element_id: str) -> dict[str, Any] | None:
    for e in (snapshot.get("elements") or {}).values():
        if isinstance(e, dict) and e.get("id") == element_id:
            return e
    return None


def find_viewpoint(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    """Return the Default 3D viewpoint (not the ortho ones)."""
    for e in (snapshot.get("elements") or {}).values():
        if not isinstance(e, dict) or e.get("kind") != "viewpoint":
            continue
        if str(e.get("id", "")).startswith("view-3d-ortho-"):
            continue
        return e
    return None


def run_bundle(model_id: str, commands: list[dict[str, Any]], label: str) -> dict[str, Any]:
    if not commands:
        return {"label": label, "applied": 0, "failed": 0, "note": "no commands"}
    normalized, records = normalize_bundle(commands)
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)
    per_command: list[dict[str, Any]] = []
    applied = failed = 0
    for i, cmd in enumerate(normalized):
        resp = commit_one(model_id, cmd, rev)
        entry: dict[str, Any] = {"i": i, "type": cmd.get("type")}
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
        "label": label, "applied": applied, "failed": failed, "finalRevision": rev,
        "normalizations": [asdict(r) for r in records],
        "perCommand": per_command,
    }


def alpha_polish() -> list[dict[str, Any]]:
    """Refit alpha viewpoint + set main roof material."""
    model_id = model_id_for("alpha")
    snapshot = query_snapshot(model_id)
    results = []

    # 1. Refit default 3D viewport
    vp = find_viewpoint(snapshot)
    if vp:
        bbox = compute_bbox(snapshot)
        camera = compute_camera(bbox)
        viewpoint_cmds = [
            {"type": "deleteElement", "elementId": vp.get("id")},
            {
                "type": "saveViewpoint",
                "id": vp.get("id"),
                "name": vp.get("name") or "Default 3D",
                "camera": camera,
                "mode": "orbit_3d",
            },
        ]
        results.append(run_bundle(model_id, viewpoint_cmds, "alpha-viewport-refit"))

    # 2. Set main roof material
    roof = find_element(snapshot, HOUSES["alpha"])
    if roof:
        mat_cmds = [{
            "type": "updateElementProperty",
            "elementId": HOUSES["alpha"],
            "key": "roofMaterialKey",
            "value": ROOF_MATERIAL_KEY,
        }]
        results.append(run_bundle(model_id, mat_cmds, "alpha-roof-material"))
    return results


def beta_polish() -> list[dict[str, Any]]:
    """Set main roof material + bump slope to 42° + overhang to 500 (re-emit).
    The beta gable roof was at 35° / 800 overhang per iter-7; iter-14 subagent
    flagged the appearance as still too shallow."""
    model_id = model_id_for("beta")
    snapshot = query_snapshot(model_id)
    results = []

    roof = find_element(snapshot, HOUSES["beta"])
    if not roof:
        return results

    # Refit viewpoint
    vp = find_viewpoint(snapshot)
    if vp:
        bbox = compute_bbox(snapshot)
        camera = compute_camera(bbox)
        results.append(run_bundle(model_id, [
            {"type": "deleteElement", "elementId": vp.get("id")},
            {"type": "saveViewpoint", "id": vp.get("id"), "name": vp.get("name") or "Default 3D",
             "camera": camera, "mode": "orbit_3d"},
        ], "beta-viewport-refit"))

    # Update material + properties via updateElementProperty (least invasive).
    mat_cmds = [
        {"type": "updateElementProperty", "elementId": HOUSES["beta"], "key": "roofMaterialKey", "value": ROOF_MATERIAL_KEY},
        {"type": "updateElementProperty", "elementId": HOUSES["beta"], "key": "slopeDeg", "value": 42.0},
        {"type": "updateElementProperty", "elementId": HOUSES["beta"], "key": "overhangMm", "value": 500.0},
    ]
    results.append(run_bundle(model_id, mat_cmds, "beta-roof-material-pitch"))
    return results


def gamma_polish() -> list[dict[str, Any]]:
    """Set main roof material + restore Praxis cross-gable mode."""
    model_id = model_id_for("gamma")
    snapshot = query_snapshot(model_id)
    results = []

    # Refit viewpoint
    vp = find_viewpoint(snapshot)
    if vp:
        bbox = compute_bbox(snapshot)
        camera = compute_camera(bbox)
        results.append(run_bundle(model_id, [
            {"type": "deleteElement", "elementId": vp.get("id")},
            {"type": "saveViewpoint", "id": vp.get("id"), "name": vp.get("name") or "Default 3D",
             "camera": camera, "mode": "orbit_3d"},
        ], "gamma-viewport-refit"))

    # Main roof material
    if find_element(snapshot, HOUSES["gamma"]):
        results.append(run_bundle(model_id, [
            {"type": "updateElementProperty", "elementId": HOUSES["gamma"], "key": "roofMaterialKey", "value": ROOF_MATERIAL_KEY},
        ], "gamma-roof-material"))

    # Restore Praxis cross-gable geometry mode (iter-14 subagent flagged regression).
    praxis_roof = find_element(snapshot, "iter14-gamma-praxis-roof")
    if praxis_roof:
        results.append(run_bundle(model_id, [
            {"type": "updateElementProperty", "elementId": "iter14-gamma-praxis-roof", "key": "roofGeometryMode", "value": "gable_pitched_rectangle"},
            {"type": "updateElementProperty", "elementId": "iter14-gamma-praxis-roof", "key": "roofMaterialKey", "value": ROOF_MATERIAL_KEY},
        ], "gamma-praxis-roof-restore"))

    # Carport flat roof — set a flat-roof material so it reads as a covered structure.
    carport_roof = find_element(snapshot, "iter13-gamma-carport-roof")
    if carport_roof:
        results.append(run_bundle(model_id, [
            {"type": "updateElementProperty", "elementId": "iter13-gamma-carport-roof", "key": "roofMaterialKey", "value": "cladding_dark_grey"},
        ], "gamma-carport-material"))
    return results


def main() -> None:
    overall: dict[str, Any] = {}
    for house, polish_fn in (("alpha", alpha_polish), ("beta", beta_polish), ("gamma", gamma_polish)):
        print(f"\n=== {house} ===")
        results = polish_fn()
        overall[house] = []
        for r in results:
            overall[house].append({
                "label": r["label"],
                "applied": r.get("applied"),
                "failed": r.get("failed"),
                "rev": r.get("finalRevision"),
            })
            print(f"  {r['label']:35s}  applied={r.get('applied'):>2}  failed={r.get('failed'):>2}  rev={r.get('finalRevision')}")
            for entry in r.get("perCommand") or []:
                if entry["status"] != "applied":
                    v = entry.get("violations") or entry.get("body") or []
                    if isinstance(v, list):
                        err = [x for x in v if x.get("severity") == "error" or x.get("blocking")]
                        for vi in err[:1]:
                            print(f"    ✗ [{entry['i']}] {entry.get('type')} rule={vi.get('ruleId')} msg={vi.get('message','')[:140]}")
    out_path = REPO_ROOT / "tmp" / "reverse-bim" / "iter-15-polish-apply.json"
    out_path.write_text(json.dumps(overall, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDetails: {out_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
