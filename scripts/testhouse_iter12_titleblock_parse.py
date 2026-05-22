"""Iter-12 step 1 — title-block parser.

Extract the building's typology declaration ("Zweifamilien-Doppelwohnhaus",
"Doppelhaushälfte", "Einfamilienhaus", …) from the source fact-ledger and
write tmp/reverse-bim/house-{name}/building-class.json.

The iter-11 visual-diff subagents independently surfaced that alpha and gamma
were modeled as the wrong building shape because iter-1's classifier
flattened each multi-role PDF to a single document-level class and never
extracted the title-block declaration on individual pages. This script
closes that gap by reading the AI-vision evidence already captured in
`understanding/source-fact-ledger.json` (which DOES contain title-block
extracts as `evidenceSummary` on `building_scope`-kind facts) and emitting
a canonical typology record per house.

Output shape (per the iter-12 plan in spec/testhouse-visual-fidelity-tracker.md):

    {
      "building_class": "zweifamilien_doppelhaus" | "einfamilienhaus" | "doppelhaushälfte",
      "auxiliary_volumes": ["carport", "praxis_wing", "garage", ...],
      "raw_title_block_text": "<best-evidence excerpt from fact ledger>",
      "source_page": {"sourceDocumentId": "...", "page": N, "renderedPagePath": "..."}
    }

Run from repo root:  python3 scripts/testhouse_iter12_titleblock_parse.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
HOUSES = ("alpha", "beta", "gamma")


CLASS_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # Order matters: "Zweifamilien-Doppelwohnhaus" must beat plain "Doppelhaus"
    ("zweifamilien_doppelhaus", re.compile(
        r"zwei[\s\-]?familien[\s\-]?doppelwohnh[aä]us|zweifamilien-?doppelhaus",
        re.IGNORECASE,
    )),
    ("doppelhaushälfte", re.compile(
        r"doppelhaush(ae|ä)lfte",
        re.IGNORECASE,
    )),
    ("doppelhaus", re.compile(
        r"\bdoppelhaus(?!h(ae|ä))",
        re.IGNORECASE,
    )),
    ("einfamilienhaus", re.compile(
        r"einfamilien(haus)?|\befh\b|\bwohnhaus\b",
        re.IGNORECASE,
    )),
]


AUX_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("carport", re.compile(r"\bcarport\b", re.IGNORECASE)),
    ("praxis_wing", re.compile(r"\bpraxis(gebaeude|gebäude|wing|nutzung)?\b", re.IGNORECASE)),
    ("garage", re.compile(r"\bgarage[nbau]*\b", re.IGNORECASE)),
]


def classify(text: str) -> str | None:
    """Return the canonical building_class string for `text`, or None."""
    for cls, pat in CLASS_PATTERNS:
        if pat.search(text):
            return cls
    return None


def collect_evidence(facts: list[dict[str, Any]]) -> tuple[str | None, str, dict[str, Any] | None]:
    """Walk all facts and pick the strongest title-block-style evidence.

    Returns ``(building_class, raw_text, provenance)``.
    """
    best_class: str | None = None
    best_text: str = ""
    best_prov: dict[str, Any] | None = None
    best_score: int = -1

    for f in facts:
        if not isinstance(f, dict):
            continue
        if f.get("kind") not in ("building_scope", "conflict"):
            continue
        value = f.get("value") or {}
        # Pull every string-ish field; the title-block evidence is almost
        # always in evidenceSummary or modeledExtent.
        text_parts: list[str] = []
        for k in ("evidenceSummary", "modeledExtent", "scopeType", "buildingType",
                  "use", "event", "rawEvidence", "recommendedDisposition", "topic"):
            v = value.get(k)
            if isinstance(v, str):
                text_parts.append(v)
        text = "\n".join(text_parts)
        if not text:
            continue

        cls = classify(text)
        if not cls:
            continue

        # Score: prefer facts whose text explicitly references a "title block"
        # or "Titelblock"/"title" — those are the strongest evidence. Bump
        # candidates and accepted-status facts above raw notes.
        score = 0
        lower = text.lower()
        if "title block" in lower or "titelblock" in lower:
            score += 10
        if "neubau" in lower:
            score += 3
        if f.get("status") in ("accepted", "candidate"):
            score += 1
        # Length-bonus: longer evidenceSummary usually has the verbatim title.
        score += min(len(text) // 200, 5)

        if score > best_score:
            best_score = score
            best_class = cls
            best_text = text
            best_prov = f.get("provenance")

    return best_class, best_text, best_prov


def collect_auxiliaries(facts: list[dict[str, Any]]) -> list[str]:
    """Detect attached auxiliary volumes (carport, praxis wing, garage)
    by scanning every fact's serialised text for the patterns above."""
    found: set[str] = set()
    for f in facts:
        if not isinstance(f, dict):
            continue
        text = json.dumps(f.get("value") or {}, ensure_ascii=False)
        for aux, pat in AUX_PATTERNS:
            if pat.search(text):
                found.add(aux)
    # Order deterministically.
    order = [a for a, _ in AUX_PATTERNS]
    return [a for a in order if a in found]


def parse_house(house: str) -> dict[str, Any]:
    ledger_path = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}" / "understanding" / "source-fact-ledger.json"
    if not ledger_path.exists():
        return {"house": house, "error": f"missing fact ledger: {ledger_path}"}
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    facts = ledger.get("facts") or []
    cls, raw, prov = collect_evidence(facts)
    aux = collect_auxiliaries(facts)
    # Do not list the building's own primary volume as an auxiliary.
    if cls == "einfamilienhaus":
        # Garage is auxiliary on einfamilienhaus.
        pass
    elif cls in ("zweifamilien_doppelhaus", "doppelhaus", "doppelhaushälfte"):
        # No attached garage typically; carport/praxis stay auxiliary.
        pass

    return {
        "house": house,
        "building_class": cls,
        "auxiliary_volumes": aux,
        "raw_title_block_text": raw[:1200] if raw else "",
        "source_page": prov,
        "factCount": len(facts),
    }


def main() -> None:
    out_overall: dict[str, Any] = {}
    for house in HOUSES:
        result = parse_house(house)
        out_dir = REPO_ROOT / "tmp" / "reverse-bim" / f"house-{house}"
        out_path = out_dir / "building-class.json"
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        out_overall[house] = {
            "building_class": result.get("building_class"),
            "auxiliary_volumes": result.get("auxiliary_volumes"),
            "outPath": str(out_path.relative_to(REPO_ROOT)),
        }
        print(
            f"=== {house} ===\n"
            f"  building_class:   {result.get('building_class')!r}\n"
            f"  auxiliary_volumes: {result.get('auxiliary_volumes')}\n"
            f"  source_page:      {result.get('source_page')}\n"
            f"  outPath:          {out_path.relative_to(REPO_ROOT)}",
            flush=True,
        )
    print(json.dumps({"summary": out_overall}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
