#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from bim_ai.db import SessionMaker, init_db_schema
from bim_ai.document import Document
from bim_ai.engine import try_commit_bundle
from bim_ai.tables import CommentRecord, ModelRecord, ProjectRecord

PROJECT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:project:demo")
MODEL_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:model:demo-main")
COMMENT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:comment:demo-1")

# Ground floor footprint (12 m × 8.4 m rectangle, CCW, origin at SW corner)
_FOOTPRINT_MM = [
    {"xMm": 0, "yMm": 0},
    {"xMm": 12000, "yMm": 0},
    {"xMm": 12000, "yMm": 8400},
    {"xMm": 0, "yMm": 8400},
]

# Stair shaft cutout in upper slab (hall zone, east side)
_STAIR_SHAFT_MM = [
    {"xMm": 7200, "yMm": 500},
    {"xMm": 11200, "yMm": 500},
    {"xMm": 11200, "yMm": 1700},
    {"xMm": 7200, "yMm": 1700},
]


def _house_commands() -> list[dict]:
    """Return the full command bundle that builds the seed house.

    Layout — two-storey single-family home, 12 m × 8.4 m rectangular footprint:

    Ground (lvl-1, 0 mm):
      West half (0–6 m)  → Living room (open plan)
      East half (6–12 m), south zone (0–4.2 m) → Entrance hall + stair
      East half (6–12 m), north zone (4.2–8.4 m) → Kitchen / dining

    Upper (lvl-2, 2 800 mm):
      South half (0–4.2 m) → Bedroom A
      North half (4.2–8.4 m) → Bedroom B
    """
    cmds: list[dict] = []

    # ── Levels ──────────────────────────────────────────────────────────────
    cmds += [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground", "elevationMm": 0},
        {"type": "createLevel", "id": "lvl-2", "name": "Upper", "elevationMm": 2800},
    ]

    # ── Ground exterior walls (closed CCW loop) ──────────────────────────────
    cmds += [
        {
            "type": "createWall", "id": "w-south", "name": "South facade",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 12000, "yMm": 0},
            "thicknessMm": 200, "heightMm": 2800,
        },
        {
            "type": "createWall", "id": "w-east", "name": "East facade",
            "levelId": "lvl-1",
            "start": {"xMm": 12000, "yMm": 0}, "end": {"xMm": 12000, "yMm": 8400},
            "thicknessMm": 200, "heightMm": 2800,
        },
        {
            "type": "createWall", "id": "w-north", "name": "North facade",
            "levelId": "lvl-1",
            "start": {"xMm": 12000, "yMm": 8400}, "end": {"xMm": 0, "yMm": 8400},
            "thicknessMm": 200, "heightMm": 2800,
        },
        {
            "type": "createWall", "id": "w-west", "name": "West facade",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 8400}, "end": {"xMm": 0, "yMm": 0},
            "thicknessMm": 200, "heightMm": 2800,
        },
    ]

    # ── Ground interior walls ────────────────────────────────────────────────
    cmds += [
        {
            "type": "createWall", "id": "w-spine", "name": "N-S spine",
            "levelId": "lvl-1",
            "start": {"xMm": 6000, "yMm": 200}, "end": {"xMm": 6000, "yMm": 8200},
            "thicknessMm": 150, "heightMm": 2800,
        },
        {
            "type": "createWall", "id": "w-cross", "name": "Kitchen partition",
            "levelId": "lvl-1",
            "start": {"xMm": 6150, "yMm": 4200}, "end": {"xMm": 11800, "yMm": 4200},
            "thicknessMm": 150, "heightMm": 2800,
        },
    ]

    # ── Upper exterior walls (stacked directly above ground) ─────────────────
    cmds += [
        {
            "type": "createWall", "id": "wu-south", "name": "Upper south facade",
            "levelId": "lvl-2",
            "start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 12000, "yMm": 0},
            "thicknessMm": 200, "heightMm": 2600,
        },
        {
            "type": "createWall", "id": "wu-east", "name": "Upper east facade",
            "levelId": "lvl-2",
            "start": {"xMm": 12000, "yMm": 0}, "end": {"xMm": 12000, "yMm": 8400},
            "thicknessMm": 200, "heightMm": 2600,
        },
        {
            "type": "createWall", "id": "wu-north", "name": "Upper north facade",
            "levelId": "lvl-2",
            "start": {"xMm": 12000, "yMm": 8400}, "end": {"xMm": 0, "yMm": 8400},
            "thicknessMm": 200, "heightMm": 2600,
        },
        {
            "type": "createWall", "id": "wu-west", "name": "Upper west facade",
            "levelId": "lvl-2",
            "start": {"xMm": 0, "yMm": 8400}, "end": {"xMm": 0, "yMm": 0},
            "thicknessMm": 200, "heightMm": 2600,
        },
    ]

    # ── Upper interior wall (bedroom divider) ────────────────────────────────
    cmds.append({
        "type": "createWall", "id": "wu-bed-split", "name": "Bedroom divider",
        "levelId": "lvl-2",
        "start": {"xMm": 200, "yMm": 4200}, "end": {"xMm": 11800, "yMm": 4200},
        "thicknessMm": 150, "heightMm": 2600,
    })

    # ── Floors ───────────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "createFloor", "id": "fl-ground", "name": "Ground slab",
            "levelId": "lvl-1", "boundaryMm": _FOOTPRINT_MM,
            "thicknessMm": 200, "structureThicknessMm": 150, "finishThicknessMm": 50,
        },
        {
            "type": "createFloor", "id": "fl-upper", "name": "Upper slab",
            "levelId": "lvl-2", "boundaryMm": _FOOTPRINT_MM,
            "thicknessMm": 220, "structureThicknessMm": 160, "finishThicknessMm": 60,
        },
    ]

    # ── Stair shaft opening in upper slab ────────────────────────────────────
    cmds.append({
        "type": "createSlabOpening", "id": "shaft-stair", "name": "Stair shaft",
        "hostFloorId": "fl-upper", "boundaryMm": _STAIR_SHAFT_MM, "isShaft": True,
    })

    # ── Roof ─────────────────────────────────────────────────────────────────
    # roofGeometryMode must be "gable_pitched_rectangle" (not the default "mass_box")
    # to produce a glTF mesh in 3D. Requires exactly 4 axis-aligned rect corners + slopeDeg.
    cmds.append({
        "type": "createRoof", "id": "roof-main", "name": "Pitched roof",
        "referenceLevelId": "lvl-2", "footprintMm": _FOOTPRINT_MM,
        "overhangMm": 500, "slopeDeg": 30,
        "roofGeometryMode": "gable_pitched_rectangle",
    })

    # ── Stair (entrance hall, runs east–west) ─────────────────────────────────
    cmds.append({
        "type": "createStair", "id": "stair-main", "name": "Main stair",
        "baseLevelId": "lvl-1", "topLevelId": "lvl-2",
        "runStartMm": {"xMm": 7400, "yMm": 1100},
        "runEndMm": {"xMm": 11000, "yMm": 1100},
        "widthMm": 900, "riserMm": 175, "treadMm": 275,
    })

    # ── Doors ─────────────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "insertDoorOnWall", "id": "d-front", "name": "Front door",
            "wallId": "w-south", "alongT": 0.18, "widthMm": 980,
        },
        {
            "type": "insertDoorOnWall", "id": "d-spine-s", "name": "Hall door south",
            "wallId": "w-spine", "alongT": 0.22, "widthMm": 900,
        },
        {
            "type": "insertDoorOnWall", "id": "d-spine-n", "name": "Kitchen door",
            "wallId": "w-spine", "alongT": 0.72, "widthMm": 900,
        },
        {
            "type": "insertDoorOnWall", "id": "d-cross", "name": "Kitchen internal door",
            "wallId": "w-cross", "alongT": 0.15, "widthMm": 820,
        },
    ]

    # ── Windows (ground) ─────────────────────────────────────────────────────
    cmds += [
        {
            "type": "insertWindowOnWall", "id": "win-living-s", "name": "Living south window",
            "wallId": "w-south", "alongT": 0.7, "widthMm": 2400,
            "heightMm": 1400, "sillHeightMm": 800,
        },
        {
            "type": "insertWindowOnWall", "id": "win-east-g", "name": "East window",
            "wallId": "w-east", "alongT": 0.72, "widthMm": 1600,
            "heightMm": 1200, "sillHeightMm": 900,
        },
        {
            "type": "insertWindowOnWall", "id": "win-north-g", "name": "North window",
            "wallId": "w-north", "alongT": 0.35, "widthMm": 1800,
            "heightMm": 1200, "sillHeightMm": 900,
        },
        {
            "type": "insertWindowOnWall", "id": "win-west-g", "name": "West window",
            "wallId": "w-west", "alongT": 0.5, "widthMm": 1600,
            "heightMm": 1200, "sillHeightMm": 900,
        },
    ]

    # ── Windows (upper) ──────────────────────────────────────────────────────
    cmds += [
        {
            "type": "insertWindowOnWall", "id": "win-upper-sw", "name": "Upper south-west window",
            "wallId": "wu-south", "alongT": 0.2, "widthMm": 1400,
            "heightMm": 1200, "sillHeightMm": 900,
        },
        {
            "type": "insertWindowOnWall", "id": "win-upper-se", "name": "Upper south-east window",
            "wallId": "wu-south", "alongT": 0.7, "widthMm": 1400,
            "heightMm": 1200, "sillHeightMm": 900,
        },
        {
            "type": "insertWindowOnWall", "id": "win-upper-n", "name": "Upper north window",
            "wallId": "wu-north", "alongT": 0.5, "widthMm": 1600,
            "heightMm": 1200, "sillHeightMm": 900,
        },
    ]

    # ── Rooms (ground) ───────────────────────────────────────────────────────
    cmds += [
        {
            "type": "createRoomOutline", "id": "room-living", "name": "Living room",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 200, "yMm": 200},
                {"xMm": 5800, "yMm": 200},
                {"xMm": 5800, "yMm": 8200},
                {"xMm": 200, "yMm": 8200},
            ],
        },
        {
            "type": "createRoomOutline", "id": "room-entrance", "name": "Entrance hall",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 6200, "yMm": 200},
                {"xMm": 11800, "yMm": 200},
                {"xMm": 11800, "yMm": 4050},
                {"xMm": 6200, "yMm": 4050},
            ],
        },
        {
            "type": "createRoomOutline", "id": "room-kitchen", "name": "Kitchen / dining",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 6200, "yMm": 4350},
                {"xMm": 11800, "yMm": 4350},
                {"xMm": 11800, "yMm": 8200},
                {"xMm": 6200, "yMm": 8200},
            ],
        },
    ]

    # ── Rooms (upper) ────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "createRoomOutline", "id": "room-bed-a", "name": "Bedroom A",
            "levelId": "lvl-2",
            "outlineMm": [
                {"xMm": 200, "yMm": 200},
                {"xMm": 11800, "yMm": 200},
                {"xMm": 11800, "yMm": 4050},
                {"xMm": 200, "yMm": 4050},
            ],
        },
        {
            "type": "createRoomOutline", "id": "room-bed-b", "name": "Bedroom B",
            "levelId": "lvl-2",
            "outlineMm": [
                {"xMm": 200, "yMm": 4350},
                {"xMm": 11800, "yMm": 4350},
                {"xMm": 11800, "yMm": 8200},
                {"xMm": 200, "yMm": 8200},
            ],
        },
    ]

    # ── Section cut ───────────────────────────────────────────────────────────
    cmds.append({
        "type": "createSectionCut", "id": "sec-ew", "name": "Section A–A",
        "lineStartMm": {"xMm": -1000, "yMm": 4200},
        "lineEndMm": {"xMm": 13000, "yMm": 4200},
        "cropDepthMm": 6000,
    })

    # ── Dimension ────────────────────────────────────────────────────────────
    cmds.append({
        "type": "createDimension", "id": "dim-width", "name": "House width",
        "levelId": "lvl-1",
        "aMm": {"xMm": 0, "yMm": -800},
        "bMm": {"xMm": 12000, "yMm": -800},
        "offsetMm": {"xMm": 0, "yMm": 600},
    })

    # ── Viewpoints ───────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "saveViewpoint", "id": "vp-001", "name": "Default orbit",
            "mode": "orbit_3d",
            "camera": {
                "position": {"xMm": 20000, "yMm": -7000, "zMm": 10000},
                "target": {"xMm": 6000, "yMm": 4200, "zMm": 1400},
                "up": {"xMm": 0, "yMm": 0, "zMm": 1},
            },
        },
        {
            "type": "saveViewpoint", "id": "vp-ne", "name": "NE iso",
            "mode": "orbit_3d",
            "camera": {
                "position": {"xMm": 20000, "yMm": 16000, "zMm": 12000},
                "target": {"xMm": 6000, "yMm": 4200, "zMm": 1400},
                "up": {"xMm": 0, "yMm": 0, "zMm": 1},
            },
        },
    ]

    return cmds


def document_wire(doc: Document) -> dict:
    return {
        "revision": doc.revision,
        "elements": {kid: elem.model_dump(by_alias=True) for kid, elem in doc.elements.items()},
    }


async def seed_async() -> None:
    await init_db_schema()

    empty_doc = Document(revision=0, elements={})
    ok, house_doc, _cmds, violations, code = try_commit_bundle(empty_doc, _house_commands())
    if not ok:
        blocking = [v for v in violations if getattr(v, "blocking", False)]
        raise RuntimeError(f"Seed house bundle failed ({code}): {blocking}")

    house_wire = document_wire(house_doc)
    now = datetime.now(UTC)

    async with SessionMaker() as session:
        if await session.get(ProjectRecord, PROJECT_ID) is None:
            session.add(ProjectRecord(id=PROJECT_ID, slug="demo", title="BIM AI demo project"))

        row = await session.get(ModelRecord, MODEL_ID)
        if row is None:
            session.add(
                ModelRecord(
                    id=MODEL_ID,
                    project_id=PROJECT_ID,
                    slug="main",
                    revision=house_doc.revision,
                    document=house_wire,
                ),
            )
        else:
            row.document = house_wire
            row.revision = house_doc.revision
            row.slug = "main"
            row.project_id = PROJECT_ID

        crowd = await session.get(CommentRecord, COMMENT_ID)
        if crowd is None:
            session.add(
                CommentRecord(
                    id=COMMENT_ID,
                    model_id=MODEL_ID,
                    user_display="Seed bot",
                    body="Welcome! Explore the two-storey house — try Plan views, Section A–A, or switch to 3D orbit.",
                    element_id=None,
                    level_id="lvl-1",
                    anchor_x_mm=3000,
                    anchor_y_mm=4200,
                    resolved=False,
                    created_at=now,
                    updated_at=now,
                ),
            )

        await session.commit()

    print("seed: OK — demo/main model:", str(MODEL_ID))


def main() -> None:
    asyncio.run(seed_async())


if __name__ == "__main__":
    main()
