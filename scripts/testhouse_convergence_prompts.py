"""Subagent prompt registry for the testhouse convergence loop.

The convergence pass script (``testhouse_convergence_pass.py``) emits
``pendingSubagentDispatches`` rows. The LLM orchestrator copies each row's
``args`` through ``prompt_for(args)`` here to get the exact prompt text to
pass to the ``Agent`` tool.

Keeping the prompts in one module means the convergence loop is
reproducible across context boundaries: every retry uses the same
canonical prompt unless ``retry`` is set, in which case the prompt
tightens to address the prior failure mode.

CLI usage (for the orchestrator to invoke from Bash):

    uv run python scripts/testhouse_convergence_prompts.py \\
        --action numeric_reader_for_level \\
        --house house-gamma \\
        --level KG \\
        --retry 1
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]

HOUSE_SOURCE: dict[str, dict[str, Any]] = {
    "house-alpha": {
        "primarySourceDocumentId": "srcdoc-22993cc5012b",  # EG.pdf
        "sourceDocs": {
            "EG": ("srcdoc-22993cc5012b", "EG.pdf"),
            "DG": ("srcdoc-74bc75065121", "DG.pdf"),
            "KG": ("srcdoc-4b1a2c8892b4", "535_06 KH Exposé.pdf (pages 14-16)"),
        },
        "rendered_page_path_glob": (
            "tmp/reverse-bim/house-alpha/source/rendered-pages/<docId>/*.png"
        ),
        "scale": "1:100",
        "context": (
            "Alpha is the present east half of a 1956 Reinecke Doppelhaus at "
            "Weidenstraße 4, Schalksmühle. Scope decision: target_half east. "
            "The 1956 plan set (EG.pdf, DG.pdf) carries dimensioned plans for "
            "EG and DG; the KG plan exists only in the modern Exposé (pages "
            "14-16) and is **not dimensioned** in the 1956 set — KG is the "
            "most likely source_unavailable fallback."
        ),
    },
    "house-beta": {
        "primarySourceDocumentId": "srcdoc-e73f05ce8e83",
        "sourceDocs": {
            "KG": (
                "srcdoc-e73f05ce8e83",
                "Grundrisse, Ansichten, Schnitt (1).pdf p.1",
            ),
            "EG": (
                "srcdoc-e73f05ce8e83",
                "Grundrisse, Ansichten, Schnitt (1).pdf p.2",
            ),
            "DG": (
                "srcdoc-e73f05ce8e83",
                "Grundrisse, Ansichten, Schnitt (1).pdf p.3",
            ),
        },
        "rendered_page_path_glob": (
            "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83/*.png"
        ),
        "scale": "1:100",
        "context": (
            "Beta is a 2007 detached single-family house at Emattweg, "
            "Rickenbach-Hütten (architect Boss). Scope: selected_building. "
            "The iter-1 r2 reader produced numeric Vec2Mm wall_chains for EG "
            "(9864 × 8984 mm rectangular footprint at thickness 317 mm) and "
            "DG (9884 × 8984 mm) — those land in the authored model. KG "
            "still needs a numeric wall_chain."
        ),
    },
    "house-gamma": {
        "primarySourceDocumentId": "srcdoc-0a178ed8c402",
        "sourceDocs": {
            "KG": ("srcdoc-0a178ed8c402", "Kannenofen.pdf p.1"),
            "EG": ("srcdoc-0a178ed8c402", "Kannenofen.pdf p.2"),
            "OG": ("srcdoc-0a178ed8c402", "Kannenofen.pdf p.3"),
            "DG": ("srcdoc-0a178ed8c402", "Kannenofen.pdf p.4"),
            "Spitzboden": ("srcdoc-0a178ed8c402", "Kannenofen.pdf p.5"),
        },
        "rendered_page_path_glob": (
            "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402/*.png"
        ),
        "scale": "1:50",
        "context": (
            "Gamma is a 1993 Doppelhaushälfte + Praxis at Am Kannenofen 45, "
            "Siegburg. Scope: target_half left. 5 storeys (KG / EG / OG / DG "
            "/ Spitzboden). The iter-1 rescue reader returned only "
            "descriptive prose for wall_chains. Iter-3 numeric reader must "
            "produce actual Vec2Mm coordinates."
        ),
    },
}


# ---------------------------------------------------------------------------
# Per-action prompt builders
# ---------------------------------------------------------------------------


def _response_path(house: str, dispatch_id: str) -> Path:
    return (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house
        / "ai-reading"
        / "responses"
        / "reader-pass-iter3"
        / f"{dispatch_id}.json"
    )


def _retry_preamble(retry: int, action: str) -> str:
    if retry <= 1:
        return ""
    return (
        f"**RETRY {retry} of 2.** A prior dispatch of this `{action}` action "
        "either failed to write the response file or produced output that "
        "did not include the required numeric coordinate fields. This pass "
        "must succeed. If the source genuinely does not contain the "
        "required information at a legible resolution, emit a single fact "
        "with `value: {{\"status\": \"source_unavailable\", \"reason\": "
        "\"<why>\"}}` and confidence 0 rather than fabricating coordinates.\n\n"
    )


def numeric_reader_for_level(args: dict[str, Any]) -> str:
    house = args["house"]
    level = args["level"]
    retry = int(args.get("retry") or 1)
    dispatch_id = f"{house}-num-{level.lower()}-pass-{retry:02d}"
    house_meta = HOUSE_SOURCE[house]
    doc_id, doc_label = house_meta["sourceDocs"][level]
    rendered_dir = (
        REPO_ROOT
        / "tmp"
        / "reverse-bim"
        / house
        / "source"
        / "rendered-pages"
        / doc_id
    )
    response_path = _response_path(house, dispatch_id)

    return f"""You are a numeric-coordinate floor-plan reader for reverse-BIM testhouse `{house}`, level `{level}`.

{_retry_preamble(retry, "numeric_reader_for_level")}**Source page**: {doc_label} (sourceDocumentId `{doc_id}`).
Rendered PNGs live under `{rendered_dir}/` — read every PNG in that
directory with the Read tool (it displays the image). The page set is
already filtered to the relevant storey.

**Context**: {house_meta['context']}

**Your job**: extract these source-fact rows in **numeric** form:

1. **Level fact** — `kind: "level"`, with `value.elevationMm` as a real
   number relative to EG=0. KG is negative; OG / DG / Spitzboden are
   positive.
2. **Exterior wall_chain** — `kind: "wall_chain"`, with
   `value.points: [{{xMm: <number>, yMm: <number>}}, ...]` describing
   the perimeter polygon. **No prose in `points`.** Use the dimension
   chain printed on the plan; if dimensions are illegible, fall back to
   the printed scale ({house_meta['scale']}) and the rendered-page
   pixel size, and state the derivation in `note`. The polygon should
   be closed (first point repeated as last) or have `closed: true`.
3. **Interior wall_chains** — same shape, one per readable partition
   cluster. `wallRole: "interior_partition"`. Only emit when partition
   lines are unambiguous; skip noisy ones.
4. **Wall thickness** — `value.thicknessMm` in mm. Era-typical defaults:
   exterior 300-365, party 240, partitions 100-115. Prefer the printed
   value; fall back to defaults and state in `note`.

**Output**: write JSON to:

    {response_path}

with this shape:

```json
{{
  "format": "sourceAiVisualTraceReaderResponse_v1",
  "readerPassId": "reader-pass-iter3",
  "requestId": "{dispatch_id}",
  "workPackageId": "wp-dimensional-floorplans",
  "additionalWorkPackageIds": [],
  "readerNotes": "<one-paragraph summary of evidence quality>",
  "facts": [
    {{
      "factId": "{house}-r3-level-{level.lower()}",
      "kind": "level",
      "value": {{"name": "{level}", "elevationMm": <number>, "note": "<derivation>"}},
      "confidence": <0..1>,
      "provenance": {{"sourceDocumentId": "{doc_id}", "page": <1-based>, "region": "<where on the page>", "method": "ai_document_read"}}
    }},
    {{
      "factId": "{house}-r3-wallchain-{level.lower()}-ext",
      "kind": "wall_chain",
      "value": {{
        "levelId": "{level}",
        "points": [{{"xMm": 0, "yMm": 0}}, {{"xMm": <number>, "yMm": 0}}, {{"xMm": <number>, "yMm": <number>}}, {{"xMm": 0, "yMm": <number>}}],
        "thicknessMm": <number>,
        "wallRole": "exterior_loadbearing",
        "closed": true,
        "note": "<derivation>"
      }},
      "confidence": <0..1>,
      "provenance": {{"sourceDocumentId": "{doc_id}", "page": <1-based>, "region": "perimeter dimension chain", "method": "ai_document_read"}}
    }}
  ]
}}
```

**Hard constraints**:

* `points` must be a list of numeric `{{xMm, yMm}}` objects. No prose.
* If you cannot extract a numeric exterior perimeter (heavy scan noise,
  no scale-bar, no dimensions), emit a single fact with
  `value: {{"status": "source_unavailable", "reason": "<why>"}}` and
  `confidence: 0` instead of fabricating.
* Use the level name exactly: `{level}`.

After writing the file, print a one-line summary: how many facts you
extracted and whether you hit any source-unavailable cases.
"""


def room_opening_reader(args: dict[str, Any]) -> str:
    house = args["house"]
    retry = int(args.get("retry") or 1)
    dispatch_id = f"{house}-rooms-pass-{retry:02d}"
    house_meta = HOUSE_SOURCE[house]
    response_path = _response_path(house, dispatch_id)
    return f"""You are a room-and-opening reader for reverse-BIM testhouse `{house}`.

{_retry_preamble(retry, "room_opening_reader")}**Goal**: extract numeric room outlines and door/window opening positions
from the dimensioned floor-plan pages so the model can build a
`physical_topology` that passes the methodology's room-access-graph
check.

**Source pages** are under
`tmp/reverse-bim/{house}/source/rendered-pages/*/<plan PNGs>`. Read each
page that contains a plan. Skip elevation / section / detail pages.

**Context**: {house_meta['context']}

**Output**: write JSON to:

    {response_path}

with `kind: "room"`, `kind: "opening"` (subtype `door` or `window`),
and `kind: "wall_opening"` facts. Each room fact must have a numeric
`value.boundaryPointsMm: [{{xMm, yMm}}, ...]` polygon and an
`areaM2` measured from the plan. Each opening fact must have a numeric
`value.position: {{xMm, yMm}}` and `value.widthMm` / `value.heightMm` /
`value.sillHeightMm` from the dimension marks.

Follow the same shape and constraints as the `numeric_reader_for_level`
output — same envelope (`format`, `readerPassId`, `workPackageId`,
`facts`).  workPackageId should be `wp-dimensional-floorplans` with
`additionalWorkPackageIds: ["wp-current-condition"]`.

If a page is genuinely unreadable, emit a single `kind: "conflict"`
fact with `value.status: "source_unavailable"` and a clear reason. Do
not invent rooms or openings that aren't on the page.

Print a one-line summary after writing the file.
"""


def area_schedule_reader(args: dict[str, Any]) -> str:
    house = args["house"]
    retry = int(args.get("retry") or 1)
    dispatch_id = f"{house}-area-pass-{retry:02d}"
    house_meta = HOUSE_SOURCE[house]
    response_path = _response_path(house, dispatch_id)
    return f"""You are an area / volume / schedule reader for reverse-BIM testhouse `{house}`.

{_retry_preamble(retry, "area_schedule_reader")}**Goal**: extract authoritative per-room area values, per-storey net /
gross areas, and any built-volume / umbauter-Raum totals from area-
calculation source documents so the model's `qa.area_reconciliation`
gate can accept.

**Source documents** (in order of likely relevance):

* Alpha — `Wohnflächenberechnung.pdf` (`srcdoc-9bddba669f7c`),
  `Umbauter Raum.pdf` (`srcdoc-2b0f1f48d605`).
* Beta — no dedicated Wohnflächen schedule in the source folder. If
  there is none, emit a single `source_unavailable` disposition fact.
* Gamma — no dedicated schedule in the source folder. Same fallback.

If the house has no area-schedule source document, **return one fact
with** `kind: "area"`, `value.status: "source_unavailable"`,
`value.reason: "no area_calculation document in source folder"`,
`confidence: 0` so the gate can disposition cleanly.

If a schedule exists, walk every rendered page of the schedule PDF.
For each row in the area table emit one fact:

```json
{{
  "factId": "{house}-r3-area-<room-slug>",
  "kind": "area",
  "value": {{
    "scope": "room",
    "levelId": "<KG|EG|DG|OG|Spitzboden>",
    "name": "<room name>",
    "areaM2": <number>,
    "formula": "<the printed formula or 'unknown'>"
  }},
  "confidence": <0..1>,
  "provenance": {{"sourceDocumentId": "<srcdoc-id>", "page": <int>, "region": "<table row reference>", "method": "ai_document_read"}}
}}
```

**Output path**: `{response_path}`. Same envelope as the other readers
(`format`, `readerPassId: "reader-pass-iter3"`, `workPackageId:
"wp-area-volume-schedules"`).

Print a one-line summary after writing the file.
"""


PROMPT_BUILDERS = {
    "numeric_reader_for_level": numeric_reader_for_level,
    "room_opening_reader": room_opening_reader,
    "area_schedule_reader": area_schedule_reader,
}


def prompt_for(args: dict[str, Any]) -> str:
    """Resolve a pendingSubagentDispatches row to its prompt text."""
    action = args.get("action") or args.get("promptKey")
    if action not in PROMPT_BUILDERS:
        raise ValueError(f"Unknown convergence action: {action}")
    return PROMPT_BUILDERS[action](args)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--action", choices=sorted(PROMPT_BUILDERS.keys()))
    parser.add_argument("--house")
    parser.add_argument("--level")
    parser.add_argument("--retry", type=int, default=1)
    parser.add_argument(
        "--from-state",
        help="If passed, prints the prompts for every pendingSubagentDispatches "
        "row across all houses in convergence-state.json. Ignores other args.",
        nargs="?",
        const="tmp/reverse-bim/convergence-state.json",
    )
    args = parser.parse_args()
    if args.from_state is None and (not args.action or not args.house):
        parser.error("either --from-state or both --action and --house are required")

    if args.from_state:
        state = json.loads(Path(args.from_state).read_text(encoding="utf-8"))
        out: list[dict[str, Any]] = []
        for house_state in state["houses"].values():
            for dispatch in house_state.get("pendingSubagentDispatches", []):
                out.append(
                    {
                        "id": dispatch["id"],
                        "action": dispatch["action"],
                        "house": dispatch["args"]["house"],
                        "prompt": prompt_for(
                            {**dispatch["args"], "action": dispatch["action"]}
                        ),
                    }
                )
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    request = {
        "action": args.action,
        "house": args.house,
        "level": args.level,
        "retry": args.retry,
    }
    print(prompt_for(request))


if __name__ == "__main__":
    main()
