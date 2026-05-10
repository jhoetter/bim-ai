---
name: sketch-to-bim
description: Use this skill when the user hands you a customer sketch (line drawing, render, photo, or hand sketch) plus an optional verbal brief, and asks you to author or extend a bim-ai BIM model that matches the sketch. The skill defines a phased architect's workflow (massing → skeleton → envelope → openings → interior → detail → documentation) with per-phase visual checkpoints, soundness validation, and an iteration loop. Trigger phrases include "build a BIM model from this sketch", "seed the house from this sketch", "generate a BIM model that matches this drawing", or any task that anchors on `spec/target-house-seed*.{md,png}` or comparable customer-supplied imagery.
---

# Sketch-to-BIM — the architect's playbook

You are the AI architect. The customer hands you a sketch (line drawing, render, photo, or hand sketch) and a brief; you produce a sound, correctly-proportioned BIM model in `bim-ai` that **looks like the sketch from the called-out viewpoints**. Your output is a working bim-ai model that can be loaded in the dev environment and resembles the sketch.

This skill is the methodology a world-class architect would use, encoded as a deterministic process. Software stays deterministic; you provide the intelligence — interpreting the sketch with your own multimodal vision, judging silhouette match, picking materials, authoring corrective commands.

Before any substantial sketch-to-BIM run, read `spec/sketch-to-bim-methodology.md`. Treat it as the product/engineering tracker for this workflow: it defines the user input contract, Sketch Understanding IR, capability matrix, acceptance gates, scoring rubric, and implementation backlog. This skill is the operational checklist; the spec is the durable methodology source.

---

## The mindset shift

You will fail this task if you treat it as a single translation problem (read sketch → emit one big command bundle → declare done). The previous attempt did exactly that and shipped a featureless box; see `nightshift/seed-fidelity-status.md` for the post-mortem.

You will also fail if you treat `make seed`, `bim-ai plan-house`, or `scripts/build-seed-snapshot.mjs` as generators. They replay the checked-in canonical bundle. To improve a seed house, edit the bundle source itself (usually `packages/cli/lib/one-family-home-commands.mjs` or a replacement project bundle), rebuild the snapshot, render checkpoints, read advisor findings, and feed those findings back into the next bundle edit.

The right mental model is **iterative convergence through 5–7 phased passes**, each one visually validated before adding detail. After each phase: render, look, validate, correct. Never advance with a phase that doesn't read.

For seed work, the loop is not optional: keep the dev app running while authoring, reseed after each meaningful bundle edit, inspect the same UI Advisor panel the user sees, capture/check screenshots from saved viewpoints, and revise the source bundle until visible geometry and advisor findings converge. Do not rely only on offline snapshot generation, unit tests, or successful command replay.

> **Every phase is committed independently. Every phase is verified independently. You do not move to phase N+1 until phase N's silhouette matches the target.**

---

## Non-negotiable operating contract

This skill is for project initiation, not for producing a decorative massing preview. A sketch-to-BIM run is not complete until the model is both visually faithful and software-clean enough that another user can continue design work from it.

The agent must satisfy all of these before calling the initiation successful:

1. **The local app is part of the workflow.** The model must be inspected through the same software the user sees, normally `http://localhost:2000` from `make dev`, plus the CLI/API advisor payload. Offline bundle replay is only a syntax/snapshot check.
2. **Advisor findings are hard evidence.** Every advisor item with severity `warning` or `error` must be either fixed or listed in an explicit tolerance table with rationale. Do not mentally discount a warning because the 3D view "looks okay".
3. **No architectural warning may be hidden by a workaround.** A fake closure such as drawing room-separation rectangles around every authored room is a failure if it creates `room_derived_interior_separation_ambiguous`, unreadable wire views, or a plan that no architect would accept.
4. **Screenshots are required evidence.** The agent must inspect rendered screenshots from multiple saved viewpoints and at least one plan/wire-style diagnostic view. A single attractive perspective is not enough.
5. **The model must be usable after initiation.** Stairs cannot run into walls, rooms cannot be inaccessible, slabs/openings cannot overlap incoherently, roofs cannot merely carry metadata for a void that does not render, and schedules/sheets must not contain obvious unresolved references.
6. **If the software says the model is wrong, assume the model is wrong first.** Only accept a warning after reading the rule, the affected `elementIds`, and the model geometry. The burden is on the agent to justify a tolerance.

### Blocking advisor classes for sketch initiation

These findings block phase advancement unless the user explicitly accepts them with a written rationale:

- `room_boundary_open`
- `room_unenclosed`
- `room_derived_interior_separation_ambiguous`
- `room_no_door` for interior rooms, occupied rooms, bathrooms, bedrooms, kitchens, circulation, or terrace rooms that should have access
- `room_target_area_mismatch` when `targetAreaM2` came from the brief or from a deliberate programme target
- `floor_overlap`, `wall_overlap`, major host/intersection warnings, or any opening-host warning
- `stair_comfort_eu_proxy`, stair schedule warnings, or any stair/shaft mismatch
- roof, roof-opening, dormer, balcony, or material warnings tied to features visible in the sketch
- schedule/sheet viewport warnings in Phase 7 Documentation

`info` findings are not automatically blockers, but the agent must read them. If an `info` finding explains visible bad output, treat it as blocking.

### Forbidden shortcuts

- Do not use room-separation rectangles as a universal room-closure hack. Use actual walls for real partitions and use room-separation lines only where the intended architectural condition is an open boundary between spaces.
- Do not leave model categories hidden to make a screenshot look cleaner. Validate with walls, roofs, floors, rooms, doors/windows, and stairs visible; also inspect at least one wire or transparent diagnostic view.
- Do not call a semantic element done until it renders. For example, `createRoofOpening` is not sufficient unless the rendered checkpoint shows a real cut through the roof.
- Do not claim "advisor is only advisory" for findings authored in the current phase. Fix them before moving on.
- Do not add furniture/detail to distract from unresolved shell, stair, room, or roof faults.
- Do not leave conceptual `mass` placeholders in the final initiation model as if they were walls, roof returns, or façade panels. Masses render as translucent study geometry; replace them with walls, roofs, floors, sweeps, openings, or typed assemblies before handoff.

---

## Pre-flight (before you touch the engine)

0. **Load the methodology tracker.** Read `spec/sketch-to-bim-methodology.md` and identify:
   - the expected user input level (sketch-only, sketch + brief, or fully dimensioned);
   - the target output level (massing-only, concept BIM, project-initiation BIM, documentation-ready);
   - the required acceptance gates for this run;
   - any capability gaps that must be resolved before modelling.

1. **Locate the inputs.** Read every customer-supplied document and image:
   - The brief (markdown, e.g. `spec/target-house-seed.md`) — read it end-to-end.
   - The reference imagery (e.g. `spec/target-house-seed-vis.png`, `spec/target-house-vis-colored.png`) — open every image with the Read tool. Look at it with your own vision. Describe back, in writing, what you see.
   - Any sketch panels (main perspective, front / side / rear elevations, axonometric).

2. **Perform a visual source-of-truth pass.** The image is not decorative context; it is the primary design evidence. Before authoring commands, write a concise visual readout that names the non-negotiable features visible in the sketch:

   - primary silhouette and camera direction;
   - which volume is dominant, which volume supports it, and where any cantilever/void occurs;
   - roof form, roof thickness, cutouts, embedded balconies, parapets, and return faces;
   - facade bay rhythm, recessed planes, glazing proportions, railings, visible stairs, and cladding direction;
   - material contrast and linework.

   If the written brief conflicts with what the image clearly shows, treat the image as authoritative and update the brief/spec before rebuilding the seed. Do not proceed from a generic architectural label such as "asymmetric gable"; translate the visible geometry into buildable elements.

3. **Fill out the Sketch Understanding IR.** Produce the structured brief described in `spec/sketch-to-bim-methodology.md` (SKB-21 format when it lands; today, write it as JSON or Markdown at `nightshift/<sprint>/brief.md`). Required fields:

   ```
   - style: "modernist" | "traditional" | "minimalist" | "industrial" | …
   - program: [{ name, areaM2Approx, level, programmeCode? }, …]
   - siteOrientation: { northDegCwFromPlanX }
   - keyDimensions:
       - footprint width / depth (mm)
       - floor-to-floor heights (mm)
       - ridge / eave heights (mm)
       - any sketch-called-out dimensions (annotate with sketch coord if you eyeballed)
   - materialIntent: [{ surface, materialKey?, evidence }, …]
   - specialFeatures:
       - asymmetricGable: { ridgeOffsetDir, severity }
       - loggiaRecess: { face, depthMm }
       - dormer: { face, dimensions }
       - balcony: { face, projectionMm }
   - referenceImages: [path, …]
   - viewpoints: [{ name, sketchPanelMatched }, …]
   ```

4. **Log every assumption.** Where the sketch is ambiguous (overhang depth not called out, exact eave height not dimensioned), do not guess silently. Write the assumption to the assumption log with the sketch coordinate that triggered the inference. Use `agent_assumption` element kind once SKB-08 lands; before that, write a markdown bullet list at `nightshift/<sprint>/assumptions.md`.

5. **Build the capability matrix.** For every critical visual feature, map the feature to the command/API surface, renderer support, advisor coverage, and known failure mode. If a critical feature cannot be represented faithfully, create a capability-gap task instead of faking it with decorative geometry.

6. **Pick the closest archetype, if any** (SKB-09). Today there are none; you start from a blank model. When archetypes ship, use `bim-ai archetype list` and fork the closest one — never start from blank if a 70%-match archetype exists.

7. **Calibrate.** Anchor 2–3 known dimensions from the sketch (typically: overall house width, floor-to-floor, one elevation point). Compute a pixel-to-mm scale factor. When SKB-04 (`bim-ai calibrate`) lands, use it; today, do the math by hand and record in `assumptions.md`.

---

## Project initiation runtime loop

Before authoring the first serious bundle, start and wire the feedback loop:

1. **Start the app:** run `make dev` and verify `http://localhost:2000` loads the workspace. If the server is already running, reuse it and note the URL/port.
2. **Create or select the working model:** for the canonical seed use `make seed`; for a user project use the project-initiation endpoint/model id. Record `BIM_AI_MODEL_ID`.
3. **Keep a phase evidence folder:** `nightshift/<sprint>/phase-<n>/` with:
   - `commands.json` or source bundle pointer;
   - `advisor-warning.json`;
   - `advisor-info.json`;
   - `screenshot-<viewpoint>.png`;
   - `visual-readout.md`;
   - `tolerances.md` if anything remains unresolved.
4. **After every meaningful edit, run all four checks in order:**
   - replay/dry-run: `node scripts/build-seed-snapshot.mjs` for seed work, or `bim-ai apply-bundle --dry-run --in <commands.json>` for project work;
   - seed/apply: `make seed` or apply the bundle to the project model;
   - advisor: `BIM_AI_MODEL_ID=<id> node packages/cli/cli.mjs advisor --output json --severity warning` plus an info pass when diagnosing weird visuals;
   - render: Playwright checkpoint screenshots or direct browser screenshots from the saved viewpoints.
5. **Read the screenshots with vision.** Say what is wrong in geometric terms before editing again: roof too generic, cutout not legible, stair collides, room plan messy, facade rhythm wrong, scale too small, etc.
6. **Read the Advisor panel like a punch list.** For each finding capture `ruleId`, severity, message, recommendation text, perspective/codePreset, and `elementIds`. Corrections must target the named elements unless the rule itself is wrong.
7. **Patch the source of truth, not the symptoms.** If `room_derived_interior_separation_ambiguous` appears, redesign room boundaries; do not hide room lines. If a stair warning appears, alter the stair footprint/riser/tread/shaft; do not move furniture around it.
8. **Verify capability, not just intent.** If the sketch needs a gable-cut wall, folded shell, roof void, dormer, or non-rectangular opening, confirm the command/API/render path actually expresses that geometry. A valid command that still renders as a rectangle, box, or uncut surface is a failed phase.
9. **Repeat until both views and advisor pass the phase gate.**

The agent should keep the browser open while authoring. If screenshots and advisor output disagree, both are evidence: a visually good but advisor-broken model is not accepted; an advisor-clean but visually wrong model is not accepted.

### Minimum checkpoint view set

Every project initiation needs this view set, even if the target sketch has only one perspective:

- main sketch-matched axonometric/perspective;
- front elevation or frontal perspective;
- left/right side view showing depth, roof and balcony/loggia conditions;
- rear/roof axonometric when the sketch contains a roof cutout, terrace, dormer, or courtyard;
- ground floor plan with room/wall/stair categories visible;
- upper floor/roof plan with room/wall/stair/roof-opening categories visible;
- one transparent or wire diagnostic view to catch hidden overlaps, room-separation clutter, stair collisions, and roof/floor artifacts.

If any required view reveals an obvious flaw, the phase fails even if Playwright tests pass.

### Phase acceptance packet

At the end of each phase, produce a short packet:

| Field | Required content |
| --- | --- |
| Phase | phase id/name and source bundle revision |
| Screenshots | paths to actual rendered PNGs |
| Visual verdict | pass/fail for silhouette, scale, roof, openings, interior, documentation as applicable |
| Advisor verdict | zero blocking warnings, or explicit tolerance rows |
| Corrections made | list of element ids changed in the phase |
| Remaining risk | concrete gaps, not vague optimism |

If the packet cannot be filled honestly, do not advance.

---

## The 7 phases

Author **only** the elements listed for the current phase; do not skip ahead. Each phase ends with: commit → checkpoint → advisor pass → validate → refine → advance.

### Phase 1 — Massing

**Author:** project-base-point, levels, the volumetric blocks that define overall form. When SKB-02 (`mass` element kind) lands: author `mass` elements. Today: stub with an oversized `floor` or a flat-roof shell of walls representing the overall envelope, materialKey unset.

**Validate:**

- Element-count prior (SKB-13): for a single-family two-story home expect ≥1 mass / shell, 2 levels, 1 base point.
- Levels stack monotonically (no interleaving).
- Footprint dimensions match the calibrated brief within 5%.

**Checkpoint:** screenshot the SSW iso (or the sketch's main-perspective viewpoint). Compare silhouette — does the **outer outline** match the sketch's main perspective? **No materials, no openings, no roof slope yet.** Just the box outline.

**Refine until match.** Then advance.

### Phase 2 — Skeleton

**Author:** primary structural walls (load-bearing exterior walls, primary partitions), floor slabs at every level, roof footprint placeholder (flat for now, even if the target has a gable). Do not yet add openings, materials, or detail.

**Validate:**

- SKB-05 architectural soundness pack (when it lands): wall corners meet, floors match wall enclosure, levels stack.
- SKB-19 wall-graph closure: every floor's perimeter is a closed wall ring.
- SKB-22 auto-join: walls at coincident endpoints are joined.

Today, the existing `constraints.evaluate` runs at commit; check the violations list and resolve any blocking-severity items. Also read the Advisor panel for the active `codePreset` / perspective and treat its non-blocking findings as phase evidence, not UI noise.

**Checkpoint:** floor plan view + 3D iso. Floor plan should show closed rooms; iso should still match the silhouette.

### Phase 3 — Envelope

**Author:** the actual roof shape (gable / asymmetric_gable / hip / flat per the sketch), wall heights matched to roof attachment, exterior wall material keys. **Still no openings.**

**Validate:**

- SKB-11 roof-wall alignment: the roof footprint contains every upper-floor wall centerline.
- Asymmetric gable sanity (if applicable): with current `_buildAsymmetricGableGeometry`, `eaveLeftMm + leftRunMm·tan(slopeDeg)` must be > `eaveRightMm` for a normal gable peak — if not, your slope or eave heights are wrong and the ridge will sit below an eave (producing a flat-looking roof, the seed-fidelity failure mode).
- Roof material key resolves in MAT-01.

**Checkpoint:** SSW iso. The asymmetric massing should now read clearly. The picture-frame outline (KRN-15 sweep) belongs in this phase if the sketch shows a thick gable frame.

**Refine ruthlessly here.** This is where the seed-fidelity sprint failed — it advanced to materials/openings without confirming the silhouette.

### Phase 4 — Openings

**Author:** doors, windows, wall_openings on the envelope walls. Apply `outlineKind` (KRN-12) for non-rectangular windows. Apply `operationType` (KRN-13) for non-swing doors.

**Validate:**

- Openings within wall bounds (existing constraint).
- SKB-06 proportion linter: door widths ∈ [700, 2000] mm, sill heights ∈ [80, 1500] mm.
- Hosted openings on recessed walls: render against the recessed surface (KRN-16's `recessOffsetForOpening`).

**Checkpoint:** front elevation viewpoint. Compare opening positions and proportions to the sketch's front elevation panel.

### Phase 5 — Interior

**Author:** room separations, partition walls, stairs, slab openings (stair shafts), railings, room outlines + programme codes.

**Validate:**

- VAL-01 / SKB-19 closure: every room is bounded by walls or deliberately placed room separations.
- Room separation lines are only allowed for intentional open-plan boundaries, terrace/deck edges, or non-wall symbolic boundaries. If they create `room_derived_interior_separation_ambiguous`, redesign the room/wall layout.
- Every room outline edge must be explainable: exterior wall, interior wall, glass guard/partition, or a documented open boundary.
- `room_boundary_open`, `room_unenclosed`, and `room_no_door` are blockers unless explicitly tolerated for an exterior/unoccupied space.
- Stair runs base/top match the level stack.
- Slab opening hosted on the correct floor.
- Stair is architecturally plausible: it has landing/clearance, does not run directly into an exterior wall, does not collide with a door/window/furniture, and satisfies the active stair comfort proxy or has a documented standard-specific reason.

**Checkpoint:** plan view of each level. Compare to the sketch's plan if one is provided; otherwise verify rooms make programmatic sense.

### Phase 6 — Detail

**Author:** balcony, fascia / gutter sweeps (KRN-15), picture-frame outlines, dormers (KRN-14), wall recess zones (KRN-16) for loggias / bay windows, family-instance overrides for curtain panels (KRN-09). Apply secondary materials.

**Validate:**

- Sweep paths produce visible geometry (run an offline render — when SKB-03 lands, use `bim-ai checkpoint`; today, run the dev server and look).
- Dormer footprint within host roof bounds.
- Recess zones don't overlap, setback ≤ thickness × 8.

**Checkpoint:** SSW iso (main perspective) + rear axonometric. Compare to the sketch's main-perspective panel.

### Phase 7 — Documentation

**Author:** sheets, schedules, plan_views, view_templates, section_cuts, dimensions, viewpoints (named to match the sketch's panels).

**Validate:**

- Sheet has all the viewports the brief calls out.
- Every schedule renders rows.

**Checkpoint:** open every sheet and every named viewpoint; confirm the documentation reads.

---

## The refine loop (within every phase)

After every commit:

1. **Render** the phase-relevant viewpoint(s). Use the dev server + Playwright e2e harness today; when SKB-03 lands, use `bim-ai checkpoint`.
2. **Look** at the rendered PNG with your own multimodal vision. Compare to the sketch.
3. **Read the Advisor panel / violation payload.** Capture each finding's `code` or `advisoryClass`, severity, message, recommendation, perspective / `codePreset`, and `elementIds`. Use the same filter the user would use in the UI, e.g. residential + Architektur for architectural sketch-to-BIM work.
4. **Classify every advisor finding:** blocker, phase-local fix, later-phase fix, or tolerated. A warning cannot be ignored; it must be in one of those buckets.
5. **Score** the match qualitatively: silhouette ✓/✗, proportions ✓/✗, materials ✓/✗, advisor ✓/✗.
6. If mismatch: **identify the largest visible or advisor-reported delta** — typically one of: wrong dimension, wrong slope, missing element, wrong material, target-area mismatch, unbounded room, ambiguous room derivation, bad stair comfort, unresolved opening / host issue.
7. **Author 1–2 corrective commands/source edits** (`updateElementProperty`, `moveWallEndpoints`, room outline edits, stair tread / riser edits, etc.).
8. **Re-render. Re-read advisor. Re-look.**
9. Cap at 5 iterations per phase. If still mismatched, log an assumption and escalate to the user with screenshots and advisor JSON. Do not silently accept a bad model.

### Advisor findings are first-class input

The software already identifies many issues the sketch-to-BIM agent tends to create. Use those findings as a targeted punch list inside the same refinement loop as visual deltas:

- `room_target_area_mismatch`: compare computed room outline area with `targetAreaM2`; adjust the room boundary when the sketch/program is right, or adjust `targetAreaM2` only when the brief target was an agent guess.
- `room_derived_interior_separation_ambiguous`: remove or reposition room-separation lines that pierce derived spaces; use real partition walls where a real partition exists. This is a blocker for project initiation because it indicates an unreadable plan.
- `room_boundary_open` / `room_unenclosed`: add real enclosure geometry or correct the room outline. Do not paper over the issue by drawing a complete room-separation rectangle unless the room truly has no walls.
- `room_no_door`: add an actual access opening or correct the room outline/centroid. For terraces, add a door from the interior; for bathrooms/bedrooms, verify access from circulation.
- `stair_comfort_eu_proxy`: revise tread depth, riser height, run count, or stair footprint before leaving Phase 5 Interior.
- `floor_overlap`: split slab boundaries or change levels; overlapping floors are not acceptable as a hidden artifact.
- schedule/sheet warnings: fix in Phase 7; they are not acceptable in the final initiation handoff.
- Any host / opening / room-boundary / material-resolution advisory: fix the named `elementIds` before adding detail that would hide the underlying problem.

Do not advance a phase just because the commit is accepted. If the Advisor panel shows findings tied to elements authored in the current phase, either resolve them, record a deliberate tolerance with rationale, or escalate. The status doc must list unresolved advisor findings next to unresolved visual-fidelity gaps.

### Visual failure classes are also blockers

The agent must explicitly inspect for these in screenshots:

- roof reads as a generic roof instead of the sketch-specific roof form;
- roof-attached walls remain rectangular where the sketch shows gable-cut, sloped, or folded-envelope tops;
- roof opening, balcony, dormer, courtyard or loggia exists semantically but not visually;
- conceptual mass boxes remain visible as translucent finished envelope geometry;
- upper/lower volumes have wrong proportions or the model looks like a tiny toy house;
- stairs run into walls, doors, furniture, or an implausibly narrow hall;
- rooms/furniture are visibly compressed or nonsensical;
- wire/transparent view shows criss-crossing room lines, duplicate boundaries, z-fighting, or obvious overlaps;
- facade opening rhythm differs materially from the sketch;
- material contrast is missing or misleading.

Any one of these resets the current phase to "failed" until fixed or escalated.

---

## Anti-patterns (what the seed-fidelity sprint did wrong)

These are the failure modes you must avoid; they are the observed behaviour from the 2026-05-07 attempt that produced a featureless box instead of a dramatic asymmetric gable house:

- **Skipping phases.** Author all 87 commands at once → can't tell which phase broke fidelity. Don't.
- **No visual verification.** Trusted "tests pass + bundle commits" as success. Tests verify code correctness, not silhouette match. Don't.
- **Ignoring app-identified advisor issues.** The UI may already say `room_target_area_mismatch` for `hf-room-bath` or `stair_comfort_eu_proxy` for `hf-stair-main`. Don't keep refining by eyesight while leaving those named findings open.
- **Counting warnings instead of reading them.** "Only one warning remains" is not success when that one warning is `room_derived_interior_separation_ambiguous` and the wire view is full of bad room boundaries. Read the rule and inspect the affected elements.
- **Using advisor hacks that create worse architecture.** Do not satisfy `room_boundary_open` by flooding the model with room-separation rectangles that produce ambiguous derived rooms and unreadable plans.
- **Eyeballing dimensions** without recording them as assumptions. The "ridge offset 1500 mm" was a guess, not a calibrated measurement. Don't.
- **Declaring "partial" when the silhouette is wrong.** The honest call is "failed; here's the gap". The sprint prompt warned about this exact mistake and I made it anyway. Don't.
- **Building geometry without checking the renderer can faithfully render it.** The asymmetric_gable mesh isn't watertight; the dormer CSG cut silently no-ops. The agent had no way to detect this from inside the engine — only the rendered output reveals it. **Look at the render.**
- **Choosing dimensions where `eaveLeftMm + leftRunMm · tan(slope) < eaveRightMm`.** Produces an inverted "slope" that flattens the gable. Sanity-check before committing the roof.

---

## Tool catalog

### What exists today

**Engine commands** (full list in `app/bim_ai/commands.py`): `createLevel`, `createWall`, `insertDoorOnWall`, `insertWindowOnWall`, `createWallOpening`, `createFloor`, `createRoof`, `createStair`, `createSlabOpening`, `createBalcony`, `createRailing`, `createSweep` (KRN-15), `createDormer` (KRN-14), `setWallRecessZones` (KRN-16), `attachWallTopToRoof`, `createSectionCut`, `upsertSheet`, `upsertSchedule`, `upsertPlanView`, `saveViewpoint`, etc. All are documented in `spec/workpackage-master-tracker.md` (search for KRN-XX detail blocks).

**Bundle dry-run:** `bim-ai apply-bundle --dry-run --in <commands.json>` validates a bundle without committing. **Use this between phases.**

**Render:** start dev with `make dev`; navigate to the 3D tab; activate a viewpoint via the project browser. Or programmatically via the Playwright harness in `packages/web/e2e/`.

**Validators:** `app/bim_ai/constraints.py:evaluate()` runs at every commit; check the returned violation list.

**Advisor surface:** the right rail Advisor panel, `bim-ai advisor --output json`, and the API violation/advisory payload expose issue code, recommendation text, perspective / `codePreset`, and `elementIds`. Feed these findings into SKB-15 refine-loop evidence so corrections can target the elements the app already identified.

**Seed snapshot fixture:** `node scripts/build-seed-snapshot.mjs` materialises the current canonical seed bundle into `packages/web/e2e/__fixtures__/seed-target-house-snapshot.json`. Run it after every bundle edit before visual checkpoints.

**Target-house visual checkpoint:** `pnpm --filter @bim-ai/web exec playwright test e2e/seed-target-house.spec.ts` renders saved target-house viewpoints from the fixture. Inspect the emitted PNGs before declaring progress.

**Material catalog:** `app/bim_ai/material_catalog.py` (Python) and `packages/web/src/viewport/materials.ts` (TS). Every materialKey you author must resolve in both.

### Capability sanity check

Before committing to a sketch feature, prove the full loop supports it:

- Command exists and persists the semantic element (`app/bim_ai/commands.py` + engine dispatch).
- Snapshot/API exposes it to agents.
- Renderer displays it in the checkpoint image.
- Advisor/constraints can report problems against its `elementIds`.
- IFC/glTF/export behavior is either implemented or documented as a deliberate gap.

For example, the target-house roof cutout needs `createRoofOpening` **and** viewport roof-opening subtraction; authoring a semantic `roof_opening` is not enough if the checkpoint render still shows an uncut roof.

### What is planned (SKB work packages)

All listed in `spec/workpackage-master-tracker.md` under "Sketch-to-BIM agent methodology (SKB)". Highest-leverage items, in priority order:

- **SKB-03** `bim-ai checkpoint` — render a viewpoint to PNG + compute SSIM/MSE deltas vs. target. The agent reads the PNG with its own vision and judges silhouette match. (Until this ships, run the dev server and screenshot manually.)
- **SKB-04** `bim-ai calibrate` — pixel-to-mm scale + proportional query API.
- **SKB-05** architectural soundness validator pack.
- **SKB-09** archetype starter library.
- **SKB-10** mandatory per-phase visual gate.
- **SKB-15** the refine loop, formalised.

---

## What you produce

At task end, you produce:

1. **The seed bundle** — code in `packages/cli/lib/one-family-home-commands.mjs` (or a per-project file) that, when applied to an empty model, materialises the house. Authored phase-by-phase as readable JS sections with `// === PHASE N: <name> ===` markers.
2. **The brief** — a structured markdown at `nightshift/<sprint>/brief.md` capturing inputs.
3. **The assumption log** — every judgment call with sketch coordinates.
4. **Per-phase checkpoint screenshots** — saved alongside the brief, named `phase-N-<name>-vp-<id>.png`.
5. **A status doc** — `nightshift/<sprint>-status.md` honestly assessing visual fidelity. If the silhouette does not match the target sketch, the status doc says **failed**, not "partial". Honesty over face-saving.
6. **Unresolved advisor findings** — a short table of any remaining advisory / violation codes, affected `elementIds`, and why they were accepted or escalated.

---

## When you are stuck

If iteration in a phase exceeds 5 cycles without convergence, escalate to the user with:

- The current rendered PNG.
- The target sketch panel.
- The largest visible delta you've identified.
- The 2–3 corrective approaches you've considered and your reasoning.
- A concrete question.

Do not silently accept a wrong silhouette. The seed-fidelity sprint did, and shipped a flat box.

---

## Glossary

- **Phase** — a deliberate authoring pass over the model. 7 phases total (massing → skeleton → envelope → openings → interior → detail → documentation).
- **Checkpoint** — a render-and-compare step at the end of each phase.
- **Refine loop** — within-phase iteration after a failed checkpoint.
- **Brief** — the structured-input distillation of the customer's sketch + verbal description.
- **Assumption log** — every judgment call recorded with sketch coordinates so a human reviewer can audit the agent's reasoning.
- **Silhouette** — the 2D outline of the rendered model from a fixed viewpoint, the primary fidelity metric.
- **Soundness** — the geometric validity of the model: corners meet, floors match enclosures, roofs cover walls, levels stack.
