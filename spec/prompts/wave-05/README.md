# Wave 5 — Last partial-row closeouts

## Goal

Flip the five remaining `partial` rows in `spec/workpackage-master-tracker.md` to `done`. Each row already has a load-bearing slice on main; this wave finishes the deferred scope without inventing new features.

## Parallel execution analysis

**Fire all 4 prompts in parallel.** FED-03's canvas-badge work is chained inside the FED-04 agent's flow as a Phase 2 (it branches off FED-04's tip and pushes a separate `feat/wave-05-fed-03-canvas-badge` branch when done), so the user never manages a Batch B handoff.

| Agent | Prompt to read | Branches it pushes | Effort |
| --- | --- | --- | --- |
| 1 | `WP-FED-04-dxf-underlay.md` | `feat/wave-05-fed-04-dxf-underlay` then `feat/wave-05-fed-03-canvas-badge` (chained) | M + XS |
| 2 | `WP-KRN-07-stairs-spiral-sketch.md` | `feat/wave-05-krn-07-stairs-spiral-sketch` | M |
| 3 | `WP-KRN-14-dormer-completeness.md` | `feat/wave-05-krn-14-dormer-completeness` | M |
| 4 | `WP-IFC-04-broader-coverage.md` | `feat/wave-05-ifc-04-broader-coverage` | M |

The four agent prompts touch disjoint surfaces:

- FED-04 / FED-03 — plan canvas + new Python DXF parser + state badge
- KRN-07 — stair element + sketch-session + stair mesh
- KRN-14 — dormer element + dormer/roof CSG + advisor + plan symbology
- IFC-04 — `app/bim_ai/export_ifc.py` only (pure backend)

## Merge order

When all branches are pushed, the user merges in any order **except** that `feat/wave-05-fed-03-canvas-badge` must merge **after** `feat/wave-05-fed-04-dxf-underlay` (FED-03 is a descendant of FED-04, so the merge after FED-04 lands is fast-forward / trivial).

## Done rule

For each WP:

(a) `cd app && .venv/bin/ruff check bim_ai tests` clean on touched files
(b) `cd app && .venv/bin/pytest tests -k <relevant>` passes
(c) `cd packages/web && pnpm typecheck` clean
(d) `cd packages/web && pnpm exec vitest run <relevant>` passes
(e) Tracker row flipped from `partial` → `done`, deferred-scope text replaced with as-shipped behaviour
(f) Branch pushed; do **not** open a PR; do **not** merge to main

## After this wave

Tracker should be 104 done, 0 partial, 1 n/a out of 105 rows. The bim-ai project's first-class workpackage list is then closed. Future work goes into a fresh tracker.
