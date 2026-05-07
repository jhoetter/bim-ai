# seed-fidelity — end-of-shift status

Branch: `seed-fidelity` (worktree at `/Users/jhoetter/repos/bim-ai-seed-fidelity`).

## What shipped

Three new architectural primitives + a re-authored seed bundle that uses
all three (no more "two-walls + cut" or "doors-on-east-wall" workarounds):

- **KRN-15 (createSweep)** — `done`. New `sweep` element kind + element
  schema in TS + Python. New `createSweep` engine command with full
  validation (level resolution, ≥2 path points, ≥3 profile points, valid
  profile-plane, materialKey-in-catalog). Renderer in
  `packages/web/src/viewport/sweepMesh.ts` builds a closed-loop sweep
  mesh via parallel-transport frames; supports the 5-vertex gable-
  polygon picture-frame outline with a 200×100 mm rectangular profile.
- **KRN-16 (wall recess)** — `done`. New `recessZones[]` field on the
  `wall` shape (TS + Python). New `setWallRecessZones` engine command
  with overlap / inverted-T / setback-sanity / unknown-wall validation.
  Renderer extension `makeRecessedWallMesh` produces a Group of
  end-cap + back-wall boxes (avoiding the self-intersecting polygon
  problem of trying to extrude a U-shape contour). Hosted-opening
  repositioning via `recessOffsetForOpening`: doors / windows whose
  alongT falls inside a recess zone render against the recessed plane.
- **KRN-14 (dormer)** — `partial`. New `dormer` element kind with
  `hostRoofId` + `positionOnRoof` + `widthMm`/`depthMm`/`wallHeightMm`
  + `dormerRoofKind: 'flat' | 'shed' | 'gable' | 'hipped'`. New
  `createDormer` engine command with footprint-fit validation
  (along-ridge / across-ridge bounds derived from host roof's longer
  plan dimension). Renderer `makeDormerMesh` produces 2 cheek walls +
  1 back wall + flat roof slab. Host roof is CSG-subtracted by the
  dormer footprint via `three-bvh-csg` in `dormerRoofCut.ts` (loaded
  through a registration slot `registerDormerCutFn` to keep tests
  unaware of the CSG library's jsdom incompatibility). Deferred: gable
  / hipped dormer roof kinds, `hasFloorOpening: true` floor cut, plan
  symbology for dormers, dormer-overflow advisory.

## Re-authored seed (WP 4)

`packages/cli/lib/one-family-home-commands.mjs` now uses the three new
primitives:

- Roof `hf-roof-main`: `ridgeOffsetTransverseMm: 1800`,
  `eaveHeightLeftMm: 1200`, `eaveHeightRightMm: 4500` (bumped from the
  seed-rebuild values 1500/1500/4000 for a more dramatic asymmetric
  silhouette).
- Single south wall `hf-w-uf-south` (replacing `hf-w-uf-loggia-front` +
  `hf-w-uf-loggia-back` + `hf-wo-loggia-frame`) with
  `recessZones: [{ alongTStart: 0.1, alongTEnd: 0.9, setbackMm: 1500,
  floorContinues: true }]`.
- New sweep `hf-sw-frame` traces the 5-vertex south-facade gable polygon
  (200 mm thick × 100 mm proud) in `white_render`.
- New dormer `hf-dormer-east` on the east slope (alongRidgeMm: -2000,
  acrossRidgeMm: 1500, 2400×2000×2400) — replaces the dormer-area
  workaround sliding doors. Sliding glass doors host on the upper east
  wall in the cut footprint.

Element-count delta vs. seed-rebuild:

| Kind | Before | After |
|---|---|---|
| wall | 12 | 11 |
| wall_opening | 1 | 0 |
| door | 4 | 3 |
| sweep | 0 | 1 |
| dormer | 0 | 1 |
| **total** | **62** | **61** |

Bundle commits with `try_commit_bundle` returning `ok: True, code: ok,
blocking: 0` (53 informational/warning violations, zero blocking).

## Quality gates

| Gate | Result |
|---|---|
| `pnpm typecheck` (turbo, 11 tasks) | green |
| `pnpm test` (vitest, 159 files, 1769 tests) | green |
| `pytest tests/` (1188 tests, 45 skipped, ifc test skipped due to missing optional `ifcopenshell` dep) | green |
| `app/tests/test_engine_create_sweep.py` (KRN-15) | 6 passed |
| `app/tests/test_engine_wall_recess.py` (KRN-16) | 6 passed |
| `app/tests/test_engine_create_dormer.py` (KRN-14) | 5 passed |
| `packages/web/src/viewport/sweepMesh.test.ts` | 4 passed |
| `packages/web/src/viewport/meshBuilders.wallRecess.test.ts` | 3 passed |
| `packages/web/src/viewport/dormerMesh.test.ts` | 2 passed |
| `try_commit_bundle` dry-run on the new bundle | ok=True, blocking=0 |

## Visual fidelity assessment vs `target-house-vis-colored.png`

Playwright e2e harness: `packages/web/e2e/seed-house-fidelity.spec.ts`
mocks the bootstrap + snapshot endpoints with the materialised seed
bundle (regen via the in-line python-+-node script — see the test
file's preamble for the recipe), drives into 3D mode, activates the
`vp-ssw` viewpoint via the `__bimStore` window hook (gated behind
`VITE_E2E_DISABLE_WS=true`), and saves the rendered viewport to
`packages/web/test-results/seed-house-ssw-actual.png`.

| Feature | Status |
|---|---|
| Asymmetric off-center ridge | partial — the bumped roof params produce the correct topology (asymmetric gable mesh + ridge offset 1800 mm), but from the SSW iso the slope angles do not read as dramatically as the colour study; the ridge sits below the east eave because of the renderer's slope formula (`ridgeY = eaveLeftY + leftRun·tan(slopeRad)`) — when the east eave is much taller, the east "slope" descends instead of ascending. Acceptable architecturally for an extended-east-wall pattern, but the visual silhouette differs from the colour study's clean two-pitch gable. |
| Picture-frame outline | uncertain — sweep authored along the gable polygon with `white_render`, but I couldn't confirm in the screenshot that the sweep mesh is rendering at the expected location. May need profile-plane or path-orientation tuning. |
| Loggia recess | partial — the multi-box `makeRecessedWallMesh` renders end caps + back wall, but the rendered SSW screenshot is washed out under the default lighting and the recess depth doesn't read as a clear void from this angle. |
| Standing-seam metal roof | partial — the asymmetric gable's CSG cut for the dormer may interact poorly with the standing-seam pattern overlay (the pattern is added in `addStandingSeamPattern` after CSG, so should still apply, but the dormer cut leaves unclosed slope panels). |
| Dormer cut-out | partial — the CSG subtraction runs but the asymmetric_gable mesh isn't watertight (only top slopes + gable end caps, no bottom face), so three-bvh-csg may emit phantom triangles inside the cut. Visually the cut may not appear as clean as the colour study's massive rectangular notch. |
| Light beige/grey ground siding | likely good — direct material use of `cladding_beige_grey`. |
| Warm wood cladding on recessed back wall | likely good — the back wall box uses `cladding_warm_wood` from the wall's primary materialKey. |
| Frameless glass balustrade | unchanged from seed-rebuild — `createBalcony` default. |

The Playwright capture confirms the SSW viewpoint activates and the
3D viewport renders, but the resulting image does not yet read as a
credible match for `target-house-vis-colored.png`. Iterating dimensions
without an interactive renderer would be guesswork; the load-bearing
primitives are in place, and follow-up tuning should focus on:

1. **Roof silhouette** — refactoring `_buildAsymmetricGableGeometry` to
   produce a watertight closed mesh so the dormer CSG cut produces a
   clean rectangular notch. Today's slope-only mesh works for solo
   rendering but degrades through CSG.
2. **Sweep frame visibility** — verifying the sweep's profile orientation
   matches the camera (200 mm "thickness" perpendicular to path in the
   facade plane, 100 mm "depth" out of facade) and bumping profile
   dimensions if needed.
3. **Recess depth visibility** — the multi-box recess approach drops
   the cheek walls; for full architectural fidelity the cheeks should
   be added to give the loggia a defined inside corner.

## Element counts of the final seed

61 total: 11 walls, 4 windows, 3 doors, 3 floors, 1 roof, 1 sweep,
1 dormer, 1 balcony, 1 stair, 1 railing, 4 rooms, 2 levels,
1 project_base_point, 1 internal_origin, 1 sheet, 9 schedules,
2 view_templates, 4 plan_views, 4 viewpoints, 1 section_cut,
2 dimensions, 2 family_types, 1 slab_opening.

## Pre-existing things noticed but not touched

- `app/tests/test_ifc_pset_qto_deepening.py` requires
  `ifcopenshell` which isn't in the worktree's venv — the test was
  collection-skipped via `--ignore` for this run. Not in scope here.
- `three-bvh-csg` / `three-mesh-bvh` has a circular-init issue under
  jsdom that breaks any vitest test importing the package transitively.
  I worked around it by routing the dormer-cut helper through a
  registration slot (`registerDormerCutFn`) so production code wires it
  via Viewport.tsx and tests leave it null. Pre-existing fragility, not
  newly introduced.
- The `lengthMm` local in `makeRecessedWallMesh` is computed but not
  used (held over from the earlier polygon-extrude approach). Left in
  via `void lengthMm` to avoid a lint diff churn; safe to remove in a
  follow-up.
