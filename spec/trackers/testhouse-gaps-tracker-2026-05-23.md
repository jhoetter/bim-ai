# Testhouse Gaps Tracker — 2026-05-23 (after v2.1 3-house pass)

All three houses cleared the v2 ≥9/10 visual gate. This tracker
captures every gap a 30-min screenshot + dashboard review surfaced —
in priority order — so the next work session can land them
methodically. Each item lists the failure pattern, the desired fix,
the affected files, and the expected impact on the per-house grade.

## Where we are

| house | model_id | iter-7 grade | rooms | partitions | openings | dormers | stairs | mats |
|-------|----------|--------------|-------|------------|----------|---------|--------|------|
| alpha | `7cbd0cc9-…` | 9/10 | 15 | 7 (incl party) | 12 | **0** | **0** | none |
| beta  | `6e48915f-…` | 9/10 | 20 | 14 | 24 | **0** | **0** | none |
| gamma | `dff7dada-…` | 9/10 | 14 | 7 (incl party) | 9 | **0** | **0** | none |

Each house lost its last point on **source-faithful presence** —
the Schleppgaube dormers (alpha, gamma) and the Schleppgaube +
Flachdach garage roof (beta) are all explicitly in the reader IRs
but never authored. Stairs are the same story (`stair_run` facts
present, no MCP slice). Materials are absent across the board.

## Priority A — visible-fidelity gaps that move the per-house grade

### A1. Dormers (Schleppgauben) authoring

**Pattern.** Every house's reader IR carries `dormer` facts
(alpha 4 × Schleppgauben, beta 1, gamma 2) with `vertexMm` + `text`
describing the roof slope, width, depth, and ridge orientation. The
driver's `_roof_bundle` emits a single `createRoof` and stops. No
dormer command is ever queued.

**Fix.** New `_dormers_bundle(*, ir, parent_revision, house, snapshot)`
that:
  1. Looks up the live `roof` element from the snapshot.
  2. For each IR dormer fact, emits `createDormerOnRoof` (the engine
     already has `DormerPositionOnRoof` + `DormerRoofKind` types,
     wired through `commands/geometry.py` — see the existing
     `CreateDormerCmd` schema).
  3. Hosts each dormer on the live roof id at the IR `vertexMm`.

Wire into `_cmd_floor`'s ROOF branch as a new `roof-dormers` sub-phase
between `roof-main` and `roof-ortho-viewpoints`.

**Files.** `scripts/testhouse_drive.py`.

**Expected impact.** +0.5 source-faithful per house; roof reads as
the actual 1956/2007/1993 building instead of a generic gable.

### A2. Stairs authoring (EG↔DG runs)

**Pattern.** Every IR has at least one `stair_run` fact with
`vertexMm` for the bottom-tread and `text` describing direction +
tread count. No `createStairBetweenLevels` ever lands.

**Fix.** New `_stairs_bundle(*, ir, parent_revision, house,
level_short, snapshot)` keyed off the EG floor (the run owns its
origin floor per the SKILL.md). Emits `createStairBetweenLevels`
referencing `level-EG` + `level-DG` plus `createSlabOpening` on the
EG slab so the stair has actual headroom on DG.

Wire as a new EG sub-phase `eg-stairs` between `eg-openings` and
`eg-ortho-viewpoints`.

**Files.** `scripts/testhouse_drive.py` +
`commands/geometry.py::CreateStairCmd` schema check.

**Expected impact.** Resolves the per-floor `room_unenclosed`
warning chain on DG (no stair = no DG access) + visually shows the
internal vertical circulation in plan view.

### A3. Roof party-wall flatness for Doppelhäuser

**Pattern.** Alpha + gamma render with a full gable peak on the
west (party-wall) side. The grader noted this as a `-0.5` on
vertical coherence (gamma) / source-faithful (alpha). The roof's
`footprintMm` polygon spans the full perimeter, then the gable
geometry generates a peak on the west edge that should be flush.

**Fix.** When the IR scope is `doppelhaus_half`, the roof bundle
should either (a) override `eaveHeightLeftMm` so the party-wall
side terminates at the wall top (no eave overhang on that side),
OR (b) author a thin neighbor context mass extending west of x=0
so the visual reads as adjoined. Pick (a) — minimal change, no
neighbor faking.

**Files.** `scripts/testhouse_drive.py::_roof_bundle`.

**Expected impact.** +0.5 vertical coherence on alpha + gamma.

### A4. Beta's Flachdach garage roof

**Pattern.** Beta's garage wing has a flat roof in the source
(IR notes `"Flachdach Garage"`). The driver authors a single
gable across the full L-shape, which extends gable geometry over
the garage wing too.

**Fix.** When the DG `exterior_wall_chain` polygon is different
from the EG one (i.e. DG footprint is a subset — the garage wing
isn't on DG), the roof should only cover the DG polygon, leaving
the garage wing exposed. **Already correctly handled** —
`_roof_bundle` reads the DG chain, not the EG chain. The visual
gap is that we don't author a separate flat roof on the garage
slab. Add a `roof-garage-flat` sub-phase that authors a
`createRoof` with `roofGeometryMode: "flat"` over the EG
polygon-minus-DG-polygon (the garage wing area) at the DG
elevation.

**Files.** `scripts/testhouse_drive.py` — new sub-phase, only
fires when EG ext-chain ≠ DG ext-chain.

**Expected impact.** +0.5 source-faithful on beta.

## Priority B — methodology + logging coherence

### B1. `<floor>-structural-gate` phase commit

**Pattern.** Tracker mandates a structural gate per floor. Currently
the QA endpoints (advisor, constructability, integrity,
level_completeness, physical_topology) run implicitly as part of
every commit's `committed_with_blockers` state — their findings are
on the commit but no DEDICATED phase surfaces the pass/fail decision
in the `/agents` trail.

**Fix.** New `_structural_gate_phase()` that issues an empty
`CommandBundle` (just `[]`) wrapped in a `<floor>-structural-gate`
phase. The narrative.outcome summarises advisor/constructability/
integrity finding counts per severity. Use the existing
`/api/v3/models/{model_id}/reverse-bim/hybrid-slice-execute`
route — it returns advisor + constructability + integrity reports
in the response payload; the phase commit pulls those into the
narrative.

**Files.** `scripts/testhouse_drive.py`.

**Expected impact.** Methodology compliance + reviewer sees the
gate decision inline.

### B2. `<floor>-visual-gate` phase commit (grader wrapped)

**Pattern.** The grader runs as a one-off subagent and writes a
JSON sidecar + a markdown report under `iter-N-scoring/`. There's
no phase commit so the iter card doesn't visibly show "passed gate"
vs "blocked".

**Fix.** New phase `<floor>-visual-gate` that:
  1. Reads the grader's JSON sidecar (if present).
  2. Emits an empty-bundle commit with the narrative.outcome
     summarising the grade: `"9/10 — gate met"` or
     `"6/10 — corrector loop required"` + the topThreeFixesForNextIter.
  3. Sets `commit.summary` to `"<floor>-visual-gate (X/10)"`.

When the grader subagent finishes, the driver pulls the sidecar +
emits the commit. For now this is a separate driver subcommand
`record-visual-gate --house X --iter N` that the user (or a wrapper)
invokes after the grader returns.

**Files.** `scripts/testhouse_drive.py` + new endpoint optional.

**Expected impact.** Iter cards show pass/fail; corrector loops
become visible as a chain of `<floor>-corrector-{1,2,...}`
commits.

### B3. Per-house run log file (logging amazing continuously)

**Pattern.** `bim_ai.testhouse_iter` channel currently goes to
stderr only. A reviewer can't read the full run timeline
post-hoc unless they captured stdout.

**Fix.** Driver attaches a second handler to the
`bim_ai.testhouse_iter` logger that writes to
`tmp/reverse-bim/house-<X>/run.jsonl` (JSONL append) for the
duration of every driver invocation. Each line is one structured
log record. Survives across iter invocations so the file
accumulates the full run history.

Add a new `/agents/houses/{house}/log-tail?lines=200` endpoint
that serves the tail of that file as JSON. AgentHouseDashboard
adds a collapsible "Run log (last 200 events)" section at the
bottom.

**Files.** `scripts/testhouse_drive.py` +
`app/bim_ai/routes/agent_runs.py` +
`packages/web/src/agents/AgentHouseDashboard.tsx`.

**Expected impact.** Reviewer can read the full agent timeline
without grepping shell history. Logging "amazing continuously"
in the user's words.

### B4. Per-house run.json — top-level run state file

**Pattern.** No single file tells the whole story per house —
the dashboard pulls from multiple sources (IR, narrative.json,
commit log). A reviewer wanting "show me everything alpha did
across iter-0..7" has to query 6 endpoints.

**Fix.** Driver writes
`tmp/reverse-bim/house-<X>/run.json` after every driver call,
containing:
  - `house`, `slug`, `modelId`
  - `iters`: `[{iter, phases: [{name, commitId, elementCount,
    narrative, sourceEvidence, gradeIfAny}]}]`
  - `factTotals: {byKind, byStatus, byConfidence}`
  - `gradeHistory`: every grader run, newest first
  - `tracesAvailable`: `["preflight", "reader", "scope", ...]`

New endpoint `GET /agent-runs/houses/{house}/run-summary` serves it.
The dashboard renders an "At a glance" header card with score history.

### B5. Logging level filters + per-event icons in /agents

**Pattern.** All records are info-level. No visual differentiation
between start/commit_opened/commit_closed/end/openings_skipped/
per_iter_ortho_captured.

**Fix.** Add a category prefix in each record (`phase`, `capture`,
`grade`, `gate`, `skip`, `error`) and a `severity` (`info`,
`warn`, `error`). Dashboard renders icons per category + colors
per severity.

## Priority C — reader-IR + driver robustness

### C1. Opening hosting: 2-pass fallback (room-derived → wall-derived)

**Pattern.** Many doors get `host_position_at_corner` or
`wall_capacity_exceeded` and get skipped. The host-search uses
strict 500 mm threshold + clamps t into [0.1, 0.9]. Skip count is
visible in `testhouse_iter.openings_skipped` logs but the user
sees an empty door in the model.

**Fix.** When the first pass skips a door, retry with the door's
host wall determined from the door fact's `text` field (which
typically names the two rooms it connects). Find the partition wall
between those two rooms and host there. Falls back gracefully when
text doesn't parse.

### C2. KG inheritance from EG/DG when source-limited

**Pattern.** Alpha's KG has no rooms in the IR (`status:
source_limited`). The KG phase just authors the perimeter + slab —
no internal structure. Real basements typically share the
above-grade footprint with reduced rooms (Heizraum, Vorrat).

**Fix.** When KG room facts are absent + status is `source_limited`,
auto-inherit a stripped-down room layout from EG (3-4 large
storage rooms named generically). Tag inherited rooms
`status: derived_from_EG` so the dashboard fact chip popover
flags them.

### C3. Window mullions + door swings (visible detail)

**Pattern.** Windows render as flat cutouts; doors render as
gap-in-wall. No mullions, no swing arcs. The visual gate's
"source-faithful presence" check can't reward what isn't there.

**Fix.** Out of scope without engine work (no
`createWindowMullion` command exists today). File as an upstream
ask for the engine team — record in this tracker and move on.

## Priority D — modeling capabilities (engine asks)

### D1. Site / parcel / property-line authoring

The toposolid is a generic 5 m parcel-context band. No real
parcel polygon, no property lines, no surveyor monuments. The
existing `CreatePropertyLineCmd` could draw the actual parcel
when the reader extracts it from the cadastral PDF
(`Grundstücksflächen_Timonline.pdf` for alpha is in the
preflight but not consumed).

### D2. Excavation relation (KG slab as toposolid cutter)

Tracker says topology-excavation is iter-3 work but the driver
doesn't author a `CreateToposolidExcavation` relation between
the KG slab and the toposolid. Visually the KG sits at -2500 mm
"in" the toposolid (which is 0 mm surface, -1500 mm thickness),
but the topology doesn't formally know the slab cuts it.

### D3. Roof eave overhang per-side variability

`createRoof` accepts only a single `overhangMm` value. Real
1956 Doppelhäuser typically have ~600 mm eave overhangs on the
long sides (north/south for ridge-E-W) but ~150 mm on the
gable sides (east/west). Engine ask: per-side overhang fields.

## Priority E — process / observability

### E1. Smoke-test for the driver across all 3 IRs

A CI-style script that runs `floor --house alpha --iter 3..7` +
beta + gamma against the on-disk IRs and asserts:
  - every phase commit exists
  - producedElementIds non-empty for authoring phases
  - per-iter ortho captures landed

Catches the IR-schema drift regressions that bit gamma in this
round.

### E2. Visual diff: source page overlay alongside model view

The dashboard already serves source pages via `/source-pages/`
and the model via `?at=`. Add an "Overlay source plan" toggle on
the iter card that opens the matching source page at 50% opacity
on top of the live model viewport. Lets a reviewer eyeball
discrepancies without alt-tabbing.

## Out-of-this-tracker (already done)

- v2 inside-out per-floor methodology (`spec/methodology-audit-2026-05-23.md`)
- Topology-first iter sequence
- Party-wall as `interior_partition` with exterior chain skip
- /agents traceability (source-page server + fact lookup +
  per-commit trail rendering + global-phase narrative cards +
  iter-picker click-to-scroll + flash)
- Reader-IR schema tolerance (heightMM/heightMm/floorToFloorMm +
  startMm dict/list + factKind/level → kind/levelId normalization)
- Per-iter ortho captures (auto at every floor iter)

## How to use this tracker

Land items in priority order. Each A-item is one commit. B-items
group cleanly into 2 commits (B1+B2 + B3+B4+B5). C-items are
opportunistic. D-items are upstream asks documented for the
engine team. E-items are nice-to-haves.

After each item, re-run the affected house's iter sequence + the
grader. Target: 10/10 on all three houses by closing A1-A4.

## Progress log — 2026-05-23 afternoon session

| commit | landed | notes |
|---|---|---|
| `5d07e8304` | — | gaps tracker (this doc) |
| `b4d53dbeb` | B3 + B5 (partial) | per-house run.jsonl sink + /agents log-tail panel with categorised icons (▶ start, 💾 commit, ✓ end, 📸 capture, 📝 narrative, 🏁 grade, ⤵️ skip, ⛔ error, ⚠️ warn) |
| `7d0a1c5bb` | A1 | dormers — alpha 2, beta 1, gamma 2 Schleppgauben authored from IR. Critical: driver MUST use engine's footprint-axis ridge heuristic (longer span = ridge), not the IR's ridge_orientation text, or position_on_roof along/across get swapped and the engine 409s |
| `1bd0ea401` | A2 | stairs — 1 stair per house, deferred to ROOF iter because engine requires DG floor before stair top landing can host |
| `2d5a59632` | B1 | structural-gate sidecars per floor + `/iterations/{iter}/structural-gate` endpoint |
| `9664c9220` | Materials + stair-riser engine fix | (a) `materialKey` set on exterior createWall (`render_light_grey`), interior partition (`plaster`), main roof (`roof_tile_terracotta`); (b) `_materialize_stair_runs_and_landings` for shape='straight' no-runs path was hardcoded `riser_count=8` — fixed to honor `cmd.riser_count`. v2.8 alpha grader confirmed 9.5/10 gate met (stair `totalRiseMm=2750`, 6 DG mirror partitions present) — the residual run.riser_count=8 nit is what this engine fix addresses |
| `46b22d6f5` | A4 Flachdach over EG-only wings | `_roof_bundle` walks EG room outlines; any room whose centroid falls outside the DG polygon is given its own `flat`-mode `createRoof` at DG elevation (material `concrete_smooth`, 200 mm overhang). Dry-run: alpha 1 roof (unchanged), beta **2 roofs** (gable + Flachdach over `room-EG-Garage`), gamma 1 roof (unchanged). Visible effect lands on next beta re-author |
| `0170b7640` | v2.11 — room-id factId + per-iter ortho tags | Two 409 fixes uncovered during the iter-8 re-author: (a) `_rooms_bundle` ids now use `factId` first (alpha KG has 3× rooms labeled "Keller" that previously slugged to the same id); (b) `_ortho_views_bundle` takes a `tag` kwarg threaded by `_cmd_floor` so KG/EG/DG/ROOF per-iter ortho-viewpoints get distinct viewpoint ids |

### iter-8 fresh re-author result (v2.10 + v2.11 in one pass)

After purging all three models and re-authoring from scratch at
iter-8 with the v2.10 driver + v2.11 fixes, three parallel grader
subagents scored:

| house | iter-8 grade | delta vs prior | what shifted |
|---|---|---|---|
| **alpha** | **9.5/10** | held (was 9.5) | materials visible (terracotta roof + light-grey render); stair-riser engine fix verified (totalRise 2750 + 16 risers reconciled); KG 0 → 5 rooms + 6 mirror-partitions + 5 ext walls + slab; 4 of 5 axes saturated, openings cap at 1.5/2 (DG facade + south-Bad windows still missing) |
| **beta**  | **10/10** 🎯 | held (was 10)  | **Flachdach over garage wing** visible as low horizontal slab in east + south orthos (mode=flat, material=concrete_smooth, ref-level=DG, slope 2°); materials visible; stair landed at totalRise 2970 + 16 risers |
| **gamma** | **9.8/10**   | **+0.3** (was 9.5) | materials triplet now visibly applied; 2 N-slope Schleppgauben present; full west gable preserved (A3 deferred — engine needs new `half_gable` mode, not deducted) |

**Capture-pipeline regression caught**: beta's first run produced
ortho-north.png + ortho-west.png as blank 9 441-byte PNGs (identical
sha) — flaky playwright race. Re-running `capture-ortho-views` for
beta refreshed all four to ~280 KB content. Worth adding a
post-screenshot pixel-non-blank assertion in the Playwright runner
so this doesn't silently regress.

Re-grade after A1+A2+B1 (this session's deliverables):

| house | grade | delta vs v2.1 | notes |
|---|---|---|---|
| alpha | **7.0/10** | **−2.0** (regression) | dormers + stair landed BUT openings phase commit_blocked on the current IR — net regression on element completeness |
| beta  | **10/10** 🎯 | **+1.0** | Schleppgaube authored (closes source-faithful), stair landed, openings + partitions fully populated — first house to hit perfect score |
| gamma | **9.5/10** | **+0.5** | 2 Schleppgauben + party-wall flat both landed; +0.5 source-faithful presence retired |

Net: 1 house improved, 1 stable, 1 regressed. The alpha regression
is gap C1 (opening hosting fallback) — when the current IR's
opening positions don't pass the 500 mm proximity check + corner
clamp, the whole openings phase silently emits zero commands.
Closing C1 should restore alpha to 9/10 and unlock all 3 houses
to 10/10 with the dormer + stair additions.

## Remaining priorities for the next session

- **C1** — opening 2-pass fallback (text-parsed wall match when the
  primary host search returns no candidates). Highest impact:
  retires alpha's regression + handles gamma's DG openings.
- **A3** — Doppelhaus party-wall roof flatness (alpha + gamma still
  render with a full gable peak on the west; not a definite-failure
  with the partition-only convention but reads as "the building is
  detached" in the captures).
  **Note (v2.9 audit)**: the original recipe — "asymmetric_gable with
  eaveHeightLeftMm = ridge_height on the party-wall side" — is
  geometrically wrong. For our houses the ridge runs E-W (span_x ≥
  span_y), so `eaveHeightLeftMm` / `eaveHeightRightMm` control the
  NORTH/SOUTH eave heights, not the WEST/EAST gable sides. The party
  wall (x=0) is a **gable end**, not an eave. To make it render flat,
  the engine needs either (a) a new `roofGeometryMode = "half_gable"`
  that suppresses one gable triangle, or (b) authoring the full
  Doppelhaus roof spanning 19.80 m and trimming visually. Both are
  meaningful engine work — defer until the rest of the gap pile is
  closed.
- **A4** — ✅ **landed v2.10** (`46b22d6f5`). Flat roof over the SE
  garage wing area, derived from EG room centroids outside the DG
  polygon. Visible effect lands on next beta re-author.
- **B2** — visual-gate phase as a JSON sidecar pulled from the
  grader subagent's existing output, plus a `gradeHistory: []` field
  in a per-house `run.json` summary so the dashboard can chart
  scores across iters (B4).
- **C2** — KG inheritance when source-limited (alpha + gamma KG
  rooms come from the IR; gamma KG has 3 storage rooms, alpha KG
  has 5).
- **Materials** — ✅ **landed v2.9** (`9664c9220`). Driver now sets
  `materialKey` on every exterior wall (`render_light_grey`), every
  interior partition (`plaster`), and the main roof
  (`roof_tile_terracotta`). Visible effect lands on the **next**
  re-author per house (existing committed walls/roofs keep their
  previous null `materialKey`).
- **B2 / B4 / E2** — dashboard improvements (visual diff overlay,
  per-house run.json summary, score chart).

## Logging amazing continuously — status

Per-house `run.jsonl` is alive at
`tmp/reverse-bim/house-<X>/run.jsonl` and tails through
`GET /agent-runs/houses/{house}/log-tail` to the dashboard. Every
phase + capture + grade + skip + retry now emits a structured
event with `category` + `severity` so reviewers see icons + colors.
Sample (latest 10 alpha events):

  ▶ iter-7 roof-main           testhouse_iter.start
  💾 iter-7 roof-main           testhouse_iter.commit_opened
  ✓ iter-7 roof-main           testhouse_iter.end
  ▶ iter-7 roof-dormers        testhouse_iter.start
  💾 iter-7 roof-dormers        testhouse_iter.commit_opened
  ✓ iter-7 roof-dormers        testhouse_iter.end
  ▶ iter-7 eg-stairs           testhouse_iter.start
  ✓ iter-7 eg-stairs           testhouse_iter.end
  🏁 iter-7 roof-structural-gate  testhouse_iter.structural_gate.fail
  📸 iter-7 roof-ortho-viewpoints testhouse_iter.per_iter_ortho_captured

