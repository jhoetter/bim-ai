# Wave 3 — parallel-agent sprint

Eight AI engineers running in parallel against the post-wave-2 backlog. Branches `wave3-1` through `wave3-8`. All keystones (FED-01, EDT-01, SKT-01, FAM-01) have shipped load-bearing slices; wave 3 builds on those plus picks up sketch-dependent kernel items now that SKT-01's floor session works.

## Agents and themes

| Agent | Branch    | Theme                                             | WPs                                        | Effort     |
| ----- | --------- | ------------------------------------------------- | ------------------------------------------ | ---------- |
| 1     | `wave3-1` | **Federation downstream**                          | FED-02 + FED-03 + FED-04                    | M+M+L      |
| 2     | `wave3-2` | **Editing — constraints + 3D handles**             | EDT-02 + EDT-03                             | M+L        |
| 3     | `wave3-3` | **Editing — tool de-stubs + grammar polish**       | EDT-04 (9 tool stubs) + EDT-06              | M+M        |
| 4     | `wave3-4` | **Sketch downstream + ceiling/roof propagation**   | SKT-02 + SKT-03 + SKT-01 ceiling-roof slice| S+S+M      |
| 5     | `wave3-5` | **Sketch-dependent roofs + stairs**                | KRN-02 + KRN-03 + KRN-07                    | M+M+L      |
| 6     | `wave3-6` | **Sketch-dependent areas + masking**               | KRN-08 + KRN-10                             | M+S        |
| 7     | `wave3-7` | **FAM-01 polish + EDT-01 propagation**             | FAM-01 nested-family UI + EDT-01 propagate to door/window/floor/column/beam grips | M+L  |
| 8     | `wave3-8` | **Catch-up / reserve**                             | wave2-8 leftovers (IFC-03 + IFC-04 + VIE-02) if still open; else FED-01 polish | flex |

**Total:** ~17 WPs across 8 agents. Should land bim-ai at ~55-60 done out of 75 (~75-80% backlog complete).

## Pre-conditions

Before launching wave 3:

1. **Verify the in-flight sprints landed.** Check tracker:
   - `KRN-14` (dormer) → should be `partial` or `done`
   - `KRN-15` (sweep), `KRN-16` (wall recess) → should be `done`
   - `IFC-03`, `IFC-04`, `VIE-02` → either `done` (wave2-8 finished) or still `open` (wave2-8 still running). If still open, Agent 8's queue picks them up.

2. **Verify the four keystones are at `partial` (load-bearing slice merged).**

If anything above isn't done, wave-3 still works — agents are individually instructed to handle each scenario.

## How to invoke each agent

> Your task for this wave-3 sprint is in `nightshift/wave3-<N>.md`. Read it end-to-end and execute. Do not stop until every WP is done.

Each prompt is self-contained — branch name, file ownership, merge protocol, quality gates, anti-laziness rules, per-WP scope all included. **Each prompt now requires a `git worktree add` as step 0** to pre-empt the contention every prior wave flagged.

## Concurrency map

**High-collision shared files (every wave-3 agent rebases through these):**
- `spec/workpackage-master-tracker.md`
- `packages/core/src/index.ts` — append your additions
- `app/bim_ai/elements.py`, `commands.py`, `engine.py`
- `packages/web/src/plan/PlanCanvas.tsx` — Agents 2, 3, 4 will all touch (grip propagation, tool de-stubs, sketch downstream)
- `packages/web/src/viewport/meshBuilders.ts` — Agents 2 (3D handles), 5 (roof variants) and 7 (door/window/floor grips) all touch

**Owned files (one wave-3 agent only):**

| Agent | Owned files |
|---|---|
| 1 (federation) | `app/bim_ai/federation/*` (extension), cross-link clash + Copy/Monitor extensions, IFC import shadow-model orchestrator |
| 2 (constraints + 3D) | `app/bim_ai/constraint_locks.py`, `viewport/grip3d.ts` |
| 3 (tool de-stubs) | The 9 stub branches in `PlanCanvas.tsx`, `tools/toolGrammar.ts` chain/multiple/numeric input |
| 4 (sketch downstream) | `app/bim_ai/sketch_session.py` extensions for ceiling/roof, `plan/SketchCanvasPickWalls.tsx` |
| 5 (roofs + stairs) | `viewport/roofGeometry/` (L-shape, hip), `viewport/stairGeometry/multiRun.ts` |
| 6 (areas + masking) | Area element kind + boundary, `area_calculation.py`, masking-region rendering |
| 7 (FAM-01 polish + grips) | Family editor "Loaded Families" sidebar, drag-drop, per-instance parameter editor; door/window/floor/column/beam grip providers |
| 8 (catch-up) | Whatever wave2-8 left undone; otherwise FED-01 polish |

## Merge cadence

Per WP: each agent commits → pushes branch → rebases onto latest main → fast-forwards merge to main → pushes main. Same protocol as wave-2. Direct `git push origin <branch>:main` works around locked-main-worktree contention.

## Status

Each agent appends to its own `nightshift/wave3-<N>-status.md` file at end-of-shift. **CRITICAL:** every wave-2 status agent flagged "wrote status but didn't push" as the failure mode that nearly lost work — **always push the branch + push to main** before writing the status file, not after.
