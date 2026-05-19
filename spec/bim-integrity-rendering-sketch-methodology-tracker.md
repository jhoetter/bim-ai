# BIM Integrity, Rendering Fidelity, And Sketch-to-BIM Methodology Tracker

Last updated: 2026-05-19

Purpose: track the work needed for an excellent BIM authoring loop across three
separate concerns:

1. a deterministic Advisor / BIM integrity system that catches invalid or
   physically incoherent model states for both human and agent-authored models;
2. a rendering and exchange-fidelity system that makes every supported BIM
   element render correctly, or reports unsupported cases explicitly;
3. a sketch-to-BIM methodology gate that checks whether an AI-generated model
   satisfies the customer sketch, brief, BIM information requirements, and
   evidence contract without polluting the normal product Advisor with
   project-specific taste judgments.

This tracker intentionally supersedes any informal "No findings means done"
interpretation. No findings only means the current implemented rules found
nothing. This tracker defines the missing rule families, diagnostics, evidence,
and test coverage required before the software can be treated as excellent for
agentic BIM generation.

Related sources:

- `spec/sketch-to-bim-methodology.md`
- `spec/sketch-to-bim-readiness-tracker.md`
- `spec/sketch-to-bim-product-surfaces.md`
- `spec/ui-mcp-parity-tracker.md`
- `spec/target-house/target-house-seed.md`
- `spec/target-house/target-house-1-acceptance-checklist.md`
- `claude-skills/sketch-to-bim/SKILL.md`
- `claude-skills/sketch-to-bim/sketch_bim.py`
- `app/bim_ai/constructability_advisories.py`
- `app/bim_ai/constructability_report.py`
- `app/bim_ai/constraints.py`
- `app/bim_ai/engine_dispatch_building_edit.py`
- `packages/web/src/Viewport.tsx`
- `packages/web/src/viewport/`

## Why This Tracker Exists

The target-house-1 run exposed a class of failures that the existing Advisor can
miss:

- a hosted door can reference a real wall and still be physically wrong because
  the host wall is a synthetic/access helper, outside the building envelope, or
  not part of a valid room/floor topology;
- a roof opening can be semantically present while the viewport does not show a
  real cut because the renderer path is incomplete or silently falls back;
- a model can be Advisor-clean while visually/specifically wrong for a
  customer sketch, because the normal Advisor is not supposed to judge sketch
  fidelity.

The remedy is not one large subjective rule. The remedy is layered:

1. authoring commands reject impossible edits before commit;
2. model integrity rules catch invalid topology, support, containment, hosts,
   nonphysical helper leakage, and broken references after any import/bundle;
3. constructability/code/norm rules catch deterministic domain issues;
4. renderer diagnostics prove whether the viewport can display the committed
   model faithfully;
5. sketch-to-BIM methodology checks the project-specific brief, sketch, and
   evidence as an agent workflow gate.

## Completion Definition

This tracker is complete only when all of these are true:

- UI, CLI, and MCP/API routes can produce the same model-integrity diagnostics.
- A model with detached doors, physical helper-wall leakage, unsupported roof
  cuts, unsupported slab openings, stale evidence, or failed renderer cuts cannot
  be presented as accepted.
- The normal Advisor remains deterministic and general: it reports BIM health,
  code/norm/physics/coordination issues, not whether a model looks like a
  particular sketch.
- The sketch-to-BIM gate remains methodology-specific: it compares the model to
  the source sketch, brief, phase plan, and acceptance checklist.
- Every supported element class has a rendering contract and golden coverage.
  Unsupported cases are explicit diagnostics, not silent visual drift.
- Every rule has tests, severity, discipline/perspective metadata, affected
  element ids, user-facing recommendation, and CLI/API/UI parity evidence.

## Status Model

| Status        | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `Done`        | Implemented, tested, documented, exposed through product surfaces.          |
| `Partial`     | Some behavior exists, but coverage, parity, or evidence is incomplete.      |
| `Not started` | No reliable implementation beyond incidental or raw-bundle behavior.        |
| `Blocked`     | Needs another tracker item or external decision before it can be completed. |

| Priority | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `P0`     | Required before a serious target-house-1 rerun or accepted seed.        |
| `P1`     | Required before calling the workflow excellent for normal house models. |
| `P2`     | Required for broader professional BIM depth.                            |
| `P3`     | Useful hardening or scale work.                                         |

## Milestones

| Milestone                               | Status      | Exit criteria                                                                                                                                                                                                   |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M0` Tracker and rule taxonomy          | Done        | This tracker exists, defines layers, rule families, milestones, and wave plan.                                                                                                                                  |
| `M1` P0 BIM integrity foundation        | Partial     | Hosted openings, helper/nonphysical elements, floor/envelope containment, support/topology, and command validation gaps are covered by deterministic Advisor/validation rules with tests and UI/CLI/API parity. |
| `M2` P0 renderer fidelity foundation    | Partial     | Renderer emits diagnostics for unsupported/failed cuts, roof/slab/wall openings have golden tests, and target-house-critical visual failures cannot be silent.                                                  |
| `M3` P0 sketch-to-BIM methodology gate  | Partial     | Sketch-specific fidelity checks are separated from normal Advisor, phase packets fail on missing visual/spec evidence, and target-house acceptance cannot pass on Advisor-clean but visually wrong output.      |
| `M4` P1 domain depth                    | Partial     | Rooms/access/egress, stairs/railings, structure-lite, MEP-lite, fire/accessibility metadata, materials/types, and exchange checks have robust rule coverage.                                                    |
| `M5` P1 rendering/exchange completeness | Partial     | Supported viewport geometry, IFC/glTF export manifests, and readback/golden evidence agree for architecture, structure-lite, MEP-lite, sheets, and schedules.                                                   |
| `M6` Performance and live UX quality    | Partial     | Advisor and renderer diagnostics are incremental, bounded, nonblocking, and do not cause sluggish orbit/selection/WebSocket behavior in ordinary projects.                                                      |
| `M7` Platform-grade BIM guarantees      | Partial     | Kernel invariants, transaction safety, collaboration, provenance, fixture governance, and agent remediation safety are covered by tests and documented contracts.                                               |
| `M8` Target-house rerun readiness       | Partial     | `target-house-1` can be regenerated from methodology with zero unhandled warnings/errors, clean renderer diagnostics, zero geometry-diagnostic blockers, current evidence, passed semantic visual checklist, and explicit tolerances only where accepted by the user. |

## Layering Contract

| Layer                            | Owned by                                         | Must report                                                                                                   | Must not report                                                         |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Authoring validation             | UI tools, CLI, MCP/API, command engine           | impossible inputs, missing hosts, bad references, invalid ranges, destructive ambiguity                       | project-specific visual fidelity                                        |
| BIM integrity Advisor            | backend Advisor / constructability / constraints | broken hosts, nonphysical leakage, topology gaps, support/containment issues, invalid physical state          | subjective aesthetics                                                   |
| Constructability / norms Advisor | backend Advisor profiles                         | clearance, access, egress, structure-lite, MEP penetrations, metadata, fire/accessibility/code-profile issues | sketch-match scoring                                                    |
| Renderer diagnostics             | viewport and render/export pipelines             | unsupported or failed visual geometry, dropped cuts, fallback proxies, hidden categories, export/view drift   | model-code violations already owned by Advisor unless renderer-specific |
| Sketch-to-BIM methodology gate   | skill/helper/agent evidence loop                 | sketch/brief/IR/phase/spec acceptance, semantic visual checklist, stale evidence                              | normal live-product warnings for arbitrary architect-authored models    |

## Tracker Items

### A. Taxonomy, Surface Parity, And Rule Governance

| ID        | Priority | Status      | Item                                       | Acceptance                                                                                                                                                                                          |
| --------- | -------- | ----------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-A01` | P0       | Done        | Create the tracker and layer contract.     | This file exists and separates authoring validation, BIM integrity, constructability, renderer diagnostics, and sketch methodology gates.                                                           |
| `BIR-A02` | P0       | Partial     | Create canonical rule taxonomy.            | Every rule has `ruleId`, title, severity, discipline, perspective, layer owner, affected ids, recommendation, fix command hints, suppressibility, and profile membership.                           |
| `BIR-A03` | P0       | Done        | Add rule registry tests.                   | Tests fail if a new rule lacks metadata, UI display text, CLI/API serialization, severity mapping, or perspective classification.                                                                   |
| `BIR-A04` | P0       | Partial     | Establish UI/CLI/API Advisor parity.       | Same model and profile yield equivalent grouped findings in right rail, CLI `advisor`, API snapshot violations, and constructability report. Existing parity helpers are extended to all new rules. |
| `BIR-A05` | P0       | Partial     | Add severity policy.                       | P0 integrity failures are `error`; current-phase sketch blockers cannot be hidden as `info`; metadata and profile completeness use predictable `warning`/`info` levels.                             |
| `BIR-A06` | P1       | Partial     | Add suppression/tolerance policy per rule. | Rule registry declares whether a finding can be ignored, temporarily tolerated, or requires a modeled fix; tolerances require owner, expiry, and evidence.                                          |
| `BIR-A07` | P1       | Partial     | Add rule documentation generator.          | A generated `spec/generated/advisor-rule-ledger.md` lists every rule, examples, surfaces, tests, and status.                                                                                        |

### B. Authoring And Command Validation

| ID        | Priority | Status      | Item                                                                             | Acceptance                                                                                                                                                                                  |
| --------- | -------- | ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-B01` | P0       | Partial     | Validate hosted door/window/opening placement before commit.                     | UI, CLI, and MCP/API reject missing host, wrong host kind, invalid `alongT`, width beyond wall span, head/sill outside wall height, and host-level mismatch.                                |
| `BIR-B02` | P0       | Partial     | Reject or flag physical elements authored outside building support context.      | Commands that create physical walls, doors, windows, stairs, rails, assets, or slabs outside a selected level/floor/envelope require explicit `allowDetached` or produce an error/advisory. |
| `BIR-B03` | P0       | Partial     | Prevent analysis/helper elements from becoming visible physical BIM by accident. | Access-graph, room-closure, diagnostic, and helper entities have explicit nonphysical category/visibility/serialization semantics; physical creation requires explicit category.            |
| `BIR-B04` | P0       | Partial     | Add transaction-level integrity preflight.                                       | `dry-run` and commit-bundle include model-integrity findings before mutation; P0 errors block commit unless a rule explicitly permits commit with error.                                    |
| `BIR-B05` | P0       | Partial     | Align UI tool guards with backend validation.                                    | Door/window/wall-opening UI tools cannot select nonphysical or invalid host walls; backend rejects the same state if created by bundle.                                                     |
| `BIR-B06` | P1       | Partial     | Add safe defaults for agent authoring.                                           | Agent-facing tools require explicit level, host, type, material/category, and intended physical/analysis role rather than relying on active UI state.                                       |
| `BIR-B07` | P1       | Partial     | Add correction command hints for integrity findings.                             | Findings include machine-readable fixes such as delete helper, rehost door, move wall into envelope, convert to analysis, add opening, or create missing support.                           |

### C. Hosted Elements, Openings, And Physical Containment

| ID        | Priority | Status      | Item                                                         | Acceptance                                                                                                                                                                          |
| --------- | -------- | ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-C01` | P0       | Done        | Detect hosted door/window not embedded in a real wall.       | Door/window findings fire when the host wall is nonphysical, analysis-only, hidden helper, too short, outside its level floor, or not part of a valid architectural boundary.       |
| `BIR-C02` | P0       | Done        | Detect host wall outside floor/building envelope.            | A wall with physical role on a storey must intersect/align with a floor, room boundary, or explicit detached/exterior condition; otherwise report `physical_wall_outside_envelope`. |
| `BIR-C03` | P0       | Done        | Detect door/window outside usable wall span.                 | Openings near endpoints, overlaps, or exceeding segment capacity report deterministic errors even if `alongT` is technically in range.                                              |
| `BIR-C04` | P0       | Partial     | Detect door/window without rendered or semantic opening cut. | A hosted element must either create an explicit wall void/cut participant or declare a renderer-supported integrated cut; missing cut is a BIM integrity error.                     |
| `BIR-C05` | P0       | Done        | Detect physical access-proxy leakage.                        | Synthetic access walls/doors used only for room graph logic are either nonphysical or flagged when visible/rendered/scheduled/exported as architectural elements.                   |
| `BIR-C06` | P1       | Partial     | Add opening conflict graph.                                  | Multiple doors/windows/wall openings on one wall cannot overlap, exceed wall capacity, or violate endpoint/lintel spacing without a warning/error.                                  |
| `BIR-C07` | P1       | Partial     | Add hosted family support classification.                    | Doors/windows/assets declare hosted, freestanding, face-hosted, level-hosted, ceiling-hosted, or workplane-hosted semantics; Advisor validates host kind and geometry.              |
| `BIR-C08` | P1       | Partial     | Add orphan rendered-proxy detector.                          | Any mesh/proxy generated for a hosted element without valid host geometry emits a renderer diagnostic and Advisor integrity finding.                                                |

### D. Rooms, Access, Egress, And Spatial Topology

| ID        | Priority | Status      | Item                                           | Acceptance                                                                                                                                                    |
| --------- | -------- | ----------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-D01` | P0       | Partial     | Keep room boundary openness strict.            | Existing room-boundary checks are expanded to distinguish real walls from helper separations and to flag fake room-separation hacks.                          |
| `BIR-D02` | P0       | Partial     | Validate room-door access through real doors.  | A room is accessible only through physical hosted doors/openings on valid room boundaries; synthetic off-envelope access doors do not satisfy access.         |
| `BIR-D03` | P0       | Partial     | Validate room containment within floor/storey. | Room polygons must lie within or intentionally extend from the level floor/envelope; detached room islands and overlap outside slabs are errors.              |
| `BIR-D04` | P1       | Partial     | Validate egress graph.                         | Existing egress rules are extended with exterior exit classification, stair/level transitions, and multiple-room traversal evidence.                          |
| `BIR-D05` | P1       | Partial     | Validate room/wall topology consistency.       | Walls that bound rooms are classified interior/exterior/corridor/shaft; conflicting classification produces findings.                                         |
| `BIR-D06` | P1       | Partial     | Add room schedule integrity.                   | Room schedule rows match physical rooms, have area/source, level, function, occupancy/use, and classification placeholders.                                   |
| `BIR-D07` | P2       | Partial     | Add occupancy and accessibility profiles.      | Profile-specific minimum access width, bathroom clearance, circulation, and accessible route checks can be enabled without hardcoding them into all projects. |

### E. Floors, Slabs, Stairs, Railings, And Vertical Circulation

| ID        | Priority | Status  | Item                                                         | Acceptance                                                                                                                                            |
| --------- | -------- | ------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-E01` | P0       | Partial | Validate slab openings and stair penetration.                | Stairs crossing floors require explicit slab/shaft openings; openings must be inside host slabs, not degenerate, and visible/renderable.              |
| `BIR-E02` | P0       | Partial | Validate floor support and detached slab fragments.          | Floors/slabs outside supported wall/beam/perimeter assumptions report support warnings or require explicit cantilever/terrace metadata.               |
| `BIR-E03` | P0       | Partial | Validate railings/guards on terraces, stairs, and balconies. | Exposed edges above threshold height require guardrail/railing or explicit approved exception; rails must align to supported edges.                   |
| `BIR-E04` | P1       | Partial | Validate stair comfort and headroom.                         | Existing stair checks are wired into Advisor parity and phase acceptance; by-sketch stairs include riser/tread/headroom/landing checks.               |
| `BIR-E05` | P1       | Partial | Validate vertical circulation graph.                         | Multi-level models know which stairs connect which levels, which rooms are reachable, and which slab openings/guards belong to that circulation path. |
| `BIR-E06` | P1       | Partial | Validate terrace/loggia floors as occupied exterior spaces.  | A terrace/loggia is a real floor/space with guard, drainage/slope metadata, access, boundary, and schedule/area intent.                               |
| `BIR-E07` | P2       | Partial | Add railing family/profile integrity.                        | Railing posts, handrails, balusters, height, spacing, material, and host references are validated and renderable.                                     |

### F. Roofs, Envelope, Terraces, Loggias, And Facades

| ID        | Priority | Status  | Item                                                              | Acceptance                                                                                                                                                     |
| --------- | -------- | ------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-F01` | P0       | Partial | Validate roof openings against host footprint.                    | Existing roof-opening host/footprint checks remain, with stricter hole-inside-host and large-void metadata requirements for occupied terraces.                 |
| `BIR-F02` | P0       | Partial | Validate roof opening has real occupied void geometry.            | Roof terrace/court openings require rendered cut, floor surface, return/curb/parapet faces, drainage/guard/support metadata, and evidence viewpoint.           |
| `BIR-F03` | P0       | Partial | Validate envelope closure.                                        | Exterior walls, roofs, floors, and major openings form a coherent envelope per level; unresolved holes/gaps are reported.                                      |
| `BIR-F04` | P1       | Partial | Validate loggia/recessed facade topology.                         | Recessed loggias have side returns, top/bottom returns, railing/guard, access opening, and physical floor/ceiling relationships.                               |
| `BIR-F05` | P1       | Partial | Validate facade opening rhythm without treating it as subjective. | When a model declares facade rhythm metadata, openings must map to declared bays/counts; absent metadata avoids normal-Advisor aesthetic judgments.            |
| `BIR-F06` | P1       | Partial | Validate wall/roof attachment and overhang semantics.             | Wall tops and roof eaves/ridges have explicit relation where required; floating roof/wrapper slabs or walls are errors unless declared as detached study mass. |
| `BIR-F07` | P2       | Partial | Add thermal/fire/acoustic envelope metadata checks.               | Profiles can require wall/roof/slab type layers and performance placeholders appropriate to project phase.                                                     |

### G. Structure-Lite, MEP-Lite, Fire, Accessibility, And Code Profiles

| ID        | Priority | Status  | Item                                                | Acceptance                                                                                                                                              |
| --------- | -------- | ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-G01` | P0       | Partial | Clarify constructability vs structural engineering. | `structureMepLiteIntegrity_v1` declares deterministic structure-lite/MEP-lite scope and a non-certified engineering disclaimer; domain findings carry tracker ids, severity, recommendation, and normalized output. Remaining: mirror this disclaimer everywhere in product UI. |
| `BIR-G02` | P1       | Partial | Expand load path checks.                            | Load-bearing walls, beams, columns, stacked supports, transfer assumptions, support references, load-path role/direction metadata, and large openings have deterministic findings and metadata resolutions. Remaining: richer structural geometry/capacity is explicitly out of scope. |
| `BIR-G03` | P1       | Partial | Expand MEP penetration checks.                      | Pipe/duct/cable-tray/route penetrations through walls/slabs/ceilings/roofs require resolved opening/sleeve metadata, and MEP opening requests require host, route/system, and size metadata. Remaining: clash-derived opening creation stays future authoring work. |
| `BIR-G04` | P1       | Partial | Add wet-room and service-zone coordination.         | Wet rooms, risers, shafts, equipment zones, and MEP route placeholders are checked for stacking, service ties, endpoint metadata, and maintenance/access metadata. Remaining: route geometry optimization is not attempted. |
| `BIR-G05` | P1       | Partial | Add fire-safety profile gates.                      | Profile-controlled fire findings cover ratings, exit-door width/swing/landing metadata, protected stair and compartment placeholders, and firestop metadata for MEP routes through rated hosts. Remaining: authority-specific calculations stay external. |
| `BIR-G06` | P1       | Partial | Add accessibility profile gates.                    | Profile-controlled accessibility findings cover thresholds, door widths, door maneuvering/swing metadata, circulation widths, route continuity/connectivity metadata, and sanitary turning zones. Remaining: full route graph pathfinding remains future work. |
| `BIR-G07` | P2       | Partial | Add regional code package metadata.                 | Rules declare locale/profile, source basis, severity, tracker id, and advisory/enforced basis in code-profile and normalized domain output. Remaining: complete regional package catalogs are not bundled yet. |

### H. Advisor UX, CLI, MCP/API, And Agent Usability

| ID        | Priority | Status      | Item                                              | Acceptance                                                                                                                                       |
| --------- | -------- | ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BIR-H01` | P0       | Partial     | Advisor findings must be actionable from UI.      | Each finding displays affected elements, open/isolate actions, context view suggestion, quick-fix summary where safe, and exact reason.          |
| `BIR-H02` | P0       | Partial     | Advisor findings must be actionable from CLI/MCP. | CLI/API payloads include same ids, rule metadata, severity, recommendation, fix hints, and profile/perspective filters.                          |
| `BIR-H03` | P0       | Done        | Add integrity preflight command.                  | `qa integrity` or equivalent reports P0 model-integrity checks independent of constructability profile.                                          |
| `BIR-H04` | P0       | Partial     | Add agent-friendly remediation loop.              | CLI/MCP can list findings, propose safe correction bundles, dry-run fixes, commit accepted fixes, and recapture evidence.                        |
| `BIR-H05` | P1       | Partial     | Add findings-to-viewpoint bridge.                 | Findings include or can resolve saved camera/plan/context views focused on affected elements.                                                    |
| `BIR-H06` | P1       | Done        | Add batch/performance diagnostics.                | Advisor reports rule timing, affected-element count, skipped/unsupported checks, and incremental eligibility.                                    |
| `BIR-H07` | P1       | Done        | Add multi-profile comparison.                     | Agents can compare default, construction_readiness, fire, accessibility, structure, MEP, and exchange profiles without manually merging outputs. |

### I. Renderer Diagnostic Contract

| ID        | Priority | Status  | Item                                                   | Acceptance                                                                                                                                           |
| --------- | -------- | ------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-I01` | P0       | Done    | Create renderer support matrix.                        | `spec/generated/renderer-support-matrix.md` lists every element kind and feature against 3D viewport, plan, sheet, export, and known limitations.    |
| `BIR-I02` | P0       | Partial | Emit renderer diagnostics for unsupported cuts.        | Failed/unsupported roof, wall, slab, dormer, stair, railing, or boolean/cut paths create structured diagnostics visible to UI and CLI evidence.      |
| `BIR-I03` | P0       | Partial | No silent fallback for target-house-critical features. | Roof terrace cutout, wall door/window cuts, slab openings, loggia recesses, rails, stairs, and floors either render or produce blocking diagnostics. |
| `BIR-I04` | P0       | Partial | Connect renderer diagnostics to sketch acceptance.     | Sketch-to-BIM phase/final packets fail when renderer diagnostics affect required visual features.                                                    |
| `BIR-I05` | P1       | Partial | Add per-element render status.                         | Selecting an element can show render implementation, skipped subfeatures, material fallback, proxy fallback, and export support.                     |
| `BIR-I06` | P1       | Partial | Add renderer diagnostic persistence.                   | Diagnostics are captured in evidence packages with git head, model revision, view id, renderer build, and affected element ids.                      |
| `BIR-I07` | P1       | Partial | Separate renderer issue from model issue.              | UI distinguishes "model invalid" from "model valid but viewport unsupported/failed to render this feature."                                          |

### J. Renderer Element Fidelity And Golden Tests

| ID        | Priority | Status      | Item                                | Acceptance                                                                                                                                                                                                                                                                                                                                |
| --------- | -------- | ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-J01` | P0       | Partial     | Wall geometry and hosted wall cuts. | Doors, windows, and wall openings cut/host correctly across wall orientations, thicknesses, joins, materials, and lens modes; tests cover CSG and fallback.                                                                                                                                                                               |
| `BIR-J02` | P0       | Partial     | Roof geometry and roof openings.    | Flat, gable, asymmetric gable, hip-like, terrace/court openings, dormers, returns, fascia, and material strips render correctly or diagnose unsupported cases.                                                                                                                                                                            |
| `BIR-J03` | P0       | Partial     | Floor/slab geometry and openings.   | Slabs, terraces, balconies, floor openings, shafts, and stair penetrations render with correct z, thickness, material, and voids.                                                                                                                                                                                                         |
| `BIR-J04` | P0       | Partial     | Stairs and railings.                | Stairs, landings, runs, treads, risers, rails, guards, balusters, and hosted/edge relationships render in architecture and structure lenses.                                                                                                                                                                                              |
| `BIR-J05` | P1       | Partial     | Doors/windows/families.             | Families render with actual dimensions, operation/swing/sliding direction where meaningful, frame/panel/material slots, and correct host offsets.                                                                                                                                                                                         |
| `BIR-J06` | P1       | Partial     | Rooms/spaces visual diagnostics.    | Room volumes/areas, boundaries, names, and diagnostic overlays render coherently without becoming physical clutter.                                                                                                                                                                                                                       |
| `BIR-J07` | P1       | Partial     | Materials and appearances.          | Material assignments, type layer intent, transparent/realistic/wire modes, cut/finish faces, and high-fidelity mode are consistent.                                                                                                                                                                                                       |
| `BIR-J08` | P1       | Partial     | Lens/filter rendering parity.       | Architecture, Structure, Systems, MEP, Massing/Site, and Documentation lenses show/hide/ghost categories predictably and preserve diagnostics.                                                                                                                                                                                            |
| `BIR-J09` | P1       | Partial     | Visual golden harness.              | Playwright/canvas pixel tests cover nonblank, framing, critical feature presence, and no flying/unsupported proxies for representative seeds.                                                                                                                                                                                             |
| `BIR-J10` | P2       | Partial     | Stress and large-model rendering.   | Pure renderer stress-budget helpers now count large element sets, hosted openings, linked models/expanded linked elements, and evidence views, emitting structured `renderer-performance` diagnostics when thresholds are near or exceeded. Remaining: wire diagnostics into live viewport/evidence capture and broaden benchmark models. |

### K. IFC, glTF, Schedules, Sheets, And Exchange Fidelity

| ID        | Priority | Status  | Item                                               | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | -------- | ------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-K01` | P0       | Partial | Export manifests must reveal unsupported geometry. | IFC/glTF manifests embed `exportGeometryUnsupportedSkipped_v1` with unsupported/skipped geometry feature rows, reason codes, counts, and affected ids via `app/bim_ai/export_feature_contract.py`; PDF/schedule evidence still needs the same treatment.                                                                                                                                                                                                               |
| `BIR-K02` | P0       | Partial | Add export-readback geometry checks.               | IFC inspector now emits `geometryReadbackSummary_v0`, comparing source topology to IFC identity/body/QTO/readback counts for supported walls, floors, roofs, doors, windows, stairs, railings, rooms/spaces, and hosted openings. glTF artifacts embed `gltfJsonReadbackFidelity_v1`, re-reading the emitted JSON manifest/mesh/node/accessor contract and flagging drift. Tests: `pytest app/tests/test_export_ifc_readback.py app/tests/test_export_ifc.py::test_ifc_inspection_matrix_covers_storeys_spaces_qtos_and_programme_fields app/tests/test_export_gltf.py::test_document_to_gltf_embeds_json_readback_fidelity_evidence app/tests/test_export_gltf.py::test_gltf_json_readback_fidelity_detects_mesh_node_drift --no-cov`. Remaining: broaden drift tolerances and binary/import parity. |
| `BIR-K03` | P0       | Partial | Align renderer and export feature contracts.       | IFC/glTF manifests embed `exportFeatureSupportMatrix_v1` and `rendererExportContractDrift_v1`, identifying viewport-vs-export support drift such as roof openings, railings, placed assets, and family instances.                                                                                                                                                                                                                                                      |
| `BIR-K04` | P1       | Partial | IFC semantic mapping completeness.                 | IFC semantic scope and inspector cover walls, floors, roofs, doors, windows, stairs, rails, rooms/spaces plus type/material/classification/quantity/property-set readback aggregates via `geometryReadbackSummary_v0`, `materialLayerSetReadback_v0`, and property-set coverage evidence. Remaining: expand beyond current kernel-exportable subset.                                                                                                                   |
| `BIR-K05` | P1       | Partial | Schedule integrity.                                | Room, door/window, material/quantity, and documentation schedules match model elements and export evidence; `scheduleSheetExchangeEvidence_v1` now exposes missing model rows, unsupported schedule categories/rows, and stale schedule evidence digests.                                                                                                                                                                                                              |
| `BIR-K06` | P1       | Partial | Sheet/view evidence.                               | Saved views, sheets, viewports, scales, render bundles, and PDF-like exports are linked to model/evidence packets; `scheduleSheetExchangeEvidence_v1` now checks sheet evidence rows, viewport refs, viewport scales, render-bundle summaries, and stale revision/digest links.                                                                                                                                                                                        |
| `BIR-K07` | P2       | Partial | IDS/BIR validation packs.                          | `packages/cli/lib/bim-requirement-validation-pack.mjs` deterministically compiles simple sketch/BIR information requirements into delivery-target checks and evidence blockers, and `sketch.exchange-validation.v1` now carries the compiled pack/report. Tests: `packages/cli/bimRequirementValidationPack.test.mjs`. Remaining: broader IDS schema import and backend Advisor/API parity.                                                                            |

### L. Performance, Responsiveness, And Live Stability

| ID        | Priority | Status  | Item                                | Acceptance                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | -------- | ------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-L01` | P0       | Partial | Profile Advisor performance.        | Constructability reports now include `advisorDiagnosticsProfile_v1` with deterministic ordered timing rows for Advisor evaluate, constructability clearance/metadata, model-integrity, and domain-integrity checks. Evidence: `app/bim_ai/advisor_profiling.py`, `app/bim_ai/constructability_report.py`, `app/tests/test_advisor_profiling_incremental.py`.                       |
| `BIR-L02` | P0       | Partial | Profile renderer update cost.       | Pure renderer cost profiling now estimates orbit, select, lens-switch, Advisor toggle, and update workloads with budgets, dominant factors, and budget diagnostics. W17-E adds `liveResponsivenessRequirement` to target-house performance evidence and final-package blockers for missing/failed archived live browser timing samples. Remaining: collect and archive accepted real browser timing samples from target-house and benchmark models. |
| `BIR-L03` | P0       | Partial | Investigate WebSocket proxy errors. | W6-C classifies Vite proxy `EPIPE`/`ECONNRESET` as benign dev reconnect/browser teardown noise, keeps unexpected proxy errors actionable, and covers app reconnect/backoff/state-churn decisions in `packages/web/src/lib/wsStability.test.ts`. W17-E final-package readiness now reports `live_responsiveness_*` blockers for missing/failed interaction rows or actionable WebSocket churn. Remaining: wire helper into dirty WebSocket consumers/proxy config once parallel edits settle and verify live dev-server behavior. |
| `BIR-L04` | P1       | Partial | Incremental diagnostics.            | Added pure `advisorIncrementalDiagnosticEligibility_v1` helper that derives changed ids, one-hop reference impact, constructability broad-phase pair impact, and per-layer incremental eligibility for Advisor/integrity/domain/render diagnostic consumers. Evidence: `app/bim_ai/constructability_performance.py`, `app/tests/test_advisor_profiling_incremental.py`.            |
| `BIR-L05` | P1       | Partial | Background heavy checks.            | Expensive geometry/export/render checks run as jobs with progress, cancellation, and cached evidence.                                                                                                                                                                                                                                                                              |
| `BIR-L06` | P1       | Partial | UI degradation safeguards.          | Pure `diagnosticUiSchedulingPolicy_v1` helpers now force Advisor and renderer diagnostics onto idle/debounced/deferred/manual-only paths, cap diagnostic overlays with `pointerEvents: none`, and preserve pointer events, camera controls, and selection on ordinary models. Remaining: wire the policy into all live diagnostic producers.                                       |

### M. Sketch-to-BIM Methodology Gate

| ID        | Priority | Status      | Item                                                         | Acceptance                                                                                                                                                                                                 |
| --------- | -------- | ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-M01` | P0       | Partial     | Rename/specify sketch fidelity gate separately from Advisor. | Methodology docs and helper output call this `sketch acceptance`, `brief acceptance`, or equivalent, never normal Advisor.                                                                                 |
| `BIR-M02` | P0       | Partial     | Enforce current phase evidence.                              | Phase packet requires current git head, model revision, Advisor digest, renderer diagnostic digest, IR hash, capability hash, and screenshot manifest.                                                     |
| `BIR-M03` | P0       | Partial     | Require semantic visual checklist for critical features.     | Agent must explicitly pass/fail feature-specific checks for silhouette, roof cutout, terrace/loggia, facade rhythm, cladding, rooms, stairs, and diagnostics.                                              |
| `BIR-M04` | P0       | Partial     | Add renderer diagnostics to phase acceptance.                | Phase/final acceptance blocks if required visual features have renderer unsupported/failed diagnostics.                                                                                                    |
| `BIR-M05` | P0       | Partial     | Add BIM integrity diagnostics to phase acceptance.           | Phase/final acceptance blocks on P0 model-integrity errors even if normal constructability warnings are zero.                                                                                              |
| `BIR-M06` | P0       | Done        | Add target-house-specific acceptance pack.                   | Target-house checklist compiles into machine-readable required features, views, tolerances, and evidence rows.                                                                                             |
| `BIR-M07` | P1       | Partial     | Add visual readout drift loop.                               | Agent must compare latest screenshots with previous phase and source sketch, record corrections, and cannot advance on unresolved drift.                                                                   |
| `BIR-M08` | P1       | Partial     | Add methodology failure taxonomy.                            | Initial taxonomy added in `spec/sketch-to-bim-failure-taxonomy.md`; phase packets classify failures as model-integrity, renderer, sketch-fidelity, command-surface, evidence-staleness, or user-tolerance. |
| `BIR-M09` | P1       | Partial     | Add seed artifact cleanliness gates.                         | Seed library contains only approved artifacts; disposable wave artifacts cannot leak into committed seed list.                                                                                             |
| `BIR-M10` | P1       | Partial     | Add agent prompt/workflow templates.                         | `spec/sketch-to-bim-agent-workflow-templates.md` now gives standard worker prompts, evidence gates, and wave closeout template requiring integrity, renderer, Advisor, evidence, freshness, benchmark, drift, and acceptance checks. Remaining: wire templates into every agent-launch surface. |

### N. Target-House-1 Specific Closure

| ID        | Priority | Status  | Item                                                 | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | -------- | ------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-N01` | P0       | Done    | Diagnose current target-house geometry objectively.  | Deterministic `target-house-current-geometry-diagnostic.v1` report now lists detached/flying elements, out-of-envelope elements, helper leakage, unsupported/unproven renderer features, and sketch-critical mismatches for current `target-house-1`. Evidence: `packages/cli/lib/target-house-geometry-diagnostics.mjs`, `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json`, `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.md`, `packages/cli/targetHouseGeometryDiagnostics.test.mjs`. |
| `BIR-N02` | P0       | Done    | Fix seed source, not only live state.                | Wave 8/9/11/12 corrected `seed-artifacts/target-house-1/evidence/target-house-1.recipe.json` and the authoritative `bundle.json`, then refreshed deterministic offline evidence from that bundle. Current evidence is fresh, the manifest bundle SHA matches the authoritative bundle, Advisor/constructability is clean, and `target-house-geometry-diagnostic.json` reports zero geometry findings.                                                                                                                          |
| `BIR-N03` | P0       | Done    | Remove stale/disposable artifacts from seed library. | Seed dropdown now consumes only the canonical seed-library project from `/api/bootstrap`, `make seed name=target-house-1` rebuilds that deterministic project with approved artifacts only, and seed loading purges known disposable local evidence project rows without touching ordinary projects. Evidence: `app/bim_ai/seed_library.py`, `app/scripts/seed.py`, `app/bim_ai/routes_api.py`, `packages/web/src/workspace/useWorkspaceSnapshot.ts`, `app/tests/test_seed_artifact_roundtrip.py::test_seed_purge_removes_disposable_local_evidence_projects`, `app/tests/test_bootstrap_seed_library.py::test_bootstrap_marks_only_canonical_seed_project_as_seed_library`, `packages/web/src/workspace/useWorkspaceSnapshot.test.ts`. |
| `BIR-N04` | P0       | Done    | Require no P0 Advisor/integrity/renderer findings.   | Deterministic clean-pass gate passes for freshly regenerated offline evidence from the authoritative seed bundle: zero P0 Advisor/integrity errors, zero constructability warnings, zero renderer blockers, and zero tolerance rows. Final-package readiness also consumes the target-house geometry diagnostic, which now reports zero detached/flying/out-of-envelope/helper/unsupported-renderer findings, so a clean normal Advisor can no longer hide those target-house blockers.                                                  |
| `BIR-N05` | P0       | Done    | Verify model visual from required views.             | Machine-readable validator now requires main, front, rear/right, roof court, loggia, ground plan, upper plan, and wire diagnostics saved-view/screenshot evidence. Current refreshed evidence passes 8/8 visual rows, including `front_loggia`, in `target-house-evidence-acceptance.json`.                                                                                                                                                                                                                         |
| `BIR-N06` | P1       | Done    | Verify BIM data quality.                             | Deterministic target-house evidence validator checks rooms, schedules, types/materials, classifications, levels, spaces, stairs, rails, doors/windows, and required export manifest rows; refreshed data-quality rows pass 7/7.                                                                                                                                                                                                                                                                                     |
| `BIR-N07` | P1       | Partial | Verify performance on target-house.                  | Deterministic target-house performance evidence now profiles orbit, selection, lens switching, and Advisor opening from the final seed snapshot with renderer-cost budgets, plus a machine-readable live-responsiveness requirement for orbit, select, lens-switch, Advisor open, Advisor close, and WebSocket churn. Final package readiness now blocks on missing/failed archived live responsiveness evidence. Remaining closeout requires an accepted archived browser run.                                                                                                                                       |
| `BIR-N08` | P0       | Done    | Require zero target-house geometry diagnostic errors. | `target-house-geometry-diagnostic.json` reports zero detached/flying elements, zero helper leakage into physical views, zero out-of-envelope elements, zero unsupported target-house-critical renderer features, and zero sketch-critical mismatches from the authoritative bundle. The source fix restores analytical room separations/slab openings where valid, teaches the diagnostic to classify them correctly, and keeps physical/helper/renderer blockers at zero.                                                   |
| `BIR-N09` | P0       | Done    | Require semantic visual checklist disposition.        | `acceptance-gates.json` has `semanticVisualFailureCount=0`, no unchecked required semantic visual rows, and 305/305 required semantic visual rows accepted by evidence or explicit disposition. Final package acceptance gates are now clean; remaining final-package blocker is tracker completion only.                                                                                                                                                                                                            |
| `BIR-N10` | P0       | Partial | Require final package readiness.                     | `node scripts/target-house-final-package.mjs --seed target-house-1` produces a manifest with fresh evidence, clean deterministic performance evidence, clean clean-pass gate, clean geometry diagnostic, clean acceptance gates, explicit live-responsiveness status, an acceptance rehearsal gate, and whole-tracker completion summary. It remains Partial because `--require-ready` blocks on `live_responsiveness_missing`, `acceptance_rehearsal_gate`, `tracker_not_done`, and `tracker_incomplete` until archived live evidence and the exhaustive BIM integrity tracker are complete.                                                                                                                                   |
| `BIR-N11` | P1       | Partial | Add live browser responsiveness acceptance.           | W13-A adds a machine-readable `target-house-live-browser-evidence.v1` proof hook that drives the live browser for orbit, selection, lens switch, Advisor open/close, records WebSocket/proxy churn, and validates the result against `target-house-live-responsiveness.v1`. CI can validate supplied evidence/proxy logs without launching a browser. A real accepted target-house dev-server/browser artifact is still required before this can be marked Done.                                                                                                   |
| `BIR-N12` | P1       | Done | Add human-readable target-house closeout report.      | `target-house-closeout-report.v1` now ties source sketch features, required BIM target selectors, saved views/screenshots, Advisor/constructability, geometry diagnostic, renderer/visual evidence, exchange/data-quality, performance evidence, tolerances, lineage digests, and final blockers into one deterministic review artifact. Evidence: `scripts/target-house-closeout-report.mjs`, `scripts/target-house-closeout-report.test.mjs`, `seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-report.md`, `seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-lineage.json`. |

### O. Tests, Fixtures, CI, And Benchmarks

| ID        | Priority | Status      | Item                                          | Acceptance                                                                                                                                         |
| --------- | -------- | ----------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-O01` | P0       | Partial     | Add fixture corpus for model-integrity rules. | Positive and negative fixtures cover every P0 integrity rule with expected rule ids and affected elements. Current corpus covers representative P0 hosting, room-containment, and roof-cut cases; every P0 rule is not yet covered. |
| `BIR-O02` | P0       | Partial     | Add target-house regression fixture.          | The known detached-door/access-wall and roof-cut cases fail before fixes and pass after. Reduced target-house regression cases now cover detached access-wall/access-door, roof cut outside/inside host footprint, and building/toposolid/site footprints that are centroid-clean but partially off host terrain. |
| `BIR-O03` | P0       | Partial     | Add renderer golden fixture corpus.           | Minimal scenes for roof openings, wall cuts, slab openings, stairs/rails, loggia/terrace, and helper leakage are tested.                           |
| `BIR-O04` | P1       | Partial | Add end-to-end acceptance rehearsal.          | Disposable/no-seed rehearsal project rows are now a recognized non-seed class and cannot leak into the seed picker after clean seed. W17-E adds a deterministic target-house final-package rehearsal gate that fails stale evidence, missing required artifacts, clean-pass/geometry failures, visual acceptance failures, tolerance blockers, deterministic performance failures, and missing/failed live responsiveness evidence. Remaining: run an actual end-to-end rehearsal that exercises integrity, renderer diagnostics, Advisor, evidence, and sketch acceptance without committing artifacts. |
| `BIR-O05` | P1       | Partial | Add benchmark suite integration.              | `spec/benchmarks/suite.json` and core scenario specs now require benchmark rows for integrity, renderer diagnostics, exchange, performance, and acceptance status. Remaining: collect broader live-browser benchmark evidence for every professional benchmark. |
| `BIR-O06` | P1       | Partial | Add CI gates for rule/render docs drift.      | CI now runs tracker generated-status drift, benchmark suite validation, and renderer support matrix drift tests; Advisor rule ledger drift remains covered by Python tests. Remaining: consolidate all generated docs into one dedicated governance job. |

### P. Kernel Invariants, Units, Types, And Document Semantics

| ID        | Priority | Status  | Item                                         | Acceptance                                                                                                                                                                                                                                                                                                                     |
| --------- | -------- | ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BIR-P01` | P0       | Partial | Define document invariant contract.          | `modelIntegrityInvariantContract_v1` now states role/kind classification including analytical/imported proxies, root and nested reference fields, level/storey semantic policy, unit and coordinate contracts, type-instance relations, schema compatibility policy, and tracked P01-P08 coverage. Evidence: `app/bim_ai/model_integrity.py`, `app/tests/test_model_integrity_invariants.py`. |
| `BIR-P02` | P0       | Partial | Validate all element references.             | Root and nested `levelId`, host id, type id, material key/id, view id, schedule id, sheet id, phase id, design option id/locks, and linked-model refs are checked for resolvability and kind compatibility when their target namespace exists. Evidence: `app/tests/test_model_integrity_invariants.py::test_broad_reference_fields_and_nested_refs_are_checked`.                         |
| `BIR-P03` | P0       | Partial | Validate units and coordinate normalization. | Added deterministic `modelIntegrityUnitsCoordinateNormalization_v1` checks for project length units, normalized `{xMm,yMm}` point/list fields, and finite millimeter scalar fields. Evidence: `app/bim_ai/model_integrity.py`, `app/tests/test_model_integrity_invariants.py`.                                                 |
| `BIR-P04` | P0       | Partial | Validate level/storey semantics.             | Physical and analytical room elements now validate required level references, parent-level elevation offsets, base/top level ordering, positive physical heights, and explicit hosted-opening/host-wall level mismatches. Evidence: `app/tests/test_model_integrity_invariants.py::test_storey_spans_parent_levels_and_host_level_mismatch_are_checked`.                                           |
| `BIR-P05` | P0       | Partial | Validate physical vs analytical roles.       | Role classification now separates physical, analytical rooms, helper, annotation, documentation, type/project datum, imported proxy, issue/configuration, and presentation kinds; explicit role checks report physical-to-nonphysical and nonphysical-to-physical leakage. Evidence: `app/tests/test_model_integrity_invariants.py::test_physical_helper_role_mismatch_and_missing_explicit_role_are_reported`. |
| `BIR-P06` | P1       | Partial | Validate type-instance inheritance.          | Added deterministic type-instance relation checks and `modelIntegrityTypeInstanceInheritance_v1` resolution evidence for wall/floor/roof/family type references, assembly thickness, family parameters, and instance override keys. Evidence: `app/bim_ai/model_integrity.py`, `app/tests/test_model_integrity_invariants.py`. |
| `BIR-P07` | P1       | Partial | Validate schema migration compatibility.     | Added `modelIntegritySchemaMigrationCompatibility_v1` diagnostics for unsupported schema versions with actionable migration guidance; missing schema versions remain accepted for current in-memory snapshots. Evidence: `app/bim_ai/model_integrity.py`, `app/tests/test_model_integrity_invariants.py`.                      |
| `BIR-P08` | P1       | Partial | Add invariant smoke command.                 | `modelIntegritySmokeCommandEvidence_v1` now bundles smoke findings, strict-role smoke, role counts, reference/level coverage metadata, units/coordinate normalization, type-instance resolution, schema compatibility, a stable digest, and CLI/API command evidence. Evidence: `app/tests/test_model_integrity_invariants.py::test_smoke_payload_and_contract_are_machine_readable`.          |

### Q. Transactions, Collaboration, Undo/Redo, And Agent Safety

| ID        | Priority | Status  | Item                                     | Acceptance                                                                                                                                                                                                                                                           |
| --------- | -------- | ------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-Q01` | P0       | Partial | Protect transaction boundaries.          | `transactionSafety_v1` checks require parent revisions and `transactionPreflightAudit_v1` now records deterministic pre-mutation gate evidence on CMD-v3 and raw command/bundle dry-run/commit surfaces. Evidence: `app/bim_ai/transaction_safety.py`, `app/bim_ai/routes_api.py`, `app/bim_ai/routes_commands.py`, `app/tests/test_transaction_safety.py`. |
| `BIR-Q02` | P0       | Partial | Preserve undo/redo semantics.            | Added `undoRedoContract_v1` validation for inspectable forward/inverse commands and `undoRedoIntegrityMetadata_v1` preservation of transaction safety, dry-run evidence, and source-command links through undo/redo route metadata. Evidence: `app/bim_ai/transaction_safety.py`, `app/bim_ai/routes_commands.py`, `app/tests/test_transaction_safety.py`. |
| `BIR-Q03` | P0       | Partial | Add collaboration conflict safety.       | Stale parent revisions now have deterministic `revision_conflict` decisions with current/parent revision, retry-safe flag, rebase guidance, and optional `parentRevision` conflict detection on legacy raw command/bundle routes. Evidence: `app/bim_ai/transaction_safety.py`, `app/bim_ai/routes_api.py`, `app/bim_ai/routes_commands.py`, `app/tests/test_transaction_safety.py`. |
| `BIR-Q04` | P0       | Partial | Classify safe vs destructive auto-fixes. | Added deterministic fix classification for `safe_automatic`, `review_required`, `destructive`, and `needs_user_intent` remediation proposals. Evidence: `app/bim_ai/transaction_safety.py`, `app/tests/test_transaction_safety.py`.                                  |
| `BIR-Q05` | P0       | Partial | Require dry-run for agent remediation.   | Agent/MCP commit safety now blocks without successful dry-run evidence matching the current parent revision and exact command digest; remediation dry-run responses include explicit CMD-v3 commit requests and no silent mutation path. Evidence: `app/bim_ai/transaction_safety.py`, `app/bim_ai/routes_api.py`, `app/bim_ai/routes_commands.py`, `app/bim_ai/routes_integrity.py`, `app/tests/test_transaction_safety.py`, `app/tests/test_integrity_preflight.py`. |
| `BIR-Q06` | P1       | Partial | Add audit provenance for fixes.          | Added `agentRemediationProposal_v1` provenance rows plus `transactionPreflightAudit_v1`; integrity preflight findings can carry source authoring command refs, recipe rows, agent wave, and commit metadata from command-log transactions. Evidence: `app/bim_ai/transaction_safety.py`, `app/bim_ai/integrity_preflight.py`, `app/bim_ai/routes_integrity.py`, `app/tests/test_transaction_safety.py`, `app/tests/test_integrity_preflight.py`. |
| `BIR-Q07` | P1       | Partial | Add permission/scope metadata.           | Permission-scope inference for mutation, export, external-service, and destructive command bundles is included in transaction safety payloads so API/MCP clients can request explicit approval. Evidence: `app/bim_ai/transaction_safety.py`, `app/bim_ai/routes_api.py`, `app/bim_ai/routes_commands.py`, `app/tests/test_transaction_safety.py`. |
| `BIR-Q08` | P1       | Partial | Add rollback/retry guidance.             | Failed safety decisions now return unchanged-model rollback guidance and retry instructions for stale revision, stale dry-run, digest mismatch, and failed dry-run paths. Evidence: `app/bim_ai/transaction_safety.py`, `app/tests/test_transaction_safety.py`.      |

### R. 2D Documentation, Sections, Plans, Elevations, And View Fidelity

| ID        | Priority | Status  | Item                                     | Acceptance                                                                                                                                                   |
| --------- | -------- | ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BIR-R01` | P0       | Partial | Add plan-view fidelity contract.         | Walls, doors, windows, rooms, stairs, slab openings, railings, levels, annotations, and hidden/cut graphics render correctly in plan or produce diagnostics. |
| `BIR-R02` | P0       | Partial | Add section/elevation fidelity contract. | Cut planes, view depth, section boxes, hidden lines, openings, stairs, roofs, floors, and materials render consistently with the 3D model.                   |
| `BIR-R03` | P1       | Partial | Add sheet viewport fidelity.             | Sheet viewports preserve view scale, crop, discipline/lens, graphics mode, title, schedule placement, and evidence links.                                    |
| `BIR-R04` | P1       | Partial | Add annotation/dimension integrity.      | Tags, dimensions, levels, grids, callouts, detail regions, and schedules reference live elements and report stale/orphan state.                              |
| `BIR-R05` | P1       | Partial | Add documentation export parity.         | PDF/render bundles/sheets match the corresponding saved views, with unsupported features listed in export evidence.                                          |
| `BIR-R06` | P1       | Partial | Add 2D golden fixtures.                  | Plan, section, elevation, and sheet goldens cover hosted openings, roof cuts, stairs, rooms, annotations, and lens modes.                                    |

W15-C evidence, 2026-05-19: `packages/web/src/workspace/sheets/documentationFidelityContracts.ts`
now accepts structured machine-readable diagnostics across `BIR-R01` through
`BIR-R06`, preserving legacy string diagnostics while separating
`model_invalidity` from renderer unsupported geometry, renderer dropped visual
geometry, export unsupported features, export dropped visual geometry, and
missing evidence. Focused coverage in
`packages/web/src/workspace/sheets/documentationFidelityContracts.test.ts`
exercises hosted-opening plan diagnostics, section/elevation model-invalid
evidence, sheet viewport metadata/evidence links, stale annotation/dimension
references, export digest parity with unsupported vs dropped-geometry causes,
and reusable 2D golden fixture readiness for plan/section/elevation/sheet
surfaces. Status remains `Partial`: these contracts are deterministic and
barrel-exported for agents, but full product UI/CLI/API parity wiring and
fresh end-to-end screenshot regeneration are still outside this worker slice.

### S. Site, Georeferencing, Links, Imports, And Roundtrip

| ID        | Priority | Status  | Item                                           | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | -------- | ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-S01` | P0       | Partial | Validate project/site coordinate systems.      | `siteGeoreferencingIntegrityReport_v1` now emits deterministic project coordinate-system summaries/findings for project base point, survey point, internal origin, true north, georeference presence, and level datum exportability; domain-integrity rows preserve site tracker IDs, code, discipline, perspective, and blocking metadata. Evidence: `app/tests/test_site_georeferencing_integrity.py::test_missing_level_datum_is_blocking_domain_finding`. |
| `BIR-S02` | P0       | Partial | Validate linked model transforms.              | Link/import transform diagnostics now check `link_model`, `link_dxf`, and `link_external` rows for origin alignment mode, explicit translation/origin transform, rotation, units, source metadata, stale/unloaded state, missing host base/survey anchors, and expected-vs-actual transform drift. Evidence: `app/tests/test_site_georeferencing_integrity.py::test_stale_unloaded_links_and_transform_drift_are_reported`. |
| `BIR-S03` | P1       | Partial | Add import diagnostic contract.                | `importDiagnosticContract_v1` normalizes unsupported products, lost geometry, category mapping fallback, transform drift, material/type fallback, and unit normalization with deterministic severity/category counts, `ok`/blocking state, tracker tags, and unsupported mapping evidence. Evidence: `app/tests/test_site_georeferencing_integrity.py::test_import_diagnostic_contract_preserves_unsupported_mapping_evidence`. |
| `BIR-S04` | P1       | Partial | Add roundtrip drift checks.                    | `roundtripDriftReport_v1` now emits machine-readable drift rows with schema version, severity, tracker IDs, discipline/perspective metadata for source/readback count, placement, category, type, material, and geometry point-count drift; link expected-vs-actual transform drift also tags BIR-S04. Evidence: `app/tests/test_site_georeferencing_integrity.py::test_roundtrip_drift_report_detects_counts_placement_category_and_material`. |
| `BIR-S05` | P1       | Partial | Validate site/toposolid/building relationship. | Site relationship diagnostics now flag missing site/toposolid rows, invalid wall/building toposolid hosts, degenerate toposolid boundaries, invalid toposolid `siteId`, centroid-outside and partially-outside toposolids/site boundaries, building footprints partially outside referenced/all toposolids, and property-line closure errors. Evidence: `app/tests/test_site_georeferencing_integrity.py::test_invalid_site_toposolid_relationships_are_blocking`, `app/tests/test_site_georeferencing_integrity.py::test_site_relationship_diagnostics_catch_partial_topology_misplacement`. |
| `BIR-S06` | P2       | Partial | Add multi-building/shared-coordinate support.  | Multi-building/shared-coordinate summary and diagnostics now group building elements by `props.buildingId`, report survey-point availability, shared-coordinate links, and warn when multi-building projects lack shared-coordinate anchors. Evidence: `app/tests/test_site_georeferencing_integrity.py::test_multi_building_shared_coordinate_support_reports_missing_anchor`.                                                 |

### T. Provenance, Traceability, And Evidence Lineage

| ID        | Priority | Status  | Item                                       | Acceptance                                                                                                                                              |
| --------- | -------- | ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-T01` | P0       | Partial | Map sketch features to BIM elements.       | Required feature pack and closeout dashboard preserve stable feature ids, source refs, phases, evidence views, acceptance status, and explicit/selector element coverage. Remaining: replace selector-only feature mappings with concrete element ids where the live model can prove them. |
| `BIR-T02` | P0       | Partial | Map findings to source authoring commands. | Advisor/integrity/renderer findings can be traced to command ids, recipe rows, agent wave, commit, and phase packet where available.                    |
| `BIR-T03` | P0       | Done | Add evidence lineage manifest.             | `target-house-closeout-lineage.json` states current/evidence git heads, required-feature/source digests, bundle/snapshot/advisor-rule/performance/final-manifest digests, evidence file paths and digests, screenshot lineage, and closeout blockers for each acceptance family. |
| `BIR-T04` | P1       | Partial | Add stale evidence invalidation.           | `sketch_bim.py accept/stale-check` and `verify-sketch-seed-artifacts.mjs` now compare model revision, Advisor rule digest, renderer support matrix, seed source, target spec, and git head. Remaining: surface the invalidation rows directly in UI/API evidence dashboards. |
| `BIR-T05` | P1       | Partial | Add feature coverage dashboard.            | Target-house closeout lineage now emits `target-house-feature-coverage-dashboard.v1` with required features, element coverage status, open findings, renderer support, screenshots, and blockers. Remaining: build a live product dashboard view. |
| `BIR-T06` | P1       | Done | Add review narrative generator.            | `scripts/target-house-closeout-report.mjs` generates a deterministic markdown narrative explaining what the current target-house evidence proves, why Advisor cleanliness is not final acceptance, what remains tolerated, and which final blockers remain. |

### U. Advisor Noise Control, Product UX, And Fix Prioritization

| ID        | Priority | Status      | Item                                      | Acceptance                                                                                                                                                      |
| --------- | -------- | ----------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-U01` | P0       | Partial     | Add finding grouping/deduplication.       | Repeated geometry symptoms collapse into clear root-cause groups while preserving affected element ids.                                                         |
| `BIR-U02` | P0       | Partial     | Add fix priority ordering.                | Advisor sorts by severity, phase ownership, dependency/root cause, visible impact, and current lens/profile relevance.                                          |
| `BIR-U03` | P1       | Partial     | Add profile presets.                      | Architecture, Structure, MEP, Fire, Accessibility, Construction Readiness, Exchange, and Sketch Acceptance profiles have explicit rule membership and defaults. |
| `BIR-U04` | P1       | Partial     | Add user-facing explanations by audience. | Same rule can expose concise UI text, agent technical detail, and documentation text without losing rule identity.                                              |
| `BIR-U05` | P1       | Partial     | Add false-positive review workflow.       | Users/agents can classify a finding as rule defect, accepted tolerance, profile mismatch, or model defect with evidence.                                        |
| `BIR-U06` | P2       | Partial     | Add Advisor learning corpus.              | Confirmed true/false findings become fixtures for rule tuning and regression prevention.                                                                        |

W16-D evidence, 2026-05-19: `app/bim_ai/advisor_policy_registry.py` adds
machine-readable rule policy metadata for suppressibility
(`ignorable`/`review_required`/`non_suppressible`), owner/expiry/evidence
tolerance requirements, profile presets, audience-specific text, false-positive
review classifications, and an Advisor learning-corpus hook contract.
`app/bim_ai/constructability_report.py` now emits policy fields on findings,
rejects incomplete review-required suppressions, preserves valid audited
suppressions, attaches deterministic priority-policy/root-cause group payloads,
and exposes profile/review/corpus contracts through constructability and
`qa.advisor` surfaces. Web Advisor and constructability panels understand
priority rank, root-cause grouping, audience text, and suppressibility metadata.
Focused tests:
`app/tests/test_constructability_report.py`,
`packages/web/src/advisor/AdvisorPanel.test.tsx`,
`packages/web/src/advisor/ConstructabilityReportPanel.test.tsx`, and
`packages/web/src/advisor/unifiedAdvisorViolations.test.ts`. Status remains
`Partial`: the corpus hook is a contract, not a populated fixture library, and
full rule-registry coverage for every non-constructability Advisor rule remains
outside this worker slice.

### V. Families, Parameters, Assets, And Content Quality

| ID        | Priority | Status      | Item                                    | Acceptance                                                                                                                                  |
| --------- | -------- | ----------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-V01` | P0       | Partial     | Validate family/type parameter schemas. | `familyTypeContentIntegrity_v1` and model-integrity findings validate declared required dimensions against parameters/schema, host behavior, material slots, schedule fields, IFC mapping, render support, and type-layer material consistency. Remaining: migrate bundled/live family catalogs to strict complete schemas. |
| `BIR-V02` | P0       | Partial     | Validate instance overrides.            | Family instance overrides are checked against declared parameter min/max/options/instance-overridable constraints, wall-host width/height geometry, schedule-field coverage, and material slot consistency. Remaining: broaden schedule parity beyond declared `scheduleFields`.                         |
| `BIR-V03` | P1       | Partial     | Validate content library assets.        | Asset library entries now emit deterministic metadata findings for category, dimensions, clearance, maintenance zones, material slots, render support, and schedule/export metadata plus param-schema defaults. Remaining: enforce completeness across bundled catalogs.       |
| `BIR-V04` | P1       | Partial     | Validate asset placement.               | Placed assets now validate declared wall/ceiling/workplane support, floor-footprint support for freestanding/floor assets, floating placement, wall embedding without explicit intent, and overlap with stair/ramp vertical-circulation footprints. Remaining: richer oriented extents/recess geometry checks.                         |
| `BIR-V05` | P1       | Partial     | Validate family render/export parity.   | Family types now report render/export parity gaps across visual geometry, material slots, plan symbols, schedule fields, IFC mapping, and glTF/export support; renderable geometry requires matching IFC/glTF support in strict schemas. Remaining: compare actual emitted manifests/readback rows. |

### W. Fixture Governance And Completion Accounting

| ID        | Priority | Status  | Item                              | Acceptance                                                                                                                                                             |
| --------- | -------- | ------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-W01` | P0       | Partial | Define fixture classes.           | Fixture corpus distinguishes minimal synthetic, target-house regression, benchmark seed, import/export roundtrip, performance stress, disposable local evidence/rehearsal, and user-realistic sketch cases. `p0IntegrityFixtureCorpus_v1` now declares all classes explicitly and audits active minimal/target-house cases; broader corpus ownership rows remain incomplete. |
| `BIR-W02` | P0       | Done    | Add status accounting script.     | A script computes milestone/tracker completion percentages from this file plus generated evidence and fails on stale status claims.                                    |
| `BIR-W03` | P0       | Partial | Add implementation evidence rows. | Each tracker item records code paths, tests, generated docs, evidence artifact, commit id, and known limitations before status becomes `Done`. W13-B adds explicit BIR-N03 implementation/test evidence rows; broader tracker-wide evidence-row completion remains open. |
| `BIR-W04` | P1       | Partial | Add wave closeout template.       | `spec/sketch-to-bim-agent-workflow-templates.md` adds a reusable wave closeout template with agents, commits, tests, tracker changes, blockers, and recommendations. Remaining: require parent-wave closeouts to attach the generated artifact. |
| `BIR-W05` | P1       | Done    | Add quality gate for "Done".      | CI or review script rejects status changes to `Done` without linked evidence rows and tests.                                                                           |

## Wave 7 Worker E Operational Contracts

These rows define the first machine-checkable provenance and accounting shape
for `BIR-T01` through `BIR-W05`. They are not a claim that every product
surface is complete; they give agents and reviewers stable columns to preserve
while implementation deepens.

### Finding-To-Command Provenance

| Field             | Required value                                                       |
| ----------------- | -------------------------------------------------------------------- |
| `findingId`       | Stable rule finding id, not only display text.                       |
| `sourceCommandId` | Original authoring command id when the finding can be traced to one. |
| `sourceRecipeRow` | Seed/recipe row or bundle command index when available.              |
| `agentWave`       | Wave/worker label for generated or remediated commands.              |
| `commit`          | Git commit that introduced or remediated the command/evidence.       |
| `phasePacket`     | Sketch-to-BIM phase packet or acceptance packet id.                  |

### Stale Evidence Invalidators

| Invalidator             | Required digest / compare key                   | Applies to                                    |
| ----------------------- | ----------------------------------------------- | --------------------------------------------- |
| Model revision          | Workspace/model revision id                     | snapshots, screenshots, reports, exports      |
| Rule digest             | Advisor/integrity/renderer rule registry digest | findings, acceptance claims, review narrative |
| Renderer support matrix | Generated renderer-support-matrix digest        | screenshots, visual/golden claims             |
| Seed source             | seed recipe/bundle/source digest                | target-house and benchmark acceptance         |
| Target spec             | brief/BIR/checklist/capability-map digest       | sketch feature acceptance                     |
| Git head                | source commit                                   | all generated evidence packets                |

### Feature Coverage Dashboard Rows

| Column             | Source                                                          |
| ------------------ | --------------------------------------------------------------- |
| Feature id         | sketch capability map, benchmark fixture, or tracker item id    |
| Required elements  | BIR/brief/fixture expected element ids or kinds                 |
| Current coverage   | live model/evidence element ids, counts, and acceptance state   |
| Open findings      | grouped Advisor/integrity/renderer finding ids                  |
| Renderer support   | renderer support matrix row and unsupported feature list        |
| Screenshots        | evidence artifact path and capture digest                       |
| Remaining blockers | unresolved P0/P1 tracker rows, stale evidence, or missing tests |

### Review Narrative Template

| Section    | Required content                                                    |
| ---------- | ------------------------------------------------------------------- |
| Scope      | target seed/fixture, phase, source spec, wave, agent list           |
| Changes    | committed code/data/evidence changes with command provenance        |
| Proof      | tests, generated reports, screenshots, exports, and digests         |
| Tolerances | accepted tolerances, false positives, owner, expiry, evidence       |
| Blockers   | open errors/warnings, stale evidence, missing fixtures, limitations |
| Next wave  | prioritized follow-up rows and recommended owners                   |

### Advisor Noise And Review Workflow

| Contract              | Required shape                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Grouping/dedup        | `groupId`, root-cause rule, affected ids, representative finding, duplicate count                           |
| Fix priority          | severity, phase ownership, dependency/root-cause rank, visible impact, active profile/lens relevance        |
| Profile preset        | architecture, structure, MEP, fire, accessibility, construction-readiness, exchange, sketch-acceptance      |
| Audience explanation  | concise UI text, agent technical detail, documentation text, same stable `ruleId`                           |
| False-positive review | classification: rule defect, accepted tolerance, profile mismatch, model defect; reviewer, evidence, expiry |

### Family And Content Validation

| Content class        | Required validation keys                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Family type          | category, dimensions, host behavior, material slots, schedule fields, IFC mapping, render support     |
| Instance override    | width/height/material/operation compatibility, host geometry compatibility, schedule compatibility    |
| Catalog asset        | dimensions, clearance, MEP/maintenance zones, materials, render support, schedule/export metadata     |
| Placement            | floor/wall/ceiling/workplane support, non-floating position, non-embedded geometry unless intentional |
| Render/export parity | visual geometry, plan symbol, material slots, schedule rows, IFC/glTF manifest agreement              |

### Fixture Governance Classes

| Class                   | Required use                                                  |
| ----------------------- | ------------------------------------------------------------- |
| Minimal synthetic       | One-rule fixtures that isolate a regression.                  |
| Target-house regression | Known target-house failures and remediation evidence.         |
| Benchmark seed          | Repeatable house/building benchmarks with expected summaries. |
| Import/export roundtrip | IFC/glTF/readback drift and semantic preservation fixtures.   |
| Performance stress      | Large or adversarial projects for bounded diagnostics.        |
| User-realistic sketch   | Realistic sketch/brief/BIR cases with methodology evidence.   |

### Wave Closeout Template

| Field           | Required content                                             |
| --------------- | ------------------------------------------------------------ |
| Wave            | wave number, date, parent commit, local commits              |
| Agents          | worker labels and ownership ranges                           |
| Tracker changes | status changes, evidence rows added, generated status digest |
| Tests           | exact commands and pass/fail/skip result                     |
| Evidence        | generated docs, artifacts, screenshots, manifests, digests   |
| Blockers        | unresolved defects, stale evidence, incomplete fixtures      |
| Recommendations | next-wave priorities and owners                              |

## Implementation Evidence Rows

| ID        | Code paths                                                                                                             | Tests                                                                                                                                                                                                                 | Evidence artifacts                                                                                                                                                                             | Commit                                                            | Limitations                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BIR-A01` | `spec/bim-integrity-rendering-sketch-methodology-tracker.md`; `scripts/audit-bim-integrity-tracker.mjs`                | `app/tests/test_bim_integrity_tracker_audit.py`                                                                                                                                                                       | `spec/generated/bim-integrity-tracker-status.md`                                                                                                                                               | `25d7e1baf` parent includes tracker/accounting baseline           | Tracker exists; product rule coverage remains tracked separately.                                                                                                                  |
| `BIR-A03` | `app/bim_ai/constraints_metadata.py`; `app/bim_ai/constraints.py`                                                      | `app/tests/test_constraints_metadata.py`; `app/tests/test_constraints.py`                                                                                                                                             | Constraint metadata registry and tests                                                                                                                                                         | `25d7e1baf` parent includes metadata baseline                     | Registry coverage is broad but not every future rule family is complete.                                                                                                           |
| `BIR-A02` | `app/bim_ai/advisor_rule_registry.py`; `app/bim_ai/api/registry.py`; `app/bim_ai/routes_api.py`; `packages/cli/cli.mjs` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_advisor_rule_registry.py app/tests/test_api_v3_registry.py -q`; `node --test packages/cli/cli.mcpParity.test.mjs` | Canonical `advisorRuleCatalog_v1` now carries rule id, title, severity, discipline, perspective/profile membership, source layer, suppressibility, actionability, affected-id kinds, recommendations, fix hints, surfaces, tests, and status. | Wave 18-A local commit                                           | Partial: this hardens the registry contract and seed rules; broader future domain rules still need to be registered as their evaluators mature.                                      |
| `BIR-A04` | `app/bim_ai/advisor_rule_registry.py`; `app/bim_ai/api/registry.py`; `app/bim_ai/routes_api.py`; `packages/cli/cli.mjs` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_advisor_rule_registry.py app/tests/test_api_v3_registry.py -q`; `node --test packages/cli/cli.mcpParity.test.mjs` | `GET /api/v3/advisor-rules`, API descriptor `qa.advisor_rules`, and CLI `qa rules` expose the same canonical rule payload for UI/API/CLI/MCP/docs parity. | Wave 18-A local commit                                           | Partial: metadata parity is covered; full grouped finding equivalence across every live UI right-rail and constructability report remains broader product work.                     |
| `BIR-A05` | `app/bim_ai/advisor_rule_registry.py`; `spec/generated/advisor-rule-ledger.md`                                         | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_advisor_rule_registry.py -q`                                                                                                                                 | Registry validation enforces P0 integrity/renderer/sketch severity policies as `error` and keeps sketch acceptance blockers from being downgraded to `info`.                                      | Wave 18-A local commit                                           | Partial: policy is deterministic for registered seed rules; profile-specific warning/info policy still needs expansion as metadata completeness rules are added.                    |
| `BIR-A07` | `app/bim_ai/advisor_rule_registry.py`; `spec/generated/advisor-rule-ledger.md`                                         | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_advisor_rule_registry.py -q`                                                                                                                                 | Generated Advisor rule ledger lists each canonical rule with policy, layer, profiles, surfaces, suppressibility, actionability, status, tracker ids, affected ids, fix hints, and test refs.        | Wave 18-A local commit                                           | Partial: generated ledger drift is tested; a consolidated CI governance job for all generated docs remains tracked separately.                                                      |
| `BIR-C01` | `app/bim_ai/constraints.py`; `app/bim_ai/constructability_advisories.py`                                               | `app/tests/test_constraints_wall_geometry.py`; `app/tests/test_constructability_advisories.py`                                                                                                                        | Constraint/advisor finding serialization                                                                                                                                                       | `25d7e1baf` parent includes hosted-opening integrity baseline     | Additional UI parity hardening remains in `BIR-A04`/`BIR-H*`.                                                                                                                      |
| `BIR-C02` | `app/bim_ai/constraints.py`; `app/bim_ai/constructability_geometry.py`                                                 | `app/tests/test_constructability_geometry.py`; `app/tests/test_engine_constraints.py`                                                                                                                                 | Constructability report findings                                                                                                                                                               | `25d7e1baf` parent includes envelope integrity baseline           | More detached/exterior intent modeling remains open.                                                                                                                               |
| `BIR-C03` | `app/bim_ai/constraints.py`; `packages/web/src/plan/structuralValidation.ts`                                           | `app/tests/test_constraints_wall_geometry.py`; `packages/web/src/plan/structuralValidation.test.ts`                                                                                                                   | Hosted span diagnostics                                                                                                                                                                        | `25d7e1baf` parent includes span validation baseline              | Opening conflict graph remains `BIR-C06`.                                                                                                                                          |
| `BIR-B01` | `app/bim_ai/model_integrity_hosting.py`; `app/bim_ai/engine_commit.py`; `app/bim_ai/constraints_core.py`              | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py app/tests/test_model_integrity_advisor_integration.py app/tests/test_p0_integrity_fixture_corpus.py -q` | Commit preflight rejects missing hosted cuts, overlapping openings, helper hosts, and hosted-family support mismatches with host ids, tracker ids, recommendations, and safe-fix hints.       | Wave 18-B local commit                                           | Partial: backend commit and advisor surfaces are covered; full UI/MCP parity remains tracked under `BIR-A04`/`BIR-H*`.                                                             |
| `BIR-C04` | `app/bim_ai/model_integrity_hosting.py`; `app/bim_ai/constraints_metadata.py`; `app/tests/fixtures/p0_integrity_cases.json` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py app/tests/test_p0_integrity_fixture_corpus.py -q` | Missing semantic/rendered host cuts and orphan void cuts emit deterministic blocking findings with affected ids, host ids, recommendations, tracker ids, and safe delete/repair hints.       | Wave 18-B local commit                                           | Partial: deterministic metadata checks exist; renderer golden proof for every integrated family cut remains renderer scope.                                                         |
| `BIR-B07` | `app/bim_ai/model_integrity_hosting.py`; `packages/web/src/advisor/advisorViolationContext.ts`                         | `app/tests/test_model_integrity_hosting.py`; `packages/web/src/viewport/collectRendererDiagnostics.test.ts`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py` | Hosted-opening findings include safe existing-command quick fixes for helper/proxy deletion and span resizing; wall/floor support-context findings include `allowDetached` hints; asset, stair, and railing support findings carry machine-readable support-resolution safe-fix hints. | Wave 14-B local commit; Wave 16-A local commit; Wave 17-A local commit | Partial: hints are limited to existing safe commands plus structured support-resolution hints; full rehost, move-into-envelope, and support-creation command implementations remain future work. |
| `BIR-C06` | `app/bim_ai/model_integrity_hosting.py`; `app/tests/fixtures/p0_integrity_cases.json`                                 | `app/tests/test_model_integrity_hosting.py::test_opening_conflict_graph_is_deterministic_for_overlap_and_clearance`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_commit_preflight.py::test_bundle_commit_rejects_overlapping_hosted_openings_with_graph_metadata app/tests/test_p0_integrity_fixture_corpus.py -q` | `hostedOpeningConflictGraph_v1` nodes/edges cover wall-hosted intervals, overlap/endpoint edges, invalid host states, tracker ids, recommendations, host ids, and safe-fix hints.              | Wave 14-B local commit; Wave 18-B local commit                   | Lintel/header spacing and richer structural capacity checks remain future work.                                                                                                     |
| `BIR-C07` | `app/bim_ai/model_integrity_hosting.py`; `app/bim_ai/constraints_metadata.py`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_model_integrity_hosting.py::test_hosted_family_support_classification_flags_wrong_host_and_orphan_proxy`; `app/tests/test_model_integrity_hosting.py::test_direct_family_host_support_field_is_classified`; `app/tests/test_model_integrity_commit_preflight.py::test_bundle_commit_rejects_hosted_family_support_mismatch` | Advisor/API/preflight violations for declared wall/face/ceiling/workplane support classes now include direct family type `hostSupport`, host ids, tracker ids, recommendations, and safe-fix hints. | Wave 14-B local commit; Wave 18-B local commit                   | Classification covers explicit family/asset metadata plus door/window defaults; deeper family schema authoring UX remains open.                                                     |
| `BIR-C08` | `app/bim_ai/model_integrity_hosting.py`; `app/bim_ai/constraints_metadata.py`; `packages/web/src/viewport/collectRendererDiagnostics.ts`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_model_integrity_hosting.py`; `app/tests/test_model_integrity_advisor_integration.py`; `app/tests/test_p0_integrity_fixture_corpus.py`; `packages/web/src/viewport/collectRendererDiagnostics.test.ts` | Backend `hosted_render_proxy_orphan`, `hosted_void_cut_orphan`, helper-family leakage, renderer detached/proxy diagnostics, and P0 corpus fixtures carry orphan proxy/cut evidence.          | Wave 14-B local commit; Wave 17-C local commit; Wave 18-B local commit | Renderer-side broader export rejection for every non-wall helper proxy remains partial.                                                                                             |
| `BIR-G01` | `app/bim_ai/structure_mep_lite_integrity.py`; `app/bim_ai/domain_integrity.py`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_structure_mep_lite_integrity.py app/tests/test_domain_integrity.py -q`                                                                                      | `structureMepLiteIntegrity_v1` emits deterministic scope metadata, non-certified engineering disclaimer, tracker ids, severity, recommendation, and normalized domain output.                   | Wave 18-D local commit                                          | Partial: backend report/domain output carries the disclaimer and metadata; product UI copy still needs complete parity.                                                             |
| `BIR-G02` | `app/bim_ai/structure_mep_lite_integrity.py`; `app/bim_ai/model_integrity.py`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_structure_mep_lite_integrity.py app/tests/test_model_integrity_invariants.py -q`                                                                             | Structure-lite checks cover load-bearing intent, load-path role/direction metadata, unresolved support references, beam supports, stacked supports, transfer assumptions, large-opening coordination, and material/type consistency fixtures. | Wave 18-D local commit                                          | Partial: deterministic authored-data and simple geometry checks exist; no certified structural sizing or capacity calculation is attempted.                                           |
| `BIR-G03` | `app/bim_ai/structure_mep_lite_integrity.py`                                                                          | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_structure_mep_lite_integrity.py -q`                                                                                                                          | MEP-lite route findings require resolved opening/sleeve metadata for crossed hosts; opening/sleeve request findings require host, route/system, and size metadata.                             | Wave 18-D local commit                                          | Partial: metadata and existing opening references are validated; automatic sleeve/opening authoring remains future work.                                                            |
| `BIR-G04` | `app/bim_ai/structure_mep_lite_integrity.py`; `app/bim_ai/domain_integrity.py`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_structure_mep_lite_integrity.py app/tests/test_domain_integrity.py -q`                                                                                      | Wet-room/service-zone checks cover unserved wet rooms, unstacked service stacks, missing riser/shaft/equipment access metadata, and unresolved route placeholders.                             | Wave 18-D local commit                                          | Partial: checks are metadata/level-stack based and do not optimize MEP routing geometry.                                                                                            |
| `BIR-G05` | `app/bim_ai/code_profile_integrity.py`; `app/bim_ai/domain_integrity.py`                                            | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_code_profile_integrity.py app/tests/test_domain_integrity.py -q`                                                                                             | Fire profile findings cover fire ratings, exit door width/swing/landing metadata, protected stair placeholders, compartment placeholders, and firestop metadata for penetrations through rated hosts. | Wave 18-D local commit                                          | Partial: checks are profile-controlled deterministic gates, not jurisdiction-certified fire/life-safety calculations.                                                               |
| `BIR-G06` | `app/bim_ai/code_profile_integrity.py`; `app/bim_ai/domain_integrity.py`                                            | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_code_profile_integrity.py app/tests/test_domain_integrity.py -q`                                                                                             | Accessibility profile findings cover door width, threshold, maneuvering/swing, circulation width, route continuity/connectivity metadata, and sanitary turning zones.                          | Wave 18-D local commit                                          | Partial: route continuity is authored metadata; full graph-derived accessible path proof remains future work.                                                                        |
| `BIR-G07` | `app/bim_ai/code_profile_integrity.py`; `app/bim_ai/domain_integrity.py`                                            | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_code_profile_integrity.py app/tests/test_domain_integrity.py -q`                                                                                             | Regional code package findings carry locale/profile/source basis, advisory-vs-enforced basis, severity, tracker id, and normalized domain fields.                                               | Wave 18-D local commit                                          | Partial: metadata contract exists; comprehensive regional rule packages/catalogs are not bundled.                                                                                   |
| `BIR-F01` | `app/bim_ai/envelope_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_envelope_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                                      | Roof-opening host/footprint checks now include invalid polygons, outside-host vertices, large-void metadata requirements, tracker-tagged findings, and P0 corpus roof-cut fixtures.             | Wave 17-C local commit                                           | Partial: deterministic footprint and metadata checks exist; renderer golden proof for every roof opening shape remains separate renderer scope.                                      |
| `BIR-F02` | `app/bim_ai/envelope_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_envelope_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                                      | Occupied roof void findings require cut, occupied floor, return/curb/parapet, guard, access, drainage, support, evidence-view metadata, and corpus coverage.                                  | Wave 17-C local commit                                           | Partial: evidence contract is deterministic metadata; end-to-end rendered roof-court visual evidence remains renderer/methodology scope.                                             |
| `BIR-F03` | `app/bim_ai/envelope_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json`     | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_envelope_integrity.py app/tests/test_domain_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                   | Envelope-zone gap/hole findings carry tracker ids, recommendations, affected ids, and raw metadata P0 fixture coverage for unresolved closure gaps.                                             | Wave 17-C local commit                                           | Partial: declared envelope-zone closure is checked; full derived envelope solid closure remains future geometry work.                                                                |
| `BIR-F04` | `app/bim_ai/envelope_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_envelope_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                                      | Terrace/loggia floors require guard/access/drainage/support evidence, contained exterior spaces validate host-floor boundaries, and loggia side returns must resolve to real elements.          | Wave 17-C local commit                                           | Partial: metadata and footprint containment are covered; full 3D loggia return/ceiling adjacency remains future geometry work.                                                       |
| `BIR-F05` | `app/bim_ai/envelope_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_envelope_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                                      | Facade rhythm checks remain opt-in metadata checks and now validate opening counts, opening references, support references, and opening-to-facade attachment.                                   | Wave 17-C local commit                                           | Partial: declared rhythm metadata is validated; absent facade rhythm metadata intentionally produces no normal-Advisor aesthetic finding.                                            |
| `BIR-F06` | `app/bim_ai/envelope_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_envelope_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                                      | Roof/wall relationship findings validate wall roofAttachmentId, required roof wrapper relations, attachedWallIds resolution, and overhang semantics.                                             | Wave 17-C local commit                                           | Partial: relationship/reference metadata is checked; full roof/wall intersection geometry and eave/ridge derivation remain future geometry work.                                     |
| `BIR-C05` | `app/bim_ai/room_derivation.py`; `app/bim_ai/constraints.py`                                                           | `app/tests/test_constraints_room_unenclosed.py`; `app/tests/test_engine_constraints.py`                                                                                                                               | Access/helper leakage findings                                                                                                                                                                 | `25d7e1baf` parent includes helper-leakage baseline               | Helper visibility serialization policy remains broader `BIR-B03`.                                                                                                                  |
| `BIR-B03/B04` | `app/bim_ai/engine_commit.py`; `app/bim_ai/model_integrity_hosting.py`                                             | `app/tests/test_model_integrity_commit_preflight.py`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py app/tests/test_p0_integrity_fixture_corpus.py -q` | Commit-time integrity preflight blocks physical helper/access proxy leakage, helper-hosted doors, floating assets, unsupported slab/floor fragments, detached stair landings, and hostless railings before persistence. | Wave 14-A local commit; Wave 17-A local commit | Covers hosted-opening/helper-access and several non-wall support-context P0 cases at the kernel commit boundary; explicit helper serialization semantics and full UI parity remain follow-up. |
| `BIR-B02` | `app/bim_ai/model_integrity_hosting.py`; `app/bim_ai/engine_commit.py`; `app/bim_ai/constraints_metadata.py`; `app/bim_ai/commands.py`; `app/bim_ai/engine_dispatch_core.py`; `app/bim_ai/engine_dispatch_building_envelope.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py app/tests/test_p0_integrity_fixture_corpus.py -q`; `python -m ruff check app/bim_ai/model_integrity_hosting.py app/bim_ai/engine_commit.py app/bim_ai/constraints_metadata.py app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py app/tests/test_p0_integrity_fixture_corpus.py` | Commit preflight blocks physical walls outside floor context plus non-wall support failures: freestanding placed assets outside same-level floors or on stairs, unsupported detached/elevated slabs, stairs without floor landings, and railings without valid host context. | Wave 16-A local commit; Wave 17-A local commit | Partial: backend commit/bundle guards now cover walls, assets, floors/slabs, stairs, and railings; UI guard parity, richer oriented asset footprint checks, and complete slab-opening/support semantics remain follow-up. |
| `BIR-B05` | `app/bim_ai/model_integrity_hosting.py`; `packages/web/src/viewport/directAuthoringGuards.ts`; `packages/web/src/plan/selection/nearestWall.ts`; `packages/web/src/Viewport.tsx`; `packages/web/src/cmdPalette/defaultCommands.ts`; `packages/web/src/workspace/Workspace.tsx`; `packages/web/src/workspace/WorkspaceRightRail.tsx` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py`; `pnpm --dir packages/web exec vitest run src/viewport/directAuthoringGuards.test.ts src/plan/selection/nearestWall.test.ts` | Plan, 3D, Cmd+K selected-wall, optimistic hosted-opening, and right-rail host actions share nonphysical/helper host rejection; backend bundle/commit rejects the same helper/nonphysical host state. | Wave 16-A local commit | Partial: nonphysical/helper host parity is covered; UI host picking does not yet prefilter every geometric invalidity such as outside-floor-envelope hosts. |
| `BIR-B06` | `app/bim_ai/engine_commit.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_commit_preflight.py`; `python -m ruff check app/bim_ai/engine_commit.py` | Agent-authored command payloads marked with `agentAuthored`, `actor: agent`, `source: agent`, or `agentTrace` are rejected unless they provide explicit level/host/type-or-material/category context and `physicalRole` of `physical` or `analysis` where relevant; asset placement now requires explicit `hostElementId` or `placementSupport` context. | Wave 16-A local commit; Wave 17-A local commit | Partial: raw command and bundle commit paths now have stricter agent validation; CLI/MCP generators still need to stamp `agentAuthored` or provide complete explicit defaults consistently. |
| `BIR-H01` | `app/bim_ai/advisor_rule_registry.py`; `app/bim_ai/api/registry.py`; `app/bim_ai/routes_api.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_advisor_rule_registry.py app/tests/test_api_v3_registry.py -q` | Rule metadata now declares affected-id kinds, UI summaries, recommendations, safe fix command hints, actionability class, source layer, and UI surface membership for every canonical rule row. | Wave 18-A local commit | Partial: this is metadata/action contract coverage; right-rail open/isolate/context-view rendering remains broader UI implementation work. |
| `BIR-H02` | `claude-skills/sketch-to-bim/sketch_bim.py`; `app/bim_ai/integrity_preflight.py`; `app/bim_ai/routes_integrity.py`; `app/bim_ai/advisor_rule_registry.py`; `app/bim_ai/api/registry.py`; `app/bim_ai/routes_api.py`; `packages/cli/cli.mjs` | `packages/cli/sketchSkillHelper.smoke.test.mjs`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_integrity_preflight.py app/tests/test_api_v3_registry.py app/tests/test_advisor_rule_registry.py -q`; `node --check packages/cli/cli.mjs`; `node --test packages/cli/cli.mcpParity.test.mjs` | `agent-loop-packet.json`, `integrityPreflightReport_v1`, `qa.advisor_rules`, `GET /api/v3/advisor-rules`, and CLI `qa rules` link findings/rules to ids, severity policy, recommendations, affected ids, fix hints, profile/perspective filters, actionability, diagnostics, and CLI/API/MCP descriptors. | Wave 13-E local commit; Wave 16-B local commit; Wave 18-A local commit | Partial: product CLI/API/MCP rule metadata parity is stronger; full normal Advisor grouped-finding parity and accepted-fix workflows remain split across H01/H04/H05/U02. |
| `BIR-H03` | `app/bim_ai/integrity_preflight.py`; `app/bim_ai/routes_integrity.py`; `app/bim_ai/api/registry.py`; `packages/cli/cli.mjs` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_integrity_preflight.py -q` | `GET /api/models/{model_id}/qa/integrity-preflight`; `qa.integrity_preflight`; `bim-ai qa integrity --output json`; profile-independent P0 model-integrity findings | Wave 16-B local commit | Done: preflight is independent of `construction_readiness` and explicitly excludes sketch-methodology acceptance checks. |
| `BIR-H04` | `app/bim_ai/integrity_preflight.py`; `app/bim_ai/routes_integrity.py`; `packages/cli/cli.mjs`; `app/bim_ai/transaction_safety.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_integrity_preflight.py -q`; `python -m ruff check app/bim_ai/integrity_preflight.py app/bim_ai/routes_integrity.py app/bim_ai/transaction_safety.py app/tests/test_integrity_preflight.py` | `integrityRemediationLoop_v1`, `agentRemediationProposal_v1`, remediation dry-run evidence, explicit CMD-v3 commit request payloads, existing bundle dry-run/commit routes, and recaptured preflight evidence | Wave 16-B local commit; Wave 18-E local commit | Partial: loop is deterministic and uses existing bundle commit surfaces; accepted-fix UI and artifact storage for recaptured evidence remain follow-up. |
| `BIR-H06` | `app/bim_ai/advisor_profiling.py`; `app/bim_ai/integrity_preflight.py`; `app/bim_ai/constructability_report.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_integrity_preflight.py app/tests/test_advisor_profiling_incremental.py -q` | `advisorDiagnosticsProfile_v1` now carries ordered timing rows, skipped checks, affected/impacted element counts, and incremental eligibility for preflight/profile consumers. | Wave 16-B local commit | Done for machine-readable diagnostics; live scheduling/degradation remains tracked under L-series UI performance rows. |
| `BIR-H07` | `app/bim_ai/integrity_preflight.py`; `app/bim_ai/routes_integrity.py`; `app/bim_ai/api/registry.py`; `packages/cli/cli.mjs` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_integrity_preflight.py app/tests/test_api_v3_registry.py -q`; `node --check packages/cli/cli.mjs` | `advisorMultiProfileComparison_v1` with profile rows, severity counts, added/missing rule ids vs baseline, rule matrix, and per-profile diagnostics. | Wave 16-B local commit | Done: agents can compare default/constructability/fire/accessibility/structure/MEP/exchange-style profiles without manual merge. |
| `BIR-D01` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_room_access_integrity.py::test_physical_room_separation_access_hack_is_reported`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q` | `room_access_fake_room_separation_access` and `room_access_door_host_not_real_boundary` findings carry `BIR-D01` tracker ids/actionability in direct and normalized domain output. | Wave 18-C local commit | Partial: flags explicit fake/physical room-separation access hacks; broader automatic room-boundary derivation remains future geometry work. |
| `BIR-D02` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_room_access_integrity.py::test_helper_hosted_door_does_not_create_real_room_access`; `app/tests/test_domain_integrity.py::test_domain_integrity_preserves_room_access_tracker_and_actionability`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q` | Helper/nonphysical door hosts are rejected as real access evidence, invalid door-boundary evidence remains deterministic, and domain-integrity rows preserve tracker ids, severity, recommendation, and actionability. | Wave 18-C local commit | Partial: real-door evidence is deterministic 2D host/room-boundary geometry; full opening width/clearance profile compliance remains D07/code-profile work. |
| `BIR-D03` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py app/tests/test_room_access_integrity.py -q` | `room_containment_detached_island`, `room_containment_outside_floor_slab`, and `room_containment_missing_level_floor` findings validate same-level floor/storey containment with explicit extension intent. | Wave 16-C local commit; Wave 18-C local commit | Partial: validates room containment against same-level floor slabs; richer envelope-zone union/holes and authoring-command preflight remain follow-up. |
| `BIR-D04` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_room_access_integrity.py::test_unresolved_egress_path_is_reported_for_isolated_accessible_room`; `app/tests/test_room_access_integrity.py::test_multilevel_room_graph_reaches_exterior_through_stair_and_landing_doors`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q` | Deterministic egress graph findings cover exterior exit classification, door/open-separation traversal, stair level transitions, and unresolved room paths. | Wave 13-C local commit; Wave 18-C local commit | Partial: egress remains deterministic topology evidence, not jurisdictional egress sizing or full life-safety simulation. |
| `BIR-D05` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_room_access_integrity.py::test_room_wall_topology_gap_detects_partial_edge_coverage`; `app/tests/test_room_access_integrity.py::test_wall_boundary_role_conflict_is_reported_deterministically`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q` | Room wall topology gaps are explicit, and declared wall boundary roles are checked against deterministic exterior/interior/corridor/shaft room adjacency. | Wave 13-C local commit; Wave 18-C local commit | Partial: classification uses authored role metadata plus deterministic adjacent-room evidence; richer shaft/corridor semantic derivation remains future work. |
| `BIR-D06` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `app/tests/test_room_access_integrity.py::test_missing_room_schedule_fields_are_reported`; `app/tests/test_room_access_integrity.py::test_room_schedule_fields_read_structured_bim_intent`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q` | Room schedule/BIM metadata completeness is checked from room fields, props, and structured `roomBimIntent`, with P0 corpus coverage for missing deterministic schedule fields. | Wave 13-C local commit; Wave 18-C local commit | Partial: validates required row metadata but does not compare every rendered/exported schedule table variant. |
| `BIR-D07` | `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/test_room_access_integrity.py` | `app/tests/test_room_access_integrity.py::test_profile_controlled_occupancy_and_accessibility_placeholders`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_room_access_integrity.py app/tests/test_domain_integrity.py -q` | Profile-controlled occupancy and accessibility placeholder findings carry `BIR-D07` tracker ids without hardcoding accessibility checks into all projects. | Wave 18-C local commit | Partial: placeholders enforce metadata readiness only; minimum widths, bathroom clearances, and accessible route geometry remain profile-specific follow-up checks. |
| `BIR-E01` | `app/bim_ai/vertical_circulation_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_vertical_circulation_integrity.py app/tests/test_domain_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q` | Deterministic `BIR-E01` domain findings now cover missing upper stair slab/shaft openings plus orphan, degenerate, and outside-host slab openings; P0 corpus includes positive and valid-opening negative cases. | Wave 17-B local commit | Partial: geometric opening relation is footprint-based; renderer visibility/readback of the cut remains tracked under renderer/export rows. |
| `BIR-E02` | `app/bim_ai/vertical_circulation_integrity.py`; `app/bim_ai/domain_integrity.py`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_vertical_circulation_integrity.py app/tests/test_domain_integrity.py -q`                                                                                    | Unsupported elevated slabs and detached slab fragments keep `BIR-E02` tracker ids in normalized domain findings.                                                                                | Wave 17-B local commit                                           | Partial: support inference is conservative and mostly uses explicit support ids, same-level context, or simple wall/column context.                                                   |
| `BIR-E03` | `app/bim_ai/vertical_circulation_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_vertical_circulation_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                         | Railing/guard findings now use `BIR-E03` for missing/unresolved hosts, low guard height, discontinuous guard paths, and insufficient hosted-stair coverage; P0 corpus includes low guard evidence. | Wave 17-B local commit                                           | Partial: continuity is deterministic path coverage, not full edge-by-edge code compliance or rendered baluster verification.                                                        |
| `BIR-E04` | `app/bim_ai/constraints_evaluation.py`; `app/bim_ai/constructability_advisories.py`; `app/bim_ai/vertical_circulation_integrity.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_constructability_fixture_corpus.py app/tests/test_vertical_circulation_integrity.py -q`                                                                     | Existing stair comfort/headroom checks remain covered by constructability fixtures; vertical integrity now separates graph/penetration failures from comfort-specific findings.                 | Wave 17-B local commit                                           | Partial: by-sketch stair comfort remains outside this checker and still depends on constructability/validation surfaces.                                                             |
| `BIR-E05` | `app/bim_ai/vertical_circulation_integrity.py`; `app/bim_ai/room_access_integrity.py`; `app/bim_ai/domain_integrity.py`; `app/tests/fixtures/p0_integrity_cases.json` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_vertical_circulation_integrity.py app/tests/test_room_access_integrity.py app/tests/test_p0_integrity_fixture_corpus.py -q`                                 | Vertical graph findings now cover missing/inverted level transitions, floor endpoint connectivity, and stair overlap with sleeping rooms or placed content; P0 corpus includes inverted-level and bedroom/furniture regressions. | Wave 17-B local commit | Partial: room reachability still uses deterministic endpoint/topology evidence rather than full code egress simulation. |
| `BIR-E06` | `app/bim_ai/vertical_circulation_integrity.py`; `app/bim_ai/domain_integrity.py`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_vertical_circulation_integrity.py -q`                                                                                                                        | Occupied exterior floor findings keep `BIR-E06` tracker ids for missing guard, drainage, access, boundary, or schedule intent.                                                                 | Wave 17-B local commit                                           | Partial: terrace/loggia drainage and access intent remain metadata/evidence checks, not hydraulic or detailed envelope validation.                                                    |
| `BIR-E07` | `app/bim_ai/vertical_circulation_integrity.py`; `app/bim_ai/domain_integrity.py`                                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_vertical_circulation_integrity.py -q`                                                                                                                        | Railing family/profile integrity remains deterministic for baluster profile/spacing, post or handrail support metadata, support hosts, and material slots.                                      | Wave 17-B local commit                                           | Partial: validates authored profile metadata but does not yet prove exact rendered post/baluster body generation.                                                                    |
| `BIR-O01` | `app/tests/fixtures/p0_integrity_cases.json`; `app/tests/test_p0_integrity_fixture_corpus.py`                         | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q`                                                                                                                          | `p0IntegrityFixtureCorpus_v1` positive/negative cases with expected rule ids and affected element sets                                                                                          | Wave 16-C local commit                                           | Partial: corpus is minimal and representative; it does not yet cover every P0 integrity rule family.                                                                                |
| `BIR-O02` | `app/tests/fixtures/p0_integrity_cases.json`; `app/tests/test_p0_integrity_fixture_corpus.py`; `app/tests/test_model_integrity_advisor_integration.py`; `packages/cli/lib/target-house-geometry-diagnostics.mjs` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py app/tests/test_model_integrity_advisor_integration.py -q`; `node --test packages/cli/targetHouseGeometryDiagnostics.test.mjs` | Reduced target-house detached access-wall/access-door, roof-cut outside/inside-host, and building/toposolid/site partial-off-terrain regression cases. | Wave 16-C local commit; Wave 17-E local commit | Partial: reduced fixtures cover known symptoms; full seed replay and renderer visual roof-cut golden coverage remain separate target-house evidence work.                           |
| `BIR-W01` | `app/tests/fixtures/p0_integrity_cases.json`; `app/tests/test_p0_integrity_fixture_corpus.py`                         | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py::test_p0_integrity_fixture_corpus_classes_are_explicit_and_auditable -q`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_p0_integrity_fixture_corpus.py -q` | Fixture-class metadata plus minimal synthetic cases for floating asset/detached stair and detached slab/hostless railing support-context failures. | Wave 16-C local commit; Wave 17-A local commit | Partial: class vocabulary is explicit and audited here; other fixture corpora still need complete ownership metadata and broader real-project support-context coverage. |
| `BIR-I01` | `spec/generated/renderer-support-matrix.md`; `packages/web/src/viewport/rendererDiagnostics.ts`                        | `packages/web/src/viewport/rendererDiagnostics.test.ts`; `packages/web/src/plan/symbology.docs.test.ts`                                                                                                               | Renderer support matrix now includes placed-asset proxy/unsupported diagnostics alongside existing hosted cut, roof, slab, stair, railing, family, material, view, and export rows.             | `25d7e1baf` parent includes renderer matrix baseline; Wave 17-D local commit | Matrix must keep expanding as fidelity rows close.                                                                                                                                 |
| `BIR-I02` | `packages/web/src/viewport/collectRendererDiagnostics.ts`; `packages/web/src/viewport/elementRenderFeatureStatus.ts`; `packages/web/src/viewport/roomVisualizationRenderDiagnostics.ts`; `packages/web/src/viewport/wallHostedCutRenderDiagnostics.ts`; `packages/web/src/viewport/verticalCirculationRenderDiagnostics.ts` | `packages/web/src/viewport/collectRendererDiagnostics.test.ts`; `packages/web/src/viewport/elementRenderFeatureStatus.test.ts`; `packages/web/src/viewport/wallHostedCutRenderDiagnostics.test.ts`; `packages/web/src/viewport/verticalCirculationRenderDiagnostics.test.ts` | Structured viewport diagnostics now include per-element material unresolved/fallback, family unsupported/proxy fallback, and placed-asset unsupported/proxy fallback status-derived diagnostics. | Wave 13-D local commit; Wave 17-D local commit                    | Live UI display and evidence-package refresh remain broader renderer-evidence work.                                                                                                 |
| `BIR-I03` | `packages/web/src/viewport/collectRendererDiagnostics.ts`; `packages/cli/lib/target-house-clean-pass-gate.mjs`; `seed-artifacts/target-house-1/evidence/live-run-current/snapshot.json` | `packages/web/src/viewport/collectRendererDiagnostics.test.ts`; `packages/cli/targetHouseCleanPassGate.test.mjs`                                                                                                      | Target-house renderer golden still asserts rooms/room separations/slab openings are clean and hosted curtain-wall cuts emit fallback diagnostics; clean-pass now fails on renderer diagnostic artifacts with target-house-critical unsupported/failed errors. | Wave 13-D local commit; Wave 17-D local commit                    | Current source evidence remains clean; broader screenshot pixel-golden coverage is still tracked under `BIR-J09`.                                                                  |
| `BIR-I04` | `packages/web/src/viewport/collectRendererDiagnostics.ts`; `packages/web/src/viewport/rendererDiagnostics.ts`; `packages/cli/lib/target-house-clean-pass-gate.mjs`; `packages/cli/lib/renderer-diagnostics-evidence.mjs` | `packages/web/src/viewport/collectRendererDiagnostics.test.ts`; `packages/web/src/viewport/rendererDiagnostics.test.ts`; `packages/cli/rendererDiagnosticsEvidence.test.mjs`; `packages/cli/targetHouseCleanPassGate.test.mjs` | Diagnostics carry tracker IDs, view IDs, evidence context, artifact path, support-matrix digest, and clean-pass consumption of renderer-diagnostics evidence artifacts.                         | Wave 13-D local commit; Wave 17-D local commit                    | Phase/final sketch acceptance wiring exists through renderer evidence manifests; live production capture remains broader evidence work.                                             |
| `BIR-I05` | `packages/web/src/viewport/elementRenderFeatureStatus.ts`; `packages/web/src/viewport/collectRendererDiagnostics.ts`   | `packages/web/src/viewport/elementRenderFeatureStatus.test.ts`; `packages/web/src/viewport/collectRendererDiagnostics.test.ts`                                                                                         | `elementRenderFeatureStatus_v1` now reports material state, family state, placed-asset proxy state, render implementation, skipped subfeatures, export support, diagnostic codes, and blocking status. | Wave 5-D local commit; Wave 17-D local commit                     | Inspector wiring can consume the pure helper, but not every live selection panel renders the full status yet.                                                                       |
| `BIR-J01` | `packages/web/src/viewport/collectRendererDiagnostics.ts`; `packages/web/src/viewport/wallHostedCutRenderDiagnostics.ts` | `packages/web/src/viewport/collectRendererDiagnostics.test.ts`; `packages/web/src/viewport/wallHostedCutRenderDiagnostics.test.ts`                                                                                     | Wall-hosted cut diagnostics remain covered, and status-derived family/material diagnostics now surface missing family geometry or unresolved material that would otherwise hide hosted opening fidelity. | Wave 13-D local commit; Wave 17-D local commit                    | Does not implement new CSG; it audits unsupported/fallback paths deterministically.                                                                                                 |
| `BIR-J02` | `packages/web/src/viewport/roofOpeningRenderDiagnostics.ts`; `packages/web/src/viewport/collectRendererDiagnostics.ts` | `packages/web/src/viewport/roofOpeningRenderDiagnostics.test.ts`; `packages/web/src/viewport/collectRendererDiagnostics.test.ts`                                                                                        | Roof-opening diagnostics cover asymmetric target-house edge alignment, occupied roof-void render-support metadata, and fallback/unsupported gable roof paths in the common renderer diagnostic contract. | Wave 13-D local commit; Wave 17-D local commit                    | Roof-opening rendering remains partial; unsupported cases are explicitly diagnosed for acceptance evidence.                                                                         |
| `BIR-J06` | `packages/web/src/viewport/roomVisualizationRenderDiagnostics.ts`; `packages/web/src/viewport/collectRendererDiagnostics.ts`; `spec/generated/renderer-support-matrix.md` | `packages/web/src/viewport/collectRendererDiagnostics.test.ts`; `packages/web/src/viewport/rendererDiagnostics.test.ts`                                                                                                | Room/space diagnostic contract covers degenerate outlines, missing room names/levels, unsupported 3D room volumes, and dropped room-separation segments | Wave 13-D local commit                                            | Does not implement richer room-volume rendering; unsupported volume requests intentionally diagnose rather than silently render physical clutter.                                   |
| `BIR-M07` | `claude-skills/sketch-to-bim/SKILL.md`; `claude-skills/sketch-to-bim/sketch_bim.py`; `spec/sketch-to-bim-methodology.md` | `packages/cli/sketchSkillHelper.smoke.test.mjs`; `pnpm --filter @bim-ai/cli exec node --test sketchSkillHelper.smoke.test.mjs`                                                                                         | Agent loop packet methodology requires source edit, dry-run/phase-run, recaptured Advisor/constructability evidence, and regenerated packet before phase acceptance.                            | Wave 13-E local commit                                            | This packet closes the machine-readable loop step; visual screenshot diff scoring remains separate semantic visual gate evidence.                                                   |
| `BIR-M06` | `spec/generated/target-house-1-required-features.json`; `scripts/audit-seed-artifacts.mjs`                             | `app/tests/test_seed_artifact_roundtrip.py`; `app/tests/test_evidence_manifest_closure.py`                                                                                                                            | `seed-artifacts/target-house-1/evidence/*`; generated required features                                                                                                                        | `25d7e1baf` parent includes target-house acceptance-pack baseline | Final clean acceptance remains `BIR-N04`/Wave 8.                                                                                                                                   |
| `BIR-N01` | `packages/cli/lib/target-house-geometry-diagnostics.mjs`; `packages/cli/generate-target-house-geometry-diagnostic.mjs` | `packages/cli/targetHouseGeometryDiagnostics.test.mjs`; `pnpm --filter @bim-ai/cli test`                                                                                                                              | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json`; `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.md` | Wave 8 Worker A local commit                                      | Current report is diagnostic-only and intentionally does not mutate seed source; it records 155 current findings for downstream correction workers.                                |
| `BIR-N02` | `seed-artifacts/target-house-1/bundle.json`; `scripts/refresh-target-house-live-evidence.py`; `packages/cli/lib/target-house-geometry-diagnostics.mjs` | `cd app && PYTHONPATH=. .venv/bin/python ../scripts/refresh-target-house-live-evidence.py --seed target-house-1`; `pnpm --filter @bim-ai/cli exec node --test targetHouseGeometryDiagnostics.test.mjs` | `seed-artifacts/target-house-1/evidence/live-run-current/evidence-freshness.json`; `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json` | Wave 12 integration                                                | Authoritative seed bundle and regenerated evidence now agree: fresh bundle hash, zero Advisor findings, zero constructability findings, and zero geometry diagnostic findings.         |
| `BIR-N03` | `app/bim_ai/seed_library.py`; `app/scripts/seed.py`; `app/bim_ai/routes_api.py`; `packages/web/src/workspace/useWorkspaceSnapshot.ts` | `app/tests/test_seed_artifact_roundtrip.py::test_seed_purge_removes_disposable_local_evidence_projects`; `app/tests/test_bootstrap_seed_library.py::test_bootstrap_marks_only_canonical_seed_project_as_seed_library`; `packages/web/src/workspace/useWorkspaceSnapshot.test.ts`; `node scripts/audit-seed-artifacts.mjs --check --json` | Canonical seed-library bootstrap flag; deterministic seed purge; seed artifact audit with only approved `target-house-1` | Wave 13-B local commit                                            | Purges known disposable local evidence projects without deleting ordinary projects; UI dropdown consumes only canonical seed-library models.                                       |
| `BIR-N04` | `packages/cli/lib/target-house-clean-pass-gate.mjs`; `scripts/gate-target-house-clean-pass.mjs`; `scripts/refresh-target-house-live-evidence.py`; `scripts/target-house-final-package.mjs` | `packages/cli/targetHouseCleanPassGate.test.mjs`; `node scripts/gate-target-house-clean-pass.mjs --evidence-dir seed-artifacts/target-house-1/evidence/live-run-current --out seed-artifacts/target-house-1/evidence/live-run-current/clean-pass-gate.json`; `node scripts/target-house-final-package.mjs --seed target-house-1 --out-dir tmp/target-house-final-package/target-house-1 --json` | `seed-artifacts/target-house-1/evidence/live-run-current/clean-pass-gate.json`; `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json`; refreshed Advisor/validation/constructability/tolerance evidence | Wave 12 integration                                                | Clean pass gate now passes and final package consumes geometry diagnostics; refreshed evidence has zero Advisor, constructability, renderer, tolerance, and target-house geometry blockers. |
| `BIR-N05` | `packages/cli/lib/target-house-evidence-acceptance.mjs`; `spec/generated/target-house-1-required-features.json`; `scripts/refresh-target-house-live-evidence.py` | `packages/cli/targetHouseEvidenceAcceptance.test.mjs`; `packages/cli/targetHouseAcceptanceCompiler.test.mjs`                                                                                                          | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-evidence-acceptance.json`; required screenshots manifest                                                                 | Wave 9 Worker A local commit                                      | Refreshed evidence passes 8/8 required views, including `front_loggia`.                                                                                                            |
| `BIR-N06` | `packages/cli/lib/target-house-evidence-acceptance.mjs`; `scripts/refresh-target-house-live-evidence.py`               | `packages/cli/targetHouseEvidenceAcceptance.test.mjs`                                                                                                                                                                 | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-evidence-acceptance.json`; `bim-data-quality.json`; `export-validation.json`                                             | Wave 9 Worker A local commit                                      | Refreshed validator data-quality rows pass 7/7.                                                                                                                                    |
| `BIR-N07` | `scripts/target-house-final-package.mjs`; `packages/web/src/viewport/rendererCostProfile.ts`; `packages/web/scripts/target-house-live-responsiveness.mjs` | `scripts/target-house-final-package.test.mjs`; `packages/web/src/viewport/rendererCostProfile.test.ts`; `packages/web/scripts/target-house-live-responsiveness.test.mjs`                                             | generated `target-house-1-performance-evidence.json` with `liveResponsivenessRequirement`; `target-house-live-responsiveness.json` from `pnpm --filter @bim-ai/web evidence:target-house-live -- --url <web-url>` or `--input <evidence.json>` | Wave 8 Worker E local commit; Wave 13-A local commit; Wave 17-E local commit | Deterministic profile evidence is accepted and final readiness now blocks missing/failed archived live responsiveness evidence; row remains Partial until a real accepted browser run is archived.       |
| `BIR-N11` | `packages/web/scripts/target-house-live-responsiveness.mjs`; `packages/web/src/lib/liveResponsivenessStability.ts`; `packages/web/src/lib/wsStability.ts` | `packages/web/scripts/target-house-live-responsiveness.test.mjs`; `packages/web/src/lib/liveResponsivenessStability.test.ts`; `packages/web/src/lib/wsStability.test.ts`                                               | machine-readable `target-house-live-browser-evidence.v1` with `target-house-live-responsiveness.v1` acceptance rows for interactions and WebSocket churn                                       | Wave 13-A local commit                                            | Validation/proof hook exists and CI can validate supplied evidence; row remains Partial until a real accepted browser run is archived.                                              |
| `BIR-N08` | `packages/cli/lib/target-house-geometry-diagnostics.mjs`; `packages/cli/generate-target-house-geometry-diagnostic.mjs`; `seed-artifacts/target-house-1/bundle.json` | `packages/cli/targetHouseGeometryDiagnostics.test.mjs`; `pnpm --filter @bim-ai/cli exec node generate-target-house-geometry-diagnostic.mjs`                                                                            | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.json`; `seed-artifacts/target-house-1/evidence/live-run-current/target-house-geometry-diagnostic.md` | Wave 12 integration                                                | Current authoritative-bundle diagnostic has `totalFindingCount=0`, `errorLevelFindingCount=0`, and all blocking categories at zero.                                                  |
| `BIR-N09` | `packages/cli/lib/sketch-semantic-visual-gate.mjs`; `packages/cli/lib/sketch-initiation.mjs`; `scripts/target-house-final-package.mjs` | `packages/cli/sketchSemanticVisualGate.test.mjs`; `node scripts/target-house-final-package.mjs --seed target-house-1 --out-dir tmp/target-house-final-package/target-house-1 --json`                                  | `seed-artifacts/target-house-1/evidence/live-run-current/acceptance-gates.json`; `seed-artifacts/target-house-1/evidence/live-run-current/visual-checklist.json`                               | Wave 12-B/C local commits + integration                           | Semantic visual gate accepts 305/305 required rows with zero failures; final package acceptance gates are clean.                                                                    |
| `BIR-N12` | `scripts/target-house-closeout-report.mjs`                                                                              | `scripts/target-house-closeout-report.test.mjs`; `node --test scripts/target-house-closeout-report.test.mjs`                                                                                                          | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-report.md`; `seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-lineage.json`          | Wave 12-E local commit                                            | Report is a closeout narrative, not final target-house acceptance; current artifact remains blocked only by tracker completion.                                                     |
| `BIR-S01` | `app/bim_ai/site_georeferencing_integrity.py`; `app/bim_ai/domain_integrity.py`                                        | `app/tests/test_site_georeferencing_integrity.py`                                                                                                                                                                     | `siteGeoreferencingIntegrityReport_v1.coordinateSystems`; normalized `domainIntegrityReport_v1` site findings                                                                                | Wave 15 Worker D local commit                                     | Partial: deterministic domain evidence exists; full authoring-route coordinate setup enforcement remains follow-up.                                                                |
| `BIR-S02` | `app/bim_ai/site_georeferencing_integrity.py`; `app/bim_ai/domain_integrity.py`                                        | `app/tests/test_site_georeferencing_integrity.py`                                                                                                                                                                     | `siteGeoreferencingIntegrityReport_v1.linkTransforms`; expected/actual transform drift findings                                                                                               | Wave 15 Worker D local commit                                     | Partial: host-side stale/unloaded and transform-drift checks are deterministic; source-document readback integration remains importer-specific.                                    |
| `BIR-S03` | `app/bim_ai/site_georeferencing_integrity.py`                                                                          | `app/tests/test_site_georeferencing_integrity.py`                                                                                                                                                                     | `importDiagnosticContract_v1` with `ok`, blocking errors, and unsupported mapping payloads                                                                                                     | Wave 15 Worker D local commit                                     | Partial: contract is stricter and machine-readable; every live importer still needs to emit this contract at its boundary.                                                         |
| `BIR-S04` | `app/bim_ai/site_georeferencing_integrity.py`                                                                          | `app/tests/test_site_georeferencing_integrity.py`                                                                                                                                                                     | `roundtripDriftReport_v1` rows with schema/severity/tracker metadata                                                                                                                           | Wave 15 Worker D local commit                                     | Partial: source/readback and link transform drift evidence exists; IFC/glTF route integration remains future work.                                                                 |
| `BIR-S05` | `app/bim_ai/site_georeferencing_integrity.py`; `app/bim_ai/domain_integrity.py`; `packages/cli/lib/target-house-geometry-diagnostics.mjs` | `app/tests/test_site_georeferencing_integrity.py`; `node --test packages/cli/targetHouseGeometryDiagnostics.test.mjs` | `siteGeoreferencingIntegrityReport_v1.siteRelationships` plus target-house geometry diagnostic rules for full building/toposolid/site footprint containment, including centroid-clean partial-off-terrain fixtures. | Wave 15 Worker D local commit; Wave 17-E local commit | Partial: site/toposolid/building relationship enforcement now checks full footprint containment; drainage and exterior stair/rail semantics still need domain-specific rules.                                  |
| `BIR-S06` | `app/bim_ai/site_georeferencing_integrity.py`; `app/bim_ai/domain_integrity.py`                                        | `app/tests/test_site_georeferencing_integrity.py`                                                                                                                                                                     | `siteGeoreferencingIntegrityReport_v1.multiBuilding`                                                                                                                                           | Wave 7 Worker D local commit                                      | Building grouping currently uses explicit `props.buildingId`; richer campus model semantics remain future work.                                                                    |
| `BIR-T03` | `scripts/target-house-closeout-report.mjs`                                                                              | `scripts/target-house-closeout-report.test.mjs`; `node --test scripts/target-house-closeout-report.test.mjs`                                                                                                          | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-lineage.json`; lineage digest embedded in `target-house-closeout-report.md`                                      | Wave 12-E local commit                                            | Lineage records current evidence paths/digests and final blockers; it does not certify target-house acceptance while blockers remain.                                               |
| `BIR-T06` | `scripts/target-house-closeout-report.mjs`                                                                              | `scripts/target-house-closeout-report.test.mjs`; `node --test scripts/target-house-closeout-report.test.mjs`                                                                                                          | `seed-artifacts/target-house-1/evidence/live-run-current/target-house-closeout-report.md`                                                                                                       | Wave 12-E local commit                                            | Narrative generator reports proof and blockers; it intentionally distinguishes clean Advisor/constructability evidence from full target-house acceptance.                           |
| `BIR-T02` | `claude-skills/sketch-to-bim/sketch_bim.py`; `claude-skills/sketch-to-bim/tools.json`; `app/bim_ai/integrity_preflight.py`; `app/bim_ai/routes_integrity.py` | `packages/cli/sketchSkillHelper.smoke.test.mjs`; `pnpm --filter @bim-ai/cli exec node --test sketchSkillHelper.smoke.test.mjs`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_integrity_preflight.py -q` | `sketch-to-bim.agent-loop-packet.v1` plus `integrityPreflightProvenance_v1` records `findingId`, affected elements, source command ids, command-log transaction refs, recipe rows, agent wave, commit, phase packet, and next actions where available. | Wave 13-E local commit; Wave 18-E local commit | Traces findings to available source artifacts; historical agent wave/commit attribution depends on command-log/evidence metadata being present.                                    |
| `BIR-M10` | `spec/sketch-to-bim-agent-workflow-templates.md`; `claude-skills/sketch-to-bim/SKILL.md`; `claude-skills/sketch-to-bim/tools.json` | `node --test scripts/target-house-closeout-report.test.mjs`; `node --test scripts/benchmarks/suite.test.mjs`                                                                                                          | Agent workflow prompt, evidence gate checklist, stale-check schema, and wave closeout template                                                                                                  | Wave 16-E local commit                                            | Partial: templates are documented and referenced by the skill; launch tooling still needs to inject them automatically for every worker.                                           |
| `BIR-T01` | `spec/generated/target-house-1-required-features.json`; `scripts/target-house-closeout-report.mjs`                       | `scripts/target-house-closeout-report.test.mjs`; `node --test scripts/target-house-closeout-report.test.mjs`                                                                                                          | `target-house-feature-coverage-dashboard.v1` rows include feature ids, phases, required views, selectors/element coverage, acceptance status, and blockers.                                    | Wave 16-E local commit                                            | Partial: many target-house rows still use semantic selectors because exact live element-id coverage is not fully extracted.                                                        |
| `BIR-T04` | `claude-skills/sketch-to-bim/sketch_bim.py`; `scripts/verify-sketch-seed-artifacts.mjs`; `claude-skills/sketch-to-bim/tools.json` | `node --test scripts/verify-sketch-seed-artifacts.test.mjs`; `python3 claude-skills/sketch-to-bim/sketch_bim.py stale-check --seed target-house-1`                                                                    | `tool-run-summary.json` freshness keys for model revision, Advisor rule digest, renderer support matrix, seed source digest, target spec digest, and git head                                  | Wave 16-E local commit                                            | Partial: CLI/CI invalidation exists; product UI/API stale-evidence presentation remains future work.                                                                               |
| `BIR-T05` | `scripts/target-house-closeout-report.mjs`                                                                              | `scripts/target-house-closeout-report.test.mjs`; `node --test scripts/target-house-closeout-report.test.mjs`                                                                                                          | `target-house-closeout-lineage.json.featureCoverageDashboard`; markdown `Feature Coverage Dashboard` section                                                                                    | Wave 16-E local commit                                            | Partial: dashboard data is generated for target-house closeout; no interactive product dashboard yet.                                                                              |
| `BIR-O04` | `spec/sketch-to-bim-agent-workflow-templates.md`; `claude-skills/sketch-to-bim/sketch_bim.py`; `scripts/verify-sketch-seed-artifacts.mjs`; `scripts/target-house-final-package.mjs` | `node --test scripts/verify-sketch-seed-artifacts.test.mjs`; `node --test scripts/target-house-closeout-report.test.mjs`; `node --test scripts/target-house-final-package.test.mjs` | Rehearsal gate checklist plus deterministic target-house final-package `target-house-acceptance-rehearsal-gate.v1` that blocks stale evidence, visual invalidity, clean-pass/geometry/tolerance/performance failures, and missing/failed live responsiveness evidence. | Wave 16-E local commit; Wave 17-E local commit | Partial: recognized rehearsal workflow is documented and final-package gated, but no actual end-to-end disposable rehearsal was run in this change.                                                       |
| `BIR-O05` | `scripts/benchmarks/suite.mjs`; `spec/benchmarks/suite.json`; `spec/benchmarks/simple-single-storey-house/scenario.json`; `spec/benchmarks/two-storey-house-with-stair/scenario.json` | `scripts/benchmarks/suite.test.mjs`; `node --test scripts/benchmarks/suite.test.mjs`                                                                                                                                    | Benchmark suite summary now requires `integrity`, `rendererDiagnostics`, `performance`, and `acceptance` rows in addition to Advisor/visual/export/semantic diff.                              | Wave 16-E local commit                                            | Partial: core scenarios carry rows; broader professional benchmark suite still needs full live evidence refresh.                                                                   |
| `BIR-O06` | `.github/workflows/ci.yml`; `scripts/audit-bim-integrity-tracker.mjs`; `scripts/benchmarks/suite.mjs`; `packages/web/src/viewport/rendererDiagnostics.test.ts` | `app/tests/test_bim_integrity_tracker_audit.py`; `packages/web/src/viewport/rendererDiagnostics.test.ts`; `node --test scripts/benchmarks/suite.test.mjs`                                                              | CI governance drift step checks tracker generated status, benchmark suite metadata, and renderer support matrix drift; Python tests keep Advisor rule ledger drift covered.                    | Wave 16-E local commit                                            | Partial: generated-doc drift gates are present but still split across JS/Python jobs rather than one unified gate command.                                                        |
| `BIR-W03` | `spec/bim-integrity-rendering-sketch-methodology-tracker.md`; `scripts/audit-bim-integrity-tracker.mjs`                 | `app/tests/test_bim_integrity_tracker_audit.py`; `node scripts/audit-bim-integrity-tracker.mjs --check`                                                                                                              | Wave 16-E adds implementation evidence rows for `BIR-M10`, `BIR-T01`, `BIR-T04`, `BIR-T05`, `BIR-O04`, `BIR-O05`, `BIR-O06`, and `BIR-W04`.                                                  | Wave 16-E local commit                                            | Partial: owned rows have evidence; tracker-wide Partial rows still need full implementation evidence before they can become Done.                                                  |
| `BIR-W04` | `spec/sketch-to-bim-agent-workflow-templates.md`; `scripts/target-house-closeout-report.mjs`                            | `node --test scripts/target-house-closeout-report.test.mjs`; `node scripts/audit-bim-integrity-tracker.mjs --check`                                                                                                   | Reusable wave closeout markdown template plus existing target-house closeout report/lineage generator                                                                                          | Wave 16-E local commit                                            | Partial: template exists; wave parent automation still needs to require an attached closeout artifact per wave.                                                                    |
| `BIR-P01` | `app/bim_ai/model_integrity.py`                                                                                        | `app/tests/test_model_integrity_invariants.py`; `pytest app/tests/test_model_integrity_invariants.py --no-cov`                                                                                                        | `modelIntegrityInvariantContract_v1` unit/type/schema, role, nested-reference, and level/storey contract fields                                                                                 | Wave 7 Worker A local commit; Wave 15 parent integration           | Partial: deterministic contract data is richer and machine-readable; generated standalone rule ledger remains follow-up.                                                           |
| `BIR-P03` | `app/bim_ai/model_integrity.py`                                                                                        | `app/tests/test_model_integrity_invariants.py`                                                                                                                                                                        | `modelIntegrityUnitsCoordinateNormalization_v1` findings                                                                                                                                       | Wave 7 Worker A local commit                                      | Covers deterministic snapshot checks; full command-surface enforcement remains future integration.                                                                                 |
| `BIR-P06` | `app/bim_ai/model_integrity.py`                                                                                        | `app/tests/test_model_integrity_invariants.py`                                                                                                                                                                        | `modelIntegrityTypeInstanceInheritance_v1` digest and rows                                                                                                                                     | Wave 7 Worker A local commit                                      | Resolves core type relations; deeper parameter schemas and content library rules remain `BIR-V01`/`BIR-V02`.                                                                       |
| `BIR-P07` | `app/bim_ai/model_integrity.py`                                                                                        | `app/tests/test_model_integrity_invariants.py`                                                                                                                                                                        | `modelIntegritySchemaMigrationCompatibility_v1` diagnostics                                                                                                                                    | Wave 7 Worker A local commit                                      | Unsupported versions fail with diagnostics; no broad auto-migration pipeline yet.                                                                                                  |
| `BIR-P08` | `app/bim_ai/model_integrity.py`                                                                                        | `app/tests/test_model_integrity_invariants.py`; `pytest app/tests/test_model_integrity_invariants.py --no-cov`                                                                                                        | `modelIntegritySmokeCommandEvidence_v1` CLI/API evidence, strict-role smoke, coverage metadata, role counts, and digest                                                                        | Wave 7 Worker A local commit; Wave 15 parent integration           | Partial: helper is machine-readable for UI/API/CLI/MCP consumers; dedicated public CLI/REST/MCP endpoint wiring remains follow-up.                                                 |
| `BIR-V01` | `app/bim_ai/model_integrity.py`; `app/bim_ai/elements.py`; `app/bim_ai/commands.py`                                    | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_family_content_integrity.py app/tests/test_model_integrity_invariants.py -q`                                                                                 | `familyTypeContentIntegrity_v1`; required-dimension parameter/schema validation; family schema findings with tracker ids/recommendations; wall/floor/roof type-layer material consistency checks | Wave 15 Worker E local commit; Wave 18-D local commit             | Partial: strict schema validation exists and is exposed through invariant smoke evidence; bundled/live catalogs still need complete metadata migration.                             |
| `BIR-V02` | `app/bim_ai/model_integrity.py`; `app/bim_ai/elements.py`; `app/bim_ai/commands.py`                                    | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_family_content_integrity.py app/tests/test_model_integrity_invariants.py -q`                                                                                 | Instance override findings for unknown, non-overridable, min/max-invalid, unscheduled, wall-host geometry-invalid, and material-slot-inconsistent overrides with tracker ids/recommendations   | Wave 15 Worker E local commit; Wave 18-D local commit             | Partial: deterministic override checks are schema-driven; schedule compatibility currently uses declared `scheduleFields`, not derived schedule/export row readback.                |
| `BIR-V03` | `app/bim_ai/model_integrity.py`; `app/bim_ai/elements.py`; `app/bim_ai/commands.py`                                    | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_invariants.py -q`                                                                                                                           | `model_integrity_asset_catalog_metadata_incomplete`; `model_integrity_asset_catalog_param_schema_invalid`                                                                                      | Wave 15 Worker E local commit                                     | Partial: content-asset metadata checks exist; bundled catalog files are not yet all strict-complete.                                                                                |
| `BIR-V04` | `app/bim_ai/model_integrity.py`; `app/bim_ai/model_integrity_hosting.py`; `app/bim_ai/engine_commit.py`; `app/bim_ai/elements.py`; `app/bim_ai/commands.py`; `seed-artifacts/target-house-1/bundle.json` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_family_content_integrity.py app/tests/test_model_integrity_invariants.py -q`; `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_hosting.py app/tests/test_model_integrity_commit_preflight.py app/tests/test_p0_integrity_fixture_corpus.py -q`; `pnpm --filter @bim-ai/cli exec node generate-target-house-geometry-diagnostic.mjs`; `node scripts/gate-target-house-clean-pass.mjs --evidence-dir seed-artifacts/target-house-1/evidence/live-run-current --out seed-artifacts/target-house-1/evidence/live-run-current/clean-pass-gate.json` | `model_integrity_asset_placement_support_invalid`; `model_integrity_asset_placement_floating`; `model_integrity_asset_placement_embedded_without_intent`; `model_integrity_asset_placement_circulation_overlap`; commit preflight now blocks floating placed assets and asset/stair circulation overlap before persistence; `placed-bed-upper` moved clear of `main-stair` footprint. | Wave 15 Worker E local commit; Wave 16 parent target-house correction; Wave 17-A local commit | Partial: support/floating/embed/circulation-overlap checks are deterministic for declared supports and commit preflight; oriented footprint/recess geometry and full asset extents need deeper asset geometry data. |
| `BIR-V05` | `app/bim_ai/model_integrity.py`; `app/bim_ai/elements.py`; `app/bim_ai/commands.py`                                    | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_model_integrity_invariants.py -q`                                                                                                                           | `model_integrity_family_render_export_parity_gap`; family parity fields in `modelIntegrityInvariantContract_v1`; `familyTypeContentIntegrity_v1.digestSha256`                                | Wave 15 Worker E local commit                                     | Partial: parity evidence is machine-readable before export; actual IFC/glTF/readback manifest comparison remains export-pipeline follow-up.                                        |
| `BIR-P02` | `app/bim_ai/model_integrity.py`                                                                                        | `pytest app/tests/test_model_integrity_invariants.py --no-cov`                                                                                                                                                        | `model_integrity_unresolved_reference` / `model_integrity_reference_wrong_kind` for root and nested refs                                                                                       | Wave 15 Worker A local commit                                     | Partial: snapshot checks cover general fields; full schema-derived nullable/reference generation remains follow-up.                                                                |
| `BIR-P04` | `app/bim_ai/model_integrity.py`                                                                                        | `pytest app/tests/test_model_integrity_invariants.py --no-cov`                                                                                                                                                        | Level parent elevation, base/top ordering, physical height, and host-level mismatch findings                                                                                                   | Wave 15 Worker A local commit                                     | Partial: deterministic level/storey checks exist; richer envelope/floor containment remains separate domain-integrity work.                                                       |
| `BIR-P05` | `app/bim_ai/model_integrity.py`                                                                                        | `pytest app/tests/test_model_integrity_invariants.py --no-cov`                                                                                                                                                        | Physical/nonphysical role leakage findings plus smoke `roleCounts`                                                                                                                             | Wave 15 Worker A local commit                                     | Partial: explicit-role evidence exists; authoring/export category enforcement across every live surface remains follow-up.                                                         |
| `BIR-Q01` | `app/bim_ai/transaction_safety.py`; `app/bim_ai/routes_api.py`; `app/bim_ai/routes_commands.py`                        | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_transaction_safety.py -q`; `python -m ruff check app/bim_ai/transaction_safety.py app/bim_ai/routes_api.py app/bim_ai/routes_commands.py app/tests/test_transaction_safety.py` | `transactionSafety_v1` parent-revision decisions plus deterministic `transactionPreflightAudit_v1` gate evidence on CMD-v3 and raw command/bundle dry-run and commit payloads                    | Wave 15 Worker B local commit; Wave 18-E local commit             | Partial: explicit agent/MCP bundle commits are gated; broader CLI/MCP tool wrappers still need end-to-end parity evidence.                                                         |
| `BIR-Q02` | `app/bim_ai/transaction_safety.py`; `app/bim_ai/routes_api.py`; `app/bim_ai/routes_commands.py`                        | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_transaction_safety.py -q`; `python -m ruff check app/bim_ai/transaction_safety.py app/bim_ai/routes_commands.py app/tests/test_transaction_safety.py` | `undoRedoContract_v1` validation result, transaction safety metadata, and `undoRedoIntegrityMetadata_v1` preservation across undo/redo route metadata                                           | Wave 15 Worker B local commit; Wave 18-E local commit             | Partial: route-level undo/redo metadata is stronger; full multi-user undo-stack conflict replay coverage remains follow-up.                                                        |
| `BIR-Q03` | `app/bim_ai/transaction_safety.py`; `app/bim_ai/routes_api.py`; `app/bim_ai/routes_commands.py`                      | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_transaction_safety.py -q`; `python -m ruff check app/bim_ai/transaction_safety.py app/bim_ai/routes_api.py app/bim_ai/routes_commands.py` | `revision_conflict` decision payload returned as structured CMD-v3 detail before mutation; optional legacy raw command/bundle `parentRevision` surfaces stale-edit conflicts                    | Wave 15 Worker B local commit; Wave 18-E local commit             | Partial: raw UI command endpoints retain current-revision fallback for legacy clients that omit parent revision.                                                                  |
| `BIR-Q04` | `app/bim_ai/transaction_safety.py`                                                                                     | `app/tests/test_transaction_safety.py`                                                                                                                                                                                | fix-safety classification rows                                                                                                                                                                 | Wave 7 Worker B local commit                                      | Command taxonomy is conservative and should expand with Advisor rules.                                                                                                             |
| `BIR-Q05` | `app/bim_ai/transaction_safety.py`; `app/bim_ai/routes_api.py`; `app/bim_ai/routes_commands.py`; `app/bim_ai/routes_integrity.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_transaction_safety.py app/tests/test_integrity_preflight.py -q`; `python -m ruff check app/bim_ai/transaction_safety.py app/bim_ai/routes_api.py app/bim_ai/routes_commands.py app/bim_ai/routes_integrity.py app/tests/test_transaction_safety.py app/tests/test_integrity_preflight.py` | `dryRunEvidence_v1` digest rows emitted by dry-run surfaces, enforced for explicit agent/MCP bundle commits, and embedded in remediation dry-run commit request payloads                         | Wave 15 Worker B local commit; Wave 18-E local commit             | Partial: product MCP/CLI wrappers still need to pass `actorKind` and replay `dryRunEvidence` through their public tool schemas.                                                    |
| `BIR-Q06` | `app/bim_ai/transaction_safety.py`; `app/bim_ai/routes_api.py`; `app/bim_ai/routes_commands.py`; `app/bim_ai/integrity_preflight.py`; `app/bim_ai/routes_integrity.py` | `PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_transaction_safety.py app/tests/test_integrity_preflight.py -q`; `python -m ruff check app/bim_ai/transaction_safety.py app/bim_ai/integrity_preflight.py app/bim_ai/routes_integrity.py app/tests/test_transaction_safety.py app/tests/test_integrity_preflight.py` | `agentRemediationProposal_v1`, `transactionPreflightAudit_v1`, and `integrityPreflightProvenance_v1` source-command audit rows                                                                  | Wave 15 Worker B local commit; Wave 18-E local commit             | Partial: evidence paths are validated as strings; artifact existence and provenance storage beyond route metadata remain future gates.                                             |
| `BIR-Q07` | `app/bim_ai/transaction_safety.py`; `app/bim_ai/routes_api.py`; `app/bim_ai/routes_commands.py`                        | `pytest app/tests/test_transaction_safety.py app/tests/api/test_apply_bundle_route.py --no-cov`                                                                                                                       | required permission scope inference returned in transaction safety payloads                                                                                                                     | Wave 15 Worker B local commit                                     | Partial: approval prompting remains client/MCP integration work.                                                                                                                   |
| `BIR-Q08` | `app/bim_ai/transaction_safety.py`                                                                                     | `app/tests/test_transaction_safety.py`                                                                                                                                                                                | rollback/retry guidance in failed decisions                                                                                                                                                    | Wave 7 Worker B local commit                                      | Runtime transaction rollback remains covered by existing commit paths until integrated.                                                                                            |
| `BIR-W02` | `scripts/audit-bim-integrity-tracker.mjs`                                                                              | `app/tests/test_bim_integrity_tracker_audit.py`                                                                                                                                                                       | `spec/generated/bim-integrity-tracker-status.md`                                                                                                                                               | `25d7e1baf` parent includes status script baseline                | This wave extends accounting, but not every tracker row has full implementation evidence yet.                                                                                      |
| `BIR-W05` | `scripts/audit-bim-integrity-tracker.mjs` | `app/tests/test_bim_integrity_tracker_audit.py` | `spec/generated/bim-integrity-tracker-status.md` | Wave 7 Worker E local commit | Gate covers `Done` tracker status; it does not certify `Partial` rows. |

## Proposed Work Waves

Each wave assumes roughly five parallel agents with disjoint ownership. Agents
should commit their own work, then an integration pass should run tests, resolve
conflicts, update tracker statuses, commit, and push.

### Wave 1: P0 BIM Integrity Foundation

Goal: close `M1`.

| Agent | Ownership                          | Primary items                                                   |
| ----- | ---------------------------------- | --------------------------------------------------------------- |
| W1-A  | Rule taxonomy and registry         | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-A07`                      |
| W1-B  | Hosted openings and helper leakage | `BIR-C01` through `BIR-C05`, target-house detached-door fixture |
| W1-C  | Envelope/floor/room containment    | `BIR-B02`, `BIR-C02`, `BIR-D01` through `BIR-D03`               |
| W1-D  | Authoring/command guards           | `BIR-B01`, `BIR-B04`, `BIR-B05`, `BIR-B06`                      |
| W1-E  | Advisor parity and CLI/API surface | `BIR-A04`, `BIR-H01` through `BIR-H04`, `BIR-O01`, `BIR-O02`    |

Exit: the current detached-door/access-wall class cannot pass with "No
findings" through UI, CLI, or API.

### Wave 2: P0 Renderer Fidelity Foundation

Goal: close `M2`.

| Agent | Ownership                                     | Primary items                                          |
| ----- | --------------------------------------------- | ------------------------------------------------------ |
| W2-A  | Renderer support matrix and diagnostic schema | `BIR-I01`, `BIR-I02`, `BIR-I06`, `BIR-I07`             |
| W2-B  | Roof/opening rendering                        | `BIR-J02`, `BIR-F02`, target-house roof court golden   |
| W2-C  | Wall hosted cuts                              | `BIR-J01`, `BIR-C04`, door/window/wall-opening goldens |
| W2-D  | Slab/stair/railing rendering                  | `BIR-J03`, `BIR-J04`, `BIR-E01`, `BIR-E03`             |
| W2-E  | Visual golden harness                         | `BIR-J09`, `BIR-O03`, screenshot/canvas checks         |

Exit: target-house-critical renderer failures are visible as diagnostics and
cannot silently pass acceptance.

### Wave 3: P0 Sketch Methodology Gate

Goal: close `M3`.

| Agent | Ownership                         | Primary items                                                      |
| ----- | --------------------------------- | ------------------------------------------------------------------ |
| W3-A  | Methodology naming and docs       | `BIR-M01`, `BIR-M08`, update `SKILL.md` and methodology references |
| W3-B  | Phase packet evidence extensions  | `BIR-M02`, `BIR-M04`, `BIR-M05`                                    |
| W3-C  | Target-house acceptance compiler  | `BIR-M06`, `BIR-N05`                                               |
| W3-D  | Semantic checklist and drift loop | `BIR-M03`, `BIR-M07`                                               |
| W3-E  | Seed artifact cleanliness         | `BIR-M09`, `BIR-N03`, acceptance tests                             |

Exit: an Advisor-clean but visually/specifically wrong sketch model cannot be
reported as accepted by the sketch-to-BIM skill.

### Wave 4: P1 Domain Depth

Goal: close `M4`.

| Agent | Ownership                             | Primary items               |
| ----- | ------------------------------------- | --------------------------- |
| W4-A  | Rooms/access/egress                   | `BIR-D04` through `BIR-D07` |
| W4-B  | Floors/stairs/railings/vertical graph | `BIR-E02` through `BIR-E07` |
| W4-C  | Roof/envelope/loggia/facade           | `BIR-F03` through `BIR-F07` |
| W4-D  | Structure-lite and MEP-lite           | `BIR-G01` through `BIR-G04` |
| W4-E  | Fire/accessibility/code profiles      | `BIR-G05` through `BIR-G07` |

Exit: ordinary small-house project-initiation BIM has robust deterministic
health coverage across architecture, structure-lite, and MEP-lite.

### Wave 5: Rendering/Exchange Completeness

Goal: close `M5`.

| Agent | Ownership                     | Primary items                            |
| ----- | ----------------------------- | ---------------------------------------- |
| W5-A  | IFC/glTF manifest diagnostics | `BIR-K01`, `BIR-K03`                     |
| W5-B  | Export readback               | `BIR-K02`, `BIR-K04`                     |
| W5-C  | Schedules/sheets evidence     | `BIR-K05`, `BIR-K06`                     |
| W5-D  | Materials/lenses/families     | `BIR-J05`, `BIR-J07`, `BIR-J08`          |
| W5-E  | IDS/BIR validation            | `BIR-K07`, methodology exchange evidence |

Exit: viewport and exchange artifacts agree for all supported target-house and
benchmark features, or unsupported gaps are explicit.

W5-D evidence, 2026-05-19:

- Added `packages/web/src/viewport/elementRenderFeatureStatus.ts` as a pure
  per-element status helper for material fallback/slots, hosted-family
  dimensions, loaded-family proxy fallback, and UI/saved-view lens ghosting.
- Added `packages/web/src/viewport/elementRenderFeatureStatus.test.ts` covering
  `BIR-I05`, `BIR-J05`, `BIR-J07`, and `BIR-J08`.
- Focused test: `pnpm --filter @bim-ai/web exec vitest run src/viewport/elementRenderFeatureStatus.test.ts`.

W5-C evidence update:

- Added `app/bim_ai/schedule_sheet_exchange_evidence.py` with deterministic
  `scheduleSheetExchangeEvidence_v1` checks for room, door, window,
  material-assembly, quantity-takeoff, sheet, and view schedules against live
  model rows and documentation export schedule digests.
- Added sheet/view evidence checks for deterministic sheet rows, viewport
  `viewRef` resolution, plan/section viewport scale presence, sheet SVG digest
  drift, model revision drift, render bundle camera/material summaries, and
  missing render material texture assets.
- Added `app/tests/test_schedule_sheet_exchange_evidence.py`.
- Verification: `PYTEST_ADDOPTS=--no-cov python -m pytest
app/tests/test_schedule_sheet_exchange_evidence.py`; `python -m ruff check
app/bim_ai/schedule_sheet_exchange_evidence.py
app/tests/test_schedule_sheet_exchange_evidence.py`.

W6-C evidence update:

- Added `packages/web/src/lib/wsStability.ts` to classify Vite proxy socket
  failures and app WebSocket close/reconnect outcomes without touching dirty
  WebSocket URL/proxy consumer edits from parallel agents.
- Classification: Vite proxy `EPIPE`/`ECONNRESET` are benign and silent;
  unexpected proxy errors remain actionable/logged. App WebSocket transient
  closes are benign reconnects with bounded backoff, hidden-tab reconnects are
  deferred to avoid churn, exhausted attempts become actionable offline state,
  and `4403`/`4404` stop reconnect loops.
- Verification: `pnpm --filter @bim-ai/web vitest run
src/lib/wsStability.test.ts src/lib/wsReconnect.test.ts`.

### Wave 6: Performance And UX Stability

Goal: close `M6`.

W6-B evidence, 2026-05-19:

- Added `packages/web/src/viewport/rendererCostProfile.ts` as a pure renderer
  profiling helper for `orbit`, `select`, `lens-switch`, `advisor-toggle`, and
  `update` workloads, including budget ratios, status, dominant factors, and
  `renderer-performance` diagnostics.
- Added stress-budget diagnostics for large element counts, hosted openings,
  linked models / expanded linked elements, evidence views, and over-budget
  workload estimates.
- Added `packages/web/src/viewport/rendererCostProfile.test.ts` covering
  deterministic workload profiling, stress diagnostics, and changed-element
  update scaling for `BIR-L02` and `BIR-J10`.
- Focused test: `pnpm --filter @bim-ai/web exec vitest run
src/viewport/rendererCostProfile.test.ts src/viewport/rendererDiagnostics.test.ts`.

| Agent | Ownership                           | Primary items          |
| ----- | ----------------------------------- | ---------------------- |
| W6-A  | Advisor profiling/incremental rules | `BIR-L01`, `BIR-L04`   |
| W6-B  | Renderer profiling                  | `BIR-L02`, `BIR-J10`   |
| W6-C  | WebSocket/dev-server stability      | `BIR-L03`              |
| W6-D  | Background jobs/caching             | `BIR-L05`              |
| W6-E  | UI degradation safeguards           | `BIR-L06`, smoke tests |

Exit: the richer diagnostics do not make normal modeling sluggish.

W6-E evidence update:

- Added `packages/web/src/viewport/diagnosticSchedulingPolicy.ts` with deterministic scheduling, throttling, degradation, and input-protection decisions for Advisor, renderer diagnostics, diagnostic overlays, and evidence capture.
- Covered ordinary idle models, active pointer/camera/selection, recent input grace, stale/deferred budgets, over-budget suspension, diagnostic volume caps, and hidden-page suspension.
- Verification: `pnpm --filter @bim-ai/web exec vitest run src/viewport/diagnosticSchedulingPolicy.test.ts`.

W6-D evidence update:

- Added `app/bim_ai/jobs/heavy_diagnostics.py` with deterministic
  `heavyDiagnosticMetadata_v1` and `heavyDiagnosticJobEvidence_v1` helpers for
  geometry, IFC export, glTF export, and render jobs.
- Heavy diagnostic cache keys include diagnostic kind, job kind, model id,
  model revision, canonicalized inputs, sorted check ids, source digests, and
  tool versions so repeated equivalent requests can reuse cached evidence.
- Extended backend job types/queue with progress snapshots, cancellation
  request metadata, and `cacheEvidence` attachment without touching routes or
  jobs UI.
- Verification: `PYTEST_ADDOPTS=--no-cov python -m pytest
tests/jobs/test_heavy_diagnostics.py tests/jobs/test_job_queue.py`;
  `PYTEST_ADDOPTS=--no-cov python -m pytest tests/api/test_jobs_routes.py
tests/api/test_jobs_routes_api_router.py`; `python -m ruff check
bim_ai/jobs/heavy_diagnostics.py bim_ai/jobs/types.py bim_ai/jobs/queue.py
tests/jobs/test_heavy_diagnostics.py tests/jobs/test_job_queue.py`.

### Wave 7: Platform-Grade BIM Guarantees

Goal: close `M7`.

| Agent | Ownership                           | Primary items               |
| ----- | ----------------------------------- | --------------------------- |
| W7-A  | Kernel invariants and units         | `BIR-P01` through `BIR-P08` |
| W7-B  | Transaction/collaboration safety    | `BIR-Q01` through `BIR-Q08` |
| W7-C  | 2D documentation fidelity           | `BIR-R01` through `BIR-R06` |
| W7-D  | Site/georeferencing/imports         | `BIR-S01` through `BIR-S06` |
| W7-E  | Provenance, UX, content, accounting | `BIR-T01` through `BIR-W05` |

Exit: the platform has explicit invariants, traceability, safe remediation,
collaboration safety, 2D/documentation fidelity, content quality, and completion
accounting.

W7-C evidence update:

- Added `packages/web/src/workspace/sheets/documentationFidelityContracts.ts`
  with pure deterministic contracts for `BIR-R01` through `BIR-R06`: plan
  primitive/diagnostic coverage, section/elevation evidence coverage, sheet
  viewport metadata/evidence links, annotation/dimension live-reference
  integrity, documentation export digest parity with unsupported-feature
  listing, and 2D golden fixture readiness across plan/section/elevation/sheet.
- Exported the contract helpers from the sheets barrel so UI, evidence readouts,
  and future backend parity shims can consume the same pass/warn/fail rows.
- Verification: `pnpm --filter @bim-ai/web exec vitest run
src/workspace/sheets/documentationFidelityContracts.test.ts`; `pnpm --filter
@bim-ai/web typecheck`.

### Wave 8: Target-House Rerun Readiness And Closure

Goal: close `M8`.

W8-C evidence update:

- Added `target-house.clean-pass-gate.v1`, a deterministic gate for
  `target-house-1` evidence that reads the non-empty live Advisor, validation,
  constructability, evidence-package, and tolerance-ledger artifacts.
- The gate fails on P0/error diagnostics, renderer blocker statuses, and any
  warning group without a complete tolerance row (`reason`, `owner`,
  `expiryCondition`, and `evidenceLinks`).
- Current evidence gate result: blocked with 0 P0 Advisor/integrity errors, 49
  warning instances across 13 untolerated warning groups, and 3 renderer
  full-raster blocker statuses. Command:
  `node scripts/gate-target-house-clean-pass.mjs --evidence-dir seed-artifacts/target-house-1/evidence/live-run-current --out /tmp/target-house-clean-pass-gate.json`.

| Agent | Ownership                                   | Primary items                 |
| ----- | ------------------------------------------- | ----------------------------- |
| W8-A  | Current geometry diagnostic report          | `BIR-N01`                     |
| W8-B  | Seed source correction                      | `BIR-N02`                     |
| W8-C  | Final Advisor/integrity/renderer clean pass | `BIR-N04`                     |
| W8-D  | Visual/evidence acceptance                  | `BIR-N05`, `BIR-N06`          |
| W8-E  | Performance and final package               | `BIR-N07`, final commits/push |

Exit: `target-house-1` is regenerated and accepted at current head with clean
integrity, renderer, Advisor, evidence, export, and methodology gates.

W8-D evidence update:

- Added `target-house-evidence-acceptance.v1`, a deterministic validator for
  target-house visual evidence and BIM data quality.
- The compiled pack now requires a dedicated `front_loggia` evidence view in
  addition to main, front, rear/right, roof court, ground plan, upper plan, and
  wire diagnostics.
- Current machine-readable report:
  `seed-artifacts/target-house-1/evidence/live-run-current/target-house-evidence-acceptance.json`.
  Refreshed Wave 9 evidence passes `BIR-N05` with 8/8 visual rows and passes
  `BIR-N06` with 7/7 data-quality rows. Clean target-house acceptance remains
  blocked by `BIR-N04` fresh integrity/constructability findings, not by stale
  visual evidence.
- Verification: `pnpm --filter @bim-ai/cli exec node --test
targetHouseAcceptanceCompiler.test.mjs targetHouseEvidenceAcceptance.test.mjs`.

### Wave 11: Target-House Core Clean-Pass Source Corrections

Goal: remove the fresh Advisor/constructability blockers that prevented the
core clean-pass gate from passing.

| Agent | Ownership                                      | Primary items                  |
| ----- | ---------------------------------------------- | ------------------------------ |
| W11-A | Floor containment regression                    | `BIR-N02`, `BIR-N04`           |
| W11-B | Egress graph regression                         | `BIR-D05`, `BIR-N04`           |
| W11-C | Schedule/data-quality evidence refresh          | `BIR-N06`                      |
| W11-D | Room wall topology gate                         | `BIR-D06`, `BIR-N04`           |
| W11-E | Stair/final evidence refresh                    | `BIR-E02`, `BIR-N04`, `BIR-N07` |

W11 integration status:

- Refreshed deterministic offline evidence from the authoritative
  `seed-artifacts/target-house-1/bundle.json` at current head.
- `node scripts/gate-target-house-clean-pass.mjs --evidence-dir
  seed-artifacts/target-house-1/evidence/live-run-current --out
  seed-artifacts/target-house-1/evidence/live-run-current/clean-pass-gate.json`
  passes with zero P0 Advisor/integrity errors, zero constructability warnings,
  zero renderer blockers, and zero unresolved tolerance groups.
- `target-house-geometry-diagnostic.json` now reports zero detached/flying,
  helper-leakage, out-of-envelope, unsupported-renderer, and sketch-critical
  findings from the authoritative bundle. `BIR-N08` is closed.
- `acceptance-gates.json` now reports zero unchecked semantic visual checklist
  failures, with 305/305 required rows accepted. `BIR-N09` is closed.
- `target-house-final-package.mjs` now has clean evidence, performance,
  acceptance, clean-pass, and geometry-diagnostic checks; the only final-package
  blocker is `tracker_not_done`, so `BIR-N10` remains Partial by design until
  the exhaustive tracker is complete.

### Wave 12: Target-House Geometry, Semantic Visual, And Final Package

Goal: close `M8`.

Scope: close the remaining target-house geometry, semantic visual, final-package,
live-responsiveness, and closeout-report blockers without weakening the layer
contract.

| Agent | Ownership                                                 | Primary items                  |
| ----- | --------------------------------------------------------- | ------------------------------ |
| W12-A | Geometry diagnostic source fixes and fixture regressions   | `BIR-N08`, `BIR-O02`           |
| W12-B | Semantic visual checklist evidence/disposition compiler    | `BIR-M03`, `BIR-N09`, `BIR-T01` |
| W12-C | Final-package gate integration for geometry diagnostics    | `BIR-N04`, `BIR-N08`, `BIR-N10` |
| W12-D | Live browser responsiveness and WebSocket acceptance       | `BIR-L02`, `BIR-L03`, `BIR-N11` |
| W12-E | Target-house closeout report and lineage/evidence narrative | `BIR-N12`, `BIR-T03`, `BIR-T06` |

Exit: final package is either fully ready or has only explicitly documented,
user-approved tolerances with owner, evidence, and expiry. No wave may mark M8
complete while geometry diagnostic errors or unchecked semantic visual rows
remain.

### Wave 13: Live Readiness, Seed Hygiene, And Platform Rule Depth

Goal: close the remaining target-house readiness blockers that are not already
covered by clean offline evidence, while moving the broader platform tracker out
of target-house-specific closure.

Scope: dispatch five independent workers. Each worker must commit locally,
avoid unrelated dirty files, and update the tracker/evidence rows for completed
items.

| Agent | Ownership                                             | Primary items                              |
| ----- | ----------------------------------------------------- | ------------------------------------------ |
| W13-A | Live browser responsiveness harness and WebSocket evidence | `BIR-N07`, `BIR-N11`, `BIR-L02`, `BIR-L03` |
| W13-B | Seed library/database hygiene and disposable artifact purge | `BIR-N03`, `BIR-W01`, `BIR-W03`, `BIR-O04` |
| W13-C | Advisor rule coverage for room/opening/topology edge cases | `BIR-D04`, `BIR-D05`, `BIR-D06`, `BIR-U01` |
| W13-D | Renderer diagnostic coverage for target-house-critical kinds | `BIR-I02`, `BIR-I03`, `BIR-I04`, `BIR-J06` |
| W13-E | CLI/MCP/methodology loop evidence for agents consuming Advisor output | `BIR-H01`, `BIR-H02`, `BIR-M07`, `BIR-T02` |

W13-A evidence update:

- Added `packages/web/scripts/target-house-live-responsiveness.mjs`, runnable as
  `pnpm --filter @bim-ai/web evidence:target-house-live -- --url <web-url>`,
  to drive the live 3D viewport orbit, target-house element selection, lens
  switch, Advisor open, and Advisor close flows.
- The same script validates supplied `target-house-live-browser-evidence.v1`
  input and Vite proxy logs in CI, producing
  `target-house-live-responsiveness.json` with interaction rows and WebSocket
  churn classifications for `BIR-N07`, `BIR-N11`, `BIR-L02`, and `BIR-L03`.
- Focused tests: `node --test
  packages/web/scripts/target-house-live-responsiveness.test.mjs`; `pnpm
  --filter @bim-ai/web exec vitest run
  src/lib/liveResponsivenessStability.test.ts src/lib/wsStability.test.ts`.

W13-E evidence update:

- Added `agent-loop-packet` to the sketch-to-BIM helper and tool descriptor. The
  packet normalizes Advisor and construction-readiness findings, links affected
  element ids back to source bundle commands, optional command-log transactions,
  recipe/bundle line hits, phase packet ownership, and deterministic next
  actions for source editing and verification.
- Extended `issue-ledger` entries with source command refs and next-action
  hints so existing phase packets can consume the same lineage without changing
  their required filename.
- Updated methodology/product docs to require the packet after Advisor and
  constructability capture. `BIR-H01` remains Partial because this wave did not
  add UI quick-fix/isolate controls.
- Verification: `pnpm --filter @bim-ai/cli exec node --test
  sketchSkillHelper.smoke.test.mjs`; `python3 -m py_compile
  claude-skills/sketch-to-bim/sketch_bim.py`.

Exit: `target-house-final-package.mjs --require-ready` either passes or is
blocked only by tracker rows outside target-house/live-readiness scope; no worker
may mark a row Done without linked implementation evidence and tests/proof hooks.

### Wave 14: P0 Authoring, Envelope, Exchange, And Advisor UX

Goal: close more P0 platform gaps that let invalid BIM be authored, hidden,
rendered silently, or handed to agents without actionable repair commands.

Scope: dispatch five independent workers. Each worker must commit locally, avoid
unrelated dirty files, update tracker evidence rows, and keep status changes
conservative.

| Agent | Ownership                                             | Primary items                              |
| ----- | ----------------------------------------------------- | ------------------------------------------ |
| W14-A | Authoring command validation and helper/analysis isolation | `BIR-B01`, `BIR-B02`, `BIR-B03`, `BIR-B04` |
| W14-B | Hosted opening conflict graph and repair hints        | `BIR-B07`, `BIR-C06`, `BIR-C07`, `BIR-C08` |
| W14-C | Roof, envelope, terrace, loggia, and facade integrity | `BIR-F01`, `BIR-F02`, `BIR-F03`, `BIR-F04`, `BIR-F05` |
| W14-D | Exchange/readback fidelity and schedule/sheet export parity | `BIR-K01`, `BIR-K02`, `BIR-K03`, `BIR-K04` |
| W14-E | Advisor UX/API actionability and batch diagnostics    | `BIR-H03`, `BIR-H04`, `BIR-H05`, `BIR-H06`, `BIR-U02` |

W14-E evidence, 2026-05-19: constructability report findings now include
deterministic `priority` / `priorityRank` ordering plus context-only
`saveViewpoint` command hints (`viewpointRef`, `evidenceRefs`, and
`safeCommandHints`) for findings with physical element bounds. The web Advisor
merge maps those context-only hints into the existing quick-fix command display
so UI, CLI, and MCP/agent consumers can save a focused review view without
mutating model geometry. Frontend coverage:
`pnpm --filter @bim-ai/web exec vitest run
src/advisor/unifiedAdvisorViolations.test.ts
src/advisor/advisorViolationContext.test.ts`. Backend constructability report
coverage was added in `tests/test_constructability_report.py`; the targeted
fixture passes locally while broader file execution still reflects unrelated
dirty constructability/domain-integrity changes in the shared workspace.

Exit: new rules are deterministic, covered by focused fixtures, surfaced through
CLI/API/MCP-consumable data where relevant, and do not add sketch-specific
subjective checks to the normal Advisor.

### Wave 15: Platform Semantics, Documentation, Site, And Content Quality

Goal: close the next platform-grade gaps that still make an Advisor-clean model
less than BIM-complete: document semantics, transaction safety at live mutation
surfaces, 2D documentation fidelity, site/link roundtrip, and authored content
quality.

Scope: dispatch five independent workers. Each worker must commit locally, avoid
unrelated dirty files, update tracker/evidence rows, keep status changes
conservative, and prove the rule is available as deterministic data for UI,
CLI/API, and MCP/agent consumers where applicable.

| Agent | Ownership                                                  | Primary items                                      |
| ----- | ---------------------------------------------------------- | -------------------------------------------------- |
| W15-A | Kernel references, levels/storeys, physical roles, smoke evidence | `BIR-P01`, `BIR-P02`, `BIR-P04`, `BIR-P05`, `BIR-P08` |
| W15-B | Transaction, undo/redo, collaboration, dry-run, and agent fix safety | `BIR-Q01`, `BIR-Q02`, `BIR-Q03`, `BIR-Q05`, `BIR-Q06`, `BIR-Q07` |
| W15-C | Plan/section/elevation/sheet/annotation/documentation fidelity | `BIR-R01`, `BIR-R02`, `BIR-R03`, `BIR-R04`, `BIR-R05`, `BIR-R06` |
| W15-D | Site coordinates, links/imports, roundtrip drift, and site relationship enforcement | `BIR-S01`, `BIR-S02`, `BIR-S03`, `BIR-S04`, `BIR-S05` |
| W15-E | Family/type schema, instance overrides, asset placement, and content render/export parity | `BIR-V01`, `BIR-V02`, `BIR-V03`, `BIR-V04`, `BIR-V05` |

Exit: all wave outputs are rule-backed rather than target-house-only cleanup,
target-house evidence is refreshed after integration, final package remains
blocked only by incomplete tracker scope, and no new rule suppresses or hides
invalid geometry in normal product Advisor profiles.

### Wave 16: Remaining P0 Guardrails, Agent Loops, Fixtures, And Governance

Goal: close the remaining P0 `Not started` gaps and convert the most important
`Partial` governance/evidence rows into product-grade contracts. This wave is
about preventing invalid authoring and giving agents a reliable integrity loop,
not about target-house-only cleanup.

Scope: dispatch five independent workers. Each worker must commit locally, avoid
unrelated dirty files, update tracker/evidence rows, keep status changes
conservative, and prove any new rule through deterministic fixtures or command
surface evidence.

| Agent | Ownership                                                  | Primary items                                      |
| ----- | ---------------------------------------------------------- | -------------------------------------------------- |
| W16-A | Physical support-context authoring, UI/backend guard parity, and agent-safe command defaults | `BIR-B02`, `BIR-B05`, `BIR-B06`, `BIR-B07` |
| W16-B | Integrity preflight command, agent remediation loop, batch diagnostics, and multi-profile comparison | `BIR-H03`, `BIR-H04`, `BIR-H06`, `BIR-H07`, `BIR-H01`, `BIR-H02` |
| W16-C | Room containment, P0 integrity fixture corpus, and target-house regression fixtures | `BIR-D03`, `BIR-O01`, `BIR-O02`, `BIR-W01` |
| W16-D | Rule suppression/tolerance policy, Advisor grouping/priority, profile presets, audience text, and review workflow | `BIR-A06`, `BIR-U01`, `BIR-U02`, `BIR-U03`, `BIR-U04`, `BIR-U05`, `BIR-U06` |
| W16-E | Agent workflow templates, stale evidence invalidation, dashboards, rehearsal, benchmarks, CI drift gates, and wave closeout evidence | `BIR-M10`, `BIR-T01`, `BIR-T04`, `BIR-T05`, `BIR-O04`, `BIR-O05`, `BIR-O06`, `BIR-W03`, `BIR-W04` |

Exit: P0 rows in this wave are no longer `Not started`, every new contract is
machine-readable for UI/API/CLI/MCP consumers where relevant, target-house
evidence is refreshed after integration, and final-package status remains
blocked only by legitimate incomplete tracker scope.

Integration note, 2026-05-19: the constructability report now has an explicit
domain-finding boundary. It includes actionable room access, code profile,
site/toposolid relationship, and envelope topology issues, but no longer leaks
general coordinate setup placeholders or every domain-integrity row into the
normal Advisor surface. Target-house evidence was refreshed after the
stair/asset overlap guard and constructability boundary fix.

### Wave 17 - Visual/Physical BIM Integrity Hardening

Goal: turn the current "clean but visually suspicious" target-house state into
a product-grade integrity problem: detached/floating elements, stair/furniture
overlap, roof/floor/envelope mismatches, topology placement, and renderer
fallbacks must be either impossible to author, deterministically reported, or
covered by evidence gates.

Scope: dispatch five independent workers. Each worker must commit locally,
avoid unrelated dirty files, update tracker/evidence rows conservatively, and
prove the work with deterministic fixtures. Normal Advisor rules must remain
deterministic and building-code/model-integrity oriented; sketch-specific
visual likeness belongs in methodology acceptance gates.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W17-A | Physical support-context guards for non-wall elements and asset placement preflight. | `BIR-B02`, `BIR-B04`, `BIR-B06`, `BIR-V04`, `BIR-W01` |
| W17-B | Stairs, railings, floor penetrations, vertical circulation topology, and bedroom/stair overlap regressions. | `BIR-E01`, `BIR-E02`, `BIR-E03`, `BIR-E04`, `BIR-E05`, `BIR-E06`, `BIR-E07` |
| W17-C | Roof/envelope/loggia/facade integrity, roof openings, terraces, and visual helper leakage prevention. | `BIR-F01`, `BIR-F02`, `BIR-F03`, `BIR-F04`, `BIR-F05`, `BIR-F06`, `BIR-C08` |
| W17-D | Renderer diagnostic contract, element render status, unsupported feature surfacing, and golden-view coverage. | `BIR-I01`, `BIR-I02`, `BIR-I03`, `BIR-I04`, `BIR-I05`, `BIR-J01`, `BIR-J02` |
| W17-E | Target-house live performance/evidence proof, final-package readiness blockers, topology placement, and rehearsal gates. | `BIR-L01`, `BIR-L02`, `BIR-L03`, `BIR-N07`, `BIR-N10`, `BIR-O02`, `BIR-O04`, `BIR-S05` |

Exit: target-house clean-pass evidence remains green, but also has fixtures or
golden evidence proving the previously observed suspicious states are covered:
asset-on-stair, floating/detached physical objects, building/toposolid
misplacement, and renderer unsupported/fallback elements.

### Wave 18 - Platform Contracts And Domain Completion

Goal: move from case-specific hardening toward platform-grade BIM guarantees:
rules must be discoverable and consistently surfaced, hosted openings must have
conflict/dependency graphs, room access/egress must be a reliable graph, domain
profiles must cover structure/MEP/fire/accessibility metadata, and multi-agent
transactions must be preflighted, reversible, and auditable.

Scope: dispatch five independent workers. Each worker must commit locally,
avoid unrelated dirty files, update tracker/evidence rows conservatively, and
prove behavior through deterministic fixtures. Do not add subjective visual
judgement to the normal Advisor; use deterministic authored/model facts.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W18-A | Rule taxonomy, severity policy, documentation generator, and UI/CLI/API rule parity metadata. | `BIR-A02`, `BIR-A04`, `BIR-A05`, `BIR-A07`, `BIR-H01`, `BIR-H02` |
| W18-B | Hosted opening conflict/dependency graph, hosted family support classification, and orphan proxy detection. | `BIR-C04`, `BIR-C06`, `BIR-C07`, `BIR-C08`, `BIR-B01` |
| W18-C | Room boundary strictness, real-door access, room containment, egress, accessibility, and schedule completeness. | `BIR-D01`, `BIR-D02`, `BIR-D03`, `BIR-D04`, `BIR-D05`, `BIR-D06`, `BIR-D07` |
| W18-D | Structure-lite, MEP-lite, fire/accessibility/code profiles, and material/type consistency. | `BIR-G01`, `BIR-G02`, `BIR-G03`, `BIR-G04`, `BIR-G05`, `BIR-G06`, `BIR-G07`, `BIR-V01`, `BIR-V02` |
| W18-E | Transactions, undo/redo, collaboration, provenance links to commands, and safe agent remediation. | `BIR-Q01`, `BIR-Q02`, `BIR-Q03`, `BIR-Q04`, `BIR-Q05`, `BIR-Q06`, `BIR-Q07`, `BIR-Q08`, `BIR-T02`, `BIR-H04` |

Exit: all workers leave machine-readable evidence rows, tracker audit passes,
and no new product Advisor rule depends on subjective sketch likeness.

## Non-Negotiable Acceptance Rules

- Do not mark a seed `accepted` while any P0 integrity or renderer diagnostic is
  unresolved.
- Do not treat `No findings` as proof of correctness unless the relevant rule
  families are implemented and covered by fixtures.
- Do not add sketch-specific "looks wrong" warnings to the normal product
  Advisor. Put those in the methodology acceptance gate.
- Do not hide invalid geometry by lens/category filtering. Diagnostic views
  must show the physical model and analysis/helper separation.
- Do not let generated/disposable artifacts leak into the committed seed
  library.
- Do not report renderer correctness from screenshots alone. Capture structured
  renderer diagnostics and golden checks.
- Do not call constructability checks certified structural engineering. They are
  deterministic project-phase health checks unless backed by a real engineering
  solver/profile.

## Initial Risk Register

| Risk                                             | Impact                              | Mitigation                                                            |
| ------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------- |
| Rule explosion makes Advisor noisy.              | Users ignore findings.              | Use profiles, severity policy, suppressibility, and rule ownership.   |
| Renderer diagnostics duplicate Advisor issues.   | Confusing UX.                       | Distinguish model invalid from model valid but renderer unsupported.  |
| Sketch fidelity leaks into normal Advisor.       | Architects see irrelevant warnings. | Keep brief/spec checks in skill/methodology packets only.             |
| Performance regresses when many checks run live. | Orbit/selection feel slow.          | Incremental checks, timing reports, background jobs, cached evidence. |
| Agents fix symptoms in target-house only.        | Same class of bugs returns.         | P0 fixtures and generalized rules before seed rerun acceptance.       |
| Export and viewport drift remains hidden.        | IFC/glTF artifacts are misleading.  | Export manifests, readback, and renderer/exchange support matrix.     |

## Current Known Trigger Cases

These cases should become regression fixtures:

1. Door hosted by `access-wall-*` outside the building envelope, currently
   passing as hosted but physically wrong.
2. Physical helper/access walls visible in 3D and schedule/export candidate
   surfaces.
3. Roof terrace opening present in data but not visibly cut/rendered.
4. Roof terrace/loggia modeled as intent metadata without occupied floor,
   return faces, guard, access, and visible void.
5. Seed dropdown polluted with disposable wave artifacts.
6. Advisor footer clean while renderer still shows flying/detached elements.
7. Dev WebSocket reconnect errors correlated with state reloads or sluggish UI.
