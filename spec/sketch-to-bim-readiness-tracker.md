# Sketch-to-Real-BIM Readiness Tracker

Last updated: 2026-05-18

Purpose: close the gaps that block a high-quality AI agent from turning a sketch
or floorplan into a faithful, usable BIM seed through the public product
surfaces. This tracker is intentionally broader than sketch geometry. A target
house run is not ready until the workflow can create the visible building and
the minimum BIM information needed for rooms, quantities, coordination,
classification, exports, and evidence.

Related sources:

- `claude-skills/sketch-to-bim/SKILL.md`
- `claude-skills/sketch-to-bim/sketch_bim.py`
- `spec/sketch-to-bim-methodology.md`
- `spec/sketch-to-bim-product-surfaces.md`
- `spec/sketch-to-bim-capability-matrix.json`
- `spec/ui-mcp-parity-tracker.md`
- `spec/generated/api-descriptor-ledger.md`
- `spec/target-house/target-house-seed.md`
- `~/repos/bim-book/docs/chapters`

## Executive Summary

The sketch-to-BIM workflow has the right process shape: visual read, Sketch
Understanding IR, capability matrix, phased authoring, live Advisor, screenshots,
visual gate, warning/error-led refinement, and final acceptance. The product also
has a strong generic agent base: typed CLI commands, `cmd-v3.0` bundles,
dry-run/commit, query helpers, and an API descriptor catalogue.

The remaining problem is integration maturity. Some sketch tools are still
skill-local orchestration, some API descriptors are contract-only, and the
methodology does not yet require enough BIM information to produce models that
are useful beyond a visual seed. Target-house-1 should not start until the P0 and
P1 items below are closed or explicitly accepted as tolerances.

## Status Model

| Code          | Meaning                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `Done`        | Implemented, documented, tested, and reflected in the active workflow.           |
| `Partial`     | Usable today, but incomplete, inconsistent, or not yet fully public/productized. |
| `Not started` | No known active implementation beyond generic/raw fallback.                      |
| `Blocked`     | Cannot be completed until another dependency lands.                              |

| Priority | Meaning                                                               |
| -------- | --------------------------------------------------------------------- |
| `P0`     | Required before a serious target-house-1 generation run.              |
| `P1`     | Required before calling the workflow excellent / repeatable.          |
| `P2`     | Important for broader projects, but not a blocker for target-house-1. |
| `P3`     | Nice-to-have polish or later scale work.                              |

## Milestones

| Milestone                                       | Status      | Exit Criteria                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M0` Active workflow preflight                  | Done        | Skill/helper/docs use active paths; `doctor` file checks pass; archived methodology is only historical reference; no stale default capability/archetype paths remain.                                                                                                                              |
| `M1` Public agent surface for sketch initiation | Partial     | P0 CLI/product contract is closed for target-house readiness: a non-browser agent can validate IR, compile/author a phase, dry-run, commit, query, collect Advisor/constructability evidence, and accept/reject a phase. MCP resources and server-hosted seed compile remain P1/P2 follow-up work. |
| `M2` Real BIM information requirements          | Partial     | Sketch IR and acceptance gates require rooms/spaces, element semantics, type/material layer intent, classification, quantities, and project/site assumptions appropriate to the quality target. C01-C05 are active; quantity/site expansion remains in later C items.                              |
| `M3` Evidence and acceptance hardening          | Partial     | Advisor/constructability evidence collection, finding dispositions, visual evidence contract, and BIM data checks are active. Current-head live screenshots, semantic visual evaluation, stale checks, and export validation remain open.                                                          |
| `M4` Target-house readiness rehearsal           | Not started | A dry rehearsal produces only planning artifacts for target-house-1: IR, BIM information requirements, capability gap map, phase plan, acceptance checklist, and risk register. No seed artifact is committed yet.                                                                                 |
| `M5` Production-quality target-house-1 run      | Not started | The seed is generated in phases, accepted with current-head evidence, and packaged as the only seed artifact when requested.                                                                                                                                                                       |

## Current Surface Assessment

### CLI

The CLI is currently the strongest agent path. It already exposes:

- `model dry-run` and `model commit-bundle` for transaction-safe bundle flow.
- `query elements`, `query levels`, `query types`, and `query views`.
- typed authoring helpers such as `author wall`, `author wall-chain`, and
  `author stair-between-levels`.
- typed MEP and structure helpers for route/equipment/column/beam-lite cases.
- `advisor` and `qa advisor`.
- `seed-dsl compile`.
- `sketch ir validate`, `sketch seed compile`, `sketch phase apply`, and
  `sketch phase accept`.
- `initiation-run` for evidence packages, screenshots, visual gates, and
  acceptance gates.

CLI should remain first-class. It is easier to test in CI, easier for external
coding agents to call, and already mirrors the MCP intent for many surfaces.

### API / MCP-Grade Descriptors

The API descriptor registry is the closest current MCP catalogue. It includes
sketch descriptors for `sketch.ir.validate`, `sketch.seed.compile`,
`sketch.phase.apply`, and `sketch.phase.accept`. However:

- `sketch.seed.compile` is descriptor/CLI implemented, but the API route is
  intentionally blocked until the Node seed compiler is hosted server-side.
- `sketch.phase.apply` is descriptor/CLI implemented, but the sketch-specific
  backend wrapper is intentionally blocked; the real commit path is the generic
  bundle route.
- Advisor/evidence collection is split between product endpoints, CLI, and
  skill-local browser automation.
- There is no dedicated MCP server/resource layer yet for model snapshots,
  command schemas, Advisor state, evidence packages, or sketch assets.

Best direction: do not replace the CLI with MCP prematurely. Promote the same
typed contracts to API/MCP resources where server-side execution makes sense,
and keep the CLI as the canonical external-agent transport until those routes
are genuinely implemented.

### UI / Cmd+K

Cmd+K is a useful capability directory, but it is not proof of agent parity.
Many commands activate tools that still require human gestures. For sketch-to-BIM
readiness, Cmd+K should map each UI capability to the completed agent equivalent:
`tool.wall` maps to `author.wall` / `author.wall_chain`; `tool.roof-sketch` maps
to roof macros and `opening.roof_opening`; `tool.door` maps to
`opening.door_on_wall`.

### Skill-Local Helper

The helper provides useful orchestration for a disciplined agent, but it should
not be treated as the public product surface. Skill-local commands are allowed to
compose public CLI/API calls, capture browser evidence, and write phase packets.
They should not be the only way to perform a core product operation.

### Error Detection As Authoring Feedback

The product's Advisor, constructability profiles, validation reports, dry-run
warnings, evidence-package findings, and UI warning surfaces are core authoring
inputs. A sketch-to-BIM agent must inspect them while building, not merely at the
end. Every phase packet should preserve the finding code, severity, profile,
affected element ids, and disposition. Current-phase warnings are work items:
fix them, schedule them for a later phase only when the phase boundary is
legitimate, or write a tolerance with evidence and expiry.

## Tracker Items

### A. Active Workflow And Preflight

| ID            | Priority | Status | Item                                      | Acceptance                                                                                                                                                                            |
| ------------- | -------- | ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKB-RDY-A01` | P0       | Done   | Create active methodology entrypoint.     | `spec/sketch-to-bim-methodology.md` exists and points to the current workflow, readiness tracker, capability matrix, product surfaces, and target-house process.                      |
| `SKB-RDY-A02` | P0       | Done   | Replace stale archive path defaults.      | Skill examples and `sketch_bim.py` default to `spec/sketch-to-bim-capability-matrix.json`; no active workflow command requires `spec/archive/*` unless explicitly reading history.    |
| `SKB-RDY-A03` | P0       | Done   | Restore active archetype manifest.        | `spec/sketch-to-bim-archetypes.json` exists or the helper intentionally points to the archived manifest with a clear reason. `archetypes --query` works from a clean checkout.        |
| `SKB-RDY-A04` | P0       | Done   | Define current process audit tracker.     | `spec/sketch-to-bim-process-audit-tracker.md` exists and identifies this tracker as the current source of readiness work, not the old archived audit.                                 |
| `SKB-RDY-A05` | P0       | Done   | Make `doctor` actionable.                 | `doctor` reports separate `filesOk`, `apiOk`, `webOk`, and `liveOk` so a stopped dev server is not confused with stale docs. `--require-live` still fails if app/API are not running. |
| `SKB-RDY-A06` | P1       | Done   | Add CI check for stale skill paths.       | `packages/cli/sketchSkillHelper.smoke.test.mjs` fails if active sketch skill files default normal runs to archived capability/methodology/archetype paths.                            |
| `SKB-RDY-A07` | P1       | Done   | Add command smoke tests for skill helper. | `packages/cli/sketchSkillHelper.smoke.test.mjs` covers `doctor`, `tools`, `archetypes`, `compile` path validation, `phase-accept` packet generation, and stale-check behavior.        |

### B. Public CLI / MCP Surface

| ID            | Priority | Status      | Item                                                                       | Acceptance                                                                                                                                                                                                                       |
| ------------- | -------- | ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKB-RDY-B01` | P0       | Done        | Keep CLI as canonical external-agent path until MCP routes are executable. | Tracker and methodology state that CLI is allowed and preferred when API/MCP descriptor is contract-only.                                                                                                                        |
| `SKB-RDY-B02` | P0       | Done        | Make sketch tool status explicit in descriptor ledger.                     | Generated API ledger distinguishes executable, contract-only, CLI-only, and skill-local surfaces for `sketch.*`, `qa.*`, `export.*`, and evidence-adjacent tools.                                                                |
| `SKB-RDY-B03` | P0       | Done        | Server-host seed compiler or formalize CLI-only compiler.                  | The descriptor/product docs formally mark `sketch.seed.compile` as CLI-only until the Node compiler is hosted server-side; MCP clients must call the CLI/sidecar compiler.                                                       |
| `SKB-RDY-B04` | P0       | Done        | Phase apply must have one blessed transaction path.                        | Methodology and product docs name `/api/models/{model_id}/bundles` plus CLI `sketch phase apply` as the authoritative transaction path; the sketch wrapper is documented as contract-only.                                       |
| `SKB-RDY-B05` | P0       | Done        | Promote Advisor to stable agent tool.                                      | `qa.advisor` and `qa.constructability` descriptors expose warning/info/error grouping, profile selection, element ids, and UI-equivalent filter context.                                                                         |
| `SKB-RDY-B06` | P0       | Done        | Add evidence collection tool.                                              | CLI `sketch evidence collect` writes snapshot, validate, evidence package, Advisor error/warning/info/all, constructability report, model stats, finding dispositions, visual contract, and manifest without browser automation. |
| `SKB-RDY-B07` | P0       | Done        | Add visual evidence contract.                                              | `sketch.visual-evidence-contract.v1` defines required screenshot/viewpoint inputs and outputs. Browser automation can implement capture, but the evidence schema is product-owned.                                               |
| `SKB-RDY-B08` | P1       | Done        | Add MCP resources for model state.                                         | API descriptors and equivalent routes expose snapshot, summary, levels, views, types, elements, Advisor, command log, and evidence package. `spec/generated/api-descriptor-ledger.md` reports B08 resource coverage as 9/9 executable.                                                         |
| `SKB-RDY-B09` | P1       | Partial     | Export backend command schemas.                                            | `GET /api/v3/commands` and `GET /api/v3/commands/{name}` are descriptor-backed and executable. `spec/generated/api-descriptor-ledger.md` reports 2/2 command schema surfaces executable; example payloads and full raw/semantic mapping remain explicitly partial in command metadata.        |
| `SKB-RDY-B10` | P1       | Done        | Query/resolve parity for sketch authoring.                                 | API descriptors and equivalent routes cover elements, levels, views, types, host discovery, loops, nearest wall, line-matched wall, host face, family type, room boundary, default plan view, and active/default level. The generated audit reports B10 query/resolve coverage as 14/14 executable. |
| `SKB-RDY-B11` | P1       | Done        | Cmd+K-to-agent equivalence map.                                            | Cmd+K entries that activate tools declare execution kind and agent-equivalence metadata through the command capability graph. The generated audit reports 106/106 activator entries mapped and zero unmapped activators.                                                                         |
| `SKB-RDY-B12` | P1       | Not started | One command to run a phase loop.                                           | `sketch phase run` or equivalent takes IR, phase plan, bundle/recipe, model id, and returns dry-run/commit/evidence/acceptance packet.                                                                                           |

Closeout note for B08-B11: Wave 2 Worker 3 added API v3 descriptors for model
summary, command log, evidence package, command schema export, and query/resolve
routes. `scripts/audit-ui-mcp-parity.mjs` now emits a machine-auditable
`SKB B08-B11 Audit` section in `spec/generated/api-descriptor-ledger.md`. B09 is
kept `Partial` because the schema export route is live, but per-command examples
and complete raw/semantic promotion metadata are still marked TODO in the command
schema catalogue.

### C. Sketch Understanding And BIM Information Requirements

| ID            | Priority | Status | Item                                               | Acceptance                                                                                                                                                                                                              |
| ------------- | -------- | ------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKB-RDY-C01` | P0       | Done   | Extend Sketch IR with BIM requirements.            | Active IR validation requires `informationRequirements` for `project_initiation_bim`/`documentation_ready`, including quality target, LOD/LOI intent, exchange goal, model uses, discipline scope, and required checks. |
| `SKB-RDY-C02` | P0       | Done   | Add room/space requirements.                       | IR and acceptance require room names/numbers, level, target area, function, occupancy/use, bounding status, doors/access, schedule inclusion, and IfcSpace intent.                                                      |
| `SKB-RDY-C03` | P0       | Done   | Add element semantic requirements.                 | Exterior walls, interior walls, slabs, roofs, stairs, doors, windows, railings, rooms, and assets declare expected BIM categories and IFC export entity intent.                                                         |
| `SKB-RDY-C04` | P0       | Done   | Add material/layer-set requirements.               | Wall/slab/roof layer-set requirements carry layer intent, thicknesses, and thermal/fire/acoustic placeholders where quality target requires them.                                                                       |
| `SKB-RDY-C05` | P0       | Done   | Add classification requirements.                   | Rooms have DIN277-like area/use placeholders; building elements have DIN276/cost group placeholders; IFC classification references are planned.                                                                         |
| `SKB-RDY-C06` | P1       | Done   | Add structure-lite requirements.                   | Active IR validation and examples require load-bearing flags, primary support assumptions, beam/column-lite placeholders where visible/needed, opening coordination, and load-path notes.                               |
| `SKB-RDY-C07` | P1       | Done   | Add MEP-lite requirements.                         | Active IR validation and examples require wet-room stacking, vertical shafts/risers, equipment zones, route placeholders, service levels, and opening requests.                                                         |
| `SKB-RDY-C08` | P1       | Done   | Add planning/site requirements.                    | Active IR validation and examples require orientation, base point, survey point, property line/setback availability, sun assumptions, and code locale.                                                                  |
| `SKB-RDY-C09` | P1       | Done   | Add export requirements.                           | Active IR validation and data-quality checks require IFC, glTF/GLB, PDF/sheets, schedules, evidence package, and source bundle exchange outputs.                                                                        |
| `SKB-RDY-C10` | P2       | Done   | Add sustainability/material passport starter data. | Active IR validation and examples require material passport starter rows with EPD/source confidence, embodied-carbon placeholder, reuse/recyclability notes, and quantity source for material-layer keys.               |

### D. Seed DSL And Authoring Macros

| ID            | Priority | Status | Item                                                   | Acceptance                                                                                                                                                                                                                                                                              |
| ------------- | -------- | ------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKB-RDY-D01` | P0       | Done   | Document seed DSL coverage against target-house needs. | `spec/sketch-to-bim-capability-matrix.json` includes `targetHouseSeedDslCoverage`, mapping roof terrace, folded wrapper, recessed loggia, room programme, and deterministic evidence views to DSL fields, typed CLI tools, raw commands, required evidence, and remaining non-DSL gaps. |
| `SKB-RDY-D02` | P0       | Done   | Roof terrace macro.                                    | `features.roofTerraces[]` emits roof opening, occupied terrace floor, return walls, guard rail, access openings, and feature-linked evidence views without opaque raw bundle surgery.                                                                                                   |
| `SKB-RDY-D03` | P0       | Done   | Folded wrapper shell macro.                            | `features.foldedWrappers[]` emits deterministic wrapper walls, optional roof/wall attachment, explicit return walls, fascia sweeps, and material intent; final mass placeholders are not required.                                                                                      |
| `SKB-RDY-D04` | P0       | Done   | Recessed loggia macro.                                 | `features.loggias[]` now covers recessed facade walls, side returns, balcony slab, rail, bay rhythm openings, and access openings.                                                                                                                                                      |
| `SKB-RDY-D05` | P0       | Done   | Room programme macro.                                  | `features.roomProgrammes[]` emits room outlines or boundary-wall room polys, access doors, stairs, and slab openings, with programme metadata preserved.                                                                                                                                |
| `SKB-RDY-D06` | P0       | Done   | Viewpoint/evidence macro.                              | `viewpoints[]` compiles deterministic saved 3D/plan/diagnostic views with camera, clip, overlay, evidence role, and feature-id metadata.                                                                                                                                                |
| `SKB-RDY-D07` | P1       | Done   | Facade rhythm/opening macro.                           | `features.facadeRhythms[]` compiles hosted bay windows/doors, opening schedule metadata, and mullion proxy sweeps.                                                                                                                                                                      |
| `SKB-RDY-D08` | P1       | Done   | Wall/floor/roof type builder.                          | `types.wallTypes[]`, `types.floorTypes[]`, and `types.roofTypes[]` compile layers plus BIM type intent metadata and known element assignments.                                                                                                                                          |
| `SKB-RDY-D09` | P1       | Done   | BIM asset placement macro.                             | `assets[]` and `placedAssets[]` preserve type ids, room association, schedule category, and evidence role through asset metadata/placement params.                                                                                                                                      |
| `SKB-RDY-D10` | P1       | Done   | Sheet/schedule/documentation macro.                    | `documentation.views`, `documentation.sheets`, `documentation.schedules`, and `documentation.scheduleViews` compile starter elevations/sections, room/opening schedules, and sheet viewports.                                                                                           |

Closeout note for D01-D06: seed DSL compilation now carries target-house-critical
intent through semantic macro fields in `packages/cli/lib/seed-dsl.mjs`, and the
modern-house example compiles those fields into reviewable `cmd-v3.0` commands.
Remaining risks are evidence/renderer certification risks tracked in E-items, not
manual seed authoring gaps.

Closeout note for D07-D10: the same modern-house example now covers hosted facade
rhythm, typed assemblies with BIM intent metadata, room-associated asset markers,
and starter documentation sheets/schedules. These macros produce product command
bundles; final acceptance still depends on live Advisor, screenshot, schedule,
and export evidence.

### E. Validation, Advisor, Evidence, And Acceptance

| ID            | Priority | Status      | Item                                       | Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------- | ----------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SKB-RDY-E01` | P0       | Done        | Current-head evidence requirement.         | Final/phase acceptance packets include evidence freshness proof for current git head, model revision, Advisor rule digest, IR hash, and capability matrix hash; stale or missing proof creates explicit acceptance blockers.                                                                                                                                                                                                         |
| `SKB-RDY-E02` | P0       | Done        | Phase acceptance schema.                   | Phase packet includes phase id, feature ids, IR coverage, capability coverage, Advisor summary, visual checklist, BIM data quality, finding dispositions, blockers, tolerances, and evidence paths.                                                                                                                                                                                                                                  |
| `SKB-RDY-E03` | P0       | Partial     | Visual gates for sketch-critical features. | Required views prove roof terrace, loggia, wrapper, cladding, interior plan, and diagnostics. Missing/nonblank-only screenshots are not enough for final acceptance.                                                                                                                                                                                                                                                                 |
| `SKB-RDY-E04` | P0       | Done        | Advisor/constructability profile parity.   | CLI/API evidence captures Advisor error/warning/info/all plus constructability profile reports with profile id, element ids, and disposition tracking for project initiation.                                                                                                                                                                                                                                                        |
| `SKB-RDY-E05` | P0       | Done        | BIM data quality gate.                     | Acceptance writes `bim-data-quality.json` and checks rooms, levels, element categories, material/type completeness, classification placeholders, schedules, and export readiness.                                                                                                                                                                                                                                                    |
| `SKB-RDY-E06` | P1       | Partial     | IFC/IDS-style validation gate.             | `sketch evidence collect` and `initiation-run` now write `export-validation.json` (`sketch.exchange-validation.v1`) from IFC/glTF manifests plus normalized snapshot evidence, checking hierarchy, entity classes, spaces, material layers, classifications, and planned Pset/quantity rows. Seed verification can require this artifact with `--require-exchange-validation`; concrete backend Pset/quantity rows remain follow-up. |
| `SKB-RDY-E07` | P1       | Not started | Semantic visual evaluator.                 | Beyond pixel deltas, checklist or CV-assisted evaluator detects critical features such as roof cutout present, wrapper shell thickness, loggia recess, and cladding rhythm.                                                                                                                                                                                                                                                          |
| `SKB-RDY-E08` | P1       | Done        | Tolerance protocol.                        | Evidence collection writes `tolerance-ledger.json` and phase acceptance writes `phase-tolerance-ledger.json` (`sketch.tolerance-ledger.v1`). Later-phase/tolerated/blocked warning/error findings must include severity, affected feature ids, reason, owner, expiry condition, and evidence links; unclassified/fix-now/fix-in-phase findings block acceptance.                                                                     |
| `SKB-RDY-E10` | P0       | Done        | Advisor-driven refinement loop.            | Evidence collection and phase acceptance record warning/info/error findings and enforce dispositions: current-phase findings must be fixed, deferred with phase rationale, tolerated with evidence, or marked blocked before phase acceptance.                                                                                                                                                                                       |
| `SKB-RDY-E09` | P2       | Partial     | Benchmark goldens for sketch cases.        | `spec/sketch-to-bim-golden-seeds.json` now carries planned live-golden structure for each case, and `initiation-golden` writes per-case `live-golden-plan.json` without creating seed artifacts. Actual live screenshot/Advisor/evidence baselines still need capture after approved model generation.                                                                                                                               |

### F. Target-House-1 Specific Readiness

| ID            | Priority | Status | Item                                       | Acceptance                                                                                                                                                                                                                                                                    |
| ------------- | -------- | ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKB-RDY-F01` | P0       | Done   | Target-house Sketch IR.                    | Draft IR exists at `spec/target-house/target-house-1-sketch-ir.draft.json`, generated from target-house images, floorplan, and seed spec, with non-negotiables, dimensions, required views, assumptions, information requirements, and feature ids.                           |
| `SKB-RDY-F02` | P0       | Done   | Target-house BIM information requirements. | `spec/target-house/target-house-1-bim-information-requirements.md` covers floorplan rooms/spaces, schedule data, wall/roof/slab type intent, classification placeholders, structure-lite, MEP-lite, and export goals.                                                         |
| `SKB-RDY-F03` | P0       | Done   | Target-house capability map.               | `spec/target-house/target-house-1-capability-map.md` maps every critical visual/BIM feature to capability support, product surface, status, required evidence, and fallback/tolerance policy.                                                                                 |
| `SKB-RDY-F04` | P0       | Done   | Target-house phase plan.                   | `spec/target-house/target-house-1-phase-plan.md` defines envelope-first phases: preflight, massing/plinth, shell/roof, roof terrace, loggia/openings/cladding, rooms/stair, BIM data, documentation/export, and final acceptance.                                             |
| `SKB-RDY-F05` | P0       | Done   | Target-house risk register.                | `spec/target-house/target-house-1-risk-register.md` covers roof cutout render, folded shell thickness, roof-wall seams, cladding artifacts, loggia depth, stair/slab opening, room enclosure, scale conflict, export semantics, Advisor drift, load path, and stale evidence. |
| `SKB-RDY-F06` | P0       | Done   | Target-house no-seed rehearsal packet.     | `spec/target-house/target-house-1-no-seed-readiness-packet.md` indexes the planning packet and states that no `seed-artifacts/target-house-1` may be created before user approval for generation.                                                                             |

### G. Documentation And Developer Experience

| ID            | Priority | Status | Item                                    | Acceptance                                                                                                                                                                                                                                                           |
| ------------- | -------- | ------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKB-RDY-G01` | P0       | Done   | Clarify source-of-truth docs.           | Active docs explain which files are current and which archive files are historical.                                                                                                                                                                                  |
| `SKB-RDY-G02` | P0       | Done   | Clarify CLI vs MCP decision.            | Docs state when to use CLI, API/MCP descriptor, raw bundle, or skill helper.                                                                                                                                                                                         |
| `SKB-RDY-G03` | P1       | Done   | Add one-page external-agent quickstart. | `spec/sketch-to-bim-agent-quickstart.md` gives the canonical CLI path to run doctor, validate IR/capability coverage, compile/apply phases, collect evidence, and accept/reject.                                                                                     |
| `SKB-RDY-G04` | P1       | Done   | Add target-house readiness checklist.   | `spec/target-house/target-house-1-acceptance-checklist.md` can be filled before generation and attached to seed evidence after generation.                                                                                                                           |
| `SKB-RDY-G05` | P1       | Done   | Add examples for real BIM data.         | `spec/examples/seed-dsl-modern-house.example.json`, `spec/examples/sketch-understanding-ir.example.json`, and the external-agent quickstart show spaces, classifications, material layers, MEP-lite, structure-lite, schedules, exports, and room-associated assets. |

## Pre-Target-House-1 Gate

Do not start the real `target-house-1` seed generation until these are true:

1. `SKB-RDY-A01` through `SKB-RDY-A05` are closed.
2. `SKB-RDY-B01` through `SKB-RDY-B07` are closed or explicitly accepted with a
   documented CLI-only tolerance.
3. `SKB-RDY-C01` through `SKB-RDY-C05` are closed.
4. `SKB-RDY-D01` through `SKB-RDY-D06` are closed or the target-house phase plan
   explicitly uses lower-level commands with evidence requirements.
5. `SKB-RDY-E01` through `SKB-RDY-E05` are closed.
6. `SKB-RDY-F01` through `SKB-RDY-F06` are complete.

## Recommended Work Waves

### Wave 1: Preflight And Active Docs

Close `A01-A05`, `G01-G02`. Outcome: the skill and helper start from active docs
and active capability data; `doctor` gives a truthful readiness report.

### Wave 2: Public Agent Surface

Close `B02-B07`, improve descriptor ledger statuses, and document the blessed
CLI/API/MCP paths. Outcome: an agent can use product surfaces rather than hidden
helper assumptions for sketch initiation.

### Wave 3: Real BIM Methodology

Close `C01-C05`, `E05`, and `G05`. Outcome: project-initiation BIM means useful
BIM information, not only a convincing shell.

### Wave 4: Authoring Macros

Close `D01-D06`, with target-house-specific proof for roof terrace, wrapper,
loggia, rooms, and evidence views. Outcome: the target can be authored without
manual opaque bundle surgery.

### Wave 5: Acceptance Hardening

Close `E01-E08`. Outcome: final acceptance is current, visual, semantic,
Advisor-clean or tolerance-explicit, and BIM-data-aware.

### Wave 6: Target-House Readiness Rehearsal

Close `F01-F06`. Outcome: the generation run has a precise plan and known risk
register before any seed artifact is recreated.
