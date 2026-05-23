# Testhouse Nightshift Convergence Tracker — 2026-05-23 → 2026-05-24

**Owner**: Claude Opus 4.7 (1M context), autonomous via `/loop`
**Started**: 2026-05-23 evening
**Stop conditions**: each house at honest **≥ 9/10** (strict rubric below) **OR** max 12 iterations per house **OR** an irreducible engine gap (documented as engine-ask in §13).
**Daily report**: one consolidated `tmp/reverse-bim/nightshift-report.md` at the end.

This tracker is the **single source of truth** for the overnight run.
The loop reads §10 to know what action to take next; updates §6 with
progress; appends iteration articles per §14.

---

## 1. Mission

> Bring all three testhouses (`alpha`, `beta`, `gamma`) to an honest
> **9/10 or better** under the *Strict Source-Fidelity Rubric* (§4),
> with every model committed by an audit-grade pipeline whose
> per-iteration narrative articles let a human reviewer reconstruct
> exactly what the model did, why, and what it saw — without ever
> opening the codebase.

Two top-line shifts vs the previous tracker pile:

1. **Scoring shifts from "element census" to "source comparison"**.
   The prior rubric awarded points for wall count, materialKey
   presence, room outline existence. Those are easy to game and
   missed obvious visual defects (a floating building, no DG
   windows, a missing facade). The new rubric grades each *facade*
   against the corresponding source elevation page (Ansichten /
   Osten / Westen / Norden / Süden), and each *floor* against the
   source plan (EG / DG / KG). Materials, elements, etc. fold in
   only when they affect the source-render comparison.

2. **Logging shifts from "JSONL events" to "narrative articles".**
   `run.jsonl` stays (machine-readable telemetry) but each iter
   now also emits a `tmp/reverse-bim/house-{X}/iter-{N}/article.md`
   — a human-readable post written by the loop covering "what I saw,
   what I tried, what landed, what I learned, what's next". The
   `/agents` dashboard renders these inline so a reviewer can scroll
   the whole house's evolution as a blog.

---

## 2. Honest baseline (start of nightshift)

Captured immediately before nightshift kickoff, no subagent — my own
visual read of `tmp/reverse-bim/house-{X}/iter-8/captures/`:

| house | iter-8 honest grade | what's actually wrong |
|---|---|---|
| **alpha** | **~5–6/10** | DG facade is windowless (only the dormer punch); 6 windows + 4 doors landed of 11 IR-specified openings; small visible plinth above grade (~200 mm); full west gable peak (A3 deferred); 2 dormers present but only marginally visible from N/S |
| **beta**  | **~7–8/10** | L-shape correct, Flachdach over garage visible, dormers present; strongest of the three; missing finer facade detail vs `Süden/Norden` elevations; entrance door not visible from any ortho |
| **gamma** | **TBD**     | gamma's south capture was a Vite-build stack trace (parallel agent's mid-flight TSX edit broke HMR); needs re-capture after the build is green |

The previous subagent grader said 9.5/10/9.8. That ~3 pts gap is the
methodology debt the nightshift must repay.

The v2.8 → v2.12 ledger of what landed but did not move the honest
score:

- materials triplet on walls/roof (v2.9)
- Flachdach over EG-only wings (v2.10)
- room id from factId (v2.11)
- per-iter ortho-viewpoints tagged (v2.11)
- toposolid baseElevationMm = top semantics, fix floating (v2.12)
- Playwright blank-frame retry (v2.12)

These all land genuine improvements; they just don't push past the
real fidelity gaps. The nightshift goes after the fidelity gaps.

---

## 3. Top fidelity gaps to close (ranked by visual impact)

Each gap is a P-line below. The loop should work P-lines in order
unless an earlier P-line is blocked by an engine ask in §13.

### P1. **DG-facade windows are absent on alpha & gamma**

Symptom: from the south/north captures the DG storey reads as a
blank knee-wall band. Source elevations show 2–3 windows per long
facade on DG.

Root cause: alpha's IR has `level: level-EG` on every opening fact;
no DG window facts. The reader pass did not lift the elevation-page
windows into the IR. Two viable fixes:

- **P1a (driver-only)** — synthesize DG windows from EG window
  positions on the same wall. Inheritance rule: each EG window
  whose host wall reaches up into a DG wall gets a mirrored DG
  window unless an explicit "no DG window here" hint is present
  (e.g., the EG window is under a stair landing). Lower fidelity
  but ships in one slice.
- **P1b (reader pass)** — add an iter that re-reads the Ansichten
  elevation pages with a stricter "lift every visible opening into a
  fact" prompt, producing additive `window`/`door` facts with
  `levelId: level-DG`. Higher fidelity, more iters.

Pick P1a for the first round (close the visual gap fast), upgrade
to P1b on the second pass if the honest grade still stalls.

### P2. **Building plinth: visible ~200 mm step above grade**

Symptom: even after the v2.12 toposolid-top-at-grade fix, alpha
still shows a small step between the toposolid surface and the EG
slab base.

Root cause hypothesis: the EG slab is at level EG (z=0) with
220 mm thickness, extruded **above** z=0, so its top face sits at
z=220 and its bottom face at z=0 (flush with toposolid top). The
slab itself is the visible 220 mm step. The walls start at z=0
(level EG) so they hide the slab from horizontal-cut views, but
ortho captures with a downward tilt expose the slab edge.

Fixes to try (pick whichever lands cleanest):

- **P2a** — switch slabs to extrude **down** from level (top = level
  elev, bottom = level elev − thickness). Touches every floor in
  every house; may require `floorBase` flag.
- **P2b** — bump the toposolid base up so the toposolid TOP lands at
  +220 mm (slab-top elevation) rather than 0. Cosmetic but
  preserves engine semantics.
- **P2c** — leave it; 220 mm reads as a foundation course not a
  defect. Decide after the first re-grade.

### P3. **alpha doors invisible in captures**

Symptom: 4 doors in the alpha model but I cannot see any of them in
any of the four ortho captures.

Hypothesis: doors are on interior partitions only, OR the entrance
door is on a facade segment that the ortho camera doesn't show
prominently. Verify by querying snapshot for door host walls and
their parent level / wall axis.

### P4. **A3 — Doppelhaus party-wall flatness (alpha & gamma)**

Already audited; needs a new `half_gable` engine roof mode. Engine
work, gated to §13. **Do not attempt as a one-shot driver hack
during nightshift** unless a clean approach materializes.

### P5. **alpha + gamma look identical except for openings**

Both author into the same 9 900 × 8 750 mm rectangle with the same
roof. Real Doppelhaus halves are mirrored, not identical. The
reader pass for gamma needs to capture *mirror about y-axis* if its
plan is the mirror image. Spot-check `gamma/understanding/existing-building-ir.json`
against the source EG plan.

### P6. **Beta: entrance door + window-on-Garage roller door**

Source elevation `Süden` shows a roller door + a side entry door
that's not in any current capture. Beta is the closest to 9; this
gap is the last 0.5 pt.

---

## 4. Strict Source-Fidelity Rubric (the new gate)

The honest score replaces the prior 5-axis element census. Total
**10 pts**, decomposed:

### 4.1 Per-facade source-vs-render comparison (4 pts)

For each of the 4 cardinal facades (N, E, S, W), compare the
rendered ortho image against the corresponding source elevation
page (Ansichten-1.png on alpha; pages 5/6 on beta; etc.). Score
each facade out of 1 pt:

| sub-criterion | weight |
|---|---|
| window count matches source ±1 | 0.3 |
| dormer presence + position matches source | 0.2 |
| roof shape (gable/hip/flat/dormer-strip) matches source | 0.2 |
| door presence on entrance facade (if applicable) | 0.15 |
| no obvious geometric defect on this facade (no overlap / no gap / no floating element) | 0.15 |

Facade total ∈ [0, 1]; sum of 4 facades ∈ [0, 4].

### 4.2 Per-floor source-vs-render comparison (3 pts)

For each of the 3 storeys (KG, EG, DG), compare the model snapshot
against the source plan page. Score each floor out of 1 pt:

| sub-criterion | weight |
|---|---|
| room count matches source ±1 | 0.3 |
| interior partitions follow source partition lines | 0.3 |
| openings (doors + windows) per room match source | 0.3 |
| no floor passes through another floor's level | 0.1 |

KG can be source-limited (no 1956 KG plan for alpha) — when the
source is missing, score against the *modern* plan in the Expose
PDF if present, otherwise mark KG as `source_limited` and rescale
the floor sub-total to 2 pts.

### 4.3 Vertical coherence (1 pt)

- Toposolid top at grade (≤ 50 mm above EG slab bottom): 0.3
- KG entirely below or flush with grade: 0.2
- Stair landing top reaches DG slab level (not half-rise): 0.2
- Roof eave above DG ceiling, ridge above DG kneestock + slope: 0.3

### 4.4 Materials reflect source palette (1 pt)

- Exterior wall material reads as plaster/render in source: 0.3
- Roof material reads as tile (terracotta/grey) in source: 0.3
- Material is *visibly applied in the captures* (not just set in
  the snapshot JSON): 0.4

### 4.5 No major geometric defect anywhere (1 pt)

A "major defect" is any of:

- Building floating above ground (any cardinal view)
- Visible wall stub poking through roof
- Slab disconnected from walls
- Roof overhang exceeds 1 m
- KG visible above grade

Each defect deducts 0.25 pt from this axis. Floor at 0 pt.

### 4.6 Gate

Honest grade ≥ 9.0/10 = converged for that house.
Honest grade < 9.0  = identify top remaining gap, fix, re-author.

The grader subagent (when used) **must** be given the rubric above
verbatim and **must not** be primed with "expected" scores. See §11
for the de-biased grader prompt template.

---

## 5. Methodology improvements (concrete code work)

### 5.1 Driver

- [M1] **DG-window inheritance (P1a)** — `_openings_bundle` should
  mirror EG windows onto DG when DG has facade walls but no IR
  window facts. Skip if the EG window's facade has a stair or
  garage above. Tag synthesized facts with `source: 'mirror-from-eg'`.

- [M2] **Strict-IR mode for openings** — when the IR has DG
  opening facts (e.g., beta), do not synthesize; use IR only.
  Avoid double-counting.

- [M3] **Plinth investigation hook** — add a `_assert_grade_flush`
  pre-capture check that walks the snapshot, computes EG-slab top
  elevation, compares to toposolid top, logs a warning if the
  delta exceeds 100 mm. Fix P2 chosen variant.

- [M4] **Article emitter** — after every iter the driver writes
  `tmp/reverse-bim/house-{X}/iter-{N}/article.md` per §14
  template, populated from the in-memory phase log + the honest
  rubric breakdown (driver can compute the element-census parts;
  the source-comparison parts need the grader).

### 5.2 Grader

- [G1] **De-biased grader prompt** — the prompt MUST NOT contain
  "expected" or "should land" language. It receives only the
  rubric + inputs (captures, snapshot, IR, source pages) and
  emits a JSON with per-axis scores + a written critique. See §11.

- [G2] **Source-render side-by-side renderer** — a small Python
  script that takes one capture PNG + the corresponding source
  elevation page and stitches them into a single side-by-side
  PNG at `tmp/reverse-bim/house-{X}/iter-{N}/diff/{facade}.png`.
  The grader uses these explicitly.

- [G3] **Honest grade cache** — write the grader's output JSON
  to `tmp/reverse-bim/house-{X}/iter-{N}/grade.json` so the
  convergence loop can read the latest score without re-grading.

### 5.3 Engine (gated to §13)

Each engine ask must be evaluated for nightshift inclusion. If a
clean ≤ 30-line patch lands, do it; otherwise document and defer.

### 5.4 Dashboard

- [D1] **Article rendering** — `/agents/{house}` dashboard renders
  per-iter `article.md` (already present in repo as endpoint
  scaffolding under `routes/agent_runs.py`; verify the article
  endpoint exists, ship one if missing).
- [D2] **Honest grade chip on iter card** — instead of "9.5"
  badge from a biased subagent, show the strict rubric total +
  per-axis micro-bars.
- [D3] **Source-render diff thumbnail** in the iter card, with
  click-to-expand to the full side-by-side.

---

## 6. Phase log (this section is the live progress board)

Each row = one /loop iteration. The loop appends here.

| iter | timestamp | house | what was tried | honest grade | notes / next |
|---|---|---|---|---|---|
| 0   | 2026-05-23 22:30 | (setup) | Phase 0 inventory + tracker authored | n/a | proceed to Phase 1 |

Append new rows after each loop wakeup. Keep `next` short — full
narrative goes into the iter article.

---

## 7. Phase 0 — Setup (one-shot, run before nightshift starts)

Pre-flight inventory + cleanup. Loop's *first* /loop wakeup runs
all of these in one go.

### 0.1 Verify dev server health

```bash
curl -s -o /dev/null -w "API:%{http_code}\n" http://127.0.0.1:28500/api/health
ps auxf | grep -E "uvicorn|vite" | grep -v grep
```

If API ≠ 200 OR no uvicorn process: bail loudly, do not start
nightshift. (User can re-launch `make dev-forwarded`.)

### 0.2 Verify the parallel agent's TSX work isn't breaking HMR

```bash
curl -s -o /dev/null -w "WEB:%{http_code}\n" http://127.0.0.1:22000/
```

If web returns Vite error page: pause for the parallel agent's
WorkspaceOverlays.tsx work to settle; check `git log -3` for a
clean head before continuing. Do **not** touch their code; loop
back in 600s if dirty.

### 0.3 Purge all 3 houses

```bash
uv run --project app python scripts/testhouse_purge.py
```

Expect `{"matched": 3, "removed": 3}`. If matched is 0 (already
purged): proceed.

### 0.4 Clean stale legacy iter-N-captures + iter-N-scoring dirs

```bash
cd /home/jhoetter/repos/bim-ai/tmp/reverse-bim
rm -rf iter-*-captures iter-*-scoring
ls -d iter-* 2>/dev/null  # should print nothing
```

(Per-house iter dirs at `tmp/reverse-bim/house-{X}/iter-{N}/` stay;
those are the per-house authoritative location.)

### 0.5 Reset gap counter + node mtime smell-test

```bash
date -u +'%Y-%m-%dT%H:%M:%SZ' > /tmp/bim-ai-nightshift.start
```

### 0.6 Mark §6 with "Phase 0 complete"

Append `| 0.6 | <ts> | (all) | Phase 0 complete — purged + cleaned | n/a | Phase 1 for alpha |` to §6.

---

## 8. Phase 1 — Fresh authoring (per house, one round)

For each house in `{alpha, beta, gamma}`, run the full author chain.
Each chain is one /loop wakeup.

### 8.1 Preflight — already done

The IRs at `tmp/reverse-bim/house-{X}/understanding/existing-building-ir.json`
are intact and shared across iterations. **Do not** re-run
preflight unless §6 records an IR-level change.

### 8.2 The author chain (one /loop wakeup)

```bash
cd /home/jhoetter/repos/bim-ai
HOUSE=alpha   # or beta / gamma
ITER=1        # nightshift starts iter numbering at 1
LOG=/tmp/bim-ai-nightshift/house-${HOUSE}.log
mkdir -p /tmp/bim-ai-nightshift

for FLOOR in TOPOLOGY KG EG DG ROOF; do
  uv run --project app python scripts/testhouse_drive.py floor \
    --house "$HOUSE" --iter "$ITER" --floor "$FLOOR" 2>&1 | tee -a "$LOG"
done
uv run --project app python scripts/testhouse_drive.py capture-ortho-views \
  --house "$HOUSE" --iter "$ITER" 2>&1 | tee -a "$LOG"
uv run --project app python scripts/testhouse_drive.py narrate-globals \
  --house "$HOUSE" 2>&1 | tee -a "$LOG"
```

Estimated time per house: ~4 min serial.

### 8.3 Capture sanity

```bash
cd tmp/reverse-bim/house-${HOUSE}/iter-${ITER}/captures
for f in ortho-*.png; do
  SZ=$(stat -c %s "$f")
  if [ "$SZ" -lt 30000 ]; then
    echo "BLANK: $f ($SZ bytes)"  # blank — re-run capture-ortho-views once
  fi
done
```

If any capture is blank after one retry: log + skip to next house.

### 8.4 Write iter article (per §14 template)

```bash
# Emit article via driver helper (M4)
uv run --project app python scripts/testhouse_drive.py write-article \
  --house "$HOUSE" --iter "$ITER" --phase summary
```

(If M4 isn't shipped yet, the loop writes the article inline using
a here-doc — see §14.)

### 8.5 Honest grade (per §11)

Spawn the de-biased grader subagent (§11.1 prompt template).
**Background**, awaited via task-notification. The grader writes:

- `tmp/reverse-bim/house-{X}/iter-{N}/grade.json` (machine)
- `tmp/reverse-bim/house-{X}/iter-{N}/grade-report.md` (human)

### 8.6 Append row to §6 phase log

```
| <iter> | <ts> | <house> | Fresh author chain — TOPOLOGY..ROOF + capture + grade | <grade>/10 | next: <topGap> |
```

---

## 9. Phase 2 — Convergence loop (per house)

Once Phase 1 has run for all 3 houses, enter the convergence loop.
Iterate per-house until §4.6 gate is met or stop-conditions trip.

### 9.1 One convergence iteration

1. Read latest `grade.json` for the house.
2. If grade ≥ 9.0: mark `CONVERGED` in §6, move to next house.
3. Otherwise read the grader's `topGap` field. Map to a P-line in §3.
4. Apply the gap's fix (driver edit / engine patch / IR adjustment).
   Commit + push as `testhouse nightshift iter-N <house>: <gap>`.
5. Re-author the house (Phase 1 §8.2 again, with iter bumped).
6. Re-capture + re-grade (§8.3 + §8.5).
7. Append §6 with new row.

### 9.2 Stop conditions per house

| condition | action |
|---|---|
| honest grade ≥ 9.0 | mark CONVERGED, next house |
| 12 iterations elapsed on this house | mark STALLED, write engine ask, next house |
| same `topGap` returned 3 iters in a row | mark THRASHING, escalate to engine ask, next house |
| dev server unhealthy (API ≠ 200) | wait 600 s, retry; after 3 fails, halt nightshift |
| git head has unrelated TSX changes blocking captures | wait 1200 s, retry |

### 9.3 Cross-house parallelism

Do **not** run authoring of two houses concurrently — the API has
revision-conflict risk on shared metadata commits. Run serially
per /loop wakeup, one house's full chain at a time.

Grading subagents **may** run in parallel (3 at once after Phase 1
completes for all 3 houses).

---

## 10. /loop wakeup playbook (THE entry point)

Every /loop wakeup follows this decision tree. The loop's prompt
text is `<<autonomous-loop-dynamic>>` — runtime resolves it; the
actual instructions are this section.

```
on wakeup:
  read tracker §6 (phase log)
  if §6 is empty:
    run Phase 0 (§7); append row; ScheduleWakeup(180s); end turn
  if §6's last row says "Phase 0 complete":
    run Phase 1 for alpha (§8); append row; ScheduleWakeup(60s); end turn
  if last row is Phase 1 alpha + alpha grade pending:
    poll grade.json; when present, append row; ScheduleWakeup(60s); end turn
  if Phase 1 ran for {alpha, beta} but not gamma:
    run Phase 1 for gamma (§8); …
  if Phase 1 ran for all 3:
    enter Phase 2 (§9); pick lowest-grade house with grade < 9;
    apply top gap fix; re-author; re-grade; append row;
    ScheduleWakeup(60s); end turn
  if all 3 houses CONVERGED or STALLED:
    run Phase 3 (§12); end loop (no ScheduleWakeup)
```

Dynamic-pacing notes:

- After kicking off a re-author (4 min) or a grader subagent
  (3 min): use `delaySeconds=60` and rely on harness task-completion
  notifications. The wakeup is a fallback in case the notification
  is missed.
- After kicking off a long preflight or reader pass: `delaySeconds=270`
  (under cache TTL).
- After a *waiting-on-external* situation (dev server down, parallel
  agent's TSX work mid-flight): `delaySeconds=1200`.
- Never `delaySeconds=300` exactly (worst cache cliff).

---

## 11. Strict de-biased grader

### 11.1 Grader prompt template

Use **this exact text** for every nightshift grader subagent. Do
not add "expected", "should", "verify the v2.X fix landed", or any
number that hints at the prior score.

```
You are a strict architectural-fidelity reviewer.

Score this BIM model against the source documents using the
Strict Source-Fidelity Rubric. Output a JSON file + a written
critique.

Inputs:
- Captures (4 cardinal orthos): {paths}
- Source elevation pages: {paths}
- Source plan pages: {paths}
- Model snapshot JSON: GET /api/models/{modelId}/snapshot
- IR (extracted facts): {path}
- (If present) source-render side-by-side stitches at
  tmp/reverse-bim/house-{X}/iter-{N}/diff/*.png

Rubric (10 pts total):
{paste §4 verbatim}

Procedure:
1. For each cardinal facade, open the matching source elevation
   page side-by-side with the rendered ortho. Count windows in
   the source; count windows in the render. Compute the §4.1
   sub-scores. Note specific mismatches with pixel positions.
2. For each floor, open the matching source plan side-by-side
   with the snapshot's room outlines. Compute §4.2.
3. Compute §4.3, §4.4, §4.5 directly from the snapshot + captures.
4. Sum into a 10-pt total.
5. Identify the single largest gap (call it `topGap`) using
   strict rule: pick the rubric sub-criterion with the largest
   absolute deduction. If a tie, pick the visually-most-glaring.

Constraints:
- Do NOT inflate scores because materials are set in JSON if
  they don't visibly affect the capture.
- Do NOT credit element existence if the element is invisible
  in all 4 cardinal captures.
- Do NOT compare against any prior grade.
- Do NOT use the word "expected" or "should" in your critique.

Output JSON shape:
{
  "house": "...",
  "iter": N,
  "modelId": "...",
  "rubricTotal": float,
  "axes": {
    "perFacade": {"N": {...}, "E": {...}, "S": {...}, "W": {...}},
    "perFloor": {"KG": {...}, "EG": {...}, "DG": {...}},
    "verticalCoherence": {...},
    "materials": {...},
    "noMajorDefect": {...}
  },
  "topGap": {
    "axis": "perFacade.S.windowCount",
    "deduction": 0.3,
    "description": "Source Ansichten-1.png shows 6 EG windows on south facade; render shows 3."
  },
  "gateMet": <bool>,
  "writtenCritiqueMd": "..."
}

Write JSON to: tmp/reverse-bim/house-{X}/iter-{N}/grade.json
Write Markdown to: tmp/reverse-bim/house-{X}/iter-{N}/grade-report.md
```

### 11.2 Verifying the grader isn't biased

After each grade lands, the loop runs a smoke-check:

- Total + per-axis micro-scores sum without rounding error
- `topGap.deduction` is the actual largest deduction
- `writtenCritiqueMd` does not contain the words "expected",
  "should", or any digit identical to the prior grade (a heuristic
  for "the grader anchored on the prior score")

Failures here: spawn a second grader with a stricter prompt, take
the lower of the two scores.

---

## 12. Phase 3 — Final report (one-shot at nightshift end)

Trigger: all 3 houses are CONVERGED or STALLED.

### 12.1 Aggregate report

Write `tmp/reverse-bim/nightshift-report.md` covering:

- Final per-house grades + how many iters each took
- Per-axis improvement curves (table: iter → axis scores)
- Engine asks raised (§13)
- Tracker §6 transcript
- Code commits log (`git log <start>..HEAD --oneline`)
- Total wall-clock time + number of /loop wakeups
- Recommended next-night focus (top 3 open gaps)

### 12.2 Commit + push

```bash
git add tmp/reverse-bim/nightshift-report.md spec/trackers/testhouse-nightshift-tracker-2026-05-23.md
git commit -m "testhouse nightshift report — 3 houses, final grades $A/$B/$G"
git push
```

### 12.3 End loop

Do not ScheduleWakeup. Print final report path in the user-facing
text and stop.

---

## 13. Engine asks (queue, not closed during nightshift)

Each ask = an engine-level change that needs deliberate design.
The loop documents them here and **does not** ship them inline.

### EA-1. `roofGeometryMode = "half_gable"`

For Doppelhaus halves (alpha + gamma west, beta no), suppress one
gable triangle on the party-wall side. Engine needs:

- New literal in `roof_geometry.py::RoofGeometryMode`
- New facet in `export_stl.py::_append_*_gable_roof` that omits
  the gable triangle on the side indicated by a new
  `suppressGableSide: 'min_x' | 'max_x' | 'min_y' | 'max_y'` field
- Validator + tests

Estimated 60–100 LOC + 30 LOC tests.

### EA-2. Slab base/top extrusion direction control

For P2 — let `createFloor` choose whether the slab extrudes upward
from the level (current) or downward to the level. New field
`slabExtrudeDirection: 'up' | 'down'`, defaulting to `up`.

Estimated 15 LOC + tests.

### EA-3. `setOpening` material/sill commands

To get the doors visible in captures (P3), we may need to elevate
their sill or change material. Minor — investigate after P3 fix.

### EA-4. Per-side roof overhang

Some source elevations show different overhangs on eave vs gable
sides. Currently `overhangMm` is scalar. Make it a 4-tuple.

### EA-5. UpdateToposolid `surfaceOffsetMm`

Eliminate the baseElevationMm confusion permanently by adding an
explicit `surfaceElevationMm` field (the engine treats it as a
direct surface-z input, not a top of a bottom-anchored solid).

---

## 14. Iteration article template

Every iteration produces a markdown article at
`tmp/reverse-bim/house-{X}/iter-{N}/article.md`. The loop writes
the article AFTER the grader returns (so it can quote the grade).

Article structure (strict — endpoint parses this; do not deviate):

```markdown
# alpha iter-{N} — {one-line title, e.g. "DG windows + plinth flush"}

**timestamp**: 2026-05-24T03:14:15Z
**modelId**: 50b64be7-…
**revisionRange**: 1 → 24
**honestGrade**: 7.4/10 (gate: NOT MET; +1.2 vs iter-{N-1})

## What changed since iter-{N-1}

- Bullet 1 (one-sentence)
- Bullet 2

## What I saw (capture review)

Brief honest description of each of the 4 cardinal orthos. Inline
references to which source pages they were compared against. Keep
to ~6 sentences total.

## Top remaining gap

Quote the grader's `topGap.description` verbatim. Then add the loop's
own one-line interpretation + which P-line in §3 it maps to.

## Code that landed

- `<commit-sha> <subject>`
- `<commit-sha> <subject>`

## Next iter plan

One sentence on what the next iter will try.

## Artifacts

- captures: `tmp/reverse-bim/house-{X}/iter-{N}/captures/ortho-{N,E,S,W}.png`
- grade: `tmp/reverse-bim/house-{X}/iter-{N}/grade.json`
- diff: `tmp/reverse-bim/house-{X}/iter-{N}/diff/{N,E,S,W}.png` (if present)
```

The `/agents/{house}` dashboard renders these inline (see D1).

---

## 15. Failure mode catalogue

Whenever the loop hits a known failure mode, it logs the matching
line ID in §6 and recovers per the row's action.

| ID  | symptom | action |
|---|---|---|
| FM1 | API returns 5xx | poll `/api/health` every 60 s; after 3 fails, halt + write report |
| FM2 | Capture PNG < 30 KB | already retried inside runner; if still blank, re-run capture-ortho-views once; if still blank, mark `capture_failed` in §6 and proceed (grader will work with the 3 good captures) |
| FM3 | Vite build error in capture | check `git log` for parallel-agent TSX changes; wait 1200 s; if still broken, mark `web_dirty` in §6 and pause loop |
| FM4 | createFloor 409 duplicate id | the room-id factId-first fix (v2.11) should prevent this; if it recurs, log the duplicate id pair |
| FM5 | structural-gate FAIL | non-blocking; element committed_with_blockers; loop ignores |
| FM6 | revision_conflict 409 | already auto-retried in driver `_post()`; if it still fails, escalate |
| FM7 | grader output is biased (per §11.2) | spawn second grader with stricter prompt; take lower of two |
| FM8 | grader cannot find source page (path drift) | log + fall back to inferring source paths from `preflight/rendered-pages/` |
| FM9 | snapshot returns empty elements | dev server restart needed; user notification + halt |
| FM10| stair authoring 409 on missing DG slab | already deferred to ROOF iter; if it recurs, log |

---

## 16. Open questions for the user (asked after nightshift only)

- Should the dashboard show *all* iters (full evolution) or just
  the latest converged iter?
- For Doppelhaus party-wall: do we accept full-gable as "good
  enough" until EA-1 lands, or invest the engine time tonight?
- For DG windows: P1a (mirror from EG, cheap) is the default;
  switch to P1b (re-read elevation pages) if the user prefers
  source-faithful over fast?

(Loop must NOT ask these questions during the nightshift; they
go in the final report for user review in the morning.)

---

## 17. Estimated time budget (per /loop wakeup)

| activity | wall clock |
|---|---|
| Phase 0 (purge + clean) | ~20 s |
| Phase 1 author chain (one house) | ~4 min |
| Capture-ortho-views | ~55 s |
| Grader subagent | ~3–5 min |
| Code edit + commit + push | ~30 s |

Per convergence loop iteration (one house): ~10 min serial.
A normal night yields **40-60 convergence iterations** across the
three houses. That's plenty to hit §4.6.

---

## 18. The end state we're aiming for

When this tracker concludes:

- `/agents/alpha`, `/agents/beta`, `/agents/gamma` each show an
  iter strip ending in a green "9.X/10 — converged" chip
- Every iter has an article + captures + side-by-side source diff
- `tmp/reverse-bim/nightshift-report.md` exists and reads like a
  product post-mortem
- `spec/trackers/testhouse-nightshift-tracker-2026-05-23.md` (this
  file) §6 is full of rows + §13 has the engine asks queued for
  the next morning's review.
