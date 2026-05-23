"""Iter-9 apply deep-corrector responses.

Reads the three deepCorrector_v1 JSON files at
tmp/reverse-bim/iter-9-{house}-corrector.json and applies their kernel
commands to the corresponding canonical iter-5 models. One bundle
per command (so a single bad command doesn't abort the rest).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
API_BASE = "http://localhost:28500"

HOUSES = {
    "house-alpha": (
        "tmp/reverse-bim/house-alpha/iter-5-canonical-model.json",
        "tmp/reverse-bim/iter-9-alpha-corrector.json",
    ),
    "house-beta": (
        "tmp/reverse-bim/house-beta/iter-5-canonical-model.json",
        "tmp/reverse-bim/iter-9-beta-corrector.json",
    ),
    "house-gamma": (
        "tmp/reverse-bim/house-gamma/iter-5-canonical-model.json",
        "tmp/reverse-bim/iter-9-gamma-corrector.json",
    ),
}


def http_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except error.HTTPError as exc:
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")[:500]}


def commit(model_id: str, cmd: dict[str, Any], rev: int, op: str) -> tuple[int, str | None]:
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [cmd],
            "assumptions": [
                {
                    "key": f"iter9.{op}.{cmd.get('id') or cmd.get('toposolidId') or cmd.get('elementId') or op}",
                    "value": str(cmd.get("name") or cmd.get("type")),
                    "confidence": 0.7,
                    "source": "iter9_deep_corrector",
                    "contestable": True,
                    "evidence": "iter-9 deep-corrector kernel command",
                }
            ],
            "parentRevision": rev,
        },
    }
    resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
    if resp.get("error") or not resp.get("applied"):
        body = resp.get("body") or json.dumps(resp)
        return rev, body[:300]
    return int(resp.get("newRevision") or rev + 1), None


def apply_house(house: str, model_manifest: str, corrector_path: str) -> dict[str, Any]:
    model_id = json.loads((REPO_ROOT / model_manifest).read_text(encoding="utf-8"))["modelId"]
    corrector = json.loads((REPO_ROOT / corrector_path).read_text(encoding="utf-8"))
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or 1)
    applied = 0
    errors: list[dict[str, Any]] = []
    for i, cmd in enumerate(corrector.get("commands") or []):
        op = cmd.get("type", "?")
        new_rev, err = commit(model_id, cmd, rev, op)
        if err is not None:
            errors.append({"i": i, "type": op, "err": err})
        else:
            rev = new_rev
            applied += 1
    return {
        "house": house,
        "modelId": model_id,
        "applied": applied,
        "errors": errors,
        "finalRevision": rev,
    }


def main() -> None:
    for house, (manifest, corrector) in HOUSES.items():
        result = apply_house(house, manifest, corrector)
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
