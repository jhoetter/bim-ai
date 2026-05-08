# WP-KRN-07 — Stairs: spiral + sketch-shape variants + winder plan symbology (closeout)

## Branch

`feat/wave-05-krn-07-stairs-spiral-sketch`

## Goal

Finish the multi-run stair scope. Today straight + L-shape + U-shape ship (commit chain culminating in the wave3-5 work). This WP adds the two remaining shape kinds — `spiral` and `sketch` — plus winder-tread plan symbology that the deferred bullet calls out. The sketch path is now unblocked because SKT-01 landed in Wave 4 (the sketch-session state machine handles arbitrary closed-loop paths).

## Done rule

(a) `StairElem.shape` accepts `'spiral'` and `'sketch'` (already supports `'straight' | 'l_shape' | 'u_shape'`).
(b) `CreateStairCmd` validates the shape-specific fields (spiral needs `centerMm`, `innerRadiusMm`, `outerRadiusMm`, `totalRotationDeg`, `riserCount`; sketch needs `sketchPathMm: list[Vec2Mm]` from a SKT-01 sketch session).
(c) Engine derives runs + landings + treads for both new shapes.
(d) Renderer (`meshBuilders.multiRunStair.ts`) draws the spiral as helical treads about the centre and the sketch shape as treads stepped along the sketch path's parameterisation.
(e) Plan symbology renders winder treads with the standard angled-tread symbol (one tread fans out from the inner pivot to the outer arc).
(f) Tests: pytest for the engine derivation; vitest for both mesh builders + the plan-symbology helper.
(g) Tracker row for KRN-07 flips `partial` → `done`.

---

## File 1 — `app/bim_ai/elements.py`

Extend `StairElem.shape: Literal[...]` with `'spiral'` and `'sketch'`. Add the new shape-specific optional fields:

```python
center_mm: Vec2Mm | None = Field(default=None, alias="centerMm")
inner_radius_mm: float | None = Field(default=None, alias="innerRadiusMm")
outer_radius_mm: float | None = Field(default=None, alias="outerRadiusMm")
total_rotation_deg: float | None = Field(default=None, alias="totalRotationDeg")
sketch_path_mm: list[Vec2Mm] | None = Field(default=None, alias="sketchPathMm")
```

Pydantic `model_validator(mode="after")` enforces presence of the right field set per shape. Existing fields (`runs`, `landings`, `riserCount`) stay required.

## File 2 — `packages/core/src/index.ts`

Mirror the new shape kinds and optional fields on the TS Stair element + `CreateStairCmd`.

## File 3 — `app/bim_ai/engine.py`

Extend `CreateStairCmd` Pydantic + the `case CreateStairCmd():` branch. After validation:

- For `spiral`: derive treads — each tread is an annular sector spanning `totalRotationDeg / riserCount` of arc, between `innerRadiusMm` and `outerRadiusMm`, rising `runHeightMm / riserCount` per step. No landings.
- For `sketch`: walk the sketch path; each tread is a perpendicular slab at evenly-parameterised arc-length intervals.

Materialise the same `runs[]` + `landings[]` data as straight/l/u so the renderer doesn't need a third codepath. (For spiral, `runs[]` becomes a single curved-run record with `polylineMm` filled in; for sketch, `polylineMm` = the input path.)

## File 4 — `packages/web/src/viewport/meshBuilders.multiRunStair.ts`

Extend the mesh builder. Add a helper:

```ts
function buildSpiralStairFlight(
  center: Vec2Mm,
  innerR: number, outerR: number,
  totalRotDeg: number,
  riserCount: number,
  treadHeightMm: number,
  riserHeightMm: number,
): THREE.Mesh;
```

…and a sketch-shape helper that places a `BoxGeometry` per tread along the input polyline. Dispatch from the existing `_makeMultiRunStairMesh` based on `shape`.

## File 5 — `packages/web/src/plan/stairPlanSymbol.ts` (new or extend)

Add a winder-tread plan symbol. For each spiral tread or each tread on a winder section of an l_shape/u_shape stair, render a fanned wedge (apex at inner pivot, outer arc). The standard up-arrow stays at the bottom of the run.

If a `stairPlanSymbol.ts` already exists, extend; otherwise factor the existing rendering out of `PlanCanvas.tsx` into the new module.

## Tests

`app/tests/test_create_stair_spiral_and_sketch.py` (new):

- `test_spiral_stair_derives_n_treads`
- `test_spiral_validates_required_fields` — missing `centerMm` raises.
- `test_sketch_stair_uses_polyline_path`
- `test_sketch_stair_validates_min_two_points`
- `test_sketch_path_can_be_emitted_from_sketch_session_finish` — round-trip via `SketchSession.finish_session(submode='stair')`.

`packages/web/src/viewport/meshBuilders.multiRunStair.test.ts` — extend with spiral + sketch shape cases.

`packages/web/src/plan/stairPlanSymbol.test.ts` — winder-wedge geometry test.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai/elements.py bim_ai/engine.py
cd app && .venv/bin/pytest tests/test_create_stair_spiral_and_sketch.py tests/test_create_stair_multi_run.py tests/test_sketch_session.py
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/viewport/meshBuilders.multiRunStair.test.ts src/plan/stairPlanSymbol.test.ts
```

## Tracker

Flip KRN-07 row from `partial` → `done`. Replace deferred-scope text with as-shipped spiral + sketch + winder coverage.

## Non-goals

- Curved-tread mesh for arbitrary curves beyond `spiral` and explicit polyline `sketch`. Bezier / NURBS treads stay deferred.
- Stair calculator UI (rise/run targets, code compliance) — separate WP.
- Railing on spiral/sketch stairs — railings ship via the existing `railing` element kind; layout helpers can be a follow-up.
