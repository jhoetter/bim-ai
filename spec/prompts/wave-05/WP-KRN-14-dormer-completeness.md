# WP-KRN-14 — Dormer completeness (closeout)

## Branch

`feat/wave-05-krn-14-dormer-completeness`

## Goal

Finish the dormer kind. Today the seed-fidelity sprint shipped: `DormerElem`, `createDormer`, three walls + flat-roof renderer, and three-bvh-csg subtraction of the host-roof footprint. Deferred per the row: gable / hipped dormer roof kinds, `hasFloorOpening: true` (cuts the host floor underneath), plan symbology, and a `dormer-overflow` advisory when a dormer extends past the host roof footprint.

## Done rule

(a) `DormerElem.roofKind` accepts `'flat' | 'gable' | 'hipped'` (today only `flat`).
(b) Renderer (`viewport/dormerMesh.ts`) builds gable + hipped roof geometries on the dormer footprint with the same three-bvh-csg subtraction of the host roof.
(c) New `DormerElem.hasFloorOpening: bool` field. When true, the engine subtracts the dormer footprint from the host floor element (using the existing slab-opening pattern) on apply.
(d) Plan canvas renders the dormer outline + a "DR" label on the roof level's plan view.
(e) New advisory `dormer_overflow_v1` (warning) fires when any vertex of the dormer footprint lies outside the host roof's footprint polygon. Surfaces in the existing advisor UI.
(f) Tracker row for KRN-14 flips from `partial` → `done`.

---

## File 1 — `app/bim_ai/elements.py`

Extend `DormerElem`:

```python
roof_kind: Literal["flat", "gable", "hipped"] = Field(default="flat", alias="roofKind")
ridge_height_mm: float | None = Field(default=None, alias="ridgeHeightMm")  # gable+hipped
has_floor_opening: bool = Field(default=False, alias="hasFloorOpening")
```

`model_validator(mode="after")` requires `ridgeHeightMm` when `roofKind in ('gable', 'hipped')`.

## File 2 — `packages/core/src/index.ts`

Mirror the new fields on the TS dormer element + `CreateDormerCmd`.

## File 3 — `app/bim_ai/engine.py`

In the `case CreateDormerCmd():` branch:

- If `roofKind in ('gable', 'hipped')`, validate `ridgeHeightMm > 0` (Pydantic already enforces presence).
- If `hasFloorOpening`, find the host-roof's underlying floor element (the floor on the level immediately below the host roof, matching the dormer footprint position). Emit a `slab_opening` element subtracted from that floor with the dormer footprint as its boundary.
- Add the new `dormer_overflow` advisory check: if any dormer footprint vertex lies outside the host-roof footprint polygon (existing `point_in_polygon` helper), append a warning advisory `{ ruleId: 'dormer_overflow_v1', severity: 'warning', elementId: dormerId, hostId: roofId }`.

## File 4 — `packages/web/src/viewport/dormerMesh.ts`

Add `buildGableDormerRoof` and `buildHippedDormerRoof` helpers:

- Gable: ridge along the dormer's longer axis at `ridgeHeightMm`; two sloped faces.
- Hipped: ridge centred along the longer axis but shorter than the eave; four sloped faces.

Both use the same three-bvh-csg subtraction pipeline as the existing flat-roof dormer to cut into the host roof.

Dispatch from the existing `buildDormerMesh` based on `roofKind`.

## File 5 — `packages/web/src/plan/PlanCanvas.tsx` + `plan/dormerPlanSymbol.ts` (new)

`dormerPlanSymbol.ts` exports:

```ts
export function renderDormerPlanSymbol(
  ctx: CanvasRenderingContext2D,
  dormer: DormerElement,
  worldToScreen: (xy: Vec2Mm) => [number, number],
): void;
```

Renders the dormer footprint outline (dashed line) + a "DR" label centred on the footprint, on the roof level's plan view only (skip for other levels). Wire from `PlanCanvas.tsx`'s element-render loop.

## File 6 — `app/bim_ai/advisor.py` (or wherever advisory rules register)

Register `dormer_overflow_v1` so the advisor UI knows about the rule (severity: warning, category: geometry).

## Tests

`app/tests/test_dormer_completeness.py` (new):

- `test_gable_dormer_validates_ridge_height_required`
- `test_hipped_dormer_renders_four_faces` — render via the mesh builder, count faces.
- `test_has_floor_opening_emits_slab_opening`
- `test_dormer_overflow_advisory_fires_when_vertex_outside_roof`
- `test_dormer_overflow_quiet_when_inside`

`packages/web/src/viewport/dormerMesh.test.ts` — extend with gable + hipped cases.

`packages/web/src/plan/dormerPlanSymbol.test.ts` — outline + label render assertions.

## Validation

```bash
cd app && .venv/bin/ruff check bim_ai/elements.py bim_ai/engine.py bim_ai/advisor.py
cd app && .venv/bin/pytest tests/test_dormer_completeness.py tests/test_dormer.py
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/viewport/dormerMesh.test.ts src/plan/dormerPlanSymbol.test.ts
```

## Tracker

Flip KRN-14 row from `partial` → `done`. Replace deferred-scope text with as-shipped gable / hipped + floor-opening + plan-symbology + overflow advisory.

## Non-goals

- Shed dormers, eyebrow dormers, wall dormers — only flat / gable / hipped covered. Add later if the seed needs them.
- Dormer windows positioned automatically — users still author the window via the existing `insertWindowOnWall` flow against one of the dormer's three walls.
- Section symbol — the existing plan-section workflow already handles that.
