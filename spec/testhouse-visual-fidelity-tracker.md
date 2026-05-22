# Testhouse Visual-Fidelity Tracker

Persistent state for the multi-iteration "make the three testhouse
BIM models actually look like the source PDFs" effort. Picks up
where `spec/testhouse-hybrid-reverse-bim-tracker.md` left off after
iter-2 acceptance gates passed.

## Methodology recap

The orchestrating LLM agent owns one persistent loop:

1. **Audit** the live canonical iter-5 model (REST `query/elements`
   + `query/views`) against per-house gap criteria.
2. **Dispatch** subagents in parallel — one per (house × gap dimension)
   — with explicit canonical-building-frame contracts in every prompt.
3. **Ingest** subagent responses and apply commands to the live model.
4. **Re-audit** + **re-capture** (Playwright) + **visual-diff** subagent
   that scores fidelity against source pages.
5. Iterate until visual-diff subagent scores ≥ 7/10 per house OR a
   per-(house, gap) retry budget is hit.

Per-iteration scripts live under `scripts/testhouse_iter{N}_*.py` and
the orchestrator can resume across context resets via the JSON state
files under `tmp/reverse-bim/`.

## Iteration history

| Iter | Subject | Files | Net effect |
|------|---------|-------|------------|
| 1 | Source ingest + page classify | iter-1 fact ledgers | Per-house architectural facts extracted |
| 2 | Authored Document → final acceptance | various | 11/11 gates passed (synthesized) |
| 3 | Convergence loop + view evidence | `testhouse_convergence_pass.py` | Real Playwright capture + 8 gates → terminal accepted |
| 4 | Room/opening/partition readers | iter-3 numeric reader prompts | Rooms / openings / partitions on accepted models |
| 5 | **Canonical rebuild** — fix coord-frame chaos | `testhouse_iter5_canonical_rebuild.py` | One coherent building frame per house; alpha east-half only, gamma 18×8 |
| 5 | Quality-loop with canonical-frame contracts | `testhouse_iter5_quality_loop.py` | 9 room + 9 opening + 6 partition reader subagents → 64 rooms / 91 walls / 27 doors / 29 windows |
| 6 | Visual-iteration loop driver | `testhouse_iter6_visual_loop.py` | 9 visual-diff subagents — surfaced that URL routing was broken |
| 6 | **Bootstrap honor `?modelId=`** | `useWorkspaceSnapshot.ts` patch | User finally sees the testhouse instead of the empty default seed library |
| 7 | Real gable roofs | `testhouse_iter7_roof_upgrade.py` | Alpha + beta switched from mass_box → gable_pitched_rectangle |
| 8 | Toposolid + wall_types + assignments | `testhouse_iter8_site.py` + `iter8b_assign_types.py` | Ground plane + brick exterior + drywall interior on 91 walls |
| 9 | Deep-corrector subagents | `testhouse_iter9_apply_correctors.py` | Per-house targeted fixes: alpha 6/7, beta 8/10, gamma 5/10 commands applied |
| 10 | **Normalizer + rewriter + remapper pipeline** | `testhouse_command_normalize.py` + `testhouse_iter10_apply.py` | Replays saved iter-9 corrector JSONs through pre-flight normalization: **alpha 7/7, beta 9/10, gamma 10/10** commands applied (26/27 vs iter-9 baseline 19/27). Surfaced the kernel's two-casing convention + multiple hallucinated commands (`createMassBox`, `createWindow`) as systemic methodology gaps. Beta's last failure is a real garage/house wall-overlap (deferred to iter-11). |
| 10b | Bundle-level dormer-position recenter + capture-canvas fix | `_recenter_bundle_dormer_positions` + `testhouse_iter10_capture.mjs` largest-canvas selector | After cmdline says 10/10 applied, first visual capture showed plain gabled boxes — exposed two bugs: (1) per-value recenter missed values that didn't overflow but were still world-coords (fix: detect frame per-axis from population); (2) capture clipped the navigation-cube widget not the 3D viewport (fix: largest-canvas selector). After both: gamma visibly has 4 dormers + balcony + sloped site; alpha shows 1 Schleppgaube; beta shows attached garage volume. |
| 11 | **Per-view capture + subagent visual scoring** | `testhouse_iter11_capture.mjs` + `Workspace.tsx` URL-param view activation + 3 visual-diff subagents | Re-added `?activeElevationView=<id>` URL handling (had been dropped since iter-3), captured 3D + 4 elevations per house, dispatched 3 visual-diff subagents with source PDFs attached. Subagent scores **confirmed iter-10's by-hand judgment** (alpha 3/10, beta 3/10, gamma 5/10) — and independently surfaced a **major upstream gap**: alpha is "Zweifamilien-Doppelwohnhaus" and gamma is "Wohn- und Praxisgebäude mit Carport als Doppelhaushälfte" per their German source title blocks — both modeled as freestanding solos. Iter-1's fact ledger missed both typology declarations. |

## Honest fidelity scoring (after iter-10, measured by hand)

After iter-10's pipeline + the capture-tool fix. Two scores per house —
"commands applied" is the bundle-commit success rate, "visual fidelity"
is by-eye comparison of cropped 3D viewport screenshots against source
PDF pages from `testhouses/house-{alpha,beta,gamma}/`.

| House | Cmds applied | Visual fidelity | What reads right | What still doesn't |
|-------|-------------:|----------------:|---|---|
| alpha | 7/7 | **~3/10** | Gable roof, brown tile colour, sloped toposolid, 1 Schleppgaube on the Berg slope, 1 Wohnzimmer window inserted on east gable | Window grid sparse (~2 vs source's ~5-6 per facade), 2nd Schleppgaube hidden from default camera angle, no Tal-side dormer visible from this angle, no 2nd Doppelhaus half (we modeled only the east half), no interior partitions, no door details |
| beta  | 9/10 | **~3/10** | Gable roof, attached garage volume reads as a low secondary mass, south terrace slab visible | Garage looks like a low wall not a proper flat-roofed garage, no eaves overhang visible at this scale, no railings, terrain reads flat (graded region not visually pronounced), south sliders barely register, no interior |
| gamma | 10/10 | **~5/10** | **All 4 Dachgauben properly positioned on the right slopes (recenter fix landed)**, balcony cantilever visible at the south end, sloped graded region visible (darker green patch), proper long-roof proportions, windows in long facade | No gable-end ornate window, dormers render as gable not arched, no railings on balconies, no Praxis porch canopy, no Stahl-Spindel-Treppe (kernel doesn't support helical stairs) |

Overall: gamma is now genuinely the front-runner (the iter-9 + iter-10
work landed). Alpha + beta are bare because we skipped the iter-5 quality
loop (rooms + interior partitions + window grids) on the rebuild — they
have ONLY perimeter walls + iter-9-corrector additions, no actual room
fenestration density.

## Iter-11 subagent-graded fidelity scoring

Three visual-diff subagents (one per house) read the 5 model captures
(3D + 4 elevations) plus the source PDF rendered pages and scored on
the 0-10 rubric. Per-house full reports in
`tmp/reverse-bim/iter-11-scoring/{alpha,beta,gamma}-subagent-report.md`.

| House | iter-10 by-hand | iter-11 subagent | Largest single gap surfaced |
|-------|----------------:|-----------------:|---|
| alpha | ~3/10 | **3/10** | Source title block reads "Zweifamilien-Doppelwohnhaus" — model is only the east half |
| beta  | ~3/10 | **3/10** | Garage volume reads as a low parapet (not a 2.5–3 m flat-roofed garage); zero windows on long east/west facades despite 9/10 cmds applied |
| gamma | ~5/10 | **5/10** | Source title block reads "Wohn- und Praxisgebäude mit Carport als Doppelhaushälfte" — model has no carport, no party wall, no Praxis cross-gable wing |

The subagent scores confirm the iter-10 by-hand judgment without lift —
**fidelity has not improved between iter-10 and iter-11 because iter-11
did not author new geometry, only added measurement instruments**. The
subagent dispatches were worth doing anyway: they surfaced the Doppelhaus
typology miss on both alpha and gamma (a single root cause for ~half of
each house's named gap list).

Cross-cutting subagent findings (independently named by ≥ 2 of the 3):

- **Window rhythm on long facades is empty** even where iter-10 said
  cmds applied — suggests the iter-9 corrector emissions did not cover
  the long facades, OR commands applied but rendered out-of-camera
  (see methodology #14 below).
- **Eaves overhang absent** on all three houses; source elevations
  consistently show 400–600 mm overhang. Single `createRoof` re-emit
  with `overhangMm: 500` would lift every silhouette.
- **Materials read as monochrome white** except for the iter-10 alpha
  brown tile + gamma graded region patch; no wood-clad gable peaks,
  no clay-tile roof colour, no brick textures.
- **Elevation view-template renders as schematic wireframe stubs**,
  not as filled shaded elevations. Scoring elevations off this output
  understates fidelity — see methodology learning #13 below.

## Remaining gap inventory (priority-sorted)

### P0 — schema-breaking blockers

- **[gamma] createDormer schema** — current emitted command rejected
  with `ridgeHeightMm must be > 0 when dormerRoofKind is 'gable' or
  'hipped'`. Add `ridgeHeightMm` to the iter-9 corrector retry pass.
  → fixes 4 missing gamma dormers.
- **[gamma] createGradedRegion schema** — corrector emitted an
  unrecognized command shape; the kernel rejects with a validation
  error. Either switch to `UpdateToposolid` with multi-zone
  heightSamples or drop the regional terrain grading.
- **[alpha] CreateToposolid casing** — corrector used lowercase
  `createToposolid`; kernel expects `CreateToposolid`. Trivial fix.
- **[beta] door_clearance_conflict** — two iter-9 commands tripped a
  WARNING-severity violation that the bundle applier treats as
  blocking. Either move the conflicting interior door or relax the
  applier to ignore warnings during corrector replay.

### P1 — visible massing per house

- **[alpha] Gable axis verification** — re-read source elevations and
  confirm whether the gable points east-west (eaves-front, current
  model) or north-south (gable-end-front, what the visual-diff
  subagent thinks the source shows). If wrong, rotate roof 90°.
- **[alpha] Schleppgaube visibility** — dormers were authored as
  mass_box on the roof slope but the visual-diff subagent doesn't see
  them. Likely positioned inside the roof envelope and clipped.
  Need to position them ABOVE the roof slope, projecting outward.
- **[gamma] Ornate gable-end window** — source elevation shows an
  arched / circular ornamental window on the gable end. Currently
  blank. Add via insertWindowOnWall after schema-correct dormer pass.

### P2 — window rhythm per facade

For each house, dispatch a `facade_window_rhythm_reader` subagent
that reads the relevant elevation source page and re-emits insertWindow
commands on the correct facade with the correct count, spacing, and
size. Replace the iter-5 punched-grid placements that don't match.

- **alpha east gable** — re-read; place Wohnzimmer 1500×1500 + verify
  Kinderzimmer + Bad windows.
- **beta south facade** — replace small punched windows in the
  Wohnen/Essen zone with the 2400×2100 sliders authored in iter-9
  (currently the small ones are still there in addition).
- **gamma long-side rhythm** — south facade has ~6 bays per source;
  model has 7 windows total scattered. Re-emit per source elevation.

### P3 — terrain detail

- **[beta] terrain slope** — toposolid was authored sloped but the
  visual-diff subagent doesn't see the slope render. Verify height
  samples actually create a tilted surface in the viewer.
- **[gamma] hillside grading** — Lageplan (site plan) shows specific
  contour terraces; currently flat at z=-150.

### P4 — balcony + railing detail

- **[gamma] balcony railings** — slabs are present but no railing /
  parapet authored. Try `createRailing` (verify schema first).
- **[gamma] Stahl-Spindel-Treppe** — kernel has no helical stair
  subkind. Deferred or approximate with mass_box helix.

### P5 — interior detail (low visual impact in 3D view)

- Stairs (no createStair authored anywhere yet)
- Wall material differentiation by room (e.g. Bad → tile finish)
- Furniture / fixtures (out of scope for source-fidelity)

### P6 — gamma chamfer reconciliation

Live model has chamfer at NE corner; canonical-frame spec says SE.
The iter-9 gamma corrector flagged this in `deferredTopics` but did
not resolve. Either flip the spec or rotate the wall_chain 180°.

## State files

| File | Purpose |
|------|---------|
| `tmp/reverse-bim/iter-5-quality-state.json` | iter-5 quality loop progress (rooms/openings/partitions per level) |
| `tmp/reverse-bim/iter-6-visual-state.json` | iter-6 visual-diff dispatch state |
| `tmp/reverse-bim/house-{alpha,beta,gamma}/iter-5-canonical-model.json` | Per-house canonical model UUID |
| `tmp/reverse-bim/iter-9-{house}-corrector.json` | Per-house deep-corrector response files |
| `tmp/reverse-bim/iter-6-prompts/*.txt` | Rendered prompts for visual-diff dispatches |
| `tmp/reverse-bim/iter-6-visual-diffs/*.json` | Visual-diff response files |

## Live model URLs (iter-5 canonical + iter-7+ visual fixes)

After commit `a658727c` the `?modelId=` URL param is honored. From
the user's Mac (SSH tunnel to ports 22000 + 28500):

**Caveat:** model IDs rotate every full rebuild (see methodology
learning #6 below). Current iter-10 IDs (regenerated 2026-05-22 from
clean DB):

- alpha: <http://127.0.0.1:22000/?modelId=167353c1-3ff8-495d-b011-6af30d9e6146>
- beta:  <http://127.0.0.1:22000/?modelId=bf8af4b8-3b80-4324-804e-ab46eb5d3a80>
- gamma: <http://127.0.0.1:22000/?modelId=ce021206-e7c2-4ba1-931e-ac1535ae4412>

To regenerate: `make dev-forwarded`, then
`python3 scripts/testhouse_iter5_canonical_rebuild.py && python3 scripts/testhouse_iter7_roof_upgrade.py && python3 scripts/testhouse_iter8_site.py && python3 scripts/testhouse_iter8b_assign_types.py && python3 scripts/testhouse_iter10_apply.py`
and read the model IDs from `tmp/reverse-bim/house-{alpha,beta,gamma}/iter-5-canonical-model.json`.

## Next-iteration plan

**iter-10** ✓ landed: pre-flight pipeline (remap → rewrite → normalize) lifted
saved iter-9 emissions to alpha 7/7, beta 9/10, gamma 10/10 without
re-dispatching subagents. See `tmp/reverse-bim/iter-10-{alpha,beta,gamma}-apply.json`
for per-command detail and the "Iter-10 methodology learnings" section
below for the systemic gaps that the pipeline now absorbs.

**iter-10 follow-ups** (small, geometric):

- Beta garage wall_overlap — rewrite garage as 3-segment chain reusing
  the house east wall, or shift garage west wall +250 mm to clear.
- Beta garage `physical_wall_outside_envelope` — add `allowDetached`
  intent flag (same family of issue as iter-9's balcony slabs that
  needed `allowDetached: true`).

**iter-11** ✓ landed: per-view capture + subagent visual scoring.
Re-added URL-driven view activation in `Workspace.tsx`, added
`testhouse_iter11_capture.mjs` (3D + 4 elevations per house), dispatched
3 visual-diff subagents with source PDFs attached. Scores confirmed
iter-10 baseline (alpha 3, beta 3, gamma 5). The methodology yield —
not score lift — is what made iter-11 worth running.

**iter-12** (typology rewrites — the single biggest remaining lift):

Both alpha and gamma are mis-typed at the canonical-rebuild layer.
Source title blocks declare:

- alpha: "Zweifamilien-Doppelwohnhaus" (two-family semi-detached pair).
  Currently modeled as the east half only.
- gamma: "Wohn- und Praxisgebäude mit Carport als Doppelhaushälfte"
  (residence + medical practice with carport, as a semi-detached half).
  Currently modeled as a freestanding solo, no carport, no Praxis wing.

Plan:

1. **Title-block parser** — extract building-class from source manifests
   for all three houses; persist in `building-class.json` per house.
   Confirms beta is "Einfamilienhaus" (which it already is).
2. **alpha Doppelhaus expansion** — mirror the east-half perimeter
   across x≈9500 mm to produce the full ~19000×6700 mm footprint,
   re-emit `createRoof` along the new long axis, add a central party
   wall (or party-wall stub at the mirror line). One bundle.
3. **gamma cross-gable + carport + party wall** — `createMassBox` +
   `createRoof` for the Praxis cross-wing at the east end;
   `createMassBox` for the carport (flat roof, open sides) abutting
   one gable end; a `createWall` party-wall stub on the opposite
   gable.
4. **beta garage rewrite (was iter-10 follow-up)** — rewrite garage
   as 3-segment chain sharing the house east wall + add the
   `allowDetached: true` intent flag from the quick-fix command.
   Set garage parapet height to ~2700 mm + flat slab roof element.
5. Apply through the iter-10 pipeline; re-capture; re-score with the
   same subagent dispatch. Target ≥ 5/10 per house, ≥ 6 for gamma.

**iter-13** (per-facade window rhythm):

1. Dispatch per-facade `window_rhythm_reader` subagents (3 houses ×
   ~4 facades each ≈ 12 dispatches). Use the dispatch-prompt template
   defined in "Iter-10 methodology learnings" so subagents emit
   schema-correct commands first-shot. Include the per-house
   `srcdoc-page-index.json` so subagents don't have to re-classify
   pages (methodology #15 below).
2. Add eaves overhang (`overhangMm: 500`) and steepen roof pitch where
   sections disagree with current model.
3. Apply through the iter-10 pipeline, re-capture, re-score.
4. Target ≥ 7/10 per house.

**iter-14**:

1. Roof material (clay tile / dark) + chimneys + wood-clad gable peaks.
2. Terrain refinement (two-zone heightSamples) + balcony railings.
3. Stairs (kernel-supported subset).
4. Material differentiation per-room.

Stop criterion: visual-diff subagent gives ≥ 7/10 per house with
specific items named (not generic "looks like a house").

## Iter-10 methodology learnings (for the one-shot orchestrator)

The iter-10 pass replayed the same iter-9 subagent emissions against a
freshly-rebuilt DB and lifted apply rates from 19/27 → 26/27 — without
re-dispatching a single subagent. The lift came entirely from a four-stage
pre-flight pipeline that runs between subagent output and kernel commit.
Every stage corresponds to a class of failure a one-shot orchestrator MUST
absorb if subagents are not perfectly grounded.

### 1. Type-name casing is inconsistent in the kernel itself

Building edits use camelCase (`createRoof`, `createDormer`, `createWindow`);
site/terrain commands use PascalCase (`CreateToposolid`, `CreateGradedRegion`,
`CreateToposolidExcavation`). Subagents pattern-match on the prevailing
camelCase and get the site family wrong. The normalizer maintains a
`SITE_PASCAL_MAP` of all lowercase variants → canonical PascalCase. **Action
for the one-shot orchestrator:** ship every dispatch prompt with this map
inline so subagents emit the right casing from the start; keep the
normalizer as the belt-and-braces safety net.

### 2. Hallucinated command names

iter-9 subagents emitted `createMassBox` and `createWindow` — neither
exists in the kernel union. The rewriter rewrites them to `createDormer`
(when the name has dormer-intent) and `insertWindowOnWall` (when a
`hostWallSelector` is present). **Action:** the dispatch prompt MUST
include the authoritative list of command type-strings (extractable from
`app/bim_ai/commands.py`'s tagged union); a `createMassBox`-shaped emission
is then a known-bad pattern, not a fresh failure.

### 3. Required-field derivation

`createDormer` with `dormerRoofKind=gable|hipped` requires `ridgeHeightMm`
(`semantic_authoring.py:486`). Subagents emit `dormerRoofPitchDeg` and
expect the kernel to derive the ridge. The normalizer derives it as
`(widthMm/2) × tan(pitchDeg)` with a 100 mm floor. **Action:** add
schema-derivation rules to the orchestrator's pre-flight, AND mark such
fields in the dispatch prompt as "compute from pitch + width, do not omit."

### 4. Field-alias mapping

`CreateToposolid` uses `toposolidId` as the entity id, not `id`. Subagent
emitted `id`, which silently meant no id (omitted) — rejected. The normalizer
aliases `id → toposolidId`. **Action:** any command whose entity-id field
name is non-standard should be highlighted in the dispatch prompt.

### 5. Coordinate-frame mismatches

`createDormer.positionOnRoof.{alongRidgeMm,acrossRidgeMm}` is measured
from the **roof centroid**, not the building origin. The gamma corrector
emitted `alongRidgeMm: 12500` on an 18 000-long roof; valid range is
±9000. The rewriter recenters using the bundle's own `createRoof`
footprint. **Action:** dispatch prompts MUST state the roof-local-centered
convention; alternatively, expose a `positionAtBuildingMm` alias on
`CreateDormerCmd` that the kernel recenters automatically.

### 6. Hard-coded UUIDs do not survive DB rebuilds

iter-9 corrector JSONs hard-coded element UUIDs (e.g. the alpha roof
`13e9a109-...`). After any DB rebuild — including the routine
`make dev-forwarded` reseed — those UUIDs are dead, and `deleteElement`,
`wallId`-targeted inserts, etc. all fail. The iter-10 `build_id_remap`
queries the live snapshot and resolves UUIDs by domain rule ("the single
roof on this model", "the south EG outer wall by y-position"). **Action:**
the corrector contract should require **symbolic references** — `{kind:
roof}`, `{role: exterior, facade: south, levelId: lvl-eg}` — never raw
UUIDs. The applier resolves them at commit time, making the entire stack
reproducible from clean DB.

### 7. Bundle-internal references vs live snapshot

When `cmd[0]` deletes a roof and `cmd[1]` creates a replacement, `cmd[2]`'s
dormer MUST host on the new roof, not the about-to-be-deleted one. The
rewriter scans the bundle for `createRoof` and uses that as
`hostRoofId`. **Action:** orchestrator should always do a two-pass: first
gather all element-creating commands in the bundle, then resolve
references in subsequent commands against that future state.

### 8. Bad enum / catalog values crash whole commands

`createDormer.wallMaterialKey: 'render_white'` blocked the entire dormer
because the key wasn't in the catalog. The rewriter drops material keys
in dormer rewrites (materials are layered on later anyway). **Action:**
non-critical fields should be droppable with a logged note, not crash
the host command. The catalog of legal material keys should also be
embedded in the dispatch prompt.

### 9. Warnings sometimes mask real geometry errors

Beta's iter-10 [4] failure surfaced as `floor_span_without_support_metadata`
(warning) BUT the real cause was `wall_overlap` (error) on the same
element bundle — the garage west wall was placed exactly on the house
east wall. The lesson: **subagents inferring new walls must check for
coincidence with existing perimeter walls first.** Methodology cue: the
"new attached volume" subagent prompt should require an explicit
neighbour-wall reuse plan (e.g. "garage shares wall e96f63af with the
house; emit a 3-segment chain plus a wall-share assumption").

### 10. Defense-in-depth normalization beats per-value overflow checks

The first version of `_roof_local_recenter` only shifted a dormer
position when it would overflow the kernel's half-extent check
(`abs(along) > half_along`). That rule missed gamma's two "western"
dormers (alongRidgeMm=5500 on an 18000-long roof), which the subagent
emitted as **world x** even though the kernel expects **roof-local
centered**. The dormers "applied" but rendered at the wrong end of the
roof — and in the original capture they were also outside the screenshot
frame (see #11), making the bug nearly invisible.

The fix: detect coordinate-frame **per axis from the population of
dormer positions in the bundle**, not per individual value. Rules:

- Any negative value in the axis population → local frame, don't shift.
- Any value > half_extent in the population → world frame, recenter all.
- All non-negative, all ≤ half_extent, mean closer to half_extent than
  to zero → world frame, recenter all.
- Otherwise unknown → don't shift (assume local).

In gamma this correctly classified `alongRidge=[5500,12500,5500,12500]`
as world (recentered to ±3500) AND `acrossRidge=[-2000,-2000,2000,2000]`
as local (left alone). Per-axis evidence is the only signal I trust to
be both correct and silent.

**Methodology principle:** pre-flight normalizers should be **assertive
about kernel conventions when input is ambiguous**, not just defensive
about overflow. The cost of a false-positive shift (dormer on the wrong
slope, fixable next iter) is much lower than a missed shift (silently
correct kernel data → invisible/wrong-position render → debugging hours).

**Better long-term fix at the kernel level:** add a `positionFrame`
field to `CreateDormerCmd` with values `roof_centered` (current default)
and `world_at_footprint_origin`. Subagents declare what they meant; the
kernel converts. The pre-flight normalizer becomes a fallback for legacy
JSONs.

### 11. The capture toolchain IS part of the methodology

Before fix #10, the gamma capture looked like a plain gabled box with no
dormers. I almost concluded the renderer was broken. The real story:
my Playwright script used `page.$('canvas')` which picked the FIRST
canvas — the small navigation-cube widget in the corner — instead of
the much-larger 3D viewport. Once I fixed the selector to "largest
canvas by bounding box", the dormers, balcony cantilever, and graded
region were all there, and gamma's score jumped from 2/10 → 5/10
**without any model change**.

**Methodology principle:** when assessing visual fidelity, treat the
capture pipeline as a hypothesis to be falsified, not infrastructure to
be trusted. Symptoms-as-bugs always live in TWO places: the system under
test AND the measurement that observed the symptom. Specific guardrails:

- Use the LARGEST canvas (or an explicit `[data-evidence-capture-root]`
  selector) — never the first matching canvas.
- Wait for the actual render to settle (a fixed-timeout sleep is fine
  as a baseline, but ideally probe an "isReady" hook from the renderer).
- Always also save the FULL-PAGE screenshot so a future investigator can
  see whether the issue was geometry or framing.
- When dispatching visual-diff subagents, attach BOTH the cropped 3D
  canvas AND the full-page screenshot so the subagent isn't operating
  on a misframed crop.

### One-shot orchestrator template (synthesized)

```
1. db reset → ensure clean state
2. iter-5 canonical rebuild  (pure Python, deterministic frames)
3. iter-7 roof upgrade        (pure Python)
4. iter-8/8b site + materials (pure Python)
5. for each iteration:
   a. preflight: query live snapshot
   b. dispatch subagents in parallel with:
      - canonical command name list (the kernel union)
      - SITE_PASCAL_MAP casing reference
      - derived-field rules (ridgeHeightMm, etc.)
      - coordinate-frame conventions (roof-local centered, etc.)
      - symbolic-ref grammar (no raw UUIDs)
      - material-catalog whitelist
   c. apply pipeline: remap → rewrite → normalize → commit (one bundle per command)
   d. capture (Playwright per-view) + score (visual-diff subagent with source PDF page attached)
   e. if score ≥ 7/10 per house: stop; else update prompts with failure-class summaries and loop
6. publish acceptance package
```

The iter-10 pipeline IS the methodology output of the testhouse work.
Future bim-ai authoring sessions should reuse `testhouse_command_normalize.py`
+ the rewriter/remapper patterns regardless of which houses are involved.

## Iter-11 methodology learnings (capture toolchain + ledger gaps)

Iter-11 added the measurement instrument that iter-10 was missing: a
per-view headless capture pipeline + 3 source-PDF-attached visual-diff
subagents. The score numbers didn't move (the model didn't change), but
the dispatch surfaced four new failure classes — three about the
measurement instrument itself (sibling of learning #11), one about the
upstream fact ledger that all corrector iterations have been silently
patching around.

### 12. The source title block is the most load-bearing fact in the project

Two of three houses are mis-typed at the canonical-rebuild layer because
the iter-1 fact ledger did not parse the source title block:

- **alpha** title block reads "Entwurf zum Neubau von Zweifamilien-
  Doppelwohnhaus" (design for a two-family semi-detached house). Iter-5
  canonical rebuild authored only the east half (a single-family box).
  Every iter-6 → iter-10 corrector has been patching detail onto the
  wrong massing.
- **gamma** title block reads "Wohn- und Praxisgebäude mit Carport als
  Doppelhaushälfte" (residence + medical practice with carport, as a
  semi-detached half). Iter-5 authored a freestanding solo with no
  carport and no Praxis cross-wing.

Both subagents independently surfaced this from the source PDF pages.
The lesson: **before any geometry is authored, the orchestrator must
extract and assert a `building_class` slot** — at minimum
`{einfamilienhaus | doppelhaushälfte | zweifamilien_doppelhaus |
mehrfamilien | …}` — plus any auxiliary masses named in the title
("Carport", "Praxis", "Anbau", "Garage"). The canonical rebuild
consumes this slot and refuses to author a single-volume mass when the
title says otherwise.

**Methodology principle:** title-block facts are not architectural
preferences; they are constraints. Treat the title block as a
schema-level declaration, not a hint.

### 13. Elevation captures need a geometry-content readiness probe

All three iter-11 subagents reported the elevation captures (4 views ×
3 houses = 12 captures) as too sparse to score per-facade. They render
as wireframe black bars on white — walls in section without
fenestration, materials, or roof outline. The 3D viewport renders
correctly; the elevation view-template in the workspace renders
schematically.

Two interpretations are both true:

- The elevation view-template in the workspace IS minimal by design
  (it's an editing UI for elevation markers, not a presentation
  renderer). Fixing this is a workspace feature, not a capture-script
  fix.
- The capture script should not silently feed wireframe stubs to the
  visual-diff subagent. It should assert the captured canvas contains
  meaningful content (e.g. fraction of non-background pixels > 15%,
  presence of at least one fill colour beyond grayscale wireframe)
  and either retry with a different camera or fall back to multi-angle
  3D captures.

**Methodology principle:** the capture pipeline must include a
content-readiness gate, not just a render-settle timeout. A capture
that renders "successfully" but shows no information is worse than a
capture that fails loudly — silent capture failure passes through the
whole scoring loop unnoticed.

**Better long-term fix:** prefer multi-angle 3D over orthographic
elevations for visual-diff scoring until the elevation view-template
renders materials + fenestration. The 3D viewport already produces
scorable images; rotating the camera around the building gives 4 or 8
honest views without needing the elevation pipeline at all.

### 14. Apply rate decouples from visible rate

Beta's iter-10 reports 9/10 commands applied, but the iter-11 captures
show effectively zero new openings on the long east/west facades.
Either:

- The iter-9 corrector didn't emit window commands for east/west (a
  coverage gap that "apply rate" cannot detect), OR
- The commands applied but rendered out-of-frame (windows below grade,
  windows behind toposolid, windows on detached/orphaned walls).

`appliedCount/totalCount` is a necessary but not sufficient
measurement. The orchestrator needs a **post-apply expected-delta
check**: for each command bundle, query the post-apply snapshot for
the elements the bundle should have created (by id or by query) and
assert they fall within the visible camera frustum of the next
capture pass. A successful apply that lands outside the capture
frame is functionally equivalent to a failed apply for visual
fidelity purposes.

**Action for the orchestrator template:** between steps `c` (apply
pipeline) and `d` (capture), insert a `c.5` step: query the snapshot
for command-bundle outcomes, score `visible_rate = applied AND
in_frustum`, and pre-flight a camera adjustment if `visible_rate <
applied_rate`.

### 15. Persist a per-house source-page index

Each iter-11 subagent had to read all source PDF pages and classify
them (plan vs section vs elevation, level, facade direction) before
scoring. For beta that's 6 pages, for gamma 10 — significant token cost
per subagent dispatch and a single point of subagent
misclassification. Worse, the page index is a stable per-house fact
that doesn't change between iterations.

**Action:** during ingest (iter-1 territory), emit a
`srcdoc-page-index.json` per house with one entry per rendered page:
`{path, sourceDocumentId, pageNumber, kind, level?, facade?, hasTitleBlock}`
where `kind` ∈ `{floor_plan, elevation, section, site_plan, framing,
detail, schedule, photo, title_page, cover}` and `facade` ∈
`{N, E, S, W, NE, …, mixed}`. Visual-diff subagent dispatches attach
the right pages by querying this index — no per-call classification,
no token-burn on re-reading 10 PDF pages.

**Status:** beta's subagent did per-call classification correctly; the
risk is that future runs (or runs across more houses) silently
misclassify. The index is cheap insurance.

### Iter-11 amendment to the one-shot orchestrator template

```
0. INGEST (iter-1 territory):
   a. extract source title block (NEW) → assert building_class slot
   b. classify every rendered source page → emit srcdoc-page-index.json (NEW)
1. db reset
2-4. canonical rebuild + roof + site (as before; canonical rebuild
     now reads building_class and refuses to author a single-volume
     mass when the source declares a Doppelhaus / Mehrfamilienhaus)
5. for each iteration:
   a. preflight: query live snapshot
   b. dispatch subagents in parallel with the existing prompt-template
      pack + the per-house source-page index so each subagent attaches
      the right page automatically
   c. apply pipeline: remap → rewrite → normalize → commit
   c.5. post-apply expected-delta check (NEW): assert each bundle's
        outputs are in the capture frustum
   d. capture (Playwright per-view) — must pass content-readiness gate
      before feeding the visual-diff subagent
   e. visual-diff subagent: score + name failure classes
   f. if score ≥ 7/10 per house: stop; else update prompts and loop
6. publish acceptance package
```

## Open methodology questions

- The visual-diff subagent has been inconsistent on building
  identification (called beta "Hammerstein / Boss" which is a
  different house). Need to give the visual-diff subagent the
  *source PDF page* directly, not let it guess from the iter-1
  ledger.
- The Playwright capture currently lands on the first plan view OR
  the 3D viewpoint (whatever the dev viewer auto-selects). Need
  explicit per-view URL params OR a JS step in the runner that
  clicks the desired view in the sidebar before screenshotting.
- The Agent tool cannot be invoked from Python — dispatches MUST
  happen during the orchestrator's turn. So the loop is "Python
  audits + builds prompt files → orchestrator dispatches in
  parallel → Python ingests responses." Each full cycle takes one
  conversational turn.
