# Testhouse Visual-Fidelity Tracker

Persistent state for the multi-iteration "make the three testhouse
BIM models actually look like the source PDFs" effort. Picks up
where `spec/testhouse-hybrid-reverse-bim-tracker.md` left off after
iter-2 acceptance gates passed.

## Session resume / handoff (2026-05-23 — post iter-19)

If you are picking this up after a context reset or a PC reboot, read
this section first.

**Current scores (iter-19 subagent-graded, exterior + interior split):**

| House | Iter-11 | Iter-14 | Iter-19 ext | Iter-19 int | Cumulative |
|-------|--------:|--------:|------------:|------------:|-----------:|
| alpha | 3/10    | 7/10    | **7/10**    | **6/10**    | 13/20 |
| beta  | 3/10    | 7/10    | **7/10**    | **7/10**    | 14/20 |
| gamma | 5/10    | 8/10    | **9/10 (composite)** | **8/10** | 17/20 |

**Current state of the work.** Methodology pivot from outside-in to
inside-out is landed and proven. Twelve iterations (iter-12 through
iter-19, plus the iter-12 typology rewrites, iter-14 elevation-capture
fix, iter-15 roof material, iter-16 rooms+partitions, iter-17 stairs,
iter-18 floor extension, iter-19 doors + cut-plane fix) collectively
moved cumulative score from ~11/30 at iter-11 baseline to ~44/60 at
iter-19 — passing the original stop criterion (≥7/10 per house with
named items) on every house, and gamma at composite 9/10.

**Per-house element counts at iter-19:**

- **alpha**: 21+ exterior walls + 31 partitions + 36 rooms + 8 dormers + 38 windows + 2 doors + 2 stairs + 6 floors (3 east-only + 3 doppelhaus) + 1 terracotta roof
- **beta**: 15 exterior walls + 29 partitions + 17 rooms + 25+8 windows + 8+1 (garage) doors + 2 roofs (gable + flat garage)
- **gamma**: 25 exterior walls + 64 partitions + 32 rooms + 4 dormers + 44 windows + 27 doors (24 iter-19 + 2 iter-14 + 1 iter-13) + 3 roofs (main + Praxis + carport)

**Known carryover for iter-20+:**

- **alpha**: DG east-half rooms render outside footprint (mirror sign-flip
  bug — should be `x = 2·x_party - x_west` not `x = -x_west` where the
  rooms have non-zero offset). 39 of 70 partitions failed wall_overlap
  (canonical edge sort fix would dedupe). 8 exterior doors collided with
  iter-14 windows on same walls (need deconfliction).
- **beta**: 4/12 doors collided with iter-9 sliders + iter-14 windows
  (3 south, 1 north). KG layout mirrored vs source p1.
- **gamma**: 1 door collided with iter-14 residential entry. Stair core
  not yet authored as vertical-circulation room across 5 levels (top
  iter-20 priority per the gamma subagent).
- **Cross-cutting**: createRoof ratchet pending on beta (6 iters without
  attempt). Window-overlap QA should be a hard gate not a warning.
  Per-iter capture dirs are getting mixed (iter-16-captures contains
  iter-17 + iter-19 outputs because the .mjs writes to the same dir).

## METHODOLOGY PIVOT (2026-05-22 — between iter-15 and iter-16)

User feedback after reviewing post-iter-15 captures: the houses **look
right from the outside** (within reason — visual scores at alpha 7/10,
beta 7/10, gamma 8/10) **but are completely empty / wrong from the inside**.
The outside-in methodology used through iter-15 (massing → roof → site →
exterior fenestration → cosmetic polish) has exhausted its lift; it
cannot recover interior correctness because it never consumed the source
floor plans as a primary input.

**Pivot:** **inside-out per level**, starting iter-16.

For each house, for each level, in this order:

  1. Read the source floor plan for that level FIRST.
  2. Author rooms (`createRoomRectangle` / `createRoomPoly` /
     `createRoomOutline`) — each room outline becomes the source-of-truth
     for which interior walls go where.
  3. Add interior partitions between rooms (`createWall` with appropriate
     `physicalRole` / `authoringIntent`).
  4. Add internal doors at room connections (`insertDoorOnWall`).
  5. Tie windows to specific rooms based on source — not a blanket
     per-facade rhythm.

Exterior envelopes are now implied by the union of outermost room
outlines; perimeter wall + roof iterations from iter-5..15 are kept as
the scaffold but interior is the new methodology center of gravity.

This pivot is recorded in the user's auto-memory as
`feedback-inside-out-methodology.md` and is binding for all subsequent
testhouse iterations (iter-16+).

The remainder of this tracker below documents the prior outside-in
iterations 1–15. Iter-16's plan is at the end of the "Next-iteration
plan" section.

## Session resume / handoff (2026-05-22 — post iter-13)

If you are picking this up after a context reset or a PC reboot, read
this section first. The full per-iteration history is below, but the
operational facts you need to resume work without breaking state are
here.

**Current state of the work.** Iter-13 (iter-12 carryover cleanup) has
landed: alpha got its 4 Schleppgauben back (deleted in iter-12 when the
roof was replaced); beta got a garage door on the east face (closing
the iter-12-introduced "sealed concrete box" regression); gamma had
its carport moved from west to east, its party-wall stub moved from
east gable to north long facade, and its Praxis wing upsized from 4×3m
token to 8×3m; all three default 3D viewpoints were refit to the
post-iter-12 bounding box. Visual-diff subagent scores: **alpha 5→6,
beta 4→4 (held), gamma 6→7** — net +2 lift, in line with iter-13 being
deliberately a carryover-cleanup iter rather than a new-feature one.

**The unanimously top-priority blocker for iter-14**: all three iter-13
subagents independently named the elevation-capture wireframe-stub bug
(methodology #13) as P0. Three consecutive scoring rounds (iter-11, 12,
13) reported it identically without fix. Iter-14 should be **two
deliverables in order**: (1) fix the elevation capture pipeline (drive
the viewer to true N/E/S/W orthographic 3D cameras, OR fix the
elevation view-template renderer to fill with shading); (2) then run
the per-facade window-rhythm push (3 houses × ~4 facades each ≈ 12
subagent dispatches). Doing fenestration before the capture fix burns
methodology budget — the windows would land but the scoring rubric
can't see them.

**Current live model IDs (iter-10 state in postgres, persists across docker restart):**

- alpha — `2378f078-6ee2-4c45-956c-d60a9973b3bb`
- beta  — `f2094774-4fbd-4954-937d-ef35c8fe7d76`
- gamma — `99fa79aa-a31b-4c9e-89a8-b55ae25b7552`

These are also persisted in `tmp/reverse-bim/house-{alpha,beta,gamma}/iter-5-canonical-model.json`.
View URLs: `http://127.0.0.1:22000/?modelId=<id>` (default 3D) or
`http://127.0.0.1:22000/?modelId=<id>&activeElevationView=elevation-{east,north,south,west}`
(orthographic elevations). The `activeElevationView` URL param was
re-added in iter-11 — see `packages/web/src/workspace/Workspace.tsx`.

**How to bring the dev stack back up after a reboot.**

```sh
# 1. Start docker services (volumes persist across reboot)
docker start bimai-postgres bimai-redis bimai-minio

# 2. DO NOT RUN `make dev` OR `make dev-forwarded` — they call seed.py
# which deletes everything under SEED_PROJECT_ID (892ee9f7-…), including
# all three testhouse models. The iter-10 state would be wiped.
# Instead, run the API + web targets directly:
nohup make dev-api WEB_PORT=22000 API_PORT=28500 BROWSER_API_PORT=28500 > /tmp/bimai-api.log 2>&1 &
nohup make dev-web WEB_PORT=22000 API_PORT=28500 BROWSER_API_PORT=28500 > /tmp/bimai-web.log 2>&1 &

# 3. Verify ports are bound
ss -tlnp | grep -E ':22000 |:28500 '

# 4. Sanity-check a model is alive
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:28500/api/models/2378f078-6ee2-4c45-956c-d60a9973b3bb/diff"
# expect: 200
```

**If `make dev` was already run by mistake and the testhouses are gone,**
rebuild from clean DB:

```sh
python3 scripts/testhouse_iter5_canonical_rebuild.py \
  && python3 scripts/testhouse_iter7_roof_upgrade.py \
  && python3 scripts/testhouse_iter8_site.py \
  && python3 scripts/testhouse_iter8b_assign_types.py \
  && python3 scripts/testhouse_iter10_apply.py
```

Model IDs will change. Update the manifests in
`tmp/reverse-bim/house-*/iter-5-canonical-model.json` and capture the
new IDs at the top of this section.

**Re-running the iter-11 capture pipeline.**

```sh
node scripts/testhouse_iter11_capture.mjs
# outputs: tmp/reverse-bim/iter-11-captures/{house}-{view}-{crop,full}.png
# plus capture-summary.json
```

The script needs ports 22000 + 28500 bound (the dev stack must be up)
and reads model IDs from the iter-5-canonical-model.json manifests.

**Local dirty state to know about.** `.githooks/{commit-msg,post-commit,
post-rewrite,pre-push,prepare-commit-msg}` are modified locally but NOT
committed — they remove the `BIM_AI_ENABLE_ENTIRE_POST_COMMIT=1` env-var
gate from the post-commit hook. Per the auto-memory note, that gate is
intentionally opt-in (commit `f9e37eac` "Make checkpoint git hooks opt-in").
Don't commit these modifications without re-checking the design intent
with the user.

**Known-broken: Entire checkpoint trailers.** `entire` CLI can't unlock
gnome-keyring over SSH on this remote Linux box. Commits since
2026-05-22 on this machine have no `Entire-Checkpoint:` trailer. Not a
regression — pre-existing infrastructure issue documented in the user's
auto-memory.

**iter-11 + iter-12 + iter-13 artifacts on disk (not git-tracked because `tmp/` is gitignored):**

- `tmp/reverse-bim/iter-11-captures/` — overwritten by every subsequent re-capture (.mjs writes to the same path); current contents reflect post-iter-13 DB state.
- `tmp/reverse-bim/iter-12-captures/` — preserved post-iter-12 snapshot (30 PNGs).
- `tmp/reverse-bim/iter-13-captures/` — preserved post-iter-13 snapshot (30 PNGs).
- `tmp/reverse-bim/iter-11-scoring/{alpha,beta,gamma}-subagent-report.md` — baseline reports (3/3/5).
- `tmp/reverse-bim/iter-12-scoring/{alpha,beta,gamma}-subagent-report.md` — iter-12 reports (5/4/6).
- `tmp/reverse-bim/iter-13-scoring/{alpha,beta,gamma}-subagent-report.md` — iter-13 reports (6/4/7).
- `tmp/reverse-bim/iter-12-{alpha,beta,gamma}-apply.json` — iter-12 per-command apply logs.
- `tmp/reverse-bim/iter-13-{alpha-dormers,beta-garage-door,gamma-reposition}-apply.json` + `iter-13-viewport-refit-apply.json` — iter-13 apply logs.
- `tmp/reverse-bim/house-{alpha,beta,gamma}/building-class.json` — title-block parser outputs.

If the disk is lost, these can be regenerated: capture script is deterministic given current DB state; subagent dispatches are repeatable.

**Concrete iter-14 entry points (in execution order):**

Iter-13 closed the iter-12 carryover. The unanimously top-priority
blocker now is the elevation-capture wireframe bug — three consecutive
scoring rounds have been bottlenecked on it. Iter-14 is two
deliverables in this exact order:

1. **Fix the elevation-capture pipeline (P0 toolchain blocker).** Two
   viable paths:
   - **Path A** — drive the viewer to true N/E/S/W orthographic 3D
     cameras instead of opening the elevation-view UI. Patch
     `scripts/testhouse_iter11_capture.mjs` to load 4 additional URLs
     per house (e.g. `?modelId=...&camera=ortho-east`), each with a
     dedicated camera set via the existing `saveViewpoint` mechanism.
   - **Path B** — fix the elevation view-template renderer in the web
     workspace so the elevation-view canvas fills with shaded geometry
     instead of black wireframe stubs.
   Path A is cheaper (no web changes); Path B is the durable fix.
   Acceptance criterion: each elevation crop must have ≥ 15% non-background
   pixel content AND visibly show wall surfaces with the same shading
   the 3D view uses. Methodology gap #13 has the rationale.

2. **Per-facade window-rhythm push.** Once elevation captures shade
   properly, dispatch a `window_rhythm_reader` subagent per facade:
   3 houses × ~4 facades each ≈ 12 dispatches. Each prompt should
   include the relevant source elevation page + the cropped iter-14
   elevation capture + the iter-13 fact ledger window-rhythm entries.
   Emit `insertWindowOnWall` commands with correct count, spacing, and
   size per source. Apply through the iter-10 pipeline.

3. **(Bonus, only if 1+2 finish quickly) cosmetic-debt batch.**
   Gamma subagent flagged 6 cosmetic items now ranked priority-1 for
   two consecutive iters: 24 long-facade windows (subsumed by #2);
   gable arched window; roof material (clay tile dark); chimney;
   balcony Geländer; 5 interior partitions for Praxis. Iter-14b can
   pick these up if there's time.

**Carry-forward fixes that should land alongside #2** (cheap, source-
re-grounding items the iter-13 reports surfaced):

- **alpha — emit 4 more Schleppgauben on the Tal slope.** iter-13 emitted
  2 per slope (4 total), but source `Ansichten.pdf` shows 4 per slope (8
  total). Re-read source elevation and double the dormer count.
- **gamma Praxis — move to western half.** iter-13 upsized but kept
  x=8000..16000 (slightly east of center). Source page 2 places Praxis
  on the WESTERN half (x≈0..9000). Delete iter-13 walls + roof, re-emit
  at x=0..8000, y=-3000..0 (or wider per source extent).
- **gamma Praxis — deepen to ≥5 m.** 8×3 m envelope is too shallow for
  5 clinical rooms + TERRASSE per source. Bump y to -5000..0 or wider.
- **gamma carport — verify renders as a flat roof in 3D**, not just a
  slab on the ground. Iter-12 visibility bug carried forward — iter-13
  reposition fixed location but not visibility (methodology #23).

**Methodology guardrails (status after iter-12):**

- Methodology #12 ✓ closed — title-block parser landed in iter-12 step 1.
- Methodology #13 **still open** — both iter-11 + iter-12 subagent rounds
  reported the elevation captures render as wireframe stubs. Now P0
  because per-facade fenestration scoring depends on it.
- Methodology #14 needs a post-apply visible_rate check — query the
  snapshot for bundle outputs, assert they fall within the capture frustum.
- Methodology #15 needs a one-shot `srcdoc-page-index.json` builder.
- **Methodology #16 (new, iter-12):** corrector patches must re-ground
  against source PDFs each iteration, not just consume the previous
  iteration's written recommendation. iter-12's gamma carport + party-wall
  ended up on the wrong sides because the script followed iter-11's
  literal recommendation text instead of re-reading the source.
- **Methodology #17 (new, iter-12):** scheduled-regression accounting —
  iter-12 deliberately deleted alpha's Schleppgauben (the old roof was
  going away). Need a per-iteration "deferred items" manifest the
  scoring subagent can read so it doesn't double-penalise the regression.
- **Methodology #18 (new, iter-12):** post-mutation viewport re-fit —
  default 3D camera should auto-update when the model bounding box grows
  by >X%; currently alpha + gamma 3d-crops cut off iter-12 additions.
- **Methodology #19 (new, iter-12):** `createWallChain` doesn't propagate
  `allowDetached` to the resulting WallElem (see `engine_dispatch_core.py:263`).
  For free-standing or out-of-envelope walls, individual `createWall`
  commands are the only path. The dispatch prompt should warn against
  using createWallChain for detached structures, OR the kernel should
  add allow_detached to WallChainSegment.

**Open methodology questions** (still — not yet answered):
the "Open methodology questions" section at the very bottom of this file
lists what's still up in the air. Read it before designing iter-12.

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
| 12 | **Typology rewrites — close the iter-11 root-cause gap** | `testhouse_iter12_titleblock_parse.py` + `testhouse_iter12_alpha_doppelhaus.py` + `testhouse_iter12_beta_garage.py` + `testhouse_iter12_gamma_typology.py` | Title-block parser reads the iter-1 fact-ledger and emits per-house `building-class.json` (alpha=`zweifamilien_doppelhaus`, beta=`einfamilienhaus`, gamma=`doppelhaushälfte` + `[carport, praxis_wing]`). Alpha expanded from east-half-only to full Doppelhaus by mirroring the perimeter across x=0 + replacing the roof (9 walls + 1 roof applied, dormers deleted to be re-emitted in iter-13). Beta garage promoted from "low parapet" to walled volume via 3 createWall with `allowDetached: true` (sharing house east wall as party wall). Gamma got 3 sub-bundles: Praxis cross-wing (3 walls + perpendicular gable roof), carport (2 walls + flat roof slab), party-wall stub. **Iter-12 subagent scores: alpha 3→5 (+2), beta 3→4 (+1), gamma 5→6 (+1)** — fidelity lift earned by closing the typology gap, but iter-13 needs to re-emit dormers + window grids that iter-12 deliberately left out. Surfaced **CreateWallChain doesn't propagate `allowDetached`** as a kernel methodology gap — individual `createWall` is the only path for detached walls. |
| 13 | **iter-12 carryover — dormers, garage door, gamma reposition, viewport refit** | `testhouse_iter13_alpha_dormers.py` + `testhouse_iter13_beta_garage_door.py` + `testhouse_iter13_gamma_reposition.py` + `testhouse_iter13_viewport_refit.py` | Alpha 4 Schleppgauben re-emitted on the iter-12 doppelhaus roof (kind=shed, 2 per slope at alongRidgeMm ±7200/±2400 × acrossRidgeMm ±2200). Beta garage door punched on iter12-beta-garage-wall-e at alongT=0.5, w=2400. Gamma reposition: carport moved from west to east end (x=18000..22000) per source EG p2 CARPORT label; party-wall stub deleted from east gable and re-emitted on the north long facade at y=8500 per "GEPLANTE NACHBARLICHE BEBAUUNG" annotation; Praxis wing upsized from 4×3m token to 8×3m (still y=-3000..0). All 3 default 3D viewpoints refit via deleteElement + saveViewpoint with bbox-derived camera (sidestepping the kernel's "duplicate element id" on saveViewpoint-with-existing-id). **Iter-13 subagent scores: alpha 5→6 (+1), beta 4→4 (0), gamma 6→7 (+1)**. Beta held at 4 because both changes (door + viewport) were narrow vs the dominant fenestration/material/topo carryover gaps. Surfaced **methodology gap #20**: gamma Praxis still on wrong half (placed x=8000..16000, source places on western half = x=0..9000) — re-grounding step needed but only ran on the MOVED elements, not the carryover positions. |
| 14 | **Elevation capture fix + per-facade window rhythm** | `testhouse_iter14_author_ortho_viewpoints.py` + `testhouse_iter14_ortho_capture.mjs` + 3 window-rhythm subagents + `testhouse_iter14_apply_windows.py` | 4 ortho-style 3D viewpoints per house (north/east/south/west, 2.5×diag offset) close methodology #13 (wireframe-stub elevations). Per-facade window-rhythm subagents author alpha 38 + beta 25 + gamma 44 windows + 2 doors each. DG window retry script lowered sill 1500→1300 to clear `hosted_opening_lintel_clearance`. **Subagent scores: alpha 6→7 (+1), beta 4→7 (+3 — largest single-iter beta jump), gamma 7→8 (+1)**. |
| 15 | **Roof material + pitch + viewport polish** | `testhouse_iter15_polish.py` + `testhouse_iter15b_roof_material.py` + `testhouse_iter15c_fixup_dormers.py` | Main gable roofs re-emitted with `materialKey="roof_tile_terracotta"` (closing the 4-iter "white roof" overhang). Beta pitch 35→42° + overhang 800→500. Default 3D viewpoints refit. Iter-15b's re-emit accidentally collapsed alpha 8 dormers → 4 unique-suffix ids; iter-15c emitted the missing 4 alpha + 4 gamma (gamma had also lost its 4 dormers to the same bug). |
| 16 | **METHODOLOGY PIVOT — inside-out, rooms first** | `testhouse_iter16_alpha_rooms.py` + 2 floor-plan-reader subagents + `testhouse_iter16_apply_rooms.py` + `testhouse_iter16_plan_capture.mjs` | User feedback: exterior is converging but interior is empty/wrong. Pivot to read source floor plans per-level. Alpha 36 rooms emitted from existing fact-ledger boundaries; beta 17 + gamma 32 rooms via dispatch subagents (gamma subagent uncovered correct Praxis-on-EG / residence-on-OG program mapping). Plan-view capture pipeline added. **First iter-16 plan captures showed nothing visible** — methodology gap #24/#25/#27. |
| 16b/c/d | **Plan-view config + interior partitions** | `testhouse_iter16b_alpha_partitions.py` + `testhouse_iter16c_partitions_from_rooms.py` + `testhouse_iter16d_fix_plan_views.py` | Iter-16b: 31 alpha interior partitions from fact-ledger edge classifications. Iter-16c: 29 beta + 64 gamma partitions derived algorithmically from room polygons (unique edges minus exterior-bbox edges). Iter-16d: `planShowRoomLabels=true` on all 11 plan_views via updateElementProperty. After these three, plan-view captures finally show room labels + partition walls. |
| 17 | **Alpha stair authoring** | `testhouse_iter17_alpha_stairs.py` | First stair across any testhouse: alpha EG → DG east half (14 steps × 193 mm riser × 240 mm tread, 900 mm wide, straight). West-half mirror rejected `physical_stair_without_floor_landings` because iter-5 floor only spans 0..9935. **Iter-17 subagent scores: alpha 7+3 → 7+5 (int +2), beta 7+2 → 7+6 (int +4), gamma 8 → 9 (int 2 → 6)** — confirming the inside-out pivot delivered real visible lift once labels + partitions rendered. |
| 18 | **Alpha floor extension to full doppelhaus** | `testhouse_iter18_alpha_floors.py` | Floor extents extended from 0..9935 to -9935..+9935 × 0..8100 by deleteElement + createFloor with allowDetached=true. 4/6 commands applied (EG + DG old-floor deletes rejected because iter-17 stair lands on them, but new floors landed alongside). After this, iter-17 west-half stair re-applied successfully → alpha has 2 stairs. |
| 19 | **Plan-view cut plane + interior doors** | `testhouse_iter19_fix_cut_plane.py` + 3 door-reader subagents + `testhouse_iter19_apply_doors.py` | Plan-view `cutPlaneOffsetMm` set to +1200 (was -500) so alpha KG no longer renders blank. 3 door-reader subagents emit 8 alpha + 12 beta + 25 gamma `insertDoorOnWall` commands. Apply: alpha 0/8 (all collided with iter-14 windows), beta 8/12 (4 window collisions), gamma 24/25 (1 collision). Door swing arcs now visible at plan cut. **Iter-19 subagent scores: alpha 7+5 → 7+6 (+1 from KG unblock), beta 7+6 → 7+7 (+1 from door arcs), gamma 9 / int 6 → 9 / int 8 (+2 from 24 doors)**. |

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

## Iter-13 subagent-graded fidelity scoring

Same 3-subagent dispatch, same rubric. Per-house full reports in
`tmp/reverse-bim/iter-13-scoring/{alpha,beta,gamma}-subagent-report.md`.

| House | iter-12 score | iter-13 score | Δ | Largest single lift |
|-------|-------------:|-------------:|---:|---|
| alpha | 5/10 | **6/10** | +1 | 2 Schleppgauben visible on the Berg slope from the SE camera (only 4 emitted, 2 are on the back-side Tal slope and not visible from the default 3D camera). Viewport refit frames the full 19.87 m doppelhaus footprint. |
| beta  | 4/10 | **4/10** | 0 | Garage door successfully punched on east face — iter-12-introduced "sealed concrete box" regression closed. Viewport refit frames house + garage. Score held flat because both deliverables were within-bucket vs the dominant fenestration/material/topo carryover gaps. |
| gamma | 6/10 | **7/10** | +1 | Carport, party-wall, and Praxis wing all moved to source-correct positions per the iter-12 subagent findings. Composition reads as a four-volume articulated complex (main + Praxis south + carport east + party-wall north). |

**Net iter-13 lift: +2 across the three houses**, modest because iter-13
was deliberately a carryover-cleanup iter (not a new-feature iter). All
three subagents converged on the same priority for iter-14: **stop adding
geometry, fix the elevation-capture pipeline first (methodology #13 has
now blocked three consecutive scoring rounds), then run the per-facade
window-rhythm push** which all three subagent reports rank as the single
biggest unblocked lift.

Cross-cutting iter-13 subagent findings:

- **Methodology #13 (wireframe-stub elevations) → P0 toolchain blocker.**
  Three consecutive scoring rounds (iter-11, iter-12, iter-13) all named
  it the same way. Either drive the viewer to true N/E/S/W orthographic
  3D cameras OR fix the elevation view-template renderer to fill with
  shading. Per the alpha subagent: "should leave the per-iter 'new gaps'
  list and become a P0 toolchain deliverable."
- **Methodology #20 (new, iter-13): re-grounding only runs on MOVED
  elements, not on carry-forward positions.** Gamma Praxis is still on
  the eastern half (x=8000..16000) — iter-13 upsized but didn't re-read
  the source page that places Praxis on the WESTERN half. Same pattern
  could be lurking on alpha + beta carry-forwards.
- **Methodology #21 (new, iter-13): single-camera 3D capture undersamples
  bilateral roof articulation.** Alpha's default-3D SE-only view can't
  verify the Tal-slope (south) dormers; the scoring subagent had to
  take the count on trust. Capture set should be a function of model
  topology (e.g., if a roof has dormers on both slopes, capture from
  both sides).
- **Methodology #22 (new, iter-13): iter brief ambiguity around entity
  counts.** Alpha's "2 per slope at {-7200, -2400, +2400, +7200}" was
  interpretable as 4 total OR 8 total. The script emitted 4. Iter briefs
  should explicitly state per-entity counts to avoid this kind of
  silent under-emission.
- **Methodology #23 (new, iter-13): repositioning fixes location but
  not visibility.** Gamma's carport was moved east successfully, but
  its flat-slab roof still doesn't render as a roof in 3D (iter-12
  visibility bug carried forward unchanged). Post-reposition checks
  need to assert visible_rate at the NEW location, not just confirm
  the move applied.

## Iter-12 subagent-graded fidelity scoring

Same 3-subagent dispatch as iter-11, same rubric, comparing the post-iter-12
captures (`tmp/reverse-bim/iter-12-captures/`) against the same source PDFs.
Per-house full reports in `tmp/reverse-bim/iter-12-scoring/{alpha,beta,gamma}-subagent-report.md`.

| House | iter-11 score | iter-12 score | Δ | Largest single lift |
|-------|-------------:|-------------:|---:|---|
| alpha | 3/10 | **5/10** | +2 | Building-shape error fixed — iter-12 reads as a Doppelhaus (~2.3:1 footprint, single continuous gable spanning the full ridge with visible eaves overhang). |
| beta  | 3/10 | **4/10** | +1 | Garage now reads as a properly-enclosed flat-roofed volume at ~2.5–3 m height (no longer a low parapet). Iter-10 wall_overlap deferral closed. |
| gamma | 5/10 | **6/10** | +1 | Composition now reads as multi-volume (main + Praxis wing + carport pad + party-wall tag) — genuine typology shift from freestanding solo prism, though placement of carport and party-wall stub are on the wrong sides per source. |

**Net iter-12 lift: +4 across the three houses** — modest but earned, all
three subagents independently confirmed the iter-12 changes were visible.
Score ceilings held below 7 by carryover gaps that iter-13 must address:
fenestration density on long facades, re-emit deleted Schleppgauben on
alpha, punch garage door on beta east face, re-ground gamma carport +
party-wall positions against the actual source pages (iter-12 followed
iter-11's literal recommendation rather than re-reading the source).

Cross-cutting iter-12 subagent findings:

- **Default 3D viewport drift after footprint expansion** — the iter-5
  default camera was authored on the smaller footprint, so the alpha
  3d-crop truncates the new west half and the gamma 3d-crop truncates
  the Praxis wing. Need a post-mutation hook to re-author the default
  viewpoint when the bounding box grows by > X%.
- **Scheduled-regression accounting** — iter-12 deliberately deleted
  alpha's iter-9 Schleppgauben (they had to come off the old roof; the
  new roof needs new positions to be authored in iter-13). The scoring
  subagent has no way to know this is on purpose and double-penalises
  the regression. Need a per-iteration "deferred items" manifest the
  scoring subagent can read.
- **Recommendation-blind authoring** — the gamma subagent followed iter-11's
  literal recommendation ("party-wall stub on the opposite gable") rather
  than re-grounding against source PDFs that show the party wall on the
  north long facade. Corrector patches need a source-re-read step, not
  just a recommendation-consume step.
- **Token-volume anti-pattern** — gamma's Praxis cross-wing was authored
  at 4 × 3 m as a programmatic placeholder, but the source shows the
  Praxis as ~half of the EG with five clinical rooms. Reads as a stub,
  not as a wing. Iter-13 should size new volumes to match source-extent
  data, not to a default "token bay" size.
- **Capture-pipeline limitation #13 confirmed unfixed across two
  consecutive scoring iterations** — all three iter-12 subagents
  reported the elevation captures still render as wireframe stubs.
  This now blocks per-facade window-rhythm scoring; should be P0
  before iter-13 fenestration work begins.

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

**iter-12** ✓ landed: typology rewrites closed the iter-11 root-cause
gaps. Title-block parser emitted `building-class.json` per house; alpha
expanded to full Doppelhaus (9 walls + 1 roof, dormers deleted for
re-emission); beta garage walled up (3 walls); gamma got Praxis cross-wing,
carport, and party-wall stub (9 commands). Subagent scores **alpha 3→5,
beta 3→4, gamma 5→6** — modest but earned lift confirmed across all 3.
See `tmp/reverse-bim/iter-12-{house}-apply.json` for per-house apply
detail and `tmp/reverse-bim/iter-12-scoring/` for the full visual-diff
reports.

**iter-13** ✓ landed: iter-12 carryover cleanup. 4 scripts —
`testhouse_iter13_alpha_dormers.py` (re-emitted 4 Schleppgauben on the
doppelhaus roof), `testhouse_iter13_beta_garage_door.py` (insertDoorOnWall
on the east garage face), `testhouse_iter13_gamma_reposition.py` (deleted
9 iter-12 elements + re-emitted Praxis upsized to 8×3m, carport on east
end, party-wall on north long facade), `testhouse_iter13_viewport_refit.py`
(saveViewpoint per house with bbox-derived camera). Subagent scores
**alpha 5→6, beta 4→4, gamma 6→7** — net +2 lift, in line with
iter-13 being a deliberate carryover-cleanup iter rather than a new-feature
one. See `tmp/reverse-bim/iter-13-*-apply.json` for per-command apply
detail and `tmp/reverse-bim/iter-13-scoring/` for the full visual-diff
reports.

**iter-14** (elevation capture fix + per-facade window rhythm —
unanimously top-priority per all three iter-13 subagent reports):

iter-13's three scoring subagents independently named the elevation-
capture wireframe-stub bug (methodology #13) as P0. Three consecutive
scoring rounds have now been bottlenecked on it. The window-rhythm push
landing without fixing the captures first means the per-facade scoring
rubric can't see the new windows — methodology budget burned.

Plan:

1. **Fix elevation capture pipeline (P0 toolchain).** Two viable paths:
   - **Path A** (cheaper): patch `scripts/testhouse_iter11_capture.mjs`
     to drive 4 orthographic 3D cameras (north, east, south, west) via
     URL parameters instead of opening the elevation-view UI. Use
     `saveViewpoint` to seed 4 viewpoint elements per house with
     hard-coded `up` + `target` along the cardinal directions.
   - **Path B** (durable): fix the elevation view-template renderer in
     the web workspace so the elevation canvas fills with the same
     shaded geometry the 3D view uses, not the schematic black-line
     stubs.
   Acceptance: each elevation crop must have ≥ 15% non-background pixel
   content AND visible wall shading.

2. **Per-facade window rhythm push.** With shaded elevations in hand,
   dispatch a `window_rhythm_reader` subagent per facade (3 houses ×
   ~4 facades each = ~12 dispatches). Each prompt includes the source
   elevation page + the iter-14 shaded elevation crop + the iter-13
   fact-ledger window-rhythm entries. Emit `insertWindowOnWall` commands.
   Apply through the iter-10 pipeline.

3. **Iter-13 carry-forward fixes** (small, alongside #2):
   - alpha: 4 more Schleppgauben on the Tal slope (source shows 8 total,
     not the 4 iter-13 emitted).
   - gamma Praxis: move x to 0..8000 (western half per source p2) and
     deepen y to -5000..0.
   - gamma carport: verify visible_rate in 3D after move (iter-13
     carried forward iter-12's visibility bug).

4. Add eaves overhang (`overhangMm: 500`) where source shows it but
   current model is flush.

5. Apply through the iter-10 pipeline, re-capture, re-score. Target
   ≥ 7/10 per house (alpha + beta both still below).

**iter-15** (cosmetic-debt batch — once fenestration lands):

1. Roof material (clay tile / dark) + chimneys + wood-clad gable peaks.
2. Terrain refinement (two-zone heightSamples) + balcony railings.
3. Gable arched window (gamma).
4. Stairs (kernel-supported subset).
5. Gamma Praxis interior — 5 clinical-room partitions.
6. Material differentiation per-room.

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
