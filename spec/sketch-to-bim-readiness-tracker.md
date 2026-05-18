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

| Code | Meaning |
| --- | --- |
| `Done` | Implemented, documented, tested, and reflected in the active workflow. |
| `Partial` | Usable today, but incomplete, inconsistent, or not yet fully public/productized. |
| `Not started` | No known active implementation beyond generic/raw fallback. |
| `Blocked` | Cannot be completed until another dependency lands. |

| Priority | Meaning |
| --- | --- |
| `P0` | Required before a serious target-house-1 generation run. |
| `P1` | Required before calling the workflow excellent / repeatable. |
| `P2` | Important for broader projects, but not a blocker for target-house-1. |
| `P3` | Nice-to-have polish or later scale work. |

## Milestones

| Milestone | Status | Exit Criteria |
| --- | --- | --- |
| `M0` Active workflow preflight | Done | Skill/helper/docs use active paths; `doctor` file checks pass; archived methodology is only historical reference; no stale default capability/archetype paths remain. |
| `M1` Public agent surface for sketch initiation | Partial | A non-browser agent can validate IR, compile/author a phase, dry-run, commit, query, collect Advisor/constructability evidence, and accept/reject a phase through CLI/MCP-grade descriptors. |
| `M2` Real BIM information requirements | Not started | Sketch IR and acceptance gates require rooms/spaces, element semantics, type/material layer intent, classification, quantities, and project/site assumptions appropriate to the quality target. |
| `M3` Evidence and acceptance hardening | Partial | Current-head live evidence, screenshots, visual gates, Advisor/constructability, BIM data checks, stale checks, and exported artifacts are all required by final acceptance. |
| `M4` Target-house readiness rehearsal | Not started | A dry rehearsal produces only planning artifacts for target-house-1: IR, BIM information requirements, capability gap map, phase plan, acceptance checklist, and risk register. No seed artifact is committed yet. |
| `M5` Production-quality target-house-1 run | Not started | The seed is generated in phases, accepted with current-head evidence, and packaged as the only seed artifact when requested. |

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

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-A01` | P0 | Done | Create active methodology entrypoint. | `spec/sketch-to-bim-methodology.md` exists and points to the current workflow, readiness tracker, capability matrix, product surfaces, and target-house process. |
| `SKB-RDY-A02` | P0 | Done | Replace stale archive path defaults. | Skill examples and `sketch_bim.py` default to `spec/sketch-to-bim-capability-matrix.json`; no active workflow command requires `spec/archive/*` unless explicitly reading history. |
| `SKB-RDY-A03` | P0 | Done | Restore active archetype manifest. | `spec/sketch-to-bim-archetypes.json` exists or the helper intentionally points to the archived manifest with a clear reason. `archetypes --query` works from a clean checkout. |
| `SKB-RDY-A04` | P0 | Done | Define current process audit tracker. | `spec/sketch-to-bim-process-audit-tracker.md` exists and identifies this tracker as the current source of readiness work, not the old archived audit. |
| `SKB-RDY-A05` | P0 | Done | Make `doctor` actionable. | `doctor` reports separate `filesOk`, `apiOk`, `webOk`, and `liveOk` so a stopped dev server is not confused with stale docs. `--require-live` still fails if app/API are not running. |
| `SKB-RDY-A06` | P1 | Not started | Add CI check for stale skill paths. | A test/grep fails if active skill docs point to archived capability/methodology paths for normal runs. |
| `SKB-RDY-A07` | P1 | Not started | Add command smoke tests for skill helper. | Tests cover `doctor`, `tools`, `archetypes`, `compile` path validation, `phase-accept` packet generation, and stale-check behavior. |

### B. Public CLI / MCP Surface

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-B01` | P0 | Done | Keep CLI as canonical external-agent path until MCP routes are executable. | Tracker and methodology state that CLI is allowed and preferred when API/MCP descriptor is contract-only. |
| `SKB-RDY-B02` | P0 | Partial | Make sketch tool status explicit in descriptor ledger. | Generated API ledger distinguishes executable, contract-only, CLI-only, and skill-local surfaces for every `sketch.*`, `qa.*`, and `export.*` tool. |
| `SKB-RDY-B03` | P0 | Partial | Server-host seed compiler or formalize CLI-only compiler. | Either `POST /api/v3/sketch/seed/compile` returns a bundle, or the descriptor clearly says MCP clients must call CLI/sidecar compiler and why. |
| `SKB-RDY-B04` | P0 | Partial | Phase apply must have one blessed transaction path. | Methodology names `/api/models/{model_id}/bundles` plus CLI `sketch phase apply` as the authoritative path; API wrapper is either implemented by delegation or documented as non-executable. |
| `SKB-RDY-B05` | P0 | Partial | Promote Advisor to stable agent tool. | `qa.advisor` / `qa.constructability` descriptors expose warning/info/error grouping, profile selection, element ids, and UI-equivalent filter context. |
| `SKB-RDY-B06` | P0 | Not started | Add evidence collection tool. | Stable CLI/API tool collects snapshot, validate, evidence package, Advisor warning/info, model stats, and manifest into one directory without relying on browser automation. |
| `SKB-RDY-B07` | P0 | Not started | Add visual evidence contract. | Product surface defines required screenshot/viewpoint inputs and outputs. Browser automation can implement capture, but the evidence schema is product-owned. |
| `SKB-RDY-B08` | P1 | Not started | Add MCP resources for model state. | Resources or equivalent routes expose snapshot, summary, levels, views, types, elements, Advisor, command log, and evidence package. |
| `SKB-RDY-B09` | P1 | Partial | Export backend command schemas. | `GET /api/v3/commands` or equivalent exposes all kernel command JSON Schemas, examples, side effects, and raw/semantic mapping. |
| `SKB-RDY-B10` | P1 | Partial | Query/resolve parity for sketch authoring. | Agent can discover levels, host walls, roof/slab hosts, types, rooms, loops, and nearest/line-matched elements without UI selection. |
| `SKB-RDY-B11` | P1 | Partial | Cmd+K-to-agent equivalence map. | Cmd+K entries that activate tools declare their completed CLI/MCP equivalent and execution kind. |
| `SKB-RDY-B12` | P1 | Not started | One command to run a phase loop. | `sketch phase run` or equivalent takes IR, phase plan, bundle/recipe, model id, and returns dry-run/commit/evidence/acceptance packet. |

### C. Sketch Understanding And BIM Information Requirements

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-C01` | P0 | Partial | Extend Sketch IR with BIM requirements. | IR includes `informationRequirements` with quality target, LOD/LOI intent, exchange goal, model uses, discipline scope, and required checks. |
| `SKB-RDY-C02` | P0 | Not started | Add room/space requirements. | IR and acceptance require room names/numbers, level, target area, function, occupancy/use, bounding status, doors/access, and schedule inclusion. |
| `SKB-RDY-C03` | P0 | Not started | Add element semantic requirements. | Exterior walls, interior walls, slabs, roofs, stairs, doors, windows, railings, rooms, and assets declare expected BIM categories and export entity intent. |
| `SKB-RDY-C04` | P0 | Not started | Add material/layer-set requirements. | Wall/slab/roof types carry layer intent, thicknesses, thermal/fire/acoustic placeholders where quality target requires them. |
| `SKB-RDY-C05` | P0 | Not started | Add classification requirements. | Rooms have DIN 277-like area/use classification; building elements have DIN 276/cost group placeholders where applicable; IFC classification references are planned. |
| `SKB-RDY-C06` | P1 | Not started | Add structure-lite requirements. | Load-bearing flags, primary support assumptions, columns/beams where visible/needed, stair/slab opening coordination, and load-path notes are captured. |
| `SKB-RDY-C07` | P1 | Not started | Add MEP-lite requirements. | Wet-room stacking, vertical shafts/risers, equipment zones, pipe/duct/cable route placeholders, service levels, and opening requests are captured. |
| `SKB-RDY-C08` | P1 | Not started | Add planning/site requirements. | Site orientation, base point/survey point assumptions, property line/setback availability, sun assumptions, and code locale are explicit. |
| `SKB-RDY-C09` | P1 | Not started | Add export requirements. | Required exchange outputs are explicit: IFC, glTF/GLB, PDF/sheets, schedules, evidence package, and source bundle. |
| `SKB-RDY-C10` | P2 | Not started | Add sustainability/material passport starter data. | Materials can carry EPD/source confidence, embodied carbon placeholder, reuse/recyclability notes, and quantity source. |

### D. Seed DSL And Authoring Macros

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-D01` | P0 | Partial | Document seed DSL coverage against target-house needs. | Matrix maps target-house features to DSL primitives, typed CLI tools, raw commands, or gaps. |
| `SKB-RDY-D02` | P0 | Partial | Roof terrace macro. | Agent can create roof opening, occupied terrace floor, return faces, guard, access door, and evidence views without manual raw bundle surgery. |
| `SKB-RDY-D03` | P0 | Partial | Folded wrapper shell macro. | Agent can create thick upper shell using walls/roof/fascia/returns/materials with no final mass placeholders. |
| `SKB-RDY-D04` | P0 | Partial | Recessed loggia macro. | Agent can create recessed facade plane, side returns, balcony slab, rail, bay rhythm, and access openings. |
| `SKB-RDY-D05` | P0 | Partial | Room programme macro. | Agent can author rooms from programme/floorplan with real boundaries, doors, stairs, and slab openings. |
| `SKB-RDY-D06` | P0 | Partial | Viewpoint/evidence macro. | Agent can save required 3D, plan, section, diagnostic, and roof views deterministically. |
| `SKB-RDY-D07` | P1 | Not started | Facade rhythm/opening macro. | Agent can place bay-based windows/doors/mullion proxies on host walls while preserving host cuts and schedules. |
| `SKB-RDY-D08` | P1 | Not started | Wall/floor/roof type builder. | Agent can define type names, thickness, material layers, exterior/interior role, U-value/fire placeholders, and assignment. |
| `SKB-RDY-D09` | P1 | Not started | BIM asset placement macro. | Agent can place furniture/equipment markers with type ids, room association, schedule category, and evidence role. |
| `SKB-RDY-D10` | P1 | Not started | Sheet/schedule/documentation macro. | Agent can generate minimal floor plans, elevations/sections, room schedule, door/window schedule, and sheet layout for project initiation. |

### E. Validation, Advisor, Evidence, And Acceptance

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-E01` | P0 | Partial | Current-head evidence requirement. | Final acceptance fails if packet was generated against stale git head, stale model revision, or stale Advisor rule digest. |
| `SKB-RDY-E02` | P0 | Partial | Phase acceptance schema. | Phase packet includes phase id, feature ids, IR coverage, capability coverage, Advisor summary, visual checklist, blockers, tolerances, and evidence paths. |
| `SKB-RDY-E03` | P0 | Partial | Visual gates for sketch-critical features. | Required views prove roof terrace, loggia, wrapper, cladding, interior plan, and diagnostics. Missing/nonblank-only screenshots are not enough for final acceptance. |
| `SKB-RDY-E04` | P0 | Partial | Advisor/constructability profile parity. | CLI/API evidence matches the UI Advisor/right-rail profile used for project initiation and construction readiness. |
| `SKB-RDY-E05` | P0 | Not started | BIM data quality gate. | Acceptance checks rooms, levels, element categories, material/type completeness, classification placeholders, schedules, and export readiness. |
| `SKB-RDY-E06` | P1 | Not started | IFC/IDS-style validation gate. | Exported IFC or normalized BIM exchange manifest is validated for project hierarchy, entity classes, spaces, material layers, Psets, quantities, and classifications. |
| `SKB-RDY-E07` | P1 | Not started | Semantic visual evaluator. | Beyond pixel deltas, checklist or CV-assisted evaluator detects critical features such as roof cutout present, wrapper shell thickness, loggia recess, and cladding rhythm. |
| `SKB-RDY-E08` | P1 | Partial | Tolerance protocol. | Every unresolved warning/gap has severity, affected feature, reason, owner, expiry condition, and evidence link. |
| `SKB-RDY-E10` | P0 | Not started | Advisor-driven refinement loop. | Phase tooling records warning/info/error findings after dry-run and after commit; current-phase findings must be fixed, deferred with phase rationale, tolerated with evidence, or marked blocked before phase acceptance. |
| `SKB-RDY-E09` | P2 | Not started | Benchmark goldens for sketch cases. | Golden cases include live screenshot/advisor/evidence baselines for archetypes, not just deterministic packet checks. |

### F. Target-House-1 Specific Readiness

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-F01` | P0 | Not started | Target-house Sketch IR. | IR is generated from `spec/target-house` images and seed spec, with non-negotiables, dimensions, views, assumptions, and feature ids. |
| `SKB-RDY-F02` | P0 | Not started | Target-house BIM information requirements. | Includes rooms from floorplan, spaces, schedules, wall/roof/slab type intent, structural/MEP-lite assumptions, and export goals. |
| `SKB-RDY-F03` | P0 | Not started | Target-house capability map. | Every critical visual/BIM feature maps to command/API/CLI/DSL support, status, evidence, and fallback. |
| `SKB-RDY-F04` | P0 | Not started | Target-house phase plan. | Phases are envelope-first: massing/shell, roof terrace, loggia/openings, rooms/stair, BIM data, documentation/export, final acceptance. |
| `SKB-RDY-F05` | P0 | Not started | Target-house risk register. | High-risk items include roof cutout render, folded shell thickness, roof-wall seams, cladding artifacts, stair/slab opening, room enclosure, and export semantics. |
| `SKB-RDY-F06` | P0 | Not started | Target-house no-seed rehearsal packet. | Produces planning/evidence requirements only; no `seed-artifacts/target-house-1` is created before the user approves the generation run. |

### G. Documentation And Developer Experience

| ID | Priority | Status | Item | Acceptance |
| --- | --- | --- | --- | --- |
| `SKB-RDY-G01` | P0 | Done | Clarify source-of-truth docs. | Active docs explain which files are current and which archive files are historical. |
| `SKB-RDY-G02` | P0 | Done | Clarify CLI vs MCP decision. | Docs state when to use CLI, API/MCP descriptor, raw bundle, or skill helper. |
| `SKB-RDY-G03` | P1 | Not started | Add one-page external-agent quickstart. | A new agent can run doctor, produce IR, validate capability matrix, compile/apply phase, collect evidence, and accept/reject without reading all source. |
| `SKB-RDY-G04` | P1 | Not started | Add target-house readiness checklist. | Checklist can be filled before generation and attached to seed evidence after generation. |
| `SKB-RDY-G05` | P1 | Not started | Add examples for real BIM data. | Example IR/recipe includes spaces, classifications, material layers, MEP-lite, structure-lite, schedules, and export requirements. |

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
