# Nightshift Agent 1 — End-of-shift status

## Shipped (all on `main`)

| WP     | Title                                                                | Commit     | Tracker mark |
| ------ | -------------------------------------------------------------------- | ---------- | ------------ |
| KRN-11 | Asymmetric gable roof (ridge offset + per-side eave heights)         | `6681d797` | `97be08d1`   |
| IFC-01 | `roofTypeId` round-trip through IFC                                  | `750d72c1` | `b8e3efca`   |
| IFC-02 | Distinguish `gable_pitched_rectangle` / `asymmetric_gable` IFC body  | `fac1324f` | `0e7d8d70`   |

All three assigned WPs landed on `origin/main` with passing tests
(1519 web vitest tests, 36 IFC pytest tests, 18 roof pitch evidence tests,
plus broader IFC + glTF + roof + IDS sweeps).

## Per-WP detail

### KRN-11 — Asymmetric gable roof

- Added `'asymmetric_gable'` to the `roofGeometryMode` union in
  `packages/core/src/index.ts` and `app/bim_ai/roof_geometry.py`.
- New optional fields: `ridgeOffsetTransverseMm`, `eaveHeightLeftMm`,
  `eaveHeightRightMm` propagated through `Element`, `RoofElem`, and
  `CreateRoofCmd`. The engine inherits the rectangle-only footprint
  guard from `gable_pitched_rectangle`.
- Renderer: new `_buildAsymmetricGableGeometry` in
  `packages/web/src/viewport/meshBuilders.ts` produces a 3D mesh with
  the ridge offset transversely from center; `roofHeightAtPoint` adds an
  `asymmetric_gable` branch (used by gable-end window glazing).
- Section view (`section_projection_primitives.py`) emits
  `ridgeOffsetTransverseMm` and recomputes `ridgeRiseMm` / `ridgeZMm`
  from the offset + per-side eaves.
- Tests: `meshBuilders.asymmetricRoof.test.ts` (5 cases) +
  `test_replay_create_asymmetric_gable_persists_offset_and_eaves`,
  `test_section_roof_primitive_asymmetric_gable_carries_ridge_offset`,
  `test_asymmetric_gable_rejects_non_rectangle_footprint` in
  `app/tests/test_roof_pitch_evidence.py`.

### IFC-01 — `roofTypeId` round-trip through IFC

- `Pset_RoofCommon.Reference` is reserved for the kernel element id, so
  this introduces a separate `Pset_BimAiKernel` pset carrying
  `BimAiRoofTypeId` when a roof has a `roofTypeId`.
- Authoritative replay reads the property back in
  `build_kernel_ifc_authoritative_replay_sketch_v0_from_model` and
  passes it through `CreateRoofCmd.roofTypeId`.
- New `roofWithBimAiRoofTypeId` counter in
  `inspect_kernel_ifc_semantics()` `identityPsets`.
- Tests: `test_ifc_roof_type_id_round_trips_through_pset_bim_ai_kernel`
  and `test_ifc_roof_without_roof_type_id_does_not_emit_pset_bim_ai_kernel`.

### IFC-02 — Distinguish gable in IFC body

- Replaces the always-flat slab prism for `gable_pitched_rectangle` and
  `asymmetric_gable` modes with a proper `IfcExtrudedAreaSolid` whose
  swept area is a 3-vertex `IfcArbitraryClosedProfileDef` triangle
  (eave-eave-ridge in profile XY) and whose extrusion runs along the
  ridge axis. The placement matrix rotates the local frame so:
  - `ridgeAlongX`: local X→world Y, local Y→world Z, local Z→world X
  - `ridgeAlongZ`: local X→world X, local Y→world Z, local Z→world Y
- Receiving IFC tools (Solibri, Navisworks, etc.) can now distinguish a
  gable from a flat roof from the geometry alone.
- `Pset_BimAiKernel` adds `BimAiRoofGeometryMode` +
  `BimAiRoofPlanFootprintMm` (compact `x,y;x,y;…` string) +
  `BimAiRoofRidgeOffsetTransverseMm` + per-side eave heights so the
  authoritative replay recovers the kernel mode + outline without
  having to invert the gable extrusion's placement and triangular
  profile. `mass_box`, `flat`, `hip`, `l_shape` modes keep the existing
  slab prism.
- New `roofWithGablePitchedBodyV0` counter in inspection flags roofs
  whose body uses the new triangular profile.
- Tests: `test_ifc_gable_roof_emits_triangular_extrusion_body`,
  `test_ifc_flat_roof_does_not_emit_gable_body`,
  `test_ifc_gable_roof_geometry_mode_round_trips_through_replay`,
  `test_ifc_asymmetric_gable_roof_round_trips_offset_and_eaves`.

## Things to know

1. **Convention drift between renderer and Python kernel for default
   ridge axis.** The TypeScript renderer
   (`meshBuilders.ts:_buildGableGeometry`) defaults `ridgeAlongX` to
   `spanXm >= spanZm` (ridge parallel to the **longer** axis), while
   `bim_ai.roof_geometry.gable_half_run_mm_and_ridge_axis` defaults to
   ridge parallel to the **shorter** axis (its docstring says so). The
   IFC export and section/plan evidence follow the Python convention;
   the 3D mesh follows the renderer. Either both should match, or
   `RoofElem.ridgeAxis` should always be set explicitly. Worth tracking
   as a follow-up — not in scope for KRN-11 or IFC-01/02.

2. **`roofGeometryMode` round-trip via Pset_BimAiKernel rather than
   geometry inversion.** The IFC-02 replay path reads the original
   plan footprint and geometry mode from the bim-ai-namespaced pset
   instead of inverting the placement + profile. This is pragmatic and
   keeps the body the geometric source of truth (so receiving IFC tools
   see a real gable), but means a foreign tool that strips
   `Pset_BimAiKernel` would degrade the round-trip back to mass_box +
   the IFC body's actual outline. Acceptable trade-off given the spec's
   acceptance criterion is "verified by re-parsing the IFC and checking
   the body type / cross-section shape", which is satisfied
   independently of the pset.

3. **Pre-existing failure in `packages/web/e2e/*.spec.ts`:** four
   Playwright e2e files fail under `vitest run` with
   `test.describe() called here` errors (Playwright + vitest in the
   same project). Not introduced by this branch — unit suite is 1519
   passed.

## Total commits attributable to nightshift-1 on main

6 commits: 3 feature + 3 tracker. Listed under "Shipped" above.
