# Wave 4 — SKB / EDT Closeout

## Goal

Close out the load-bearing slices that landed in the prior session for SKB-02, SKB-09, EDT-02, EDT-03, plus the older `partial` items EDT-05 and SKT-01. After this wave, the sketch-to-BIM agent runtime is end-to-end usable: padlock-locked dimensions actually block the engine; 3D drag handles render and dispatch; mass elements render and can be materialised into walls; the archetype library covers more building shapes; the snap engine has tangent/parallel/workplane; and the sketch-session state machine handles every kind it should.

## Parallel execution analysis

| Batch | WP | Branch | Touches | Conflicts with |
| --- | --- | --- | --- | --- |
| A (parallel) | EDT-02 | `feat/wave-04-edt-02-padlock` | `app/bim_ai/elements.py`, `app/bim_ai/engine.py`, `packages/web/src/plan/PlanCanvas.tsx` (only `handleTempDimLockClick`) | none |
| A (parallel) | EDT-03 | `feat/wave-04-edt-03-viewport` | `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/grip3d.ts` (extend with providers), new `viewport/grip3dRenderer.ts` + `viewport/wallFaceRadialMenu.tsx` | none |
| B (after A) | SKB-02 | `feat/wave-04-skb-02-mass-renderer` | `packages/web/src/Viewport.tsx` (mass mesh), `app/bim_ai/engine.py` (`MaterializeMassToWallsCmd`) | depends on EDT-03's viewport surfaces |
| B (parallel within B) | SKB-09 | `feat/wave-04-skb-09-archetypes` | `app/bim_ai/skb/archetypes.py`, `app/bim_ai/skb/element_count_priors.py` | none |
| C (parallel) | EDT-05 | `feat/wave-04-edt-05-snap-extra` | `packages/web/src/plan/snapEngine.ts`, `snapSettings.ts`, `snapTabCycle.ts` | none |
| C (parallel) | SKT-01 | `feat/wave-04-skt-01-sketch-modes` | `app/bim_ai/sketch_session.py`, `app/bim_ai/sketch_validation.py`, `app/bim_ai/engine.py` | none |

Batch A is the wave3-2 leftover. Batch B unlocks the agent runtime (mass extraction is the only piece that closes the SKB-12 cookbook's massing → skeleton transition). Batch C are pre-existing partials picked up while we're here.

## Done rule

For each WP:

(a) `cd app && .venv/bin/ruff check bim_ai tests` clean
(b) `cd app && .venv/bin/pytest tests -k <relevant>` passes
(c) `cd packages/web && pnpm typecheck` clean
(d) `cd packages/web && pnpm exec vitest run <relevant>` passes
(e) `make verify` (or repository equivalent) passes
(f) Tracker row flipped from `partial` → `done` (or expanded `partial` → richer `partial` if some scope still defers)
(g) Branch pushed; no PR opened

## Sequencing

```
Batch A (parallel):  EDT-02   EDT-03
                      ↓        ↓
Batch B (parallel):  SKB-02   SKB-09
                      ↓
Batch C (parallel):  EDT-05   SKT-01
```

EDT-02 and EDT-03 must merge to main before Batch B starts (SKB-02's renderer uses the EDT-03 viewport hookups; nothing else interlocks). Batch C is fully independent and can run any time after main is on a green build of A.
