# BIM AI UX Next-Phase Tracker

Last updated: 2026-05-13

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
| NEXT-GAP-003 | No recursive drag-drop canvas split from tabs (horizontal/vertical panes).                                         | `workspace/shell/TabBar.tsx`, `workspace/tabsModel.ts`, `workspace/viewport/CanvasMount.tsx` | P1       | Done   |
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
| NEXT-GAP-016 | Sections are hard to understand in relation to 3D; section context could be spatially reinforced.                  | section mode shell, viewport overlays                                                        | P2       | Done   |
| NEXT-GAP-017 | Overflow hygiene: clipped dropdowns and horizontal scrolling inside sidebars.                                      | shell/sidebar CSS/layout constraints                                                         | P1       | Done   |
| NEXT-GAP-018 | 3D visual quality gaps: dark mode mismatch, materials/realistic/raytrace strategy unclear.                         | `Viewport.tsx`, render style pipeline                                                        | P1       | Done   |
| NEXT-GAP-019 | Onboarding tour targets exist but narrative is outdated for next-phase workflows.                                  | `onboarding/tour.ts`, `onboarding/OnboardingTour.tsx`                                        | P2       | Done   |
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
- Status: `Done`
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

Evidence (2026-05-13):

- Added recursive pane tree model + persistence with invariants:
  - `packages/web/src/workspace/paneLayout.ts`
  - `packages/web/src/workspace/paneLayout.test.ts`
- Workspace now renders recursive split canvases, keeps focused-pane tab ownership, normalizes pane state on tab close/reorder, and persists/restores pane layout:
  - `packages/web/src/workspace/Workspace.tsx`
- Tab drag lifecycle now exposes canvas split drop-zones; keyboard fallback is available through Cmd+K split commands:
  - `packages/web/src/workspace/shell/TabBar.tsx`
  - `packages/web/src/workspace/shell/TabBar.test.tsx`
  - `packages/web/src/cmdPalette/defaultCommands.ts`
  - `packages/web/src/cmdPalette/defaultCommands.test.ts`
  - `packages/web/src/workspace/commandCapabilities.ts`
- Seeded Playwright proof:
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/01-wp03-split-created.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/02-wp03-nested-split.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/03-wp03-reload-persisted.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/summary.json` (`wp03SplitCreated=true`, `wp03NestedSplitCreated=true`, `wp03PersistedAfterReload=true`).

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
- Status: `Done`
- Covers: `NEXT-GAP-016`
- Goal: improve section comprehension by tying section markers/planes between plan and 3D contexts.
- Source ownership:
  - section mode shell
  - plan/3D overlays and section navigation commands
- Acceptance:
  - section source and cut orientation are clear in both plan and 3D,
  - user can jump between section marker and 3D context consistently.

Evidence (2026-05-13):

- Section workbench now shows explicit spatial context (run/axis/look heading) and direct jump actions:
  - `packages/web/src/workspace/sheets/SectionPlaceholderPane.tsx`
  - `packages/web/src/workspace/sheets/SectionPlaceholderPane.test.tsx`
- Added canonical section navigation callback wiring through mode/canvas/workspace:
  - `packages/web/src/workspace/ModeShells.tsx`
  - `packages/web/src/workspace/ModeShells.test.tsx`
  - `packages/web/src/workspace/viewport/CanvasMount.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
- Added Cmd+K section context jump command + capability metadata:
  - `section.open-3d-context` in `packages/web/src/cmdPalette/defaultCommands.ts`
  - `packages/web/src/workspace/commandCapabilities.ts`
- Seeded Playwright proof:
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/04-wp14-section-context.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/05-wp14-section-jump-3d.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/summary.json` (`wp14SectionContextVisible=true`, `wp14Section3dJump=true`, `wp14CmdkReachable=true`).

### WP-NEXT-15 — 3D Visual Fidelity Track

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT-GAP-018`
- Goal: harden rendering quality for dark mode, materials, and realistic/raytrace-style modes.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - render style controls + material pipeline
- Acceptance:
  - dark mode palette remains legible and physically plausible,
  - materials render consistently across standard/realistic modes,
  - explicit capability note for raytrace mode (true realtime/path-trace/fallback) and constraints.

Evidence (2026-05-13):

- Added explicit realistic/ray-trace capability/fallback note directly in 3D graphics controls:
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.tsx`
  - `packages/web/src/workspace/viewport/Viewport3DLayersPanel.test.tsx`
- Hardened theme-aware viewport lighting profile for dark mode while preserving material consistency:
  - `packages/web/src/viewport/materials.ts`
  - `packages/web/src/viewport/materials.test.ts`
  - `packages/web/src/Viewport.tsx`
- Seeded Playwright proof:
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/06-wp15-raytrace-note.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/07-wp15-dark-raytrace.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/summary.json` (`wp15RaytraceNoteVisible=true`, `wp15DarkRaytraceCaptured=true`).

### WP-NEXT-16 — Onboarding + QA Closeout

- Priority: `P2`
- Status: `Done`
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

Evidence (2026-05-13):

- Updated onboarding narrative to match final next-phase workflows and ownership language:
  - `packages/web/src/onboarding/tour.ts`
- Added repeatable seeded Playwright capture script and matrix artifacts:
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/capture.mjs`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/08-wp16-onboarding-desktop.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/09-wp16-onboarding-tablet.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/10-wp16-onboarding-narrow.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/11-wp16-active-command-wall.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/12-wp16-dialog-shortcuts.png`
  - `packages/web/tmp/ux-next-wp03-14-15-16-20260513/summary.json` (`wp16OnboardingReplayVisible=true`, `wp16TabletCaptured=true`, `wp16NarrowCaptured=true`, `wp16ActiveCommandCaptured=true`, `wp16DialogCaptured=true`).

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

## Reopened Tracker (2026-05-13, feedback round 2)

The seeded review on 2026-05-13 surfaced new hard failures after prior closeout:

- ribbon commands looked available but did not activate executable tools,
- lens ownership and dropdown ergonomics were still incorrect for the desired layout,
- split panes need to become tab-aware sub-canvases (not only single-tab leaves with global chrome).

### Reopened Gap Inventory

| ID            | Gap                                                                                                    | Evidence / owner hotspots                                                          | Priority | Status |
| ------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------- | ------ |
| NEXT2-GAP-001 | Ribbon command appears clickable but no executable state transition occurs for several plan tools.     | `workspace/workspaceUtils.ts`, `workspace/shell/RibbonBar.tsx`, `Workspace.tsx`    | P0       | Done   |
| NEXT2-GAP-002 | Lens owner must be primary sidebar; dropdown must not clip at the top edge.                            | `WorkspaceLeftRail.tsx`, `WorkspaceRightRail.tsx`, `shell/LensDropdown.tsx`        | P0       | Done   |
| NEXT2-GAP-003 | Split panes are not full tab-aware work areas (local tab lifecycle and tab reassignment are missing).  | `workspace/paneLayout.ts`, `workspace/Workspace.tsx`, `workspace/shell/TabBar.tsx` | P0       | Done   |
| NEXT2-GAP-004 | Pane split architecture needs explicit contract for ribbon/secondary/element ownership per pane focus. | shell layout + mode surface ownership contracts                                    | P1       | Done   |

### Reopened Workpackages

### WP-NEXT-17 — Ribbon Command Liveness Recovery

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT2-GAP-001`
- Goal: remove no-op ribbon clicks by ensuring plan ribbon tools map to executable `planTool` states.
- Source ownership:
  - `packages/web/src/workspace/workspaceUtils.ts`
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/src/workspace/Workspace.test.tsx`
  - `packages/web/src/workspace/workspaceUtils.test.ts`
- Acceptance:
  - ribbon command click changes active tool state for each exposed plan tool,
  - tool active state is reflected in ribbon selection styling (`aria-pressed`),
  - no exposed plan ribbon tool is silently ignored.

Evidence (2026-05-13):

- Expanded `KNOWN_PLAN_TOOLS` to include exposed plan ribbon commands (`ceiling`, `column`, `beam`, `shaft`, `stair`, `railing`, plus modify/support tools) so `validatePlanTool` no longer rejects valid ribbon actions.
- Added regression tests:
  - `packages/web/src/workspace/workspaceUtils.test.ts`
  - `packages/web/src/workspace/Workspace.test.tsx` (`activates ceiling tool directly from ribbon create panel`)
- Seeded screenshot proof:
  - `packages/web/tmp/ux-next-wp17-wp18-20260513/01-ribbon-ceiling-active.png`
  - `packages/web/tmp/ux-next-wp17-wp18-20260513/summary.json` (`ceilingPressed: true`)

### WP-NEXT-18 — Lens Ownership + Overflow Hygiene Relocation

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT2-GAP-002`
- Goal: move discipline lens ownership into primary sidebar and prevent clipped dropdown rendering.
- Source ownership:
  - `packages/web/src/workspace/WorkspaceLeftRail.tsx`
  - `packages/web/src/workspace/WorkspaceRightRail.tsx`
  - `packages/web/src/workspace/shell/LensDropdown.tsx`
  - `packages/web/src/workspace/commandCapabilities.ts`
  - tests in workspace + capabilities suites
- Acceptance:
  - primary sidebar owns lens control (`primary-lens-filter`),
  - secondary sidebar no longer renders legacy lens section,
  - dropdown expands fully within visible viewport and does not clip at top,
  - command capability metadata reflects `primary-sidebar` lens ownership while preserving Cmd+K.

Evidence (2026-05-13):

- Lens moved from secondary to primary sidebar (`primary-lens-filter`, `primary-lens-dropdown`).
- Secondary lens section removed from `WorkspaceRightRail`.
- Lens menu placement changed from upward expansion (`bottom-full`) to downward expansion (`top-full`) in `LensDropdown`.
- Capability ownership updated:
  - `navigate.architecture`, `navigate.structure`, `navigate.mep` surfaces now `['cmd-k', 'primary-sidebar']`.
- Regression + ownership tests updated:
  - `packages/web/src/workspace/Workspace.test.tsx`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
- Seeded screenshot proof:
  - `packages/web/tmp/ux-next-wp17-wp18-20260513/02-primary-lens-dropdown-open.png`
  - `packages/web/tmp/ux-next-wp17-wp18-20260513/03-secondary-no-lens-block.png`
  - `packages/web/tmp/ux-next-wp17-wp18-20260513/summary.json`
    - `lensMenuVisible: true`
    - `lensMenuNotClippedTop: true`
    - `secondaryLensAbsent: true`

### WP-NEXT-19 — Pane-Local Tab-Aware Split Surfaces

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT2-GAP-003`
- Goal: convert split panes from single-tab leaf projections to true tab-aware sub-canvases with local lifecycle controls.
- Source ownership:
  - `packages/web/src/workspace/paneLayout.ts`
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/src/workspace/shell/TabBar.tsx`
- Acceptance:
  - each pane can host a tab stack and an active tab,
  - tab can be moved into a target pane (not only split-left/right/top/bottom),
  - pane-local close works and preserves global tab invariants,
  - pane-local tab strip supports activation and drag-entry into pane.
- Implementation + evidence:
  - Added explicit pane-target assignment primitive `assignTabToPane(...)` in `paneLayout.ts`; reused by focused pane assignment.
  - Each split leaf now renders pane-local tab chrome (`canvas-pane-tabstrip-*`) with active tab label and pane-local close action.
  - Dragging a tab over a pane-local strip now accepts direct drop/reassignment into that pane.
  - Added regression tests:
    - `packages/web/src/workspace/paneLayout.test.ts` (`assignTabToPane` behavior)
    - `packages/web/src/workspace/Workspace.test.tsx` (drop-assign into pane + pane-local close lifecycle)
  - Seeded screenshot proof:
    - `packages/web/tmp/ux-next-wp19-20260513/03-pane-local-tabstrip-and-close.png`
    - `packages/web/tmp/ux-next-wp19-20260513/summary.json`
      - `paneTabStripCount: 2`
      - `paneLocalTabChromeVisible: true`
      - `paneCloseRemovesTab: true`

### WP-NEXT-20 — Focused-Pane Chrome Contract (Ribbon + Secondary + Element)

- Priority: `P1`
- Status: `Done`
- Covers: `NEXT2-GAP-004`
- Goal: formalize how global ribbon/secondary/element surfaces follow focused pane context without duplicating entire chrome per pane.
- Source ownership:
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/src/workspace/modeSurfaces.ts`
  - shell ownership tests
- Acceptance:
  - focused pane drives ribbon + secondary + element context deterministically,
  - pane focus switch updates these surfaces without stale data,
  - Cmd+K context follows focused pane target/mode.
- Implementation + evidence:
  - Pane focus switching now deterministically rebinds shell ownership context using focused leaf's active tab target/mode.
  - Added stale lookup hardening for newly created/opened tabs (`openElementById` resolves against live store state first), fixing intermittent "click tab/new view does not load" failures.
  - Added regression coverage in `Workspace.test.tsx` verifying focus move from sheet pane to plan pane updates ribbon identity and secondary sidebar surfaces.
  - Seeded screenshot proof:
    - `packages/web/tmp/ux-next-wp19-20260513/01-tab-click-mode-switch.png`
    - `packages/web/tmp/ux-next-wp19-20260513/02-create-views-new-tabs.png`
    - `packages/web/tmp/ux-next-wp19-20260513/summary.json`
      - `allTabClicksLoadMode: true`
      - `newViewCreatesTabs: true`

### Reopened Dependency Sequence

1. `WP-NEXT-17` ribbon liveness.
2. `WP-NEXT-18` lens relocation/overflow.
3. `WP-NEXT-19` pane-local tab-aware split surfaces.
4. `WP-NEXT-20` focused-pane chrome contract.

## Reopened Tracker (2026-05-13, feedback round 3)

| Gap ID        | Problem Statement                                                                                         | Canonical Surfaces / Files                                | Priority | Status |
| ------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ------ |
| NEXT3-GAP-001 | Multi-tab readability is ambiguous (active vs focused-pane vs merely shown).                              | `workspace/shell/TabBar.tsx`, `workspace/Workspace.tsx`   | P0       | Done   |
| NEXT3-GAP-002 | Pane with no assigned tab must render a true empty state instead of falling back to unrelated tab canvas. | `workspace/Workspace.tsx`, `workspace/Workspace.test.tsx` | P0       | Done   |

### WP-NEXT-21 — Tab State Clarity + Truthful Empty Pane Rendering

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT3-GAP-001`, `NEXT3-GAP-002`
- Goal: make tab state immediately legible and ensure no-tab panes never display stale/foreign canvas content.
- Source ownership:
  - `packages/web/src/workspace/shell/TabBar.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/src/workspace/shell/TabBar.test.tsx`
  - `packages/web/src/workspace/Workspace.test.tsx`
- Acceptance:
  - active tab has distinct tone + explicit label;
  - focused-pane tab and shown-in-pane tabs have distinct badges/tones;
  - no-tab pane renders explicit empty-state copy;
  - tab lifecycle remains reachable (tab activate/close/drag + Cmd+K unaffected).
- Implementation + evidence:
  - Added tab badges + tones in `TabBar`:
    - `Active`
    - `Focused pane`
    - `Shown` / `N panes`
  - Added pane assignment metadata pass-through from `Workspace` to `TabBar` via:
    - `focusedPaneTabId`
    - `tabPaneAssignments`
  - Removed implicit leaf fallback-to-active-tab rendering so null `tabId` renders true empty pane UI.
  - Added regression tests:
    - `TabBar.test.tsx` (`shows clear active/focused/shown state badges`)
    - `Workspace.test.tsx` (`renders a real empty pane state when no tabs are open`)
  - Seeded screenshot proof:
    - `packages/web/tmp/ux-next-wp21-20260513/01-tab-clarity-states.png`
    - `packages/web/tmp/ux-next-wp21-20260513/02-no-tabs-real-empty-state.png`
    - `packages/web/tmp/ux-next-wp21-20260513/summary.json`
      - `activeBadgeVisible: true`
      - `focusedBadgeVisible: true`
      - `shownBadgeVisible: true`
      - `emptyPaneMessagePresent: true`
      - `paneEmptyStateCount: 1`

## Reopened Tracker (2026-05-13, feedback round 4)

| Gap ID        | Problem Statement                                                                 | Canonical Surfaces / Files                           | Priority | Status |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- | ------ |
| NEXT4-GAP-001 | 3D ribbon appears almost empty compared with expected authoring workflow density. | `workspace/shell/RibbonBar.tsx`, 3D mode bridge flow | P0       | Done   |

### WP-NEXT-22 — 3D Ribbon Density + Bridge Activation

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT4-GAP-001`
- Goal: expose a fuller authoring command surface in 3D while keeping behavior explicit and reachable.
- Source ownership:
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - `packages/web/src/workspace/Workspace.test.tsx`
- Acceptance:
  - 3D ribbon exposes rich modeling commands (build/openings/circulation/annotate/datum);
  - commands unavailable as direct 3D operations remain visible as bridge commands instead of being stripped;
  - clicking a bridge command switches to target mode and activates the command.
- Implementation + evidence:
  - Expanded 3D ribbon tabs with `Model` + `Annotate` panels (wall/floor/roof/ceiling/doors/windows/shaft/stair/railing/dimension/tag/section/elevation/grid/reference plane).
  - Ribbon filtering updated to keep `bridge` commands visible (only `disabled` commands hidden).
  - Ribbon run behavior updated:
    - `bridge` command click auto-switches to target mode (e.g. Plan),
    - then executes the selected tool/action.
  - Added bridge badge rendering on bridged commands (`Plan`).
  - Regression test added in `Workspace.test.tsx`:
    - `exposes full 3D modeling ribbon actions with plan-bridge cues and activation`
  - Seeded screenshot proof:
    - `packages/web/tmp/ux-next-wp22-20260513/01-3d-ribbon-model-tools.png`
    - `packages/web/tmp/ux-next-wp22-20260513/02-3d-wall-bridges-to-plan.png`
    - `packages/web/tmp/ux-next-wp22-20260513/summary.json`
      - `modelToolsPresent: true`
      - `bridgeBadgePlanPresent: true`
      - `modeIdentityAfterWallClick: "Plan"`
      - `wallPressedAfterBridge: "true"`

## Reopened Tracker (2026-05-13, feedback round 5)

| Gap ID        | Problem Statement                                                                                                   | Canonical Surfaces / Files                                          | Priority | Status |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- | ------ |
| NEXT5-GAP-001 | In 3D, selecting `Wall` from ribbon activates selection-state but does not allow click-to-draw authoring on canvas. | `Viewport.tsx`, `tools/toolRegistry.ts`, command capability mapping | P0       | Done   |

### WP-NEXT-23 — Direct 3D Wall Draft Commit Path

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT5-GAP-001`
- Goal: make `Wall` in 3D genuinely drawable (two-click draft commit) instead of only mode/highlight state.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/authoring3d.ts`
  - `packages/web/src/tools/toolRegistry.ts`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
  - `packages/web/src/workspace/shell/TopBar.test.tsx`
  - `packages/web/src/workspace/Workspace.test.tsx`
- Acceptance:
  - 3D `Wall` stays in 3D mode when activated from ribbon;
  - first click on 3D canvas stores draft start on active level plane;
  - second click commits `createWall`;
  - command remains reachable through ribbon/Cmd+K metadata.
- Implementation + evidence:
  - Added 3D authoring helpers:
    - `resolve3dDraftLevel` (preferred active level, fallback to lowest level),
    - `projectSceneRayToLevelPlaneMm` (ray -> level plane projection).
  - Added two-click 3D wall draft flow in `Viewport` pointer-up logic:
    - when `planTool === wall`, orbit click is consumed for drafting,
    - first click captures start point,
    - second click dispatches `createWall` with `levelId`, `locationLine`, `wallTypeId`, `heightMm`.
  - Updated tool metadata so `wall` is a direct 3D tool (`modes: ['plan','3d']`) rather than forced plan bridge.
  - Updated command/ribbon regression tests to assert direct 3D wall activation.
  - Seeded screenshot + live request-capture proof:
    - `packages/web/tmp/ux-next-wp23-20260513/01-3d-wall-tool-active.png`
    - `packages/web/tmp/ux-next-wp23-20260513/02-3d-wall-draft-committed.png`
    - `packages/web/tmp/ux-next-wp23-20260513/summary.json`
      - `modeIdentityBeforeWallDraw: "3D"`
      - `modeIdentityAfterWallDraw: "3D"`
      - `createWallCommandCount: 1`

## Reopened Tracker (2026-05-13, feedback round 6)

| Gap ID        | Problem Statement                                                                                                             | Canonical Surfaces / Files                          | Priority | Status |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------- | ------ |
| NEXT6-GAP-001 | 3D wall authoring is technically possible but UX is unclear: start point not visible, prompts missing, feels like orbit-grab. | `Viewport.tsx` interaction + in-canvas guidance HUD | P0       | Done   |

### WP-NEXT-24 — 3D Wall Placement UX Clarity Pass (Revit-style Cues)

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT6-GAP-001`
- Goal: make 3D wall authoring legible and predictable using explicit placement cues and clear camera-vs-authoring input ownership.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-next-wp24-20260513/capture.mjs`
- Acceptance:
  - wall tool in 3D shows explicit prompt (`pick start` / `pick end`);
  - first click creates visible start marker + dashed preview segment;
  - plain left-click is wall placement while camera orbit/pan uses modifier/middle mouse;
  - `Esc` cancels in-flight wall segment.
- Implementation + evidence:
  - Added 3D wall-placement overlay state (`pick-start` / `pick-end`) with level context.
  - Added in-canvas placement HUD text:
    - `Click start point. Alt+drag or middle mouse to orbit/pan.`
    - `Click end point. Esc cancels segment.`
  - Added visible SVG start marker + dashed preview line between start and live cursor position.
  - Updated pointer ownership:
    - plain LMB in wall tool uses `wall-draft` mode (no accidental orbit-grab),
    - orbit/pan still reachable via modifier/middle mouse.
  - Added `Esc` handling to cancel current wall segment and reset prompt state.
  - Seeded screenshot + live command capture proof:
    - `packages/web/tmp/ux-next-wp24-20260513/01-3d-wall-pick-start-prompt.png`
    - `packages/web/tmp/ux-next-wp24-20260513/02-3d-wall-pick-end-preview.png`
    - `packages/web/tmp/ux-next-wp24-20260513/03-3d-wall-commit-stays-3d.png`
    - `packages/web/tmp/ux-next-wp24-20260513/summary.json`
      - `modeIdentity: "3D"`
      - `startPromptVisible: true`
      - `createWallCommandCount: 1`

## Reopened Tracker (2026-05-13, feedback round 7)

| Gap ID        | Problem Statement                                                                                                                                               | Canonical Surfaces / Files                                                                  | Priority | Status |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT7-GAP-001 | Revit-style 3D authoring clarity existed only for walls; other core modeling tools remained ambiguous or bridge-only, causing “grab” feel and no-op perception. | `Viewport.tsx`, `tools/toolRegistry.ts`, command capability/ribbon reachability test suites | P0       | Done   |

### WP-NEXT-25 — Direct 3D Authoring Expansion (Element-Specific UX)

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT7-GAP-001`
- Goal: extend direct, legible 3D authoring beyond walls with per-element interaction models that match element semantics.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/tools/toolRegistry.ts`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
  - `packages/web/src/workspace/shell/TopBar.test.tsx`
  - `packages/web/src/workspace/uxAudit.test.ts`
  - `packages/web/tmp/ux-next-wp25-20260513/capture.mjs`
- Acceptance:
  - `Column` in 3D places on click with explicit prompt;
  - `Beam` in 3D uses two-click start/end with preview segment + prompt;
  - `Ceiling` in 3D uses boundary sketch (vertex clicks + close near first point) with preview cues;
  - `Door` / `Window` / `Opening` in 3D place directly by clicking a wall face;
  - direct tools are not shown as plan-bridge in 3D ribbon;
  - camera controls remain reachable (`Alt+drag` or middle mouse), and `Esc` cancels in-flight drafts.
- Implementation + evidence:
  - Expanded direct 3D tool handling in `Viewport`:
    - unified direct-tool pointer ownership (`tool-draft`) to avoid accidental orbit-grab;
    - per-tool command dispatch:
      - `createColumn`
      - `createBeam`
      - `createCeiling`
      - `insertDoorOnWall`
      - `insertWindowOnWall`
      - `createWallOpening`
    - wall-face pick path for hosted tools uses parametric `alongT` projection;
    - element-specific in-canvas HUD instructions and preview overlays (line/polyline + start marker).
  - Promoted `door`, `window`, `wall-opening`, `column`, `beam`, `ceiling` to direct 3D tool modes in `toolRegistry`.
  - Updated reachability/regression tests for capability and ribbon behavior.
  - Seeded screenshot + live command capture proof:
    - `packages/web/tmp/ux-next-wp25-20260513/01-3d-column-prompt.png`
    - `packages/web/tmp/ux-next-wp25-20260513/02-3d-beam-preview.png`
    - `packages/web/tmp/ux-next-wp25-20260513/03-3d-ceiling-sketch-preview.png`
    - `packages/web/tmp/ux-next-wp25-20260513/04-3d-door-pick-wall-prompt.png`
    - `packages/web/tmp/ux-next-wp25-20260513/05-3d-hosted-openings-placed.png`
    - `packages/web/tmp/ux-next-wp25-20260513/summary.json`
      - `modeIdentity: "3D"`
      - `commandCounts.createColumn: 1`
      - `commandCounts.createBeam: 1`
      - `commandCounts.createCeiling: 1`
      - `commandCounts.insertDoorOnWall: 1`
      - `commandCounts.insertWindowOnWall: 1`
      - `commandCounts.createWallOpening: 1`

## Reopened Tracker (2026-05-13, feedback round 8)

| Gap ID        | Problem Statement                                                                                                                | Canonical Surfaces / Files                                                     | Priority | Status |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ------ |
| NEXT8-GAP-001 | Revit-style direct 3D authoring still did not cover the rest of 3D ribbon modeling/datum tools, and `Roof` click remained inert. | `Viewport.tsx`, `toolRegistry.ts`, `workspace/workspaceUtils.ts`, ribbon tests | P0       | Done   |

### WP-NEXT-26 — Direct 3D Authoring Completion For Remaining Ribbon Tools

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT8-GAP-001`
- Goal: complete direct 3D authoring for the remaining high-value ribbon tools with element-specific interaction models and remove no-op selection behavior.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/tools/toolRegistry.ts`
  - `packages/web/src/workspace/workspaceUtils.ts`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
  - `packages/web/src/workspace/shell/TopBar.test.tsx`
  - `packages/web/src/workspace/uxAudit.test.ts`
  - `packages/web/tmp/ux-next-wp26-20260513/capture.mjs`
- Acceptance:
  - 3D `Floor` / `Roof` / `Shaft` support boundary sketch + close behavior with preview cues;
  - 3D `Stair` / `Railing` / `Grid` / `Reference Plane` support two-click start/end flow with clear preview segment;
  - exposed 3D ribbon commands no longer appear direct-but-inert;
  - command reachability remains valid via ribbon + Cmd+K.
- Implementation + evidence:
  - Expanded direct 3D tool set and per-tool command dispatch in `Viewport`:
    - sketch tools: `createFloor`, `createRoof`, `createSlabOpening (isShaft=true)`
    - line tools: `createStair`, `createRailing`, `createGridLine`, `createReferencePlane`
    - existing hosted/structural tools preserved with direct execution.
  - Added explicit line/polygon tool classification (`LINE_3D_AUTHORING_TOOLS`, `POLYGON_3D_AUTHORING_TOOLS`) for prompt, preview, and `Esc` cancel lifecycle.
  - Promoted remaining tool modes to direct 3D where applicable in `toolRegistry` (`floor`, `roof`, `shaft`, `stair`, `railing`, `grid`, `reference-plane`, plus room/area parity via command surface).
  - Removed inert `Roof` activation path by adding `roof` to canonical plan-tool validation set in `workspaceUtils`.
  - Regression coverage updates:
    - `packages/web/src/workspace/commandCapabilities.test.ts`
    - `packages/web/src/workspace/shell/TopBar.test.tsx`
    - `packages/web/src/workspace/uxAudit.test.ts`
    - `packages/web/src/workspace/workspaceUtils.test.ts`
  - Seeded screenshot + command proof (`make seed name=target-house-3`, `http://127.0.0.1:2000/`):
    - `packages/web/tmp/ux-next-wp26-20260513/01-3d-floor-boundary-preview.png`
    - `packages/web/tmp/ux-next-wp26-20260513/02-3d-roof-footprint-preview.png`
    - `packages/web/tmp/ux-next-wp26-20260513/03-3d-shaft-preview.png`
    - `packages/web/tmp/ux-next-wp26-20260513/04-3d-stair-run-preview.png`
    - `packages/web/tmp/ux-next-wp26-20260513/05-3d-railing-path-preview.png`
    - `packages/web/tmp/ux-next-wp26-20260513/06-3d-grid-reference-preview.png`
    - `packages/web/tmp/ux-next-wp26-20260513/07-3d-reference-plane-placed.png`
    - `packages/web/tmp/ux-next-wp26-20260513/summary.json`
      - `modeIdentity: "3D"`
      - `commandCounts.createFloor: 1`
      - `commandCounts.createRoof: 1`
      - `commandCounts.createSlabOpening: 1`
      - `commandCounts.createStair: 1`
      - `commandCounts.createRailing: 1`
      - `commandCounts.createGridLine: 1`
      - `commandCounts.createReferencePlane: 1`
      - no 3D bridge badges for floor/roof/shaft/stair/railing.

## Reopened Tracker (2026-05-13, feedback round 9)

| Gap ID        | Problem Statement                                                                                                                                       | Canonical Surfaces / Files                | Priority | Status |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------- | ------ |
| NEXT9-GAP-001 | Hosted 3D inserts (especially `Window`) needed pre-placement preview that reads like a true opening footprint before click, not only a generic hint.    | `Viewport.tsx` authoring overlays         | P0       | Done   |
| NEXT9-GAP-002 | Default authoring contract needed stronger clarity: `Select` must remain the explicit default mode and first ribbon group focus when returning via Esc. | `Workspace.tsx`, `RibbonBar.tsx`          | P0       | Done   |
| NEXT9-GAP-003 | Several direct 3D tools lacked pre-click hover anchors, so first click still felt like camera-grab in practice.                                         | `Viewport.tsx` tool-specific hover states | P0       | Done   |

### WP-NEXT-27 — Per-Tool 3D Preview Clarity + Select-Default Contract Hardening

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT9-GAP-001`, `NEXT9-GAP-002`, `NEXT9-GAP-003`
- Goal: make every direct 3D ribbon tool legible before first click and make `Select` the unambiguous default state after `Esc`.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/tmp/ux-next-wp27-20260513/capture.mjs`
- Acceptance:
  - hosted `Door`/`Window`/`Opening` tools show wall-host preview before placement, with valid vs invalid host cueing;
  - line/point/polygon 3D tools show pre-click hover anchors so first click target is visible;
  - `Escape` returns to `Select`, and ribbon focus returns to first group/tab when `Select` becomes active;
  - reachability remains intact via ribbon + Cmd+K without dead/no-op commands.
- Implementation + evidence:
  - Extended 3D overlay state with hosted footprint outline support and added semantic hosted preview geometry (width + sill/head preview) in `Viewport`.
  - Added hover-anchor rendering for line tools (`pick-start`), point tools (`column`/`room`), and polygon tools before first vertex click.
  - Preserved direct tool pointer ownership while removing ambiguous “grab” feel by always showing a visible pre-click anchor in direct tool states.
  - Hardened ribbon select-default behavior by resetting to first tab whenever tool state transitions back to `select` (including Esc path).
  - Focused regression validation:
    - `pnpm --filter @bim-ai/web typecheck`
    - `pnpm --filter @bim-ai/web exec vitest run src/workspace/shell/TopBar.test.tsx src/workspace/Workspace.test.tsx src/workspace/commandCapabilities.test.ts src/workspace/uxAudit.test.ts`
  - Seeded runtime proof (`make seed name=target-house-3`, `make dev name=target-house-3`, `http://127.0.0.1:2000/`):
    - `packages/web/tmp/ux-next-wp27-20260513/01-3d-window-host-preview-before-place.png`
    - `packages/web/tmp/ux-next-wp27-20260513/02-3d-column-hover-preview.png`
    - `packages/web/tmp/ux-next-wp27-20260513/03-escape-returns-select-first-group.png`
    - `packages/web/tmp/ux-next-wp27-20260513/summary.json`
      - `windowPreview.found: true`
      - `windowPreview.invalid: false`
      - `columnHoverPreviewVisible: true`
      - `selectPressed: "true"`
      - `firstTabSelected: "true"`
  - Closure validation follow-up (2026-05-13):
    - Full web suite green after tab-aware onboarding regression hardening:
      - `pnpm --filter @bim-ai/web test`
      - `pnpm --filter @bim-ai/web typecheck`
      - `pnpm exec prettier --check packages/web/src/workspace/Workspace.semanticCommand.test.tsx packages/web/src/cmdPalette/CommandPalette.test.tsx`
      - `git diff --check`
    - Seeded tab-lifecycle smoke proof:
      - `packages/web/tmp/ux-next-closeout-20260513/01-initial.png`
      - `packages/web/tmp/ux-next-closeout-20260513/02-after-plan-click.png`
      - `packages/web/tmp/ux-next-closeout-20260513/03-after-3d-click.png`
      - `packages/web/tmp/ux-next-closeout-20260513/summary.json`
        - `initialTabCount: 1`
        - `tabsAfterPlan: 2`
        - `tabsAfter3d: 3`
        - `activePlanTab: tab-badge-active-plan:hf-pv-upper`
        - `active3dTab: tab-badge-active-3d:vp-front-elev`
