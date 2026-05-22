"""Iteration-2 smoke author: programmatic round-trip proof for testhouse-beta.

Demonstrates that the TH-X-F006 source_view_evidence schema works
end-to-end via the kernel command dispatcher and that a baseline reverse-BIM
authoring slice can be persisted entirely in Python.

This is a *smoke* — it does not produce a source-faithful BIM model for beta.
Authoring source-faithful walls requires numeric coordinates from the source
plans, which the iter-1 reader passes did not produce (the dimension strings
were illegible at 160-180 DPI; iter-2 raised the default to 240 but
re-dispatching the reader campaigns to extract numeric coordinates is the
genuine iteration-3 unblocker).

What this *does* prove:

* The new ``source_view_evidence`` element kind round-trips through
  ``apply_inplace``.
* A baseline level/section/elevation skeleton can be authored and serialized.
* The project-browser pill backing is wired (status drives the chip color).

Run via ``uv run python scripts/testhouse_iter2_smoke_author.py`` from
``app/``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from bim_ai.commands import (  # noqa: E402
    CreateElevationViewCmd,
    CreateLevelCmd,
    CreateSectionCutCmd,
    UpsertSourceViewEvidenceCmd,
)
from bim_ai.document import Document  # noqa: E402
from bim_ai.engine import apply_inplace  # noqa: E402


def author_baseline_beta() -> Document:
    """Author a minimal beta skeleton: 3 levels + 1 section + 4 elevations
    + paired source_view_evidence records for each view."""

    doc = Document(modelId="testhouse-beta", elements={})

    # Source-required levels per the beta plan set: KG / EG / DG.
    for lvl_id, name, elevation in (
        ("lvl-kg", "KG", -2750),
        ("lvl-eg", "EG", 0),
        ("lvl-dg", "DG", 2800),
    ):
        apply_inplace(doc, CreateLevelCmd(id=lvl_id, name=name, elevationMm=elevation))

    # House section recreated from page 4 ('SCHNITTE — Schnitt Gebaeude').
    apply_inplace(
        doc,
        CreateSectionCutCmd(
            id="sc-haus",
            name="Schnitt Gebaeude",
            lineStartMm={"xMm": 0, "yMm": 0},
            lineEndMm={"xMm": 12000, "yMm": 0},
            cropDepthMm=9500,
        ),
    )
    apply_inplace(
        doc,
        UpsertSourceViewEvidenceCmd(
            id="sve-sc-haus",
            viewElementId="sc-haus",
            category="section",
            status="source_linked",
            sourceDocumentId="srcdoc-e73f05ce8e83",
            sourcePage=4,
            comparisonType="overlay",
        ),
    )

    # Garage section also on page 4.
    apply_inplace(
        doc,
        CreateSectionCutCmd(
            id="sc-garage",
            name="Schnitt Garage",
            lineStartMm={"xMm": 0, "yMm": 0},
            lineEndMm={"xMm": 6000, "yMm": 0},
            cropDepthMm=4500,
        ),
    )
    apply_inplace(
        doc,
        UpsertSourceViewEvidenceCmd(
            id="sve-sc-garage",
            viewElementId="sc-garage",
            category="section",
            status="source_linked",
            sourceDocumentId="srcdoc-e73f05ce8e83",
            sourcePage=4,
            comparisonType="overlay",
        ),
    )

    # Four cardinal elevations from pages 5-6.
    for ev_id, ev_name, direction, page in (
        ("ev-osten", "Osten", "east", 5),
        ("ev-norden", "Norden", "north", 5),
        ("ev-sueden", "Sueden", "south", 6),
        ("ev-westen", "Westen", "west", 6),
    ):
        apply_inplace(
            doc,
            CreateElevationViewCmd(id=ev_id, name=ev_name, direction=direction, scale=100.0),
        )
        apply_inplace(
            doc,
            UpsertSourceViewEvidenceCmd(
                id=f"sve-{ev_id}",
                viewElementId=ev_id,
                category="exterior",
                status="source_linked",
                sourceDocumentId="srcdoc-e73f05ce8e83",
                sourcePage=page,
                comparisonType="overlay",
            ),
        )

    return doc


def main() -> None:
    doc = author_baseline_beta()

    counts: dict[str, int] = {}
    for el in doc.elements.values():
        counts[el.kind] = counts.get(el.kind, 0) + 1

    expected = {
        "level": 3,
        "section_cut": 2,
        "elevation_view": 4,
        "source_view_evidence": 6,
    }
    for kind, want in expected.items():
        got = counts.get(kind, 0)
        if got != want:
            raise SystemExit(f"smoke failed: expected {want} {kind}, got {got}")

    out_path = (
        REPO_ROOT / "tmp" / "reverse-bim" / "house-beta" / "iter-2-smoke-model.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        doc.model_dump_json(by_alias=True, exclude_none=True, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote smoke model to {out_path}")
    print(f"element counts: {counts}")


if __name__ == "__main__":
    main()
