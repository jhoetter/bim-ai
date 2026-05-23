#!/usr/bin/env python3
"""Idempotent purge of testhouse `bim_models` rows + all dependent rows.

Targets every `bim_models` row whose slug matches one of the testhouse
names (``house-alpha``, ``house-beta``, ``house-gamma``) — including
historical iter-prefixed variants like ``iter5-house-alpha`` that older
``scripts/testhouse_iter*.py`` runs left behind.

Deletes cascade through:

  - bim_undo_stack          (commit_id FK is NULLed implicitly via DELETE)
  - bim_redo_stack
  - bim_comments
  - bim_model_commits       (after NULLing snapshot_id to break the cycle)
  - bim_model_snapshots
  - activity_rows           (ondelete=CASCADE)
  - milestones              (ondelete=CASCADE)
  - role_assignments        (ondelete=CASCADE)
  - public_links            (ondelete=CASCADE)
  - bim_models              (the row itself)

Re-runnable: returns 0 with ``removed=0`` when the targets are absent.

Usage::

    uv run python scripts/testhouse_purge.py            # all three houses
    uv run python scripts/testhouse_purge.py --dry-run  # report only
    uv run python scripts/testhouse_purge.py --house alpha
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from sqlalchemy import delete, or_, select, update  # noqa: E402

from bim_ai.db import SessionMaker  # noqa: E402
from bim_ai.tables import (  # noqa: E402
    ActivityRowRecord,
    CommentRecord,
    MilestoneRecord,
    ModelCommitRecord,
    ModelRecord,
    ModelSnapshotRecord,
    PublicLinkRecord,
    RedoStackRecord,
    RoleAssignmentRecord,
    UndoStackRecord,
)

HOUSES = ("alpha", "beta", "gamma")


async def _select_model_ids(session, *, houses: tuple[str, ...]) -> list:
    """Find every model row whose slug contains one of `house-<name>`.

    Catches both clean slugs (``house-alpha``) and iter-prefixed variants
    (``iter5-house-alpha``, ``iter10-house-beta``).
    """

    patterns = [f"%house-{h}%" for h in houses]
    stmt = select(ModelRecord.id, ModelRecord.slug).where(
        or_(*[ModelRecord.slug.ilike(p) for p in patterns])
    )
    rows = (await session.execute(stmt)).all()
    return [(row[0], row[1]) for row in rows]


async def _delete_for_models(session, *, model_ids: list) -> None:
    if not model_ids:
        return

    model_id_strings = [str(mid) for mid in model_ids]

    # bim_undo_stack and bim_redo_stack reference bim_model_commits via
    # commit_id. Deleting them first removes that FK pressure entirely.
    await session.execute(delete(UndoStackRecord).where(UndoStackRecord.model_id.in_(model_ids)))
    await session.execute(delete(RedoStackRecord).where(RedoStackRecord.model_id.in_(model_ids)))
    await session.execute(delete(CommentRecord).where(CommentRecord.model_id.in_(model_ids)))

    # bim_model_commits.snapshot_id → bim_model_snapshots.id and
    # bim_model_snapshots.commit_id → bim_model_commits.commit_id form a
    # cycle. NULL out snapshot_id first, then delete snapshots, then commits.
    await session.execute(
        update(ModelCommitRecord)
        .where(ModelCommitRecord.model_id.in_(model_ids))
        .values(snapshot_id=None)
    )
    await session.execute(
        delete(ModelSnapshotRecord).where(ModelSnapshotRecord.model_id.in_(model_ids))
    )
    await session.execute(
        delete(ModelCommitRecord).where(ModelCommitRecord.model_id.in_(model_ids))
    )

    # These three have ondelete=CASCADE but we delete explicitly so the
    # row counts surface in the report.
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


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--house",
        choices=HOUSES,
        action="append",
        default=None,
        help="Restrict to one or more houses (default: all three).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be deleted; do not write.",
    )
    args = parser.parse_args()

    targets = tuple(args.house) if args.house else HOUSES

    async with SessionMaker() as session:
        rows = await _select_model_ids(session, houses=targets)
        if not rows:
            print(
                json.dumps(
                    {"removed": 0, "matched": 0, "houses": list(targets), "dry_run": args.dry_run},
                    sort_keys=True,
                )
            )
            return 0

        for mid, slug in rows:
            print(f"  match: slug={slug!r} id={mid}")

        if args.dry_run:
            print(
                json.dumps(
                    {
                        "removed": 0,
                        "matched": len(rows),
                        "houses": list(targets),
                        "dry_run": True,
                    },
                    sort_keys=True,
                )
            )
            return 0

        model_ids = [mid for mid, _ in rows]
        await _delete_for_models(session, model_ids=model_ids)
        await session.commit()

        print(
            json.dumps(
                {
                    "removed": len(model_ids),
                    "matched": len(model_ids),
                    "houses": list(targets),
                    "dry_run": False,
                },
                sort_keys=True,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
