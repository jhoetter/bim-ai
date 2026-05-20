# Reverse-BIM Actual Methodology Tracker

Last updated: 2026-05-20

Status: **Reset tracker after target-house-3 failure. This supersedes any claim
that the current Leo seed proves the reverse-BIM methodology works.**

## Purpose

This tracker captures the actual methodology needed to reach the product goal:

```text
Given a folder like /Users/jhoetter/Desktop/Testhaeuser/Testhaus Leo,
produce a source-faithful, detailed, inspectable existing-building BIM model
through MCP-backed live BIM authoring.
```

The model must be something an architect/BIM technician can inspect and trust.
It is not enough that the model has walls, rooms, roofs, and openings. The
model must match the source documents in physical topology, dimensions,
levels, openings, stairs, site placement, construction semantics, schedules,
and validation evidence.

## Reset Decision

`target-house-3` is **not** accepted as a successful reverse-BIM artifact.

It remains useful only as a failure benchmark and diagnostic fixture. It showed
that the software can create many element types, but it did not prove that the
methodology can produce a correct existing-building model.

The seed artifact and the temporary Leo output must not be used as product
truth. Future work must make it impossible for an artifact like this to pass.

## What We Learned

### Failure Evidence From The Leo Run

Observed in the live seeded model and screenshots:

- The `KG` level is almost empty: it has a level and plan view but no real
  basement/cellar model.
- The plan views are physically incoherent: slabs/rooms/walls are layered in
  ways that do not read as real source-derived plans.
- Door placement is not solved: Advisor reports 17
  `door_operation_clearance_conflict` warnings.
- Stair placement is not solved: Advisor reports 1 `stair_wall_hard_clash`.
- The room graph can look "accessible" while still being physically wrong.
  Analytical room separations and adjacency checks were allowed to substitute
  for actual authored topology.
- The roof/dormer is provisional and not source-overlay verified.
- The site/toposolid is a flat context placeholder, not a source-faithful
  parcel/topology model.
- The model has too little opening/window detail for a source-derived house.
- Material/construction semantics are missing or weak: validation reports
  missing typed layer stacks and schedule metadata.
- UI inspection exposes problems that JSON count-based acceptance missed.

### Methodology Failures

The previous process failed because it allowed these invalid shortcuts:

| Bad pattern | Why it failed | Replacement |
| --- | --- | --- |
| Treating a generated seed/document as proof | The seed can replay bad geometry faithfully. | Only a live MCP run with phase evidence and clean QA can be accepted. |
| Count-based acceptance | Element counts can be high while topology is wrong. | Geometry, topology, overlay, and source-fact gates are mandatory. |
| Warning disposition as acceptance | "Reviewed/tolerated" warnings hid real modeling errors. | Geometry/topology Advisor warnings block acceptance unless backed by source-specific existing-condition evidence. |
| Analytical room separations as topology proof | Room graph can be satisfied without real architectural boundaries. | Rooms must be physically bounded by walls/openings or explicit source open-plan boundaries. |
| Incomplete level handling | KG existed but was not modeled. | Every source level/storey requires a completeness gate before final acceptance. |
| Provisional roof/dormer | Looked plausible but was not source-verified. | Roof/dormer requires source alignment and overlay evidence. |
| No visual overlay gate | UI made failures obvious after "acceptance". | Plan/elevation/section screenshots and overlays are hard gates. |
| Fixture repair treated as source truth | Leo fixture was manually repaired, not exhaustively re-read. | Source package must be reproducible from the folder with explicit AI-reader work packages and repair loops. |

## Non-Negotiable Acceptance Principle

An existing-building BIM model is **not accepted** while any of the following
are true:

- Any Advisor `error` exists.
- Any Advisor `warning` in geometry, topology, hosting, clearance, stair,
  opening, room boundary, level, roof, site, or constructability scope exists.
- Any model-integrity blocking finding exists.
- Any source level is empty or materially incomplete.
- Any room exists only as a visual/analytical placeholder.
- Any door/window/opening is unhosted, wrongly hosted, outside its source wall,
  lacking a valid room-side relationship, or has unresolved swing/clearance.
- Any stair lacks source-backed geometry, slab opening, headroom/clearance, and
  collision-free placement.
- Any source floor plan/section/elevation lacks overlay/readback evidence.
- Any source fact marked required is not modeled, reconciled, or blocked by an
  explicit source conflict.
- Any "tolerance" is used to hide a fixable modeling error.

Tolerances are allowed only for true existing-condition deviations supported by
source evidence, for example a documented nonconforming existing stair. A
tolerance cannot be used for bad authoring.

## Source Of Truth

The source of truth is ordered as follows:

1. Source documents in the user folder.
2. AI-reader extracted facts with page/region provenance.
3. Deterministic validation and conflict reports.
4. Live model state queried through MCP/API.
5. UI/renderer screenshots and overlays.

The seed artifact is never source of truth. It is only an optional transport or
inspection bridge after acceptance.

## Required End-To-End Pipeline

The methodology is a loop, not a one-shot generator.

```text
source folder
  -> source inventory
  -> AI visual/document reading work packages
  -> normalized source fact ledger
  -> conflict/completeness/coordinate checks
  -> MCP authoring plan
  -> live phase-by-phase BIM authoring
  -> deterministic readback after each phase
  -> Advisor/constructability/integrity/overlay/UI checks
  -> repairs
  -> final acceptance
  -> optional export/seed package
```

## Phase 0: Run Setup

Goal: create a reproducible run boundary.

Required outputs:

- `run-summary.json`
- `source-folder-manifest.json`
- `run-config.json`
- `methodology-version.txt`
- `tool-capability-snapshot.json`
- `model-run-id`

Hard gates:

- Source folder path is absolute and recorded.
- Run has a clean output directory.
- Tool capability snapshot is recorded before modeling.
- If running against an existing BIM model, model baseline snapshot is saved.
- No previous seed/document output is reused as current truth.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM0-001 | Reproducible run directory | Partial | A single command creates a fresh run directory with manifest/config/tool snapshot. |
| RBM0-002 | Baseline live model snapshot | Partial | Every modeling run records starting model id/revision and full snapshot. |
| RBM0-003 | Seed reuse guard | Done | `reverse_bim.folder_output` rejects `seed-artifacts/*` and generated target-house output roots as source truth. |

## Phase 1: Source Inventory And Rendering

Goal: know exactly what documents exist and make them readable by AI and by
deterministic checks.

Required outputs:

- `source/folder-manifest.json`
- `source/document-registry.json`
- `source/document-classification.json`
- `source/rendered-pages.json`
- `source/source-page-index.json`
- `source/native-text-extractions.json`
- `source/source-media-digest.json`

Document classes:

- floor plans
- sections
- elevations
- site/parcel/topology
- area calculations
- photos
- construction/material descriptions
- energy documents
- drainage/MEP documents
- legal/admin/reference-only documents

Hard gates:

- Every source file is classified.
- Every PDF/image page has a rendered image or a recorded render failure.
- Every page has a stable source id and digest.
- Every relevant plan/section/elevation/site page is routed to an AI-reader work
  package.
- No page may be silently skipped.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM1-001 | Folder manifest | Partial | Manifest includes path, digest, MIME/type, page count, and classification candidate. |
| RBM1-002 | PDF/image rendering | Partial | Rendered pages include page images, pixel size, DPI, source digest, and failures. |
| RBM1-003 | Classification | Partial | Classifier separates plans/sections/elevations/site/area/photos/admin with confidence. |
| RBM1-004 | Native text extraction | Partial | Text is captured as support evidence, not used as sole source for drawings. |
| RBM1-005 | Page routing | Not started | Work-package generator proves every relevant page is assigned or explicitly excluded. |

## Phase 2: AI Source Reading

Goal: have AI/subagents visually read documents into strict source facts.

This is AI-based, not legacy image-trace/CV-based. The software prepares
context; the AI reader interprets documents visually and returns structured
facts with provenance.

Required outputs:

- `ai-reading/work-packages.json`
- `ai-reading/reader-requests.json`
- `ai-reading/reader-responses.raw.json`
- `ai-reading/reader-responses.normalized.json`
- `ai-reading/reader-response-index.json`
- `ai-reading/reader-consensus-report.json`
- `ai-reading/repair-requests.open.json`

Required reader work packages:

- `levels-sections-elevations`
- `floorplan-kg`
- `floorplan-eg`
- `floorplan-dg`
- `wall-thickness-materials`
- `openings-windows-doors`
- `stairs-vertical-circulation`
- `roof-dormers`
- `room-names-areas`
- `site-parcel-topology`
- `construction-year-renovation-energy`
- `photos-cross-check`

Hard gates:

- At least one AI reader response exists per required work package.
- Critical geometry facts require either:
  - two independent reader passes with agreement, or
  - one reader pass plus deterministic cross-check from dimensions/areas.
- Reader output must include source page ids, crop/region refs, confidence, and
  explicit unknowns.
- Reader cannot return only prose. It must return model-feedable facts.
- Missing required facts create repair requests, not assumptions.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM2-001 | AI work-package schema | Partial | Work packages require source pages, expected facts, coordinate needs, and unknown policy. |
| RBM2-002 | Reader response normalization | Partial | Flexible AI output normalizes into typed source facts. |
| RBM2-003 | Reader consensus | Partial | `source.reader_consensus` and folder output now compare critical facts across independent reader passes and block insufficient/conflicting source readings. Deterministic cross-check disposition support is still pending. |
| RBM2-004 | Repair loop | Partial | Missing/conflicting facts produce actionable reader repair requests. |
| RBM2-005 | Fixture-free Leo rerun | Not started | Leo source understanding can be regenerated from folder without manually repaired JSON fixtures. |

## Phase 3: Coordinate And Scale Normalization

Goal: define drawing coordinate frames that can be used for overlay and MCP
authoring.

Required outputs:

- `understanding/coordinate-frames.json`
- `understanding/scale-detection.json`
- `understanding/cross-level-alignment.json`
- `understanding/source-underlay-registration.json`
- `validation/coordinate-frame-report.json`

Required facts:

- scale per drawing/page
- north/orientation per plan/site
- drawing origin and model origin
- level-to-level alignment anchors
- section/elevation datum lines
- source-to-model transform for every plan/elevation/section used for overlay

Hard gates:

- No wall graph can be authored until its plan page has a coordinate frame.
- No floor-to-floor topology can be accepted until levels share common anchors.
- No roof/elevation alignment can be accepted without section/elevation datum
  registration.
- No site placement can be accepted without parcel/building transform or an
  explicit source blocker.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM3-001 | Per-page coordinate frame schema | Partial | Each drawing has source pixels, drawing mm, model mm transform, confidence, provenance. |
| RBM3-002 | Cross-level alignment | Partial | Shared wall/core/stair anchors align KG/EG/DG within tolerance. |
| RBM3-003 | Overlay transform export | Not started | Renderer/UI can draw source underlay aligned to model geometry. |
| RBM3-004 | Site transform | Partial | Parcel and house placement share a model coordinate frame. |

## Phase 4: Source Fact Ledger

Goal: create a complete, source-backed list of what must be modeled.

Required output:

- `understanding/source-fact-ledger.json`
- `understanding/existing-building-ir.json`
- `understanding/conflict-ledger.json`
- `validation/source-completeness-report.json`

Required fact types:

- levels/storeys including KG/basement/cellar
- floor/slab boundaries and openings
- exterior walls by level with thickness, start/end, construction, material
- interior partitions by level with thickness, start/end, construction, material
- room boundary polygons and room names
- room areas with basis: Wohnflaeche, Nutzflaeche, gross/net, sloped-roof rules
- doors/openings with host wall candidates, width, swing side, room adjacency
- windows with host wall, dimensions, sill/head, elevation provenance
- stairs with runs, landings, width, riser/tread, total rise, source condition
- roof footprint, ridge/eaves, slope, overhang, dormers, roof windows
- site parcel/property lines, setbacks, terrain/toposolid/topology
- construction year, renovations, materials/layer stacks
- schedules required for rooms/openings/materials

Hard gates:

- Every source level must have a fact completeness decision.
- No "empty level" is allowed unless the source explicitly has no modeled
  content for that level.
- Every room must have a physical boundary source or an explicit open-plan
  source boundary.
- Every opening must have host resolution requirements before authoring.
- Every inferred fact must name the rule and confidence.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM4-001 | Physical wall graph facts | Partial | Wall graph includes all walls/partitions by level with thickness and joins. |
| RBM4-002 | Basement/KG completeness | Partial | `reverse_bim.source_level_completeness` and folder output now block source-required levels like KG when no physical wall/floor/room/opening/stair facts exist. Model-side final completeness gates remain separate. |
| RBM4-003 | Physical room topology facts | Partial | Room topology distinguishes real walls, openings, open-plan boundaries, and analytical separators. |
| RBM4-004 | Opening host/swing facts | Partial | Every door/window has source host candidate, side, width, swing/clearance intent. |
| RBM4-005 | Stair facts | Partial | Runs/landings/slab openings/headroom/clearance are source-derived. |
| RBM4-006 | Roof/dormer facts | Partial | Roof and dormer geometry is source-aligned, not provisional. |
| RBM4-007 | Materials/layer stacks | Partial | `reverse_bim.source_material_assemblies` and folder output now block generic wall/floor/roof type authoring unless source facts include material/layer data or an explicit source-unavailable disposition. MCP type creation/readback still needs phase-runner integration. |
| RBM4-008 | Area formula facts | Partial | Area calculations preserve basis and formulas, not only target totals. |

## Phase 5: MCP Authoring Plan

Goal: convert source facts into deterministic live-model actions.

Required outputs:

- `mcp-handoff/mcp-readiness.json`
- `mcp-handoff/resolver-worklist.json`
- `mcp-handoff/authoring-plan.json`
- `mcp-handoff/phase-authoring-spec.json`
- `mcp-handoff/tolerance-policy.json`

Rules:

- The plan is not a seed DSL.
- The plan must call MCP/API authoring tools or list missing tool contracts.
- Host/resolver calls happen before hosted element creation.
- Each phase has exact expected model query counts and QA gates.

Hard gates:

- No phase starts with unresolved source blockers for that phase.
- No hosted object is authored without host resolver output.
- No room is authored before physical walls/open boundaries for that room are in
  place.
- No stair is authored before levels, floor/slab opening intent, and wall
  context are known.
- No roof/dormer is authored before wall/level/elevation alignment is known.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM5-001 | Authoring phase compiler | Partial | Source facts become phase actions with tool names, payloads, source refs, and expected readback contracts. |
| RBM5-002 | Host resolver worklist | Partial | Doors/windows/slab openings/dormers/stairs list resolver calls and ambiguity policy. |
| RBM5-003 | Missing tool contract ledger | Partial | Any raw bundle/unsupported operation is surfaced as a product gap. |
| RBM5-004 | Expected readback spec | Partial | Each authoring action now carries `reverseBimExpectedReadback_v1`; `reverse_bim.phase_run` blocks missing/failed readback evidence. Full model-query diffing is still pending. |

## Phase 6: Live MCP Authoring

Goal: build through the live BIM software like a BIM technician.

Each phase follows the same loop:

```text
prepare phase action packet
dry-run transaction
inspect dry-run result
commit transaction
query created/modified elements
run Advisor
run constructability
run model integrity
run phase-specific topology checks
render screenshots/views
run source overlay comparison
repair until clean
only then continue
```

Authoring phases:

1. project/site/coordinate setup
2. levels and datum views
3. source underlays and overlay registration
4. KG/basement shell
5. EG shell
6. DG/upper shell
7. slabs/floors/openings by level
8. interior partitions by level
9. rooms and physical room topology
10. doors/openings with swing/clearance validation
11. windows/elevation reconciliation
12. stairs and vertical circulation
13. roof/dormers/roof openings
14. site/parcel/toposolid/topology
15. materials/layer stacks/construction metadata
16. schedules
17. final validation and UI inspection

Hard gates after every phase:

- Advisor has 0 errors and 0 blocking warnings for the phase scope.
- Constructability has 0 unresolved geometry/topology warnings for the phase.
- Integrity has 0 blockers.
- Query/readback matches expected counts and geometry.
- Screenshots exist for relevant plan/3D/elevation views.
- Overlay deviation is within tolerance or the phase fails.
- No "defer to final acceptance" for geometry problems.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM6-001 | Transactional phase runner | Partial | `reverse_bim.phase_run` now blocks skipped source-bearing phases and missing/unaccepted phase packets. Actual command execution/orchestration is still pending. |
| RBM6-002 | Phase readback queries | Partial | Phase specs now list required post-commit query surfaces and expected readback rows; concrete query/diff adapters still need completion. |
| RBM6-003 | Advisor/constructability gating | Done | Phase packets and final acceptance block Advisor/constructability warnings by default. |
| RBM6-004 | Screenshot evidence capture | Not started | Runner captures plan/3D/elevation screenshots after each phase. |
| RBM6-005 | Source overlay compare | Not started | Model geometry is compared against registered source drawings. |

## Phase 7: Physical Topology Acceptance

Goal: prove the building makes architectural sense.

Required outputs:

- `validation/physical-topology-report.json`
- `validation/room-boundary-report.json`
- `validation/opening-host-report.json`
- `validation/stair-circulation-report.json`

Hard gates:

- Every required source level has walls/slabs/rooms or a source-backed
  "not modeled" reason.
- Every room boundary edge is backed by a wall, true opening, or explicit
  source open boundary.
- Room-separation elements cannot be used to hide missing walls.
- Every accessible room has a physically valid door/opening path.
- Every door has exactly valid adjacent source rooms unless it is an exterior
  door.
- No door clearance conflict remains.
- No stair-wall clash remains.
- No furniture/assets/doors/windows are placed on stair geometry.
- Slab openings match stairs/shafts.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM7-001 | Empty-level detector | Not started | KG-like empty source levels block acceptance. |
| RBM7-002 | Physical room boundary checker | Partial | Distinguishes physical walls/openings from analytical room separators. |
| RBM7-003 | Door adjacency checker | Partial | Doors must connect correct rooms or exterior; one-sided interior doors fail. |
| RBM7-004 | Clearance/swing checker | Partial | Door swing and stair clearance warnings block acceptance. |
| RBM7-005 | Stair/slab opening checker | Partial | Stair collision, opening, and headroom are validated as a group. |

## Phase 8: Source Overlay And UI Evidence

Goal: catch problems that structured counts miss.

Required outputs:

- `evidence/overlay/plan-kg.png`
- `evidence/overlay/plan-eg.png`
- `evidence/overlay/plan-dg.png`
- `evidence/overlay/sections/*.png`
- `evidence/overlay/elevations/*.png`
- `validation/source-overlay-report.json`
- `validation/ui-inspection-report.json`

Hard gates:

- Every authored floor plan has a source overlay screenshot.
- Every major elevation/section has a model-vs-source comparison.
- Overlay deviation thresholds are explicit and phase-specific.
- UI screenshots must show:
  - plan views by level
  - 3D exterior
  - 3D cutaway/interior
  - stair/vertical circulation
  - site placement
  - roof/dormer
- If a human can see that topology is wrong, the acceptance report must fail.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM8-001 | Source underlay import | Partial | Folder output now emits `mcp-handoff/evidence-requirements.json` with required source overlay views derived from source pages; actual underlay import remains pending. |
| RBM8-002 | Overlay renderer | Partial | `reverse_bim.evidence_requirements` now declares required overlay views and tolerances; actual registered source/model image rendering remains pending. |
| RBM8-003 | Overlay deviation metrics | Partial | `reverse_bim.source_overlay_evidence` now enforces required overlay result rows and deviation thresholds; actual model/source rendering comparison still pending. |
| RBM8-004 | UI screenshot gate | Partial | `reverse_bim.ui_evidence` now requires named screenshot evidence and per-view visual checklist evidence before final acceptance; automated capture still pending. |
| RBM8-005 | Human-visible failure checklist | Partial | UI evidence now checks structured items for placeholder massing, visible Advisor state, topology, hosted openings, empty levels, stairs, roof/dormers, and site placement. |

## Phase 9: Final Acceptance

Goal: accept only a source-faithful BIM model.

Required outputs:

- `validation/final-acceptance.json`
- `validation/finding-disposition-ledger.json`
- `validation/source-coverage-final.json`
- `validation/model-query-final.json`
- `validation/advisor-final.json`
- `validation/constructability-final.json`
- `validation/integrity-final.json`
- `validation/physical-topology-final.json`
- `validation/source-overlay-final.json`
- `evidence/final-screenshots/`

Hard gates:

- `accepted=true` is possible only if all gate statuses are `passed`.
- Geometry/topology warnings cannot be dispositioned as accepted unless the
  source proves an existing nonconforming condition. Existing-building work
  must not redesign away a documented 100-year-old condition just to satisfy a
  modern rule, but the warning remains visible in the ledger and handoff.
- Every tolerance must have source ids, owner, scope, and downstream impact.
- Final UI and MCP readback must describe the same model.
- No final seed/export package is generated if acceptance fails.

Acceptance gate table:

| Gate | Required status for acceptance |
| --- | --- |
| Source completeness | No required source facts missing. |
| Conflict ledger | No unresolved conflicts. |
| Level completeness | Every source level modeled or source-blocked; no empty KG-like level. |
| Physical topology | Rooms/walls/openings/stairs are physically coherent. |
| Advisor | 0 errors, 0 unresolved geometry/topology warnings; source-backed existing nonconformances are carried as visible tolerated warnings. |
| Constructability | 0 unresolved geometry/topology warnings; source-backed existing nonconformances are carried as visible tolerated warnings. |
| Integrity | 0 blockers. |
| Overlay | All required plan/section/elevation overlays within tolerance. |
| Areas | Source areas reconcile by basis/formula or block. |
| Materials/schedules | Required schedules/material assemblies populated or source-blocked. |
| UI evidence | Required screenshots exist and pass visual checklist. |
| MCP readback | Queries match expected source/model facts. |

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM9-001 | Final acceptance rewrite | Done | `reverseBimFinalAcceptancePolicy_v2` fails the target-house-3 failure shape instead of accepting it. |
| RBM9-002 | Warning policy hardening | Done | Geometry/topology warnings are blocking by default; only source-backed `existing_nonconforming_tolerated` / `existing_nonconforming_source_backed` rows with source fact ids, reason, and reviewer can pass. |
| RBM9-003 | Visual evidence gate | Partial | Final acceptance now requires source-overlay and UI evidence reports; generating the screenshots/overlays remains pending. |
| RBM9-004 | Seed/export guard | Not started | Seed/export command refuses unaccepted models. |

## Seed And Export Policy

Seed artifacts are not part of the methodology.

Allowed:

- Generate a seed/export package only after final acceptance passes.
- Use a seed as a portable demo/inspection artifact.
- Use a replay bundle as a temporary bridge if a first-class import/export path
  is missing.

Forbidden:

- Using a seed artifact as proof that reverse-BIM worked.
- Packaging a diagnostic or partially accepted model as `target-house-*`.
- Accepting a seed if the live model still has unresolved Advisor warnings.
- Hiding local/generated seed artifacts in source history.

Implementation status:

| ID | Work item | Status | Done condition |
| --- | --- | --- | --- |
| RBM-SEED-001 | Seed packaging guard | Done | `scripts/create-seed-artifact.mjs` blocks `target-house-*` packaging unless an accepted `reverseBimFinalAcceptancePolicy_v2` report is supplied and copied into evidence. |
| RBM-SEED-002 | Seed provenance | Partial | Seed manifest points to acceptance evidence, not just a bundle. |
| RBM-SEED-003 | Local artifact hygiene | Done | `tmp/`, `app/data/`, and generated target-house seed artifacts are ignored. |

## Leo Re-Benchmark Plan

The next Leo run must be a fresh methodology benchmark, not a repair of
`target-house-3`.

Required steps:

1. Delete or ignore old Leo `tmp/` outputs for methodology purposes.
2. Re-run source inventory from `/Users/jhoetter/Desktop/Testhaeuser/Testhaus Leo`.
3. Create AI-reader work packages for all plan/section/elevation/site/area docs.
4. Require source facts for KG, EG, DG, roof, site, openings, stairs, materials,
   and areas before modeling.
5. Build a new live model, for example `target-house-4`, phase by phase.
6. Stop at the first failed phase gate.
7. Fix source understanding, MCP authoring, or model geometry before continuing.
8. Accept only with clean final gates and source/UI evidence.
9. Package a seed/export only after acceptance.

Leo-specific blockers known from `target-house-3`:

| ID | Blocker | Required fix |
| --- | --- | --- |
| LEO-RBM-001 | Empty KG | Extract/model basement/cellar facts or mark source-blocked before acceptance. |
| LEO-RBM-002 | Door clearance conflicts | Re-resolve host wall, door side, swing, and adjacent room topology. |
| LEO-RBM-003 | Stair-wall clash | Re-author stair, walls, and slab opening as a coordinated vertical package. |
| LEO-RBM-004 | Analytical room topology | Replace fake/separation-only topology with physical walls/open boundaries. |
| LEO-RBM-005 | Roof/dormer provisional geometry | Source-align roof/dormer from sections/elevations and overlay. |
| LEO-RBM-006 | Missing material/layer semantics | Extract or explicitly source-block wall/floor/roof assemblies. |
| LEO-RBM-007 | Site placeholder | Source-align parcel/building/toposolid or block terrain fidelity. |
| LEO-RBM-008 | UI evidence absent | Add required screenshots and visual checklist before acceptance. |
| LEO-RBM-009 | Target/context scope unresolved | Add `building_scope` and target/context scope mask so the agent does not model one half when the source requires the whole Doppelhaus or vice versa. |

## Product Tool Gaps

These are the tool gaps that matter most for the goal.

| ID | Missing or weak capability | Impact | Required product surface |
| --- | --- | --- | --- |
| GAP-001 | Source overlay comparison | Bad topology passes count-based checks. | `qa.source_overlay_compare` with plan/elevation/section deviation metrics. |
| GAP-002 | Physical topology checker | Room graph can pass with analytical placeholders. | `qa.physical_topology` for walls/openings/rooms/stairs. |
| GAP-003 | Empty-level completeness | KG can be ignored while level exists. | `qa.level_completeness` linked to source facts. |
| GAP-004 | Door swing/room-side resolver | Door clearance warnings remain. | `resolve.door_side_and_swing` plus `validate.door_clearance`. |
| GAP-005 | Stair vertical package authoring | Stairs can clash with walls/floors. | Atomic stair + slab opening + railing + clearance authoring/check. |
| GAP-006 | Roof/dormer source alignment | Provisional dormer passes. | `validate.roof_dormer_overlay_alignment`. |
| GAP-007 | Material/layer extraction and authoring | Schedules/material QA remain weak. | Partial: source package now emits `understanding/material-assemblies.json`, repair requests, and `reverse_bim.source_material_assemblies`; wall/floor/roof type authoring/readback gates still need implementation. |
| GAP-008 | Phase runner | Agent can skip iterative feedback. | Partial: `reverse_bim.phase_run` enforces phase-packet order/acceptance; live dry-run/commit/query orchestration remains. |
| GAP-009 | Seed/export guard | Bad diagnostic models can be packaged. | Export/seed command requires final acceptance report. |
| GAP-010 | UI evidence capture | Human-visible failures discovered too late. | Automated screenshot capture from named views. |

Implemented first-pass surfaces:

- `qa.level_completeness` / `reverse_bim.level_completeness`
- `qa.physical_topology` / `reverse_bim.physical_topology`
- `qa.source_overlay_compare` / `reverse_bim.source_overlay_evidence`
- `reverse_bim.ui_evidence`
- `reverse_bim.final_acceptance` with `reverseBimFinalAcceptancePolicy_v2`
- `reverse_bim.source_material_assemblies`
- `reverse_bim.source_building_scope`
- `reverse_bim.source_level_completeness`
- `source.reader_consensus`
- `reverse_bim.phase_run`
- `reverse_bim.evidence_requirements`

These enforce the new gates with structured reports. The remaining work is
automatic source/model overlay rendering, screenshot capture, live phase
orchestration, material type authoring/readback gates, applying target/context
scope masks into authoring, and a fresh Leo benchmark.

Fresh live audit evidence for `target-house-3` now lives under
`tmp/reverse-bim-testhaus-leo/live-target-house-3-audit/`. It rejects the
current seeded model through the actual live `/validate`,
`/constructability-report`, and `/summary` payloads: Advisor warnings,
constructability door/stair findings, empty KG, missing source overlays, and
missing accepted UI evidence all block final acceptance.

## Implementation Waves

| Wave | Scope | Done condition | Status |
| --- | --- | --- | --- |
| W0 | Mark `target-house-3` invalid in trackers and tests | No tracker calls it accepted; final acceptance fixture fails current model. | Done |
| W1 | Harden final acceptance policy | Geometry/topology warnings block acceptance by default. | Done |
| W2 | Empty-level and physical topology gates | KG-like missing levels and fake room topology fail. | Partial |
| W3 | Door/stair validation hardening | Door clearance and stair clashes become blocking. | Partial |
| W4 | Source overlay infrastructure | Registered source pages compare against live model geometry. | Partial |
| W5 | Phase runner | Agent cannot proceed without phase QA evidence. | Partial |
| W6 | Reader consensus and fixture-free source rerun | Leo source package regenerates without manual repaired fixtures. | Partial |
| W7 | Materials/schedules | Required room/opening/material schedule metadata is modeled or source-blocked. | Partial |
| W8 | Leo target-house-4 benchmark | Fresh run produces clean model or stops with exact blockers. | Not started |
| W9 | Seed/export after acceptance only | Seed packaging is gated by final report. | Partial |

## Required Tests

Tests must encode the failure so it cannot regress.

| ID | Test | Expected result |
| --- | --- | --- |
| TEST-001 | Model with empty source KG | Final acceptance fails. |
| TEST-002 | Model with door clearance warnings | Final acceptance fails. |
| TEST-003 | Model with stair-wall clash | Final acceptance fails. |
| TEST-004 | Room accessible only through analytical separation | Physical topology fails. |
| TEST-005 | Missing source overlay evidence | Final acceptance fails. |
| TEST-006 | Provisional roof/dormer without source alignment | Final acceptance fails. |
| TEST-007 | Seed packaging without accepted final report | Packaging fails. |
| TEST-008 | Fixture-only source facts | Source package is not accepted as reproducible. |
| TEST-009 | Wall/floor/roof scope without material/layer source facts or explicit unavailable disposition | Folder output acceptance fails and emits material repair request. |
| TEST-010 | Single or conflicting critical AI-reader passes | Reader consensus blocks source handoff. |
| TEST-011 | Phase packet omits expected model readback evidence | Phase run fails before next phase. |
| TEST-012 | UI screenshot lacks/fails visual inspection checklist | UI evidence fails even when screenshot file exists. |
| TEST-013 | Source-required KG/level has no physical source facts | Folder output acceptance fails and emits level repair request. |
| TEST-014 | Building target/context scope is missing, ambiguous, or conflicting | Folder output acceptance fails and emits `building_scope_repair`. |

## Done Definition For The Overall Goal

The methodology is working only when a fresh source folder can produce:

- a reproducible source-understanding package,
- a complete physical source fact ledger,
- a live MCP-authored model,
- clean phase QA evidence,
- clean final Advisor/constructability/integrity results,
- source overlays that match plans/sections/elevations,
- no empty required levels,
- physically coherent rooms/openings/stairs/roof/site,
- schedules/material data sufficient for inspection,
- a UI-inspectable model that agrees with MCP query readback,
- and an optional seed/export package generated only after acceptance.

Until then, the product should report precise blockers rather than claiming a
model is accepted.
