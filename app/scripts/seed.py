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

# ── Sketch house layout ──────────────────────────────────────────────────────
#
#  Two-volume composition viewed from the south-east:
#
#  Main volume (W=7000, D=8000):  two-storey, gable roof (ridge N–S, gable
#  faces south + north), upper-floor south wall is full curtain-wall glazing,
#  timber-cladding on all exterior walls.
#
#  Annex (W=4000, D=6000, attached east):  single-storey, near-flat roof,
#  timber-clad south + east face, entrance door on south face.
#
#  Coordinate system (plan):
#    X  →  east           (0 = west edge of main volume)
#    Y  →  north          (0 = south face)
#    elevation (3D Y) in mm above ground
#
#  Roof logic:
#    spanX=7000 < spanZ=8000  →  ridgeAlongX=false  →  gable ends on south+north ✓

# ── Footprint helpers ────────────────────────────────────────────────────────
_MAIN_FOOTPRINT = [
    {"xMm": 0,    "yMm": 0},
    {"xMm": 7000, "yMm": 0},
    {"xMm": 7000, "yMm": 8000},
    {"xMm": 0,    "yMm": 8000},
]

_ANNEX_FOOTPRINT = [
    {"xMm": 7000,  "yMm": 0},
    {"xMm": 11000, "yMm": 0},
    {"xMm": 11000, "yMm": 6000},
    {"xMm": 7000,  "yMm": 6000},
]

# L-shaped ground-floor slab (main vol + annex combined)
_GF_SLAB_FOOTPRINT = [
    {"xMm": 0,     "yMm": 0},
    {"xMm": 11000, "yMm": 0},
    {"xMm": 11000, "yMm": 6000},
    {"xMm": 7000,  "yMm": 6000},
    {"xMm": 7000,  "yMm": 8000},
    {"xMm": 0,     "yMm": 8000},
]


def _house_commands() -> list[dict]:
    """Return the full command bundle that builds the sketch house.

    Main volume: 7 m wide (E–W) × 8 m deep (S–N), two storeys.
      Ground floor (lvl-1, ±0):   h = 3000 mm, timber cladding.
      Upper floor  (lvl-2, +3000): h = 2800 mm, south wall = curtain wall.
      Gable roof   (30°, ridge N–S, gable on south + north faces).

    Annex: 4 m wide × 6 m deep, single storey 3200 mm, near-flat roof.
    """
    cmds: list[dict] = []

    # ── Levels ──────────────────────────────────────────────────────────────
    cmds += [
        {"type": "createLevel", "id": "lvl-1", "name": "Ground",      "elevationMm": 0},
        {"type": "createLevel", "id": "lvl-2", "name": "Upper",       "elevationMm": 3000},
        {"type": "createLevel", "id": "lvl-ann", "name": "Annex roof", "elevationMm": 3200},
    ]

    # ── Ground-floor exterior walls — main volume (h = 3000) ────────────────
    cmds += [
        {
            "type": "createWall", "id": "w-s-main", "name": "South facade (main)",
            "levelId": "lvl-1",
            "start": {"xMm": 0,    "yMm": 0}, "end": {"xMm": 7000, "yMm": 0},
            "thicknessMm": 200, "heightMm": 3000, "materialKey": "timber_cladding",
        },
        {
            "type": "createWall", "id": "w-west", "name": "West facade",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 0, "yMm": 8000},
            "thicknessMm": 200, "heightMm": 3000, "materialKey": "timber_cladding",
        },
        {
            "type": "createWall", "id": "w-n-main", "name": "North facade (main)",
            "levelId": "lvl-1",
            "start": {"xMm": 0, "yMm": 8000}, "end": {"xMm": 7000, "yMm": 8000},
            "thicknessMm": 200, "heightMm": 3000, "materialKey": "timber_cladding",
        },
    ]

    # ── Ground-floor exterior walls — annex (h = 3200) ──────────────────────
    cmds += [
        {
            "type": "createWall", "id": "w-s-ann", "name": "South facade (annex)",
            "levelId": "lvl-1",
            "start": {"xMm": 7000, "yMm": 0}, "end": {"xMm": 11000, "yMm": 0},
            "thicknessMm": 200, "heightMm": 3200, "materialKey": "timber_cladding",
        },
        {
            "type": "createWall", "id": "w-east", "name": "East facade (annex)",
            "levelId": "lvl-1",
            "start": {"xMm": 11000, "yMm": 0}, "end": {"xMm": 11000, "yMm": 6000},
            "thicknessMm": 200, "heightMm": 3200,
        },
        {
            "type": "createWall", "id": "w-n-ann", "name": "North facade (annex)",
            "levelId": "lvl-1",
            "start": {"xMm": 11000, "yMm": 6000}, "end": {"xMm": 7000, "yMm": 6000},
            "thicknessMm": 200, "heightMm": 3200,
        },
    ]

    # ── Upper-floor exterior walls — main volume only (h = 2800) ────────────
    cmds += [
        {
            # South gable face: full curtain-wall glazing
            "type": "createWall", "id": "wu-south", "name": "Upper south (curtain wall)",
            "levelId": "lvl-2",
            "start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 7000, "yMm": 0},
            "thicknessMm": 200, "heightMm": 2800, "isCurtainWall": True,
        },
        {
            "type": "createWall", "id": "wu-west", "name": "Upper west facade",
            "levelId": "lvl-2",
            "start": {"xMm": 0, "yMm": 0}, "end": {"xMm": 0, "yMm": 8000},
            "thicknessMm": 200, "heightMm": 2800, "materialKey": "timber_cladding",
        },
        {
            "type": "createWall", "id": "wu-north", "name": "Upper north facade",
            "levelId": "lvl-2",
            "start": {"xMm": 0, "yMm": 8000}, "end": {"xMm": 7000, "yMm": 8000},
            "thicknessMm": 200, "heightMm": 2800, "materialKey": "timber_cladding",
        },
        {
            # East gable end wall — faces annex flat roof
            "type": "createWall", "id": "wu-east", "name": "Upper east gable",
            "levelId": "lvl-2",
            "start": {"xMm": 7000, "yMm": 0}, "end": {"xMm": 7000, "yMm": 8000},
            "thicknessMm": 200, "heightMm": 2800, "materialKey": "timber_cladding",
        },
    ]

    # ── Floors ───────────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "createFloor", "id": "fl-gf", "name": "Ground slab",
            "levelId": "lvl-1", "boundaryMm": _GF_SLAB_FOOTPRINT,
            "thicknessMm": 200, "structureThicknessMm": 150, "finishThicknessMm": 50,
        },
        {
            "type": "createFloor", "id": "fl-upper", "name": "Upper slab",
            "levelId": "lvl-2", "boundaryMm": _MAIN_FOOTPRINT,
            "thicknessMm": 220, "structureThicknessMm": 160, "finishThicknessMm": 60,
        },
    ]

    # ── Roofs ────────────────────────────────────────────────────────────────
    cmds += [
        {
            # Main gable: spanX=7000 < spanZ=8000 → ridge along Z (N–S) automatically
            # Gable triangles appear on south (y=0) and north (y=8000) faces.
            "type": "createRoof", "id": "roof-main", "name": "Main gable roof",
            "referenceLevelId": "lvl-2",
            "footprintMm": _MAIN_FOOTPRINT,
            "overhangMm": 300,
            "slopeDeg": 30,
            "roofGeometryMode": "gable_pitched_rectangle",
        },
        {
            # Annex near-flat roof: slopeDeg=5 (minimum), lvl-ann ref (no walls at that level
            # → eaveY = 3200 mm, ridge only 175 mm above eave — essentially flat)
            "type": "createRoof", "id": "roof-ann", "name": "Annex flat roof",
            "referenceLevelId": "lvl-ann",
            "footprintMm": _ANNEX_FOOTPRINT,
            "overhangMm": 0,
            "slopeDeg": 5,
            "roofGeometryMode": "gable_pitched_rectangle",
        },
    ]

    # ── Stair (east portion of main volume, runs east–west) ──────────────────
    cmds.append({
        "type": "createStair", "id": "stair-main", "name": "Main stair",
        "baseLevelId": "lvl-1", "topLevelId": "lvl-2",
        "runStartMm": {"xMm": 1500, "yMm": 1500},
        "runEndMm":   {"xMm": 5500, "yMm": 1500},
        "widthMm": 1000, "riserMm": 175, "treadMm": 257,
    })

    # ── Doors ─────────────────────────────────────────────────────────────────
    cmds += [
        {
            # Main entrance on south facade, right-of-centre (near annex junction)
            "type": "insertDoorOnWall", "id": "d-main", "name": "Main entrance",
            "wallId": "w-s-main", "alongT": 0.78, "widthMm": 980,
        },
        {
            # Annex entrance on south annex facade
            "type": "insertDoorOnWall", "id": "d-ann", "name": "Annex entrance",
            "wallId": "w-s-ann", "alongT": 0.22, "widthMm": 900,
        },
    ]

    # ── Windows — ground floor ────────────────────────────────────────────────
    cmds += [
        {
            # Two tall narrow windows on south facade (portrait, near left)
            "type": "insertWindowOnWall", "id": "win-s1", "name": "South window 1",
            "wallId": "w-s-main", "alongT": 0.14,
            "widthMm": 850, "heightMm": 2100, "sillHeightMm": 100,
        },
        {
            "type": "insertWindowOnWall", "id": "win-s2", "name": "South window 2",
            "wallId": "w-s-main", "alongT": 0.36,
            "widthMm": 850, "heightMm": 2100, "sillHeightMm": 100,
        },
        {
            # Small window on annex south facade
            "type": "insertWindowOnWall", "id": "win-ann-s", "name": "Annex south window",
            "wallId": "w-s-ann", "alongT": 0.72,
            "widthMm": 1200, "heightMm": 1200, "sillHeightMm": 900,
        },
        {
            # Window on east (annex) facade
            "type": "insertWindowOnWall", "id": "win-ann-e", "name": "Annex east window",
            "wallId": "w-east", "alongT": 0.42,
            "widthMm": 1200, "heightMm": 1000, "sillHeightMm": 900,
        },
    ]

    # ── Windows — upper floor ─────────────────────────────────────────────────
    cmds += [
        {
            # Small window on upper east gable wall (looks out over annex roof)
            "type": "insertWindowOnWall", "id": "win-ue", "name": "Upper east window",
            "wallId": "wu-east", "alongT": 0.28,
            "widthMm": 1500, "heightMm": 1200, "sillHeightMm": 900,
        },
    ]

    # ── Stair railing ─────────────────────────────────────────────────────────
    cmds.append({
        "type": "createRailing", "id": "railing-stair", "name": "Stair railing",
        "hostedStairId": "stair-main",
        "pathMm": [{"xMm": 1500, "yMm": 600}, {"xMm": 5500, "yMm": 600}],
        "guardHeightMm": 1000,
    })

    # ── Rooms ─────────────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "createRoomOutline", "id": "room-living", "name": "Living / dining",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 200,  "yMm": 200},
                {"xMm": 6800, "yMm": 200},
                {"xMm": 6800, "yMm": 7800},
                {"xMm": 200,  "yMm": 7800},
            ],
        },
        {
            "type": "createRoomOutline", "id": "room-annex", "name": "Annex — utility / garage",
            "levelId": "lvl-1",
            "outlineMm": [
                {"xMm": 7200,  "yMm": 200},
                {"xMm": 10800, "yMm": 200},
                {"xMm": 10800, "yMm": 5800},
                {"xMm": 7200,  "yMm": 5800},
            ],
        },
        {
            "type": "createRoomOutline", "id": "room-upper", "name": "Open upper floor",
            "levelId": "lvl-2",
            "outlineMm": [
                {"xMm": 200,  "yMm": 200},
                {"xMm": 6800, "yMm": 200},
                {"xMm": 6800, "yMm": 7800},
                {"xMm": 200,  "yMm": 7800},
            ],
        },
    ]

    # ── Site pad ──────────────────────────────────────────────────────────────
    cmds.append({
        "type": "upsertSite", "id": "site-main", "name": "Site",
        "referenceLevelId": "lvl-1",
        "boundaryMm": [
            {"xMm": -3000, "yMm": -3000},
            {"xMm": 14000, "yMm": -3000},
            {"xMm": 14000, "yMm": 11000},
            {"xMm": -3000, "yMm": 11000},
        ],
        "padThicknessMm": 300,
        "baseOffsetMm": 0,
    })

    # ── Section cut (E–W through main volume) ─────────────────────────────────
    cmds.append({
        "type": "createSectionCut", "id": "sec-ew", "name": "Section A–A",
        "lineStartMm": {"xMm": 3500, "yMm": -1000},
        "lineEndMm":   {"xMm": 3500, "yMm": 9000},
        "cropDepthMm": 5000,
    })

    # ── Dimensions ────────────────────────────────────────────────────────────
    cmds += [
        {
            "type": "createDimension", "id": "dim-width", "name": "Main width",
            "levelId": "lvl-1",
            "aMm": {"xMm": 0,    "yMm": -1200},
            "bMm": {"xMm": 7000, "yMm": -1200},
            "offsetMm": {"xMm": 0, "yMm": 600},
        },
        {
            "type": "createDimension", "id": "dim-total", "name": "Total width",
            "levelId": "lvl-1",
            "aMm": {"xMm": 0,     "yMm": -2000},
            "bMm": {"xMm": 11000, "yMm": -2000},
            "offsetMm": {"xMm": 0, "yMm": 600},
        },
    ]

    # ── Viewpoints ────────────────────────────────────────────────────────────
    # Coordinate convention in viewpoint camera: xMm=plan-X, yMm=plan-Y, zMm=elevation.
    # (Three.js maps: X→x, Z→y-plan, Y→elevation)
    cmds += [
        {
            # South-east iso — matches the reference sketch perspective
            "type": "saveViewpoint", "id": "vp-se", "name": "SE iso (sketch view)",
            "mode": "orbit_3d",
            "camera": {
                "position": {"xMm": 18000, "yMm": -8000, "zMm": 13000},
                "target":   {"xMm": 5000,  "yMm": 4000,  "zMm": 4000},
                "up":       {"xMm": 0,     "yMm": 0,     "zMm": 1},
            },
        },
        {
            # Default 3D orbit — slightly elevated south-west view
            "type": "saveViewpoint", "id": "vp-sw", "name": "SW orbit",
            "mode": "orbit_3d",
            "camera": {
                "position": {"xMm": -8000, "yMm": -5000, "zMm": 11000},
                "target":   {"xMm": 3500,  "yMm": 4000,  "zMm": 3500},
                "up":       {"xMm": 0,     "yMm": 0,     "zMm": 1},
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
                    body="Sketch house loaded — main gable volume (curtain wall south face) + annex flat roof. SE iso viewpoint matches the reference sketch.",
                    element_id=None,
                    level_id="lvl-1",
                    anchor_x_mm=3500,
                    anchor_y_mm=4000,
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
