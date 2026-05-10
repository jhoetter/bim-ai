# Sketch-to-BIM Methodology Tracker

> **Purpose.** Define the project-initiation workflow that turns a user sketch
> plus instruction into high-quality seed BIM data. This is not about `make seed`
> replaying an existing bundle; it is about how the seed data is created,
> validated, refined, and accepted.
>
> **Current maturity:** 6.5 / 10 after the 2026-05-10 target-house rebuild.
> **Target maturity:** 9 / 10: an external AI architect can start from a sketch,
> converge through live app feedback, and hand off an advisor-clean,
> visually-faithful, usable BIM model with evidence.
>
> **Operational skill:** `claude-skills/sketch-to-bim/SKILL.md`.

---

## 1. User Input Contract

### Minimum Input

Yes: the ideal minimum input should still be **a sketch/image plus one short
instruction**.

Example:

```text
Create a BIM seed model from this sketch. It should be a modern two-storey
single-family house and should be usable as the project starting point.
```

That must be enough for the system to start. The AI architect must then extract
the visual brief, make explicit assumptions, and use the live software feedback
loop to refine the model.

### Optional Inputs That Improve Quality

The user may provide any of these, but they are not required:

| Input | Why it helps |
| --- | --- |
| Dimensions or one known scale | Reduces footprint/height guessing and improves visual proportion. |
| Site orientation | Makes sun, views, facade labels, and north references meaningful. |
| Programme | Prevents arbitrary room layout and helps schedules. |
| Target locale/code package | Chooses advisor preset, stair comfort proxy, door/window defaults. |
| Must-have features | Makes non-negotiables explicit: roof terrace, dormer, loggia, split levels, etc. |
| Forbidden outcomes | Useful for avoiding repeated failures, e.g. "not a brown pitched roof". |
| Additional views | Reduces ambiguity in side/rear/plan conditions. |
| Desired output level | Massing-only, concept BIM, project-initiation BIM, or documentation-ready. |

### Agent Behavior When Inputs Are Missing

The agent should not stop just because the user gave only a sketch. It should:

- infer a structured brief from the image;
- record assumptions with confidence;
- choose conservative residential defaults;
- ask follow-up questions only when an assumption would materially change the
  design or block a buildable model;
- validate every major assumption through rendered views and advisor output.

---

## 2. Current Strengths And Weaknesses

### Strengths

- The seed source is deterministic and reviewable as a command bundle.
- The workflow now uses the live app, CLI advisor, screenshots, and evidence
  files instead of trusting successful command replay.
- Advisor warnings are treated as hard evidence.
- The target-house rebuild proved that the process can expose deeper engine
  gaps, such as roof-attached walls that were semantically attached but still
  rendered with incorrect top profiles.
- The skill now forbids known bad shortcuts: universal room-separation
  rectangles, final envelope masses, hidden categories, and metadata-only roof
  openings.
- Regression coverage can be added when the methodology exposes an engine bug.

### Weaknesses

- The authoring source is still a large hand-coordinate JS bundle, which is
  brittle and hard to review architecturally.
- The user brief is mostly prose; it is not yet compiled into a formal,
  machine-checkable intermediate representation.
- Visual acceptance still depends too much on the agent noticing problems by
  eye. Playwright proves that views render, not that the model matches the
  sketch.
- The Advisor catches BIM consistency issues but not all design-fidelity issues
  such as weak silhouette, roof seams, generic wall tops, missing cladding
  rhythm, or awkward proportions.
- There is no formal capability matrix that says which sketch features are
  supported by which BIM commands, renderer paths, and advisor rules.
- There is no single command that runs the full project-initiation evidence
  loop: apply/reseed, advisor warnings, advisor info, screenshots, visual
  checklist, and evidence packet.

---

## 3. Target Architecture

The workflow should become a **project-initiation compiler loop**:

```text
user sketch + instruction
  -> visual source-of-truth read
  -> Sketch Understanding IR
  -> capability matrix / gap check
  -> phased BIM authoring plan
  -> deterministic command bundle / seed source
  -> live app + advisor + screenshots
  -> visual defect ledger
  -> refined command bundle
  -> acceptance packet
```

### Source Inputs

Inputs are user-owned evidence:

- images, sketches, renders, photos, PDFs;
- user instruction;
- optional dimensions, programme, site constraints, and locale;
- previous advisor findings or screenshots from the user.

### Sketch Understanding IR

Every run should produce a structured intermediate representation before BIM
commands are authored.

Example artifact: `spec/examples/sketch-understanding-ir.example.json`.

```json
{
  "projectType": "single_family_house",
  "qualityTarget": "project_initiation_bim",
  "sourceImages": ["spec/target-house.jpeg"],
  "visualRead": {
    "primaryView": "front-left axonometric",
    "dominantVolumes": [
      "smooth white upper wrapper shell",
      "smaller vertically-clad ground-floor base"
    ],
    "nonNegotiables": [
      "embedded roof terrace cut into right roof plane",
      "deep recessed upper front loggia",
      "ground floor vertical cladding",
      "white folded roof/wall shell"
    ]
  },
  "programme": [
    { "name": "Entrance / stair hall", "level": "ground", "requiredDoor": true },
    { "name": "Living / dining", "level": "ground" },
    { "name": "Kitchen", "level": "ground" },
    { "name": "Bedrooms", "level": "upper" }
  ],
  "dimensions": {
    "confidence": "estimated",
    "floorToFloorMm": 3000,
    "overallDepthMm": 8200
  },
  "features": [
    {
      "id": "roof_terrace_cutout",
      "kind": "roof_opening_with_occupied_terrace",
      "visualPriority": "critical",
      "mustRenderInViews": ["main", "roof_high", "side"]
    }
  ],
  "assumptions": [
    {
      "id": "scale_001",
      "statement": "Overall depth inferred as roughly 8.2 m from image proportions.",
      "confidence": "medium"
    }
  ]
}
```

### Capability Matrix

Before authoring, every critical feature must be mapped to available software
capabilities.

| Sketch feature | Required software capability | Failure if missing |
| --- | --- | --- |
| Gable-cut wall top | Wall-to-roof attachment must render a sampled roof profile, not endpoint-only slope. | Wall remains rectangular or has wrong triangular profile. |
| Embedded roof terrace | Roof opening, terrace floor, return faces, guard, access door, saved high/checkpoint view. | Roof void exists only as metadata or reads as a skylight. |
| Folded white wrapper | Solid walls/roof/fascia/sweeps with visible thickness. | Generic roof-on-box or ghost mass. |
| Recessed loggia | Recessed facade plane, side returns, front rail, bay rhythm, glazing. | Flat balcony stuck on facade. |
| Vertical cladding | Material plus renderer-supported board rhythm, or documented tolerance. | Detached batten artifacts or flat wrong material. |
| Usable rooms | Real walls/partitions, doors, room outlines, stair clearance. | Advisor clean but unbuildable interior. |

If a feature has no reliable command/render path, the run must stop and create a
capability-gap task instead of faking the feature.

### Authoring Surface

The current source is a low-level command bundle. Target state is a typed seed
DSL that compiles to commands while preserving intent:

```ts
house()
  .levels({ ground: 0, upper: 3000 })
  .volume('groundBase', { material: 'cladding_warm_wood', footprint })
  .wrapperShell('upperWhiteShell', { roof: 'asymmetric_gable', terraceCutout })
  .facade('front').recessedLoggia({ bays, rail })
  .rooms(programme)
  .viewpoints(requiredViews)
  .compile()
```

The DSL should not hide generated commands; it should make architectural intent
reviewable and generate deterministic command bundles.

---

## 4. Required Workflow

### Phase 0: Intake And Visual Read

Deliverables:

- `visual-readout.md`
- `sketch-ir.json` or equivalent Markdown until JSON schema exists
- `assumptions.md`
- list of non-negotiable visual features

Gate:

- The visual read must describe what is in the image, not what the agent expects
  a house to be.
- The image wins over prose when they conflict.

### Phase 1: Capability Plan

Deliverables:

- feature-to-capability table;
- list of supported features;
- list of capability gaps;
- explicit fallback or escalation for each gap.

Gate:

- No critical visual feature may proceed without a known command/render/advisor
  route.

### Phase 2: Massing / Envelope First

Deliverables:

- levels, base point, primary volumes, floors/walls/roof;
- no detail used to disguise wrong silhouette.

Gate:

- Main and side screenshots must read as the target silhouette.
- Conceptual `mass` elements may be used only as temporary study geometry, not
  as final envelope elements.

### Phase 3: Feature Geometry

Deliverables:

- roof cutouts, loggias, dormers, balconies, special wall/roof intersections,
  facade bay rhythm.

Gate:

- Every semantic feature must be visibly present in at least one required view.
- A command that does not render as intended is considered unsupported until
  fixed.

### Phase 4: Interior Usability

Deliverables:

- room outlines, real partitions, doors/access, stairs, slab openings, basic
  assets.

Gate:

- Zero blocking advisor warnings.
- No stair into wall, inaccessible room, ambiguous room separation, or cramped
  toy layout.

### Phase 5: Documentation And Evidence

Deliverables:

- saved viewpoints;
- plans/sheets/schedules where relevant;
- advisor warning/info JSON;
- screenshot set;
- status packet;
- unresolved tolerance table.

Gate:

- The final handoff must be reproducible from source, advisor-clean at warning
  level, and visually reviewed from all required views.

---

## 5. Acceptance Gates

### Advisor Gate

`warning` and `error` findings block acceptance unless the user explicitly
accepts a tolerance. Known blockers:

- `room_boundary_open`
- `room_unenclosed`
- `room_derived_interior_separation_ambiguous`
- `room_no_door` for occupied/interior rooms
- `room_target_area_mismatch` when targets came from the brief
- stair comfort / stair-shaft mismatch
- roof/opening/host warnings tied to visible sketch features
- floor/wall overlap and major intersection warnings
- sheet/schedule unresolved references in documentation phase

### Visual Gate

The model fails even if Advisor is clean when any of these are true:

- roof reads as a generic roof rather than the sketch-specific roof;
- roof cutout, balcony, dormer, courtyard, or loggia exists semantically but not
  visually;
- roof-attached walls remain rectangular where the sketch shows gable/sloped
  wall tops;
- conceptual mass boxes remain as translucent finished envelope geometry;
- visible gaps, z-fighting, or roof/wall seams dominate the main views;
- upper/lower proportions make the model read as a tiny toy house;
- facade bay rhythm materially differs from the sketch;
- stair, furniture, or room layout is visibly nonsensical;
- cladding/railing/detail geometry creates false artifacts.

### Usability Gate

The seed must be useful after handoff:

- model has meaningful levels, rooms, schedules/views as appropriate;
- rooms are accessible and named;
- stairs connect levels and have plausible dimensions;
- visible assets support the programme without distorting the shell;
- sheets/schedules do not contain obvious unresolved references.

### Evidence Gate

The run must leave evidence:

- input references;
- structured brief / IR;
- assumptions;
- advisor warning JSON;
- advisor info JSON;
- checkpoint screenshots;
- status/tolerance document;
- command source pointer and model id.

---

## 6. Scoring Rubric

Use this score after each project-initiation run.

| Dimension | Weight | 0 | 5 | 10 |
| --- | ---: | --- | --- | --- |
| Visual fidelity | 30% | Generic building | Major features present, visible gaps | Reads as the sketch from required views |
| BIM soundness | 25% | Blocking advisor findings | Warnings resolved, some tolerated info | Zero blocking warnings, clean topology |
| Usability | 20% | Decorative shell only | Rooms/stairs exist but awkward | Plausible project-start model |
| Reproducibility | 15% | Manual UI state | Bundle replay works | Source, snapshot, evidence all deterministic |
| Method discipline | 10% | One-shot generation | Some loop evidence | Full phase ledger and defect closure |

Current target-house run: **6.5 / 10**.

Reason:

- strong improvement in advisor use, roof cutout, gable-wall rendering, and
  evidence;
- still weak on seam closure, material/detail fidelity, and automated visual
  defect detection.

---

## 7. Implementation Tracker

| ID | Status | Item | Acceptance criteria |
| --- | --- | --- | --- |
| SBM-01 | partial | Skill operating contract | `claude-skills/sketch-to-bim/SKILL.md` requires live app, advisor, screenshots, and tolerance table. |
| SBM-02 | done | Formal Sketch Understanding IR schema | `spec/schemas/sketch-understanding-ir.schema.json` exists for visual read, dimensions, features, programme, assumptions, and required views. |
| SBM-03 | partial | Capability matrix registry | `spec/sketch-to-bim-capability-matrix.json` maps target-house critical features to commands, renderer support, advisor checks, evidence, and known failure modes; needs broader feature catalog coverage. |
| SBM-04 | open | Seed authoring DSL | High-level architectural DSL compiles to deterministic command bundles and preserves intent. |
| SBM-05 | done | Evidence runner CLI | `bim-ai initiation-run` can run a seed command or apply bundle, then capture snapshot, validate, evidence-package, advisor warning/info, screenshots, screenshot manifest, visual checklist, and status packet. |
| SBM-06 | partial | Visual defect checklist artifact | `visual-checklist.json` is generated from required views and critical features and populated with screenshot paths by `initiation-run`; still needs automated pass/fail defect scoring. |
| SBM-07 | open | Render-and-compare gate | CLI/tool compares target/reference images against checkpoint screenshots with human-readable deltas. |
| SBM-08 | open | Advisor expansion for visual/BIM usability | Add rules for roof-wall seams, mass placeholders in final models, stair clearance, unresolved terrace access, and envelope gaps. |
| SBM-09 | open | Plan/camera diagnostic fit | Plan diagnostic screenshots auto-fit full floor and upper/roof levels instead of relying on current zoom. |
| SBM-10 | open | Golden seed regression suite | Seed examples carry source image, IR, bundle, advisor JSON, screenshots, and scored acceptance packets. |
| SBM-11 | open | Capability-gap escalation | If a critical feature cannot render faithfully, the workflow creates a tracked engine/render task instead of faking geometry. |
| SBM-12 | open | User-facing initiation modes | User can choose massing-only, concept BIM, project-initiation BIM, or documentation-ready quality. |

---

## 8. Immediate Engineering Priorities

### P0: Stop False Success

Add gates that fail advisor-clean but visually wrong models:

- final envelope cannot contain visible conceptual masses;
- roof-attached walls must be sampled against roof profile where applicable;
- required features must have screenshot proof;
- status packet must list visible defects explicitly.

### P1: Make The Workflow Reproducible

Build out `bim-ai initiation-run`:

```text
bim-ai initiation-run \
  --ir spec/examples/sketch-understanding-ir.example.json \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --model <id> \
  --seed-command "make seed" \
  --out nightshift/<run>
```

It currently produces:

- copied `sketch-ir.json`;
- `capability-coverage.json`;
- `visual-checklist.json`;
- `status.md`;
- advisor warning/info JSON;
- screenshot PNGs;
- model stats;
- screenshot manifest;
- validate and evidence-package JSON;
- screenshot-populated checklist results.

Remaining gap:

- automated visual pass/fail scoring still depends on the agent's screenshot
  review or future visual-diff support.

### P2: Replace Hand Coordinate Bundles

Create a typed seed DSL or generator layer for common residential patterns:

- levels and datum setup;
- base volume and upper volume;
- gable/hip/flat roof forms;
- loggia/recessed facade;
- roof terrace / balcony cutout;
- room programme layout;
- saved views and evidence.

### P3: Add Visual Diff Assistance

The agent still has to judge images, but the software can help:

- edge/silhouette extraction for target and screenshot;
- bounding-box/proportion comparison;
- feature presence checks for openings, cutouts, railings, and cladding zones;
- report deltas as structured text for the agent.

---

## 9. Rules For Future Agents

1. A sketch plus instruction is sufficient input; do not demand a full spec.
2. The first artifact is a visual read, not a command bundle.
3. The second artifact is a capability plan, not geometry.
4. Do not advance phases with unresolved visual or advisor blockers.
5. Do not use final `mass` placeholders for finished architecture.
6. Do not use room-separation rectangles as a room-closure hack.
7. Do not count a command as successful until the feature renders.
8. Commit only after the evidence packet can honestly say what passes and what
   remains weak.

---

## 10. Definition Of Done For This Methodology

This methodology is `done` when:

- a user can provide one sketch plus one instruction;
- the agent generates a structured IR and assumption log;
- critical features are checked against a capability matrix;
- the model is authored through phases;
- live app + advisor + screenshots are used in every material loop;
- visual defects are structured, not buried in prose;
- no blocking advisor findings remain;
- the evidence packet is reproducible;
- at least three golden seed examples pass the same workflow.
