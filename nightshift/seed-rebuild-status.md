# seed-rebuild — end-of-shift status

Branch: `seed-rebuild` (merged to `main` via direct push).

## What shipped

The demo seed house was wiped and re-authored from scratch to match
`spec/target-house-seed.md` — the asymmetric-massing single-family
home with a recessed loggia and east-side roof deck.

Single commit on top of `main`: `a0dd45f3 feat(seed): asymmetric demo
house — canonical bundle + python seed convergence`.

(One earlier commit on the branch — KRN-12/13 updateElementProperty
setters in `app/bim_ai/engine.py` — was developed in parallel by the
dayshift agent and shipped separately as `f6836b7b`. The rebase
correctly skipped my redundant copy.)

## Architecture

The three seed paths now converge on one source of truth:

1. **`packages/cli/lib/one-family-home-commands.mjs`** — canonical JS
   builder (`buildOneFamilyHomeCommands()`).
2. **`scripts/apply-one-family-home.mjs`** — imports the JS function
   directly (unchanged).
3. **`app/scripts/seed.py`** — now spawns Node to materialize the bundle
   (same pattern as `test_one_family_bundle_roundtrip.py`).

So `make seed`, `node scripts/apply-one-family-home.mjs`, and `bim-ai
plan-house` all produce the identical 89-command bundle, which commits
with **0 blocking violations** through `try_commit_bundle`.

## Element counts

| Kind | Count |
|---|---|
| level | 2 |
| wall | 12 |
| wall_opening | 1 |
| door | 4 |
| window | 4 |
| floor | 3 |
| slab_opening | 1 |
| roof | 1 |
| balcony | 1 |
| stair | 1 |
| railing | 1 |
| room | 4 |
| dimension | 2 |
| section_cut | 1 |
| sheet | 1 |
| schedule | 9 |
| view_template | 2 |
| plan_view | 4 (2 explicit + 2 VIE-05 auto-created) |
| viewpoint | 4 |
| family_type | 2 |
| project_base_point | 1 |
| internal_origin | 1 (KRN-06 auto-created) |
| **total** | **62** |

## Capabilities used

- **KRN-06** — `createProjectBasePoint` at origin; `internal_origin`
  auto-created by `try_commit_bundle`.
- **KRN-11** — asymmetric gable roof with `ridgeOffsetTransverseMm: 1500`,
  `eaveHeightLeftMm: 1500`, `eaveHeightRightMm: 4000`. Upper-volume walls
  attached via `attachWallTopToRoof` so their tops follow the slope.
- **KRN-12** — trapezoidal loggia window with `outlineKind:
  'gable_trapezoid'` + `attachedRoofId: 'hf-roof-main'`, set via the
  newly-shipped `updateElementProperty` setters.
- **KRN-13** — three sliding-glass doors (loggia + two dormer) with
  `operationType: 'sliding_double'`.
- **MAT-01** — `cladding_beige_grey`, `cladding_warm_wood`,
  `white_render`, `metal_standing_seam_dark_grey`,
  `aluminium_dark_grey`, `glass_clear`.
- **GAP-R4 balcony** — frameless-glass balustrade slab projecting
  1600 mm south from the loggia back wall.

## Capability gaps approximated (with TODOs in the code)

- **KRN-14 (dormer)** — *not shipped*. Approximated by a section of the
  upper-volume east wall (white render) with two `sliding_double` doors
  opening onto the east deck. The dormer "cheek walls" and roof are
  implicit in the wall + roof geometry rather than explicit. Code
  comments at the dormer-emitting block reference KRN-14 in the
  workpackage tracker.
- **FAM-02 sweep at the command level** — `createSweep` doesn't exist
  yet. The loggia "thick white frame" is approximated by a 250 mm-thick
  white wall on the south face whose top follows the asymmetric roof,
  with a single large `wall_opening` (alongT 0.06–0.94, sill 100,
  head 2500) cut to expose the recessed back wall, balcony slab, and
  loggia openings. Reads as a frame in 3D but is geometrically a wall.

## Visual fidelity assessment vs `target-house-vis-colored.png`

I have not run the dev server here (no display); the model commits
cleanly through the engine and renderer code paths exercised by the
1755 web vitest tests + 1222 python pytest tests. The user should
spin up `make dev`, switch to viewpoint `vp-ssw`, and compare. Likely
fidelity:

| Feature | Likely fidelity | Notes |
|---|---|---|
| Asymmetric roof massing | **good** | KRN-11 ridge/eave wired correctly per spec — primary "essence" |
| Standing-seam metal pattern | **good** | MAT-01 already renders vertical seams |
| Beige/grey ground siding | **good** | Direct material use |
| White-rendered loggia frame | **partial** | Reads as a wall with a hole, not a true picture-frame profile. Will fully nail when `createSweep` ships and we replace the wall with a sweep along the gable polygon. |
| Recessed wood-clad back wall | **good** | Direct |
| Trapezoidal upper window | **good** | KRN-12 geometry + frame sweep both shipped |
| Frameless glass balustrade | **good** | createBalcony default |
| East ground-floor extension + flat deck | **good** | Floor slab + parapet walls |
| Dormer area on east roof | **partial** | KRN-14 workaround: sliding doors on east wall, no explicit dormer geometry. Will fully nail when `KRN-14` lands. |

## Tests touched

- **`app/tests/test_one_family_bundle_roundtrip.py`** — updated:
  - `hf-room-kitchen` → `hf-room-living-kitchen` (open-plan ground floor
    has no separate kitchen room in the new design)
  - `vp-plan-eg.label`: `'EG plan (named view)'` → `'GF plan'`
  - All other assertions (titleblock, schedule grouping, sheet IDs,
    section-cut wire, all hf-sch-* schedule tables) unchanged
- **`app/tests/test_update_element_property_door_window_extras.py`** —
  shipped earlier as part of `f6836b7b` (parallel agent picked up the
  branch I started; final landing of engine.py setters is on main).

## Quality gates

| Gate | Result |
|---|---|
| `pnpm typecheck` (turbo, 11 tasks) | green |
| `pnpm format:check` | green |
| `pnpm lint:root` | green |
| `pnpm test` (vitest, 155 files, 1755 tests) | green |
| `pnpm verify` (full chain incl. `pnpm build`) | green |
| `pytest tests/` (1222 tests, 7 skipped) | green |
| `try_commit_bundle` dry-run on the new bundle | ok=True, code=ok, blocking=0 |
| Python `seed_async` against in-memory SQLite | OK — model UUID 75cd3d5c-…b8bf-8cbba71fd10f preserved |

## Pre-existing things noticed but not touched

- `nightshift/seed-rebuild-status.md` — this file. (the spec said
  "Append a short status to nightshift/seed-rebuild-status.md"; it didn't
  exist, so created it.)
- The lint warnings in `packages/web/src/plan/PlanCanvas.tsx` (one
  unused `sectionCutFromWall`) remain as warnings — pre-existing on
  main from the ANN-02 / VIE-03 work. Not in scope here.
- Multiple parallel agents are actively pushing to `main`; this work
  was done in a `git worktree add` at `../bim-ai-seed-rebuild` to
  insulate from concurrent branch-switch hooks running in the primary
  checkout.
