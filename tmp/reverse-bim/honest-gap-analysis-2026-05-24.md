# Honest Gap Analysis — 2026-05-24

The user looked at the live `make dev-forwarded` viewer and judged "3/10
at most" while the nightshift's subagent graders kept returning
9.8/9.5/9.8. Investigating WITHOUT subagent-grader noise; this is my
own visual read of the captures + the model state.

---

## 1. The dashboard "15 iterations, 14 narrative" issue

**Real bug** (NS-11 commit `b21c0f195` fixes it):

`agent_runs.py::_scoring_path_for(iteration, house)` only checked
`tmp/reverse-bim/iter-{N}-scoring/{house}-subagent-report.md`, but the
nightshift graders write to
`tmp/reverse-bim/house-{H}/iter-{N}/grade-report.md`. Result: every
iter card on `/agents/alpha` shows `scoringReportPresent=False` →
appears as narrative-only.

After the fix: dashboard checks the per-house location first, falls
back to the legacy.

There's a secondary issue: 16 iter dirs at
`tmp/reverse-bim/iter-{N}-captures/` accumulate from repeated runs.
Even though we purge MODELS, we don't clean the legacy capture dirs
between iters. Dashboard treats every iter-N-captures dir as an
iter card → 16 cards. This is cosmetic but confusing.

---

## 2. The "tilted topology" perception

**Not a real model defect**. Data is perfectly orthogonal:
- alpha walls at (0,0)→(9900,0)→(9900,8750)→(0,8750) — clean rectangle
- Levels stack KG/EG/DG at -2250/0/+2750

**Real cause**: capture cameras had `(x, y, 0.05)` offset unit vectors
— the +0.05 z-component lifted the camera above the building center,
giving a bird's-eye perspective. Vertical lines in the render therefore
tilted off-vertical, making the building LOOK tilted.

NS-11 commit `b21c0f195` removes the z-offset → true horizontal side
views. Recapture all iters to see flat orthos.

---

## 3. The "dormers not correctly attached" perception

**Looking at alpha west capture** (`tmp/reverse-bim/house-alpha/iter-15/captures/ortho-west.png`):

I see a clean gable triangle (the west party-wall side, A3 deferred,
correctly authored as full gable for now) — and ABOVE the gable
silhouette, a second smaller box "stacked" on top.

That stacked box is the south-slope Schleppgaube dormer poking up
through the silhouette as seen from the west angle. Per geometric
math the dormer IS attached to the main roof slope; the engine
renders it as a separate prism rather than integrating cheek walls
with the main roof tile pattern. So the dormer:

- Is correctly hosted on the roof (`hostRoofId=th-alpha-main-roof`)
- Is correctly positioned on the slope (`positionOnRoof` math checks out)
- BUT renders as a separate brick-like volume with its own walls + roof,
  not blended with the main roof tile pattern

That's a **viewer-side defect**: the engine's dormer mesh builder
should:
- Cut a notch in the main roof slope where the dormer punches through
- Render the dormer's cheek walls in the WALL material (currently they
  render in the ROOF material)
- Optionally use a shared edge with the main roof

This is engine work; ~50–100 LOC in `meshBuilders.ts::makeDormerMesh`.

**Logged as MF-22 in §19.**

---

## 4. Honest grade re-read (my own, not subagent)

### Alpha (1956 Doppelhalbach)

Comparing `tmp/reverse-bim/house-alpha/iter-15/captures/ortho-{N,E,S,W}.png`
against `tmp/reverse-bim/house-alpha/preflight/rendered-pages/srcdoc-ee9dfd8186b6/Ansichten-1.png`:

**What's right:**
- Footprint 9.9×8.75 m matches IR
- 2-storey + steep gable silhouette is correct
- Kniestock (NS-8) puts eave at the right elevation
- Materials visible (terracotta roof, light render walls)
- 2 dormers authored (N + S Schleppgauben)
- 1 chimney authored
- 2 stairs (KG↔EG, EG↔DG)

**What's wrong:**
- South facade shows ~2 EG windows + entry door — source shows ~4 EG
  windows + door + symmetric DG window pattern. Sparse fenestration.
- East gable: 4 windows authored in snapshot, ZERO visible in render
  (engine doesn't cut openings on gable end walls — **MF-21**)
- Dormers visible but render as separate cubes, not blended with roof
  slope (**MF-22**)
- West gable peak still present (A3 deferred — needs half_gable engine
  mode, **EA-1**)
- Chimney is a thin pole without a cap
- No window sills, lintels, shutters
- Building looks "boxy" vs source's articulated facade

**Honest score: 5/10.** The grader's 9.8 was generous on perFacade by
crediting authored-but-invisible elements.

### Beta (2007 Boss SFH)

**What's right:**
- L-shape footprint with garage SE wing
- Flachdach over garage (concrete material, slope 2°)
- Main gable with E-W ridge (ridgeAlongX explicit override correct)
- 14 windows + 10 doors authored
- Kniestock DG (1530mm) per IR

**What's wrong:**
- South facade source has 2-storey glazing band on Wohnen/Essen +
  balcony + terrace door — model has 3 punched windows + 1 door
- North facade source has Haupteingang + Küche window + Spitzboden
  windows — model has door + 1 window
- East garage roller door visible in source — render shows blank wall
- Spitzboden (attic above DG) not authored at all — model has 3 storeys,
  source has 4
- Same dormer-as-separate-cube issue
- No balcony rail / planter / paving

**Honest score: 5/10.** Materials right, geometry under-articulated.

### Gamma (Historicist Doppelhalbach)

Comparing iter-15 captures vs `Kannenofen-07.png` (Strassenansicht source):

**Source shows a richly detailed historicist building:**
- 3 visible storeys + attic
- 3–4 cross-gables (Zwerchhäuser) projecting from main roof
- Many windows arranged in regular grid
- Multiple chimneys with caps
- Decorative facade articulation, sills, lintels
- Probable balconies

**My model shows:**
- 2-storey box with Kniestock
- 1 Zwerchhaus + 2 Schleppgauben + 2 chimneys
- 13 windows total
- Plain rectangular silhouette
- A3 deferred full gable on west

**Gap is enormous.** The model has the right top-level massing but
misses the architectural articulation entirely. The grader's 9.8 was
indefensible.

**Honest score: 4/10.** Lots of work needed.

---

## 5. Where the grader subagents went wrong

The strict rubric §4 is theoretically sound: per-facade window count,
dormer presence, roof shape, door presence, defect-free.

But graders consistently:

1. **Credited elements that exist in the snapshot but don't render**
   — e.g., alpha east 4 windows authored but invisible in capture →
   grader said "4 windows present" instead of "0 visible".
2. **Treated "missing source feature" as not-a-deduction** when the
   feature is fundamental to the building's identity. A Doppelhalbach
   without 4 cross-gables ISN'T graded as "minor deduction" — it's a
   fundamentally different building.
3. **Drifted on the "source_limited" rescaling** — alpha's perFloor
   axis kept rescaling to 2pts max even when DG was authored, giving
   a free 0.67 pt that didn't reflect reality.
4. **Hit ceiling on materials** because the boolean "materialKey set"
   was true even when only the most-superficial coat showed.

**Fix recommendation**: the next-night grader rubric needs:
- "Source-elevation visual similarity %" — count features in source vs
  features in render, ratio them. No more axis math.
- Penalize invisible-in-render elements at SAME RATE as missing
  elements — both contribute to the visual gap.
- Spawn THREE graders per iter and take the MEDIAN (or low score) to
  cancel grader bias.

---

## 6. Real architectural defects (sorted by visible impact)

| ID | defect | houses affected | est fix |
|---|---|---|---|
| D1 | Sparse fenestration vs source (windows missing) | all 3 | author more EG/DG window facts per facade based on source elevations |
| D2 | Engine doesn't cut openings on gable end walls (MF-21) | all 3 | engine work, ~80 LOC `_cutWallOpening` |
| D3 | Dormers render as separate cubes (MF-22) | all 3 | viewer work, ~50 LOC in dormer mesh builder |
| D4 | No window sills / lintels | all 3 | engine work, new createWindowSill cmd OR extend insertWindowOnWall |
| D5 | No chimney caps | gamma + alpha | tiny createColumn at chimney top with wider cross-section |
| D6 | West gable peak on Doppelhaus (party wall) | alpha + gamma | EA-1 half_gable engine mode |
| D7 | Spitzboden (attic above DG) not authored on beta | beta | new level + walls + roof above current DG |
| D8 | Gamma source has 3-4 cross-gables, model has 1 | gamma | author 2-3 more Zwerchhaus facts in gamma IR |
| D9 | No balconies (gamma + beta) | beta, gamma | engine support for balcony slabs / railings (BalconyElem exists) |
| D10 | Building's facade looks plain — no string-course, lintel band | all 3 | architectural relief band as createColumn rows or similar |

---

## 7. What I'd do given a fresh nightshift

Priority order if the user wants me to keep working:

1. **D1 sparse fenestration**: re-read source elevations and synthesize
   additional window facts for each facade (driver+IR work). Lifts all
   3 honest scores by ~1–1.5 pts.
2. **D2 MF-21 gable wall opening cutting**: engine work. Without this,
   alpha east gable + every house's gable ends show as blank walls
   regardless of how many windows are authored.
3. **D6 EA-1 half_gable**: closes A3 for alpha + gamma west.
4. **D3 MF-22 dormer integration**: viewer-side mesh blending. Lifts
   the visible "weirdness" the user flagged.
5. **D8 more cross-gables for gamma**: simplest source-fidelity win.

Total est ~6–10h of careful engine+driver+viewer work. Risky overnight
without explicit user direction.

---

## 8. Specific commits user should look at to verify these claims

- `b21c0f195` — camera tilt + dashboard scoring path (these two fixes
  alone will make the captures look better + the grades appear in /agents
  after the next capture pass)
- `e309477a1` — NS-10 opening sill/height fix (beta DG windows landed)
- `bce556dc6` — NS-8 Kniestock
- `06e6c0f8c` — NS-4 wall material visibility
- `94e61d251` — NS-2 camera-sweep fix

---

## 9. The grader bias problem in one sentence

> Every subagent grader I spawned interpreted the rubric to give credit
> for elements present in the snapshot JSON, not for elements visible
> in the render — and our captures often show much less than the JSON
> contains.
