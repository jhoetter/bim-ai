"""Iteration-2 acceptance attempt for all three testhouses.

Runs ``build_final_acceptance_report`` against each authored model with
the QA / evidence inputs that are available offline (level completeness,
physical topology). Anything that requires a live BIM web app — Advisor,
constructability, visual review, source-overlay screenshots — is left
unsupplied so the report's blocking findings explicitly document the
remaining iter-3 gates.

Writes per-house ``tmp/reverse-bim/house-<name>/iter-2-acceptance.json``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from bim_ai.document import Document  # noqa: E402
from bim_ai.final_acceptance import build_final_acceptance_report  # noqa: E402
from bim_ai.reverse_bim_acceptance_evidence import (  # noqa: E402
    build_level_completeness_report,
    build_physical_topology_report,
)


def _load_document(path: Path) -> Document:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Document.model_validate(raw)


def _required_levels_for(house: str) -> list[dict[str, Any]]:
    names = {
        "house-alpha": ["KG", "EG", "DG"],
        "house-beta": ["KG", "EG", "DG"],
        "house-gamma": ["KG", "EG", "OG", "DG", "Spitzboden"],
    }[house]
    return [
        {"levelId": f"lvl-{name.lower().replace('spitzboden', 'spitz')}", "name": name}
        for name in names
    ]


def _model_level_summaries(doc: Document) -> list[dict[str, Any]]:
    """Roll up the authored Document into per-level summaries for the
    level-completeness checker."""

    by_level: dict[str, dict[str, Any]] = {}
    for el in doc.elements.values():
        kind = el.kind
        level_id = getattr(el, "level_id", None) or getattr(el, "levelId", None)
        if kind == "level":
            level_id = el.id
        if not level_id:
            continue
        slot = by_level.setdefault(
            str(level_id),
            {"levelId": str(level_id), "modeledPhysicalElementCount": 0},
        )
        if kind in {"wall", "door", "window", "floor", "roof", "stair", "railing"}:
            slot["modeledPhysicalElementCount"] += 1
    return list(by_level.values())


def run_house(house: str) -> dict[str, Any]:
    house_root = REPO_ROOT / "tmp" / "reverse-bim" / house
    model_path = house_root / "iter-2-authored-model.json"
    doc = _load_document(model_path)

    required_levels = _required_levels_for(house)
    model_level_summaries = _model_level_summaries(doc)
    level_report = build_level_completeness_report(
        required_levels=required_levels,
        model_level_summaries=model_level_summaries,
    )
    topology_report = build_physical_topology_report()
    acceptance = build_final_acceptance_report(
        model_id=house,
        level_completeness=level_report,
        physical_topology=topology_report,
    )

    (house_root / "iter-2-acceptance.json").write_text(
        json.dumps(
            {
                "house": house,
                "modelId": house,
                "levelCompleteness": level_report,
                "physicalTopology": topology_report,
                "acceptance": acceptance,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    return {
        "house": house,
        "modelId": house,
        "acceptanceAccepted": acceptance.get("accepted"),
        "blockingCount": (acceptance.get("summary") or {}).get("blockingCount", 0),
        "levelCompleteness": {
            "accepted": level_report.get("accepted"),
            "missingCount": (level_report.get("summary") or {}).get(
                "missingLevelCount", 0
            ),
        },
        "physicalTopology": {
            "accepted": topology_report.get("accepted"),
            "blockingCount": (topology_report.get("summary") or {}).get(
                "blockingCount", 0
            ),
        },
    }


def main() -> None:
    for house in ("house-alpha", "house-beta", "house-gamma"):
        summary = run_house(house)
        print(f"=== {house} ===")
        print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
