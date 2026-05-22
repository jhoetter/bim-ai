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

## Honest fidelity scoring (after iter-9)

Visual-diff subagent comparing model 3D screenshots to source plan +
elevation pages.

| House | Score | What reads right | What still doesn't |
|-------|------:|---|---|
| alpha | 3/10 | 2-storey gabled house with door + windows; sloped Berg→Tal toposolid | Gable axis wrong (source: eaves-front; model: gable-end-front); footprint near-square vs source 2:1; Schleppgauben not visible in render; window grid irregular |
| beta | 5/10 | Roof pitch + 800mm overhang reads residential; attached garage volume; south terrace slab + sliders; sloped ground | Terrace is flat plane, no railing; windows still too uniform; garage flat-roof rendering needs check |
| gamma | 4/10 | Elongated proportions; row of upper windows hints at source rhythm; balcony slabs present | All 4 dormer commands failed (schema mismatch); gable end plain (source has ornate window); window count off vs source rhythm |

Overall: **moved from "generic cube" to "correct typology, wrong
details"** — not yet "recognizable as the source house."

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

- alpha: <http://127.0.0.1:22000/?modelId=a6516571-bfe1-4c61-bc65-ecf7d98cfea9>
- beta:  <http://127.0.0.1:22000/?modelId=e2a59686-152b-4d5c-b4be-9e13f6d2e201>
- gamma: <http://127.0.0.1:22000/?modelId=a05575d5-de38-4177-8237-1896e732d2ce>

## Next-iteration plan

**iter-10** (immediate):

1. Fix P0 schema blockers (1 dormer fix, 1 toposolid casing, 1
   gradedRegion replacement, 1 door clearance bypass).
2. Re-dispatch deep-correctors with schema fixes baked in.
3. P1: re-emit alpha gable axis + Schleppgauben placement after
   confirming source orientation.
4. Re-capture + re-score; target ≥ 5/10 per house, ≥ 6/10 for beta.

**iter-11**:

1. Dispatch per-facade `window_rhythm_reader` subagents (3 houses ×
   ~4 facades each ≈ 12 dispatches).
2. Apply, re-capture, re-score.
3. Target ≥ 7/10 per house.

**iter-12**:

1. Terrain refinement + balcony railings.
2. Stairs (kernel-supported subset).
3. Material differentiation per-room.

Stop criterion: visual-diff subagent gives ≥ 7/10 per house with
specific items named (not generic "looks like a house").

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
