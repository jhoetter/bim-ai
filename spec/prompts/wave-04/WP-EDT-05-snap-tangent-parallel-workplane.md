# WP-EDT-05 — Snap Engine: tangent / parallel / workplane (closeout)

## Branch

`feat/wave-04-edt-05-snap-extra`

## Goal

Add the three remaining snap kinds the wave2-2 slice deferred: tangent (curved geometry), parallel (to existing edge), and workplane (3D — snap pointer to active reference plane). Wire them into the existing producer pipeline, glyph layer, and Tab-cycle order.

## Done rule

(a) Three new snap producers ship in `packages/web/src/plan/snapEngine.ts` (or sibling module): `produceTangentSnaps`, `produceParallelSnaps`, `produceWorkplaneSnaps`.
(b) Each producer's snaps appear in the Tab cycle (`snapTabCycle.ts`) and respect the per-kind toggle in `snapSettings.ts` (default ON for parallel + workplane; default OFF for tangent because it costs the most).
(c) Glyph layer renders distinct visual indicators per kind (tangent = circle-tangent symbol; parallel = `‖` symbol; workplane = a small wireframe square at the snap point).
(d) Vitest coverage for each producer; integration test that Tab-cycles through the new kinds.
(e) Tracker row for EDT-05 flips from `partial` → `done`.

---

## File 1 — `packages/web/src/plan/snapEngine.ts`

Three new producer functions, mirroring the shape of `produceIntersectionSnaps` already in this module. Each takes `(elements, cursor, options)` and returns `SnapCandidate[]` with kind-specific `kind` and `glyph` fields.

- **Tangent**: only fires when there is an active draft segment whose endpoint is being placed and the cursor is near a curved element (`sweep` / `dormer` curved segments / curtain panel arc). Returns the tangent point on the curve from the draft endpoint.
- **Parallel**: when the cursor is near a wall (within `parallelSnapTolPx`), and there is an active draft segment whose direction is being chosen, snap the draft's direction to be exactly parallel to the hovered wall. Snap point projects the cursor onto that direction.
- **Workplane**: 3D-only. When the active tool is in 3D mode and a reference plane is the active workplane (`store.activeReferencePlaneId`), snap pointer-z onto that plane. Returns the snap on the workplane intersection.

Sort precedence (in `snapEngine` ranker): endpoint > midpoint > intersection > perpendicular > **parallel** > **tangent** > **workplane** > grid. Tab-cycle follows the same order.

## File 2 — `packages/web/src/plan/snapSettings.ts`

Extend `SNAP_KINDS` with `'parallel'`, `'tangent'`, `'workplane'`. Default-on flags: `parallel: true`, `tangent: false`, `workplane: true`. Persisted via the existing `localStorage` key.

## File 3 — `packages/web/src/plan/snapTabCycle.ts`

Insert the new kinds in the cycle order matching the snapEngine precedence above. Update the existing test fixtures.

## File 4 — `packages/web/src/plan/snapGlyph.tsx` (or wherever glyphs render)

Add the three glyph variants. Use existing icon library; no SVG asset additions necessary.

## Tests

`packages/web/src/plan/snapEngine.test.ts` (extend):

- `test_tangent_snap_on_curved_segment`
- `test_parallel_snap_aligns_to_hovered_wall_direction`
- `test_workplane_snap_projects_pointer_onto_active_plane`

`packages/web/src/plan/snapTabCycle.test.ts` (extend): cycle through new kinds in the right order; respects per-kind toggle.

## Validation

```bash
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/plan/snapEngine.test.ts src/plan/snapTabCycle.test.ts src/plan/snapSettings.test.ts
```

## Tracker

Flip EDT-05 row from `partial` → `done`. Replace deferred-scope text with as-shipped tangent + parallel + workplane producers.

## Non-goals

- No new curved geometry kinds — tangent fires against existing curved segments only.
- No multi-workplane visualisation — uses the single active workplane only.
- No 3D snap glyphs in the plan view — glyphs render in their respective canvas (plan or 3D).
