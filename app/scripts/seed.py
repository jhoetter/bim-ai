#!/usr/bin/env python3
"""Load named seed artifact sets into local development models.

Seed artifact sets are directories under ``seed-artifacts/<name>/`` by default.
Each set owns its source copy, deterministic command bundle, validation
evidence, and manifest. This script never imports a hard-coded house from
application source code.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select

from bim_ai.db import SessionMaker, init_db_schema
from bim_ai.document import Document
from bim_ai.engine import try_commit_bundle
from bim_ai.tables import (
    ActivityRowRecord,
    CommentRecord,
    MilestoneRecord,
    ModelRecord,
    ProjectRecord,
    PublicLinkRecord,
    RedoStackRecord,
    RoleAssignmentRecord,
    UndoStackRecord,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_ARTIFACT_ROOT = REPO_ROOT / "seed-artifacts"
SEED_PROJECT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:project:seed-library")
LEGACY_DEMO_PROJECT_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:project:demo")
LEGACY_DEMO_MODEL_ID = uuid.uuid5(uuid.NAMESPACE_URL, "bim-ai:model:demo-main")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,127}$")


@dataclass(frozen=True)
class SeedArtifact:
    name: str
    title: str
    slug: str
    directory: Path
    bundle_path: Path
    manifest: dict[str, Any]

    @property
    def model_id(self) -> uuid.UUID:
        return uuid.uuid5(uuid.NAMESPACE_URL, f"bim-ai:seed-model:{self.name}")

    @property
    def comment_id(self) -> uuid.UUID:
        return uuid.uuid5(uuid.NAMESPACE_URL, f"bim-ai:seed-comment:{self.name}:intro")


def _safe_name(value: str) -> str:
    name = value.strip().lower()
    if not SLUG_RE.match(name):
        raise ValueError(
            f"Invalid seed name {value!r}. Use lowercase letters, digits, '.', '_' or '-'."
        )
    return name


def _artifact_root(raw: str | None) -> Path:
    root = Path(raw or os.environ.get("BIM_AI_SEED_ARTIFACT_ROOT") or DEFAULT_ARTIFACT_ROOT)
    return root.expanduser().resolve()


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf8"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Missing seed artifact file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def _load_artifact(directory: Path) -> SeedArtifact:
    manifest_path = directory / "manifest.json"
    manifest = _read_json(manifest_path)
    if not isinstance(manifest, dict):
        raise ValueError(f"{manifest_path} must contain a JSON object.")
    if manifest.get("schemaVersion") != "bim-ai.seed-artifact.v1":
        raise ValueError(f"{manifest_path} must use schemaVersion bim-ai.seed-artifact.v1.")

    name = _safe_name(str(manifest.get("name") or directory.name))
    slug = _safe_name(str(manifest.get("slug") or name))
    title = str(manifest.get("title") or name).strip() or name
    bundle_rel = str(manifest.get("bundle") or "bundle.json")
    bundle_path = (directory / bundle_rel).resolve()
    if not bundle_path.is_file():
        raise FileNotFoundError(f"Seed artifact {name!r} has no bundle at {bundle_path}")
    if not bundle_path.is_relative_to(directory.resolve()):
        raise ValueError(f"Seed artifact {name!r} bundle must stay inside the artifact directory.")
    return SeedArtifact(
        name=name,
        title=title,
        slug=slug,
        directory=directory.resolve(),
        bundle_path=bundle_path,
        manifest=manifest,
    )


def _discover_artifacts(root: Path, selected_name: str | None) -> list[SeedArtifact]:
    if selected_name:
        selected = _safe_name(selected_name)
        artifact_dir = root / selected
        if not artifact_dir.is_dir():
            raise FileNotFoundError(
                f"Seed artifact {selected!r} not found at {artifact_dir}. "
                "Create it with scripts/create-seed-artifact.mjs first."
            )
        return [_load_artifact(artifact_dir)]

    if not root.is_dir():
        return []
    artifacts: list[SeedArtifact] = []
    for child in sorted(root.iterdir()):
        if child.is_dir() and (child / "manifest.json").is_file():
            artifacts.append(_load_artifact(child))
    return artifacts


def _bundle_commands(bundle_path: Path) -> list[dict[str, Any]]:
    bundle = _read_json(bundle_path)
    if isinstance(bundle, list):
        commands = bundle
    elif isinstance(bundle, dict) and isinstance(bundle.get("commands"), list):
        commands = bundle["commands"]
    else:
        raise ValueError(f"{bundle_path} must be a command array or an object with commands[].")
    return [dict(command) for command in commands]


def document_wire(doc: Document) -> dict[str, Any]:
    return {
        "revision": doc.revision,
        "elements": {kid: elem.model_dump(by_alias=True) for kid, elem in doc.elements.items()},
    }


def _materialize(artifact: SeedArtifact) -> tuple[Document, dict[str, Any]]:
    commands = _bundle_commands(artifact.bundle_path)
    empty_doc = Document(revision=0, elements={})
    ok, house_doc, _cmds, violations, code = try_commit_bundle(empty_doc, commands)
    if not ok or house_doc is None:
        blocking = [v for v in violations if getattr(v, "blocking", False)]
        raise RuntimeError(f"Seed artifact {artifact.name!r} failed ({code}): {blocking}")
    return house_doc, document_wire(house_doc)


async def _delete_model_records(session: Any, model_ids: list[uuid.UUID]) -> None:
    if not model_ids:
        return
    model_id_strings = [str(mid) for mid in model_ids]
    await session.execute(delete(CommentRecord).where(CommentRecord.model_id.in_(model_ids)))
    await session.execute(delete(UndoStackRecord).where(UndoStackRecord.model_id.in_(model_ids)))
    await session.execute(delete(RedoStackRecord).where(RedoStackRecord.model_id.in_(model_ids)))
    await session.execute(
        delete(ActivityRowRecord).where(ActivityRowRecord.model_id.in_(model_id_strings))
    )
    await session.execute(
        delete(MilestoneRecord).where(MilestoneRecord.model_id.in_(model_id_strings))
    )
    await session.execute(
        delete(RoleAssignmentRecord).where(RoleAssignmentRecord.model_id.in_(model_id_strings))
    )
    await session.execute(
        delete(PublicLinkRecord).where(PublicLinkRecord.model_id.in_(model_id_strings))
    )
    await session.execute(delete(ModelRecord).where(ModelRecord.id.in_(model_ids)))


async def _clear_project(session: Any, project_id: uuid.UUID) -> int:
    result = await session.execute(
        select(ModelRecord.id).where(ModelRecord.project_id == project_id)
    )
    model_ids = list(result.scalars().all())
    await _delete_model_records(session, model_ids)
    await session.execute(delete(ProjectRecord).where(ProjectRecord.id == project_id))
    return len(model_ids)


async def _clear_legacy_seed(session: Any) -> int:
    row = await session.get(ModelRecord, LEGACY_DEMO_MODEL_ID)
    await _delete_model_records(session, [LEGACY_DEMO_MODEL_ID])
    await session.execute(delete(ProjectRecord).where(ProjectRecord.id == LEGACY_DEMO_PROJECT_ID))
    return 1 if row is not None else 0


def _intro_comment(artifact: SeedArtifact, now: datetime) -> CommentRecord | None:
    comment = artifact.manifest.get("entryComment")
    if comment is False:
        return None
    if not isinstance(comment, dict):
        comment = {}
    body = str(
        comment.get("body")
        or artifact.manifest.get("description")
        or f"Seed artifact loaded from {artifact.name}."
    )
    return CommentRecord(
        id=artifact.comment_id,
        model_id=artifact.model_id,
        user_display=str(comment.get("userDisplay") or "Seed bot"),
        body=body,
        element_id=comment.get("elementId"),
        level_id=comment.get("levelId"),
        anchor_x_mm=comment.get("anchorXMm"),
        anchor_y_mm=comment.get("anchorYMm"),
        resolved=False,
        created_at=now,
        updated_at=now,
    )


async def seed_async(name: str | None, root: Path, clear_only: bool) -> None:
    await init_db_schema()

    artifacts = [] if clear_only else _discover_artifacts(root, name)
    materialized = [(artifact, *_materialize(artifact)) for artifact in artifacts]

    async with SessionMaker() as session:
        legacy_removed = await _clear_legacy_seed(session)
        if clear_only:
            removed = await _clear_project(session, SEED_PROJECT_ID)
            await session.commit()
            print(f"seed: cleared {removed + legacy_removed} seed model(s)")
            return

        if name is None:
            await _clear_project(session, SEED_PROJECT_ID)

        if not materialized:
            await session.commit()
            print(f"seed: no seed artifacts found at {root}; seed project is empty")
            return

        if await session.get(ProjectRecord, SEED_PROJECT_ID) is None:
            session.add(
                ProjectRecord(
                    id=SEED_PROJECT_ID,
                    slug="seeds",
                    title="Seed Library",
                )
            )

        now = datetime.now(UTC)
        seeded: list[str] = []
        for artifact, house_doc, house_wire in materialized:
            await _delete_model_records(session, [artifact.model_id])
            session.add(
                ModelRecord(
                    id=artifact.model_id,
                    project_id=SEED_PROJECT_ID,
                    slug=artifact.slug,
                    revision=house_doc.revision,
                    document=house_wire,
                )
            )
            await session.flush()
            comment = _intro_comment(artifact, now)
            if comment is not None:
                session.add(comment)
            seeded.append(f"{artifact.slug}:{artifact.model_id}")

        await session.commit()

    print(f"seed: loaded {len(seeded)} seed artifact(s) from {root}")
    for row in seeded:
        print(f"  {row}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load named BIM seed artifact sets.")
    parser.add_argument("--name", default=os.environ.get("BIM_AI_SEED_NAME"))
    parser.add_argument("--root", default=os.environ.get("BIM_AI_SEED_ARTIFACT_ROOT"))
    parser.add_argument(
        "--clear", action="store_true", help="Delete all seed-managed models and exit."
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(seed_async(name=args.name, root=_artifact_root(args.root), clear_only=args.clear))


if __name__ == "__main__":
    main()
