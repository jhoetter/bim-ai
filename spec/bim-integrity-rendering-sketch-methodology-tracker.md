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

| Status        | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `Done`        | Implemented, tested, documented, exposed through product surfaces.         |
| `Partial`     | Some behavior exists, but coverage, parity, or evidence is incomplete.     |
| `Not started` | No reliable implementation beyond incidental or raw-bundle behavior.       |
| `Blocked`     | Needs another tracker item or external decision before it can be completed. |

| Priority | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `P0`     | Required before a serious target-house-1 rerun or accepted seed.        |
| `P1`     | Required before calling the workflow excellent for normal house models. |
| `P2`     | Required for broader professional BIM depth.                            |
| `P3`     | Useful hardening or scale work.                                         |

## Milestones

| Milestone | Status        | Exit criteria |
| --------- | ------------- | ------------- |
| `M0` Tracker and rule taxonomy | Done | This tracker exists, defines layers, rule families, milestones, and wave plan. |
| `M1` P0 BIM integrity foundation | Partial | Hosted openings, helper/nonphysical elements, floor/envelope containment, support/topology, and command validation gaps are covered by deterministic Advisor/validation rules with tests and UI/CLI/API parity. |
| `M2` P0 renderer fidelity foundation | Partial | Renderer emits diagnostics for unsupported/failed cuts, roof/slab/wall openings have golden tests, and target-house-critical visual failures cannot be silent. |
| `M3` P0 sketch-to-BIM methodology gate | Partial | Sketch-specific fidelity checks are separated from normal Advisor, phase packets fail on missing visual/spec evidence, and target-house acceptance cannot pass on Advisor-clean but visually wrong output. |
| `M4` P1 domain depth | Partial | Rooms/access/egress, stairs/railings, structure-lite, MEP-lite, fire/accessibility metadata, materials/types, and exchange checks have robust rule coverage. |
| `M5` P1 rendering/exchange completeness | Partial | Supported viewport geometry, IFC/glTF export manifests, and readback/golden evidence agree for architecture, structure-lite, MEP-lite, sheets, and schedules. |
| `M6` Performance and live UX quality | Partial | Advisor and renderer diagnostics are incremental, bounded, nonblocking, and do not cause sluggish orbit/selection/WebSocket behavior in ordinary projects. |
| `M7` Platform-grade BIM guarantees | Partial | Kernel invariants, transaction safety, collaboration, provenance, fixture governance, and agent remediation safety are covered by tests and documented contracts. |
| `M8` Target-house rerun readiness | Not started | `target-house-1` can be regenerated from methodology with zero unhandled warnings/errors, clean renderer diagnostics, current evidence, and explicit tolerances only where accepted by the user. |

## Layering Contract

| Layer | Owned by | Must report | Must not report |
| ----- | -------- | ----------- | --------------- |
| Authoring validation | UI tools, CLI, MCP/API, command engine | impossible inputs, missing hosts, bad references, invalid ranges, destructive ambiguity | project-specific visual fidelity |
| BIM integrity Advisor | backend Advisor / constructability / constraints | broken hosts, nonphysical leakage, topology gaps, support/containment issues, invalid physical state | subjective aesthetics |
| Constructability / norms Advisor | backend Advisor profiles | clearance, access, egress, structure-lite, MEP penetrations, metadata, fire/accessibility/code-profile issues | sketch-match scoring |
| Renderer diagnostics | viewport and render/export pipelines | unsupported or failed visual geometry, dropped cuts, fallback proxies, hidden categories, export/view drift | model-code violations already owned by Advisor unless renderer-specific |
| Sketch-to-BIM methodology gate | skill/helper/agent evidence loop | sketch/brief/IR/phase/spec acceptance, semantic visual checklist, stale evidence | normal live-product warnings for arbitrary architect-authored models |

## Tracker Items

### A. Taxonomy, Surface Parity, And Rule Governance

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-A01` | P0 | Done | Create the tracker and layer contract. | This file exists and separates authoring validation, BIM integrity, constructability, renderer diagnostics, and sketch methodology gates. |
| `BIR-A02` | P0 | Partial | Create canonical rule taxonomy. | Every rule has `ruleId`, title, severity, discipline, perspective, layer owner, affected ids, recommendation, fix command hints, suppressibility, and profile membership. |
| `BIR-A03` | P0 | Done | Add rule registry tests. | Tests fail if a new rule lacks metadata, UI display text, CLI/API serialization, severity mapping, or perspective classification. |
| `BIR-A04` | P0 | Partial | Establish UI/CLI/API Advisor parity. | Same model and profile yield equivalent grouped findings in right rail, CLI `advisor`, API snapshot violations, and constructability report. Existing parity helpers are extended to all new rules. |
| `BIR-A05` | P0 | Partial | Add severity policy. | P0 integrity failures are `error`; current-phase sketch blockers cannot be hidden as `info`; metadata and profile completeness use predictable `warning`/`info` levels. |
| `BIR-A06` | P1 | Not started | Add suppression/tolerance policy per rule. | Rule registry declares whether a finding can be ignored, temporarily tolerated, or requires a modeled fix; tolerances require owner, expiry, and evidence. |
| `BIR-A07` | P1 | Partial | Add rule documentation generator. | A generated `spec/generated/advisor-rule-ledger.md` lists every rule, examples, surfaces, tests, and status. |

### B. Authoring And Command Validation

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-B01` | P0 | Partial | Validate hosted door/window/opening placement before commit. | UI, CLI, and MCP/API reject missing host, wrong host kind, invalid `alongT`, width beyond wall span, head/sill outside wall height, and host-level mismatch. |
| `BIR-B02` | P0 | Not started | Reject or flag physical elements authored outside building support context. | Commands that create physical walls, doors, windows, stairs, rails, assets, or slabs outside a selected level/floor/envelope require explicit `allowDetached` or produce an error/advisory. |
| `BIR-B03` | P0 | Not started | Prevent analysis/helper elements from becoming visible physical BIM by accident. | Access-graph, room-closure, diagnostic, and helper entities have explicit nonphysical category/visibility/serialization semantics; physical creation requires explicit category. |
| `BIR-B04` | P0 | Not started | Add transaction-level integrity preflight. | `dry-run` and commit-bundle include model-integrity findings before mutation; P0 errors block commit unless a rule explicitly permits commit with error. |
| `BIR-B05` | P0 | Not started | Align UI tool guards with backend validation. | Door/window/wall-opening UI tools cannot select nonphysical or invalid host walls; backend rejects the same state if created by bundle. |
| `BIR-B06` | P1 | Not started | Add safe defaults for agent authoring. | Agent-facing tools require explicit level, host, type, material/category, and intended physical/analysis role rather than relying on active UI state. |
| `BIR-B07` | P1 | Not started | Add correction command hints for integrity findings. | Findings include machine-readable fixes such as delete helper, rehost door, move wall into envelope, convert to analysis, add opening, or create missing support. |

### C. Hosted Elements, Openings, And Physical Containment

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-C01` | P0 | Done | Detect hosted door/window not embedded in a real wall. | Door/window findings fire when the host wall is nonphysical, analysis-only, hidden helper, too short, outside its level floor, or not part of a valid architectural boundary. |
| `BIR-C02` | P0 | Done | Detect host wall outside floor/building envelope. | A wall with physical role on a storey must intersect/align with a floor, room boundary, or explicit detached/exterior condition; otherwise report `physical_wall_outside_envelope`. |
| `BIR-C03` | P0 | Done | Detect door/window outside usable wall span. | Openings near endpoints, overlaps, or exceeding segment capacity report deterministic errors even if `alongT` is technically in range. |
| `BIR-C04` | P0 | Partial | Detect door/window without rendered or semantic opening cut. | A hosted element must either create an explicit wall void/cut participant or declare a renderer-supported integrated cut; missing cut is a BIM integrity error. |
| `BIR-C05` | P0 | Done | Detect physical access-proxy leakage. | Synthetic access walls/doors used only for room graph logic are either nonphysical or flagged when visible/rendered/scheduled/exported as architectural elements. |
| `BIR-C06` | P1 | Not started | Add opening conflict graph. | Multiple doors/windows/wall openings on one wall cannot overlap, exceed wall capacity, or violate endpoint/lintel spacing without a warning/error. |
| `BIR-C07` | P1 | Not started | Add hosted family support classification. | Doors/windows/assets declare hosted, freestanding, face-hosted, level-hosted, ceiling-hosted, or workplane-hosted semantics; Advisor validates host kind and geometry. |
| `BIR-C08` | P1 | Not started | Add orphan rendered-proxy detector. | Any mesh/proxy generated for a hosted element without valid host geometry emits a renderer diagnostic and Advisor integrity finding. |

### D. Rooms, Access, Egress, And Spatial Topology

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-D01` | P0 | Partial | Keep room boundary openness strict. | Existing room-boundary checks are expanded to distinguish real walls from helper separations and to flag fake room-separation hacks. |
| `BIR-D02` | P0 | Partial | Validate room-door access through real doors. | A room is accessible only through physical hosted doors/openings on valid room boundaries; synthetic off-envelope access doors do not satisfy access. |
| `BIR-D03` | P0 | Not started | Validate room containment within floor/storey. | Room polygons must lie within or intentionally extend from the level floor/envelope; detached room islands and overlap outside slabs are errors. |
| `BIR-D04` | P1 | Partial | Validate egress graph. | Existing egress rules are extended with exterior exit classification, stair/level transitions, and multiple-room traversal evidence. |
| `BIR-D05` | P1 | Partial | Validate room/wall topology consistency. | Walls that bound rooms are classified interior/exterior/corridor/shaft; conflicting classification produces findings. |
| `BIR-D06` | P1 | Partial | Add room schedule integrity. | Room schedule rows match physical rooms, have area/source, level, function, occupancy/use, and classification placeholders. |
| `BIR-D07` | P2 | Partial | Add occupancy and accessibility profiles. | Profile-specific minimum access width, bathroom clearance, circulation, and accessible route checks can be enabled without hardcoding them into all projects. |

### E. Floors, Slabs, Stairs, Railings, And Vertical Circulation

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-E01` | P0 | Partial | Validate slab openings and stair penetration. | Stairs crossing floors require explicit slab/shaft openings; openings must be inside host slabs, not degenerate, and visible/renderable. |
| `BIR-E02` | P0 | Partial | Validate floor support and detached slab fragments. | Floors/slabs outside supported wall/beam/perimeter assumptions report support warnings or require explicit cantilever/terrace metadata. |
| `BIR-E03` | P0 | Partial | Validate railings/guards on terraces, stairs, and balconies. | Exposed edges above threshold height require guardrail/railing or explicit approved exception; rails must align to supported edges. |
| `BIR-E04` | P1 | Partial | Validate stair comfort and headroom. | Existing stair checks are wired into Advisor parity and phase acceptance; by-sketch stairs include riser/tread/headroom/landing checks. |
| `BIR-E05` | P1 | Partial | Validate vertical circulation graph. | Multi-level models know which stairs connect which levels, which rooms are reachable, and which slab openings/guards belong to that circulation path. |
| `BIR-E06` | P1 | Partial | Validate terrace/loggia floors as occupied exterior spaces. | A terrace/loggia is a real floor/space with guard, drainage/slope metadata, access, boundary, and schedule/area intent. |
| `BIR-E07` | P2 | Partial | Add railing family/profile integrity. | Railing posts, handrails, balusters, height, spacing, material, and host references are validated and renderable. |

### F. Roofs, Envelope, Terraces, Loggias, And Facades

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-F01` | P0 | Partial | Validate roof openings against host footprint. | Existing roof-opening host/footprint checks remain, with stricter hole-inside-host and large-void metadata requirements for occupied terraces. |
| `BIR-F02` | P0 | Partial | Validate roof opening has real occupied void geometry. | Roof terrace/court openings require rendered cut, floor surface, return/curb/parapet faces, drainage/guard/support metadata, and evidence viewpoint. |
| `BIR-F03` | P0 | Partial | Validate envelope closure. | Exterior walls, roofs, floors, and major openings form a coherent envelope per level; unresolved holes/gaps are reported. |
| `BIR-F04` | P1 | Partial | Validate loggia/recessed facade topology. | Recessed loggias have side returns, top/bottom returns, railing/guard, access opening, and physical floor/ceiling relationships. |
| `BIR-F05` | P1 | Partial | Validate facade opening rhythm without treating it as subjective. | When a model declares facade rhythm metadata, openings must map to declared bays/counts; absent metadata avoids normal-Advisor aesthetic judgments. |
| `BIR-F06` | P1 | Partial | Validate wall/roof attachment and overhang semantics. | Wall tops and roof eaves/ridges have explicit relation where required; floating roof/wrapper slabs or walls are errors unless declared as detached study mass. |
| `BIR-F07` | P2 | Partial | Add thermal/fire/acoustic envelope metadata checks. | Profiles can require wall/roof/slab type layers and performance placeholders appropriate to project phase. |

### G. Structure-Lite, MEP-Lite, Fire, Accessibility, And Code Profiles

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-G01` | P0 | Partial | Clarify constructability vs structural engineering. | Docs and UI state that current checks are deterministic structure-lite/constructability, not certified structural engineering. |
| `BIR-G02` | P1 | Partial | Expand load path checks. | Load-bearing walls, beams, columns, stacked supports, transfer assumptions, and large openings have profile-specific findings and metadata resolutions. |
| `BIR-G03` | P1 | Partial | Expand MEP penetration checks. | Pipe/duct/shaft/slab/wall/ceiling penetrations require openings or approved coordination metadata. |
| `BIR-G04` | P1 | Partial | Add wet-room and service-zone coordination. | Wet rooms, risers, shafts, equipment zones, and MEP route placeholders can be checked for stacking and reasonable access. |
| `BIR-G05` | P1 | Partial | Add fire-safety profile gates. | Fire ratings, exit doors, protected stairs, compartment placeholder metadata, and door swing/clearance rules are profile-controlled. |
| `BIR-G06` | P1 | Partial | Add accessibility profile gates. | Profile-controlled thresholds, door widths, circulation clearances, sanitary turning zones, and accessible route checks are deterministic. |
| `BIR-G07` | P2 | Partial | Add regional code package metadata. | Rules declare locale/profile, source basis, severity, and whether they are advisory placeholders or enforced checks. |

### H. Advisor UX, CLI, MCP/API, And Agent Usability

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-H01` | P0 | Partial | Advisor findings must be actionable from UI. | Each finding displays affected elements, open/isolate actions, context view suggestion, quick-fix summary where safe, and exact reason. |
| `BIR-H02` | P0 | Partial | Advisor findings must be actionable from CLI/MCP. | CLI/API payloads include same ids, rule metadata, severity, recommendation, fix hints, and profile/perspective filters. |
| `BIR-H03` | P0 | Not started | Add integrity preflight command. | `qa integrity` or equivalent reports P0 model-integrity checks independent of constructability profile. |
| `BIR-H04` | P0 | Not started | Add agent-friendly remediation loop. | CLI/MCP can list findings, propose safe correction bundles, dry-run fixes, commit accepted fixes, and recapture evidence. |
| `BIR-H05` | P1 | Not started | Add findings-to-viewpoint bridge. | Findings include or can resolve saved camera/plan/context views focused on affected elements. |
| `BIR-H06` | P1 | Not started | Add batch/performance diagnostics. | Advisor reports rule timing, affected-element count, skipped/unsupported checks, and incremental eligibility. |
| `BIR-H07` | P1 | Not started | Add multi-profile comparison. | Agents can compare default, construction_readiness, fire, accessibility, structure, MEP, and exchange profiles without manually merging outputs. |

### I. Renderer Diagnostic Contract

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-I01` | P0 | Done | Create renderer support matrix. | `spec/generated/renderer-support-matrix.md` lists every element kind and feature against 3D viewport, plan, sheet, export, and known limitations. |
| `BIR-I02` | P0 | Partial | Emit renderer diagnostics for unsupported cuts. | Failed/unsupported roof, wall, slab, dormer, stair, railing, or boolean/cut paths create structured diagnostics visible to UI and CLI evidence. |
| `BIR-I03` | P0 | Partial | No silent fallback for target-house-critical features. | Roof terrace cutout, wall door/window cuts, slab openings, loggia recesses, rails, stairs, and floors either render or produce blocking diagnostics. |
| `BIR-I04` | P0 | Partial | Connect renderer diagnostics to sketch acceptance. | Sketch-to-BIM phase/final packets fail when renderer diagnostics affect required visual features. |
| `BIR-I05` | P1 | Partial | Add per-element render status. | Selecting an element can show render implementation, skipped subfeatures, material fallback, proxy fallback, and export support. |
| `BIR-I06` | P1 | Partial | Add renderer diagnostic persistence. | Diagnostics are captured in evidence packages with git head, model revision, view id, renderer build, and affected element ids. |
| `BIR-I07` | P1 | Partial | Separate renderer issue from model issue. | UI distinguishes "model invalid" from "model valid but viewport unsupported/failed to render this feature." |

### J. Renderer Element Fidelity And Golden Tests

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-J01` | P0 | Partial | Wall geometry and hosted wall cuts. | Doors, windows, and wall openings cut/host correctly across wall orientations, thicknesses, joins, materials, and lens modes; tests cover CSG and fallback. |
| `BIR-J02` | P0 | Partial | Roof geometry and roof openings. | Flat, gable, asymmetric gable, hip-like, terrace/court openings, dormers, returns, fascia, and material strips render correctly or diagnose unsupported cases. |
| `BIR-J03` | P0 | Partial | Floor/slab geometry and openings. | Slabs, terraces, balconies, floor openings, shafts, and stair penetrations render with correct z, thickness, material, and voids. |
| `BIR-J04` | P0 | Partial | Stairs and railings. | Stairs, landings, runs, treads, risers, rails, guards, balusters, and hosted/edge relationships render in architecture and structure lenses. |
| `BIR-J05` | P1 | Partial | Doors/windows/families. | Families render with actual dimensions, operation/swing/sliding direction where meaningful, frame/panel/material slots, and correct host offsets. |
| `BIR-J06` | P1 | Not started | Rooms/spaces visual diagnostics. | Room volumes/areas, boundaries, names, and diagnostic overlays render coherently without becoming physical clutter. |
| `BIR-J07` | P1 | Partial | Materials and appearances. | Material assignments, type layer intent, transparent/realistic/wire modes, cut/finish faces, and high-fidelity mode are consistent. |
| `BIR-J08` | P1 | Partial | Lens/filter rendering parity. | Architecture, Structure, Systems, MEP, Massing/Site, and Documentation lenses show/hide/ghost categories predictably and preserve diagnostics. |
| `BIR-J09` | P1 | Partial | Visual golden harness. | Playwright/canvas pixel tests cover nonblank, framing, critical feature presence, and no flying/unsupported proxies for representative seeds. |
| `BIR-J10` | P2 | Partial | Stress and large-model rendering. | Pure renderer stress-budget helpers now count large element sets, hosted openings, linked models/expanded linked elements, and evidence views, emitting structured `renderer-performance` diagnostics when thresholds are near or exceeded. Remaining: wire diagnostics into live viewport/evidence capture and broaden benchmark models. |

### K. IFC, glTF, Schedules, Sheets, And Exchange Fidelity

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-K01` | P0 | Partial | Export manifests must reveal unsupported geometry. | IFC/glTF manifests embed `exportGeometryUnsupportedSkipped_v1` with unsupported/skipped geometry feature rows, reason codes, counts, and affected ids via `app/bim_ai/export_feature_contract.py`; PDF/schedule evidence still needs the same treatment. |
| `BIR-K02` | P0 | Partial | Add export-readback geometry checks. | IFC inspector now emits `geometryReadbackSummary_v0`, comparing source topology to IFC identity/body/QTO/readback counts for supported walls, floors, roofs, doors, windows, stairs, railings, rooms/spaces, and hosted openings. Tests: `pytest app/tests/test_export_ifc_readback.py app/tests/test_export_ifc.py::test_ifc_inspection_matrix_covers_storeys_spaces_qtos_and_programme_fields --no-cov`. Remaining: broaden drift tolerances and glTF/import parity. |
| `BIR-K03` | P0 | Partial | Align renderer and export feature contracts. | IFC/glTF manifests embed `exportFeatureSupportMatrix_v1` and `rendererExportContractDrift_v1`, identifying viewport-vs-export support drift such as roof openings, railings, placed assets, and family instances. |
| `BIR-K04` | P1 | Partial | IFC semantic mapping completeness. | IFC semantic scope and inspector cover walls, floors, roofs, doors, windows, stairs, rails, rooms/spaces plus type/material/classification/quantity/property-set readback aggregates via `geometryReadbackSummary_v0`, `materialLayerSetReadback_v0`, and property-set coverage evidence. Remaining: expand beyond current kernel-exportable subset. |
| `BIR-K05` | P1 | Partial | Schedule integrity. | Room, door/window, material/quantity, and documentation schedules match model elements and export evidence; `scheduleSheetExchangeEvidence_v1` now exposes missing model rows, unsupported schedule categories/rows, and stale schedule evidence digests. |
| `BIR-K06` | P1 | Partial | Sheet/view evidence. | Saved views, sheets, viewports, scales, render bundles, and PDF-like exports are linked to model/evidence packets; `scheduleSheetExchangeEvidence_v1` now checks sheet evidence rows, viewport refs, viewport scales, render-bundle summaries, and stale revision/digest links. |
| `BIR-K07` | P2 | Partial | IDS/BIR validation packs. | `packages/cli/lib/bim-requirement-validation-pack.mjs` deterministically compiles simple sketch/BIR information requirements into delivery-target checks and evidence blockers, and `sketch.exchange-validation.v1` now carries the compiled pack/report. Tests: `packages/cli/bimRequirementValidationPack.test.mjs`. Remaining: broader IDS schema import and backend Advisor/API parity. |

### L. Performance, Responsiveness, And Live Stability

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-L01` | P0 | Partial | Profile Advisor performance. | Constructability reports now include `advisorDiagnosticsProfile_v1` with deterministic ordered timing rows for Advisor evaluate, constructability clearance/metadata, model-integrity, and domain-integrity checks. Evidence: `app/bim_ai/advisor_profiling.py`, `app/bim_ai/constructability_report.py`, `app/tests/test_advisor_profiling_incremental.py`. |
| `BIR-L02` | P0 | Partial | Profile renderer update cost. | Pure renderer cost profiling now estimates orbit, select, lens-switch, Advisor toggle, and update workloads with budgets, dominant factors, and budget diagnostics. Remaining: collect real browser timing samples from target-house and benchmark models. |
| `BIR-L03` | P0 | Partial | Investigate WebSocket proxy errors. | W6-C classifies Vite proxy `EPIPE`/`ECONNRESET` as benign dev reconnect/browser teardown noise, keeps unexpected proxy errors actionable, and covers app reconnect/backoff/state-churn decisions in `packages/web/src/lib/wsStability.test.ts`. Remaining: wire helper into dirty WebSocket consumers/proxy config once parallel edits settle and verify live dev-server behavior. |
| `BIR-L04` | P1 | Partial | Incremental diagnostics. | Added pure `advisorIncrementalDiagnosticEligibility_v1` helper that derives changed ids, one-hop reference impact, constructability broad-phase pair impact, and per-layer incremental eligibility for Advisor/integrity/domain/render diagnostic consumers. Evidence: `app/bim_ai/constructability_performance.py`, `app/tests/test_advisor_profiling_incremental.py`. |
| `BIR-L05` | P1 | Partial | Background heavy checks. | Expensive geometry/export/render checks run as jobs with progress, cancellation, and cached evidence. |
| `BIR-L06` | P1 | Partial | UI degradation safeguards. | Pure `diagnosticUiSchedulingPolicy_v1` helpers now force Advisor and renderer diagnostics onto idle/debounced/deferred/manual-only paths, cap diagnostic overlays with `pointerEvents: none`, and preserve pointer events, camera controls, and selection on ordinary models. Remaining: wire the policy into all live diagnostic producers. |

### M. Sketch-to-BIM Methodology Gate

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-M01` | P0 | Partial | Rename/specify sketch fidelity gate separately from Advisor. | Methodology docs and helper output call this `sketch acceptance`, `brief acceptance`, or equivalent, never normal Advisor. |
| `BIR-M02` | P0 | Partial | Enforce current phase evidence. | Phase packet requires current git head, model revision, Advisor digest, renderer diagnostic digest, IR hash, capability hash, and screenshot manifest. |
| `BIR-M03` | P0 | Partial | Require semantic visual checklist for critical features. | Agent must explicitly pass/fail feature-specific checks for silhouette, roof cutout, terrace/loggia, facade rhythm, cladding, rooms, stairs, and diagnostics. |
| `BIR-M04` | P0 | Partial | Add renderer diagnostics to phase acceptance. | Phase/final acceptance blocks if required visual features have renderer unsupported/failed diagnostics. |
| `BIR-M05` | P0 | Partial | Add BIM integrity diagnostics to phase acceptance. | Phase/final acceptance blocks on P0 model-integrity errors even if normal constructability warnings are zero. |
| `BIR-M06` | P0 | Done | Add target-house-specific acceptance pack. | Target-house checklist compiles into machine-readable required features, views, tolerances, and evidence rows. |
| `BIR-M07` | P1 | Partial | Add visual readout drift loop. | Agent must compare latest screenshots with previous phase and source sketch, record corrections, and cannot advance on unresolved drift. |
| `BIR-M08` | P1 | Partial | Add methodology failure taxonomy. | Initial taxonomy added in `spec/sketch-to-bim-failure-taxonomy.md`; phase packets classify failures as model-integrity, renderer, sketch-fidelity, command-surface, evidence-staleness, or user-tolerance. |
| `BIR-M09` | P1 | Partial | Add seed artifact cleanliness gates. | Seed library contains only approved artifacts; disposable wave artifacts cannot leak into committed seed list. |
| `BIR-M10` | P1 | Not started | Add agent prompt/workflow templates. | Wave prompts tell agents to use integrity, renderer, Advisor, evidence, and acceptance gates before reporting completion. |

### N. Target-House-1 Specific Closure

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-N01` | P0 | Not started | Diagnose current target-house geometry objectively. | Produce a report of every detached/flying/out-of-envelope element, helper leakage, unsupported renderer feature, and sketch-critical mismatch. |
| `BIR-N02` | P0 | Not started | Fix seed source, not only live state. | Corrections are applied to the authoritative seed recipe/bundle/source artifact so `make seed name=target-house-1` reproduces the clean model. |
| `BIR-N03` | P0 | Partial | Remove stale/disposable artifacts from seed library. | Seed dropdown contains only approved seed artifacts and no wave/disposable local evidence projects after clean seed. |
| `BIR-N04` | P0 | Not started | Require no P0 Advisor/integrity/renderer findings. | Final target-house cannot be accepted with errors or renderer blockers; warnings require written tolerance and user acceptance. |
| `BIR-N05` | P0 | Partial | Verify model visual from required views. | Saved views for main, front, rear/right, roof court, loggia, ground plan, upper plan, and wire diagnostics show correct model with screenshots. |
| `BIR-N06` | P1 | Not started | Verify BIM data quality. | Rooms, schedules, types, materials, classifications, levels, spaces, stairs, rails, doors/windows, and export manifests pass target checklist. |
| `BIR-N07` | P1 | Not started | Verify performance on target-house. | Orbit/selection/lens switching/Advisor opening are measured and accepted on the final seed. |

### O. Tests, Fixtures, CI, And Benchmarks

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-O01` | P0 | Not started | Add fixture corpus for model-integrity rules. | Positive and negative fixtures cover every P0 integrity rule with expected rule ids and affected elements. |
| `BIR-O02` | P0 | Partial | Add target-house regression fixture. | The known detached-door/access-wall and roof-cut cases fail before fixes and pass after. |
| `BIR-O03` | P0 | Partial | Add renderer golden fixture corpus. | Minimal scenes for roof openings, wall cuts, slab openings, stairs/rails, loggia/terrace, and helper leakage are tested. |
| `BIR-O04` | P1 | Not started | Add end-to-end acceptance rehearsal. | A no-seed or disposable seed run exercises integrity, renderer diagnostics, Advisor, evidence, and sketch acceptance without committing artifacts. |
| `BIR-O05` | P1 | Not started | Add benchmark suite integration. | Existing benchmarks record integrity, renderer diagnostics, exchange, performance, and acceptance status in live evidence. |
| `BIR-O06` | P1 | Not started | Add CI gates for rule/render docs drift. | CI fails if rule registry, renderer support matrix, generated docs, and tests diverge. |

### P. Kernel Invariants, Units, Types, And Document Semantics

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-P01` | P0 | Partial | Define document invariant contract. | A generated invariant ledger states required ids, kind discriminators, references, units, coordinates, level membership, type-instance relations, and deletion semantics. |
| `BIR-P02` | P0 | Partial | Validate all element references. | Every `levelId`, host id, type id, material key, view id, schedule id, sheet id, phase id, design option id, and linked-model ref is either resolvable or explicitly nullable by schema. |
| `BIR-P03` | P0 | Not started | Validate units and coordinate normalization. | All geometry commands and snapshots use explicit mm/m/unit contracts; imported/exported coordinates are normalized with documented transforms. |
| `BIR-P04` | P0 | Partial | Validate level/storey semantics. | Physical elements have coherent level, base elevation, top constraint/height, storey membership, and cross-level intent. |
| `BIR-P05` | P0 | Partial | Validate physical vs analytical roles. | Every element that can appear in Advisor/renderer/export declares whether it is physical, analytical, helper, annotation, documentation, or imported proxy. |
| `BIR-P06` | P1 | Not started | Validate type-instance inheritance. | Instance parameters, family/type parameters, material slots, dimensions, schedule fields, and overrides resolve predictably and are surfaced in diagnostics. |
| `BIR-P07` | P1 | Not started | Validate schema migration compatibility. | Older seed artifacts and command bundles can be migrated or fail with actionable diagnostics rather than silently producing malformed models. |
| `BIR-P08` | P1 | Partial | Add invariant smoke command. | CLI/API can run a fast invariant check that is independent of constructability and reports machine-readable findings. |

### Q. Transactions, Collaboration, Undo/Redo, And Agent Safety

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-Q01` | P0 | Not started | Protect transaction boundaries. | Integrity validation runs consistently for dry-run, commit, bundle commit, UI command commit, and future MCP mutations with parent revision checks. |
| `BIR-Q02` | P0 | Not started | Preserve undo/redo semantics. | Integrity/remediation commands create undoable, inspectable transactions and do not corrupt command history. |
| `BIR-Q03` | P0 | Not started | Add collaboration conflict safety. | Concurrent edits cannot cause stale fixes, lost updates, or remediation against an obsolete revision without explicit conflict reporting. |
| `BIR-Q04` | P0 | Not started | Classify safe vs destructive auto-fixes. | Findings distinguish safe automatic fixes, review-required fixes, destructive fixes, and fixes that need user intent. |
| `BIR-Q05` | P0 | Not started | Require dry-run for agent remediation. | CLI/MCP remediation tools emit proposed command bundles and dry-run evidence before committing. |
| `BIR-Q06` | P1 | Not started | Add audit provenance for fixes. | Every automatic or agent-authored fix records source finding id, affected elements, before/after summary, user/agent identity, and evidence path. |
| `BIR-Q07` | P1 | Not started | Add permission/scope metadata. | Agent tools declare mutation/export/external-service/destructive scope so MCP clients can request approval appropriately. |
| `BIR-Q08` | P1 | Not started | Add rollback/retry guidance. | Failed integrity/remediation commits leave the model unchanged and expose retry-safe diagnostics. |

### R. 2D Documentation, Sections, Plans, Elevations, And View Fidelity

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-R01` | P0 | Not started | Add plan-view fidelity contract. | Walls, doors, windows, rooms, stairs, slab openings, railings, levels, annotations, and hidden/cut graphics render correctly in plan or produce diagnostics. |
| `BIR-R02` | P0 | Not started | Add section/elevation fidelity contract. | Cut planes, view depth, section boxes, hidden lines, openings, stairs, roofs, floors, and materials render consistently with the 3D model. |
| `BIR-R03` | P1 | Not started | Add sheet viewport fidelity. | Sheet viewports preserve view scale, crop, discipline/lens, graphics mode, title, schedule placement, and evidence links. |
| `BIR-R04` | P1 | Not started | Add annotation/dimension integrity. | Tags, dimensions, levels, grids, callouts, detail regions, and schedules reference live elements and report stale/orphan state. |
| `BIR-R05` | P1 | Not started | Add documentation export parity. | PDF/render bundles/sheets match the corresponding saved views, with unsupported features listed in export evidence. |
| `BIR-R06` | P1 | Not started | Add 2D golden fixtures. | Plan, section, elevation, and sheet goldens cover hosted openings, roof cuts, stairs, rooms, annotations, and lens modes. |

### S. Site, Georeferencing, Links, Imports, And Roundtrip

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-S01` | P0 | Not started | Validate project/site coordinate systems. | Project base point, survey point, true north, project north, level datum, and model origin are explicit and exportable. |
| `BIR-S02` | P0 | Not started | Validate linked model transforms. | Linked BIM/IFC/context models have transform, units, origin, discipline, visibility, and stale/source metadata checked. |
| `BIR-S03` | P1 | Not started | Add import diagnostic contract. | Import/link operations report unsupported products, lost geometry, category mapping, transform drift, and material/type fallbacks. |
| `BIR-S04` | P1 | Not started | Add roundtrip drift checks. | Exported/imported/readback summaries can be compared against the source model for element count, placement, category, type, material, and geometry drift. |
| `BIR-S05` | P1 | Not started | Validate site/toposolid/building relationship. | Building footprint, terrain, property lines, setbacks, entrances, exterior stairs/rails, and drainage/context assumptions are deterministic diagnostics. |
| `BIR-S06` | P2 | Not started | Add multi-building/shared-coordinate support. | Larger projects can validate multiple buildings, shared coordinates, linked contexts, and discipline model alignment. |

### T. Provenance, Traceability, And Evidence Lineage

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-T01` | P0 | Partial | Map sketch features to BIM elements. | Every required sketch/brief feature has stable feature id, required element ids, source image references, phase, evidence views, and acceptance status. |
| `BIR-T02` | P0 | Partial | Map findings to source authoring commands. | Advisor/integrity/renderer findings can be traced to command ids, recipe rows, agent wave, commit, and phase packet where available. |
| `BIR-T03` | P0 | Partial | Add evidence lineage manifest. | Final packets state which snapshots, screenshots, reports, exports, rule digests, renderer build, and git head produced each acceptance claim. |
| `BIR-T04` | P1 | Partial | Add stale evidence invalidation. | Evidence becomes stale when model revision, rule digest, renderer support matrix, seed source, target spec, or git head changes. |
| `BIR-T05` | P1 | Partial | Add feature coverage dashboard. | Agents and users can see required features, current element coverage, open findings, renderer support, screenshots, and remaining blockers. |
| `BIR-T06` | P1 | Partial | Add review narrative generator. | Phase/final reports summarize what changed, what evidence proves it, what remains tolerated, and what is blocked. |

### U. Advisor Noise Control, Product UX, And Fix Prioritization

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-U01` | P0 | Partial | Add finding grouping/deduplication. | Repeated geometry symptoms collapse into clear root-cause groups while preserving affected element ids. |
| `BIR-U02` | P0 | Partial | Add fix priority ordering. | Advisor sorts by severity, phase ownership, dependency/root cause, visible impact, and current lens/profile relevance. |
| `BIR-U03` | P1 | Partial | Add profile presets. | Architecture, Structure, MEP, Fire, Accessibility, Construction Readiness, Exchange, and Sketch Acceptance profiles have explicit rule membership and defaults. |
| `BIR-U04` | P1 | Partial | Add user-facing explanations by audience. | Same rule can expose concise UI text, agent technical detail, and documentation text without losing rule identity. |
| `BIR-U05` | P1 | Partial | Add false-positive review workflow. | Users/agents can classify a finding as rule defect, accepted tolerance, profile mismatch, or model defect with evidence. |
| `BIR-U06` | P2 | Not started | Add Advisor learning corpus. | Confirmed true/false findings become fixtures for rule tuning and regression prevention. |

### V. Families, Parameters, Assets, And Content Quality

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-V01` | P0 | Partial | Validate family/type parameter schemas. | Family types declare required dimensions, host behavior, material slots, schedule fields, IFC mapping, and render geometry support. |
| `BIR-V02` | P0 | Not started | Validate instance overrides. | Instance width/height/material/operation overrides stay compatible with type constraints, host geometry, and schedules. |
| `BIR-V03` | P1 | Partial | Validate content library assets. | Catalog entries carry category, dimensions, clearance, MEP/maintenance zones, material slots, render support, and schedule/export metadata. |
| `BIR-V04` | P1 | Not started | Validate asset placement. | Placed assets are on floors/walls/ceilings/workplanes as appropriate, not floating or embedded in walls without intentional recess/opening. |
| `BIR-V05` | P1 | Not started | Validate family render/export parity. | Family visual geometry, material slots, plan symbols, schedule rows, and IFC/glTF export manifests agree. |

### W. Fixture Governance And Completion Accounting

| ID | Priority | Status | Item | Acceptance |
| -- | -------- | ------ | ---- | ---------- |
| `BIR-W01` | P0 | Partial | Define fixture classes. | Fixture corpus distinguishes minimal synthetic, target-house regression, benchmark seed, import/export roundtrip, performance stress, and user-realistic sketch cases. |
| `BIR-W02` | P0 | Done | Add status accounting script. | A script computes milestone/tracker completion percentages from this file plus generated evidence and fails on stale status claims. |
| `BIR-W03` | P0 | Partial | Add implementation evidence rows. | Each tracker item records code paths, tests, generated docs, evidence artifact, commit id, and known limitations before status becomes `Done`. |
| `BIR-W04` | P1 | Partial | Add wave closeout template. | Each wave produces a closeout report with agents, commits, tests, tracker changes, unresolved blockers, and next-wave recommendations. |
| `BIR-W05` | P1 | Done | Add quality gate for "Done". | CI or review script rejects status changes to `Done` without linked evidence rows and tests. |

## Wave 7 Worker E Operational Contracts

These rows define the first machine-checkable provenance and accounting shape
for `BIR-T01` through `BIR-W05`. They are not a claim that every product
surface is complete; they give agents and reviewers stable columns to preserve
while implementation deepens.

### Finding-To-Command Provenance

| Field | Required value |
| ----- | -------------- |
| `findingId` | Stable rule finding id, not only display text. |
| `sourceCommandId` | Original authoring command id when the finding can be traced to one. |
| `sourceRecipeRow` | Seed/recipe row or bundle command index when available. |
| `agentWave` | Wave/worker label for generated or remediated commands. |
| `commit` | Git commit that introduced or remediated the command/evidence. |
| `phasePacket` | Sketch-to-BIM phase packet or acceptance packet id. |

### Stale Evidence Invalidators

| Invalidator | Required digest / compare key | Applies to |
| ----------- | ----------------------------- | ---------- |
| Model revision | Workspace/model revision id | snapshots, screenshots, reports, exports |
| Rule digest | Advisor/integrity/renderer rule registry digest | findings, acceptance claims, review narrative |
| Renderer support matrix | Generated renderer-support-matrix digest | screenshots, visual/golden claims |
| Seed source | seed recipe/bundle/source digest | target-house and benchmark acceptance |
| Target spec | brief/BIR/checklist/capability-map digest | sketch feature acceptance |
| Git head | source commit | all generated evidence packets |

### Feature Coverage Dashboard Rows

| Column | Source |
| ------ | ------ |
| Feature id | sketch capability map, benchmark fixture, or tracker item id |
| Required elements | BIR/brief/fixture expected element ids or kinds |
| Current coverage | live model/evidence element ids, counts, and acceptance state |
| Open findings | grouped Advisor/integrity/renderer finding ids |
| Renderer support | renderer support matrix row and unsupported feature list |
| Screenshots | evidence artifact path and capture digest |
| Remaining blockers | unresolved P0/P1 tracker rows, stale evidence, or missing tests |

### Review Narrative Template

| Section | Required content |
| ------- | ---------------- |
| Scope | target seed/fixture, phase, source spec, wave, agent list |
| Changes | committed code/data/evidence changes with command provenance |
| Proof | tests, generated reports, screenshots, exports, and digests |
| Tolerances | accepted tolerances, false positives, owner, expiry, evidence |
| Blockers | open errors/warnings, stale evidence, missing fixtures, limitations |
| Next wave | prioritized follow-up rows and recommended owners |

### Advisor Noise And Review Workflow

| Contract | Required shape |
| -------- | -------------- |
| Grouping/dedup | `groupId`, root-cause rule, affected ids, representative finding, duplicate count |
| Fix priority | severity, phase ownership, dependency/root-cause rank, visible impact, active profile/lens relevance |
| Profile preset | architecture, structure, MEP, fire, accessibility, construction-readiness, exchange, sketch-acceptance |
| Audience explanation | concise UI text, agent technical detail, documentation text, same stable `ruleId` |
| False-positive review | classification: rule defect, accepted tolerance, profile mismatch, model defect; reviewer, evidence, expiry |

### Family And Content Validation

| Content class | Required validation keys |
| ------------- | ------------------------ |
| Family type | category, dimensions, host behavior, material slots, schedule fields, IFC mapping, render support |
| Instance override | width/height/material/operation compatibility, host geometry compatibility, schedule compatibility |
| Catalog asset | dimensions, clearance, MEP/maintenance zones, materials, render support, schedule/export metadata |
| Placement | floor/wall/ceiling/workplane support, non-floating position, non-embedded geometry unless intentional |
| Render/export parity | visual geometry, plan symbol, material slots, schedule rows, IFC/glTF manifest agreement |

### Fixture Governance Classes

| Class | Required use |
| ----- | ------------ |
| Minimal synthetic | One-rule fixtures that isolate a regression. |
| Target-house regression | Known target-house failures and remediation evidence. |
| Benchmark seed | Repeatable house/building benchmarks with expected summaries. |
| Import/export roundtrip | IFC/glTF/readback drift and semantic preservation fixtures. |
| Performance stress | Large or adversarial projects for bounded diagnostics. |
| User-realistic sketch | Realistic sketch/brief/BIR cases with methodology evidence. |

### Wave Closeout Template

| Field | Required content |
| ----- | ---------------- |
| Wave | wave number, date, parent commit, local commits |
| Agents | worker labels and ownership ranges |
| Tracker changes | status changes, evidence rows added, generated status digest |
| Tests | exact commands and pass/fail/skip result |
| Evidence | generated docs, artifacts, screenshots, manifests, digests |
| Blockers | unresolved defects, stale evidence, incomplete fixtures |
| Recommendations | next-wave priorities and owners |

## Implementation Evidence Rows

| ID | Code paths | Tests | Evidence artifacts | Commit | Limitations |
| -- | ---------- | ----- | ------------------ | ------ | ----------- |
| `BIR-A01` | `spec/bim-integrity-rendering-sketch-methodology-tracker.md`; `scripts/audit-bim-integrity-tracker.mjs` | `app/tests/test_bim_integrity_tracker_audit.py` | `spec/generated/bim-integrity-tracker-status.md` | `25d7e1baf` parent includes tracker/accounting baseline | Tracker exists; product rule coverage remains tracked separately. |
| `BIR-A03` | `app/bim_ai/constraints_metadata.py`; `app/bim_ai/constraints.py` | `app/tests/test_constraints_metadata.py`; `app/tests/test_constraints.py` | Constraint metadata registry and tests | `25d7e1baf` parent includes metadata baseline | Registry coverage is broad but not every future rule family is complete. |
| `BIR-C01` | `app/bim_ai/constraints.py`; `app/bim_ai/constructability_advisories.py` | `app/tests/test_constraints_wall_geometry.py`; `app/tests/test_constructability_advisories.py` | Constraint/advisor finding serialization | `25d7e1baf` parent includes hosted-opening integrity baseline | Additional UI parity hardening remains in `BIR-A04`/`BIR-H*`. |
| `BIR-C02` | `app/bim_ai/constraints.py`; `app/bim_ai/constructability_geometry.py` | `app/tests/test_constructability_geometry.py`; `app/tests/test_engine_constraints.py` | Constructability report findings | `25d7e1baf` parent includes envelope integrity baseline | More detached/exterior intent modeling remains open. |
| `BIR-C03` | `app/bim_ai/constraints.py`; `packages/web/src/plan/structuralValidation.ts` | `app/tests/test_constraints_wall_geometry.py`; `packages/web/src/plan/structuralValidation.test.ts` | Hosted span diagnostics | `25d7e1baf` parent includes span validation baseline | Opening conflict graph remains `BIR-C06`. |
| `BIR-C05` | `app/bim_ai/room_derivation.py`; `app/bim_ai/constraints.py` | `app/tests/test_constraints_room_unenclosed.py`; `app/tests/test_engine_constraints.py` | Access/helper leakage findings | `25d7e1baf` parent includes helper-leakage baseline | Helper visibility serialization policy remains broader `BIR-B03`. |
| `BIR-I01` | `spec/generated/renderer-support-matrix.md`; `packages/web/src/viewport/rendererDiagnostics.ts` | `packages/web/src/viewport/rendererDiagnostics.test.ts`; `packages/web/src/plan/symbology.docs.test.ts` | `spec/generated/renderer-support-matrix.md` | `25d7e1baf` parent includes renderer matrix baseline | Matrix must keep expanding as fidelity rows close. |
| `BIR-M06` | `spec/generated/target-house-1-required-features.json`; `scripts/audit-seed-artifacts.mjs` | `app/tests/test_seed_artifact_roundtrip.py`; `app/tests/test_evidence_manifest_closure.py` | `seed-artifacts/target-house-1/evidence/*`; generated required features | `25d7e1baf` parent includes target-house acceptance-pack baseline | Final clean acceptance remains `BIR-N04`/Wave 8. |
| `BIR-W02` | `scripts/audit-bim-integrity-tracker.mjs` | `app/tests/test_bim_integrity_tracker_audit.py` | `spec/generated/bim-integrity-tracker-status.md` | `25d7e1baf` parent includes status script baseline | This wave extends accounting, but not every tracker row has full implementation evidence yet. |
| `BIR-W05` | `scripts/audit-bim-integrity-tracker.mjs` | `app/tests/test_bim_integrity_tracker_audit.py` | `spec/generated/bim-integrity-tracker-status.md` | Wave 7 Worker E local commit | Gate covers `Done` tracker status; it does not certify `Partial` rows. |

## Proposed Work Waves

Each wave assumes roughly five parallel agents with disjoint ownership. Agents
should commit their own work, then an integration pass should run tests, resolve
conflicts, update tracker statuses, commit, and push.

### Wave 1: P0 BIM Integrity Foundation

Goal: close `M1`.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W1-A | Rule taxonomy and registry | `BIR-A02`, `BIR-A03`, `BIR-A05`, `BIR-A07` |
| W1-B | Hosted openings and helper leakage | `BIR-C01` through `BIR-C05`, target-house detached-door fixture |
| W1-C | Envelope/floor/room containment | `BIR-B02`, `BIR-C02`, `BIR-D01` through `BIR-D03` |
| W1-D | Authoring/command guards | `BIR-B01`, `BIR-B04`, `BIR-B05`, `BIR-B06` |
| W1-E | Advisor parity and CLI/API surface | `BIR-A04`, `BIR-H01` through `BIR-H04`, `BIR-O01`, `BIR-O02` |

Exit: the current detached-door/access-wall class cannot pass with "No
findings" through UI, CLI, or API.

### Wave 2: P0 Renderer Fidelity Foundation

Goal: close `M2`.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W2-A | Renderer support matrix and diagnostic schema | `BIR-I01`, `BIR-I02`, `BIR-I06`, `BIR-I07` |
| W2-B | Roof/opening rendering | `BIR-J02`, `BIR-F02`, target-house roof court golden |
| W2-C | Wall hosted cuts | `BIR-J01`, `BIR-C04`, door/window/wall-opening goldens |
| W2-D | Slab/stair/railing rendering | `BIR-J03`, `BIR-J04`, `BIR-E01`, `BIR-E03` |
| W2-E | Visual golden harness | `BIR-J09`, `BIR-O03`, screenshot/canvas checks |

Exit: target-house-critical renderer failures are visible as diagnostics and
cannot silently pass acceptance.

### Wave 3: P0 Sketch Methodology Gate

Goal: close `M3`.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W3-A | Methodology naming and docs | `BIR-M01`, `BIR-M08`, update `SKILL.md` and methodology references |
| W3-B | Phase packet evidence extensions | `BIR-M02`, `BIR-M04`, `BIR-M05` |
| W3-C | Target-house acceptance compiler | `BIR-M06`, `BIR-N05` |
| W3-D | Semantic checklist and drift loop | `BIR-M03`, `BIR-M07` |
| W3-E | Seed artifact cleanliness | `BIR-M09`, `BIR-N03`, acceptance tests |

Exit: an Advisor-clean but visually/specifically wrong sketch model cannot be
reported as accepted by the sketch-to-BIM skill.

### Wave 4: P1 Domain Depth

Goal: close `M4`.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W4-A | Rooms/access/egress | `BIR-D04` through `BIR-D07` |
| W4-B | Floors/stairs/railings/vertical graph | `BIR-E02` through `BIR-E07` |
| W4-C | Roof/envelope/loggia/facade | `BIR-F03` through `BIR-F07` |
| W4-D | Structure-lite and MEP-lite | `BIR-G01` through `BIR-G04` |
| W4-E | Fire/accessibility/code profiles | `BIR-G05` through `BIR-G07` |

Exit: ordinary small-house project-initiation BIM has robust deterministic
health coverage across architecture, structure-lite, and MEP-lite.

### Wave 5: Rendering/Exchange Completeness

Goal: close `M5`.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W5-A | IFC/glTF manifest diagnostics | `BIR-K01`, `BIR-K03` |
| W5-B | Export readback | `BIR-K02`, `BIR-K04` |
| W5-C | Schedules/sheets evidence | `BIR-K05`, `BIR-K06` |
| W5-D | Materials/lenses/families | `BIR-J05`, `BIR-J07`, `BIR-J08` |
| W5-E | IDS/BIR validation | `BIR-K07`, methodology exchange evidence |

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

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W6-A | Advisor profiling/incremental rules | `BIR-L01`, `BIR-L04` |
| W6-B | Renderer profiling | `BIR-L02`, `BIR-J10` |
| W6-C | WebSocket/dev-server stability | `BIR-L03` |
| W6-D | Background jobs/caching | `BIR-L05` |
| W6-E | UI degradation safeguards | `BIR-L06`, smoke tests |

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

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W7-A | Kernel invariants and units | `BIR-P01` through `BIR-P08` |
| W7-B | Transaction/collaboration safety | `BIR-Q01` through `BIR-Q08` |
| W7-C | 2D documentation fidelity | `BIR-R01` through `BIR-R06` |
| W7-D | Site/georeferencing/imports | `BIR-S01` through `BIR-S06` |
| W7-E | Provenance, UX, content, accounting | `BIR-T01` through `BIR-W05` |

Exit: the platform has explicit invariants, traceability, safe remediation,
collaboration safety, 2D/documentation fidelity, content quality, and completion
accounting.

### Wave 8: Target-House Rerun Readiness And Closure

Goal: close `M8`.

| Agent | Ownership | Primary items |
| ----- | --------- | ------------- |
| W8-A | Current geometry diagnostic report | `BIR-N01` |
| W8-B | Seed source correction | `BIR-N02` |
| W8-C | Final Advisor/integrity/renderer clean pass | `BIR-N04` |
| W8-D | Visual/evidence acceptance | `BIR-N05`, `BIR-N06` |
| W8-E | Performance and final package | `BIR-N07`, final commits/push |

Exit: `target-house-1` is regenerated and accepted at current head with clean
integrity, renderer, Advisor, evidence, export, and methodology gates.

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

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Rule explosion makes Advisor noisy. | Users ignore findings. | Use profiles, severity policy, suppressibility, and rule ownership. |
| Renderer diagnostics duplicate Advisor issues. | Confusing UX. | Distinguish model invalid from model valid but renderer unsupported. |
| Sketch fidelity leaks into normal Advisor. | Architects see irrelevant warnings. | Keep brief/spec checks in skill/methodology packets only. |
| Performance regresses when many checks run live. | Orbit/selection feel slow. | Incremental checks, timing reports, background jobs, cached evidence. |
| Agents fix symptoms in target-house only. | Same class of bugs returns. | P0 fixtures and generalized rules before seed rerun acceptance. |
| Export and viewport drift remains hidden. | IFC/glTF artifacts are misleading. | Export manifests, readback, and renderer/exchange support matrix. |

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
