"""Iteration-2 source-faithful authoring for all three testhouses.

Walks ``tmp/reverse-bim/house-<name>/understanding/source-fact-ledger.json``
for each house, emits the corresponding kernel commands, applies them via
``apply_inplace``, and serializes the resulting Document plus a per-house
authoring summary.

Authors what the ledger can support today:
* `level` — fixed canonical levels per house with the consensus elevation.
* `wall_chain` with numeric Vec2Mm points → ``CreateWallChainCmd`` with
  contiguous ``WallChainSegment`` list.
* `section_cut` / `elevation_view` placeholders for the source-derived
  views named in each house's iter-1 findings, each paired with an
  ``UpsertSourceViewEvidenceCmd`` (status=source_linked) so the
  project-browser pill lights up.

Facts whose value is descriptive prose are recorded under
``deferredFacts`` so iter-3 can target them with a numeric reader pass.
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

from bim_ai.commands import (  # noqa: E402
    CreateElevationViewCmd,
    CreateLevelCmd,
    CreateSectionCutCmd,
    CreateWallChainCmd,
    UpsertSourceViewEvidenceCmd,
)
from bim_ai.document import Document  # noqa: E402
from bim_ai.engine import apply_inplace  # noqa: E402

LEVEL_ID_MAP = {
    "KG": "lvl-kg",
    "EG": "lvl-eg",
    "OG": "lvl-og",
    "DG": "lvl-dg",
    "Spitzboden": "lvl-spitz",
    "kg": "lvl-kg",
    "eg": "lvl-eg",
    "og": "lvl-og",
    "dg": "lvl-dg",
    "Untergeschoss": "lvl-kg",
    "Erdgeschoss": "lvl-eg",
    "Obergeschoss": "lvl-og",
    "Dachgeschoss": "lvl-dg",
    # Alpha and other readers use namespaced ids.
    "alpha-level-kg": "lvl-kg",
    "alpha-level-eg": "lvl-eg",
    "alpha-level-og": "lvl-og",
    "alpha-level-dg": "lvl-dg",
    "gamma-level-kg": "lvl-kg",
    "gamma-level-eg": "lvl-eg",
    "gamma-level-og": "lvl-og",
    "gamma-level-dg": "lvl-dg",
    "gamma-level-spitz": "lvl-spitz",
}

HOUSE_CONFIG: dict[str, dict[str, Any]] = {
    "house-alpha": {
        "modelId": "testhouse-alpha",
        "sourceDocumentId": "srcdoc-ansichten-alpha",
        "levels": [
            ("lvl-kg", "KG", -2750.0),
            ("lvl-eg", "EG", 0.0),
            ("lvl-dg", "DG", 2750.0),
        ],
        "sections": [
            {"id": "sc-haus", "name": "Schnitt durch Wohnhaus", "page": 1, "sourceDocId": "srcdoc-grundrisse-schnitt"},
        ],
        "elevations": [
            {"id": "ev-berg", "name": "Berg-Ansicht", "direction": "custom", "page": 1, "sourceDocId": "srcdoc-ansichten"},
            {"id": "ev-linke-giebel", "name": "Linke Giebelansicht", "direction": "custom", "page": 1, "sourceDocId": "srcdoc-ansichten"},
            {"id": "ev-tal", "name": "Tal-Ansicht", "direction": "custom", "page": 1, "sourceDocId": "srcdoc-ansichten"},
            {"id": "ev-rechte-giebel", "name": "Rechte Giebelansicht", "direction": "custom", "page": 1, "sourceDocId": "srcdoc-ansichten"},
        ],
        "primarySourceDocId": "srcdoc-ansichten",
    },
    "house-beta": {
        "modelId": "testhouse-beta",
        "sourceDocumentId": "srcdoc-e73f05ce8e83",
        "levels": [
            ("lvl-kg", "KG", -2750.0),
            ("lvl-eg", "EG", 0.0),
            ("lvl-dg", "DG", 2750.0),
        ],
        "sections": [
            {"id": "sc-haus", "name": "Schnitt Gebaeude", "page": 4, "sourceDocId": "srcdoc-e73f05ce8e83"},
            {"id": "sc-garage", "name": "Schnitt Garage", "page": 4, "sourceDocId": "srcdoc-e73f05ce8e83"},
        ],
        "elevations": [
            {"id": "ev-osten", "name": "Osten", "direction": "east", "page": 5, "sourceDocId": "srcdoc-e73f05ce8e83"},
            {"id": "ev-norden", "name": "Norden", "direction": "north", "page": 5, "sourceDocId": "srcdoc-e73f05ce8e83"},
            {"id": "ev-sueden", "name": "Sueden", "direction": "south", "page": 6, "sourceDocId": "srcdoc-e73f05ce8e83"},
            {"id": "ev-westen", "name": "Westen", "direction": "west", "page": 6, "sourceDocId": "srcdoc-e73f05ce8e83"},
        ],
        "primarySourceDocId": "srcdoc-e73f05ce8e83",
    },
    "house-gamma": {
        "modelId": "testhouse-gamma",
        "sourceDocumentId": "srcdoc-0a178ed8c402",
        "levels": [
            ("lvl-kg", "KG", -2800.0),
            ("lvl-eg", "EG", 0.0),
            ("lvl-og", "OG", 2800.0),
            ("lvl-dg", "DG", 5600.0),
            ("lvl-spitz", "Spitzboden", 8400.0),
        ],
        "sections": [
            {"id": "sc-aa", "name": "Schnitt A-A", "page": 9, "sourceDocId": "srcdoc-0a178ed8c402"},
            {"id": "sc-bb", "name": "Schnitt B-B", "page": 9, "sourceDocId": "srcdoc-0a178ed8c402"},
        ],
        "elevations": [
            {"id": "ev-strasse", "name": "Strassenansicht", "direction": "custom", "page": 6, "sourceDocId": "srcdoc-0a178ed8c402"},
            {"id": "ev-eingang", "name": "Eingangsansicht", "direction": "custom", "page": 7, "sourceDocId": "srcdoc-0a178ed8c402"},
            {"id": "ev-garten", "name": "Gartenansicht", "direction": "custom", "page": 8, "sourceDocId": "srcdoc-0a178ed8c402"},
        ],
        "primarySourceDocId": "srcdoc-0a178ed8c402",
    },
}


def _is_numeric_points(value: Any) -> bool:
    return (
        isinstance(value, list)
        and value
        and all(isinstance(p, dict) and ("xMm" in p or "x_mm" in p) for p in value)
    )


def _normalize_points(points: list[dict[str, Any]]) -> list[dict[str, float]]:
    out: list[dict[str, float]] = []
    for p in points:
        x = p.get("xMm")
        if x is None:
            x = p.get("x_mm")
        y = p.get("yMm")
        if y is None:
            y = p.get("y_mm")
        if x is None or y is None:
            continue
        out.append({"xMm": float(x), "yMm": float(y)})
    return out


def author_house(house: str) -> tuple[Document, dict[str, Any]]:
    cfg = HOUSE_CONFIG[house]
    house_root = REPO_ROOT / "tmp" / "reverse-bim" / house
    ledger_path = house_root / "understanding" / "source-fact-ledger.json"
    facts = (
        json.loads(ledger_path.read_text(encoding="utf-8")).get("facts") or []
        if ledger_path.exists()
        else []
    )

    doc = Document(elements={})
    authored: list[dict[str, Any]] = []
    deferred: list[dict[str, Any]] = []

    # Levels.
    for lvl_id, name, elevation in cfg["levels"]:
        apply_inplace(
            doc,
            CreateLevelCmd(
                id=lvl_id,
                name=name,
                elevationMm=elevation,
                alsoCreatePlanView=True,
            ),
        )
        authored.append({"kind": "level", "id": lvl_id})

    # Wall chains with numeric points.
    chain_counter = 0
    for fact in facts:
        if fact.get("kind") != "wall_chain":
            continue
        value = fact.get("value") or {}
        points = value.get("points") or value.get("boundaryPointsMm") or value.get("boundaryMm")
        if not _is_numeric_points(points):
            deferred.append(
                {
                    "factId": fact.get("factId"),
                    "kind": "wall_chain",
                    "reason": "descriptive_points_not_numeric",
                }
            )
            continue
        canonical_level = LEVEL_ID_MAP.get(str(value.get("levelId")))
        if not canonical_level or canonical_level not in {lvl_id for lvl_id, _, _ in cfg["levels"]}:
            deferred.append(
                {
                    "factId": fact.get("factId"),
                    "kind": "wall_chain",
                    "reason": f"unknown_levelId:{value.get('levelId')}",
                }
            )
            continue
        normalized = _normalize_points(points)
        if len(normalized) < 3:
            deferred.append(
                {
                    "factId": fact.get("factId"),
                    "kind": "wall_chain",
                    "reason": "less_than_three_points",
                }
            )
            continue
        chain_counter += 1
        chain_id = f"wc-{canonical_level}-{chain_counter:02d}"
        thickness_mm = float(value.get("thicknessMm") or 365)
        segments: list[dict[str, Any]] = []
        seq = list(normalized)
        if value.get("closed", True) and seq[0] != seq[-1]:
            seq.append(seq[0])
        for i in range(len(seq) - 1):
            segments.append(
                {
                    "start": seq[i],
                    "end": seq[i + 1],
                    "thicknessMm": thickness_mm,
                    "heightMm": 2800.0,
                }
            )
        try:
            apply_inplace(
                doc,
                CreateWallChainCmd(
                    levelId=canonical_level,
                    namePrefix=chain_id,
                    segments=segments,
                ),
            )
            authored.append(
                {
                    "kind": "wall_chain",
                    "namePrefix": chain_id,
                    "factSource": fact.get("factId"),
                    "pointCount": len(normalized),
                    "thicknessMm": thickness_mm,
                }
            )
        except Exception as exc:  # pragma: no cover - defensive
            deferred.append(
                {
                    "factId": fact.get("factId"),
                    "kind": "wall_chain",
                    "reason": f"apply_failed:{exc}",
                }
            )

    # Sections.
    for view in cfg["sections"]:
        apply_inplace(
            doc,
            CreateSectionCutCmd(
                id=view["id"],
                name=view["name"],
                lineStartMm={"xMm": 0, "yMm": 4500},
                lineEndMm={"xMm": 10000, "yMm": 4500},
                cropDepthMm=9500,
            ),
        )
        apply_inplace(
            doc,
            UpsertSourceViewEvidenceCmd(
                id=f"sve-{view['id']}",
                viewElementId=view["id"],
                category="section",
                status="source_linked",
                sourceDocumentId=view.get("sourceDocId", cfg["primarySourceDocId"]),
                sourcePage=view["page"],
                comparisonType="overlay",
            ),
        )
        authored.append({"kind": "section_cut", "id": view["id"]})

    # Elevations.
    for ev in cfg["elevations"]:
        apply_inplace(
            doc,
            CreateElevationViewCmd(
                id=ev["id"],
                name=ev["name"],
                direction=ev["direction"],
                customAngleDeg=0.0 if ev["direction"] == "custom" else None,
                scale=100.0,
            ),
        )
        apply_inplace(
            doc,
            UpsertSourceViewEvidenceCmd(
                id=f"sve-{ev['id']}",
                viewElementId=ev["id"],
                category="exterior",
                status="source_linked",
                sourceDocumentId=ev.get("sourceDocId", cfg["primarySourceDocId"]),
                sourcePage=ev["page"],
                comparisonType="overlay",
            ),
        )
        authored.append({"kind": "elevation_view", "id": ev["id"]})

    counts: dict[str, int] = {}
    for el in doc.elements.values():
        counts[el.kind] = counts.get(el.kind, 0) + 1

    return doc, {
        "format": "testhouseIter2AuthoringReport_v1",
        "house": house,
        "elementCounts": counts,
        "authoredCount": len(authored),
        "deferredCount": len(deferred),
        "authored": authored,
        "deferred": deferred,
    }


def main() -> None:
    summaries: list[dict[str, Any]] = []
    for house in ("house-alpha", "house-beta", "house-gamma"):
        doc, report = author_house(house)
        house_root = REPO_ROOT / "tmp" / "reverse-bim" / house
        (house_root / "iter-2-authored-model.json").write_text(
            doc.model_dump_json(by_alias=True, exclude_none=True, indent=2) + "\n",
            encoding="utf-8",
        )
        (house_root / "iter-2-authoring-report.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        summary = {
            "house": house,
            "elementCounts": report["elementCounts"],
            "authoredCount": report["authoredCount"],
            "deferredCount": report["deferredCount"],
        }
        summaries.append(summary)
        print(f"=== {house} ===")
        print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
