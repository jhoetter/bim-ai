"""Time-travel commit lifecycle for BIM models.

This module sits *on top of* the existing event log in `bim_undo_stack`:
every model mutation continues to write an undo record exactly as before;
versioning adds an optional grouping layer (``bim_model_commits``) plus
periodic full-document snapshots (``bim_model_snapshots``).

Design choices follow ``spec/model-time-travel-tracker.md``:

* ``commit_id`` is a 26-character Crockford-base32 ULID — monotonic,
  human-copyable, lexically sortable.
* At most one commit per model may be in ``state='open'`` at a time;
  enforced by the partial unique index ``bim_model_commits_one_open_per_model``
  added in ``db.init_db_schema``.
* Snapshots reuse the canonical serialization codec from
  ``transaction_metadata.canonical_transaction_digest`` so document hashes
  are stable and content-addressable dedup works.
* ``abort_commit`` skips the snapshot (resolved decision #6) — the post-
  rollback state equals the parent's already-snapshotted state.
* The current commit id is propagated via a ``ContextVar`` so existing
  write paths can attach it to ``UndoStackRecord.commit_id`` without
  threading an argument through every helper.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.tables import (
    ModelCommitRecord,
    ModelRecord,
    ModelSnapshotRecord,
    UndoStackRecord,
)

# Crockford Base32 alphabet (RFC-grade ULIDs use the same).
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

# Per-task tracker of the active commit. None means "no commit context";
# callers writing UndoStackRecords either attach this value or leave
# ``commit_id`` NULL (which is valid — existing routes do this today).
_current_commit: ContextVar[str | None] = ContextVar(
    "bim_ai.versioning.current_commit_id", default=None
)


def new_commit_id() -> str:
    """Return a fresh 26-char Crockford-base32 ULID.

    48-bit millisecond timestamp + 80-bit randomness = 128 bits, encoded
    as 26 base-32 characters. Lexicographic sort matches creation time
    at millisecond resolution; same-millisecond ties are broken by the
    random suffix.
    """

    ms = int(time.time() * 1000)
    time_bytes = ms.to_bytes(6, "big")
    rand_bytes = secrets.token_bytes(10)
    raw = time_bytes + rand_bytes  # 16 bytes / 128 bits
    num = int.from_bytes(raw, "big")
    chars: list[str] = []
    for _ in range(26):
        chars.append(_CROCKFORD[num & 0x1F])
        num >>= 5
    return "".join(reversed(chars))


def current_commit_id() -> str | None:
    """Return the active commit id for this async task, or None."""

    return _current_commit.get()


def canonical_document_bytes(document: Any) -> bytes:
    """Canonical UTF-8 JSON serialization used for snapshot hashing.

    Matches ``transaction_metadata.canonical_transaction_digest``: sorted
    keys, no whitespace, ``default=str`` for non-JSON-native values.
    Required so ``document_sha256`` is stable across processes and runs.
    """

    return json.dumps(
        document,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")


def element_counts(document: Any) -> dict[str, int]:
    """Lightweight ``{kind: count}`` index over a document's elements.

    Used as ``ModelSnapshotRecord.element_counts`` so the log/dashboard
    can show element-kind breakdowns without parsing the full snapshot.
    Tolerates a non-dict or missing ``elements`` payload.
    """

    if not isinstance(document, dict):
        return {}
    elements = document.get("elements")
    if not isinstance(elements, dict):
        return {}
    counts: dict[str, int] = {}
    for elem in elements.values():
        if not isinstance(elem, dict):
            continue
        kind = str(elem.get("kind") or "unknown")
        counts[kind] = counts.get(kind, 0) + 1
    return counts


async def find_latest_commit(
    session: AsyncSession,
    *,
    model_id: UUID,
    states: tuple[str, ...] = ("closed", "aborted"),
) -> ModelCommitRecord | None:
    """Return the most-recent commit for a model in any of ``states``."""

    res = await session.execute(
        select(ModelCommitRecord)
        .where(ModelCommitRecord.model_id == model_id)
        .where(ModelCommitRecord.state.in_(states))
        .order_by(desc(ModelCommitRecord.created_at))
        .limit(1)
    )
    return res.scalar_one_or_none()


async def open_commit(
    session: AsyncSession,
    *,
    model_id: UUID,
    summary: str = "",
    context: dict[str, Any] | None = None,
) -> ModelCommitRecord:
    """Open a new commit for ``model_id``.

    The partial unique index on ``bim_model_commits`` rejects a second
    open commit on the same model with a constraint violation; callers
    should treat that as a 409 from upstream routes.
    """

    model_row = await session.get(ModelRecord, model_id)
    if model_row is None:
        raise ValueError(f"Model {model_id} not found")

    parent = await find_latest_commit(session, model_id=model_id)
    commit = ModelCommitRecord(
        commit_id=new_commit_id(),
        model_id=model_id,
        parent_commit_id=parent.commit_id if parent is not None else None,
        # Placeholder bounds; close_commit resolves them from the actual
        # undo-stack rows attached to this commit.
        first_revision=model_row.revision + 1,
        last_revision=model_row.revision,
        state="open",
        summary=summary,
        context=dict(context or {}),
        created_at=datetime.now(UTC),
    )
    session.add(commit)
    await session.flush()
    return commit


async def _resolve_revision_bounds(
    session: AsyncSession, *, commit_id: str, model_revision: int
) -> tuple[int, int]:
    res = await session.execute(
        select(
            func.min(UndoStackRecord.revision_after),
            func.max(UndoStackRecord.revision_after),
        ).where(UndoStackRecord.commit_id == commit_id)
    )
    rev_min, rev_max = res.one()
    if rev_min is None:
        # Zero-mutation commit (e.g., iteration boundary marker).
        return model_revision, model_revision
    return int(rev_min), int(rev_max)


async def close_commit(
    session: AsyncSession,
    *,
    commit_id: str,
    summary_override: str | None = None,
    take_snapshot: bool = True,
) -> ModelCommitRecord:
    """Mark a commit closed and (by default) capture a snapshot.

    Idempotent: re-closing a closed/aborted commit is a no-op that
    returns the current row.
    """

    commit = await session.get(ModelCommitRecord, commit_id)
    if commit is None:
        raise ValueError(f"Commit {commit_id} not found")
    if commit.state != "open":
        return commit

    model_row = await session.get(ModelRecord, commit.model_id)
    if model_row is None:
        raise ValueError(f"Model {commit.model_id} missing during close")

    first_rev, last_rev = await _resolve_revision_bounds(
        session, commit_id=commit_id, model_revision=model_row.revision
    )
    commit.first_revision = first_rev
    commit.last_revision = last_rev
    if summary_override is not None:
        commit.summary = summary_override
    commit.state = "closed"
    commit.closed_at = datetime.now(UTC)

    if take_snapshot:
        doc_raw: Any = model_row.document if isinstance(model_row.document, dict) else {}
        doc_snapshot = dict(doc_raw)
        canon = canonical_document_bytes(doc_snapshot)
        snap = ModelSnapshotRecord(
            model_id=model_row.id,
            commit_id=commit_id,
            revision=model_row.revision,
            document=doc_snapshot,
            document_sha256=hashlib.sha256(canon).hexdigest(),
            document_size_bytes=len(canon),
            element_counts=element_counts(doc_snapshot),
            created_at=datetime.now(UTC),
        )
        session.add(snap)
        await session.flush()
        commit.snapshot_id = snap.id

    await session.flush()
    return commit


async def abort_commit(
    session: AsyncSession,
    *,
    commit_id: str,
) -> ModelCommitRecord:
    """Mark a commit aborted; per resolved decision #6 no snapshot is taken."""

    commit = await session.get(ModelCommitRecord, commit_id)
    if commit is None:
        raise ValueError(f"Commit {commit_id} not found")
    if commit.state != "open":
        return commit

    model_row = await session.get(ModelRecord, commit.model_id)
    model_rev = model_row.revision if model_row is not None else commit.last_revision

    first_rev, last_rev = await _resolve_revision_bounds(
        session, commit_id=commit_id, model_revision=model_rev
    )
    commit.first_revision = first_rev
    commit.last_revision = last_rev
    commit.state = "aborted"
    commit.closed_at = datetime.now(UTC)

    await session.flush()
    return commit


@asynccontextmanager
async def commit_context(
    session: AsyncSession,
    *,
    model_id: UUID,
    summary: str = "",
    context: dict[str, Any] | None = None,
) -> AsyncIterator[ModelCommitRecord]:
    """Async context manager that opens a commit, sets the contextvar, and closes on exit.

    On a normal exit the commit is closed and snapshotted. On exception
    it is aborted (no snapshot) and the original exception propagates.
    """

    commit = await open_commit(
        session,
        model_id=model_id,
        summary=summary,
        context=context,
    )
    token = _current_commit.set(commit.commit_id)
    try:
        yield commit
        await close_commit(session, commit_id=commit.commit_id)
    except Exception:
        # Best-effort abort; the original exception always wins.
        try:
            await abort_commit(session, commit_id=commit.commit_id)
        except Exception:
            pass
        raise
    finally:
        _current_commit.reset(token)
