# Model Time-Travel Tracker

Last updated: 2026-05-23

Status: **Spec resolved; Wave 1 implementation starting.** Prerequisite
for [`agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md).
Defines git-like time travel for BIM models — commits with agent context,
snapshots at logical boundaries, checkout/diff/log API, and retroactive
coverage of past iterations by replaying the existing undo stack. All 11
open questions resolved 2026-05-23 (see
[Resolved Decisions](#resolved-decisions)); Wave 1 schema work begins.

## Purpose

Give every BIM model a navigable history so the inspector (and any future
auditing/replay surface) can:

- list commits in chronological order, with agent context for each;
- checkout the model state at any prior commit, including past iterations;
- diff any two commits (added / modified / removed elements, by kind);
- per-element: enumerate the history of changes that produced it;
- render past states in the live viewer, not only via the per-iteration
  screenshot captures under `tmp/reverse-bim/iter-N-captures/`.

This is the substrate that makes "watch the rendering of the house in each
iteration" a real, interactive capability rather than a slideshow.

## Why Now

- The inspector tracker
  ([`agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md))
  promises a per-model methodology dashboard with phase status, fact-ledger
  stats, and iteration captures. To extend "see the captures" into "checkout
  iter-7's actual model and walk through it", we need historical state in
  the database, not only on disk.
- Iterations are accumulating quickly (alpha/beta/gamma × 14+ iters, more to
  come). Each iteration today is irreversible — the live model overwrites
  whatever it had before. Without time travel we cannot answer "what did
  iter-9 produce that iter-10 lost?".
- We already have the raw event log (`bim_undo_stack`). Leaving it
  un-mined means the cheapest version of this feature is also the version
  we are currently failing to ship.

## What "Time Travel" Means Here

Borrowed from git, narrowed for this domain:

- **Commit:** an immutable named point in a model's history with agent
  context (sessionId, methodology phase, iteration label, summary, parent
  commit). Conceptually equivalent to a git commit.
- **Snapshot:** a stored full `document` JSONB at a commit boundary.
  Conceptually equivalent to a git tree blob — but materialized eagerly
  rather than reconstructed from the delta chain.
- **Delta:** a sequence of `forward_commands` recorded in `bim_undo_stack`
  between two commits. Conceptually equivalent to a git diff between two
  trees, except we already have the forward and reverse operations
  pre-computed.
- **Checkout:** materialize the `document` state at a given commit. Two
  paths: load nearest snapshot, optionally replay forward to the target.
- **Log:** ordered list of commits for a model with parent pointers.
- **Diff:** structural delta between two commits' documents, by element
  kind and field.

We do **not** import git's mutable concepts:

- No working tree separate from HEAD (the live model is HEAD; checkout to a
  prior commit is read-only).
- No staging area.
- No rebase, cherry-pick, or merge in v1.
- No branches in v1 (the schema supports a `parent_commit_id` and admits
  branching later, but the API and UI are linear-history-only).

## What We Already Have

The system is closer to event-sourced than the file naming suggests. From
`app/bim_ai/tables.py`:

| Table             | Relevant fields                                                                                              | Role                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `bim_models`      | `id` (uuid), `revision` (int), `document` (jsonb)                                                            | Head state of each model.                    |
| `bim_undo_stack`  | `id`, `model_id`, `user_id`, `revision_after`, `forward_commands`, `undo_commands`, `transaction_metadata`, `created_at` | Per-transaction event log with both directions. |
| `bim_redo_stack`  | similar to undo                                                                                              | Redo log after explicit undo.                |

Properties of this existing infrastructure:

- **Every mutation already produces a recorded transaction** with both
  `forward_commands` and `undo_commands` (so replay is deterministic in
  both directions).
- **`revision` is monotonic per model** and `revision_after` on each undo
  record names the resulting head revision.
- **`transaction_metadata` is JSONB and free-form** — we can attach commit
  metadata without touching schema.
- **No historical `document` snapshots are kept today** — only the head
  document plus the delta chain. Checkout therefore requires either replay
  or a new snapshot store.
- **No commit grouping today** — every transaction is its own atomic
  event. A logical "commit" (e.g., the EG slice or iter-9 as a whole) is a
  range of transactions; the start/end markers are not recorded.

## What Is Missing

The gap between "we have an event log" and "we have git-like time travel":

1. **Commit metadata.** No first-class record of "iter-9 EG slice ran here,
   produced revisions 312–337, authored by session X under methodology
   version Y, with this summary." The undo stack has per-transaction
   timestamps but no grouping.
2. **Snapshots.** Checkout currently requires replaying every transaction
   from revision 1, which scales linearly with model age. We need
   periodic full-document snapshots at named commit boundaries.
3. **Parent linkage.** Revisions are integers; commits are not yet
   first-class objects that point to a parent. Required for the log view
   and for any future branching.
4. **Read API.** No endpoint to enumerate commits, checkout state at a
   commit, or diff two commits.
5. **Retroactive coverage.** Past iterations have no commit boundaries;
   their state must be reconstructed by mining `bim_undo_stack` and
   correlating with Claude Code session JSONLs.
6. **Concurrent-write protection at the commit level.** The undo stack
   serializes individual transactions; nothing prevents two agents from
   interleaving transactions within what they each think is "their"
   commit.

## Non-Goals

- **Branching workflow.** Schema supports it; v1 has no API or UI for
  branching, merging, or detaching. Linear history per model.
- **Cross-model history.** A commit belongs to one model. Snapshots
  across models for project-wide rollback are out of scope.
- **Edits while time-travelled.** A checkout returns a read-only view. To
  edit, the user must explicitly create a new commit from HEAD; we do not
  support "edit at past state then rebase".
- **IFC export at a past commit.** Possible long-term but not v1.
- **Garbage collection of old snapshots.** v1 keeps everything; pruning
  policy is a v2 concern.
- **Replacement of the existing undo/redo UX.** Undo/redo stays as the
  per-transaction stack. Commits are a higher-level grouping layered on
  top.

## Core Decision

Layer commits and snapshots **on top of** the existing undo stack rather
than replacing it. Specifically:

1. Keep `bim_undo_stack` as the canonical event log. Every mutation
   continues to write one undo record.
2. Add a `bim_model_commits` table that groups one or more consecutive
   undo records into a named commit with agent context.
3. Add a `bim_model_snapshots` table that stores the full `document` JSONB
   at selected commit boundaries (every commit by default in v1 —
   adjustable later if storage becomes a concern).
4. Add a `commit_id` foreign key on `bim_undo_stack` so each transaction
   belongs to exactly one commit (or to `null` if it predates the
   migration; the backfill resolves that).
5. Keep `bim_models.document` as the head. Checkout materializes a
   commit's snapshot into a transient response payload; it does not
   mutate `bim_models`.

This is additive: existing routes that mutate state continue to work; they
only need to participate in commit lifecycle to gain commit-level
attribution. Routes that ignore commits will still record transactions —
they just won't get commit metadata until they are migrated.

## Data Model

### New: `bim_model_commits`

```python
class ModelCommitRecord(Base):
    __tablename__ = "bim_model_commits"

    # 26-char ULID, monotonic, generated server-side. Hex digest of the
    # commit's content is *not* used because we want chronological sort
    # and human-readable copy/paste.
    commit_id: Mapped[str] = mapped_column(String(26), primary_key=True)

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bim_models.id"), index=True, nullable=False
    )

    parent_commit_id: Mapped[str | None] = mapped_column(
        ForeignKey("bim_model_commits.commit_id"), nullable=True, index=True
    )

    # Inclusive bounds (resolved from bim_undo_stack).
    first_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    last_revision: Mapped[int] = mapped_column(Integer, nullable=False)

    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="open"
    )  # one of: open, closed, aborted

    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Free-form context bag. Conventional fields used by the inspector:
    #   sessionId, agentId, methodologyVersion, iterationLabel,
    #   phaseId, sliceId, runId, source, toolCallIds (list[int]).
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Quick lookup of the matching snapshot if one was taken.
    snapshot_id: Mapped[int | None] = mapped_column(
        ForeignKey("bim_model_snapshots.id"), nullable=True
    )
```

Indexes: `(model_id, created_at desc)` for log queries;
`(model_id, last_revision)` for fast "commit containing revision N"
lookups; `(parent_commit_id)` for traversal.

### New: `bim_model_snapshots`

```python
class ModelSnapshotRecord(Base):
    __tablename__ = "bim_model_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bim_models.id"), index=True, nullable=False
    )
    commit_id: Mapped[str] = mapped_column(
        ForeignKey("bim_model_commits.commit_id"), nullable=False, unique=True
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)

    document: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # SHA-256 over canonical_transaction_digest()-style serialization:
    # json.dumps(document, sort_keys=True, separators=(",", ":")).
    document_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    document_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Soft index of what's in the doc; useful for the dashboard without
    # decompressing JSONB.
    element_counts: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
```

Indexes: `(model_id, revision)` for nearest-snapshot search;
`(document_sha256)` for content-addressed dedup (Wave 2 — two consecutive
no-op commits should not double the storage).

### Enriched: `bim_undo_stack`

```python
# Add — nullable so existing rows do not need backfill before the table
# can ship.
commit_id: Mapped[str | None] = mapped_column(
    ForeignKey("bim_model_commits.commit_id"), index=True, nullable=True
)
```

The migration's `init_db_schema` extension (mirrors the existing pattern
in `app/bim_ai/db.py`):

```python
await conn.execute(
    text(
        "ALTER TABLE bim_undo_stack "
        "ADD COLUMN IF NOT EXISTS commit_id VARCHAR(26) "
        "REFERENCES bim_model_commits(commit_id)"
    )
)
```

### Optional v2: `bim_model_branches`

Not built in v1. Stub recorded here so the schema can grow:

```python
class ModelBranchRecord(Base):
    __tablename__ = "bim_model_branches"
    model_id: Mapped[uuid.UUID] = mapped_column(...)
    name: Mapped[str] = mapped_column(String(64), ...)
    head_commit_id: Mapped[str] = mapped_column(...)
    # composite primary key (model_id, name); 'main' is implicit when absent.
```

## Commit Semantics

### What constitutes a commit

A commit is **a contiguous range of `bim_undo_stack` rows** for a single
model, with shared agent context. The default policy:

| Trigger                                     | Behavior                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Agent opens an explicit commit              | All transactions written while the commit is open are grouped under it.                                               |
| MCP slice begins (`hybrid_slice_execute`)   | Auto-opens a commit named after the slice (e.g., `EG_slice`).                                                          |
| Bare MCP call outside a slice or open commit| Auto-wraps in a single-transaction commit tagged `source=ad_hoc`.                                                      |
| Iteration boundary (`folder_output` run-meta) | Open commits are closed and tagged with `iterationLabel`. A snapshot is taken regardless of size policy.              |
| User-initiated undo/redo                    | A new commit recording the inverse operation. Undo does not delete history; it adds to it. (matches git revert.)      |

### Lifecycle

```text
open commit (commit_id assigned, state='open')
  -> 0..N undo_stack rows written, each with commit_id set
  -> close commit (state='closed', last_revision recorded, snapshot taken)
```

Failure modes:

- Crash mid-commit: a daemon (or on-startup sweep) finds commits with
  `state='open'` and either closes them (if their transactions are intact
  in the undo stack) or marks them `state='aborted'`.
- Abort by agent: explicit `POST /api/models/:id/commits/:c/abort` —
  rolls forward by inserting `undo_commands` in reverse to walk the head
  back to the parent commit's `last_revision`, then closes the aborting
  commit with `state='aborted'`.

### Snapshot policy

v1 takes a snapshot **at every commit close**. Reasoning:

- Iteration cadence is roughly tens of commits per day, not thousands.
- A typical `document` JSONB is currently <5 MB based on observed model
  sizes (alpha/beta/gamma). 100 commits × 5 MB = 500 MB. Tolerable.
- Per-commit snapshots make checkout O(1) — no replay needed.
- Content-addressed dedup by `document_sha256` keeps no-op or
  near-identical commits cheap.

If snapshot storage grows beyond ~10 GB across the project, downgrade to
a sparser policy (e.g., one snapshot per iteration, replay for
intra-iteration commits). This is the only piece of the data model that
plausibly needs revisiting; everything else is bounded.

### Context conventions

`bim_model_commits.context` JSONB SHOULD include:

```json
{
  "sessionId": "claude-code session uuid",
  "agentId": "agent name if dispatched as sub-agent",
  "methodologyVersion": "2026-05-22",
  "commandSchemaVersion": "2026-05-22",
  "iterationLabel": "iter-9",
  "phaseId": "EG | DG | roof | ...",
  "sliceId": "slice id from hybrid_slice_execute",
  "runId": "from run-meta.json if available",
  "source": "mcp_slice | mcp_ad_hoc | retroactive | user_undo | user_redo | iteration_boundary",
  "toolCallIds": [12, 13, 14],
  "factIds": ["fact-...", "fact-..."],
  "outputDir": "tmp/reverse-bim/house-alpha/...",
  "houseName": "alpha",
  "userId": "mirrored from bim_undo_stack.user_id"
}
```

`methodologyVersion` and `commandSchemaVersion` both default to the ISO
date in the `Last updated:` line of the active methodology tracker
(today: `spec/hybrid-reverse-bim-methodology-tracker.md`).

The fields are advisory, not enforced. The inspector treats any missing
field as null and still renders the commit; the dashboard's lineage view
prefers stronger context when present.

## Write Path

### Default path (existing routes unchanged)

A route that calls into the command-execution layer continues to write a
transaction to `bim_undo_stack`. If no commit is open for the model, the
versioning middleware auto-opens a single-transaction commit tagged
`source=mcp_ad_hoc` and closes it immediately. The route does not need to
change.

### Explicit path (new for MCP slice executor)

`reverse_bim.hybrid_slice_execute` opens a commit at the start of the
slice and closes it at the end. The runtime is responsible for:

1. Generating a ULID and inserting a row into `bim_model_commits` with
   `state='open'`, `first_revision = bim_models.revision + 1`,
   `parent_commit_id = current head commit`, and the agent context.
2. Calling existing command paths; every transaction inherits the open
   commit's id via thread/async-context-local storage.
3. On success: setting `state='closed'`, `last_revision = current head`,
   `closed_at = now()`, and taking a snapshot.
4. On failure: writing the inverse commands to walk the head back to
   `first_revision - 1`, setting `state='aborted'`.

### MCP integration points

| MCP tool                                | Commit behavior                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `reverse_bim.hybrid_slice_execute`      | Opens & closes a commit per slice. Tags `phaseId`, `sliceId`, `iterationLabel` (if `outputDir` carries iter info), `toolCallIds`, `factIds`. |
| `reverse_bim.hybrid_run_execute`        | Opens a parent commit per run; each contained slice's commits are children (`parent_commit_id` chain).                                       |
| `reverse_bim.folder_output`             | Writes `run-meta.json` and triggers an iteration-boundary commit close on the head commit, regardless of slice state.                        |
| `author.*` / `opening.*` / `query.*`    | Inherit the open commit if any; otherwise auto-wrap.                                                                                         |
| Existing CRUD routes (non-MCP)          | Auto-wrap as `source=user`. UI calls get attribution via the existing `user_id`.                                                             |

### Atomicity

A single transaction is atomic via `bim_undo_stack`. A commit groups
transactions but does **not** make them atomic at the DB level — partial
commits are visible (the head moves with each transaction). The
`state='open'` flag is the inspector's signal that the commit is
incomplete.

If a slice fails mid-execution, the existing slice executor is
responsible for explicit rollback (insert inverse commands). Time travel
records the rollback as additional transactions inside the same commit,
which is then closed `state='aborted'`. Replay/checkout at the aborted
commit gives the post-rollback state, not the failed mid-state.

### Concurrent writes

v1 invariant: **at most one open commit per model.** Enforced by a unique
partial index:

```sql
CREATE UNIQUE INDEX bim_model_commits_one_open_per_model
  ON bim_model_commits (model_id) WHERE state = 'open';
```

A second writer trying to open a commit gets `409 Conflict`. The MCP
layer is expected to serialize. This is conservative; future versions can
relax this if concurrent agents become a real workflow (with `parent_commit_id`
DAG and merge semantics — out of scope today).

## Read Path

### Checkout

```
GET /api/models/:modelId/state?at=:commitId
GET /api/models/:modelId/state?at=:revision         (alternate: by revision int)
GET /api/models/:modelId/state                      (head; equivalent to existing)
```

Resolution strategy:

1. If `commitId` (or the commit containing `revision`) has a snapshot:
   return `snapshot.document` immediately. O(1) read + O(jsonb size)
   transfer.
2. If no snapshot exists at that commit (sparse-snapshot policy in v2):
   load the nearest prior snapshot, then replay `forward_commands` from
   the undo stack until reaching the target revision. O(delta count).

`State` payload is the raw `bim_models.document` JSONB at that point in
time — schema identical to head, so existing viewer code can render it
unchanged.

### Log

```
GET /api/models/:modelId/commits
  ?limit=50&before=:commitId&phase=:phaseId&iteration=:iter
```

Returns commits in reverse-chronological order with:

- `commit_id`, `parent_commit_id`, `state`, `summary`
- `first_revision`, `last_revision`, `transaction_count`
- `context.{sessionId, methodologyVersion, iterationLabel, phaseId, sliceId, source}`
- `created_at`, `closed_at`
- `element_counts` from the snapshot, if attached
- Light deltas vs. parent: `elements_added`, `elements_modified`,
  `elements_removed` (counts by kind)

### Diff

```
GET /api/models/:modelId/diff?from=:commitA&to=:commitB
```

Two implementations layered:

1. **Cheap diff (cataloged)**: compare `element_counts` and the recorded
   `forward_commands` chain. Useful for log/list views.
2. **Deep diff (per-element)**: load both snapshots and compute the
   structural delta via a typed walker that understands the `document`
   shape (walls, openings, levels, rooms, etc.). Returns per-element
   added/modified/removed with changed-field list.

### Per-element history

```
GET /api/models/:modelId/elements/:elementId/history
```

Walks the undo stack: every transaction whose `forward_commands` (or
`undo_commands`) references `elementId` is included. Returns commit
context + change summary per hit. This is the lineage hook the inspector
consumes for the backward-trace view.

## Retroactive Coverage

Iterations 1–14+ already happened. They left:

- A populated `bim_undo_stack` reaching back to each model's revision 1.
- Claude Code session JSONLs at
  `~/.claude/projects/-home-jhoetter-repos-bim-ai/<sessionId>.jsonl`.
- Per-iteration artifacts at `tmp/reverse-bim/iter-N-{captures,scoring}/`
  and `tmp/reverse-bim/house-<X>/iter-N-*/`.
- The current `bim_models.document` (head).

Retroactive build procedure (one-off script):

1. **Replay the undo stack** for each model from revision 1 forward,
   reconstructing the document at every transaction.
2. **Identify commit boundaries** by joining transaction timestamps to
   Claude Code session windows:
   - sessions with a clear `outputDir` argument map directly to a house;
   - per-session tool-call sequences correlate with consecutive undo
     records by timestamp;
   - `hybrid_slice_execute` calls give slice boundaries;
   - missing context: aggregate into a single per-session `retroactive`
     commit.
3. **Emit synthetic commits** in `bim_model_commits` with
   `source=retroactive` and as much context as can be inferred. Note in
   `context.confidence` how derived each field is.
4. **Snapshot at each retroactive commit boundary.** This is one-off
   storage cost but pays for instant historical checkout.
5. **Cross-check** retroactive snapshot at HEAD's revision against
   `bim_models.document`. They must match byte-for-byte after
   normalization; if not, the replay has a bug.

Retroactive coverage is best-effort for context, exact for state. The
inspector clearly marks retroactive commits and surfaces the inferred-vs-
declared distinction.

## Storage and Performance Budgets

| Quantity                 | v1 budget                                                   | v2 trigger                                                   |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Snapshot frequency       | Every commit                                                | Move to per-iteration if total snapshot storage > 10 GB.     |
| Snapshot size            | < 50 MB typical (model document)                            | Compress with toast/zstd if observed > 100 MB at p95.        |
| Commits per model        | Hundreds to low thousands                                   | Partition `bim_model_commits` by model if > 1M total.        |
| Checkout latency         | < 200 ms when snapshot present                              | Background sparse-snapshot policy if storage forces it.      |
| Diff latency (deep)      | < 1 s for typical models                                    | Cache (from, to) results in a side table if > 5 s.           |
| Log endpoint             | < 100 ms for 50 commits                                     | Cursor pagination already provided; revisit indexes if slow. |
| `bim_undo_stack` growth  | Already production traffic; +`commit_id` column negligible. | --                                                           |

## API Surface

All under `/api/models/:modelId/`.

| Method | Path                                       | Returns                                                                                                                                              |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `commits`                                  | Paged commit log. Filters: `phase`, `iteration`, `before`/`after` cursor.                                                                            |
| GET    | `commits/:commitId`                        | Single commit detail (context, revisions, snapshot summary, parent).                                                                                 |
| POST   | `commits`                                  | Open a commit. Body: `{ summary, context }`. Returns `commit_id` + `state='open'`. Enforces single-open invariant.                                   |
| POST   | `commits/:commitId/close`                  | Close an open commit. Triggers snapshot. Returns final `last_revision` and `snapshot_id`.                                                            |
| POST   | `commits/:commitId/abort`                  | Walk head back to parent's `last_revision`; close with `state='aborted'`.                                                                            |
| GET    | `state`                                    | Current head document. (Existing route; preserved.)                                                                                                  |
| GET    | `state?at=:commitId`                       | Document at the given commit (snapshot or replay).                                                                                                   |
| GET    | `state?at-revision=:revision`              | Same, by revision int. Resolves to the containing commit.                                                                                            |
| GET    | `diff?from=:a&to=:b&depth=cheap\|deep`     | Diff between two commits.                                                                                                                            |
| GET    | `elements/:elementId/history`              | Commits that touched this element.                                                                                                                   |
| GET    | `commits/:commitId/snapshot`               | Raw snapshot row (admin/inspector use).                                                                                                              |

Open-commit semantics: a route is responsible for either closing or
aborting; the daemon sweep is a safety net, not a contract.

## Methodology Integration

| Methodology step                                            | Commit behavior                                                                                                                                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preflight (no model writes)                                 | No commits; only the inspector's session-JSONL view applies.                                                                                                                                               |
| `reverse_bim.folder_output` produces handoff                | No model writes yet; writes `run-meta.json` which the slice executor reads. Stores the inferred `runId`, `methodologyVersion`, `houseName`, `outputDir` to be embedded in subsequent commits' `context`.   |
| MCP slice execution (`hybrid_slice_execute`)                | One commit per slice, with `phaseId`, `sliceId`, `iterationLabel`, `toolCallIds`, `factIds`.                                                                                                               |
| Per-iteration capture pass (`reverse-bim:capture`)          | No model writes; an iteration-boundary commit closure marker can be requested via the API so the inspector aligns captures to commits.                                                                     |
| Inside-out per-level modeling                               | The slice executor's phase ordering is methodology-side; commits inherit whatever order the executor uses. Phase ids in `context` reflect the active methodology.                                          |
| Visual-fidelity rescore (`iter-N-scoring`)                  | No model writes; scoring reports referenced from the commit's `context.scoringReportPath`.                                                                                                                 |

## Inspector Integration (the dependency)

Once this tracker ships, the inspector
([`agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md))
gains:

- A real **time slider** on the per-model dashboard: scrub through
  commits, see the model state and captures from that point in time.
- **Live rendering of past iterations**: the existing viewer loads
  `bim_models.document` to render a model; pointed at a snapshot it
  renders that commit's state. No viewer code changes required beyond
  accepting an optional `?at=:commitId` query param.
- **Per-element backward trace**: the lineage view's "MCP call → model
  element" hop becomes commit-resolvable. Click any element in a
  rendered past state and the inspector jumps to the commit that
  authored it, then continues back to the source page.
- **Diff visualization between iterations**: compare iter-9's accepted
  state to iter-10's regression.
- **Cross-iteration analytics**: count commits per phase, average tool
  calls per slice, blocked-fact rate evolution.

## Schema Migration Plan

Migration is **additive**. No existing row is mutated; no existing route
breaks. Rollout in three steps:

1. **Schema add** — new tables (`bim_model_commits`,
   `bim_model_snapshots`), new nullable column on `bim_undo_stack`,
   unique partial index. Land via `init_db_schema` extension and a
   forward-only Alembic-style script. Reversible by dropping the new
   tables and column.
2. **Write path opt-in** — versioning middleware shipped behind a config
   flag. MCP slice executor adopts first; existing CRUD routes follow.
   Rows without `commit_id` continue to be valid and inspector-visible
   under `Unattributed`.
3. **Retroactive backfill** — one-off script replays each model's undo
   stack, emits synthetic commits + snapshots, cross-checks against
   current head. Safe to re-run; idempotent on `(model_id, first_revision)`.

## Implementation Waves

### Wave 0 — Spec review & open-question resolution (this tracker)

Done when the open questions below are answered and the budgets are
accepted.

### Wave 1 — Schema + write path

- Add tables, column, partial index.
- Versioning middleware (`app/bim_ai/versioning.py`): commit open/close,
  context-local commit_id, snapshot capture on close.
- Wire `hybrid_slice_execute` to open/close commits with full context.
- Wire `folder_output` to emit iteration boundary markers.
- Wire existing CRUD routes to auto-wrap.

### Wave 2 — Retroactive backfill

- One-off script `scripts/backfill_model_commits.py`.
- Per-model: replay undo stack, group by session windows, emit synthetic
  commits + snapshots, cross-check head.
- Cross-link to Claude Code session JSONLs for context.
- Produce a backfill report (one row per model: commit count, replay
  parity check, unattributed transaction count).

### Wave 3 — Read API

- `commits`, `commits/:c`, `state?at=`, `diff?from=&to=`,
  `elements/:e/history`.
- Cheap-diff and deep-diff implementations.
- Single-snapshot vs. snapshot+replay resolver.

### Wave 4 — Inspector integration

- Inspector dashboard consumes `commits` for the time slider.
- Existing model viewer accepts `?at=:commitId`; uses the new state
  endpoint to render past states.
- Lineage view's element history hop uses
  `elements/:e/history`.

### Wave 5 — Operational hardening

- Daemon/sweep for orphaned open commits.
- Storage monitoring + dashboard for snapshot growth.
- Optional sparse-snapshot toggle if budgets are exceeded.

## Required Tests

- **Unit**:
  - Commit open / close / abort happy paths.
  - Single-open-per-model invariant violation returns 409.
  - Snapshot dedup by `document_sha256` returns existing row.
- **Integration**:
  - Live MCP slice → commit lands with correct first/last revision,
    context, and snapshot.
  - Checkout via snapshot returns expected document.
  - Checkout via replay (snapshot deleted) returns the same document.
  - Diff between two commits returns correct add/mod/remove sets.
  - Per-element history surfaces every transaction that touched it.
- **Property tests**:
  - Random mutation sequence: replay from snapshot reconstructs identical
    head as `bim_models.document`.
  - Out-of-order checkout (asking for commit N then commit 1 then commit
    N again) returns identical state each time.
- **Retroactive backfill**:
  - On a fixture model: backfill produces head-parity (snapshot at last
    retroactive commit == current `bim_models.document` modulo
    normalization).
  - Idempotency: re-running backfill changes nothing.
- **Concurrency**:
  - Two writers attempting `commits` (open) simultaneously: exactly one
    succeeds; the other gets 409.
- **API contract**:
  - All endpoints return well-formed responses with documented fields.
  - Pagination cursors round-trip.

## Resolved Decisions

All 11 open questions resolved 2026-05-23 against the codebase audit
(`engine_commit.try_commit_bundle`, `document.Document`,
`transaction_metadata.canonical_transaction_digest`).

1. **`forward_commands` schema stability.** Commands are typed Pydantic
   classes coerced via `coerce_command()` (`engine_commit.py:431`). No
   per-command version stamp today. **Resolution:** add a
   `commandSchemaVersion` field to `bim_model_commits.context` going
   forward (default to the controlling tracker's `Last updated` date,
   per Q10). For retroactive backfill, run each historical command
   through `coerce_command`; log/skip records that fail, and report
   "command-coercion failure rate" in the backfill report.

2. **Document shape consistency.** `bim_models.document` IS schematized
   — `app/bim_ai/document.py:32` defines `Document` as a Pydantic
   model with `revision: int`, `elements: dict[str, Element]`
   discriminated by `kind` (~146 element kinds in `elements*.py`),
   plus `design_option_sets` and `tool_prefs`. **Resolution:** deep-diff
   lifts types directly from the existing `Document` / `Element`
   classes. No new discriminator schema needed.

3. **Per-iteration boundary signal.** **Resolution: option C (both).**
   Going forward: `reverse_bim.folder_output` emits an explicit
   zero-mutation iteration commit when invoked with an `iteration` arg,
   and closes any open commits with the iteration tag. For backfill:
   infer iterations from `outputDir` path patterns
   (`tmp/reverse-bim/{iter-N-…,house-X/iter-N-…}`). The agent change is
   one line; backfill stays cheap.

4. **`user_id` field.** **Resolution:** keep `bim_undo_stack.user_id`
   for backward compatibility. Mirror it into `context.userId`. The
   canonical inspector fields are `context.sessionId`, `context.agentId`,
   and `context.submitter` (the codebase already distinguishes agents
   via `submitter="agent"` and `actor_kind="agent"` in
   `routes_api.py:1458`). No deprecation; no migration of existing
   `user_id` data needed.

5. **Concurrent open commits across models.** **Resolution: confirmed.**
   v1 allows concurrent open commits on different models. Same-model
   serialization is enforced by the partial unique index.

6. **Snapshot for aborted commits.** **Resolution: skip.** Aborted
   commit's post-rollback state equals the parent's state, which
   already has a snapshot. `snapshot_id` stays NULL on aborted commits.
   The inspector renders the abort against the parent snapshot.

7. **`document_sha256` content stability.** `transaction_metadata.py`
   already ships `canonical_transaction_digest()` — `json.dumps(...,
   sort_keys=True, separators=(",", ":"))` then SHA-256.
   **Resolution:** reuse that exact helper for snapshot hashing. The
   Document is content-stable when serialized canonically.

8. **Garbage collection.** **Resolution: defer.** Keep everything in
   v1; revisit only if total snapshot storage exceeds 10 GB across the
   project. Explicit non-goal for v1.

9. **Branches.** **Resolution: schema permissive, API restrictive.**
   `bim_model_commits.parent_commit_id` is NOT uniquely-indexed, so the
   schema permits forks. API in v1 has no surface to create them.

10. **`methodologyVersion` format.** **Resolution: ISO date string of
    the controlling tracker's `Last updated` field** (e.g.,
    `"2026-05-22"`). Stable, sortable, greppable, zero new ceremony
    because every methodology tracker already maintains this line. The
    controlling tracker at the time of commit is
    `spec/hybrid-reverse-bim-methodology-tracker.md` unless a more
    specific phase methodology controls.

11. **Reader-pass attribution.** **Resolution: no commits.** Reader
    passes don't write to `bim_models`; they appear in the inspector's
    session-timeline view only. The commit log is purely model-state
    changes.

## Definition of Done

The tracker is complete when:

- The schema changes are migrated in dev and prod; `init_db_schema`
  produces them on a fresh DB.
- Every new mutation in dev produces a commit with non-null context.
- Retroactive backfill has run for all three testhouse models and
  produced head-parity; the resulting commit logs are visible in the
  inspector.
- The API endpoints (`commits`, `commits/:c`, `state?at=`, `diff`,
  `elements/:e/history`) are documented in the API catalogue and have
  integration tests.
- The model viewer renders a past commit's state when called with
  `?at=:commitId`.
- The inspector dashboard's time slider works end-to-end on alpha,
  beta, gamma.
- Snapshot storage is being monitored; current size is under budget.
- The open questions above are each resolved with either an answer or
  a deferred-to-v2 note.

## Related Trackers

- [`spec/agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md) — the inspector this tracker unblocks.
- [`spec/hybrid-reverse-bim-methodology-tracker.md`](./hybrid-reverse-bim-methodology-tracker.md) — the methodology whose slice boundaries map to commit boundaries.
- [`spec/reverse-bim-folder-output-methodology-tracker.md`](./reverse-bim-folder-output-methodology-tracker.md) — emits `run-meta.json` whose fields populate commit context.
- [`spec/testhouse-visual-fidelity-tracker.md`](./testhouse-visual-fidelity-tracker.md) — iteration captures live alongside commits and are linked from the inspector's dashboard.
- [`spec/testhouse-hybrid-reverse-bim-tracker.md`](./testhouse-hybrid-reverse-bim-tracker.md) — per-house execution log; commits are the structured form of what this tracker records in prose today.
