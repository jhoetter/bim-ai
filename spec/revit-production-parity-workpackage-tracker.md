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

## Maturity And Progress Legend

`State` stays intentionally strict: a workpackage can show strong progress and still remain `partial` until it meets the Done Rule below. `Maturity` and `Progress %` are planning signals, not acceptance labels.

| Maturity          | Meaning                                                                     | Approx. progress band |
| ----------------- | --------------------------------------------------------------------------- | --------------------- |
| 0 stub            | Placeholder or design note only; no dependable behavior.                    | 0-10%                 |
| 1 schema/API      | Data shape, command, endpoint, or isolated helper exists.                   | 10-30%                |
| 2 usable slice    | One product path works, but evidence or cross-surface parity is incomplete. | 30-55%                |
| 3 evidenced slice | Behavior is covered by focused unit/e2e/golden/export evidence.             | 55-80%                |
| 4 parity-ready    | Current PRD acceptance is met for the agreed scope; eligible for `done`.    | 90-100%               |

Percentages are conservative estimates rounded to 5% increments. They reflect how much of the PRD acceptance surface is covered today: schema/command, engine/API, snapshot/export, web UX, schedules/validation, CLI/fixture replay, and golden/e2e/unit evidence.

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

## Parity Dashboard

This dashboard is a rough directional read, not a release claim. The target is still Revit production parity; the percentages make partial progress visible without weakening the Done Rule.

| Area                               | State   | Maturity center            | Approx. parity | Current read                                                                                                                                 |
| ---------------------------------- | ------- | -------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence baseline                  | partial | 3 evidenced slice          | ~60%           | Deterministic package rows, Playwright baselines, sheet/3D hints; signed/staged artifact flow remains.                                       |
| Residential semantic kernel        | partial | 2 usable slice             | ~40%           | Levels/walls/openings/floors/roofs/stairs/rooms exist, but geometry/joins/material layers are still simplified.                              |
| Production plan views              | partial | 2-3 usable/evidenced slice | ~50%           | Plan views, projection wire, browser activation, duplication, legends; richer templates/tags/overrides remain.                               |
| Families/types/materials/schedules | partial | 2 usable slice             | ~45%           | Field registry, CSV/API/CLI, column persistence, type/material display; full type propagation/material catalogs remain.                      |
| Sections/3D/sheets/export          | partial | 3 evidenced slice          | ~55%           | Section wire, live sheet viewport, full-sheet evidence, cutaway presets, glTF/IFC slices; drag/drop, dimensions, richer print/export remain. |
| AI-agent production loop           | partial | 2 usable slice             | ~40%           | Agent Review can fetch/compare evidence metadata and digest hints; automated issue/diff loop remains.                                        |
| OpenBIM exchange                   | partial | 2-3 usable/evidenced slice | ~40%           | glTF and IFC export/read-back slices exist; real import/replay, composites, and IDS exchange matrix remain.                                  |
| Validation/advisor                 | partial | 2 usable slice             | ~40%           | IDS/room/opening warnings exist with tests; broader blocking classes and quick-fixes remain.                                                 |
| Performance/collaboration          | partial | 2 usable slice             | ~35%           | Server budgets, virtualization, presence/comments/undo exist; larger-scale and conflict semantics remain.                                    |

## Recent Sprint Ledger

| Source                   | Scope                                                                                                                                                                                                           | Tracker effect                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0cf2db3`                | Evidence package, plan projection selection, schedule UI, sheet previews, first Playwright baselines.                                                                                                           | Lifted `WP-A02/A03`, `WP-C01`, `WP-D03`, `WP-E05/E06` out of stub territory.                                                                                 |
| `06ecc89`                | Opening primitives, glTF/IFC export, IFC property sets, schedule registry, room derivation preview, golden fixture.                                                                                             | Added major evidence to `WP-B02`, `WP-D01/D02/D04`, `WP-X02/X03`, `WP-X05`, `WP-X01`.                                                                        |
| `6dfdbf6`                | Cut kernel, server projection wire, performance tests, evidence digest, IDS expansion, room review, schedule/product evidence.                                                                                  | Advanced `WP-C02`, `WP-E03`, `WP-P01`, `WP-F02/F03`, `WP-V01`, and OpenBIM validation slices.                                                                |
| `abeb4a2`                | Section primitives, PlanCanvas wire rendering, full-sheet evidence, schedule matrix, cutaway state, tracker refresh.                                                                                            | Raised `WP-E04/E05/E06`, `WP-C02/C03`, `WP-D01/D02/D03`, `WP-E02`, `WP-X03` toward evidenced slices.                                                         |
| Current uncommitted wave | Golden bundle roundtrip, saved plan view duplication, live section viewports on sheets, room legend metadata, persisted schedule columns, saved 3D cutaways, IFC Pset read-back, Agent Review 3D evidence rows. | Makes progress visible in `WP-A01/X01`, `WP-C01/C04/C05`, `WP-D03`, `WP-E02/E04`, `WP-F02`, `WP-X03`; rows stay `partial` until full acceptance gates close. |
| Verification 2026-05-04  | `cd app && ruff check && pytest` (green); `cd packages/web && tsc --noEmit && vitest run src`.                                                                                                                  | Closeout checklist for parity wave smoke before deepening authoring/replay work.                                                                             |

## Current Workpackages

| ID     | Workpackage                            | State    | Maturity          | Progress | Recent sprint delta                                                             | Implemented / evidence                                                                                                            | Remaining parity blockers                                                              |
| ------ | -------------------------------------- | -------- | ----------------- | -------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| WP-000 | Locked implementation decisions        | done     | 4 parity-ready    | 100%     | Stable.                                                                         | `spec/revit-parity-decisions.md` records defaults, scope, and assumptions-first policy.                                           | Revisit quarterly or when IFC/RVT scope changes.                                       |
| WP-001 | Workpackage tracker                    | done     | 4 parity-ready    | 100%     | Added granular maturity/progress model.                                         | Operational tracker exists separately from the PRD.                                                                               | Keep updated whenever scope changes or work lands.                                     |
| WP-A01 | Golden reference command bundle        | partial  | 3 evidenced slice | 70%      | Current wave adds bundle roundtrip coverage across docs spine fields.           | Golden snapshot includes `section_cut`, room `programmeCode`, docs spine elements; pytest asserts section wire + schedule matrix. | Full lifecycle/roundtrip for every authoring command; remove fixture-only blind spots. |
| WP-A02 | Evidence package API                   | partial  | 3 evidenced slice | 65%      | 3D evidence rows and digest correlation added in current wave.                  | `evidencePackage_v1`, deterministic sheet evidence, digest hints, plan/section links, Agent Review parsing.                       | Signed/staged artifact URLs; artifact freshness across CI/deploy boundaries.           |
| WP-A03 | Playwright evidence baselines          | partial  | 3 evidenced slice | 60%      | Full-sheet and section/schedule evidence baselines expanded.                    | Coordination/schedules/plan variants and deterministic sheet captures exist.                                                      | GPU/OS tolerance hardening; broader artifact matrix.                                   |
| WP-A04 | CI verification gates                  | partial  | 2 usable slice    | 45%      | Evidence hints improved; CI loop still shallow.                                 | Playwright artifact naming and optional probe script exist.                                                                       | Staged deploy correlation and enforceable artifact checks.                             |
| WP-B01 | Level/datum model                      | partial  | 2 usable slice    | 40%      | No major latest change.                                                         | Levels, level UI, editable elevations, move-level command behavior.                                                               | Rich datums, dependent offsets, datum-chain validation.                                |
| WP-B02 | Walls, doors, windows, hosted openings | partial  | 3 evidenced slice | 60%      | Cut/projection/export slices grew over recent commits.                          | Hosted plan symbols, opening cut primitives, glTF/section reuse.                                                                  | Real voids/rough openings for non-orthogonal hosts, joins, reveals, layered walls.     |
| WP-B03 | Floors/slabs and slab openings         | partial  | 2 usable slice    | 45%      | Slab openings participate in export/projection evidence.                        | Floor/slab opening schema/commands/tests; 3D slab mass mesh.                                                                      | Joins, edge conditions, layers, opening clipping, hatches.                             |
| WP-B04 | Roofs                                  | partial  | 2 usable slice    | 30%      | Roof schedule/export proxies improved, geometry remains simple.                 | Roof schema/command and simple 3D mass.                                                                                           | Real roof planes/ridges/hips/gables/overhangs/fascia/materials/validation.             |
| WP-B05 | Stairs                                 | partial  | 2 usable slice    | 35%      | Stair schedules/section/export proxies improved.                                | Stair schema/command/tests, simple 3D volume, comfort advisor.                                                                    | Landings, true tread/riser geometry, plan symbols, headroom/opening validation.        |
| WP-B06 | Rooms and room separation              | partial  | 2 usable slice    | 55%      | Department/function/finish metadata and room legend path added in current wave. | Programme metadata, plan primitive metadata, derivation preview, overlap severity.                                                | Authoritative derivation, unbounded-room closure, richer programme UI/quick-fixes.     |
| WP-C01 | First-class plan views                 | partial  | 2 usable slice    | 55%      | Project Browser can activate/duplicate plan views and list saved viewpoints.    | Plan view template ref, hidden categories, crop/range/phase fields, hydration.                                                    | View-template editor, robust duplicate/edit tests, Revit-like view semantics.          |
| WP-C02 | Plan projection engine                 | partial  | 3 evidenced slice | 65%      | PlanCanvas consumes server wire primitives for core categories.                 | Server `plan_projection_wire` + primitives + web rebuild for walls/openings/rooms/grids/dimensions.                               | Overrides, tags, hatches, template inheritance fidelity.                               |
| WP-C03 | Plan symbology and graphics            | partial  | 2 usable slice    | 50%      | Server line weight/fill hints now flow into web symbology.                      | Plan constants, line hints, room fills, opening symbols documented/tested.                                                        | Cut hatches, tags, fine graphic override matrix.                                       |
| WP-C04 | Room color schemes and legends         | partial  | 2 usable slice    | 50%      | `roomColorLegend` and PlanCanvas legend added.                                  | Plan wire emits legend/colors and web renders room-scheme legend.                                                                 | First-class legend elements and departmental programme records.                        |
| WP-C05 | Project browser hierarchy              | partial  | 2 usable slice    | 45%      | Viewpoints and duplicate plan action added.                                     | Browser groups plan views, schedules, sheets, saved viewpoints.                                                                   | Full hierarchy, sections/families/groups/links, drag/drop placement.                   |
| WP-D01 | Server-derived schedules               | partial  | 3 evidenced slice | 65%      | Section/room/type fields and display-column filters expanded.                   | Field registry, schedule engine metadata, pytest matrix for floors/stairs/roofs.                                                  | Richer filters and row factories for every category.                                   |
| WP-D02 | Schedule CSV/API/CLI export            | partial  | 3 evidenced slice | 60%      | Broader category coverage and column subset path improved.                      | JSON/CSV endpoint, `schedule_csv.py`, CLI `schedule-table --csv`.                                                                 | Stable export tests for all categories and formatting parity.                          |
| WP-D03 | Schedule UI                            | partial  | 2 usable slice    | 55%      | Column picker now persists `displayColumnKeys`.                                 | Registry tabs, column picker, server-derived display config.                                                                      | Pagination and richer filter/sort/group editor UI.                                     |
| WP-D04 | Family/type registry and propagation   | partial  | 2 usable slice    | 45%      | Type/material schedule fields exist, not full propagation.                      | Family/type ids, registry merge, API, evidence, door/window type display.                                                         | Full type registry, edit fan-out, material/parameter propagation tests.                |
| WP-D05 | Materials/layer catalogs               | pending  | 0 stub            | 5%       | No substantial implementation yet.                                              | Some type/layer concepts only.                                                                                                    | Wall/floor/roof material assemblies, cut patterns, visual styles, schedule fields.     |
| WP-D06 | Cleanroom metadata and IDS             | partial  | 3 evidenced slice | 60%      | IFC/IDS read-back and metadata checks expanded.                                 | Cleanroom IDS flags and pytest matrix for linkage/class/interlock/finish/pressure.                                                | Full IDS fixture matrix and import/export alignment.                                   |
| WP-E01 | 3D category visibility                 | done     | 4 parity-ready    | 95%      | Stable; saved-view integration now builds on it.                                | Store, Workspace controls, Viewport filtering.                                                                                    | Per-view templates are tracked under saved viewpoints.                                 |
| WP-E02 | 3D clipping / cutaways                 | partial  | 2 usable slice    | 55%      | Saved viewpoint clip/category/camera replay added.                              | Dual clipping, `SaveViewpointCmd`, Project Browser apply, Viewport camera snap.                                                   | Visual styles/material parity and tested per-view templates.                           |
| WP-E03 | 3D geometry fidelity                   | partial  | 3 evidenced slice | 60%      | Cut kernel and export/projection reuse improved.                                | Opening primitives, glTF wall/floor segmentation, slab panes.                                                                     | True booleans, cuttable solids beyond proxies, materials/site fidelity.                |
| WP-E04 | Section/elevation views                | partial  | 3 evidenced slice | 65%      | Live sheet section viewport rendering added.                                    | Section projection endpoint/primitives and `SectionViewportSvg` in sheets.                                                        | Tags/dimensions in section, viewport placement/edit replay.                            |
| WP-E05 | Sheet canvas and titleblock            | partial  | 3 evidenced slice | 60%      | Paper/titleblock fields and live viewport composition improved.                 | Sheet paper/titleblock params, footer/grid, schedule/section viewports.                                                           | Drag/drop viewport placement and canonical replay commands.                            |
| WP-E06 | SVG/PNG/PDF export                     | partial  | 3 evidenced slice | 55%      | Full-sheet deterministic evidence expanded.                                     | Full-sheet PNG naming, `evidenceSheetFull`, SVG/PDF preview path.                                                                 | Optional raster service and print metadata parity.                                     |
| WP-F01 | Agent generation protocol              | partial  | 2 usable slice    | 40%      | No major latest protocol change.                                                | House generation protocol doc exists.                                                                                             | Machine-readable assumption logs, issue loops, example completed runs.                 |
| WP-F02 | Agent review UI                        | partial  | 2 usable slice    | 55%      | 3D evidence row ingestion and mismatch summaries added.                         | Evidence package rows, digest hints, sheet/3D artifact filenames.                                                                 | Pixel diff ingestion and actionable regeneration guidance.                             |
| WP-F03 | Automated evidence comparison          | partial  | 2 usable slice    | 45%      | More deterministic screenshot stems, but no machine diff loop.                  | Screenshot baselines and CI artifact upload expose pixel diffs in HTML report.                                                    | Programmatic diff tolerance ingestion for agents.                                      |
| WP-X01 | JSON snapshot and command replay       | partial  | 3 evidenced slice | 65%      | Golden command bundle roundtrip helper added.                                   | Golden snapshot tests cover schedule matrix, section wire, programme codes, exchange kinds.                                       | Full lifecycle and command replay for every authoring surface.                         |
| WP-X02 | glTF export                            | partial  | 3 evidenced slice | 60%      | Cutaway evidence and cut-kernel context improved.                               | GLB/glTF export, door/window gaps, slab opening panes, materials, pytest.                                                         | Draco, true booleans, richer coordination hashes.                                      |
| WP-X03 | IFC export/import                      | partial  | 3 evidenced slice | 55%      | Pset read-back test added for wall/space references.                            | IFC4 kernel, walls/storeys/spaces read-back, Psets, QTO tests.                                                                    | Narrow import/replay path, composites, richer space boundaries, booleans.              |
| WP-X04 | BCF export/import                      | partial  | 1 schema/API      | 25%      | No major latest change.                                                         | BCF topic element, export JSON endpoint, import JSON endpoint.                                                                    | Robust viewpoint/element links, package shape, roundtrip tests.                        |
| WP-X05 | IDS validation                         | partial  | 3 evidenced slice | 55%      | Cleanroom exchange/read matrix improved around metadata.                        | Cleanroom IDS pytest matrix for linkage/class/interlock/finish/pressure.                                                          | Full IDS fixture matrix and advisor mappings.                                          |
| WP-X06 | RVT bridge                             | deferred | 0 stub            | 0%       | Explicitly out of first wave.                                                   | PRD excludes native RVT import/export now.                                                                                        | Revisit after OpenBIM semantics stabilize.                                             |
| WP-V01 | Validation/advisor expansion           | partial  | 2 usable slice    | 45%      | Room programme hint and overlap severity improved.                              | Room overlap error, hosted cut warnings, discipline metadata.                                                                     | Broader PRD §11 blocking classes and schedule/sheet linkage.                           |
| WP-P01 | Browser performance budget             | partial  | 3 evidenced slice | 60%      | Server projection/schedule budgets added recently.                              | Virtualization and pytest budgets for large projection/schedule derivation.                                                       | 10k-scale fixtures, worker/incremental derivation, UI perf timings.                    |
| WP-P02 | Collaboration model                    | partial  | 2 usable slice    | 35%      | No major latest change.                                                         | Presence, comments, activities, command ordering, undo/redo.                                                                      | Multiplayer semantics, conflicts, scoped undo UX, persistence tests.                   |

## High-Level State Summary

The codebase is no longer mostly placeholder work: several areas now have evidenced vertical slices. It is still far from true Revit parity because many slices stop at deterministic projection/export/inspection rather than full authoring behavior, editing UX, and cross-format replay.

| Area                               | Rough current maturity | Main reason it remains partial                                                                           |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Evidence baseline                  | evidenced slice        | Artifacts are deterministic, but signed/staged lifecycle and programmatic diff ingestion are incomplete. |
| Residential semantic kernel        | usable slice           | Core elements exist, but physical fidelity, joins, materials, and validation remain simplified.          |
| Production plan views              | usable/evidenced slice | Views render and duplicate, but tags/templates/graphic overrides are not production-complete.            |
| Families/types/materials/schedules | usable slice           | Schedules and type display work, but material catalogs and type propagation are shallow.                 |
| Sections/3D/sheets/export          | evidenced slice        | Live sections/sheets/cutaways exist, but editing, dimensions, and print/export fidelity remain partial.  |
| AI-agent production loop           | usable slice           | Evidence metadata can be inspected, but closed-loop diff/issue regeneration is not automatic.            |
| OpenBIM exchange                   | usable/evidenced slice | glTF/IFC read/export slices exist; import/replay and composite semantics remain out of reach.            |
| Validation/advisor                 | usable slice           | Several warnings/errors exist, but PRD-wide blocking validation and quick-fixes are incomplete.          |
| Performance/collaboration          | usable slice           | Budgets and collaboration basics exist; scale and conflict semantics are not proven.                     |

## Immediate Backlog Seeds

These are the next todo candidates that should be split into focused implementation tickets. They intentionally target remaining parity blockers rather than re-listing slices that have already landed.

1. Turn saved views into editable definitions: view templates, per-view graphics, tags, crop/range editing, and persistence tests.
2. Close sheet viewport authoring: drag/drop or form-based placement, replayable viewport commands, section/schedule/titleblock regression tests.
3. Promote room programme data into a first-class workflow: authoritative derivation, unbounded-room checks, programme/department UI, schedule/legend parity.
4. Deepen schedule definitions: persisted sort/group/filter UI, stable JSON+CSV coverage for every current schedule category, type/material propagation tests.
5. Advance section graphics from projection boxes to production documentation: cut hatches, tags/dimensions, material hints, and viewport scale behavior.
6. Deepen geometry fidelity: non-orthogonal hosted openings, joins, layered wall/floor/roof assemblies, and true cut solids where bounded fixtures exist.
7. Extend OpenBIM exchange from read-back smoke to a narrow import/inspection matrix for levels, walls, spaces, Psets/QTOs, and IDS mismatch advisories.
8. Make Agent Review close the evidence loop: artifact manifest ingestion, stale/missing screenshot detection, pixel diff metadata, and regeneration guidance.
9. Build broader PRD §11 validation: blocking classes, quick-fix bundles, schedule/sheet linkage checks, and user-facing advisor severity.
10. Raise performance/collaboration confidence: larger fixtures, worker/incremental derivation, Playwright UI timings, conflict/scoped-undo semantics.

## Update Protocol

When work lands:

1. Update the relevant row state and evidence path.
2. Add or adjust remaining work.
3. If a new PRD requirement appears, add a new `WP-*` row before creating todos.
4. Do not mark a row `done` unless it passes the Done Rule above.
