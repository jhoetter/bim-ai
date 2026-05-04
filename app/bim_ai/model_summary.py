"""Roll-up counts for agent / dashboard endpoints."""

from __future__ import annotations

from collections import Counter
from typing import Any

from bim_ai.document import Document
from bim_ai.elements import (
    DoorElem,
    GridLineElem,
    IssueElem,
    LevelElem,
    RoomElem,
    WallElem,
    WindowElem,
)
from bim_ai.room_derivation_preview import room_derivation_preview


def compute_model_summary(doc: Document) -> dict[str, Any]:
    elems = list(doc.elements.values())
    kinds = Counter(getattr(e, "kind", "?") for e in elems)

    levels = sorted(
        (e for e in elems if isinstance(e, LevelElem)),
        key=lambda lv: lv.elevation_mm,
    )

    walls = [e for e in elems if isinstance(e, WallElem)]

    rooms = [e for e in elems if isinstance(e, RoomElem)]

    doors = [e for e in elems if isinstance(e, DoorElem)]

    wins = [e for e in elems if isinstance(e, WindowElem)]

    grids = [e for e in elems if isinstance(e, GridLineElem)]

    issues_open = sum(
        1 for i in elems if isinstance(i, IssueElem) and getattr(i, "status", "") != "done"
    )

    wall_by_level: Counter[str] = Counter()
    for w in walls:
        wall_by_level[w.level_id] += 1

    room_by_level: Counter[str] = Counter()
    for r in rooms:
        room_by_level[r.level_id] += 1

    return {
        "revision": doc.revision,
        "elementTotal": len(elems),
        "scaleWorkload": {
            "wallCount": len(walls),
            "roomCount": len(rooms),
            "scheduleElementCount": int(kinds.get("schedule", 0)),
        },
        "countsByKind": dict(kinds),
        "levelCount": len(levels),
        "levels": [{"id": lv.id, "name": lv.name, "elevationMm": lv.elevation_mm} for lv in levels],
        "wallCount": len(walls),
        "wallsByLevelId": dict(wall_by_level),
        "roomCount": len(rooms),
        "roomsByLevelId": dict(room_by_level),
        "doorCount": len(doors),
        "windowCount": len(wins),
        "gridLineCount": len(grids),
        "openIssueCount": issues_open,
        "floorCount": int(kinds.get("floor", 0)),
        "roofCount": int(kinds.get("roof", 0)),
        "stairCount": int(kinds.get("stair", 0)),
        "sheetCount": int(kinds.get("sheet", 0)),
        "railingCount": int(kinds.get("railing", 0)),
        "slabOpeningCount": int(kinds.get("slab_opening", 0)),
        "familyTypeCount": int(kinds.get("family_type", 0)),
        "sectionCutCount": int(kinds.get("section_cut", 0)),
        "planViewCount": int(kinds.get("plan_view", 0)),
        "viewTemplateCount": int(kinds.get("view_template", 0)),
        "viewpointCount": int(kinds.get("viewpoint", 0)),
        "dimensionCount": int(kinds.get("dimension", 0)),
        "scheduleCount": int(kinds.get("schedule", 0)),
        "roomDerivationPreview": (
            rd_preview := room_derivation_preview(doc)
        ),
        "regenerationDiagnostics": {
            "documentRevision": doc.revision,
            "roomDerivationHeuristicVersion": rd_preview.get("heuristicVersion"),
            "roomDerivationCandidateCount": rd_preview.get("candidateCount"),
            "roomDerivationAuthoritativeCount": rd_preview.get("authoritativeCandidateCount", 0),
            "roomDerivationDiagnosticCount": rd_preview.get("diagnosticCount", 0),
            "roomDerivationWarningCount": len(rd_preview.get("warnings") or []),
            "levelsWithRoomsSorted": sorted(room_by_level.keys()),
            "levelsWithWallsSorted": sorted(wall_by_level.keys()),
            "maxRoomsOnSingleLevel": max(room_by_level.values()) if room_by_level else 0,
            "maxWallsOnSingleLevel": max(wall_by_level.values()) if wall_by_level else 0,
        },
    }
