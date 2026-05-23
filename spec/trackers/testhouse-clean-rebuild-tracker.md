# Testhouse Clean-Rebuild Tracker

Last updated: 2026-05-23

Status: **Not started. Supersedes the iter-1..iter-19 sequence captured in
[`testhouse-visual-fidelity-tracker.md`](./testhouse-visual-fidelity-tracker.md).**
The prior runs produced models that are no longer acceptable as a baseline.
This tracker drives a clean re-author of all three testhouses from iter-0,
using the methodology learned through iter-19, and produces a model history
that the time-travel + inspector stack can actually navigate.

## Purpose

Rebuild `house-alpha`, `house-beta`, `house-gamma` from scratch, with three
hard requirements the prior iter-1..iter-19 sequence did not meet:

1. **Every iteration is a real time-travel commit.** Each iteration's MCP
   authoring must run inside `commit_context()` (`app/bim_ai/versioning.py`)
   with an `agent_context.testhouse_iter` block. The end result is that the
   inspector can render iter-3's model state in the browser while you are
   inspecting iter-5 — see
   [`model-time-travel-tracker.md`](./model-time-travel-tracker.md) Wave 4.
2. **Every iteration emits structured logs.** Use `_io.log.get_logger(...)`
   (already exists via BRT-60/61/62) with one start + one end record per
   iteration phase, plus phase-level events. No `print()` in iter scripts.
3. **No more one-off `scripts/testhouse_iterN_*.py` apply scripts.** Iteration
   work goes through the `claude-skills/hybrid-reverse-bim/` methodology and
   the MCP slice executor (`routes/hybrid_reverse_bim_execute.py`). The old
   scripts bypassed the commit + log surface, which is why the prior runs
   are invisible to the time-travel stack.

## What to preserve, what to delete

### Preserve
- `testhouses/house-{alpha,beta,gamma}/source/` — source PDFs, never touched.
- `claude-skills/hybrid-reverse-bim/` — methodology of record.
- `spec/trackers/testhouse-visual-fidelity-tracker.md` — historical reference;
  the "Known carryover" section captures the bug list we are paying down.
- `spec/trackers/testhouse-hybrid-reverse-bim-tracker.md` — execution-log
  format and the iteration-2 unblocker findings (TH-X-F006..F010).
- All `app/bim_ai/reverse_bim/` and `app/bim_ai/services/` infrastructure.
- DB schema (`bim_models`, `bim_undo_stack`, `bim_model_commits`,
  `bim_model_snapshots`).

### Delete (first commit of this work)
- `bim_models` rows for `house-alpha`, `house-beta`, `house-gamma`
  (cascade through `bim_undo_stack`, `bim_model_commits`,
  `bim_model_snapshots`, element rows). Use a one-shot script under
  `scripts/testhouse_purge.py` — keep it; the coordinator may need to
  re-run it on a follow-up rebuild.
- `tmp/reverse-bim/house-{alpha,beta,gamma}/` — all runtime state.
- `tmp/reverse-bim/iter-*` — captures, scoring, apply JSON, prompts,
  visual-diffs, handoff docs.
- `tmp/reverse-bim/convergence-state.json`.

### Archive (don't delete, move out of `scripts/`)
- `scripts/testhouse_iter*.py` → `scripts/archive/testhouse_iter*.py`.
  These are historical artifacts from before the methodology+MCP path
  existed. Keep them readable but out of the live tree.

## Iteration sequence

The order is small-house-first so we learn before authoring the larger ones.

| Iter | Houses | Phase | Done-criteria |
|------|--------|-------|---------------|
| 0    | alpha + beta + gamma | Source render @ 240 DPI + page classification + reader-pass plan | All three houses have a `tmp/reverse-bim/<house>/preflight/` with rendered pages + page-class labels |
| 1    | alpha + beta + gamma | Reader-pass: extract numeric coordinate facts | `understanding/existing-building-ir.json` exists per house with at least exterior wall coordinates as numbers (no `"~9.5 m x 8.0 m"`-style prose) |
| 2    | alpha + beta + gamma | Scope decisions + iteration-2 unblockers | Decisions match `testhouse-hybrid-reverse-bim-tracker.md` for building scope; alpha + beta scopes resolved, gamma at `target_half` |
| 3    | alpha (smallest) | First MCP slice authoring — exterior walls + floors + main roof | iter-3 commit exists; subagent grade ≥ 4/10 exterior |
| 4    | beta  | Same surface | iter-4 commit; ≥ 4/10 exterior |
| 5    | gamma | Same surface | iter-5 commit; ≥ 4/10 exterior |
| 6    | all   | Openings (windows + doors) on placed walls | one commit per house; ≥ 5/10 exterior per house |
| 7    | all   | Rooms + interior partitions | one commit per house; ≥ 5/10 interior per house |
| 8    | all   | Dormers, stairs, terrain materials | one commit per house |
| 9    | all   | Visual review + corrector subagent + apply loop | ≥ 6/10 exterior AND ≥ 5/10 interior per house |
| 10+  | as needed | Convergence loop until stop criterion | **Stop criterion**: ≥ 7/10 exterior AND ≥ 6/10 interior per house, AND every iteration since the previous stop check has a non-null commit_id |

Convergence loop is identical to iter-15+ from the prior runs — the
methodology pivot to inside-out + the typology rewrites are already in
the skill. We re-run them on a clean slate, not from memory.

## Commit-attribution contract (the time-travel hard requirement)

Every MCP slice that lands during an iteration MUST be wrapped in:

```python
async with commit_context(
    session=session,
    model_id=model_id,
    agent_context={
        "testhouse_iter": {
            "house": "alpha",            # one of: alpha | beta | gamma
            "iter": 3,                   # monotonic integer
            "phase": "exterior-walls",   # short slug
        },
        "tool": "hybrid-reverse-bim",
        "controlling_tracker": "spec/trackers/testhouse-clean-rebuild-tracker.md",
    },
) as ctx:
    ...
```

This is the only fact the iter-picker UI in
[`agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md)
needs to map "iter 3 of alpha" → `commit_id`. Without this attribution
the user cannot render iter-3's state in the browser while inspecting
iter-5, and this tracker is **not done** regardless of visual scores.

## Logging contract

Every iteration emits, at minimum:

- `testhouse_iter.start` with `{house, iter, phase, source_root, model_id}`
- `testhouse_iter.commit_opened` with `{house, iter, phase, commit_id}`
- `testhouse_iter.commit_closed` with `{house, iter, phase, commit_id, revision_after}`
- `testhouse_iter.end` with `{house, iter, phase, status: ok|failed, elapsed_ms}`

Logger name: `bim_ai.testhouse_iter`. Use the existing `_io.log.get_logger`
helper. Correlation ID is minted by `correlation_id_middleware`
(BRT-62) on the HTTP entry; if the iter is driven from a script, mint one
explicitly.

## Coordination with other parallel agents

This agent **owns**:
- `scripts/testhouse_*.py` (only those created from this point forward)
- `scripts/archive/testhouse_iter*.py` (the move target for the old scripts)
- `tmp/reverse-bim/` cleanup
- `testhouses/house-*/source/` — read-only, do not modify
- `claude-skills/hybrid-reverse-bim/` — only methodology updates that
  fall out of this run; flag big edits to the coordinator first
- This tracker file

This agent **does NOT touch**:
- `app/bim_ai/versioning.py`, `app/bim_ai/routes/time_travel.py`,
  `app/bim_ai/routes/agent_runs.py`, `app/bim_ai/agent_run_parser.py`
  (time-travel + inspector agent owns)
- `packages/web/` (time-travel + inspector agent owns the viewer +
  inspector UI; perf agent owns state/plan/viewport modules)
- `spec/trackers/model-time-travel-tracker.md`,
  `spec/trackers/agent-run-inspector-tracker.md`,
  `spec/trackers/performance-quality-tracker.md` (other agents own these)
- `app/bim_ai/main.py` route registration block (time-travel agent owns)

## Definition of Done

This tracker is complete when:

- All three testhouse models exist as fresh `bim_models` rows with
  `created_at` after the start of this rebuild.
- Subagent grading at the most recent iter ≥ 7/10 exterior AND ≥ 6/10
  interior for all three houses.
- `SELECT count(*) FROM bim_model_commits WHERE agent_context->'testhouse_iter'->>'house' = 'alpha'`
  returns ≥ one commit per iteration that ran on alpha; same for beta + gamma.
- Every `bim_model_commits` row created during this rebuild has a non-null
  `agent_context.testhouse_iter` block.
- `bim_ai.testhouse_iter` log channel has start/end records for every
  iteration that ran (verify by tailing whatever sink the app is wired to).
- The inspector iter-picker (`agent-run-inspector-tracker.md` Wave 2
  extension) successfully checks out iter-3 state in the live Workspace
  viewer when invoked from iter-5's dashboard.

## Related trackers

- [`testhouse-visual-fidelity-tracker.md`](./testhouse-visual-fidelity-tracker.md) — historical record of iter-1..iter-19 (superseded by this tracker)
- [`testhouse-hybrid-reverse-bim-tracker.md`](./testhouse-hybrid-reverse-bim-tracker.md) — per-house execution log format and iter-2 unblocker findings
- [`model-time-travel-tracker.md`](./model-time-travel-tracker.md) — Wave 4 (this tracker is the integration test for Wave 4)
- [`agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md) — iter-picker UI consumer
- [`claude-skills/hybrid-reverse-bim/SKILL.md`](../../claude-skills/hybrid-reverse-bim/SKILL.md) — methodology of record
