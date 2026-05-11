#!/usr/bin/env python3
"""Seed the demo `demo/main` model from the canonical command bundle.

The bundle source-of-truth lives in
`packages/cli/lib/one-family-home-commands.mjs` (also consumed by the JS
`scripts/apply-one-family-home.mjs` and the CLI `bim-ai plan-house`).
This script spawns Node to materialize the bundle, then commits it
through the same engine path as user-driven authoring.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import uuid
from datetime import UTC, datetime
from pathlib import Path

from bim_ai.db import SessionMaker, init_db_schema
from bim_ai.document import Document
from bim_ai.engine import try_commit_bundle
from bim_ai.tables import CommentRecord, ModelRecord, ProjectRecord

PROJECT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:project:demo")
MODEL_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:model:demo-main")
COMMENT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:comment:demo-1")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_canonical_commands() -> list[dict]:
    """Materialize commands from the JS canonical builder via Node."""
    proc = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import { buildOneFamilyHomeCommands } from "
            "'./packages/cli/lib/one-family-home-commands.mjs'; "
            "process.stdout.write(JSON.stringify(buildOneFamilyHomeCommands()));",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
        check=True,
    )
    return json.loads(proc.stdout)


def document_wire(doc: Document) -> dict:
    return {
        "revision": doc.revision,
        "elements": {kid: elem.model_dump(by_alias=True) for kid, elem in doc.elements.items()},
    }


async def seed_async() -> None:
    await init_db_schema()

    commands = _load_canonical_commands()
    empty_doc = Document(revision=0, elements={})
    ok, house_doc, _cmds, violations, code = try_commit_bundle(empty_doc, commands)
    if not ok or house_doc is None:
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
                    body=(
                        "Target-house demo seed — 14 m by 10 m modern two-level house with a "
                        "dominant folded white upper wrapper, deep front loggia, recessed "
                        "right-front carport, and open-to-sky roof court matching "
                        "spec/target-house/."
                    ),
                    element_id=None,
                    level_id="th-lvl-ground",
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
