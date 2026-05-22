#!/usr/bin/env python3
"""Retroactively populate ``bim_model_commits`` + ``bim_model_snapshots`` for
historical transactions in ``bim_undo_stack``.

Strategy (see spec/model-time-travel-tracker.md "Retroactive Coverage"):

1. For each model with at least one unattributed (commit_id IS NULL)
   undo-stack row, fetch every row in chronological order.
2. Group consecutive rows into commits by (user_id same, created_at gap
   under ``--gap-seconds``). One commit per group; a snapshot is taken
   at the close of each group.
3. The replay is forward-only: start from an empty Document, apply each
   transaction's ``forward_commands`` through the engine commit path,
   and snapshot the resulting document at every group boundary. The
   engine performs the same coercion that the live route path uses;
   transactions whose commands no longer coerce are skipped with a
   diagnostic but do not abort the run.
4. Head parity check: after the full replay, the reconstructed document
   must equal ``bim_models.document`` (modulo canonical serialization).
   A mismatch is logged in the report and *does not* abort the script —
   the commits are still useful for log navigation even when replay
   diverges.
5. Aborted runs are safe to re-execute. The script never modifies rows
   whose ``commit_id`` is already set; concurrent writers picking up the
   commit-context wiring continue to win.

Usage::

    # Dry-run summary (no DB writes):
    uv run python scripts/backfill_model_commits.py --dry-run

    # Backfill a single model:
    uv run python scripts/backfill_model_commits.py \\
        --model-id 2378f078-6ee2-4c45-956c-d60a9973b3bb

    # Backfill every model with unattributed transactions:
    uv run python scripts/backfill_model_commits.py
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

# Add the app/ source dir so this script can import the package without
# being installed into the venv.
REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from bim_ai.db import SessionMaker  # noqa: E402
from bim_ai.document import Document  # noqa: E402
from bim_ai.engine import clone_document, try_commit_bundle  # noqa: E402
from bim_ai.routes.deps import document_to_wire  # noqa: E402
from bim_ai.tables import (  # noqa: E402
    ModelCommitRecord,
    ModelRecord,
    ModelSnapshotRecord,
    UndoStackRecord,
)
from bim_ai.versioning import (  # noqa: E402
    canonical_document_bytes,
    element_counts,
    new_commit_id,
)

DEFAULT_GAP_SECONDS = 1800  # 30 minutes — one commit per ~session.


@dataclass
class ModelReport:
    model_id: str
    txn_total: int = 0
    txn_already_attributed: int = 0
    txn_backfilled: int = 0
    txn_coercion_failed: int = 0
    commits_created: int = 0
    snapshots_created: int = 0
    head_parity_ok: bool | None = None
    head_parity_detail: str = ""
    notes: list[str] = field(default_factory=list)


def _infer_iteration_label(text: str | None) -> str | None:
    if not isinstance(text, str):
        return None
    import re

    m = re.search(r"(?:^|/)iter[-_]?(\d+[a-z]?)(?:[-_/]|$)", text, re.IGNORECASE)
    return f"iter-{m.group(1).lower()}" if m else None


def _infer_house_name(text: str | None) -> str | None:
    if not isinstance(text, str):
        return None
    import re

    m = re.search(r"(?:^|/)house[-_/]([a-z0-9]+)(?:[-_/]|$)", text, re.IGNORECASE)
    return m.group(1).lower() if m else None


def _txn_context_hints(txn: UndoStackRecord) -> dict[str, Any]:
    """Mine transaction_metadata for inspector-relevant context fields."""

    out: dict[str, Any] = {
        "source": "retroactive",
        "userId": txn.user_id,
    }
    meta = txn.transaction_metadata
    if not isinstance(meta, dict):
        return out
    workflow = meta.get("workflow") if isinstance(meta.get("workflow"), dict) else {}
    out["submitter"] = meta.get("submitter") or workflow.get("entryPoint")
    route = workflow.get("route") if isinstance(workflow.get("route"), str) else None
    if route:
        out["originalRoute"] = route
        out["iterationLabel"] = _infer_iteration_label(route) or out.get("iterationLabel")
        out["houseName"] = _infer_house_name(route) or out.get("houseName")
    return out


def _group_context(group: list[UndoStackRecord]) -> dict[str, Any]:
    """Merge per-transaction hints into a single commit context payload."""

    if not group:
        return {"source": "retroactive"}
    first = group[0]
    last = group[-1]
    merged: dict[str, Any] = {
        "source": "retroactive",
        "userId": first.user_id,
        "txnCount": len(group),
        "firstUndoId": first.id,
        "lastUndoId": last.id,
        "firstCreatedAt": first.created_at.isoformat() if first.created_at else None,
        "lastCreatedAt": last.created_at.isoformat() if last.created_at else None,
    }
    # Union of context hints across transactions; last-non-null wins per field.
    for txn in group:
        hints = _txn_context_hints(txn)
        for k, v in hints.items():
            if v not in (None, ""):
                merged[k] = v
    return merged


def _group_transactions(
    txns: list[UndoStackRecord], *, gap_seconds: float
) -> list[list[UndoStackRecord]]:
    """Split a chronological list into commit-sized groups.

    A new group starts whenever the user_id changes or the gap since the
    previous transaction exceeds ``gap_seconds``.
    """

    if not txns:
        return []
    groups: list[list[UndoStackRecord]] = [[txns[0]]]
    for txn in txns[1:]:
        prev = groups[-1][-1]
        gap = (
            (txn.created_at - prev.created_at).total_seconds()
            if txn.created_at and prev.created_at
            else 0.0
        )
        if txn.user_id == prev.user_id and gap <= gap_seconds:
            groups[-1].append(txn)
        else:
            groups.append([txn])
    return groups


async def _list_target_model_ids(
    session: AsyncSession, *, model_id: UUID | None
) -> list[UUID]:
    if model_id is not None:
        return [model_id]
    stmt = (
        select(UndoStackRecord.model_id)
        .where(UndoStackRecord.commit_id.is_(None))
        .group_by(UndoStackRecord.model_id)
    )
    res = await session.execute(stmt)
    return [row[0] for row in res.all()]


async def _load_unattributed_txns(
    session: AsyncSession, *, model_id: UUID
) -> list[UndoStackRecord]:
    stmt = (
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(UndoStackRecord.id.asc())
    )
    res = await session.execute(stmt)
    return list(res.scalars())


async def _open_synthetic_commit(
    session: AsyncSession,
    *,
    model_id: UUID,
    parent_commit_id: str | None,
    group: list[UndoStackRecord],
    summary: str,
) -> ModelCommitRecord:
    commit = ModelCommitRecord(
        commit_id=new_commit_id(),
        model_id=model_id,
        parent_commit_id=parent_commit_id,
        first_revision=group[0].revision_after,
        last_revision=group[-1].revision_after,
        state="closed",
        summary=summary,
        context=_group_context(group),
        created_at=group[0].created_at or datetime.now(UTC),
        closed_at=group[-1].created_at or datetime.now(UTC),
    )
    session.add(commit)
    await session.flush()
    return commit


async def _attach_commit_to_txns(
    session: AsyncSession, *, commit_id: str, txn_ids: list[int]
) -> None:
    if not txn_ids:
        return
    # Reload + assign — keeps it portable across async dialects.
    stmt = select(UndoStackRecord).where(UndoStackRecord.id.in_(txn_ids))
    res = await session.execute(stmt)
    for row in res.scalars():
        row.commit_id = commit_id
    await session.flush()


def _empty_document() -> Document:
    """The implicit starting state before transaction #1."""

    return Document(revision=0, elements={})  # type: ignore[arg-type]


async def _take_snapshot(
    session: AsyncSession,
    *,
    commit: ModelCommitRecord,
    document: Document,
) -> ModelSnapshotRecord:
    wire_doc = document_to_wire(document)
    canon = canonical_document_bytes(wire_doc)
    snapshot = ModelSnapshotRecord(
        model_id=commit.model_id,
        commit_id=commit.commit_id,
        revision=document.revision,
        document=wire_doc,
        document_sha256=hashlib.sha256(canon).hexdigest(),
        document_size_bytes=len(canon),
        element_counts=element_counts(wire_doc),
        created_at=commit.closed_at or datetime.now(UTC),
    )
    session.add(snapshot)
    await session.flush()
    commit.snapshot_id = snapshot.id
    await session.flush()
    return snapshot


async def backfill_one_model(
    session: AsyncSession,
    *,
    model_id: UUID,
    gap_seconds: float,
    dry_run: bool,
) -> ModelReport:
    """Backfill a single model.

    Returns a structured report; on dry-run all DB writes are skipped
    but the replay still runs so failure modes are surfaced.
    """

    report = ModelReport(model_id=str(model_id))

    model_row = await session.get(ModelRecord, model_id)
    if model_row is None:
        report.notes.append("model row not found")
        return report

    all_txns = await _load_unattributed_txns(session, model_id=model_id)
    report.txn_total = len(all_txns)

    pending = [t for t in all_txns if t.commit_id is None]
    report.txn_already_attributed = report.txn_total - len(pending)

    if not pending:
        report.notes.append("nothing to backfill")
        return report

    groups = _group_transactions(pending, gap_seconds=gap_seconds)

    working = _empty_document()
    parent_commit_id: str | None = None

    for group in groups:
        # Replay forward through this group.
        replay_failed = 0
        for txn in group:
            forward_cmds = list(txn.forward_commands or [])
            ok, new_doc, _cmds, _violations, _code = try_commit_bundle(
                working, forward_cmds
            )
            if not ok or new_doc is None:
                replay_failed += 1
                report.txn_coercion_failed += 1
                # Best-effort: jump the working document's revision counter
                # forward so we stay aligned with revision_after; this keeps
                # downstream snapshots labelled correctly even if a single
                # transaction is unreplayable.
                working = clone_document(working)
                working.revision = txn.revision_after
                continue
            working = new_doc

        summary = (
            f"retroactive commit ({len(group)} txn"
            + ("s" if len(group) != 1 else "")
            + (f", {replay_failed} unreplayable" if replay_failed else "")
            + ")"
        )

        if dry_run:
            report.commits_created += 1
            report.snapshots_created += 1
            report.txn_backfilled += len(group)
            continue

        commit = await _open_synthetic_commit(
            session,
            model_id=model_id,
            parent_commit_id=parent_commit_id,
            group=group,
            summary=summary,
        )
        await _attach_commit_to_txns(
            session,
            commit_id=commit.commit_id,
            txn_ids=[t.id for t in group],
        )
        await _take_snapshot(session, commit=commit, document=working)

        report.commits_created += 1
        report.snapshots_created += 1
        report.txn_backfilled += len(group)
        parent_commit_id = commit.commit_id

    # Head parity check.
    head_doc = Document.model_validate(model_row.document)
    head_canon = canonical_document_bytes(document_to_wire(head_doc))
    replay_canon = canonical_document_bytes(document_to_wire(working))
    if head_canon == replay_canon:
        report.head_parity_ok = True
        report.head_parity_detail = "exact match"
    else:
        report.head_parity_ok = False
        head_hash = hashlib.sha256(head_canon).hexdigest()[:12]
        replay_hash = hashlib.sha256(replay_canon).hexdigest()[:12]
        report.head_parity_detail = (
            f"diverged (head sha256[:12]={head_hash}, replay sha256[:12]={replay_hash}, "
            f"head_rev={head_doc.revision}, replay_rev={working.revision})"
        )

    if not dry_run:
        await session.commit()

    return report


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-id",
        type=str,
        default=None,
        help="Restrict to a single model UUID (default: every model with unattributed transactions).",
    )
    parser.add_argument(
        "--gap-seconds",
        type=float,
        default=DEFAULT_GAP_SECONDS,
        help=f"Commit-boundary inactivity gap in seconds (default: {DEFAULT_GAP_SECONDS}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Replay and report without writing commits/snapshots.",
    )
    args = parser.parse_args()

    target_uuid = UUID(args.model_id) if args.model_id else None

    reports: list[ModelReport] = []
    async with SessionMaker() as session:
        ids = await _list_target_model_ids(session, model_id=target_uuid)
        if not ids:
            print("No models with unattributed transactions.")
            return 0
        for mid in ids:
            print(f"=== backfilling model {mid} ===")
            report = await backfill_one_model(
                session,
                model_id=mid,
                gap_seconds=args.gap_seconds,
                dry_run=args.dry_run,
            )
            reports.append(report)
            print(f"  txn_total={report.txn_total}")
            print(f"  txn_already_attributed={report.txn_already_attributed}")
            print(f"  txn_backfilled={report.txn_backfilled}")
            print(f"  txn_coercion_failed={report.txn_coercion_failed}")
            print(f"  commits_created={report.commits_created}")
            print(f"  snapshots_created={report.snapshots_created}")
            print(
                f"  head_parity={'ok' if report.head_parity_ok else 'DIVERGED' if report.head_parity_ok is False else 'n/a'}: "
                f"{report.head_parity_detail}"
            )
            for note in report.notes:
                print(f"  note: {note}")

    # Single-line summary at the end so callers can grep it.
    summary = {
        "models": len(reports),
        "commits": sum(r.commits_created for r in reports),
        "snapshots": sum(r.snapshots_created for r in reports),
        "backfilled": sum(r.txn_backfilled for r in reports),
        "coercion_failed": sum(r.txn_coercion_failed for r in reports),
        "head_parity_diverged": sum(1 for r in reports if r.head_parity_ok is False),
        "dry_run": args.dry_run,
    }
    print(f"BACKFILL_SUMMARY {json.dumps(summary, sort_keys=True)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
