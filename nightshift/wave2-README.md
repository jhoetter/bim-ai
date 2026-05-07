# Wave 2 — parallel-agent sprint

Eight AI engineers running in parallel against the post-nightshift backlog. Branches `wave2-1` through `wave2-8`. Concurrent with the **seed-fidelity** sprint already in flight (which owns KRN-14, KRN-15, KRN-16 — do **not** assign those to wave-2 agents).

## Agents and themes

| Agent | Branch    | Theme                                             | WPs                                | Effort   |
| ----- | --------- | ------------------------------------------------- | ---------------------------------- | -------- |
| 1     | `wave2-1` | **Federation keystone** (load-bearing slice)      | FED-01                             | XL → L   |
| 2     | `wave2-2` | **In-place editing keystone** + snap upgrade      | EDT-01 (walls-only) + EDT-05       | L + M    |
| 3     | `wave2-3` | **Sketch mode keystone** + floor overlap          | SKT-01 (floor-only) + SKT-04       | L + XS   |
| 4     | `wave2-4` | Kernel small batch + VIE-01 finish                | KRN-01 + KRN-05 + VIE-01           | M + M + M|
| 5     | `wave2-5` | Plan view polish + 2D linework                    | PLN-01 + PLN-02 + ANN-01           | M + S + M|
| 6     | `wave2-6` | Family system depth                               | FAM-03 + FAM-05 + FAM-10           | M + L + M|
| 7     | `wave2-7` | Component catalog + agent loop                    | FAM-08 + AGT-01                    | M + L    |
| 8     | `wave2-8` | IFC depth + per-detail visibility                 | IFC-03 + IFC-04 + VIE-02           | M + L + M|

**Total:** 19 WPs across 8 agents. After this wave, the only WPs still gated will be those that hard-depend on the keystones FED-01 / EDT-01 / SKT-01 (which agents 1, 2, 3 are shipping the load-bearing slice of). Wave 3 picks those up.

## How to invoke each agent

> Your task for this wave-2 sprint is in `nightshift/wave2-<N>.md`. Read it end-to-end and execute. Do not stop until every WP is done.

Each prompt is self-contained — branch name, file ownership, merge protocol, quality gates, anti-laziness rules, per-WP scope all included.

## Concurrency map

**Seed-fidelity sprint (in flight, do NOT collide):**
- `packages/cli/lib/one-family-home-commands.mjs` — seed bundle
- `packages/web/e2e/seed-house-fidelity.spec.ts` — new visual baseline
- New `sweep`, `dormer`, `recessZones` additions to `core/index.ts`, `elements.py`, `commands.py`, `engine.py`, `meshBuilders.ts`

**High-collision shared files (every wave-2 agent rebases through these):**
- `spec/workpackage-master-tracker.md`
- `packages/core/src/index.ts`
- `app/bim_ai/elements.py`, `commands.py`, `engine.py`
- `packages/web/src/viewport/meshBuilders.ts` (less now that seed-fidelity is consolidating new geometry there)
- `packages/web/src/plan/PlanCanvas.tsx` — agents 2, 3, 5 will touch this; coordinate via small surface area

**Owned files (one wave-2 agent only):**
- Agent 1 (FED-01): `link_model` element kind, `ManageLinksDialog.tsx`, snapshot expansion endpoint
- Agent 2 (EDT-01 + EDT-05): `gripProtocol.ts`, `tempDimensions.ts`, `snapEngine.ts` extensions (note: nightshift-7 has WIP EDT-05 work at commit `eabe0eb2` — start from that)
- Agent 3 (SKT-01 + SKT-04): `SketchCanvas.tsx`, `sketch_session.py`
- Agent 4 (KRN-01/05 + VIE-01): `property_line` + project `reference_plane` element kinds, plan-projection detail-level wiring
- Agent 5 (PLN/ANN): `dimension_auto.ts`, `crop_region_ui.tsx`, `detail_line/region/text_note` rendering
- Agent 6 (FAM-03/05/10): family editor extensions, clipboard payload format
- Agent 7 (FAM-08 + AGT-01): catalog format, agent-loop runner
- Agent 8 (IFC + VIE-02): `app/bim_ai/export_ifc.py`, family-geometry visibility-by-detail flag

## Merge cadence

Per WP: each agent commits → pushes branch → rebases onto latest main → fast-forwards merge to main → pushes main. Same protocol as nightshift. Direct `git push origin <branch>:main` works around locked-main-worktree contention.

Always start by spawning a per-agent worktree:
```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-<N> wave2-<N>
cd /Users/jhoetter/repos/bim-ai-wave2-<N>
```

This pre-empts the worktree contention every nightshift agent flagged.

## Status

Each agent appends to its own `nightshift/wave2-<N>-status.md` file at end-of-shift.
