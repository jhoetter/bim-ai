#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from bim_ai.db import SessionMaker, init_db_schema
from bim_ai.document import Document
from bim_ai.elements import (
    CameraMm,
    DimensionElem,
    DoorElem,
    Element,
    GridLineElem,
    IssueElem,
    LevelElem,
    RoomElem,
    Vec2Mm,
    Vec3Mm,
    ViewpointElem,
    WallElem,
    WindowElem,
)
from bim_ai.engine import try_commit_bundle
from bim_ai.tables import CommentRecord, ModelRecord, ProjectRecord

PROJECT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:project:demo")
MODEL_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:model:demo-main")
COMMENT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:comment:demo-1")


def demo_document() -> Document:
    wall_spine = "wall-001"
    wall_ns = "wall-002"

    elems: dict[str, Element] = {
        "lvl-1": LevelElem(kind="level", id="lvl-1", name="Ground", elevationMm=0),
        "lvl-2": LevelElem(kind="level", id="lvl-2", name="Upper", elevationMm=3000),
        wall_spine: WallElem(
            kind="wall",
            id=wall_spine,
            name="Spine wall",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=0),
            end=Vec2Mm(xMm=14000, yMm=0),
            thicknessMm=200,
            heightMm=2800,
        ),
        wall_ns: WallElem(
            kind="wall",
            id=wall_ns,
            name="North façade",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=-4000),
            end=Vec2Mm(xMm=14000, yMm=-4000),
            thicknessMm=200,
            heightMm=2800,
        ),
        "wall-020": WallElem(
            kind="wall",
            id="wall-020",
            name="West end",
            levelId="lvl-1",
            start=Vec2Mm(xMm=0, yMm=-4000),
            end=Vec2Mm(xMm=0, yMm=2000),
            thicknessMm=200,
            heightMm=2800,
        ),
        "wall-up-1": WallElem(
            kind="wall",
            id="wall-up-1",
            name="Upper spine",
            levelId="lvl-2",
            start=Vec2Mm(xMm=2000, yMm=-2000),
            end=Vec2Mm(xMm=9000, yMm=-2000),
            thicknessMm=200,
            heightMm=2800,
        ),
        "door-001": DoorElem(
            kind="door",
            id="door-001",
            name="Entry",
            wallId=wall_spine,
            alongT=0.25,
            widthMm=900,
        ),
        "win-001": WindowElem(
            kind="window",
            id="win-001",
            name="Ribbon window",
            wallId=wall_ns,
            alongT=0.45,
            widthMm=2200,
            sillHeightMm=900,
            heightMm=1600,
        ),
        "room-001": RoomElem(
            kind="room",
            id="room-001",
            name="Open office",
            levelId="lvl-1",
            outlineMm=[
                Vec2Mm(xMm=3000, yMm=-3000),
                Vec2Mm(xMm=11000, yMm=-3000),
                Vec2Mm(xMm=11000, yMm=-500),
                Vec2Mm(xMm=3000, yMm=-500),
            ],
        ),
        "grid-a": GridLineElem(
            kind="grid_line",
            id="grid-a",
            name="Axis A",
            label="A",
            levelId=None,
            start=Vec2Mm(xMm=-2000, yMm=-5000),
            end=Vec2Mm(xMm=16000, yMm=-5000),
        ),
        "grid-b": GridLineElem(
            kind="grid_line",
            id="grid-b",
            name="Axis B",
            label="B",
            levelId=None,
            start=Vec2Mm(xMm=-2000, yMm=-2000),
            end=Vec2Mm(xMm=16000, yMm=-2000),
        ),
        "grid-1": GridLineElem(
            kind="grid_line",
            id="grid-1",
            name="Line 1",
            label="1",
            levelId=None,
            start=Vec2Mm(xMm=14000, yMm=-6000),
            end=Vec2Mm(xMm=14000, yMm=2500),
        ),
        "dim-001": DimensionElem(
            kind="dimension",
            id="dim-001",
            name="Width check",
            levelId="lvl-1",
            aMm=Vec2Mm(xMm=0, yMm=0),
            bMm=Vec2Mm(xMm=8000, yMm=0),
            offsetMm=Vec2Mm(xMm=0, yMm=1200),
        ),
        "vp-001": ViewpointElem(
            kind="viewpoint",
            id="vp-001",
            name="Default orbit",
            camera=CameraMm(
                position=Vec3Mm(xMm=9500, yMm=-7500, zMm=6500),
                target=Vec3Mm(xMm=4000, yMm=-1500, zMm=0),
                up=Vec3Mm(xMm=0, yMm=0, zMm=1),
            ),
            mode="orbit_3d",
        ),
        "issue-001": IssueElem(
            kind="issue",
            id="issue-001",
            title="Starter issue — coordination kickoff",
            status="open",
            elementIds=[wall_spine, "door-001"],
            viewpointId="vp-001",
        ),
    }

    return Document(revision=1, elements=elems)


def document_wire(doc: Document) -> dict:
    return {
        "revision": doc.revision,
        "elements": {kid: elem.model_dump(by_alias=True) for kid, elem in doc.elements.items()},
    }


async def seed_async() -> None:
    await init_db_schema()
    demo = demo_document()
    ok_bundle, demo2, _, _, _code = try_commit_bundle(
        demo,
        [
            {
                "type": "createRoomRectangle",
                "levelId": "lvl-1",
                "origin": {"xMm": 15500, "yMm": -5500},
                "widthMm": 2600,
                "depthMm": 1900,
            }
        ],
    )
    if ok_bundle:
        demo = demo2
    demo_wire = document_wire(demo)
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
                    revision=demo.revision,
                    document=demo_wire,
                ),
            )
        else:
            row.document = demo_wire
            row.revision = demo.revision
            row.slug = "main"
            row.project_id = PROJECT_ID

        crowd = await session.get(CommentRecord, COMMENT_ID)
        if crowd is None:
            session.add(
                CommentRecord(
                    id=COMMENT_ID,
                    model_id=MODEL_ID,
                    user_display="Seed bot",
                    body="Try Plan ( toolbar ) · Snap + tools: Wall / Door / Window / Room / Grid / Dimension.",
                    element_id=None,
                    level_id="lvl-1",
                    anchor_x_mm=6200,
                    anchor_y_mm=-2800,
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
