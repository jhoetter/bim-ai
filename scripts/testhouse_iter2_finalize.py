"""Iteration-2 finalize script for the testhouse hybrid reverse-BIM tracker.

This is the operating script that drives houses from
``source_understanding_blocked`` toward accepted-model status:

1. Re-runs ``build_reverse_bim_folder_output`` for each house with the
   iteration-2 scope decisions + (when available) consensus dispositions
   wired in.
2. Reports the resulting package state, blocker counts, and MCP-readiness
   shifts.
3. Persists a per-house iteration-2 status snapshot under
   ``tmp/reverse-bim/house-<name>/iter-2-status.json`` so the tracker can
   cite concrete numbers.

The script is callable as ``uv run python scripts/testhouse_iter2_finalize.py``
from the ``app/`` directory.
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

from bim_ai.folder_output import build_reverse_bim_folder_output  # noqa: E402


SCOPE_DECISIONS_BY_HOUSE: dict[str, list[dict[str, Any]]] = {
    "house-alpha": [
        {
            "decisionId": "alpha-target-half-east",
            "status": "accepted",
            "targetScopeType": "target_half",
            "modeledExtent": (
                "Present east half of the 1956 Reinecke Doppelhaus at "
                "Weidenstraße 4, Schalksmühle. Modeling target is the "
                "current as-is east-half unit shown in the 535_06 KH "
                "Exposé (pages 14-16, photos on page 9). The 1956 plan set "
                "(EG.pdf, DG.pdf, Grundrisse, Schnitt.pdf) depicts the "
                "full Doppelhaus; only the east-half half-house is "
                "modeled, the west neighbouring half is context only."
            ),
            "evidenceSummary": (
                "535_06 KH Exposé p.14-16 current-condition plans of the "
                "east half + p.9 modern photos of the east-half facade. "
                "1956 ENTWURF gives the party-wall axis between the two "
                "halves."
            ),
            "scopeBoundaryRef": (
                "party_wall_axis:1956_entwurf_grundrisse_schnitt:"
                "vertical_midline_between_halves"
            ),
            "targetHalfDirection": "east",
            "acceptedBy": "iteration-2-finalize",
            "provenance": {
                "sourceDocumentId": "srcdoc-4b1a2c8892b4",
                "page": 14,
                "region": "Exposé current-condition plans of the east half",
            },
        }
    ],
    "house-beta": [
        {
            "decisionId": "beta-whole-building",
            "status": "accepted",
            "targetScopeType": "selected_building",
            "modeledExtent": (
                "Whole detached single-family house at Emattweg, "
                "Rickenbach-Hütten (architect Boss, Bauherr Srichander "
                "Ramaswamy, 2007). Modeled scope includes the main house "
                "and the attached/garage volume per the elevation sheets; "
                "the parcel context is modeled as a context-only site."
            ),
            "evidenceSummary": (
                "Title block on each plan/elevation/section sheet names "
                "the same single building (BEZ 843.50 m üNN, garage at "
                "843.20). Sheets 5-6 show four orthographic facades of "
                "exactly one house. There is no Doppelhaus party-wall "
                "evidence."
            ),
            "acceptedBy": "iteration-2-finalize",
            "provenance": {
                "sourceDocumentId": "srcdoc-e73f05ce8e83",
                "page": 1,
                "region": "Title block — Bauherr Ramaswamy, Emattweg",
            },
        }
    ],
    "house-gamma": [
        {
            "decisionId": "gamma-target-half-praxis",
            "status": "accepted",
            "targetScopeType": "target_half",
            "modeledExtent": (
                "Doppelhaushälfte at Am Kannenofen 45, Siegburg, with the "
                "EG used as a medical practice (Praxis) per the 1993 "
                "Berkemeyer drawing set. Modeling target is the one-half "
                "of the doppelhaus depicted in the cover letter and the "
                "10-sheet plan set; the adjoining half is context only."
            ),
            "evidenceSummary": (
                "Cover letter (Kannenofen.pdf p.10) and individual sheet "
                "title blocks (p.1-9) explicitly state "
                "'Doppelhaushälfte'. Floor plans show only one half-house "
                "footprint; elevations and sections are of that half."
            ),
            "scopeBoundaryRef": (
                "party_wall_axis:kannenofen_1993:half_house_party_wall"
            ),
            "targetHalfDirection": "left",
            "acceptedBy": "iteration-2-finalize",
            "provenance": {
                "sourceDocumentId": "srcdoc-0a178ed8c402",
                "page": 10,
                "region": "Cover letter — 'Doppelhaushälfte'",
            },
        }
    ],
}


def run_house(house: str, output_dir: Path, scope_decisions: list[dict[str, Any]]) -> dict[str, Any]:
    root_path = REPO_ROOT / "testhouses" / house
    if not root_path.exists():
        raise FileNotFoundError(f"Source folder missing: {root_path}")
    result = build_reverse_bim_folder_output(
        root_path=str(root_path),
        output_dir=str(output_dir),
        run_id=f"iter-2-{house}-finalize",
        dpi=240,
        reset_output=False,
        building_scope_decisions=scope_decisions,
    )
    snapshot = {
        "house": house,
        "packageState": result.get("packageState"),
        "summary": result.get("summary"),
        "acceptanceSummary": (result.get("acceptance") or {}).get("summary"),
        "scopeDecisionCount": len(scope_decisions),
    }
    (output_dir / "iter-2-status.json").write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return snapshot


def main() -> None:
    out_root = REPO_ROOT / "tmp" / "reverse-bim"
    snapshots: list[dict[str, Any]] = []
    for house in ("house-alpha", "house-beta", "house-gamma"):
        snapshot = run_house(
            house=house,
            output_dir=out_root / house,
            scope_decisions=SCOPE_DECISIONS_BY_HOUSE[house],
        )
        snapshots.append(snapshot)
        print(f"=== {house} ===")
        print(json.dumps(snapshot, indent=2, ensure_ascii=False))
        print()


if __name__ == "__main__":
    main()
