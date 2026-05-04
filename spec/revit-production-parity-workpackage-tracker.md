# Revit Production Parity Workpackage Tracker

**Source PRD:** [spec/prd/revit-production-parity-ai-agent-prd.md](prd/revit-production-parity-ai-agent-prd.md)  
**Purpose:** operational tracker for quarter-long implementation work. The PRD remains the product requirements source of truth; this file tracks workpackages, implementation state, evidence, and next actions.

## Status Legend

| Status     | Meaning                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| `done`     | Meets the relevant PRD acceptance for the current agreed scope and has verification evidence. |
| `partial`  | Real implementation exists, but it does not yet meet full PRD acceptance.                     |
| `stub`     | API/schema/UI placeholder exists, but behavior is intentionally incomplete.                   |
| `pending`  | Not implemented yet.                                                                          |
| `deferred` | Explicitly out of current wave or blocked by a later decision.                                |

## Done Rule

A workpackage should only move to `done` when the relevant subsystem satisfies the PRD §15 definition of done:

- command/schema exists where relevant;
- engine/API applies or derives it;
- snapshot/export serializes it;
- web hydrates, renders, or inspects it;
- summary/schedule/validation knows it where relevant;
- CLI or test fixture can exercise it;
- golden/e2e/unit evidence proves replay or behavior.

Stubs count as progress, not completion.

## Current Workpackages

| ID     | Workpackage                            | PRD refs                    | State    | Implemented / evidence                                                                                                                                       | Remaining work                                                                                                                                 |
| ------ | -------------------------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-000 | Locked implementation decisions        | §17                         | done     | `spec/revit-parity-decisions.md` records code defaults, residential-first scope, titleblock defaults, assumptions-first AI policy.                           | Revisit quarterly or when IFC/RVT scope changes.                                                                                               |
| WP-001 | Workpackage tracker                    | §14-§15                     | done     | This document records state and next actions separately from the PRD.                                                                                        | Keep updated whenever PRD scope changes or work lands.                                                                                         |
| WP-A01 | Golden reference command bundle        | §14 Phase A, §18            | partial  | `packages/cli/lib/one-family-home-commands.mjs` includes a reference house bundle with levels, walls/openings, floors/roof/stair/sheet/schedules/plan views. | Expand until it fully satisfies EG/OG/roof/stair/garage/rooms/openings/sheets/schedules with no blocking validation gaps.                      |
| WP-A02 | Evidence package API                   | §8, §14 Phase A, §18        | partial  | `GET …/evidence-package` emits `evidencePackage_v1` manifest with `exportLinks`, `planViews`, `expectedScreenshotCaptures`; sheet preview URLs include SVG/PDF. | Persist signed artifact URLs optional; correlate manifest hash with CI artifact name.                                                                     |
| WP-A03 | Playwright evidence baselines          | §14 Phase A, §15            | partial  | `e2e/evidence-baselines.spec.ts` captures coordination + schedules_focus PNGs plus EG openings vs OG room plan deltas from named `plan_view` clicks.               | Maintain tolerances across GPU/OS; widen where WebGL-heavy.                                                                                                |
| WP-A04 | CI verification gates                  | §15                         | partial  | `.github/workflows/ci.yml` uploads `playwright-report/`, `test-results/`, and committed `__screenshots__` tree alongside runs.                                               | Optionally curl `evidence-package` JSON from a deployed staging URL post-deploy.                                                                             |
| WP-B01 | Level/datum model                      | §6.1, §14 Phase B           | partial  | Existing `level` elements, level list UI, editable elevations, move-level command behavior.                                                                  | Model richer datums (FFB/RFB/UKRD), dependent offsets, and validation for datum chains.                                                        |
| WP-B02 | Walls, doors, windows, hosted openings | §5.2, §6.2                  | partial  | Existing wall/door/window commands, plan symbols, simple 3D meshes, host validation.                                                                         | Implement real void cuts/rough openings, joins, reveals, wall layers, and hosted cut regeneration.                                             |
| WP-B03 | Floors/slabs and slab openings         | §5.5, §6, §14 Phase B       | partial  | Floor and slab opening schema/commands/tests exist; 3D slab mass mesh exists.                                                                                | Add join behavior, floor edge conditions, material layers, opening clipping, plan/section hatches.                                             |
| WP-B04 | Roofs                                  | §5.1, §6, §14 Phase B       | partial  | Roof schema/command and simple 3D mass exist.                                                                                                                | Add real roof planes/ridges/hips/gables/overhangs/fascia/materials and validation.                                                             |
| WP-B05 | Stairs                                 | §5.2, §5.5, §6, §14 Phase B | partial  | Stair schema/command/tests and simple 3D volume exist; stair comfort advisor exists.                                                                         | Add landings, real tread/riser geometry, plan symbol parity, headroom/opening validation, richer cutaway mesh.                                 |
| WP-B06 | Rooms and room separation              | §5.3, §6, §14 Phase B       | partial  | Explicit room polygons, area/perimeter derivation, room schedule rows.                                                                                       | Derive rooms from walls/separations, volume/upper-limit UI, room classification, unbounded/overlap validation.                                 |
| WP-C01 | First-class plan views                 | §5.2, §14 Phase C           | partial  | `plan_view` carries template ref, semantics for hidden categories (`categoriesHidden`), view ranges/crop/phase fields (wire + hydration).                   | Persist duplicate-view/editing workflows; server-side projection parity tests beyond UI.                                                                     |
| WP-C02 | Plan projection engine                 | §5.2, §14 Phase C           | partial  | `resolvePlanViewDisplay` + `symbology.rebuildPlanMeshes` hide categories consistently; EG vs OG regressions exercised in Playwright.                       | Extend primitives for cut/overrides, tagging, richer templates.                                                                                           |
| WP-C03 | Plan symbology and graphics            | §5.2, §5.3                  | partial  | `symbology.ts` has presentation presets including room scheme/opening focus.                                                                                 | Complete line weights/patterns, category graphics, cut hatches, door/window tags, room tags, stair break symbols.                              |
| WP-C04 | Room color schemes and legends         | §5.3                        | partial  | Room scheme rendering exists at a basic level.                                                                                                               | Add first-class color scheme records, generated legends, room department/function metadata, legend placement.                                  |
| WP-C05 | Project browser hierarchy              | §4, §5.1-§5.6               | partial  | `ProjectBrowser.tsx` groups plan views, schedules, and sheets.                                                                                               | Expand to full hierarchy: floor plans, 3D views, sections, sheets, schedules, families, groups, links.                                         |
| WP-D01 | Server-derived schedules               | §5.4, §9, §14 Phase D       | partial  | `schedule_derivation.py` derives room/door/window rows with grouping hints; API exposes JSON table.                                                          | Generalize schedule engine fields/filters/sort/totals across categories and type/instance parameters.                                          |
| WP-D02 | Schedule CSV/API/CLI export            | §5.4, §9, §12               | partial  | `?format=csv`, `schedule_csv.py`, and CLI `schedule-table --csv` exist.                                                                                      | Add stable export tests for all schedule categories and richer field formatting.                                                               |
| WP-D03 | Schedule UI                            | §5.4, §13                   | partial  | `SchedulePanel` hydrates `/schedules/{id}/table`; shows grouping + totals badges when server emits `groupedSections`/`totals`.                              | Editing schedule definitions in UI + column picker; streamed pagination for huge tables.                                                                     |
| WP-D04 | Family/type registry and propagation   | §5.4, §10, §14 Phase D      | partial  | Family/type ids exist on openings; some schema support exists.                                                                                               | Implement full type registry, instance/type propagation, type edit fan-out tests, materials and parameters.                                    |
| WP-D05 | Materials/layer catalogs               | §5.1, §5.5, §10             | pending  | Some type/layer concepts exist, but no production material catalog.                                                                                          | Add wall/floor/roof material assemblies, cut patterns, visual styles, and schedule fields.                                                     |
| WP-D06 | Cleanroom metadata and IDS             | §5.4, §10-§12               | partial  | Cleanroom door metadata and IDS-style validation fixture exist.                                                                                              | Build full cleanroom fixture matrix, pressure/class/finish/interlock validation, IDS export/import alignment.                                  |
| WP-E01 | 3D category visibility                 | §13                         | done     | Store + Workspace controls + Viewport filtering hide semantic categories in 3D.                                                                              | Extend to per-view visibility templates and saved viewpoints.                                                                                  |
| WP-E02 | 3D clipping / cutaways                 | §5.5, §14 Phase E           | partial  | Viewport has a horizontal clipping plane control.                                                                                                            | Add section boxes, multiple clipping planes, cut solid caps, cut material rendering, saved section states.                                     |
| WP-E03 | 3D geometry fidelity                   | §5.1, §5.5                  | partial  | Walls/floors/roof/stair/opening meshes render as simple masses/markers.                                                                                      | Add real cuttable solids, hosted voids, roof geometry, stair detail, materials, site/topography/trees.                                         |
| WP-E04 | Section/elevation views                | §5.6, §14 Phase E           | stub     | `section_cut` elements and placeholder pane exist.                                                                                                           | Generate real orthographic 2D section/elevation projections with levels, tags, dimensions, and crop.                                           |
| WP-E05 | Sheet canvas and titleblock            | §5.6, §14 Phase E           | partial  | `SheetCanvas` resolves `plan:`/`schedule:`/`section:` `viewRef` strings to semantic labels for placed viewports while keeping titleblock scaffold.               | Formal paper presets + editable titleblock parameter grid; drag/drop viewports client-side with command replay.                                                     |
| WP-E06 | SVG/PNG/PDF export                     | §5.6, §14 Phase E           | partial  | `sheet_preview_svg.sheet_elem_to_svg` resolves `viewRef`; PDF endpoint uses reportlab textual manifest; deterministic SVG regression test for named plan refs.           | Raster SVG→PNG in backend; richer vector fidelity + print scaling metadata.                                                                              |
| WP-F01 | Agent generation protocol              | §8, §14 Phase F, §18        | partial  | `spec/house-generation-protocol.md` documents interpret -> assumptions -> bundle -> validate -> render -> compare.                                           | Add machine-readable assumption logs, issue loops, and example completed runs.                                                                 |
| WP-F02 | Agent review UI                        | §8                          | partial  | `AgentReviewPane` adds guided assumptions JSON, POST bundle dry-run, validate + evidence-package chain, CLI checklist.                                               | Persist comparison against Playwright screenshots in-app + multi-bundle diffing.                                                                               |
| WP-F03 | Automated evidence comparison          | §8, §14 Phase F             | partial  | Expanded screenshot baselines + CI artifact upload expose pixel diffs in Playwright HTML report.                                                                     | Teach agents to ingest diff tolerances programmatically beyond HTML viewer.                                                                              |
| WP-X01 | JSON snapshot and command replay       | §12                         | partial  | Canonical command path, snapshot API, dry-run/apply/bundle, undo/redo exist.                                                                                 | Add golden roundtrip fixtures for every implemented element kind and phase.                                                                    |
| WP-X02 | glTF export                            | §12                         | stub     | `export_gltf.py` and `/exports/gltf-manifest` declare visual export manifest and unsupported categories.                                                     | Implement actual glTF geometry bundle for supported visual categories.                                                                         |
| WP-X03 | IFC export/import                      | §12                         | stub     | `ifc_stub.py`, IFC manifest, and empty IFC skeleton endpoint exist.                                                                                          | Implement IFC4 subset: levels, walls, slabs, roofs, openings, spaces, materials, quantities; later import.                                     |
| WP-X04 | BCF export/import                      | §12                         | partial  | BCF topic element, export JSON endpoint, and import JSON endpoint exist.                                                                                     | Link topics to viewpoints/elements robustly; support BCF package shape and roundtrip tests.                                                    |
| WP-X05 | IDS validation                         | §12                         | partial  | IDS-style cleanroom door validation test exists.                                                                                                             | Implement IDS fixture matrix, mappings to deliverable rules, and advisor integration.                                                          |
| WP-X06 | RVT bridge                             | §12, §16                    | deferred | PRD explicitly excludes native RVT import/export in first wave.                                                                                              | Revisit after OpenBIM semantics stabilize.                                                                                                     |
| WP-V01 | Validation/advisor expansion           | §11                         | partial  | `sheet_viewport_unknown_ref` warns when sheet viewports reference missing plan/schedule/section semantics; degenerate rooms + staircase checks remain active.           | Dedicated schedule/sheet IFC exchange warnings once exporters mature.                                                                                          |
| WP-P01 | Browser performance budget             | §13                         | partial  | Schedule virtualization exists; a 120-wall batch smoke test exists.                                                                                          | Add 10k semantic element benchmarks, plan pan/zoom perf checks, worker/incremental derivation.                                                 |
| WP-P02 | Collaboration model                    | §13                         | partial  | Presence, comments, activities, server command ordering, undo/redo exist.                                                                                    | Define multiplayer semantics, conflict handling, scoped undo UX, and persistence tests.                                                        |

## High-Level State Summary

| Area                               | State        |
| ---------------------------------- | ------------ |
| Evidence baseline                  | partial      |
| Residential semantic kernel        | partial      |
| Production plan views              | partial      |
| Families/types/materials/schedules | partial      |
| Sections/3D/sheets/export          | partial      |
| AI-agent production loop           | partial      |
| OpenBIM exchange                   | stub/partial |
| Validation/advisor                 | partial      |
| Performance/collaboration          | partial      |

## Immediate Backlog Seeds

These are the next todo candidates that should be split into focused implementation tickets:

1. Promote `plan_view` from basic element to full view definition: range, crop, category visibility, phase, template inheritance.
2. Implement real plan projection primitives server-side or shared-core-side instead of ad hoc canvas drawing.
3. Replace `SchedulePanel` rollups with server-derived schedule tables and grouping/totals UI.
4. Add CI evidence artifact upload for `evidence-package` JSON and Playwright PNG outputs.
5. Implement actual sheet export path: SVG -> PNG/PDF, deterministic full-sheet baselines.
6. Implement IFC4 exporter first slice for levels, walls, floors/slabs, roofs, openings, rooms.
7. Implement glTF geometry export for the same visual subset.
8. Expand validation into PRD §11 classes with blocking vs advisory severity and quick-fix command bundles.
9. Add room derivation from walls/separation lines and unbounded/overlap room validation.
10. Add true wall/opening void regeneration and section/cut-solid rendering.

## Update Protocol

When work lands:

1. Update the relevant row state and evidence path.
2. Add or adjust remaining work.
3. If a new PRD requirement appears, add a new `WP-*` row before creating todos.
4. Do not mark a row `done` unless it passes the Done Rule above.
