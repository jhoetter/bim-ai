# Sketch-to-BIM Methodology Tracker

> **Purpose.** Define the project-initiation workflow that turns a user sketch
> plus instruction into high-quality seed BIM data. This is not about `make seed`
> replaying an existing bundle; it is about how the seed data is created,
> validated, refined, and accepted.
>
> **Current maturity:** 8.4 / 10 after the 2026-05-11 methodology tooling pass.
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

| Input                         | Why it helps                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Dimensions or one known scale | Reduces footprint/height guessing and improves visual proportion.                |
| Site orientation              | Makes sun, views, facade labels, and north references meaningful.                |
| Programme                     | Prevents arbitrary room layout and helps schedules.                              |
| Target locale/code package    | Chooses advisor preset, stair comfort proxy, door/window defaults.               |
| Must-have features            | Makes non-negotiables explicit: roof terrace, dormer, loggia, split levels, etc. |
| Forbidden outcomes            | Useful for avoiding repeated failures, e.g. "not a brown pitched roof".          |
| Additional views              | Reduces ambiguity in side/rear/plan conditions.                                  |
| Desired output level          | Massing-only, concept BIM, project-initiation BIM, or documentation-ready.       |

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
- Generated seed data now has a dedicated artifact contract:
  `spec/seed-artifacts.md`. Runtime seed artifacts live under
  `seed-artifacts/<name>/` and are ignored by git by default.
- The workflow now uses the live app, CLI advisor, screenshots, and evidence
  files instead of trusting successful command replay.
- `bim-ai initiation-run` now produces `visual-gate.json` and
  `acceptance-gates.json`, so screenshot quality, target-image deltas, and
  acceptance blockers are machine-readable.
- Required screenshots no longer depend on current UI zoom. If a required view
  lacks a saved viewpoint, the runner synthesizes a deterministic checkpoint
  camera from model bounds.
- The first seed DSL exists (`seed-dsl.v0`) and compiles architectural intent
  into deterministic `cmd-v3.0` bundles.
- A three-case golden preflight suite exists at
  `spec/sketch-to-bim-golden-seeds.json`.
- Advisor warnings are treated as hard evidence.
- The target-house rebuild proved that the process can expose deeper engine
  gaps, such as roof-attached walls that were semantically attached but still
  rendered with incorrect top profiles.
- The skill now forbids known bad shortcuts: universal room-separation
  rectangles, final envelope masses, hidden categories, and metadata-only roof
  openings.
- Regression coverage can be added when the methodology exposes an engine bug.

### Weaknesses

- The DSL is available, but it needs broader architectural primitives before it
  can express every high-fidelity target-house detail without custom low-level
  command authoring inside a seed artifact bundle.
- Visual comparison is pixel/content based. It catches blank or low-information
  screenshots and large target/reference deltas, but it is not yet a semantic
  computer-vision evaluator for "roof cutout present" or "cladding rhythm
  correct".
- Some design-fidelity checks are currently CLI acceptance gates rather than
  native Advisor rules. Backend Advisor expansion for roof-wall seams, stair
  clearances, terrace access, and envelope gaps remains valuable.
- Golden cases currently cover deterministic preflight packets. Live baseline
  goldens with frozen screenshots/advisor JSON should be added for every
  shipped archetype.

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
  "sourceImages": [
    "spec/target-house/target-house-1.png",
    "spec/target-house/target-house-2.png",
    "spec/target-house/floorplan.png"
  ],
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

| Sketch feature        | Required software capability                                                               | Failure if missing                                        |
| --------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Gable-cut wall top    | Wall-to-roof attachment must render a sampled roof profile, not endpoint-only slope.       | Wall remains rectangular or has wrong triangular profile. |
| Embedded roof terrace | Roof opening, terrace floor, return faces, guard, access door, saved high/checkpoint view. | Roof void exists only as metadata or reads as a skylight. |
| Folded white wrapper  | Solid walls/roof/fascia/sweeps with visible thickness.                                     | Generic roof-on-box or ghost mass.                        |
| Recessed loggia       | Recessed facade plane, side returns, front rail, bay rhythm, glazing.                      | Flat balcony stuck on facade.                             |
| Vertical cladding     | Material plus renderer-supported board rhythm, or documented tolerance.                    | Detached batten artifacts or flat wrong material.         |
| Usable rooms          | Real walls/partitions, doors, room outlines, stair clearance.                              | Advisor clean but unbuildable interior.                   |

If a feature has no reliable command/render path, the run must stop and create a
capability-gap task instead of faking the feature.

### Authoring Surface

The durable source for a generated seed is a named artifact set, documented in
`spec/seed-artifacts.md`. The ideal authoring path is a typed seed DSL that
compiles to the artifact's `bundle.json` while preserving intent:

```ts
house()
  .levels({ ground: 0, upper: 3000 })
  .volume('groundBase', { material: 'cladding_warm_wood', footprint })
  .wrapperShell('upperWhiteShell', { roof: 'asymmetric_gable', terraceCutout })
  .facade('front')
  .recessedLoggia({ bays, rail })
  .rooms(programme)
  .viewpoints(requiredViews)
  .compile();
```

The DSL should not hide generated commands; it should make architectural intent
reviewable and generate deterministic command bundles.

### Artifact Set

Every completed seed generation run must package the result as:

```text
seed-artifacts/<name>/
  manifest.json
  bundle.json
  source/
  evidence/
```

Use `scripts/create-seed-artifact.mjs` to package any user source folder and the
generated bundle. Do not place generated seed output in `nightshift`,
`packages/cli/lib`, or E2E fixture folders. `nightshift` is temporary working
evidence; the artifact set is the loadable handoff.

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

| Dimension         | Weight | 0                         | 5                                      | 10                                           |
| ----------------- | -----: | ------------------------- | -------------------------------------- | -------------------------------------------- |
| Visual fidelity   |    30% | Generic building          | Major features present, visible gaps   | Reads as the sketch from required views      |
| BIM soundness     |    25% | Blocking advisor findings | Warnings resolved, some tolerated info | Zero blocking warnings, clean topology       |
| Usability         |    20% | Decorative shell only     | Rooms/stairs exist but awkward         | Plausible project-start model                |
| Reproducibility   |    15% | Manual UI state           | Bundle replay works                    | Source, snapshot, evidence all deterministic |
| Method discipline |    10% | One-shot generation       | Some loop evidence                     | Full phase ledger and defect closure         |

Current committed seed artifact inventory: **empty by design**. Current
methodology/tooling: **8.7 / 10**.

Reason:

- generated target-house evidence and hard-coded source bundles were removed
  from the repository;
- `make seed` now loads isolated named artifact sets rather than one canonical
  baked house;
- tooling now has IR preflight, capability gaps, visual gates, acceptance gates,
  quality modes, a seed DSL, golden preflight cases, and the clean artifact
  contract in `spec/seed-artifacts.md`;
- the next maturity step is to generate several real artifact sets and add live
  screenshot/advisor baselines for them without committing ad hoc evidence.

---

## 7. Implementation Tracker

| ID     | Status | Item                                       | Acceptance criteria                                                                                                                                                                                                                      |
| ------ | ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SBM-01 | done   | Skill operating contract                   | `claude-skills/sketch-to-bim/SKILL.md` requires live app, advisor, screenshots, visual gates, acceptance gates, and tolerance table.                                                                                                     |
| SBM-02 | done   | Formal Sketch Understanding IR schema      | `spec/schemas/sketch-understanding-ir.schema.json` exists for visual read, dimensions, features, programme, assumptions, and required views.                                                                                             |
| SBM-03 | done   | Capability matrix registry                 | `spec/sketch-to-bim-capability-matrix.json` maps target-house and broader residential features to commands, renderer support, advisor checks, evidence, and known failure modes.                                                         |
| SBM-04 | done   | Seed authoring DSL                         | `seed-dsl.v0` compiles levels, types, volumes, roofs/openings, rooms, viewpoints, and raw commands to deterministic `cmd-v3.0` bundles.                                                                                                  |
| SBM-05 | done   | Evidence runner CLI                        | `bim-ai initiation-run` can run a seed command or apply bundle, then capture snapshot, validate, evidence-package, advisor warning/info, screenshots, screenshot manifest, visual checklist, and status packet.                          |
| SBM-06 | done   | Visual defect checklist artifact           | `visual-checklist.json` is generated from required views and critical features, populated with screenshot paths, and updated from `visual-gate.json` pass/fail/needs-review scoring.                                                     |
| SBM-07 | done   | Render-and-compare gate                    | `bim-ai initiation-compare` and `initiation-run --target-image/--target-map` compare checkpoint screenshots against target/reference PNGs with scored deltas.                                                                            |
| SBM-08 | done   | Advisor expansion for visual/BIM usability | CLI acceptance gates block coverage errors, advisor warnings in strict modes, final mass placeholders, missing screenshots, and visual-gate failures; backend Advisor can still be deepened with more semantic seam/clearance/gap rules. |
| SBM-09 | done   | Plan/camera diagnostic fit                 | Initiation screenshots synthesize deterministic saved viewpoints from model bounds when a required view is missing, including plan/diagnostic/top-style views.                                                                           |
| SBM-10 | done   | Golden seed regression suite               | `bim-ai initiation-golden` runs three preflight golden cases with IR, capability matrix, optional DSL bundle, and scored packets; live screenshot/advisor baselines are the next-depth expansion per archetype.                          |
| SBM-11 | done   | Capability-gap escalation                  | `capability-gaps.json` is generated when critical features are blocked by missing/gap capabilities or missing required views; the status packet forbids fake decorative fallback geometry.                                               |
| SBM-12 | done   | User-facing initiation modes               | `bim-ai initiation-modes` exposes `massing_only`, `concept_bim`, `project_initiation_bim`, and `documentation_ready`; `initiation-check/run --mode` enforces the selected mode.                                                          |

---

## 8. Immediate Engineering Priorities

### P0: Stop False Success

Implemented v1 gates that flag advisor-clean but visually wrong or incomplete
models:

- final envelope cannot contain visible conceptual masses;
- advisor warnings can fail strict initiation modes;
- required features must have screenshot proof;
- `visual-gate.json` scores screenshot content and target/reference deltas;
- `acceptance-gates.json` lists blockers explicitly.

### P1: Make The Workflow Reproducible

Build out `bim-ai initiation-run`:

```text
bim-ai initiation-run \
  --ir spec/examples/sketch-understanding-ir.example.json \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --model <id> \
  --seed-command "make seed name=<seed-name>" \
  --out nightshift/<run>
```

It produces:

- copied `sketch-ir.json`;
- `capability-coverage.json`;
- `visual-checklist.json`;
- `status.md`;
- `acceptance-gates.json`;
- advisor warning/info JSON;
- screenshot PNGs;
- `visual-gate.json`;
- model stats;
- screenshot manifest;
- validate and evidence-package JSON;
- screenshot-populated checklist results.

Strict final acceptance example:

```text
bim-ai initiation-run \
  --ir spec/examples/sketch-understanding-ir.example.json \
  --capabilities spec/sketch-to-bim-capability-matrix.json \
  --model <id> \
  --target-image nightshift/<run>/target-reference.png \
  --fail-on-warning \
  --fail-on-visual \
  --fail-on-acceptance \
  --out nightshift/<run>
```

### P2: Replace Hand Coordinate Bundles

Implemented v0 with `seed-dsl.v0` and
`bim-ai seed-dsl compile --recipe <path> --out <path>`. It currently supports:

- levels and datum setup;
- base volume and upper volume;
- gable/hip/flat roof forms;
- roof terrace / balcony cutout;
- room programme layout;
- saved views and evidence.

Next depth: add first-class loggia, folded-shell fascia, facade rhythm, stair,
opening, cladding, and documentation primitives so custom JS is needed less
often.

### P3: Add Visual Diff Assistance

Implemented v1 through PNG analysis/comparison. The agent still has to judge
images semantically, but the software now helps with:

- edge/silhouette extraction for target and screenshot;
- bounding-box/proportion comparison;
- report deltas as structured text for the agent.

Next depth: semantic feature presence checks for openings, cutouts, railings,
and cladding zones.

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

As of 2026-05-11, the methodology tooling satisfies this definition at v1
preflight/evidence-runner level. Remaining maturity work is not another prose
process; it is deeper semantic enforcement: native Advisor rules for detailed
geometry faults and live golden baselines with frozen screenshots/advisor JSON.
