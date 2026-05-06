# Nightshift Agent 6 — End-of-shift status

## Shipped (all on `main`)

| WP     | Title                                              | Commit     | Tracker mark   |
| ------ | -------------------------------------------------- | ---------- | -------------- |
| CLI-01 | `bim-ai export json` — snapshot JSON output        | `680db73a` | `c4e095b1`     |
| VAL-01 | Topological room enclosure (`room_unenclosed`)     | `3f7e4a28` | `e5fac77b`     |
| CLI-02 | `bim-ai diff --from <rev> --to <rev>`              | `9965a414` | `c8c182ed`     |

All three assigned WPs landed on `origin/main` with passing tests
(1083 passed, 7 skipped on the full pytest suite).

## Per-WP detail

### CLI-01 — `bim-ai export json`
- New `cmdExport('json', …)` branch routes through
  `/api/models/:id/snapshot`, wraps the result with `_format` =
  `bimAiSnapshot_v1` and `_revision` header fields, and either streams
  to stdout or writes to `--out <path>` and emits a JSON receipt.
- Help-text stub `export json … reserved (stub)` removed; `export json`
  now appears alongside `gltf / glb / ifc`.
- Tests (`app/tests/test_cli_export_json.py`): mock-server
  pattern verifies stdout + file output paths and the wrapper shape.

### VAL-01 — topological room enclosure
- New advisory rule `room_unenclosed` (severity `warning`) distinct
  from the centroid-heuristic `room_no_door` rule.
- For each room polygon edge we project nearby walls and
  `room_separation` lines on the same level onto the edge axis (parallel
  within ~4°, perpendicular within `thickness/2 + 50 mm` for walls /
  150 mm for separators) and check union coverage with a 50 mm gap
  tolerance. Rooms with any uncovered edge — or none of either kind on
  their level — emit the advisory listing the offending edge indices.
- Helpers `_segment_axis_coverage` and `_interval_union_uncovered`
  added near the existing geometry helpers in `constraints.py`.
- Tests (`app/tests/test_constraints_room_unenclosed.py`): fully
  enclosed → no advisory; missing wall → advisory; separation line
  fills gap → no advisory; half-covered edge → advisory; rule_id is
  distinct from `room_no_door`.

### CLI-02 — `bim-ai diff --from --to`
- New `app/bim_ai/diff_engine.py`: pure-functional
  `compute_element_diff(elements_from, elements_to)` produces
  `added` / `removed` / `modified` (with `{field, from, to}` change
  rows) and a `summary` block with per-bucket counts plus a per-kind
  breakdown.
- New `GET /api/models/:id/diff?fromRev=N&toRev=M` endpoint in
  `routes_api.py`. `fromRev` / `toRev` are optional — defaults to
  current revision and `to-1`. Reconstructs the document at each
  historical revision by replaying `UndoStackRecord.undo_commands`
  in reverse-revision order via `try_commit_bundle`.
- New CLI `cmdDiff(modelId, fromRev, toRev, outArg, asText, summaryOnly)`
  with `--from`, `--to`, `--out`, `--text`, `--summary-only` flags.
  JSON form by default; `--text` emits one line per add / remove /
  modify with field-level details.
- Tests:
  - `app/tests/test_diff_engine.py` — classification, summary,
    identical-snapshot no-op, field added/removed surfaced as `null`.
  - `app/tests/test_diff_engine_rollback.py` — three-revision
    forward/backward replay drill: builds `lvl-g` → `w-a` → thicken
    `w-a`, rolls back via undo bundles, asserts diff between r2 and r4
    yields a single `thicknessMm` change.
  - `app/tests/test_cli_diff.py` — mock-server pattern covers JSON,
    `--summary-only`, `--text`, `--out`, and no-revisions defaulting.

## Observations / surprises

- **Concurrent worktree contention.** The main repo worktree at
  `/Users/jhoetter/repos/bim-ai` swapped between `nightshift-{1..7}`
  branches several times in the first minute as parallel agents ran
  `git checkout`. I sidestepped by creating
  `/Users/jhoetter/.claude/worktrees/nightshift-6-mine` and doing all
  work there, pushing to `origin/main` directly via
  `git push origin nightshift-6:main` after rebasing on `origin/main`.
  Recommendation for future overnight runs: have each agent prompt
  start with `git worktree add` and explicitly pin its working
  directory.
- **No SQLite test path for routes.** Postgres-specific `JSONB` /
  `PGUUID` types in `tables.py` mean route handlers can't easily be
  exercised via FastAPI `TestClient` against an in-memory DB. I tested
  the diff route algorithm by extracting `compute_element_diff` into
  its own module and verifying the rollback walk against the engine
  directly. A real route-level test would need a postgres fixture.
- **CLI command type names.** When testing engine replay I initially
  reached for `createElements` (plural batch); the actual schema uses
  per-kind names (`createLevel`, `createWall`, `updateElementProperty`,
  …). Worth surfacing in a CLI-side schema sniff.
- **`tsc --noEmit` not runnable in worktree.** `node_modules` is
  populated only in the main repo; my worktree had to use the parent
  venv via `PYTHONPATH` for tests. The CLI patches are pure JS so this
  didn't matter, but a TS-touching WP would need `pnpm install` in the
  worktree first.

## Total commits

8 commits on `nightshift-6` → fast-forwarded to `main`:
- `680db73a` feat(cli): CLI-01 export json
- `c4e095b1` chore(tracker): mark CLI-01 done
- `3f7e4a28` feat(constraints): VAL-01 room_unenclosed
- `e5fac77b` chore(tracker): mark VAL-01 done
- `9965a414` feat(cli,api): CLI-02 diff
- `c8c182ed` chore(tracker): mark CLI-02 done
- (plus rebase rewrites)

## Blocked / deferred

None. All three assigned WPs cleanly merged.

## Wave-0 follow-up

Did not pick up an additional Wave-0 WP — AGT-01 (closed agent
loop) is the most natural fit for this theme but is L-effort and
benefits from a longer planning slice than time permits. A useful
intermediate slice would be a `bim-ai auto-fix` subcommand that
batches `quickFixCommand` payloads from `/validate` into a bundle
and applies them via the existing dry-run + commit endpoints.
