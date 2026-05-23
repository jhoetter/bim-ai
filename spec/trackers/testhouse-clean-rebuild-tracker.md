# Testhouse Clean-Rebuild Tracker (v2 — inside-out, ≥9/10)

Last updated: 2026-05-23

Status: **v1 iter ladder rejected after iter-3 alpha produced a "vanilla
box" exterior. v2 replaces the outside-in slice order with a per-floor
inside-out loop and raises the per-iter score bar from `≥4/10` to
`≥9/10` (target `10/10`).** See `spec/methodology-audit-2026-05-23.md`
for the five flaws this rewrite addresses.

The v1 iter table (iter-3..N for shell-first, openings-later) is gone.
A v1 commit (`01KSA86DE7T4FMP0A61EZ40P0N`) still exists in the time-travel
log so the inspector iter-picker has historical data to render — it is
not part of the v2 acceptance.

## Purpose

Rebuild `house-alpha`, `house-beta`, `house-gamma` from scratch, with
five hard requirements:

1. **Inside-out per floor.** Each floor goes
   *rooms → partitions → openings → exterior walls* before the next
   floor opens. Authoring follows the source floor plan; exterior walls
   are derived from the room outlines, never authored independently.
2. **Per-floor visual + structural gate.** Each floor commits, runs the
   structural battery (advisor + constructability + integrity +
   level-completeness + physical-topology), captures plan + 4 cardinal
   ortho 3D + 4 elevation views, then asks a subagent for a `0..10`
   grade against the source floor plan + elevations. The floor must
   score **`≥9/10`** before the next floor opens. `10/10` is the
   target.
3. **Real time-travel commits with full provenance.** Every MCP slice
   runs inside `commit_context()` with the
   `agent_context.testhouse_iter` block. The v2 schema adds three
   required arrays (`consumedFactIds`, `sourceEvidence`,
   `producedElementIds`) so the inspector can render the
   "doc → fact → element" trail in `/agents` without guessing.
4. **Structured logs on `bim_ai.testhouse_iter`.** Four records per
   phase (start / commit_opened / commit_closed / end). End records
   carry the grade, the phase outcome, and the produced element ids.
5. **No one-off `scripts/testhouse_iterN_*.py` apply files.** The
   `scripts/testhouse_drive.py` generic driver covers every phase
   (preflight, reader, scope, floor, ortho-views, capture, grade).

## What to preserve, what to delete

### Preserve
- `testhouses/house-{alpha,beta,gamma}/source/` — source PDFs, never touched.
- `claude-skills/hybrid-reverse-bim/` — methodology of record (now
  encodes inside-out per floor + `≥9/10` gate).
- All `app/bim_ai/reverse_bim/` and `app/bim_ai/services/` infrastructure.
- DB schema (`bim_models`, `bim_undo_stack`, `bim_model_commits`,
  `bim_model_snapshots`).
- `scripts/testhouse_purge.py` + `scripts/testhouse_drive.py` (the
  driver gains new phases for v2 but the shell stays the same).

### Delete (every rebuild attempt begins with a full purge)
- `bim_models` rows for `house-alpha`, `house-beta`, `house-gamma`.
- `tmp/reverse-bim/house-{alpha,beta,gamma}/` — all runtime state.
- `tmp/reverse-bim/iter-*` — captures, scoring, apply JSON, prompts,
  visual-diffs, handoff docs (legacy layout).
- `tmp/reverse-bim/convergence-state.json`.

The cleanup is a single `uv run python scripts/testhouse_purge.py`
followed by `rm -rf tmp/reverse-bim/{house-*,iter-*,convergence-state.json}`.
It is idempotent and safe to re-run.

## Iteration sequence (v2 — per-floor inside-out)

The order is `house ∈ {alpha, beta, gamma}` outer × `floor ∈ {KG, EG,
DG, roof}` inner. Smallest house first so methodology errors surface
on a single PDF.

### Preflight (once per house)

| Iter | Houses | Phase | Done-criteria |
|------|--------|-------|---------------|
| 0 | all | `preflight` — source render @ 240 DPI + page classification + reader-pass plan | `tmp/reverse-bim/<house>/preflight/` with rendered pages + page-class labels |
| 1 | all | `reader-facts` — subagent reads each source page and emits structured `extractedFacts[]` for every level (rooms, dimensions, openings, vertical circulation, roof) | `understanding/existing-building-ir.json` v2 exists per house with `extractedFacts: [...]` populated (`factTotal > 0` in the `/agents` dashboard); every load-bearing fact has `factId + kind + status + levelId + sourceDocId + sourcePage + (valueMm OR vertexMm) + confidence` |
| 2 | all | `scope-decisions` — building scope, party walls, coordinate frame, level heights | `understanding/scope-decisions.json` v2; for alpha + gamma at `target_half` with explicit party-wall side + mask polygon; for beta full building |

### Topology first, then per-floor inside-out (bottom-up)

After preflight + reader + scope decisions, the per-house body of the
rebuild starts with **topology** (toposolid + parcel + excavation
under the future basement), and only then builds floors **bottom-up**:
KG → EG → DG → roof. The rationale is structural — the KG slab
elevation is defined by the excavation depth, the EG floor sits on
KG, and the roof eave terminates against the DG wall top. Authoring
in this order means every later slice has a parent reference to
anchor against, and the v2 visual gate can check the whole stack from
the ground up.

The iter number for a house is `3 + (5 × house_index) + slice_index`
where `house_index ∈ {alpha:0, beta:1, gamma:2}` and
`slice_index ∈ {topology:0, KG:1, EG:2, DG:3, roof:4}`. Concretely:

| Iter | House | Slice | Phase(s) | Done-criteria |
|------|-------|----------|----------|---------------|
| 3  | alpha | topology | `topology-toposolid` → `topology-parcel` → `topology-excavation-stub` → `topology-visual-gate` | Toposolid + parcel + excavation polygon present and sized to scope.mask; grader ≥ 9/10 on the bare-site view |
| 4  | alpha | KG       | `kg-rooms` → `kg-partitions` → `kg-openings` → `kg-exterior-walls` → `kg-slab-on-toposolid` → `kg-structural-gate` → `kg-visual-gate` | KG slab hosts on toposolid via excavation cutter; grader ≥ 9/10 for KG-on-site |
| 5  | alpha | EG       | same shape, `eg-*` (EG slab sits on KG walls) | grader ≥ 9/10 for EG; previous slices still ≥ 9/10 |
| 6  | alpha | DG       | same shape, `dg-*` | grader ≥ 9/10 for DG |
| 7  | alpha | roof     | `roof-main` → `roof-dormers` → `roof-openings` → `roof-structural-gate` → `roof-visual-gate` | grader ≥ 9/10 for full exterior + site |
| 8..12  | beta  | topology + KG/EG/DG/roof | same shape | each slice grader ≥ 9/10 |
| 13..17 | gamma | topology + KG/EG/DG/roof | same shape | each slice grader ≥ 9/10 |
| 18+ | all | `final-acceptance` — materials, schedules, cross-house visual review | All gates from `qa.advisor`, `qa.constructability`, `qa.integrity_preflight`, `reverse_bim.level_completeness`, `reverse_bim.physical_topology`, `reverse_bim.final_acceptance` clean; cross-house grader ≥ 9/10 each |

### Per-floor phase contract

Each of the six per-floor phases above lands its own
`bim_model_commits` row, all sharing the same iter number and house
but with distinct `phase` slugs (`<floor>-rooms`, `<floor>-partitions`,
`<floor>-openings`, `<floor>-exterior-walls`, `<floor>-structural-gate`,
`<floor>-visual-gate`). The driver emits the four-record log set per
phase. The `<floor>-visual-gate` phase is the ONLY one that calls the
grader subagent; the other five just commit + log.

If `<floor>-visual-gate` returns `< 9/10`, the driver opens a
`<floor>-corrector` phase: spawn a focused subagent with the rendered
captures + the grader's `topFixesForNextIter` array, apply the
returned bundle, recapture, regrade. Loop until `≥ 9/10` or the
operator stops the run. The corrector commits are also tagged with
the same `{house, iter, floor}` but `phase: "<floor>-corrector-<N>"`
to keep the history navigable.

## Commit-attribution contract — v2

Every MCP slice MUST land via:

```python
async with commit_context(
    session=session,
    model_id=model_id,
    agent_context={
        "testhouse_iter": {
            "house": "alpha",                 # alpha | beta | gamma
            "iter": 4,                        # monotonic integer
            "phase": "eg-rooms",              # short slug, see table
            "consumedFactIds": ["F-EG-room-livingroom", "F-EG-room-kitchen"],
            "sourceEvidence": [
                {
                    "docId": "srcdoc-22993cc5012b",
                    "page": 1,
                    "role": "floor_plan",
                    "renderedPath": "tmp/reverse-bim/house-alpha/preflight/rendered-pages/srcdoc-22993cc5012b/EG-1.png",
                },
            ],
            "producedElementIds": [],         # filled at commit close
        },
        "tool": "hybrid-reverse-bim",
        "controlling_tracker": "spec/trackers/testhouse-clean-rebuild-tracker.md",
    },
) as ctx:
    ...
```

The three new arrays are **additive**: the inspector iter-picker
still resolves "iter N of house X" using only `{house, iter, phase}`.
Renderers that want to show the "doc → fact → element" trail consume
the three arrays; renderers that don't care ignore them.

`producedElementIds` is populated on commit close (after the bundle
applies) from the engine's `changedElementIds` set.

## Logging contract — v2

Same four records as v1, plus richer payloads:

- `testhouse_iter.start` — `{house, iter, phase, source_root, model_id, consumedFactIds, sourceEvidence}`
- `testhouse_iter.commit_opened` — `{house, iter, phase, commit_id, model_id, command_count}`
- `testhouse_iter.commit_closed` — `{house, iter, phase, commit_id, revision_after, producedElementIds, advisorFindingCount, constructabilityFindingCount, integrityFindingCount}`
- `testhouse_iter.end` — `{house, iter, phase, status: ok|failed|gate_failed, elapsed_ms, gradeScore10?, gradeNotes?}` (last two only on `*-visual-gate` phases)

Logger name remains `bim_ai.testhouse_iter`. Correlation ID is minted
by the driver per phase.

## Coordination with other parallel agents

This agent **owns**:
- `scripts/testhouse_*.py` and `scripts/archive/testhouse_iter*.py`
- `tmp/reverse-bim/` cleanup
- `testhouses/house-*/source/` — **read-only**
- `claude-skills/hybrid-reverse-bim/` — methodology updates that fall
  out of v2 (flag big edits to the coordinator first)
- This tracker file + `spec/methodology-audit-2026-05-23.md` +
  `spec/agents-view-traceability-spec.md`

This agent **does NOT touch**:
- `app/bim_ai/versioning.py`, `app/bim_ai/routes/time_travel.py`,
  `app/bim_ai/routes/agent_runs.py`, `app/bim_ai/agent_run_parser.py`
  (time-travel + inspector agent owns)
- `packages/web/` (time-travel + inspector agent owns
  `AgentHouseDashboard.tsx`; perf agent owns state/plan/viewport)
- `spec/trackers/model-time-travel-tracker.md`,
  `spec/trackers/agent-run-inspector-tracker.md`,
  `spec/trackers/performance-quality-tracker.md`
- `app/bim_ai/main.py` route registration block

v2 introduces a coordination ask for the inspector agent — see
[`spec/agents-view-traceability-spec.md`](../agents-view-traceability-spec.md)
for the three additions `/agents` needs (source-page server,
provenance-trail renderer, inline grade-report).

## Capture-layout contract

The driver writes captures to **both** layouts so the dashboard AND
iter-picker see them:

```
tmp/reverse-bim/iter-<N>-captures/<house>-3d-full.png
tmp/reverse-bim/iter-<N>-captures/<house>-elev-{north,east,south,west}-full.png
tmp/reverse-bim/iter-<N>-captures/<house>-plan-<level>-full.png
tmp/reverse-bim/iter-<N>-scoring/<house>-subagent-report.md
tmp/reverse-bim/house-<X>/iter-<N>/captures/<same files>
tmp/reverse-bim/house-<X>/iter-<N>/scoring/<same report>
```

The legacy `iter-<N>-captures/` path is the one
`agent_runs.py::_enumerate_iterations` reads for the dashboard cards;
the per-house path is what the iter-picker recognises. Both are
populated by `testhouse_drive.py capture-views`.

## Definition of Done (v2)

This tracker is complete when:

- All three testhouse models exist as fresh `bim_models` rows.
- **Every per-floor visual gate scored `≥ 9/10`**, and at least 50 %
  of the floor gates scored `10/10`.
- `final-acceptance` for each house passes — advisor / constructability
  / integrity / level-completeness / physical-topology all clean.
- Every `bim_model_commits` row for this rebuild carries
  `context.testhouse_iter` with the v2 schema (the three new arrays
  present and non-empty for authoring phases; `producedElementIds`
  populated on close).
- `bim_ai.testhouse_iter` log channel has start/end records for every
  phase that ran.
- The inspector iter-picker successfully checks out an earlier floor
  (e.g. iter-4 EG) in the live Workspace viewer when invoked from a
  later floor's dashboard (e.g. iter-6 roof).
- The `/agents` dashboard renders, per house:
  - non-zero `factTotal` (because IR v2 carries `extractedFacts`),
  - at least one capture thumbnail per iter that ran,
  - the grader's `subagent-report.md` markdown inline,
  - (subject to the inspector agent landing the coordination spec)
    the source page that produced each fact, and the
    consumed-fact / source-evidence / produced-element trail per
    commit.

## Related trackers

- [`spec/methodology-audit-2026-05-23.md`](../methodology-audit-2026-05-23.md) — why v1 was rejected
- [`spec/agents-view-traceability-spec.md`](../agents-view-traceability-spec.md) — coordination ask for the inspector agent
- [`testhouse-visual-fidelity-tracker.md`](./testhouse-visual-fidelity-tracker.md) — historical record of iter-1..iter-19 (superseded)
- [`testhouse-hybrid-reverse-bim-tracker.md`](./testhouse-hybrid-reverse-bim-tracker.md) — per-house execution log format (still applicable)
- [`model-time-travel-tracker.md`](./model-time-travel-tracker.md) — Wave 4 (this tracker remains its integration test)
- [`agent-run-inspector-tracker.md`](./agent-run-inspector-tracker.md) — iter-picker + the v2 coordination additions
- [`claude-skills/hybrid-reverse-bim/SKILL.md`](../../claude-skills/hybrid-reverse-bim/SKILL.md) — methodology of record
