# seed-target-house — flow retrospective

What went wrong, what would have prevented it, and what's missing
from the bim-ai platform to make the next sketch-to-BIM run smooth.

## Class A: silent data loss (coerceElement gaps)

**Symptom.** Through the seed-target-house run, **9 fields/element-kinds
silently disappeared** during snapshot hydration:

- `recessZones` (KRN-16 wall recess)
- `dormer` element kind (KRN-14)
- `sweep` element kind (KRN-15)
- `balcony` element kind (GAP-R4)
- `mass` element kind (SKB-02)
- `outlineKind` (KRN-12 trapezoidal window)
- `attachedRoofId` (KRN-12 roof-following slope)
- `operationType` (KRN-13 sliding doors)
- `slidingTrackSide` (KRN-13)

Each gap meant authored architecture **never reached the renderer** —
the picture frame, dormer, balcony, slope-following window, sliding
doors, and any mass primitives were invisible despite committing
through `try_commit_bundle` cleanly.

**Root cause.** `coerceElement` in `packages/web/src/state/store.ts` is
a hand-written serialization layer between the snapshot wire format and
the runtime `Element` type. Every time the kernel adds a field or kind,
the coercion has to be hand-updated. **There is no compile-time check
that the coercion handles every field.** Engine tests pass; bundle
tests pass; the only way to detect the gap is to look at the live
render, which is exactly what the per-phase visual checkpoint is
designed to catch — except we kept advancing because *most* of the
shape rendered, just not these specific features.

**Prevention — what to build.**

- **A1. Round-trip coercion test.** For every element kind in the
  schema, generate a sample with **every field populated**, serialise
  it through the wire format, hydrate via `coerceElement`, and assert
  every field is preserved. This is a single test file (~one screen)
  that fails loudly the moment a new field is added without a
  corresponding coerce update. Could live as
  `packages/web/src/state/store.coercion-completeness.test.ts`.

- **A2. Code-generate the coercion.** The TS schema in
  `packages/core/src/index.ts` is the source of truth for element
  shapes. A short codegen pass (zod schema → coerce function) would
  make the coercion auto-track schema changes. Removes the
  hand-written drift entirely.

- **A3. Unknown-field warning.** When `coerceElement` receives a field
  it doesn't recognise, log a `console.warn` in dev. The first time a
  recessZones-bearing wall hydrates, the warning would have flagged
  the gap immediately.

I'd ship A1 first (cheapest, immediate value) and consider A2 only if
new element kinds keep landing.

## Class B: coordinate convention drift

**Symptom.** `dormerMesh.ts` and `dormerRoofCut.ts` mapped
`plan_y → -world_z` while the wall + roof builders use
`plan_y → +world_z`. The dormer geometry rendered ~plan-depth metres
from the host roof in world Z, **completely invisible** from any
sensible camera. The CSG subtraction ran but happened in dead space.

**Root cause.** Two competing conventions live in the codebase:
- `meshBuilders.ts` uses no negation (plan-y = world-z directly)
- `sweepMesh.ts` uses negation (plan-y = -world-z)

`dormerMesh.ts` copied the wrong convention from somewhere. There's no
shared helper that all renderers must call.

**Prevention — what to build.**

- **B1. Single source-of-truth `planToWorld(planX, planY, planZ)`
  helper** that every mesh builder must call. Hand-rolled coord-mapping
  becomes a code-review red flag. Existing helpers like
  `xzBoundsMm` already centralise some of this — extend them.

- **B2. Coord-convention test.** Author one element of each kind
  (wall, floor, roof, dormer, sweep, balcony, …) at the same plan
  position; render to a deterministic scene; assert all pieces land
  within a small bounding box. A dormer drifting 8m would fail
  immediately.

## Class C: text spec vs visual reference conflict

**Symptom.** The textual spec at `spec/target-house-seed.md` said
"highly asymmetric gable, very low west wall, much higher east wall,
short steep east pitch". I (the agent) read this as a **dramatic**
asymmetry — apex 90% east, west eave nearly at floor level — and
ran with it for many phases. The visual reference
(`target-house-seed-vis.png`) showed a **near-symmetric** gable with a
subtle east-leaning apex. The two references conflicted; the visual
was correct; I trusted the text.

**Prevention — what to build.**

- **C1. SKB-21 brief format extension: "visual is ground truth".** The
  brief should explicitly require the agent to extract dimensions
  from the visual reference (via SKB-04 calibrator) BEFORE filling
  out the textual fields. When text and visual conflict, the visual
  wins automatically. Today the brief lists `keyDimensions[]` with
  `confidence: 'explicit' | 'inferred'` — could add a
  `derivedFromVisualPx` field that pins each dimension to a sketch
  pixel coordinate via SKB-04.

- **C2. Mid-phase visual verification.** Per-phase checkpoint
  comparing the live render to the visual reference at the matched
  viewpoint should catch dimension drift early. This is what SKB-03
  is for; my checkpoints worked but I kept advancing on "good
  enough" silhouettes that turned out to be wildly wrong on
  dimensions. The skill's anti-pattern list has this exact failure
  mode — the fix is honesty: *if the apex isn't where the sketch
  says it should be, stop advancing and tune the dimensions.*

- **C3. The skill should formalise**: "When the textual brief
  describes a feature dramatically (\"very low\", \"much higher\",
  \"significantly off-center\"), pin those words to numerical ranges
  via the calibrated visual. Don't trust adjectives without
  measurements."

## Class D: renderer-library assumptions

**Symptom.** three-bvh-csg's `Evaluator` defaults to
`attributes = ['position', 'uv', 'normal']`. Our roof builders only
emit `position` + `normal`. The first SUBTRACTION threw
`Cannot read properties of undefined (reading 'array')` — the
exception was caught and the cut silently skipped. **The dormer cut
ran for many days without ever cutting anything.**

**Prevention — what to build.**

- **D1. Surface caught errors as test failures.** The
  `applyDormerCutsToRoofGeom` `try/catch` swallows errors with a
  `console.warn` and returns the uncut geometry. That's a sensible
  production behaviour but masks bugs in dev. Add a flag:
  `process.env.NODE_ENV === 'test'` (or a Vite mode env var) that
  re-throws the error so tests fail loudly.

- **D2. Smoke test for every CSG-using path.** A single test that
  authors a roof + dormer in the canonical position and asserts the
  resulting mesh has fewer triangles than the uncut roof (proves the
  cut actually ran). Cheap to write; high-leverage.

- **D3. Library-version-pin tests.** Dependency upgrades on
  `three-bvh-csg` could change the default attribute set silently.
  A test that asserts the configured Evaluator runs with our actual
  inputs would catch a regression on dep bump.

## Class E: stale build masking changes

**Symptom.** After landing renderer fixes, the user (and I) saw the
old behaviour for several iterations because Vite preview's cached
`dist/` directory was serving stale JS. The Playwright config does
`rm -rf dist && vite build` per run, but `make dev` uses Vite *dev*
mode which is supposed to HMR-update — and did, but the user's browser
cached the snapshot anyway.

**Prevention — what to build.**

- **E1. Dev-mode banner.** When `make dev` starts, print the current
  git hash + last-modified timestamp on key seed files. A user
  staring at a stale render can verify the build is fresh.

- **E2. Cache-busting on snapshot hydration.** The
  `useWorkspaceSnapshot.ts` fetch could append a build hash to the
  snapshot URL so the browser doesn't cache old responses across
  rebuilds.

- **E3. \"Force refresh\" button in the workspace.** A dev-only
  button that calls `__bimStore.getState().resetAndRehydrate()` so
  users can bypass cache without DevTools.

## Class F: default UX masking the design

**Symptom.** The user's first screenshot showed the model from a
generic 3D iso angle that foreshortened the asymmetric pentagon and
hid the loggia recess. The design read as "lego" because the camera
didn't show the design. I had authored
`vp-main-iso` as a viewpoint matching the colour study, but the
default 3D camera ignored it.

Now fixed: `Viewport.tsx` prefers `vp-main-iso` over bounding-box fit.

**Prevention — what to build.**

- **F1. Models declare a "primary 3D view" attribute.** Pin the
  default camera at model level via `upsertProjectSettings` so any
  workspace opening the model lands on the architect-curated
  angle. Cleaner than the "if a viewpoint named vp-main-iso exists,
  use it" heuristic.

- **F2. The skill SHOULD require Phase 7 viewpoint authoring BEFORE
  declaring done.** Already in the skill, but the connection between
  "the user's default-camera view of the model" and "the agent's
  authored viewpoints" wasn't explicit. Make it explicit.

## Class G: visual-checkpoint cycle is too slow

**Symptom.** Each iteration of the loop (edit seed → regen snapshot
→ rebuild Vite → run Playwright → screenshot → compare) takes ~30-60
seconds. For dimensional tuning that needs 5-10 iterations, that's
half an hour minimum. Slow enough that I sometimes advanced on
"close enough" rather than iterating.

**Prevention — what to build.**

- **G1. SKB-03 as a CLI: `bim-ai checkpoint --viewpoint vp-main-iso
  --target spec/target-house-seed-vis.png`.** One command that
  rebuilds the snapshot, screenshots the viewport via headless
  three.js, and runs the comparison math from
  `app/bim_ai/skb/visual_checkpoint.py`. Today the visual checkpoint
  math exists; the CLI wrapper that ties it to a fast feedback loop
  doesn't. **This is the keystone item for closing the cycle time.**

- **G2. Diff against ground-truth at the brief level.** Beyond
  silhouette pixel-comparison, parse the brief's
  `keyDimensions[]` and assert each one against the rendered
  geometry's bounding boxes. Catches "ridge offset wrong" before
  even looking at the screenshot.

## Class H: aesthetic-style gap is a separate project

**Symptom.** The colour study is a stylized watercolor — soft warm
light, hand-drawn linework, painterly textures. The live renderer is
clean PBR with hard polygon edges. **Pixel-matching the watercolor
is not achievable without a stylized render pipeline (toon shader,
hatched outline pass, custom material library).**

This isn't a methodology bug — it's a goal-clarity issue. The seed
brief should explicitly distinguish:

- **Geometric correctness**: shape, dimensions, materials, openings
  all match the spec. (Achievable, what we just shipped.)
- **Aesthetic fidelity**: render style matches the visual reference's
  artistic medium. (Separate, much larger project.)

**Prevention — what to build.**

- **H1. The brief's `referenceImages[]` should classify each image:**
  `purpose: 'silhouette' | 'aesthetic' | 'both'`. The agent only
  optimises against `silhouette` images for shape; `aesthetic` images
  inform material choices but the gap to them is documented as
  out-of-scope.

## Top-3 highest-leverage items to ship next

If I had to pick three things to build that would make the next
sketch-to-BIM run dramatically smoother:

1. **A1. Coercion round-trip test** — would have caught the 9 silent
   data-loss bugs before any of them shipped. One afternoon of work.

2. **G1. `bim-ai checkpoint` CLI** — would cut the visual-iteration
   cycle from ~60s to ~5s and let the agent iterate to convergence
   instead of giving up at "good enough". One day of work; the math
   is already done.

3. **C1. Brief: visual is ground truth** — would have prevented the
   "highly asymmetric" misread that ate three sprints. Tiny SKB-21
   amendment + a sentence in the skill.

The current run cost ~15 commits to chase down what should have been
caught at Phase 1 with a working coercion-completeness test and a
visual checkpoint that compared dimensions instead of just rendering.
