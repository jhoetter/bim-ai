# Wave-3 Agent 5 status

Branch: `wave3-5`. All three workpackages landed (KRN-07 `partial` per scope; spiral / sketch variants deferred).

## Shipped

### KRN-02 — L-shaped roof 3D mesh — `done`

- Added `gable_pitched_l_shape` to `RoofGeometryMode` (Python + `packages/core/src/index.ts`).
- New validator `assert_valid_l_shape_footprint_mm` — six vertices, axis-aligned, exactly one reflex corner. Engine `CreateRoofCmd` enforces it for the new mode.
- `roof_geometry_support_token_v0` now emits `gable_pitched_l_shape_supported` (new token) instead of `valley_candidate_deferred` for the matched case.
- Renderer dispatches L-shape mesh whenever the explicit mode is set; the existing compactness-ratio inference still covers the legacy auto-detect path for `gable_pitched_rectangle`.
- Tests: `packages/web/src/viewport/meshBuilders.lShapeRoof.test.ts` (3 tests) + new cases in `app/tests/test_roof_pitch_evidence.py`.

### KRN-03 — Hip roof on convex polygon — `done`

- Added `'hip'` to Python `RoofGeometryMode` (TS already had it).
- Engine `CreateRoofCmd` validates convex polygon ≥ 4 vertices via `assert_valid_hip_footprint_mm`.
- `roof_geometry_support_token_v0` now emits `hip_supported` for hip mode + convex polygon.
- New mesh helper `_buildHipPolygonGeometry` — pavilion roof: each polygon edge becomes a sloped triangular face whose apex is the polygon centroid lifted by `inradius * tan(slope)`. Existing AABB hip helper still serves 4-vertex rectangles.
- Tests: `packages/web/src/viewport/meshBuilders.hipRoof.test.ts` (3 tests, hexagon footprint) + new cases in `app/tests/test_roof_pitch_evidence.py`.

### KRN-07 — Multi-run stairs — `partial`

- New types `StairRun` + `StairLanding` (Python `bim_ai.elements` + TS `@bim-ai/core`).
- `StairElem` extended with `shape: 'straight' | 'l_shape' | 'u_shape' | 'spiral' | 'sketch'` (defaults `straight`), `runs[]`, `landings[]`.
- `CreateStairCmd` accepts the new fields.
- Engine helper `_materialize_stair_runs_and_landings`:
  - Auto-derives a single straight run from legacy `runStartMm/runEndMm` when shape is `straight` and `runs` omitted.
  - For shape `l_shape` / `u_shape` with caller-supplied runs but no landings, derives a square landing per gap from adjacent run endpoints + width.
- Renderer adds `_makeMultiRunStairMesh`: each run renders as an inclined flight (treads) and each landing as an extruded polygon at the elevation reached after the preceding flights. Legacy single-run code path preserved when `runs[]` is empty.
- Tests: `packages/web/src/viewport/meshBuilders.multiRunStair.test.ts` (4 tests) + `app/tests/test_create_stair_multi_run.py` (5 tests).

**Deferred (kept in `partial`):**

- Spiral run geometry — pure geometry exercise; the data model accepts `shape: 'spiral'`, no renderer slice yet.
- Sketch-driven runs/landings — needs Agent 4's SKT-01 propagation to reach `stair`.
- Plan symbology for spiral / winder stairs.

## Verification

- `pnpm --filter @bim-ai/web test` — 1970 passed (baseline 1956 + 14 new wave3-5 tests covering 3 new files; 187 test files).
- `pnpm --filter @bim-ai/web typecheck` — clean.
- `pnpm --filter @bim-ai/core build` — clean.
- `app/tests/` full suite — 1340 passed, 7 skipped.

## Merge protocol

- Commit 1: KRN-02 + KRN-03 — pushed to `wave3-5` then fast-forwarded `main`.
- Commit 2: KRN-07 — pushed to `wave3-5` then fast-forwarded `main`.
