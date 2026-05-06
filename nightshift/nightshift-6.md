# Nightshift Agent 6 — CLI completions, validation, room enclosure

You are **Agent 6** of seven parallel AI engineers. Your theme is **CLI completions** (`bim-ai export json`, `bim-ai diff`) and **validation depth** (topological room enclosure). You own branch `nightshift-6`. The user is asleep. Do not stop until your assigned WPs are done — then keep going on Wave-0 work.

---

## 0. Pre-flight (identical across all agents)

### Repo

`/Users/jhoetter/repos/bim-ai`. Read `spec/workpackage-master-tracker.md` (~1370 lines) end-to-end before starting.

### Six other agents are working in parallel

Branches `nightshift-1` … `nightshift-5`, `nightshift-7`. Expect merge conflicts on `spec/workpackage-master-tracker.md` and (less so for you) `packages/core/src/index.ts`. Resolve and continue.

### Quality gates

1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run` (in package(s) you touched)
3. `cd app && .venv/bin/pytest -q --no-cov tests/<files-you-touched>`
4. `make verify` before merging to main

Never `--no-verify`. Never delete failing tests. Fix root causes.

### Branch + merge protocol per WP

```bash
git add -A
git commit -m "feat(<scope>): <WP-ID> — <one-line summary>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin nightshift-6

git fetch origin
git rebase origin/main
git push origin nightshift-6 --force-with-lease

git checkout main
git pull origin main
git merge nightshift-6 --ff-only
git push origin main
# if push fails, pull + retry from "git checkout main"

git checkout nightshift-6
```

Never force-push to main. `--force-with-lease` only on your own branch. If `--ff-only` fails 5 times, document `merge-blocked` and continue.

### Tracker update protocol

After each WP lands on main: change row's `State` to `done`, add `done in <commit-hash>`. Commit separately as `chore(tracker): mark <WP-ID> done`. Push, rebase, ff-merge.

### Anti-laziness directive

**Done means:** code written, tests added, all four gates pass, branch merged to main, tracker updated, commit visible on `origin/main`.

- After each WP, immediately start the next. No celebration, no summary, no pause.
- Bigger-than-expected WPs: finish them.
- After all assigned WPs, **do not stop**. Pick a Wave-0 WP, claim with `partial — in flight nightshift-6`, keep going.

### End-of-shift summary

Append `nightshift/nightshift-6-status.md` with shipped WPs (commits), blocked WPs, observations, total commits. Then stop.

---

## 1. Your assigned workpackages

Three WPs in this order (smallest first to build velocity).

### 1.1 — CLI-01: `bim-ai export json`

**Tracker entry:** `spec/workpackage-master-tracker.md` → "CLI / agent loop" → CLI-01.

**Why it matters.** Stub at `packages/cli/cli.mjs:404`; `ifc / gltf / glb` are already shipped. Agents that consume the CLI as a tool need a canonical command-bundle JSON output.

**Concrete scope:**

1. In `packages/cli/cli.mjs`, replace the stub for `cmd === 'export' && kind === 'json'`:
   - `bim-ai export json` (no out path) prints to stdout; `--out <path>` writes to file
   - Output is a JSON document containing the model's full snapshot (every element keyed by id), the model revision, and a human-readable header comment (in JSON: `_format` and `_revision` fields)
   - Use the existing `/api/models/:id/snapshot` endpoint (already wired) — just route through it
   - Optionally include `--bundle` flag that emits a deterministic command-bundle reproducing the model from empty (uses the existing `apply-bundle` machinery in reverse — verify if such an endpoint exists, e.g. `/api/models/:id/command-bundle` or similar; if not, just emit snapshot)

2. Update CLI `--help` text in the usage block (line ~404 of cli.mjs) — remove "reserved (stub)" annotation.

3. Tests: extend `app/tests/test_cli_*` (find via grep) or add `app/tests/test_cli_export_json.py`:
   - Run `bim-ai export json` against a known model fixture, assert output is valid JSON with expected fields
   - Run with `--out` and verify file is written

**Acceptance.** `bim-ai export json` with `BIM_AI_MODEL_ID` set prints valid JSON snapshot to stdout. With `--out foo.json`, writes to file.

**Files:** `packages/cli/cli.mjs`, plus a CLI test file.

**Estimated time:** 1 hour.

---

### 1.2 — VAL-01: Topological room enclosure (wall-graph closure)

**Tracker entry:** `spec/workpackage-master-tracker.md` → "Validation" → VAL-01.

**Why it matters.** Today the `room_no_door` constraint is a centroid heuristic — it checks whether a door's centerpoint is "near" the room polygon. This catches some bad cases but misses others (e.g. a room with no enclosing walls at all but some doors floating nearby still passes). A proper **wall-graph closure** check verifies that the room's boundary polygon is enclosed by a continuous chain of walls + room separation lines.

**Concrete scope:**

1. New constraint rule `room_unenclosed` (severity `warning`, distinct from `room_no_door`).

2. Algorithm:
   - For each `room`, take its `outlineMm` polygon
   - Build a wall-graph: nodes are wall endpoints (with tolerance for snapping near-coincident points), edges are walls + `room_separation` lines on the same level
   - For each polygon edge, check whether there's a continuous path of wall-graph edges that follows the polygon edge within tolerance (e.g. a buffer of half the wall thickness). Use a sweep / BFS approach — don't be quadratic
   - If any polygon edge lacks coverage, the room is "unenclosed"; emit `room_unenclosed` advisory listing the room id + the edges that aren't covered

3. Integrate into `app/bim_ai/constraints.py` alongside the existing rules.

4. Performance: must be tractable for models with up to 200 walls + 50 rooms. Aim for O((W + R) log W) where W = walls, R = rooms.

5. Tests in `app/tests/test_constraints.py` (or a new file):
   - A fully-enclosed room → no `room_unenclosed` advisory
   - A room with one missing wall (gap in the boundary) → `room_unenclosed` advisory
   - A room with `room_separation` lines closing a gap → no advisory (separation lines count)

**Acceptance.** A room missing a closing wall (i.e. the boundary polygon has an edge that doesn't correspond to a wall or separation line) emits a `room_unenclosed` advisory. Fully-enclosed rooms produce no advisory.

**Files:** `app/bim_ai/constraints.py`, `app/tests/test_constraints*.py`.

**Estimated time:** 5 hours. The wall-graph closure check is the meat — get the algorithm right first, then optimise if needed.

---

### 1.3 — CLI-02: `bim-ai diff --from <rev> --to <rev>`

**Tracker entry:** `spec/workpackage-master-tracker.md` → "CLI / agent loop" → CLI-02.

**Why it matters.** Stub at `packages/cli/cli.mjs:372`. Element-level diff between two revisions of the same model. Used for agent self-review and for understanding what changed between commits.

**Concrete scope:**

1. New API endpoint (if not already there): `GET /api/models/:id/diff?fromRev=N&toRev=M` returns an element-level diff:

```ts
{
  fromRevision: number;
  toRevision: number;
  added: Element[];        // elements present at toRev but not fromRev
  removed: Element[];       // elements present at fromRev but not toRev
  modified: {
    id: string;
    kind: ElemKind;
    fieldChanges: { field: string; from: any; to: any }[];
  }[];
  summary: { addedCount, removedCount, modifiedCount, byKind: Record<kind, { added, removed, modified }> };
}
```

Implementation: load both snapshots, walk the element id-set union, classify each id, deep-equal field-by-field for modified rows. Determine if an existing snapshot-by-revision endpoint exists — if not, you may need to add `/api/models/:id/snapshot?revision=N`. Check first via grep.

2. CLI: replace the stub `cmdDiff` in `cli.mjs:372`. Args: `--from <rev>` and `--to <rev>` (both optional; default `--to` to latest, `--from` to `to-1`). Optional `--out <path>`. Optional `--summary-only` for just the summary block.

3. Output format: pretty JSON by default; `--text` for human-readable diff (one line per add/remove/modify with field details).

4. Tests:
   - pytest for the API endpoint with fixture revisions
   - vitest / shell test for the CLI invocation

**Acceptance.**
- `bim-ai diff --from 3 --to 5` prints a JSON diff between revs 3 and 5 of the current model.
- `bim-ai diff --summary-only` prints only counts.
- `bim-ai diff --text` prints a human-readable diff.

**Files:** `packages/cli/cli.mjs`, `app/bim_ai/routes_*.py` (new endpoint or extension), possibly a new `app/bim_ai/diff_engine.py`, plus tests.

**Estimated time:** 5 hours.

---

## 2. File ownership and conflict avoidance

You own:
- `packages/cli/cli.mjs` (export json + diff subcommands)
- `app/bim_ai/diff_engine.py` (new)
- New routes file additions for diff endpoint
- Validation rule code in `app/bim_ai/constraints.py` for `room_unenclosed`
- New test files

Shared territory:
- `app/bim_ai/constraints.py` — append your new rule; don't touch existing rules unless fixing a clear bug
- `app/bim_ai/routes_*.py` — append diff endpoint
- `packages/cli/cli.mjs` — Agent 4 may touch this for `--template` flag; be careful with the usage-block formatting
- `spec/workpackage-master-tracker.md` — only your three rows

Avoid:
- `packages/core/src/index.ts` (other agents — minimal need for you anyway)
- `packages/web/src/*` (not your area)
- `app/bim_ai/elements.py` (other agents)
- `app/bim_ai/engine.py` (other agents — you only read snapshots, don't add commands)
- `app/bim_ai/export_ifc.py` (Agent 1)

If an Edit fails because surrounding code changed, `git pull --rebase origin main`, re-read, redo.

---

## 3. Go

Read `spec/workpackage-master-tracker.md` end-to-end. Then start WP 1.1 (CLI-01 export json — quick warmup), then VAL-01 (substantial), then CLI-02 (substantial). Don't pause until "End-of-shift summary".
