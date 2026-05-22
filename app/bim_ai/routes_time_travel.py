"""Read-side HTTP API for the BIM model time-travel system.

Endpoints (all under ``/api/models/{model_id}/``):

* ``GET commits`` — paged log of commits with agent context.
* ``GET commits/{commit_id}`` — full detail of a single commit.
* ``GET state?at={commit_id}`` — document at the given commit (from
  snapshot; replay-from-snapshot+deltas is a later optimization).
* ``GET diff?from={a}&to={b}&depth=cheap|deep`` — structural delta
  between two commits' documents.
* ``GET elements/{element_id}/history`` — every undo-stack
  transaction that touched the element, with its commit context.

See ``spec/model-time-travel-tracker.md`` for the data model and
the conventional ``context`` fields.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from bim_ai.db import get_session
from bim_ai.routes_deps import load_model_row
from bim_ai.tables import (
    ModelCommitRecord,
    ModelRecord,
    ModelSnapshotRecord,
    UndoStackRecord,
)

time_travel_router = APIRouter()


def _commit_to_wire(commit: ModelCommitRecord) -> dict[str, Any]:
    return {
        "commitId": commit.commit_id,
        "modelId": str(commit.model_id),
        "parentCommitId": commit.parent_commit_id,
        "firstRevision": commit.first_revision,
        "lastRevision": commit.last_revision,
        "state": commit.state,
        "summary": commit.summary,
        "context": dict(commit.context or {}),
        "createdAt": commit.created_at.isoformat() if commit.created_at else None,
        "closedAt": commit.closed_at.isoformat() if commit.closed_at else None,
        "snapshotId": commit.snapshot_id,
    }


def _snapshot_summary(snapshot: ModelSnapshotRecord | None) -> dict[str, Any] | None:
    if snapshot is None:
        return None
    return {
        "snapshotId": snapshot.id,
        "revision": snapshot.revision,
        "documentSha256": snapshot.document_sha256,
        "documentSizeBytes": snapshot.document_size_bytes,
        "elementCounts": dict(snapshot.element_counts or {}),
        "createdAt": snapshot.created_at.isoformat() if snapshot.created_at else None,
    }


async def _require_model(session: AsyncSession, model_id: UUID) -> ModelRecord:
    row = await load_model_row(session, model_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return row


async def _load_commit(
    session: AsyncSession, *, model_id: UUID, commit_id: str
) -> ModelCommitRecord:
    commit = await session.get(ModelCommitRecord, commit_id)
    if commit is None or commit.model_id != model_id:
        raise HTTPException(status_code=404, detail=f"Commit {commit_id} not found")
    return commit


async def _load_snapshot(
    session: AsyncSession, *, commit_id: str
) -> ModelSnapshotRecord | None:
    stmt = select(ModelSnapshotRecord).where(ModelSnapshotRecord.commit_id == commit_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


@time_travel_router.get("/models/{model_id}/commits")
async def list_commits(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before: Annotated[str | None, Query()] = None,
    phase: Annotated[str | None, Query()] = None,
    iteration: Annotated[str | None, Query()] = None,
    source: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """Paged commit log, newest first."""

    await _require_model(session, model_id)

    stmt = (
        select(ModelCommitRecord)
        .where(ModelCommitRecord.model_id == model_id)
        .order_by(desc(ModelCommitRecord.created_at), desc(ModelCommitRecord.commit_id))
    )
    if before:
        before_row = await session.get(ModelCommitRecord, before)
        if before_row is None or before_row.model_id != model_id:
            raise HTTPException(status_code=404, detail=f"Cursor commit {before} not found")
        stmt = stmt.where(
            or_(
                ModelCommitRecord.created_at < before_row.created_at,
                (ModelCommitRecord.created_at == before_row.created_at)
                & (ModelCommitRecord.commit_id < before_row.commit_id),
            )
        )
    if phase:
        stmt = stmt.where(ModelCommitRecord.context["phaseId"].astext == phase)
    if iteration:
        stmt = stmt.where(ModelCommitRecord.context["iterationLabel"].astext == iteration)
    if source:
        stmt = stmt.where(ModelCommitRecord.context["source"].astext == source)
    if state:
        stmt = stmt.where(ModelCommitRecord.state == state)

    stmt = stmt.limit(limit + 1)
    res = await session.execute(stmt)
    commits = list(res.scalars().all())

    has_more = len(commits) > limit
    page = commits[:limit]

    snapshot_ids = [c.snapshot_id for c in page if c.snapshot_id is not None]
    snapshots_by_id: dict[int, ModelSnapshotRecord] = {}
    if snapshot_ids:
        snap_stmt = select(ModelSnapshotRecord).where(
            ModelSnapshotRecord.id.in_(snapshot_ids)
        )
        snap_res = await session.execute(snap_stmt)
        snapshots_by_id = {s.id: s for s in snap_res.scalars()}

    items: list[dict[str, Any]] = []
    for commit in page:
        wire = _commit_to_wire(commit)
        if commit.snapshot_id is not None:
            wire["snapshot"] = _snapshot_summary(snapshots_by_id.get(commit.snapshot_id))
        else:
            wire["snapshot"] = None
        items.append(wire)

    return {
        "modelId": str(model_id),
        "items": items,
        "hasMore": has_more,
        "nextCursor": page[-1].commit_id if has_more and page else None,
    }


@time_travel_router.get("/models/{model_id}/commits/{commit_id}")
async def get_commit(
    model_id: UUID,
    commit_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    """Full detail for a single commit, including the snapshot summary and
    a tool-call count derived from attached undo-stack rows."""

    await _require_model(session, model_id)
    commit = await _load_commit(session, model_id=model_id, commit_id=commit_id)
    snapshot = await _load_snapshot(session, commit_id=commit_id)

    # Tool-call count = number of undo records attached to this commit.
    tc_stmt = select(UndoStackRecord.id).where(UndoStackRecord.commit_id == commit_id)
    tc_res = await session.execute(tc_stmt)
    tool_call_count = len(list(tc_res.scalars()))

    return {
        **_commit_to_wire(commit),
        "snapshot": _snapshot_summary(snapshot),
        "toolCallCount": tool_call_count,
    }


@time_travel_router.get("/models/{model_id}/state")
async def get_state_at_commit(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    at: Annotated[str | None, Query(description="Commit id to checkout")] = None,
    at_revision: Annotated[
        int | None, Query(alias="at-revision", description="Revision int to checkout")
    ] = None,
) -> dict[str, Any]:
    """Return the bim_models.document JSONB at a given commit.

    Resolution:
    1. If ``at`` is supplied, fetch the snapshot for that commit.
    2. If ``at-revision`` is supplied, find the commit whose
       ``[first_revision, last_revision]`` contains it.
    3. If neither is supplied, return the current head document.

    Commits without a snapshot (e.g., aborted commits or future
    sparse-snapshot policy) return 404 here; the read path will gain a
    replay branch in a follow-up.
    """

    row = await _require_model(session, model_id)

    if at is None and at_revision is None:
        # Head: identical to existing model document.
        return {
            "modelId": str(model_id),
            "at": None,
            "revision": row.revision,
            "document": row.document,
        }

    commit_id = at
    if at_revision is not None and at is None:
        stmt = (
            select(ModelCommitRecord)
            .where(ModelCommitRecord.model_id == model_id)
            .where(ModelCommitRecord.first_revision <= at_revision)
            .where(ModelCommitRecord.last_revision >= at_revision)
            .order_by(desc(ModelCommitRecord.created_at))
            .limit(1)
        )
        commit_res = await session.execute(stmt)
        commit_row = commit_res.scalar_one_or_none()
        if commit_row is None:
            raise HTTPException(
                status_code=404,
                detail=f"No commit covers revision {at_revision}",
            )
        commit_id = commit_row.commit_id

    assert commit_id is not None
    commit = await _load_commit(session, model_id=model_id, commit_id=commit_id)
    snapshot = await _load_snapshot(session, commit_id=commit_id)
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Commit {commit_id} has no snapshot "
                f"(state={commit.state}); replay path not yet implemented"
            ),
        )
    return {
        "modelId": str(model_id),
        "at": commit_id,
        "revision": snapshot.revision,
        "document": snapshot.document,
    }


def _diff_documents_cheap(
    a: dict[str, Any], b: dict[str, Any]
) -> dict[str, Any]:
    """Counts-only delta: kinds added/modified/removed."""

    a_elements = a.get("elements") if isinstance(a, dict) else {}
    b_elements = b.get("elements") if isinstance(b, dict) else {}
    if not isinstance(a_elements, dict):
        a_elements = {}
    if not isinstance(b_elements, dict):
        b_elements = {}

    a_ids = set(a_elements.keys())
    b_ids = set(b_elements.keys())
    added = b_ids - a_ids
    removed = a_ids - b_ids
    common = a_ids & b_ids
    modified = {eid for eid in common if a_elements.get(eid) != b_elements.get(eid)}

    def _counts(ids: set[str], doc_els: dict[str, Any]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for eid in ids:
            elem = doc_els.get(eid)
            kind = (elem or {}).get("kind", "unknown") if isinstance(elem, dict) else "unknown"
            counts[kind] = counts.get(kind, 0) + 1
        return counts

    return {
        "addedCount": len(added),
        "modifiedCount": len(modified),
        "removedCount": len(removed),
        "addedByKind": _counts(added, b_elements),
        "modifiedByKind": _counts(modified, b_elements),
        "removedByKind": _counts(removed, a_elements),
    }


def _diff_documents_deep(
    a: dict[str, Any], b: dict[str, Any]
) -> dict[str, Any]:
    """Per-element delta with changed-field lists."""

    a_elements = a.get("elements") if isinstance(a, dict) else {}
    b_elements = b.get("elements") if isinstance(b, dict) else {}
    if not isinstance(a_elements, dict):
        a_elements = {}
    if not isinstance(b_elements, dict):
        b_elements = {}

    a_ids = set(a_elements.keys())
    b_ids = set(b_elements.keys())

    added_items: list[dict[str, Any]] = []
    for eid in sorted(b_ids - a_ids):
        elem = b_elements.get(eid)
        kind = elem.get("kind", "unknown") if isinstance(elem, dict) else "unknown"
        added_items.append({"id": eid, "kind": kind, "element": elem})

    removed_items: list[dict[str, Any]] = []
    for eid in sorted(a_ids - b_ids):
        elem = a_elements.get(eid)
        kind = elem.get("kind", "unknown") if isinstance(elem, dict) else "unknown"
        removed_items.append({"id": eid, "kind": kind, "element": elem})

    modified_items: list[dict[str, Any]] = []
    for eid in sorted(a_ids & b_ids):
        prev = a_elements.get(eid)
        curr = b_elements.get(eid)
        if prev == curr:
            continue
        changed_fields: list[str] = []
        if isinstance(prev, dict) and isinstance(curr, dict):
            keys = set(prev.keys()) | set(curr.keys())
            changed_fields = sorted(k for k in keys if prev.get(k) != curr.get(k))
        kind = (
            curr.get("kind", "unknown")
            if isinstance(curr, dict)
            else (prev.get("kind", "unknown") if isinstance(prev, dict) else "unknown")
        )
        modified_items.append(
            {
                "id": eid,
                "kind": kind,
                "changedFields": changed_fields,
                "before": prev,
                "after": curr,
            }
        )

    return {
        "added": added_items,
        "modified": modified_items,
        "removed": removed_items,
        **_diff_documents_cheap(a, b),
    }


@time_travel_router.get("/models/{model_id}/commit-diff")
async def diff_commits(
    model_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    from_: Annotated[str, Query(alias="from")],
    to: Annotated[str, Query()],
    depth: Annotated[Literal["cheap", "deep"], Query()] = "cheap",
) -> dict[str, Any]:
    """Diff between two commits' documents.

    Both commits must have snapshots. ``depth=cheap`` returns counts +
    counts-by-kind only; ``deep`` adds the per-element list with
    before/after and changed-field names.
    """

    await _require_model(session, model_id)
    commit_a = await _load_commit(session, model_id=model_id, commit_id=from_)
    commit_b = await _load_commit(session, model_id=model_id, commit_id=to)
    snap_a = await _load_snapshot(session, commit_id=commit_a.commit_id)
    snap_b = await _load_snapshot(session, commit_id=commit_b.commit_id)
    if snap_a is None or snap_b is None:
        raise HTTPException(
            status_code=404,
            detail="diff requires both commits to have snapshots",
        )

    doc_a = snap_a.document if isinstance(snap_a.document, dict) else {}
    doc_b = snap_b.document if isinstance(snap_b.document, dict) else {}

    if depth == "cheap":
        payload = _diff_documents_cheap(doc_a, doc_b)
    else:
        payload = _diff_documents_deep(doc_a, doc_b)

    return {
        "modelId": str(model_id),
        "from": from_,
        "to": to,
        "depth": depth,
        **payload,
    }


def _undo_touched_ids(undo_row: UndoStackRecord) -> set[str]:
    """Extract element ids referenced by a transaction's metadata.

    Falls back to scanning forward/undo command payloads for ``id``
    fields when transaction_metadata is missing or stale.
    """

    ids: set[str] = set()
    meta = undo_row.transaction_metadata
    if isinstance(meta, dict):
        for key in ("changedIds", "elementPatchIds", "removedIds"):
            value = meta.get(key)
            if isinstance(value, list):
                ids.update(str(item) for item in value if item)
    if ids:
        return ids
    for bag in (undo_row.forward_commands or [], undo_row.undo_commands or []):
        if not isinstance(bag, list):
            continue
        for cmd in bag:
            if isinstance(cmd, dict):
                value = cmd.get("id")
                if value:
                    ids.add(str(value))
    return ids


@time_travel_router.get("/models/{model_id}/elements/{element_id}/history")
async def element_history(
    model_id: UUID,
    element_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> dict[str, Any]:
    """Every undo-stack transaction touching the element, newest first.

    Joined with the owning commit when one is attached.
    """

    await _require_model(session, model_id)

    stmt = (
        select(UndoStackRecord)
        .where(UndoStackRecord.model_id == model_id)
        .order_by(desc(UndoStackRecord.id))
        .limit(2000)  # scan up to 2000 most-recent; refine by content below
    )
    res = await session.execute(stmt)
    candidates = list(res.scalars())

    matches: list[UndoStackRecord] = [
        row for row in candidates if element_id in _undo_touched_ids(row)
    ]
    matches = matches[:limit]

    commit_ids = sorted({m.commit_id for m in matches if m.commit_id})
    commits_by_id: dict[str, ModelCommitRecord] = {}
    if commit_ids:
        c_stmt = select(ModelCommitRecord).where(ModelCommitRecord.commit_id.in_(commit_ids))
        c_res = await session.execute(c_stmt)
        commits_by_id = {c.commit_id: c for c in c_res.scalars()}

    items = []
    for row in matches:
        commit = commits_by_id.get(row.commit_id) if row.commit_id else None
        items.append(
            {
                "undoId": row.id,
                "revisionAfter": row.revision_after,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
                "userId": row.user_id,
                "commitId": row.commit_id,
                "commit": _commit_to_wire(commit) if commit is not None else None,
                "transactionMetadata": row.transaction_metadata,
            }
        )

    return {
        "modelId": str(model_id),
        "elementId": element_id,
        "items": items,
    }
