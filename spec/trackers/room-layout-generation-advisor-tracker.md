# Room Layout Generation Advisor Tracker

Last updated: 2026-05-19

Purpose: define how BIM AI can generate high-quality room layouts for new
buildings by combining a dedicated layout generation engine with the existing AI
Advisor, constraint evaluation, room derivation, and BIM command pipeline.

This tracker was created after researching Finch3D's public product material,
docs, and patent/application language. The useful lesson is not a specific
proprietary algorithm. The useful lesson is the architecture: encode
architecture as a graph, separate hard constraints from preferences, generate
many candidate layouts, score them transparently, and let the user or Advisor
iterate.

## Product Thesis

Room layout generation should not be implemented as one large language-model
prompt that directly draws the final floor plan. The Advisor should interpret
intent, orchestrate tools, explain trade-offs, and critique results. A dedicated
deterministic/optimization engine should own geometry generation, constraints,
candidate scoring, and BIM-safe commits.

Target workflow:

```text
user brief
-> Advisor extracts a spatial program and assumptions
-> layout engine generates candidate room/corridor/core variants
-> constraint and constructability evaluators reject invalid variants
-> scoring ranks viable variants by trade-off profile
-> Advisor explains the options and asks for targeted decisions
-> selected variant commits as native BIM elements
```

The goal is not just to create plausible-looking rooms. The goal is to produce
room layouts that are usable, inspectable, editable, and traceably grounded in
building rules, spatial program, and BIM model constraints.

## Scope

This tracker covers:

- new-building room layout generation from a site/building envelope or floor
  plate;
- spatial program extraction from natural-language briefs;
- room, corridor, stair/core, door, window, and service-zone layout candidates;
- graph-based room relationship modeling;
- deterministic hard constraints and weighted scoring;
- Advisor orchestration, explanation, and variant comparison;
- adaptive plan-library concepts using prior layouts as reusable patterns;
- native BIM commit through existing command/transaction infrastructure.

This tracker does not cover:

- reconstructing or correcting an existing floor plan from an image or CAD file;
- final code-compliant permit drawings without architect review;
- full national building-code liability;
- structural, MEP, energy, and cost optimization as complete specialist engines;
- copying Finch3D internals or relying on non-public proprietary behavior.

## Finch-Inspired Lessons

Public Finch3D material points to a hybrid system:

- architectural objects and relationships represented as graph nodes and edges;
- hard constraints applied before scoring;
- iterative candidate generation;
- user-adjustable weights for trade-offs such as unit size, ratios, daylight,
  circulation, and grid fit;
- adaptive reuse of plan libraries;
- continuous compliance feedback while the user edits.

For BIM AI, these ideas translate into a transparent system we can own:

```text
ProgramGraph + Envelope + Constraints
-> CandidateGenerator
-> Validator
-> Scorer
-> VariantSet
-> AdvisorExplanation
-> BIMCommandBundle
```

## Current Platform Baseline

The repo already has useful foundations:

- `RoomElem` supports room outline, `programmeCode`, `department`,
  `functionLabel`, `finishSet`, `targetAreaM2`, zones, and service
  requirements.
- `constraints_evaluation.py` already emits room advisories for degenerate
  outlines, unenclosed boundaries, missing room metadata, target-area mismatch,
  and room access heuristics.
- `constructability_advisories.py` already contains room-door access and
  room-egress graph checks.
- `room_derivation.py` can derive authoritative axis-aligned room candidates
  from walls and room-separation lines.
- `packages/web/src/plan/roomGraph.ts` sketches a client-side room graph and
  egress path model.
- The Advisor UI/CLI already consumes deterministic `Violation` payloads and
  can group, explain, filter, and quick-fix issues.
- The command/transaction system can apply BIM-safe changes and re-run
  validation.

The missing piece is the generative planning engine that can create, search,
rank, and commit candidate layouts rather than only validate existing geometry.

## Core Concepts

### Spatial Program

A normalized brief describing what should exist on a floor or building:

- room types and counts;
- target, minimum, and maximum areas;
- minimum widths and acceptable aspect ratios;
- required adjacency and separation rules;
- daylight/facade requirements;
- public/private zoning;
- wet-room/service clustering requirements;
- circulation strategy;
- accessibility/clearance requirements;
- repeated-module or unit-mix targets;
- optional style or firm-standard references.

The Advisor may derive this from natural language, but the saved program must be
structured and deterministic.

### Program Graph

The graph representation of the spatial program:

- nodes: rooms, corridors, cores, stairs, lifts, shafts, exterior access points,
  windows/facades, service zones;
- edges: adjacency, access, separation, visibility, wet-service relationship,
  daylight relationship, egress relationship, stacking relationship;
- node attributes: target area, min/max size, room type, priority, department,
  required facade access, service needs;
- edge attributes: required, preferred, prohibited, weighted, or explanatory.

The program graph should become the durable bridge between Advisor language and
layout-engine geometry.

### Hard Constraints

Hard constraints invalidate candidates before preference scoring:

- all rooms enclosed and non-overlapping;
- rooms meet minimum area and width;
- doors connect occupiable rooms to circulation or adjacent rooms;
- egress path exists to exit/core;
- corridors meet minimum width;
- wet rooms can connect to service zones or shafts;
- daylight-required rooms touch allowable facade/window bands;
- openings fit host walls;
- accessibility clearances are respected for configured profiles;
- structural/grid constraints are respected when supplied.

Hard constraints should return reasons, not just booleans. Rejection reasons are
Advisor explanation material.

### Soft Scores

Soft scores rank viable candidates:

- target-area fit;
- adjacency graph satisfaction;
- facade/daylight quality;
- corridor efficiency / net-to-gross;
- compactness and aspect-ratio quality;
- privacy gradient;
- room repetition and modularity;
- wet-core compactness;
- door/window placement quality;
- construction simplicity;
- future MEP/structural friendliness;
- user preference weights.

Each score should be independently visible so a user can understand why one
layout won.

### Candidate Generator

Candidate generation should start with deterministic grammar and search, not an
LLM-only process:

- rectangular subdivision and slicing-tree layouts;
- corridor-spine layouts;
- core-and-ring layouts;
- facade-first placement for daylight-critical rooms;
- wet-core/service-zone clustering;
- repeated module and unit mix generation;
- local mutation of wall positions, room swaps, corridor shifts, and door
  placements;
- optional retrieval/adaptation from a plan library.

The engine should support thousands of cheap candidate attempts, but only commit
selected variants as native model elements.

### Advisor Role

The Advisor should:

- convert user intent into a structured program;
- surface assumptions before generation;
- choose or recommend generation profiles;
- request candidate generation;
- summarize rejected candidates and top trade-offs;
- explain score differences in architectural language;
- suggest targeted edits, such as "increase corridor weight" or "allow bedroom
  2 to lose 0.8 m2";
- commit the selected variant through command bundles;
- keep all generated decisions auditable.

The Advisor should not be the source of geometric truth.

## Proposed Architecture

```text
app/bim_ai/layout_generation/
  program.py          structured program schema and normalization
  graph.py            ProgramGraph construction and validation
  envelope.py         floor plate / facade / grid / core inputs
  candidates.py       generation grammars and candidate model
  constraints.py      hard constraint evaluation for candidate layouts
  scoring.py          weighted scoring and score explanations
  search.py           beam search / local mutation / solver orchestration
  adapt.py            optional plan-library retrieval and stretch/adaptation
  commit.py           candidate -> BIM command bundle
  advisor.py          Advisor-facing orchestration payloads
```

Client-side surfaces should remain thin:

- show program graph and candidate variants;
- expose weights and profile presets;
- display score breakdown and rejection reasons;
- let users compare and commit variants;
- reuse Advisor panel conventions for findings and quick fixes.

## Recommended Algorithm Strategy

Start with a hybrid search approach:

1. Generate initial candidates using layout grammars.
2. Reject impossible candidates through hard constraints.
3. Score viable candidates.
4. Keep the best `N` candidates in a beam.
5. Mutate candidates through wall moves, room swaps, room splits, corridor shifts,
   and door/window changes.
6. Revalidate and rescore until budget is exhausted.
7. Return top variants plus rejection/score telemetry.

Do not start with a genetic algorithm as the primary engine. Evolutionary search
can be added later, but architectural layout has many crisp constraints that are
better handled by constructive heuristics, CP-SAT/MILP-style subproblems, and
local search.

Potential solver layers:

- deterministic geometry heuristics for the first version;
- OR-Tools CP-SAT for discrete assignment and adjacency decisions;
- linear programming or Cassowary-style constraints for wall stretching and
  dimension adaptation;
- simulated annealing or beam search for local improvements;
- ML ranking later, after enough labeled variants exist.

## Data Strategy

### Phase 1: Rules First

Use manually encoded architectural rules and scoring. This creates reliable
fixtures, deterministic tests, and explainable behavior.

### Phase 2: Plan Library

Ingest good historical layouts and extract:

- room graph;
- room type sequence;
- normalized areas and aspect ratios;
- adjacency matrix;
- facade relationships;
- door/window placement patterns;
- wet-core/service topology;
- reusable module tags.

For new envelopes, retrieve similar plans, stretch/adapt them, and score the fit.
This is the most practical way to get firm-specific "design intelligence"
without hallucinating geometry.

### Phase 3: Learned Ranking

Use accepted/rejected variants to train a ranking model. The model should only
rank or suggest mutations at first. It should not bypass hard constraints.

## Work Packages

| ID | Work Package | Description | Status |
| -- | ------------ | ----------- | ------ |
| RLG-001 | Spatial program schema | Add a versioned schema for room requirements, adjacency rules, daylight needs, service requirements, and weights. | Planned |
| RLG-002 | Program graph | Build a deterministic graph representation from the spatial program and existing BIM context. | Planned |
| RLG-003 | Envelope model | Normalize floor plate, facade bands, grid lines, fixed cores, and allowed generation zones. | Planned |
| RLG-004 | Candidate model | Define an in-memory candidate layout separate from committed BIM elements. | Planned |
| RLG-005 | Hard constraint engine | Validate candidates for enclosure, overlap, access, egress, min dimensions, facade/daylight, and corridor/core rules. | Planned |
| RLG-006 | Scoring engine | Implement weighted score breakdown with explainable per-metric output. | Planned |
| RLG-007 | First generator grammar | Implement rectangular/slicing-tree room subdivision for simple orthogonal envelopes. | Planned |
| RLG-008 | Corridor-spine generator | Generate corridor plus room bands for apartment, office, and school-like layouts. | Planned |
| RLG-009 | Door/window placement | Place openings according to room adjacency, corridor access, and facade/daylight needs. | Planned |
| RLG-010 | Search loop | Add beam search/local mutation with iteration budgets and deterministic seeds. | Planned |
| RLG-011 | Candidate to BIM commit | Convert selected candidates to walls, room separators, rooms, doors, windows, and metadata using command bundles. | Planned |
| RLG-012 | Advisor orchestration | Add Advisor-facing request/result payloads and explanations. | Planned |
| RLG-013 | Variant comparison UI | Show top variants, score breakdown, rejection reasons, and weight controls. | Planned |
| RLG-014 | Plan library extraction | Extract reusable program graphs and geometry patterns from accepted layouts. | Planned |
| RLG-015 | Plan adaptation | Retrieve and adapt prior plans to new envelopes with constraint-safe stretching. | Planned |
| RLG-016 | Learned ranking | Train or tune a ranking layer from accepted/rejected variants after enough data exists. | Planned |

## Milestones

### Milestone 0: Spec and Test Fixtures

Goal: make the problem concrete before building UI.

Deliverables:

- structured program examples for house, small office, apartment unit, and
  simple multifamily floor;
- expected graph snapshots;
- scoring examples;
- rejection examples;
- golden SVG/JSON fixtures for generated candidates.

Acceptance:

- fixture programs validate deterministically;
- graph and score outputs are stable across runs;
- no BIM commits yet.

### Milestone 1: Single-Floor Orthogonal MVP

Goal: generate valid room layouts inside a rectangular or L-shaped floor plate.

Capabilities:

- room targets and min/max areas;
- required/preferred adjacency;
- basic corridor optionality;
- room enclosure and overlap checks;
- target-area scoring;
- adjacency scoring;
- commit selected candidate to native rooms/walls/doors.

Acceptance:

- at least three distinct candidates for a simple brief;
- invalid candidates expose rejection reasons;
- selected candidate passes existing Advisor checks or returns known residual
  advisories;
- committed elements remain editable in the normal plan tools.

### Milestone 2: Daylight, Circulation, and Egress

Goal: produce layouts that respect practical building logic, not just areas.

Capabilities:

- facade/daylight requirement scoring;
- door placement;
- egress path checks;
- corridor width constraints;
- fixed core or generated core input;
- net-to-gross and circulation efficiency scoring.

Acceptance:

- top candidates can explain daylight and circulation trade-offs;
- rooms requiring daylight are placed on valid facade bands when possible;
- egress warnings are eliminated for supported profiles.

### Milestone 3: Adaptive Plan Library

Goal: reuse known-good layouts as firm-specific design intelligence.

Capabilities:

- extract room graph and normalized geometry from existing accepted layouts;
- search similar plans by program graph, shape, area, and facade constraints;
- adapt/stretch candidates into new envelopes;
- score deviation from original design intent.

Acceptance:

- library-derived candidates rank alongside grammar-generated candidates;
- fit score exposes stretch/deviation by room;
- adapted plans never bypass hard constraints.

### Milestone 4: Multi-Level and Repetition

Goal: support repeated units, stacked wet cores, and larger residential or office
floor plates.

Capabilities:

- unit mix generation;
- repeated modules;
- mirrored and linked room groups;
- vertical alignment hints for shafts, stairs, and wet rooms;
- stack-aware scoring.

Acceptance:

- generated repeated units stay linked or carry group metadata;
- vertical service alignment is visible in score output;
- selected variants can be propagated across levels with controlled differences.

### Milestone 5: Learned Ranking and Advisor Refinement

Goal: use project history to improve candidate ranking without sacrificing
determinism.

Capabilities:

- store accepted/rejected variant telemetry;
- learn ranking features from historical choices;
- suggest weight changes based on user intent;
- detect when the brief is underconstrained or impossible.

Acceptance:

- learned ranking is optional and explainable;
- hard constraints remain authoritative;
- deterministic fallback remains available.

## Required Schemas

### Spatial Program Sketch

```json
{
  "schemaVersion": "spatialProgram_v1",
  "name": "Two bedroom apartment",
  "rooms": [
    {
      "id": "living",
      "type": "living_dining",
      "targetAreaM2": 26,
      "minAreaM2": 22,
      "requiresDaylight": true,
      "publicness": "public"
    },
    {
      "id": "bath",
      "type": "bathroom",
      "targetAreaM2": 5,
      "minWidthMm": 1800,
      "requiresWetCore": true
    }
  ],
  "relationships": [
    { "from": "living", "to": "kitchen", "kind": "adjacent", "weight": 1.0 },
    { "from": "bath", "to": "bedroom_1", "kind": "near", "weight": 0.5 }
  ],
  "weights": {
    "areaFit": 1.0,
    "adjacency": 1.0,
    "daylight": 1.0,
    "circulationEfficiency": 0.75
  }
}
```

### Candidate Result Sketch

```json
{
  "schemaVersion": "layoutCandidateSet_v1",
  "seed": 42,
  "iterations": 500,
  "acceptedCount": 38,
  "rejectedCount": 462,
  "candidates": [
    {
      "id": "cand-001",
      "score": 0.87,
      "scores": {
        "areaFit": 0.92,
        "adjacency": 0.84,
        "daylight": 0.88,
        "circulationEfficiency": 0.79
      },
      "rooms": [],
      "openings": [],
      "explanation": [
        "Living room and both bedrooms satisfy daylight requirements.",
        "Bathroom is 1.2 m from the wet-core zone.",
        "Bedroom 2 is 0.6 m2 below target but above minimum."
      ]
    }
  ],
  "rejections": [
    {
      "reason": "room_min_width_failed",
      "count": 96
    },
    {
      "reason": "egress_path_missing",
      "count": 44
    }
  ]
}
```

## Advisor UX Principles

- Show top options as architectural alternatives, not opaque AI outputs.
- Always show the score breakdown and the hard constraints that were satisfied.
- Treat rejected candidates as useful information: they explain why the brief may
  be overconstrained.
- Let users change weights interactively and regenerate.
- Keep all generated geometry editable after commit.
- Preserve assumptions as model elements or transaction metadata.
- Use existing Advisor severity patterns for residual issues after commit.

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| LLM-generated geometry is plausible but invalid | Users lose trust quickly | Keep geometry generation deterministic and validate before commit. |
| Constraint system becomes too broad too early | Slow delivery and brittle UX | Start with small orthogonal layouts and expand profiles incrementally. |
| Scoring feels arbitrary | Users cannot evaluate alternatives | Expose per-metric scores, weights, and short explanations. |
| Plan library overfits one firm's habits | Poor generalization | Keep library retrieval optional and profile-scoped. |
| Solver performance degrades | Generation feels slow | Use iteration budgets, deterministic seeds, caching, and progressive results. |
| Generated layouts conflict with downstream structure/MEP | Rework after commit | Include structural grid and service-zone hints early; keep specialist engines as future scoring layers. |

## Open Questions

- Which first typology should own the MVP: single-family house, small office,
  apartment unit, or multifamily floor plate?
- Should the first commit create full walls, or room separators plus rooms first?
- Where should spatial programs live: document element, external project brief,
  or Advisor assumption bundle?
- Should layout variants be persisted as model elements or transient generation
  results until accepted?
- How much of the candidate search should run server-side versus client-side?
- Which code/regulatory profile should be the first target?

## Near-Term Recommendation

Build Milestone 0 and Milestone 1 before any learned model work. The first
valuable version is an explainable solver-backed Advisor that can generate a few
valid alternatives for a simple floor plate, rank them, and commit one as native
BIM geometry. Data and plan-library intelligence become more valuable once the
deterministic representation, validator, and scoring vocabulary are stable.
