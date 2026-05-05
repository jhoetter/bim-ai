"""Deterministic evidence payload for level elevation moves + datum propagation."""

from __future__ import annotations

from typing import Any

from bim_ai.datum_levels import level_datum_topo_order_if_acyclic
from bim_ai.document import Document
from bim_ai.elements import LevelElem


def _move_level_targets_from_commands(commands: list[dict[str, Any]]) -> list[str]:
    moved: set[str] = set()
    for c in commands:
        if str(c.get("type") or "") != "moveLevelElevation":
            continue
        lid = c.get("levelId") or c.get("level_id")
        if isinstance(lid, str) and lid.strip():
            moved.add(lid.strip())
    return sorted(moved)


def build_level_elevation_propagation_evidence_v0(
    doc_before: Document,
    doc_after: Document,
    *,
    applied_commands: list[dict[str, Any]],
) -> dict[str, Any]:
    """Summarize per-level elevation deltas after one or more `moveLevelElevation` commits."""
    blocked = level_datum_topo_order_if_acyclic(doc_after.elements) is None
    direct_ids = set(_move_level_targets_from_commands(applied_commands))
    level_ids = sorted(lid for lid, el in doc_after.elements.items() if isinstance(el, LevelElem))
    rows: list[dict[str, Any]] = []
    for lid in level_ids:
        a_el = doc_after.elements.get(lid)
        if not isinstance(a_el, LevelElem):
            continue
        b_el = doc_before.elements.get(lid)
        before_mm = float(b_el.elevation_mm) if isinstance(b_el, LevelElem) else float(a_el.elevation_mm)
        after_mm = float(a_el.elevation_mm)
        delta_mm = round(after_mm - before_mm, 3)
        pid_raw = a_el.parent_level_id
        pid = str(pid_raw).strip() if pid_raw else None
        if pid == "":
            pid = None

        if lid in direct_ids:
            role = "direct_move"
        elif abs(delta_mm) >= 1e-6:
            role = "datum_propagated"
        else:
            role = "unchanged"

        rows.append(
            {
                "levelId": lid,
                "elevationBeforeMm": round(before_mm, 3),
                "elevationAfterMm": round(after_mm, 3),
                "deltaMm": delta_mm,
                "parentLevelId": pid,
                "role": role,
            }
        )

    return {
        "format": "levelElevationPropagationEvidence_v0",
        "datumPropagationBlocked": blocked,
        "directMoveLevelIds": sorted(direct_ids),
        "rows": rows,
    }
