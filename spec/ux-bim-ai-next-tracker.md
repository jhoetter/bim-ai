# BIM AI UX Next-Phase Tracker

Last updated: 2026-05-12

Related baseline:

- [`spec/ux-bim-ai-rework-master.md`](./ux-bim-ai-rework-master.md)
- [`spec/ux-bim-ai-rework-spec.md`](./ux-bim-ai-rework-spec.md)
- [`spec/ux-bim-ai-rework-tracker.md`](./ux-bim-ai-rework-tracker.md)
- [`spec/ux-bim-ai-rework-dynamic-audit.md`](./ux-bim-ai-rework-dynamic-audit.md)

Purpose: capture post-rework product and UX gaps observed in seeded usage, translate them into implementable workpackages, and define proof criteria before anything is marked done.

## Scope And Status Legend

Status values in this tracker:

- `Open`: not implemented yet.
- `In Progress`: partially implemented in code but acceptance not complete.
- `Done`: behavior is implemented, legacy path removed, command reachability preserved, tests/screenshots passed on seeded app.
- `Blocked`: missing product decision or technical dependency.

Priority:

- `P0`: correctness/usability blocker.
- `P1`: high-value workflow completion.
- `P2`: polish, consistency, or optimization after P0/P1.

## What This Tracker Is Solving

The foundational seven-region ownership model is in place, but real usage still shows major gaps in:

1. layout precision (shell geometry and panel ergonomics),
2. floor-plan editing correctness (wall draft/preview lifecycle and off-plan guardrails),
3. 3D editing reliability and rendering correctness,
4. per-role/per-discipline workflow relevance,
5. sheet/schedule semantics and information density,
6. discoverability/onboarding for core authoring actions.

## Gap Inventory (From Seeded Usage + Code Audit)

| ID           | Gap                                                                                                                | Evidence/Owner Hotspots                                                                      | Priority | Status |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT-GAP-001 | Primary sidebar does not read as true top-to-bottom spine in final composition.                                    | `workspace/shell/AppShell.tsx`, `workspace/Workspace.tsx`                                    | P0       | Done   |
| NEXT-GAP-002 | Secondary sidebar internals are dense; reusable collapsible group pattern is missing.                              | `workspace/WorkspaceRightRail.tsx`                                                           | P1       | Done   |
| NEXT-GAP-003 | No recursive drag-drop canvas split from tabs (horizontal/vertical panes).                                         | `workspace/shell/TabBar.tsx`, `workspace/tabsModel.ts`, `workspace/viewport/CanvasMount.tsx` | P1       | Open   |
| NEXT-GAP-004 | Wall tool can leave confusing mirrored/hatched draft/preview artifacts off-plan.                                   | `plan/PlanCanvas.tsx`                                                                        | P0       | Done   |
| NEXT-GAP-005 | Wall placement has weak off-plan/crop guardrails and unclear loop-mode state transitions.                          | `plan/PlanCanvas.tsx`, plan view crop data                                                   | P0       | Done   |
| NEXT-GAP-006 | 3D wall openings can render incorrectly (wall visible in window/opening).                                          | `Viewport.tsx` wall/opening CSG path                                                         | P0       | Done   |
| NEXT-GAP-007 | 3D edit affordances are inconsistent (insert window/opening workflows not robust in-context).                      | `workspace/shell/RibbonBar.tsx`, `workspace/WorkspaceRightRail.tsx`, commands/capabilities   | P0       | Done   |
| NEXT-GAP-008 | Missing explicit per-level visibility controls in 3D.                                                              | `workspace/viewport/Viewport3DLayersPanel.tsx`, level/view state                             | P1       | Done   |
| NEXT-GAP-009 | Room labels can be clipped/illegible.                                                                              | `plan/planElementMeshBuilders.ts`, plan symbology/text sizing                                | P1       | Done   |
| NEXT-GAP-010 | Ribbon information architecture still feels uneven by view (annotate parity, icon consistency, dead/weak actions). | `workspace/shell/RibbonBar.tsx`, command metadata                                            | P1       | Done   |
| NEXT-GAP-011 | Discipline/lens switching does not consistently change ribbon + secondary + element + canvas semantics.            | lens state, mode surfaces, command gating                                                    | P0       | Done   |
| NEXT-GAP-012 | Creation of new floor plans/3D/sections/sheets/schedules is not obvious enough.                                    | primary nav, project browser, commands                                                       | P1       | Done   |
| NEXT-GAP-013 | Sheets show heavy metadata block directly in main user reading flow.                                               | `workspace/sheets/SheetCanvas.tsx`                                                           | P1       | Done   |
| NEXT-GAP-014 | Moodboard vs documentation sheet intent is not modeled/taggable.                                                   | sheet model + UI filters + commands                                                          | P1       | Done   |
| NEXT-GAP-015 | Schedule outputs are not meaningful enough for practical role workflows.                                           | schedule mode shell/panels, advisor integration                                              | P1       | Done   |
| NEXT-GAP-016 | Sections are hard to understand in relation to 3D; section context could be spatially reinforced.                  | section mode shell, viewport overlays                                                        | P2       | Open   |
| NEXT-GAP-017 | Overflow hygiene: clipped dropdowns and horizontal scrolling inside sidebars.                                      | shell/sidebar CSS/layout constraints                                                         | P1       | Done   |
| NEXT-GAP-018 | 3D visual quality gaps: dark mode mismatch, materials/realistic/raytrace strategy unclear.                         | `Viewport.tsx`, render style pipeline                                                        | P1       | Open   |
| NEXT-GAP-019 | Onboarding tour targets exist but narrative is outdated for next-phase workflows.                                  | `onboarding/tour.ts`, `onboarding/OnboardingTour.tsx`                                        | P2       | Open   |
| NEXT-GAP-020 | Project settings path is under-discoverable after nav cleanup.                                                     | project settings element/editor/commands                                                     | P1       | Done   |

## Workpackages

### WP-NEXT-01 — Shell Geometry Precision

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT-GAP-001`, `NEXT-GAP-017` (layout part)
- Goal: make the seven-region shell match intended spatial hierarchy precisely (primary rail visually spans full workspace height; ribbon visually sits between left stack and right element stack without ambiguity).
- Source ownership:
  - `packages/web/src/workspace/shell/AppShell.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
  - shell/layout tests
- Acceptance:
  - primary sidebar visually and structurally acts as persistent vertical spine,
  - collapse-to-zero + restore from header still works,
  - no horizontal scrollbar in shell regions at desktop/tablet/narrow snapshots,
  - ownership tests updated for geometry and recovery states.

Evidence (2026-05-13):

- `AppShell` grid areas now place ribbon only in canvas lanes while primary/secondary span the full working stack (`packages/web/src/workspace/shell/AppShell.tsx`).
- Ownership geometry test added in `packages/web/src/workspace/shell/AppShell.test.tsx`.
- Seeded screenshots + metrics (desktop/tablet/narrow + collapse/restore): `packages/web/tmp/ux-next-wp01-wp04-20260513/01-shell-desktop.png` to `05-shell-narrow.png` with `summary.json` proving no horizontal overflow in shell regions.
- Full-height spine confirmation after follow-up correction: `packages/web/tmp/ux-next-wp01-wp04-20260513/10-shell-fullheight-desktop.png` to `12-shell-fullheight-narrow.png` with `fullheight-summary.json` (`primary.top == shell.top`, `primary.bottom == shell.bottom` on desktop/tablet).
- Full-height spine hardening after layout follow-up (header/footer no longer claim primary column grid cells): `packages/web/tmp/ux-next-wp01-wp04-20260513/13-shell-fullheight-desktop.png` to `15-shell-fullheight-narrow.png` with `fullheight-summary-v2.json` (`gridTemplateAreas` starts with `"."` in column 1 and `primaryGridRow: 1 / 5`).

### WP-NEXT-02 — Secondary Sidebar Design System

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-002`, `NEXT-GAP-017` (sidebar ergonomics)
- Goal: introduce reusable collapsible section-group component for secondary sidebar panels (headline + body + persisted collapsed state).
- Source ownership:
  - `packages/web/src/workspace/WorkspaceRightRail.tsx`
  - new reusable UI primitive under workspace shell/components
- Acceptance:
  - 3+ major panel groups migrated to common collapsible primitive,
  - group collapse state persisted per view type/tab where appropriate,
  - no clipping/overflow regression in narrow widths,
  - tests for keyboard and pointer accessibility.

Evidence (2026-05-13):

- Added reusable persisted disclosure primitive with localStorage persistence and explicit keyboard/pointer a11y behavior:
  - `packages/web/src/workspace/shell/components/PersistedDisclosureSection.tsx`
  - `packages/web/src/workspace/shell/components/PersistedDisclosureSection.test.tsx`
- Migrated three secondary sidebar groups to the common primitive with scoped persistence keys:
  - plan `Visibility` (`plan.visibility.<view-id>`)
  - 3D `Graphics, Camera, Clipping` (`3d.graphics.<viewpoint-id>`)
  - section `Crop Depth` (`section.crop-depth.<section-id>`)
  - source wiring in `packages/web/src/workspace/WorkspaceRightRail.tsx`
- Runtime seeded proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp02-20260513/01-plan-visibility-expanded.png`
  - `packages/web/tmp/ux-next-wp02-20260513/02-plan-visibility-collapsed.png`
  - `packages/web/tmp/ux-next-wp02-20260513/03-ground-plan-disclosure-default.png`
  - `packages/web/tmp/ux-next-wp02-20260513/04-3d-graphics-collapsed.png`
  - `packages/web/tmp/ux-next-wp02-20260513/05-narrow-1120.png`
  - `packages/web/tmp/ux-next-wp02-20260513/06-narrow-860.png`
  - `packages/web/tmp/ux-next-wp02-20260513/07-narrow-700.png`
  - `packages/web/tmp/ux-next-wp02-20260513/08-plan-collapse-persisted-after-3d-roundtrip.png`
  - `packages/web/tmp/ux-next-wp02-20260513/summary.json`
- Summary checks confirm:
  - plan disclosure toggles and persists across plan↔3D roundtrip (`before:false`, `after:false`),
  - plan and 3D disclosures persist independently,
  - sidebar narrow-width overflow hygiene (`scrollWidth === clientWidth` at 1120/860/700 widths).

### WP-NEXT-03 — Recursive Canvas Split Tabs

- Priority: `P1`
- Status: `Open`
- Covers: `NEXT-GAP-003`
- Goal: enable tab drag-and-drop into canvas to create recursive horizontal/vertical pane splits.
- Source ownership:
  - `packages/web/src/workspace/shell/TabBar.tsx`
  - `packages/web/src/workspace/tabsModel.ts`
  - `packages/web/src/workspace/viewport/CanvasMount.tsx`
  - state model for pane tree
- Acceptance:
  - drag tab to left/right/top/bottom drop zones creates split,
  - nested splits supported recursively,
  - tab move/close preserves pane invariants,
  - keyboard fallback exists for splitting without drag,
  - Playwright coverage for pane creation and restore from saved state.

### WP-NEXT-04 — Floor Plan Wall Draft Lifecycle Fix

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT-GAP-004`, `NEXT-GAP-005`
- Goal: eliminate stale/mirrored wall previews and make draft lifecycle deterministic.
- Source ownership:
  - `packages/web/src/plan/PlanCanvas.tsx`
  - related tool-state tests in plan/workspace suites
- Acceptance:
  - no stale preview line/polygon after commit in non-loop mode,
  - loop mode has explicit visual chip/banner and deterministic continuation,
  - `Esc` always clears draft + preview artifacts,
  - off-plan placement blocked/warned/clamped by explicit rule,
  - regression tests for commit, loop continuation, cancel, and off-plan guard.

Evidence (2026-05-13):

- Draft lifecycle helpers and tests added in `packages/web/src/plan/wallDraftLifecycle.ts` and `packages/web/src/plan/wallDraftLifecycle.test.ts`.
- `PlanCanvas` now clears preview after wall commit, clears preview artifacts on `Esc`, and blocks crop-outside wall commits with explicit warning (`wall-draft-notice`).
- Source-guard regressions extended in `packages/web/src/plan/PlanCanvas.toolDestubs.test.ts`.
- Seeded screenshots: `packages/web/tmp/ux-next-wp01-wp04-20260513/06-wall-non-loop-commit.png` to `09-wall-off-plan-block-warning.png`.
- Seeded runtime assertion summary (`summary.json`) confirms:
  - non-loop reset prompt,
  - loop chip visibility and deterministic endpoint continuation,
  - `Esc` loop/draft cleanup,
  - off-plan crop warning visibility.

### WP-NEXT-05 — 3D Openings Rendering Correctness

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT-GAP-006`
- Goal: ensure windows/openings carve hosts consistently; no wall faces visible inside valid apertures.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - CSG worker integration and wall rebuild invalidation paths
- Acceptance:
  - hosted windows/openings carve host walls across all supported wall variants,
  - no regression in performance-critical scenes (seed baseline budget),
  - seeded screenshots prove aperture correctness from multiple camera angles.

Evidence (2026-05-13):

- `Viewport` CSG eligibility no longer excludes typed walls (`wallTypeId`); typed walls now enter the worker carve path:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/wallCsgEligibility.ts`
  - `packages/web/src/viewport/wallCsgEligibility.test.ts`
- Seeded runtime captures for a typed wall selection (`hf-gf-wall-01`, `wallTypeId: hf-wt-clad-base`) are stored in:
  - `packages/web/tmp/ux-next-wp05-20260513/01-main-front-left.png`
  - `packages/web/tmp/ux-next-wp05-20260513/02-rear-right-axonometric.png`
  - `packages/web/tmp/ux-next-wp05-20260513/03-front-elevation.png`
  - `packages/web/tmp/ux-next-wp05-20260513/04-selected-typed-wall-openings.png`
  - `packages/web/tmp/ux-next-wp05-20260513/05-roof-court-high-axonometric.png`
  - `packages/web/tmp/ux-next-wp05-20260513/summary.json`
- Seeded rendering budget check recorded in `summary.json` under `renderingBudget.latestDebugLine`:
  - `model_elements 116/8000/16000 [model_elements_in_budget]`
  - `saved_3d_view_clip_fields 4/20/40 [saved_3d_clip_in_budget]`
  - `sheet_viewports 5/48/96 [sheet_viewports_in_budget]`
  - `large_model_proof: in_budget` (no deferred/over-budget warnings).

### WP-NEXT-06 — 3D Editing Parity And Reliability

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT-GAP-007`, `NEXT-GAP-010` (3D edit reachability subset)
- Goal: make key 3D edits directly usable and predictable (insert/edit door/window/opening, host targeting, transform, cancel/undo behavior).
- Source ownership:
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - `packages/web/src/workspace/WorkspaceRightRail.tsx`
  - `packages/web/src/workspace/commandCapabilities.ts`
  - `packages/web/src/workspace/defaultCommands.ts`
- Acceptance:
  - user can insert hosted openings directly in 3D with clear host preconditions,
  - dead or bridge-only controls either implemented or demoted to explicit bridge with label,
  - command capability metadata matches real in-canvas behavior,
  - Cmd+K route remains valid for all moved actions.

Evidence (2026-05-13):

- 3D contextual modify ribbon actions now execute direct semantic commands (not command-palette bridges) for selected walls:
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
- 3D insert capability metadata now reflects ribbon reachability + direct execution surface:
  - `packages/web/src/workspace/commandCapabilities.ts`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
- Ribbon regression coverage confirms direct callbacks fire for 3D wall inserts:
  - `packages/web/src/workspace/shell/TopBar.test.tsx`
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp06-20260513/01-ribbon-door-wall02.png`
  - `packages/web/tmp/ux-next-wp06-20260513/02-ribbon-window-wall03.png`
  - `packages/web/tmp/ux-next-wp06-20260513/03-ribbon-opening-wall04.png`
  - `packages/web/tmp/ux-next-wp06-20260513/04-cmdk-3d-insert-reachability.png`
  - `packages/web/tmp/ux-next-wp06-20260513/summary.json`
- Runtime summary confirms command POST `200` for all three direct actions (`insertDoorOnWall`, `insertWindowOnWall`, `createWallOpening`) and Cmd+K discoverability for each command id.

### WP-NEXT-07 — 3D Level Visibility Controls

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-008`
- Goal: support per-level visibility toggles in 3D (e.g., ground floor only).
- Source ownership:
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.tsx`
  - view state storage for 3D tab/view template
- Acceptance:
  - levels can be toggled independently in 3D,
  - state persists with saved views/templates,
  - toggles are role-aware (architect vs engineering lens defaults may differ).

Evidence (2026-05-13):

- 3D viewport runtime/state now tracks per-level visibility with dedicated store fields and toggles:
  - `packages/web/src/state/storeTypes.ts`
  - `packages/web/src/state/storeViewportRuntimeSlice.ts`
  - `packages/web/src/state/storeSliceContracts.ts`
  - `packages/web/src/state/storeSliceContracts.test.ts`
  - `packages/web/src/Viewport.tsx`
- `Viewport3DLayersPanel` now exposes a dedicated `Levels` section with per-level toggles and show-all/hide-all controls, and `WorkspaceRightRail` wires viewpoint-aware persistence plus lens defaults:
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.tsx`
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.test.tsx`
  - `packages/web/src/workspace/WorkspaceRightRail.tsx`
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp07-20260513/01-3d-levels-baseline.png`
  - `packages/web/tmp/ux-next-wp07-20260513/02-3d-level-hidden-toggle.png`
  - `packages/web/tmp/ux-next-wp07-20260513/03-3d-level-persisted-main-viewpoint.png`
  - `packages/web/tmp/ux-next-wp07-20260513/summary.json`
- Runtime summary confirms:
  - independent level toggle changed `hf-lvl-ground` from checked to unchecked,
  - round-trip viewpoint switch (`vp-main-iso` -> `vp-rear-axo` -> `vp-main-iso`) retained the level-hidden state,
  - store + localStorage persistence key `bim.viewer.levelHiddenByViewpoint.v1` captured the same hidden map.

### WP-NEXT-08 — Plan Label Legibility Pass

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-009`
- Goal: fix room label clipping and improve readable width handling.
- Source ownership:
  - `packages/web/src/plan/planElementMeshBuilders.ts`
  - plan label/symbology helpers
- Acceptance:
  - room labels display full text per selected annotation scale rules,
  - no single-character clipping in seeded floorplan states,
  - screenshot + unit snapshot coverage for long labels.

Evidence (2026-05-13):

- `planAnnotationLabelSprite` now uses dynamic multi-line label layout with width-aware canvas sizing and width-aware sprite scale, replacing the fixed-width label pill that clipped long room labels:
  - `packages/web/src/plan/planElementMeshBuilders.ts`
- Added deterministic unit coverage for room label line wrapping and overflow handling:
  - `packages/web/src/plan/planRoomLabelLayout.test.ts`
- Seeded runtime proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp08-20260513/01-plan-room-label-baseline.png`
  - `packages/web/tmp/ux-next-wp08-20260513/02-plan-room-label-long-name.png`
  - `packages/web/tmp/ux-next-wp08-20260513/03-plan-room-label-very-long-name.png`
  - `packages/web/tmp/ux-next-wp08-20260513/summary.json`
- Summary includes seeded store mutation evidence for long and very-long room names on `hf-room-hall` with the active plan view id (`hf-pv-upper`), validating runtime long-label layout behavior in the seeded app.

### WP-NEXT-09 — Ribbon IA And Per-View Coherence Pass

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-010`
- Goal: align ribbon sets by view type and remove remaining inconsistency (especially annotate parity and icon hierarchy).
- Source ownership:
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - command capability metadata
- Acceptance:
  - floorplan annotate includes expected authoring set (comparable intent to sheets where applicable),
  - per-view left icon/identity treatment standardized,
  - commands with no implementation are clearly marked bridge/unavailable, not silently inert.

Evidence (2026-05-13):

- Plan annotate parity expanded with direct section/elevation authoring actions in the Annotate tab:
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
- Per-view ribbon identity is now explicit and standardized via a mode identity chip (`Plan`, `3D`, `Sheet`, `Schedule`, etc.):
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
- Ribbon bridge semantics are now explicit for command-palette bridge actions via in-button `Cmd+K` labels (instead of visually ambiguous generic actions):
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
- Regression coverage updated for identity + annotate parity + bridge signaling:
  - `packages/web/src/workspace/shell/TopBar.test.tsx`
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp09-20260513/01-plan-ribbon-identity.png`
  - `packages/web/tmp/ux-next-wp09-20260513/02-plan-annotate-section-elevation.png`
  - `packages/web/tmp/ux-next-wp09-20260513/03-plan-review-bridge-cmdk.png`
  - `packages/web/tmp/ux-next-wp09-20260513/04-3d-ribbon-identity.png`
  - `packages/web/tmp/ux-next-wp09-20260513/05-sheet-ribbon-identity.png`
  - `packages/web/tmp/ux-next-wp09-20260513/06-schedule-ribbon-identity.png`
  - `packages/web/tmp/ux-next-wp09-20260513/07-cmdk-section-query.png`
  - `packages/web/tmp/ux-next-wp09-20260513/summary.json`

### WP-NEXT-10 — Discipline Lens Contract Enforcement

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT-GAP-011`
- Goal: discipline lens must drive what appears in ribbon, secondary sidebar, element sidebar, and canvas overlays.
- Source ownership:
  - mode/lens state controller
  - `Workspace.tsx`, `RibbonBar.tsx`, `WorkspaceRightRail.tsx`, rendering filters
- Acceptance:
  - switching Architecture/Structure/MEP changes visible toolsets and contextual panels,
  - lens-specific hidden/ghosted elements in canvas are deterministic and documented,
  - command capabilities reflect lens gating reasons.

Evidence (2026-05-13):

- Lens-aware command availability is now evaluated in command capability metadata (including explicit disabled reasons) and consumed by both ribbon and Cmd+K registry resolution:
  - `packages/web/src/workspace/commandCapabilities.ts`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
  - `packages/web/src/cmdPalette/registry.ts`
- Ribbon now receives `lensMode` and prunes toolsets by active lens, while Workspace passes lens context to both ribbon and command palette:
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
- Secondary and element sidebars now render explicit lens-scope notices to make contextual ownership visible when non-`all` lenses are active:
  - `packages/web/src/workspace/WorkspaceRightRail.tsx`
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp10-20260513/01-lens-architecture-plan-ribbon.png`
  - `packages/web/tmp/ux-next-wp10-20260513/02-lens-structure-plan-ribbon.png`
  - `packages/web/tmp/ux-next-wp10-20260513/03-lens-mep-plan-ribbon.png`
  - `packages/web/tmp/ux-next-wp10-20260513/04-cmdk-room-disabled-by-lens.png`
  - `packages/web/tmp/ux-next-wp10-20260513/05-element-lens-scope-notice.png`
  - `packages/web/tmp/ux-next-wp10-20260513/summary.json`
- Runtime summary confirms:
  - ribbon command count changes by lens (`architecture: 13`, `structure: 9`, `mep: 1`),
  - Cmd+K `tool.room` entry is disabled in MEP lens with explicit gating reason,
  - deterministic canvas lens classification is recorded for `all/architecture/structure/mep`.

### WP-NEXT-11 — View Creation Discoverability

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-012`, `NEXT-GAP-020`
- Goal: expose obvious creation entry points for floor plans/3D/sections/sheets/schedules and project settings.
- Source ownership:
  - `WorkspaceLeftRail.tsx`
  - project menu/commands
  - relevant dialogs
- Acceptance:
  - clear create actions are present in canonical owners (primary nav/project menu/ribbon as defined),
  - project settings is reachable through explicit primary/project path plus Cmd+K,
  - tests verify discoverability in seeded baseline.

Evidence (2026-05-13):

- Added explicit primary-sidebar `Create` owner panel with direct actions for floor plan / 3D view / section / sheet / schedule and a dedicated project-settings entrypoint:
  - `packages/web/src/workspace/WorkspaceLeftRail.tsx`
- Wired creation + settings actions to canonical workspace semantics (no dead buttons):
  - floor plans via `upsertPlanView`
  - 3D saved views via `create_saved_view`
  - sections via plan section authoring tool activation
  - sheets via `CreateSheet`
  - schedules via `upsertSchedule`
  - project settings routes to `project_settings` when present, otherwise opens the project menu settings owner
  - source wiring in `packages/web/src/workspace/Workspace.tsx`
- Expanded primary navigation discoverability model:
  - 3D rows now include saved views and support opening `saved_view` targets in tabs
  - project-settings row support when `project_settings` exists
  - `packages/web/src/workspace/workspaceUtils.ts`
  - `packages/web/src/workspace/tabsModel.ts`
- Cmd+K discoverability parity + metadata alignment:
  - new commands:
    - `project.open-settings`
    - `view.create.floor-plan`
    - `view.create.3d-view`
    - `view.create.section`
    - `view.create.sheet`
    - `view.create.schedule`
  - `packages/web/src/cmdPalette/defaultCommands.ts`
  - `packages/web/src/workspace/commandCapabilities.ts`
- Regression coverage updated:
  - `packages/web/src/cmdPalette/defaultCommands.test.ts`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
  - `packages/web/src/workspace/Workspace.test.tsx`
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp11-20260513/01-primary-create-panel.png`
  - `packages/web/tmp/ux-next-wp11-20260513/02-cmdk-create-sheet.png`
  - `packages/web/tmp/ux-next-wp11-20260513/03-cmdk-project-settings.png`
  - `packages/web/tmp/ux-next-wp11-20260513/04-cmdk-project-settings-opens-menu.png`
  - `packages/web/tmp/ux-next-wp11-20260513/05-primary-project-settings-opens-menu.png`
  - `packages/web/tmp/ux-next-wp11-20260513/summary.json`

### WP-NEXT-12 — Sheet UX Semantics

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-013`, `NEXT-GAP-014`
- Goal: make sheet canvas user-facing first; move verbose machine metadata out of main reading path; add sheet intent tagging (e.g. moodboard/documentation).
- Source ownership:
  - `packages/web/src/workspace/sheets/SheetCanvas.tsx`
  - sheet model/schema + filtering UI
- Acceptance:
  - default sheet view prioritizes sheet content, not long manifest text blocks,
  - metadata remains available in dedicated detail panel/export dialog,
  - sheet tags can be assigned, filtered, and surfaced in primary navigation/search.

Evidence (2026-05-13):

- Sheet canvas now renders canonical sheet content first and moves verbose manifest output behind a collapsed details owner (`Documentation details`) so metadata remains reachable without dominating first-read flow:
  - `packages/web/src/workspace/sheets/SheetCanvas.tsx`
- Sheet intent tagging is now explicit and replay-safe:
  - intent selector (`Documentation`/`Moodboard`/`Hybrid`) in sheet authoring toolbar,
  - canonical sheet patch command for kernel compatibility (`updateElementProperty key=titleblockParametersPatch`),
  - source:
    - `packages/web/src/workspace/sheets/SheetCanvas.tsx`
    - `packages/web/src/workspace/sheets/sheetIntent.ts`
- Primary navigation/search now surfaces intent hints from sheet metadata, enabling direct filter-by-intent workflows:
  - `packages/web/src/workspace/workspaceUtils.ts`
- Regression coverage:
  - `packages/web/src/workspace/sheets/SheetCanvas.test.tsx`
  - `packages/web/src/workspace/sheets/sheetIntent.test.ts`
  - `packages/web/src/workspace/workspaceUtils.test.ts`
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp12-20260513/01-sheet-default-collapsed-details.png`
  - `packages/web/tmp/ux-next-wp12-20260513/02-sheet-details-expanded.png`
  - `packages/web/tmp/ux-next-wp12-20260513/03-sheet-intent-moodboard.png`
  - `packages/web/tmp/ux-next-wp12-20260513/04-primary-search-moodboard-filter.png`
  - `packages/web/tmp/ux-next-wp12-20260513/summary.json`

### WP-NEXT-13 — Schedule Meaningfulness Upgrade

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-015`
- Goal: make schedules useful as practical quantity/specification artifacts for roles.
- Source ownership:
  - schedule mode shell/panel components
  - advisor integration and preset registry
- Acceptance:
  - role-appropriate default schedule presets (architect, energy advisor, etc.),
  - meaningful columns/units/aggregation with clear provenance,
  - place-on-sheet and export flows remain intact.

Evidence (2026-05-13):

- Schedule canvas now exposes explicit workflow profiles by schedule category + workspace context (architectural, MEP load-zoning, energy/opening, quantity takeoff) with one-click profile application that writes canonical `upsertSchedule` payloads:
  - profile metadata includes preset columns, sort/group strategy, and expected aggregation intent
  - source: `packages/web/src/workspace/ModeShells.tsx`
- Workflow profile diagnostics now surface meaning/provenance inline:
  - required-field availability against server-returned columns,
  - units and aggregation cues derived from canonical preset metadata,
  - server derivation provenance line (`scheduleEngine` + schedule id)
  - source: `packages/web/src/workspace/ModeShells.tsx`
- Export and place-on-sheet flows remain first-class in schedule mode:
  - explicit `Export CSV` action (server schedule table endpoint + totals),
  - existing `Place on sheet` action preserved,
  - Cmd+K reachability preserved for schedule placement.
- Regression coverage:
  - `packages/web/src/workspace/ModeShells.test.tsx` (new workflow-profile apply assertion including `displayColumnKeys` + grouping/sort payload)
- Seeded live proof (`make seed name=target-house-3`, `make dev name=target-house-3`) captured in:
  - `packages/web/tmp/ux-next-wp13-20260513/01-schedule-workflow-panel.png`
  - `packages/web/tmp/ux-next-wp13-20260513/02-schedule-profile-applied.png`
  - `packages/web/tmp/ux-next-wp13-20260513/03-cmdk-schedule-place-on-sheet.png`
  - `packages/web/tmp/ux-next-wp13-20260513/summary.json`

### WP-NEXT-14 — Section Context Reinforcement

- Priority: `P2`
- Status: `Open`
- Covers: `NEXT-GAP-016`
- Goal: improve section comprehension by tying section markers/planes between plan and 3D contexts.
- Source ownership:
  - section mode shell
  - plan/3D overlays and section navigation commands
- Acceptance:
  - section source and cut orientation are clear in both plan and 3D,
  - user can jump between section marker and 3D context consistently.

### WP-NEXT-15 — 3D Visual Fidelity Track

- Priority: `P1`
- Status: `Open`
- Covers: `NEXT-GAP-018`
- Goal: harden rendering quality for dark mode, materials, and realistic/raytrace-style modes.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - render style controls + material pipeline
- Acceptance:
  - dark mode palette remains legible and physically plausible,
  - materials render consistently across standard/realistic modes,
  - explicit capability note for raytrace mode (true realtime/path-trace/fallback) and constraints.

### WP-NEXT-16 — Onboarding + QA Closeout

- Priority: `P2`
- Status: `Open`
- Covers: `NEXT-GAP-019` plus global regression closure
- Goal: align onboarding narrative with final layout/workflows and close with robust seeded QA.
- Source ownership:
  - `packages/web/src/onboarding/tour.ts`
  - `packages/web/src/onboarding/OnboardingTour.tsx`
  - Playwright suites
- Acceptance:
  - onboarding steps match canonical regions and top workflows,
  - screenshot matrix covers desktop/tablet/narrow, no-selection/selection/active-command/dialog states,
  - seeded validation script is documented and repeatable.

## Dependency Sequence

1. `WP-NEXT-01` shell precision.
2. `WP-NEXT-04` wall draft correctness.
3. `WP-NEXT-05` + `WP-NEXT-06` 3D correctness/editability.
4. `WP-NEXT-10` lens contract enforcement.
5. `WP-NEXT-02` + `WP-NEXT-09` sidebar/ribbon coherence.
6. `WP-NEXT-07` + `WP-NEXT-08` visibility/label readability.
7. `WP-NEXT-11` discoverability and project settings.
8. `WP-NEXT-12` + `WP-NEXT-13` sheet/schedule semantics.
9. `WP-NEXT-14` section context refinement.
10. `WP-NEXT-15` visual fidelity pass.
11. `WP-NEXT-16` onboarding + final QA closeout.

## Evidence Requirements Per Workpackage

Each package can be marked `Done` only if all apply:

- seeded run executed:
  - `make seed name=target-house-3`
  - `make dev name=target-house-3`
  - verify on `http://127.0.0.1:2000/`
- ownership/reachability tests added or updated,
- `pnpm --filter @bim-ai/web typecheck` passes,
- relevant targeted tests pass,
- `pnpm exec prettier --check <changed files>` passes,
- `git diff --check` passes,
- Playwright screenshots captured for affected states,
- tracker row updated with concrete evidence paths and command IDs where relevant.

## Product Decisions Needed (Potential Blockers)

| Decision ID  | Question                                                                                        | Blocks                     |
| ------------ | ----------------------------------------------------------------------------------------------- | -------------------------- |
| NEXT-DEC-001 | Resolved 2026-05-13: strict block with explicit warning when `plan_view.cropEnabled` is active. | —                          |
| NEXT-DEC-002 | For sheet tagging, is taxonomy fixed (`moodboard`, `documentation`, etc.) or user-defined tags? | `WP-NEXT-12`               |
| NEXT-DEC-003 | For discipline lenses, should command sets be hard-switched or layered with optional reveal?    | `WP-NEXT-10`, `WP-NEXT-09` |
| NEXT-DEC-004 | What is the minimum viable “raytrace/realistic” definition for this phase?                      | `WP-NEXT-15`               |

## Immediate Next Slice Recommendation

Start with `WP-NEXT-04` (wall draft lifecycle and off-plan guardrails) after a quick `WP-NEXT-01` shell geometry correction pass. Reason: the wall placement bug is a direct trust breaker in core authoring and should be fixed before deeper polish.
