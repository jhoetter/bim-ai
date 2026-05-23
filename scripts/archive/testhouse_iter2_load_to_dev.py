"""Iteration-2 dev-server loader.

Loads each iter-2 authored Document into the running dev server (API on
:28500) so the live view-capture and visual-review endpoints can drive
real screenshots and overlays. Returns the per-house model UUIDs so
later scripts can address them.

Strategy:
* Create a fresh model under the seed-library project for each house
  (the dev server seeds only the seed-library project on bootstrap; no
  public route exists to create projects, so we tag the slug with the
  house name to make them distinguishable).
* Walk ``tmp/reverse-bim/house-<name>/iter-2-authored-model.json``
  element by element and re-emit each element as a single-command
  bundle through ``POST /api/models/{model_id}/bundles``. We honour
  the parentRevision returned by each response.
* Write a per-house manifest at
  ``tmp/reverse-bim/house-<name>/iter-2-dev-model.json`` with the
  assigned modelId so the acceptance loop can address it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]

API_BASE = "http://localhost:28500"
SEED_PROJECT_ID = "892ee9f7-307c-5e40-a838-3bc64b5f5f92"


def http_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")}


def ensure_model(slug: str) -> str:
    body = http_json("POST", f"/api/projects/{SEED_PROJECT_ID}/models", {"slug": slug})
    if body.get("error"):
        # Conflict — slug already exists; query bootstrap to find its id.
        boot = http_json("GET", "/api/bootstrap")
        for proj in boot.get("projects", []):
            if str(proj.get("id")) != SEED_PROJECT_ID:
                continue
            for m in proj.get("models", []):
                if m.get("slug") == slug:
                    return str(m.get("id"))
        raise RuntimeError(f"could not resolve model for slug {slug}: {body}")
    return str(body["id"])


def element_to_command(element: dict[str, Any]) -> dict[str, Any] | None:
    """Translate one Document element back into the kernel command that
    would produce it. Only the subset needed by the iter-2 author script."""

    kind = element.get("kind")
    if kind == "level":
        return {
            "type": "createLevel",
            "id": element["id"],
            "name": element["name"],
            "elevationMm": element["elevationMm"],
            "alsoCreatePlanView": False,
        }
    if kind == "wall":
        # Walls are emitted by the engine from CreateWallChainCmd; on
        # round-trip we can re-emit each wall as a single createWall.
        return {
            "type": "createWall",
            "id": element["id"],
            "levelId": element.get("levelId") or element.get("level_id"),
            "start": element.get("start"),
            "end": element.get("end"),
            "thicknessMm": element.get("thicknessMm") or 365,
            "heightMm": element.get("heightMm") or 2800,
        }
    if kind == "section_cut":
        return {
            "type": "createSectionCut",
            "id": element["id"],
            "name": element.get("name"),
            "lineStartMm": element.get("lineStartMm"),
            "lineEndMm": element.get("lineEndMm"),
            "cropDepthMm": element.get("cropDepthMm") or 9500,
        }
    if kind == "elevation_view":
        cmd: dict[str, Any] = {
            "type": "createElevationView",
            "id": element["id"],
            "name": element.get("name"),
            "direction": element.get("direction") or "north",
            "scale": element.get("scale") or 100.0,
        }
        if element.get("customAngleDeg") is not None:
            cmd["customAngleDeg"] = element["customAngleDeg"]
        return cmd
    if kind == "source_view_evidence":
        return {
            "type": "upsertSourceViewEvidence",
            "id": element["id"],
            "viewElementId": element["viewElementId"],
            "category": element["category"],
            "status": element.get("status") or "missing_source_link",
            "sourceDocumentId": element.get("sourceDocumentId"),
            "sourcePage": element.get("sourcePage"),
            "comparisonType": element.get("comparisonType"),
        }
    # plan_view is auto-created by the engine on createLevel; skip.
    return None


def load_house(house: str) -> dict[str, Any]:
    house_root = REPO_ROOT / "tmp" / "reverse-bim" / house
    model_path = house_root / "iter-2-authored-model.json"
    model_doc = json.loads(model_path.read_text(encoding="utf-8"))

    slug = f"iter2-{house}"
    model_id = ensure_model(slug)
    print(f"{house}: modelId={model_id} (slug={slug})")

    # Walk elements in stable order: levels first, then walls, then views,
    # then evidence. This matches the source-faithful authoring order.
    order = ["level", "wall", "section_cut", "elevation_view", "source_view_evidence"]
    bucketed: dict[str, list[dict[str, Any]]] = {k: [] for k in order}
    for el in (model_doc.get("elements") or {}).values():
        kind = el.get("kind")
        if kind in bucketed:
            bucketed[kind].append(el)

    parent_revision = 1
    applied_count = 0
    failures: list[dict[str, Any]] = []
    for kind in order:
        for el in bucketed[kind]:
            cmd = element_to_command(el)
            if cmd is None:
                continue
            bundle_body = {
                "mode": "commit",
                "bundle": {
                    "schemaVersion": "cmd-v3.0",
                    "commands": [cmd],
                    "assumptions": [
                        {
                            "key": f"iter2.{kind}.{el['id']}",
                            "value": el.get("name") or el.get("id") or "",
                            "confidence": 0.7,
                            "source": "iter-2-load-to-dev",
                            "contestable": True,
                            "evidence": (
                                "Round-trip load of the iter-2 authored "
                                "Document into the dev server for view-"
                                "capture + final-acceptance."
                            ),
                        }
                    ],
                    "parentRevision": parent_revision,
                }
            }
            resp = http_json(
                "POST", f"/api/models/{model_id}/bundles", bundle_body
            )
            if resp.get("error"):
                failures.append(
                    {
                        "kind": kind,
                        "id": el.get("id"),
                        "status": resp.get("status"),
                        "body": resp.get("body", "")[:800],
                    }
                )
                continue
            applied_count += 1
            new_revision = (
                resp.get("newRevision")
                or resp.get("revision")
                or resp.get("modelRevision")
            )
            if new_revision:
                parent_revision = int(new_revision)

    out_path = house_root / "iter-2-dev-model.json"
    out_path.write_text(
        json.dumps(
            {
                "house": house,
                "modelId": model_id,
                "slug": slug,
                "appliedCount": applied_count,
                "failureCount": len(failures),
                "failures": failures,
                "finalRevision": parent_revision,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    return {"house": house, "modelId": model_id, "applied": applied_count, "failed": len(failures)}


def main() -> None:
    for house in ("house-alpha", "house-beta", "house-gamma"):
        summary = load_house(house)
        print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
