"""Iter-5 quality-loop driver for the canonical testhouse models.

After the iter-5 canonical rebuild authored coherent walls + floors +
roof + plan views per house, this script drives the methodology's
quality loop: audit the live model for missing detail, dispatch
focused subagents (via prompts the orchestrator copies into Agent()),
ingest responses, apply them in the canonical building frame, and
loop until every house has dense, source-faithful interior content.

What "dense" means per quality dimension:

  rooms              — every plan-bearing level has ≥1 room outline
  openings           — every plan-bearing level has ≥1 window per facade
  interior walls     — every level has at least one interior partition
  stairs             — every house has ≥1 stair connecting EG↔upper
  doors              — every level has ≥1 door

The driver is **idempotent** and persists state under
``tmp/reverse-bim/iter-5-quality-state.json`` so it can be resumed
across orchestrator context boundaries.

Canonical frames per house (from
``scripts/testhouse_iter5_canonical_rebuild.py``):

  alpha — east-half only, origin SW of east half, x∈[0, 9935], y∈[0, 8100]
  beta  — origin SW of EG, x∈[0, 9864], y∈[0, 8984]
  gamma — origin SW, x∈[0, 18000], y∈[0, 8000] with SE chamfer at
          (17045, 8000)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib import error, request

REPO_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

API_BASE = "http://localhost:28500"
STATE_PATH = REPO_ROOT / "tmp" / "reverse-bim" / "iter-5-quality-state.json"


HOUSE_CANONICAL: dict[str, dict[str, Any]] = {
    "house-alpha": {
        "extentMm": [9935, 8100],
        "scopeDescription": (
            "East half of the 1956 Reinecke Doppelhaus. Origin is the SW "
            "corner of the east half. Party wall sits at x=0 (west edge); "
            "east outer wall at x=9935; south facade at y=0; north facade "
            "at y=8100. ALL coordinates you emit must use this frame."
        ),
        "planBearingLevels": ["EG", "DG"],
        "primarySourceDocIdByLevel": {
            "EG": "srcdoc-22993cc5012b",
            "DG": "srcdoc-74bc75065121",
        },
        "renderedPageDir": {
            "EG": "tmp/reverse-bim/house-alpha/source/rendered-pages/srcdoc-22993cc5012b",
            "DG": "tmp/reverse-bim/house-alpha/source/rendered-pages/srcdoc-74bc75065121",
        },
        "scale": "1:100",
    },
    "house-beta": {
        "extentMm": [9864, 8984],
        "scopeDescription": (
            "2007 detached single-family house at Emattweg. Origin is the "
            "SW corner of the EG perimeter. x∈[0, 9864] (east); y∈[0, 8984] "
            "(north). KG perimeter is slightly smaller (9764 × 8984)."
        ),
        "planBearingLevels": ["KG", "EG", "DG"],
        "primarySourceDocIdByLevel": {
            "KG": "srcdoc-e73f05ce8e83",
            "EG": "srcdoc-e73f05ce8e83",
            "DG": "srcdoc-e73f05ce8e83",
        },
        "renderedPageDir": {
            "KG": "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83",
            "EG": "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83",
            "DG": "tmp/reverse-bim/house-beta/source/rendered-pages/srcdoc-e73f05ce8e83",
        },
        "sourcePageByLevel": {"KG": 1, "EG": 2, "DG": 3},
        "scale": "1:100",
    },
    "house-gamma": {
        "extentMm": [18000, 8000],
        "scopeDescription": (
            "1993 Doppelhaushälfte + Praxis at Am Kannenofen 45. Origin is "
            "the SW corner of the building. Long axis runs east-west: "
            "x∈[0, 18000]; y∈[0, 8000]. There is a 1.35 m chamfer at the "
            "SE corner (the perimeter goes (0,0) → (18000,0) → (18000,7045) "
            "→ (17045,8000) → (0,8000)). Party wall sits along the y=8000 "
            "north edge (annotated 'GEPLANTE NACHBARLICHE BEBAUUNG' in "
            "source). Spitzboden is a small enclosed attic loft inside the "
            "envelope, NOT the full footprint."
        ),
        "planBearingLevels": ["KG", "EG", "OG", "DG"],
        "primarySourceDocIdByLevel": {
            "KG": "srcdoc-0a178ed8c402",
            "EG": "srcdoc-0a178ed8c402",
            "OG": "srcdoc-0a178ed8c402",
            "DG": "srcdoc-0a178ed8c402",
        },
        "renderedPageDir": {
            "KG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402",
            "EG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402",
            "OG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402",
            "DG": "tmp/reverse-bim/house-gamma/source/rendered-pages/srcdoc-0a178ed8c402",
        },
        "sourcePageByLevel": {"KG": 1, "EG": 2, "OG": 3, "DG": 4},
        "scale": "1:50",
        "rotationHint": (
            "Pages 3 (OG) and 4 (DG) may render with the building's long "
            "axis vertical (N-S in image space). The KG page (1) is landscape "
            "(long axis horizontal). Verify by checking the printed "
            "dimension chains — the building's actual long axis is 18 m "
            "(this is the canonical x-axis). If you read a dimension chain "
            "of ~18 m in image-vertical direction, that vertical axis IS the "
            "building x-axis. Map your reading to the canonical frame above."
        ),
    },
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
        return {"error": True, "status": exc.code, "body": exc.read().decode("utf-8", "replace")[:800]}


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {
        "schemaVersion": "iter5QualityState_v1",
        "houses": {},
    }


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def model_id_for(house: str) -> str | None:
    manifest = REPO_ROOT / "tmp" / "reverse-bim" / house / "iter-5-canonical-model.json"
    if not manifest.exists():
        return None
    return json.loads(manifest.read_text(encoding="utf-8")).get("modelId")


def audit(house: str) -> dict[str, Any]:
    """Audit the live canonical model for quality gaps."""

    canonical = HOUSE_CANONICAL[house]
    model_id = model_id_for(house)
    if not model_id:
        return {"error": "no_canonical_model"}
    elems_resp = http_json("POST", f"/api/models/{model_id}/query/elements", {})
    elements = (elems_resp.get("data") or {}).get("elements") or []
    levels_by_id: dict[str, dict[str, Any]] = {}
    for e in elements:
        if e.get("kind") == "level":
            levels_by_id[str(e.get("id"))] = e
    counts_per_level: dict[str, dict[str, int]] = {}
    for e in elements:
        lvl = str(e.get("levelId") or "")
        kind = e.get("kind")
        if lvl and kind in {"wall", "room", "window", "door", "stair", "floor"}:
            slot = counts_per_level.setdefault(lvl, {})
            slot[kind] = slot.get(kind, 0) + 1

    # Quality gaps per plan-bearing level.
    gaps: list[dict[str, Any]] = []
    name_by_id = {lid: lv.get("name") for lid, lv in levels_by_id.items()}
    for level_name in canonical["planBearingLevels"]:
        lvl_id = next(
            (lid for lid, n in name_by_id.items() if n == level_name), None
        )
        if not lvl_id:
            continue
        slot = counts_per_level.get(lvl_id) or {}
        if slot.get("room", 0) < 1:
            gaps.append({"kind": "missing_rooms", "house": house, "level": level_name})
        if slot.get("window", 0) < 2:
            gaps.append({"kind": "missing_openings", "house": house, "level": level_name})
        if slot.get("wall", 0) <= 4:
            # Only perimeter walls; no interior partitions.
            gaps.append({"kind": "missing_partitions", "house": house, "level": level_name})
    # Stairs are house-level, not per-level.
    total_stairs = sum(s.get("stair", 0) for s in counts_per_level.values())
    if total_stairs < 1:
        gaps.append({"kind": "missing_stairs", "house": house})
    return {
        "modelId": model_id,
        "levelCounts": counts_per_level,
        "gaps": gaps,
        "extent": canonical["extentMm"],
        "planBearingLevels": canonical["planBearingLevels"],
    }


def render_prompt(action: str, args: dict[str, Any]) -> str:
    """Render a canonical-frame reader prompt the orchestrator can pass to
    Agent(). All coordinates the subagent emits MUST be in the canonical
    building frame defined above."""

    house = args["house"]
    canonical = HOUSE_CANONICAL[house]
    level = args.get("level")
    retry = int(args.get("retry") or 1)
    extent = canonical["extentMm"]

    def page_for(lvl: str | None) -> tuple[str, int]:
        if not lvl:
            return canonical["primarySourceDocIdByLevel"].get(
                canonical["planBearingLevels"][0]
            ), 1
        doc_id = canonical["primarySourceDocIdByLevel"].get(lvl, "")
        page = canonical.get("sourcePageByLevel", {}).get(lvl, 1)
        return doc_id, page

    common_frame = (
        f"## Canonical building frame (CRITICAL)\n\n"
        f"{canonical['scopeDescription']}\n\n"
        f"- extent: x∈[0, {extent[0]}], y∈[0, {extent[1]}] (mm)\n"
        f"- units: millimeters everywhere\n"
        f"- scale on source pages: {canonical['scale']}\n"
        + (
            "\n**Rotation hint**: " + canonical["rotationHint"] + "\n"
            if "rotationHint" in canonical
            else ""
        )
        + "\nALL `points`, `outlineMm`, `position`, `start`, `end` values in your "
        "response MUST be in this canonical frame. Do NOT use a local "
        "page-rotation frame. If the source page is rotated, transform to "
        "the canonical frame before emitting."
    )

    retry_preamble = ""
    if retry > 1:
        retry_preamble = (
            f"**RETRY {retry}**. A prior dispatch failed schema validation or "
            "wrote coordinates in a non-canonical frame. This pass must "
            "emit numerics in the canonical frame above. If a measurement "
            "is unrecoverable from the source, emit a single "
            "`source_unavailable` fact rather than fabricating.\n\n"
        )

    if action == "canonical_room_outline":
        doc_id, page = page_for(level)
        rendered_dir = canonical["renderedPageDir"].get(level, "")
        dispatch_id = f"{house}-iter5-rooms-{level.lower()}-pass-{retry:02d}"
        response_path = (
            REPO_ROOT / "tmp" / "reverse-bim" / house / "ai-reading" / "responses"
            / "reader-pass-iter5" / f"{dispatch_id}.json"
        )
        return (
            f"You are a room-outline reader for testhouse `{house}`, level `{level}`.\n\n"
            f"{retry_preamble}"
            f"{common_frame}\n\n"
            f"## Source page\n"
            f"Rendered PNG(s) under `{rendered_dir}/`. The relevant page for "
            f"`{level}` is page {page} of `{doc_id}`. Read the PNG(s) with the "
            f"Read tool (the tool displays the image).\n\n"
            f"## Your task\n"
            f"For each enclosed room visible on the plan, emit one fact:\n\n"
            f"```json\n"
            f"{{\n"
            f'  "factId": "{house}-iter5-room-{level.lower()}-<slug>",\n'
            f'  "kind": "room",\n'
            f'  "value": {{\n'
            f'    "levelId": "{level}",\n'
            f'    "name": "<room label printed on plan>",\n'
            f'    "outlineMm": [{{ "xMm": <N>, "yMm": <N> }}, ...],\n'
            f'    "areaM2": <number>\n'
            f"  }},\n"
            f'  "confidence": <0..1>,\n'
            f'  "provenance": {{"sourceDocumentId": "{doc_id}", "page": {page}, "region": "<room cluster>", "method": "ai_document_read"}}\n'
            f"}}\n"
            f"```\n\n"
            f"`outlineMm` MUST be a numeric polygon (≥3 points) in the "
            f"canonical building frame above.\n\n"
            f"## Output\n"
            f"Write JSON to `{response_path}`. Envelope:\n\n"
            f"```json\n"
            f"{{\n"
            f'  "format": "sourceAiVisualTraceReaderResponse_v1",\n'
            f'  "readerPassId": "reader-pass-iter5",\n'
            f'  "requestId": "{dispatch_id}",\n'
            f'  "workPackageId": "wp-dimensional-floorplans",\n'
            f'  "readerNotes": "<paragraph confirming the canonical frame was used>",\n'
            f'  "facts": [...]\n'
            f"}}\n"
            f"```\n\n"
            f"After writing, print one-line summary: room count + total area."
        )

    if action == "canonical_opening_reader":
        doc_id, page = page_for(level)
        rendered_dir = canonical["renderedPageDir"].get(level, "")
        dispatch_id = f"{house}-iter5-openings-{level.lower()}-pass-{retry:02d}"
        response_path = (
            REPO_ROOT / "tmp" / "reverse-bim" / house / "ai-reading" / "responses"
            / "reader-pass-iter5" / f"{dispatch_id}.json"
        )
        return (
            f"You are a door/window opening reader for testhouse `{house}`, level `{level}`.\n\n"
            f"{retry_preamble}"
            f"{common_frame}\n\n"
            f"## Source page\n"
            f"Rendered PNG(s) under `{rendered_dir}/` (page {page} of `{doc_id}`). Read with the Read tool.\n\n"
            f"## Task\n"
            f"For each visible door / window opening, emit one fact:\n\n"
            f"```json\n"
            f"{{\n"
            f'  "factId": "{house}-iter5-{level.lower()}-opening-<slug>",\n'
            f'  "kind": "opening",\n'
            f'  "value": {{\n'
            f'    "levelId": "{level}",\n'
            f'    "openingType": "door" | "window",\n'
            f'    "position": {{ "xMm": <N>, "yMm": <N> }},\n'
            f'    "widthMm": <number>,\n'
            f'    "heightMm": <number>,\n'
            f'    "sillHeightMm": <number>\n'
            f"  }},\n"
            f'  "confidence": <0..1>,\n'
            f'  "provenance": {{"sourceDocumentId": "{doc_id}", "page": {page}, "region": "<facade>", "method": "ai_document_read"}}\n'
            f"}}\n"
            f"```\n\n"
            f"`position` is the opening center in the canonical building frame. "
            f"Defaults if not annotated: door 900×2100mm sill=0, window "
            f"1200×1500mm sill=900.\n\n"
            f"## Output\n"
            f"Write JSON to `{response_path}` with the standard envelope "
            f"(format=sourceAiVisualTraceReaderResponse_v1, "
            f"readerPassId=reader-pass-iter5, requestId={dispatch_id}, "
            f"workPackageId=wp-dimensional-floorplans). After writing, "
            f"print one-line summary: door count + window count."
        )

    if action == "canonical_partition_reader":
        doc_id, page = page_for(level)
        rendered_dir = canonical["renderedPageDir"].get(level, "")
        dispatch_id = f"{house}-iter5-partitions-{level.lower()}-pass-{retry:02d}"
        response_path = (
            REPO_ROOT / "tmp" / "reverse-bim" / house / "ai-reading" / "responses"
            / "reader-pass-iter5" / f"{dispatch_id}.json"
        )
        return (
            f"You are an interior partition reader for testhouse `{house}`, level `{level}`.\n\n"
            f"{retry_preamble}"
            f"{common_frame}\n\n"
            f"## Source page\n"
            f"Rendered PNG(s) under `{rendered_dir}/` (page {page} of `{doc_id}`). Read with the Read tool.\n\n"
            f"## Task\n"
            f"For each interior partition wall segment between rooms, emit "
            f"one wall_chain fact. Use ~115 mm partition thickness unless "
            f"the plan annotates otherwise. The exterior perimeter is "
            f"already authored — DO NOT duplicate exterior walls.\n\n"
            f"```json\n"
            f"{{\n"
            f'  "factId": "{house}-iter5-partition-{level.lower()}-<slug>",\n'
            f'  "kind": "wall_chain",\n'
            f'  "value": {{\n'
            f'    "levelId": "{level}",\n'
            f'    "points": [{{ "xMm": <N>, "yMm": <N> }}, {{ "xMm": <N>, "yMm": <N> }}],\n'
            f'    "thicknessMm": 115,\n'
            f'    "wallRole": "interior_partition",\n'
            f'    "closed": false\n'
            f"  }},\n"
            f'  "confidence": <0..1>,\n'
            f'  "provenance": {{"sourceDocumentId": "{doc_id}", "page": {page}, "region": "<between rooms>", "method": "ai_document_read"}}\n'
            f"}}\n"
            f"```\n\n"
            f"Two-point chains (one segment) are fine for straight "
            f"partitions; longer polylines fine for L-shaped runs. All "
            f"`points` in the canonical building frame above. Skip the "
            f"exterior perimeter.\n\n"
            f"## Output\n"
            f"Write JSON to `{response_path}` with the standard envelope. "
            f"After writing, print summary: partition-chain count."
        )

    raise ValueError(f"unknown action: {action}")


def identify_pending(state: dict[str, Any]) -> list[dict[str, Any]]:
    pending: list[dict[str, Any]] = []
    state["houses"] = state.get("houses") or {}
    for house, canonical in HOUSE_CANONICAL.items():
        audit_row = audit(house)
        state["houses"][house] = {
            "modelId": audit_row.get("modelId"),
            "levelCounts": audit_row.get("levelCounts"),
            "gaps": audit_row.get("gaps"),
            "lastAuditAt": audit_row,
        }
        # Avoid duplicating dispatches already in flight.
        completed = set(
            (state["houses"][house].get("completedDispatchIds") or [])
        )
        action_by_gap = {
            "missing_rooms": "canonical_room_outline",
            "missing_openings": "canonical_opening_reader",
            "missing_partitions": "canonical_partition_reader",
        }
        for gap in audit_row.get("gaps") or []:
            action = action_by_gap.get(gap.get("kind"))
            if not action:
                continue
            level = gap.get("level")
            retry = 1
            dispatch_id = (
                f"{house}-iter5-"
                f"{'rooms' if action == 'canonical_room_outline' else 'openings' if action == 'canonical_opening_reader' else 'partitions'}-"
                f"{level.lower()}-pass-{retry:02d}"
            )
            if dispatch_id in completed:
                continue
            pending.append(
                {
                    "id": dispatch_id,
                    "action": action,
                    "args": {"house": house, "level": level, "retry": retry},
                }
            )
    state["pendingDispatches"] = pending
    save_state(state)
    return pending


def ingest_responses(state: dict[str, Any]) -> dict[str, Any]:
    """Apply iter-5 response files to the live canonical model. The
    canonical frame contract in the prompts means we apply coordinates
    directly without transformation."""

    applied_counts: dict[str, int] = {}
    for house in HOUSE_CANONICAL:
        model_id = model_id_for(house)
        if not model_id:
            continue
        responses_dir = (
            REPO_ROOT
            / "tmp"
            / "reverse-bim"
            / house
            / "ai-reading"
            / "responses"
            / "reader-pass-iter5"
        )
        if not responses_dir.exists():
            continue
        completed = set(state["houses"].setdefault(house, {}).setdefault("completedDispatchIds", []))
        # Process in dependency order: rooms → partitions → openings, so the
        # nearest-wall resolver sees interior partitions before trying to
        # host interior doors.
        def _ordering(p: Path) -> tuple[int, str]:
            stem = p.stem
            if "rooms" in stem:
                return (0, stem)
            if "partitions" in stem:
                return (1, stem)
            if "openings" in stem:
                return (2, stem)
            return (3, stem)

        for path in sorted(responses_dir.glob("*.json"), key=_ordering):
            dispatch_id = path.stem
            if dispatch_id in completed:
                continue
            try:
                response = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            counts = _apply_response_to_model(model_id, response)
            completed.add(dispatch_id)
            applied_counts.setdefault(house, 0)
            applied_counts[house] += sum(counts.values())
            state["houses"][house]["completedDispatchIds"] = sorted(completed)
            state["houses"][house].setdefault("appliedHistory", []).append(
                {"dispatch": dispatch_id, "counts": counts}
            )
    save_state(state)
    return {"appliedCounts": applied_counts}


_LEVEL_ID_MAP = {
    "KG": "lvl-kg", "EG": "lvl-eg", "OG": "lvl-og",
    "DG": "lvl-dg", "Spitzboden": "lvl-spitz",
    "kg": "lvl-kg", "eg": "lvl-eg", "og": "lvl-og", "dg": "lvl-dg",
}


def _apply_response_to_model(model_id: str, response: dict[str, Any]) -> dict[str, int]:
    counts = {"room": 0, "opening": 0, "wall_chain": 0, "skipped": 0, "errors": 0}
    summary = http_json("GET", f"/api/models/{model_id}/summary")
    rev = int(summary.get("revision") or summary.get("modelRevision") or 1)
    for fact in response.get("facts") or []:
        kind = fact.get("kind")
        value = fact.get("value") or {}
        if (
            value.get("status") == "source_unavailable"
            or kind == "source_unavailable"
        ):
            counts["skipped"] += 1
            continue
        level_name = (
            value.get("levelId") or value.get("levelRef") or value.get("levelName")
        )
        canonical_level = _LEVEL_ID_MAP.get(str(level_name))
        if not canonical_level:
            counts["skipped"] += 1
            continue
        if kind == "room":
            outline = value.get("outlineMm") or value.get("boundaryPointsMm")
            if not _is_numeric_polygon(outline):
                counts["skipped"] += 1
                continue
            cmd = {
                "type": "createRoomOutline",
                "name": value.get("name") or "Room",
                "levelId": canonical_level,
                "outlineMm": [{"xMm": float(p["xMm"]), "yMm": float(p["yMm"])} for p in outline],
                "targetAreaM2": value.get("areaM2"),
            }
            rev, ok = _commit(model_id, cmd, rev, "room", fact)
            if ok:
                counts["room"] += 1
            else:
                counts["errors"] += 1
            continue
        if kind == "wall_chain":
            pts = value.get("points")
            if not _is_numeric_polygon(pts):
                counts["skipped"] += 1
                continue
            thickness = float(value.get("thicknessMm") or 115)
            seq = [{"xMm": float(p["xMm"]), "yMm": float(p["yMm"])} for p in pts]
            if value.get("closed", False) and seq[0] != seq[-1]:
                seq.append(seq[0])
            segments = [
                {
                    "start": seq[i],
                    "end": seq[i + 1],
                    "thicknessMm": thickness,
                    "heightMm": 2750.0,
                }
                for i in range(len(seq) - 1)
            ]
            if not segments:
                counts["skipped"] += 1
                continue
            cmd = {
                "type": "createWallChain",
                "levelId": canonical_level,
                "namePrefix": f"iter5-{fact.get('factId') or 'partition'}",
                "segments": segments,
            }
            rev, ok = _commit(model_id, cmd, rev, "partition", fact)
            if ok:
                counts["wall_chain"] += 1
            else:
                counts["errors"] += 1
            continue
        if kind == "opening":
            opening_type = value.get("openingType") or "window"
            position = value.get("position") or value.get("positionMm")
            if not (isinstance(position, dict) and "xMm" in position and "yMm" in position):
                counts["skipped"] += 1
                continue
            nearest = http_json(
                "POST",
                f"/api/models/{model_id}/query/nearest-wall",
                {
                    "nearPointMm": [float(position["xMm"]), float(position["yMm"])],
                    "levelId": canonical_level,
                },
            )
            wall_block = (nearest.get("data") or {}).get("wall") or {}
            placement = (nearest.get("data") or {}).get("placement") or {}
            wall_id = wall_block.get("elementId")
            if not wall_id:
                counts["skipped"] += 1
                continue
            along_t = placement.get("t") or 0.5
            along_t = max(0.0, min(1.0, float(along_t)))
            if opening_type == "door":
                cmd = {
                    "type": "insertDoorOnWall",
                    "wallId": wall_id,
                    "alongT": along_t,
                    "widthMm": float(value.get("widthMm") or 900),
                }
            else:
                cmd = {
                    "type": "insertWindowOnWall",
                    "wallId": wall_id,
                    "alongT": along_t,
                    "widthMm": float(value.get("widthMm") or 1200),
                    "sillHeightMm": float(value.get("sillHeightMm") or 900),
                    "heightMm": float(value.get("heightMm") or 1500),
                }
            rev, ok = _commit(model_id, cmd, rev, "opening", fact)
            if ok:
                counts["opening"] += 1
            else:
                counts["errors"] += 1
    return counts


def _is_numeric_polygon(pts: Any) -> bool:
    return (
        isinstance(pts, list)
        and len(pts) >= 2
        and all(isinstance(p, dict) and "xMm" in p and "yMm" in p for p in pts)
    )


def _commit(
    model_id: str, command: dict[str, Any], parent_revision: int, op: str, fact: dict[str, Any]
) -> tuple[int, bool]:
    bundle = {
        "mode": "commit",
        "bundle": {
            "schemaVersion": "cmd-v3.0",
            "commands": [command],
            "assumptions": [
                {
                    "key": f"iter5.{op}.{fact.get('factId') or 'unknown'}",
                    "value": str(fact.get("factId") or op),
                    "confidence": float(fact.get("confidence") or 0.6),
                    "source": "iter5_quality_loop",
                    "contestable": True,
                    "evidence": "canonical-frame iter-5 reader response",
                }
            ],
            "parentRevision": parent_revision,
        },
    }
    resp = http_json("POST", f"/api/models/{model_id}/bundles", bundle)
    if resp.get("error") or not resp.get("applied"):
        return parent_revision, False
    return int(resp.get("newRevision") or parent_revision + 1), True


def render_all_pending_prompts(state: dict[str, Any]) -> list[dict[str, str]]:
    out = []
    for dispatch in state.get("pendingDispatches") or []:
        out.append(
            {
                "id": dispatch["id"],
                "action": dispatch["action"],
                "prompt": render_prompt(dispatch["action"], dispatch["args"]),
            }
        )
    return out


def main() -> None:
    state = load_state()
    ingest_responses(state)
    pending = identify_pending(state)
    print(
        json.dumps(
            {
                "houses": {
                    h: {
                        "modelId": state["houses"][h].get("modelId"),
                        "gaps": state["houses"][h].get("gaps") or [],
                        "levelCounts": state["houses"][h].get("levelCounts") or {},
                    }
                    for h in HOUSE_CANONICAL
                },
                "pendingCount": len(pending),
                "pending": [{"id": p["id"], "action": p["action"], "args": p["args"]} for p in pending],
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
