# Wave 5 — Last partial-row closeouts

## Goal

Flip the five remaining `partial` rows in `spec/workpackage-master-tracker.md` to `done`. Each row already has a load-bearing slice on main; this wave finishes the deferred scope without inventing new features.

## Parallel execution analysis

**Batch A (4 in parallel):** FED-04, KRN-07, KRN-14, IFC-04. Zero file overlap between them — FED-04 is plan-canvas + new Python parser, KRN-07 is stair element + sketch-session, KRN-14 is dormer + roof CSG, IFC-04 is purely `app/bim_ai/export_ifc.py` + IFC psets. They can fire simultaneously.

**Batch B (1 agent, after FED-04 lands):** FED-03 canvas badge. Touches `PlanCanvas.tsx` to add a small overlay-layer; FED-04 also adds an underlay layer in the same file. Sequential avoids a trivial append conflict.

| Batch | WP | Branch | Effort |
| --- | --- | --- | --- |
| A | FED-04 | `feat/wave-05-fed-04-dxf-underlay` | M (DXF half only) |
| A | KRN-07 | `feat/wave-05-krn-07-stairs-spiral-sketch` | M |
| A | KRN-14 | `feat/wave-05-krn-14-dormer-completeness` | M |
| A | IFC-04 | `feat/wave-05-ifc-04-broader-coverage` | M |
| B | FED-03 | `feat/wave-05-fed-03-canvas-badge` | XS |

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
