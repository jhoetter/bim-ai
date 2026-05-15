# BIM AI UX Next-Phase Tracker

Last updated: 2026-05-15

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
- Follow-up host-pick hardening (same-day seeded repro) removes mirrored duplicate door placement from rapid repeat clicks and rejects linked/backface wall hits in direct 3D hosted insertion:
  - code: `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/directAuthoringGuards.ts`, `packages/web/src/viewport/directAuthoringGuards.test.ts`
  - seeded captures: `packages/web/tmp/ux-door-wall-guard-20260513/01-before.png`, `02-after-door-double-click.png`, `03-after-wall-segment.png`
  - command trace: `packages/web/tmp/ux-door-wall-guard-20260513/summary.json` now records one `insertDoorOnWall` (no second mirrored insert) plus one `createWall` for the wall draft step.
- Follow-up wall draft UX parity pass makes 3D wall orientation deterministic at author time (wall-body preview + direction arrow + `Space` flip state in instruction overlay) so draw intent matches committed geometry:
  - code: `packages/web/src/Viewport.tsx`
  - seeded captures: `packages/web/tmp/ux-wall-draft-ux-20260513/01-wall-preview-default.png`, `02-wall-preview-flipped.png`, `03-wall-after-commit.png`
  - command trace: `packages/web/tmp/ux-wall-draft-ux-20260513/summary.json` (single `createWall` commit from the previewed segment state).
- Follow-up hosted insertion UX pass adds richer pre-placement 3D previews (door swing arc + window mullion glyph) and tighter wall-host snapping under overlap via scored host picking + stickiness:
  - code: `packages/web/src/Viewport.tsx`
  - seeded captures: `packages/web/tmp/ux-hosted-preview-snap-20260513/01-door-preview-glyph.png`, `02-window-preview-glyph.png`, `03-after-hosted-place.png`
  - command traces:
    - `packages/web/tmp/ux-hosted-preview-snap-20260513/summary.json` (door double-click emits one `insertDoorOnWall`; window emits one `insertWindowOnWall`)
    - `packages/web/tmp/ux-door-wall-guard-20260513/summary.json` (regression re-check still emits one `insertDoorOnWall` + one `createWall`).
- Follow-up dense-junction host control adds explicit host lock UX (`L` to lock/unlock + `HOST LOCK` badge), keeps lock on the selected host during overlap ambiguity, and clamps hosted `alongT` away from wall-end slivers to avoid unstable flips:
  - code: `packages/web/src/Viewport.tsx`
  - seeded captures: `packages/web/tmp/ux-host-lock-20260513/01-host-preview-unlocked.png`, `02-host-preview-locked.png`, `03-host-unlocked-second-place.png`
  - command trace: `packages/web/tmp/ux-host-lock-20260513/summary.json` (`countAfterLockedAttempt: 1`, so lock phase suppresses unintended second placement; unlock allows the intentional second wall-host placement).
- Follow-up wall endpoint fidelity pass commits line-based 3D tools from the current preview point (when click lands near the preview marker) instead of re-sampling a new end point on pointer-up, reducing “placed not where drawn” drift:
  - code: `packages/web/src/Viewport.tsx`
  - seeded trace: `packages/web/tmp/ux-wall-draft-ux-20260513/summary.json` (single `createWall` command from the draft workflow with endpoint fidelity path active).
- Follow-up wall-direction correction changes 3D wall flip behavior to preserve draw direction (start→end stays exactly as drawn) while flipping location-line side instead of reversing endpoints:
  - code: `packages/web/src/Viewport.tsx`
  - seeded traces: `packages/web/tmp/ux-door-wall-guard-20260513/summary.json`, `packages/web/tmp/ux-wall-draft-ux-20260513/summary.json`.

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

Evidence (2026-05-15 MEP/TGA closeout):

- MEP lens workpackages were implemented and merged to `main`:
  - model/API contract: `055b4452a`
  - schedule projections: `1434385dc`
  - UI authoring surfacing: `d41b24273`
  - current-main integration repair: `fe4971fd0`
- The MEP lens now exposes first-class system authoring commands in ribbon/Cmd+K capability metadata:
  - `tool.duct`
  - `tool.pipe`
  - `tool.cable-tray`
  - `tool.mep-equipment`
  - `tool.fixture`
  - `tool.mep-terminal`
  - `tool.mep-opening-request`
  - `tool.shaft`
- MEP-specific model/inspector/schedule coverage is tracked by:
  - `app/bim_ai/mep_lens.py`
  - `app/tests/test_mep_lens.py`
  - `packages/web/src/workspace/commandCapabilities.test.ts`
  - `packages/web/src/workspace/inspector/InspectorContent.test.tsx`
- Final verification on the integration branch passed:
  - `uv run pytest --no-cov tests/test_mep_lens.py`
  - `pnpm --filter @bim-ai/core exec tsc --noEmit`
  - `pnpm --filter @bim-ai/web exec vitest run src/workspace/commandCapabilities.test.ts src/workspace/inspector/InspectorContent.test.tsx`
  - `pnpm --filter @bim-ai/ui typecheck && pnpm --filter @bim-ai/web typecheck`

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

## Reopened Tracker (2026-05-13, feedback round 10)

| Gap ID         | Problem Statement                                                                                                                               | Canonical Surfaces / Files                                   | Priority | Status |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------- | ------ |
| NEXT10-GAP-001 | 3D wall placement can still read as directionally wrong in front/elevation-like camera poses (preview vector vs committed wall interpretation). | `Viewport.tsx` direct wall draft projection + overlay guards | P0       | Done   |

### WP-NEXT-28 — 3D Wall Direction Fidelity In Edge-On Poses

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT10-GAP-001`
- Goal: remove ambiguous 3D wall commits in edge-on views and keep draft direction fidelity explicit before commit.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/authoring3d.ts`
  - `packages/web/src/viewport/authoring3d.test.ts`
  - `packages/web/tmp/ux-wall-edgeon-repro-20260513/capture.mjs`
  - `packages/web/tmp/ux-wall-debug-pipeline-20260513/capture.mjs`
- Acceptance:
  - wall commit endpoint always uses active click projection (no stale hover endpoint reuse),
  - edge-on/unstable level-plane projection blocks commit with explicit placement guidance instead of committing ambiguous geometry,
  - wall preview must be screen-readable before commit (non-collapsed outline + direction),
  - seeded front/elevation repro no longer yields misleading commit behavior.
- Implementation + evidence:
  - Endpoint fidelity path changed to commit line tools from direct click projection (`end = projected.point`) so commit cannot reuse stale hover point.
  - Added projection stability guard (`mm/px` sensitivity only) for non-wall plane-based 3D tools before accepting clicks; the earlier camera-component threshold was removed because it blocked valid wall drafting in normal 3D/elevation-like views.
  - Replaced wall end-point re-projection with a first-click screen-to-level draft basis. Preview and commit now use the same basis.
  - Hardened that basis for perspective/elevation views: wall screen-X maps to horizontal camera-right, screen-Y only contributes when camera-up has a meaningful horizontal component, and mm-per-pixel is capped to prevent small drags creating giant walls.
  - Replaced flat footprint wall preview with a full-height projected wall-volume silhouette, so elevation-like views show the same visual form that will be committed.
  - Removed the generic 2D line from wall previews because it could imply a screen direction that the final full-height wall volume would not visually have.
  - Removed the wall-preview readability blocker because it blocked valid elevation-like placement instead of fixing endpoint fidelity.
  - Short wall attempts now clear the stored 3D line draft before returning to `pick-start`.
  - Added a gated 3D wall debug trace (`localStorage["bim.debug.3dWall"] = "true"`) that records camera pose, projection mode, screen points, draft basis, preview endpoint, and committed command into `window.__BIM_AI_3D_WALL_DEBUG__`.
  - Added wall draft projection classification:
    - readable top/plan-like poses use exact ray-to-level-plane projection, so cursor and committed footprint stay geometrically aligned;
    - front/elevation-like anisotropic poses switch to `elevation-axis` mode, cap horizontal drafting scale, ignore unstable screen-Y depth, and show explicit HUD guidance.
  - Seeded repro artifacts:
    - `packages/web/tmp/ux-wall-edgeon-repro-20260513/01-before-commit.png`
    - `packages/web/tmp/ux-wall-edgeon-repro-20260513/02-after-commit-attempt.png`
    - `packages/web/tmp/ux-wall-edgeon-repro-20260513/summary.json`
    - 2026-05-13 hotfix rerun confirms wall drafting is reachable again (`createWallCount: 1`).
    - 2026-05-13 perspective/elevation-basis rerun confirms wall drafting remains reachable (`createWallCount: 1`), the pre-commit wall-volume preview is visible (`wallVolumePreviewVisible: true`), and the sampled 249 px drag creates a bounded 5517 mm wall instead of an oversized perspective-projection slab.
    - 2026-05-13 exact `Front elevation` debug rerun:
      - `packages/web/tmp/ux-wall-debug-pipeline-20260513/01-front-elevation-preview.png`
      - `packages/web/tmp/ux-wall-debug-pipeline-20260513/02-front-elevation-after-commit.png`
      - `packages/web/tmp/ux-wall-debug-pipeline-20260513/summary.json`
      - `projectionModes: ["elevation-axis"]`
      - `firstTrace.projection.anisotropyRatio: 5.283`
      - `firstTrace.projection.verticalLook: 0.260`
      - `createWallCount: 1`
      - same drag now commits a 7174 mm horizontal-axis wall instead of the prior 12375 mm screenY-depth wall.
    - 2026-05-13 oblique/top-readable control rerun:
      - `packages/web/tmp/ux-wall-debug-oblique-20260513/01-oblique-preview.png`
      - `packages/web/tmp/ux-wall-debug-oblique-20260513/02-oblique-after.png`
      - `packages/web/tmp/ux-wall-debug-oblique-20260513/summary.json`
      - `projectionModes: ["plane"]`
      - `createWallCount: 1`
    - 2026-05-13 closure rerun with deterministic plane-readable authoring:
      - `packages/web/tmp/ux-wall-debug-input-20260513/01-front-elevation-wall-blocked.png`
      - `packages/web/tmp/ux-wall-debug-input-20260513/02-oblique-wall-preview.png`
      - `packages/web/tmp/ux-wall-debug-input-20260513/03-oblique-wall-commit.png`
      - `packages/web/tmp/ux-wall-debug-input-20260513/04-after-escape-navigation-drag.png`
      - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
      - `commandsAfterFront: 0`
      - `blockedUnreadablePlaneCount: 1`
      - `createWallCount: 1`
      - `projectionModes: ["elevation-axis", "plane"]`
  - Closure decision:
    - front/elevation wall authoring is intentionally blocked when the active level plane is not readable. Wall creation is allowed in oblique/top-readable 3D views using exact level-plane projection only.

## Reopened Tracker (2026-05-13, feedback round 11)

| Gap ID         | Problem Statement                                                                                                                              | Canonical Surfaces / Files                                                    | Priority | Status |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------- | ------ |
| NEXT11-GAP-001 | 3D wall debug trace was invisible in DevTools console unless inspecting globals/custom events manually.                                        | `Viewport.tsx` debug trace, wall debug Playwright capture                     | P0       | Done   |
| NEXT11-GAP-002 | Direct 3D wall left-drag could be captured as authoring input but produce no wall, leaving the interaction feeling cursor-trapped.             | `Viewport.tsx` direct 3D pointer lifecycle, wall debug Playwright capture     | P0       | Done   |
| NEXT11-GAP-003 | Wall debug screenshots could silently run on the default seed when multiple seeded models existed.                                             | `packages/web/tmp/ux-wall-debug-*/capture.mjs`, seeded project selector usage | P0       | Done   |
| NEXT11-GAP-004 | In front/elevation-like 3D views, wall starts used unstable level-plane/elevation-axis projections that could look plausible but commit wrong. | `Viewport.tsx` 3D wall projection gating and exact plane-readable authoring   | P0       | Done   |
| NEXT11-GAP-005 | Empty-sky or unreadable-plane wall clicks in 3D could silently no-op or appear to accept input without reliable geometry.                      | `Viewport.tsx` wall blocked-state overlay, pointer down/up draft lifecycle    | P0       | Done   |

### WP-NEXT-29 — 3D Wall Debug Visibility + Drag Input Recovery

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT11-GAP-001`, `NEXT11-GAP-002`, `NEXT11-GAP-003`, `NEXT11-GAP-004`, `NEXT11-GAP-005`
- Goal: make the wall debug path observable in the browser console, remove the no-op direct-drag trap in 3D wall authoring, and prevent front/elevation-like views from committing synthetic wall geometry.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-wall-debug-pipeline-20260513/capture.mjs`
  - `packages/web/tmp/ux-wall-debug-input-20260513/capture.mjs`
- Acceptance:
  - in local dev, or when `localStorage["bim.debug.3dWall"] = "true"`, wall debug records appear as browser console entries and remain available in `window.__BIM_AI_3D_WALL_DEBUG__`;
  - direct 3D line tools, including `Wall`, support press-drag-release as a real draft gesture instead of swallowing the drag;
  - front/elevation-style wall placement is blocked when the active level plane is not readable;
  - top/oblique 3D placement uses exact ray-to-level-plane projection for both preview and commit;
  - pointer cancel / lost capture clears transient drag state so navigation is not left stuck;
  - seeded UI proof explicitly selects `target-house-3` before validating.
- Implementation + evidence:
  - `emitWallDebug` now writes compact JSON `[bim:3d-wall]` console info entries in local dev / explicit debug mode in addition to global trace storage and custom events, so DevTools shows actual coordinates instead of only collapsed object previews.
  - Direct 3D line tools seed the start point on pointer-down, update preview during drag, and commit on pointer-up when the drag exceeds threshold.
  - Wall start in `elevation-axis` projection now emits `wall-blocked-unreadable-plane`, keeps the tool in `pick-start`, and shows an explicit rotate/open-plan instruction instead of committing synthetic geometry.
  - Wall starts in `plane` projection use exact level-plane raycasting for start, preview, and commit.
  - Pointer-up now suppresses duplicate blocked attempts when pointer-down already consumed a direct line-tool click.
  - Added pointer-cancel and lost-pointer-capture cleanup for tool draft and grip drag state.
  - Updated wall debug capture scripts to select `Seed Library / target-house-3` explicitly through the project selector.
  - Seeded proof (`make seed name=target-house-3`, `make dev name=target-house-3`):
    - `packages/web/tmp/ux-wall-debug-input-20260513/01-front-elevation-wall-blocked.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/02-oblique-wall-preview.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/03-oblique-wall-commit.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/04-after-escape-navigation-drag.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
      - `commandsAfterFront: 0`
      - `createWallCount: 1`
      - `projectionModes: ["elevation-axis", "plane"]`
      - `blockedUnreadablePlaneCount: 1`
      - `wallLengthsMm: [5819.760]`
    - `packages/web/tmp/ux-wall-debug-pipeline-20260513/01-front-elevation-preview.png`
    - `packages/web/tmp/ux-wall-debug-pipeline-20260513/02-front-elevation-after-commit.png`
    - `packages/web/tmp/ux-wall-debug-pipeline-20260513/summary.json`
      - `createWallCount: 1`
      - `projectionModes: ["elevation-axis"]`
      - `firstTrace.anchor.elementId: "hf-roof-main"`
      - committed wall start matches the visible roof anchor, not the old far `planePoint`.

## Reopened Tracker (2026-05-13, feedback round 12)

| Gap ID         | Problem Statement                                                                                                                  | Canonical Surfaces / Files                                                   | Priority | Status |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | ------ |
| NEXT12-GAP-001 | Front/elevation-like 3D wall authoring kept accepting or previewing ambiguous gestures that did not map reliably to plan geometry. | `Viewport.tsx` 3D wall start logic, wall debug input Playwright capture      | P0       | Done   |
| NEXT12-GAP-002 | Wall evidence needed to prove both rejection of unreadable views and successful authoring in a readable 3D view.                   | `packages/web/tmp/ux-wall-debug-input-20260513/capture.mjs`, tracker summary | P0       | Done   |

### WP-NEXT-30 — Plane-Readable 3D Wall Authoring

- Priority: `P0`
- Status: `Done`
- Superseded correction: feedback round 13 rejected the blanket front/elevation blocking behavior. See `WP-NEXT-31` for the current canonical behavior: stable visible level planes create exact 3D walls even from shallow front-like camera poses.
- Covers: `NEXT12-GAP-001`, `NEXT12-GAP-002`
- Goal: make 3D wall authoring deterministic by allowing commits only when the active level plane is readable from the current camera.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-wall-debug-input-20260513/capture.mjs`
  - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
- Acceptance:
  - front/elevation-like 3D wall gestures produce no wall command and show rotate/open-plan guidance;
  - oblique/top-readable 3D views create walls with exact level-plane projection;
  - preview and committed wall share the same projection mode and endpoint source;
  - seeded evidence proves rejection first, then one successful wall command.
- Implementation + evidence:
  - Removed synthetic `elevation-axis` wall commits from the authoring path.
  - `wall-blocked-unreadable-plane` now handles edge-on/front views explicitly.
  - Superseded seeded proof: the blocked-front artifact set from this package was removed after feedback round 13. Current canonical wall-placement evidence is recorded under `WP-NEXT-31`.

## Reopened Tracker (2026-05-13, feedback round 13)

| Gap ID         | Problem Statement                                                                                                                                               | Canonical Surfaces / Files                                                   | Priority | Status |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | ------ |
| NEXT13-GAP-001 | The wall tool over-treated shallow/front-like 3D views as unreadable even when the level plane grid was numerically stable and visible.                         | `packages/web/src/viewport/authoring3d.ts`, `Viewport.tsx` 3D wall authoring | P0       | Done   |
| NEXT13-GAP-002 | Synthetic `elevation-axis` placement was used too often, so wall footprints could feel detached from the cursor path and appear to land in the wrong direction. | `Viewport.tsx` wall basis selection, wall debug Playwright capture           | P0       | Done   |
| NEXT13-GAP-003 | Evidence still encoded the old blocked-front behavior instead of proving exact front/elevation placement and oblique placement in the seeded app.               | `packages/web/tmp/ux-wall-debug-input-20260513/*`, tracker evidence          | P0       | Done   |

### WP-NEXT-31 — Exact 3D Wall Plane Priority

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT13-GAP-001`, `NEXT13-GAP-002`, `NEXT13-GAP-003`
- Goal: restore trustworthy 3D wall authoring by using exact ray-to-level-plane placement whenever the active level plane is numerically stable, including shallow/front-like seeded 3D views.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/authoring3d.ts`
  - `packages/web/src/viewport/authoring3d.test.ts`
  - `packages/web/tmp/ux-wall-debug-input-20260513/capture.mjs`
  - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
- Acceptance:
  - stable visible 3D level-plane hits use exact ray-to-level-plane projection, not synthetic screen-axis placement, regardless of shallow camera angle;
  - the seeded `Front elevation` wall drag creates one wall with `projection.mode === "plane"`;
  - the seeded `Roof court high axonometric` wall drag creates one additional wall with `projection.mode === "plane"`;
  - preview and commit share the same projection path and endpoint source;
  - blocked wall-start counts are zero for the seeded front + oblique proof;
  - Escape after wall placement restores navigation drag.
- Implementation + evidence:
  - Removed the hard `verticalLook >= 0.35` requirement from wall draft projection classification. Plane readability is now determined by measured level-plane screen scale and anisotropy.
  - Kept constrained `elevation-axis` as a fallback only for genuinely unstable/unreadable projections instead of using it for stable front-like views.
  - Replaced stale blocked-front evidence with exact-placement proof:
    - `packages/web/tmp/ux-wall-debug-input-20260513/01-front-elevation-exact-preview.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/02-front-elevation-exact-commit.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/03-oblique-wall-preview.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/04-oblique-wall-commit.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/05-after-escape-navigation-drag.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
      - `commandsAfterFront: 1`
      - `createWallCount: 2`
      - `projectionModes: ["plane"]`
      - `frontProjectionModes: ["plane"]`
      - `blockedUnreadablePlaneCount: 0`
      - `blockedNoDraftPlaneCount: 0`
      - `wallLengthsMm: [4038.741, 5819.760]`

## Reopened Tracker (2026-05-14, feedback round 14)

| Gap ID         | Problem Statement                                                                                                                                            | Canonical Surfaces / Files                                                           | Priority | Status |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------- | ------ |
| NEXT14-GAP-001 | 3D wall placement could still feel like it flipped because the preview only showed the projected wall volume, not the exact cursor path and cursor endpoint. | `packages/web/src/Viewport.tsx` 3D wall overlay                                      | P0       | Done   |
| NEXT14-GAP-002 | Wall debug logs exposed model-coordinate deltas but not screen-coordinate deltas, making valid camera projection sign changes look like placement reversals. | `Viewport.tsx` 3D wall debug trace                                                   | P0       | Done   |
| NEXT14-GAP-003 | Left-edge/shallow-view wall repro evidence needed to prove both constrained and exact modes remain visible and command-producing after the UX correction.    | `packages/web/tmp/ux-wall-plane-fidelity-20260514/*`, wall debug input capture proof | P0       | Done   |

### WP-NEXT-32 — 3D Wall Cursor Direction Legibility

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT14-GAP-001`, `NEXT14-GAP-002`, `NEXT14-GAP-003`
- Goal: make 3D wall placement direction unambiguous in shallow/perspective views by showing the cursor path separately from the projected wall volume and logging both screen and model deltas.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-wall-debug-input-20260513/capture.mjs`
  - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
  - `packages/web/tmp/ux-wall-plane-fidelity-20260514/capture.mjs`
  - `packages/web/tmp/ux-wall-plane-fidelity-20260514/summary.json`
- Acceptance:
  - wall preview always renders an explicit cursor path from the picked start to the current cursor point;
  - wall preview always renders an explicit cursor endpoint handle;
  - exact `plane` placement still creates front/elevation and oblique walls in the seeded app;
  - left-edge shallow 3D repro proves both constrained and exact modes still show the cursor path/end affordances;
  - debug logs include `screenDelta` and `modelDelta` so camera-dependent model-axis sign changes are diagnosable.
- Implementation + evidence:
  - Added a dashed `wall-cursor-path` overlay for wall placement, distinct from the solid wall-volume preview.
  - Added a `wall-cursor-end` endpoint ring so the current cursor target is always visible before commit.
  - Added `screenDelta` and `modelDelta` to wall preview/commit debug records and compact console output.
  - Seeded exact-placement proof (`target-house-3`):
    - `packages/web/tmp/ux-wall-debug-input-20260513/01-front-elevation-exact-preview.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/02-front-elevation-exact-commit.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/03-oblique-wall-preview.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/04-oblique-wall-commit.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/05-after-escape-navigation-drag.png`
    - `packages/web/tmp/ux-wall-debug-input-20260513/summary.json`
      - `createWallCount: 2`
      - `projectionModes: ["plane"]`
      - `frontCursorPathVisible: true`
      - `frontCursorEndVisible: true`
      - `obliqueCursorPathVisible: true`
      - `obliqueCursorEndVisible: true`
  - Seeded left-edge/shallow-view proof:
    - `packages/web/tmp/ux-wall-plane-fidelity-20260514/01-left-edge-diagonal-preview.png`
    - `packages/web/tmp/ux-wall-plane-fidelity-20260514/01-left-edge-diagonal-commit.png`
    - `packages/web/tmp/ux-wall-plane-fidelity-20260514/02-left-edge-steep-preview.png`
    - `packages/web/tmp/ux-wall-plane-fidelity-20260514/02-left-edge-steep-commit.png`
    - `packages/web/tmp/ux-wall-plane-fidelity-20260514/summary.json`
      - `createWallCount: 2`
      - `projectionModes: ["elevation-axis", "plane"]`
      - `previewChecks[*].cursorPathVisible: true`
      - `previewChecks[*].cursorEndVisible: true`

## Reopened Tracker (2026-05-14, feedback round 15)

| Gap ID         | Problem Statement                                                                                                                                          | Canonical Surfaces / Files                                                                | Priority | Status  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- | ------- |
| NEXT15-GAP-001 | Exact ray-to-level-plane wall placement is still UX-hostile in shallow/front 3D views: a rightward screen gesture can map to negative model-axis movement. | `packages/web/src/viewport/authoring3d.ts`, `packages/web/src/Viewport.tsx` wall draft UX | P0       | Blocked |
| NEXT15-GAP-002 | ViewCube/manual camera pose updates could leave camera matrices stale for immediate authoring raycasts.                                                    | `Viewport.tsx`, `packages/web/src/viewport/cameraMatrixSync.ts`                           | P0       | Done    |
| NEXT15-GAP-003 | Seeded proof needed to cover both no-rotation and post-ViewCube-rotation wall placement with command responses, not just outgoing commands.                | `packages/web/tmp/ux-wall-post-viewcube-20260514/*`, tracker evidence                     | P0       | Blocked |

### WP-NEXT-33 — Shallow 3D Wall Screen-Axis Canonicalization

- Priority: `P0`
- Status: `Blocked`
- Blocked note: follow-up seeded/user validation rejected this screen-axis canonicalization. Do not use the `elevation-axis` command path as canonical wall placement; see `WP-NEXT-34`.
- Supersedes correction: `WP-NEXT-31` over-prioritized exact plane placement in shallow/front views. Current canonical behavior is:
  - top/plan-like readable 3D views use exact ray-to-level-plane placement;
  - shallow/front/elevation-like 3D views use constrained screen-axis wall placement after the first exact start point;
  - all camera pose updates force current camera matrices before authoring raycasts.
- Covers: `NEXT15-GAP-001`, `NEXT15-GAP-002`, `NEXT15-GAP-003`
- Goal: make wall placement direction match the visible screen gesture in shallow/front 3D views while keeping exact placement in genuinely top/plan-like 3D views.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/authoring3d.ts`
  - `packages/web/src/viewport/authoring3d.test.ts`
  - `packages/web/src/viewport/cameraMatrixSync.ts`
  - `packages/web/src/viewport/cameraMatrixSync.test.ts`
  - `packages/web/tmp/ux-wall-post-viewcube-20260514/capture.mjs`
  - `packages/web/tmp/ux-wall-post-viewcube-20260514/summary.json`
- Acceptance:
  - shallow/front 3D wall placement no longer enters `projection.mode === "plane"` merely because the numeric level-plane sample is stable;
  - top/plan-like readable 3D placement remains exact `plane`;
  - ViewCube pick/drag camera updates sync both perspective and orthographic cameras before any subsequent authoring raycast;
  - every raycast/projection input path used by authoring, picking, hosted inserts, grips, context menus, and cursor zoom forces current camera matrices first;
  - seeded proof creates walls before and after ViewCube rotation with `200 OK` command responses;
  - seeded proof shows visible wall preview and endpoint affordance before commit.
- Implementation + evidence:
  - `classifyWallDraftProjection` now requires `verticalLook >= 0.45` before returning exact `plane`, so front/elevation-like views use constrained screen-axis drafting even when local plane samples are numerically stable.
  - Added `cameraMatrixSync` helpers and tests so orbit, fit/reset, auto-fit, ViewCube pick, and ViewCube drag all apply camera poses with `updateMatrixWorld(true)`.
  - Added matrix sync before all camera-dependent raycast/projection input paths in `Viewport`.
  - Updated `authoring3d` regression tests to assert the new shallow/front canonical behavior.
  - Seeded proof (`make seed name=target-house-3`, `make dev name=target-house-3`):
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/01-front-elevation-before-cube.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/02-front-no-cube-empty-grid-preview.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/02-front-no-cube-empty-grid-commit.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/03-after-viewcube-axis-rotate.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/04-post-viewcube-empty-grid-preview.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/04-post-viewcube-empty-grid-commit.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/06-after-escape-navigation-drag.png`
    - `packages/web/tmp/ux-wall-post-viewcube-20260514/summary.json`
      - `createWallCount: 2`
      - `commandResponses: [{ status: 200 }, { status: 200 }]`
      - `projectionModes: ["elevation-axis"]`
      - `nonConstrainedWallCount: 0`
      - `blockedPhases: []`
      - `previewChecks[*].cursorPathRendered: true`
      - `previewChecks[*].cursorEndVisible: true`
      - `consoleWarnings: []`

## Reopened Tracker (2026-05-14, feedback round 16)

| Gap ID         | Problem Statement                                                                                                                                                    | Canonical Surfaces / Files                                                                     | Priority | Status |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT16-GAP-001 | The screen-axis fallback made 3D walls feel detached from the actual model work plane after rotation and did not solve the reported placement reversals.             | `packages/web/src/viewport/authoring3d.ts`, `packages/web/src/Viewport.tsx` wall draft path    | P0       | Done   |
| NEXT16-GAP-002 | 3D wall starts could still be accepted through visible model geometry, so the wall appeared to be authored somewhere different from the clicked building/sky region. | `Viewport.tsx` visible draft-plane hit testing                                                 | P0       | Done   |
| NEXT16-GAP-003 | Seeded proof must show exact work-plane placement before and after ViewCube rotation, plus a blocked hidden-work-plane click that creates no command.                | `packages/web/tmp/ux-wall-visible-workplane-20260514/*`, `authoring3d.test.ts`, seeded browser | P0       | Done   |

### WP-NEXT-34 — 3D Wall Visible Work-Plane Placement

- Priority: `P0`
- Status: `Done`
- Supersedes: blocked `WP-NEXT-33` screen-axis canonicalization.
- Covers: `NEXT16-GAP-001`, `NEXT16-GAP-002`, `NEXT16-GAP-003`
- Goal: make 3D wall placement deterministic by committing only exact visible active-level work-plane hits; if the cursor is over hidden/occluded geometry or an unreadable edge-on plane, the tool blocks instead of synthesizing a wall elsewhere.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/authoring3d.ts`
  - `packages/web/src/viewport/authoring3d.test.ts`
  - `packages/web/tmp/ux-wall-visible-workplane-20260514/capture.mjs`
  - `packages/web/tmp/ux-wall-visible-workplane-20260514/summary.json`
- Acceptance:
  - readable 3D wall placement uses `projection.mode === "plane"` before and after ViewCube rotation;
  - synthetic `elevation-axis` walls are not committed in the seeded proof;
  - a click whose level-plane hit is hidden behind model geometry is blocked and creates no command;
  - wall preview still shows the wall volume, cursor path, and endpoint before commit;
  - Escape after wall placement restores navigation drag;
  - seeded proof records `200 OK` command responses for all committed walls.
- Implementation + evidence:
  - Removed the `verticalLook >= 0.45` requirement from exact-plane wall placement; readability is again based on measured screen scale and anisotropy.
  - Increased the anisotropy tolerance to `4.25` so moderately skewed post-ViewCube poses still use exact work-plane placement.
  - Added visible-work-plane hit testing: wall authoring now raycasts model geometry before the active level plane and blocks placement when a wall/roof/model element is closer than the work plane.
  - Added `wallPlaneOccluded` overlay messaging so the user gets a direct explanation instead of an invisible or detached wall.
  - Added `isDraftPlaneHitOccluded` unit coverage.
  - Seeded proof (`make seed name=target-house-3`, `make dev name=target-house-3`):
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/01-front-elevation-initial.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/02-visible-grid-exact-preview-preview.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/02-visible-grid-exact-preview-commit.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/03-hidden-plane-blocked-on-building.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/04-after-viewcube-axis-rotate.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/05-visible-grid-after-viewcube-preview.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/05-visible-grid-after-viewcube-commit.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/06-after-escape-navigation-drag.png`
    - `packages/web/tmp/ux-wall-visible-workplane-20260514/summary.json`
      - `createWallCount: 2`
      - `commandResponses: [{ status: 200 }, { status: 200 }]`
      - `projectionModes: ["plane"]`
      - `nonPlaneWallCount: 0`
      - `blockedChecks[0].noCommandCreated: true`
      - `blockedPhases[0].phase: "wall-blocked-hidden-work-plane"`
      - `previewChecks[*].cursorPathRendered: true`
      - `previewChecks[*].cursorEndVisible: true`
      - `consoleWarnings: []`

## Reopened Tracker (2026-05-14, feedback round 17)

| Gap ID         | Problem Statement                                                                                                                                                                   | Canonical Surfaces / Files                                                                                                       | Priority | Status |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT17-GAP-001 | 3D wall placement still used an SVG/projected wall-volume preview, so the pre-commit affordance could look like a broad detached sheet while the committed wall was a real 3D slab. | `packages/web/src/Viewport.tsx` 3D wall preview path                                                                             | P0       | Done   |
| NEXT17-GAP-002 | 3D `createWall` commands sent `locationLine`, but the engine did not persist it into `WallElem`, leaving preview/commit semantics vulnerable to drift.                              | `app/bim_ai/commands.py`, `app/bim_ai/elements.py`, `app/bim_ai/engine_dispatch_core.py`, `app/tests/test_engine_constraints.py` | P0       | Done   |
| NEXT17-GAP-003 | Seeded 3D wall proof must be run from a reset seed model; otherwise repeated browser captures can fail with wall-overlap conflicts from previous evidence walls.                    | `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/*`                                                                     | P0       | Done   |

### WP-NEXT-35 — 3D Wall Mesh Preview Parity

- Priority: `P0`
- Status: `Done`
- Supersedes/extends: `WP-NEXT-34` remains the visible work-plane placement fix; this package closes the separate preview/commit parity regression exposed by follow-up visual QA.
- Covers: `NEXT17-GAP-001`, `NEXT17-GAP-002`, `NEXT17-GAP-003`
- Goal: make the 3D wall preview use the same 3D mesh path and persisted command semantics as the committed wall, so the seeded user sees one continuous preview-to-commit workflow.
- Source ownership:
  - `packages/web/src/Viewport.tsx`
  - `app/bim_ai/commands.py`
  - `app/bim_ai/elements.py`
  - `app/bim_ai/engine_dispatch_core.py`
  - `app/tests/test_engine_constraints.py`
  - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/capture.mjs`
  - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/summary.json`
- Acceptance:
  - legacy SVG wall-volume preview path is removed for 3D wall placement;
  - wall preview is a real `makeWallMesh` ghost generated from the same start/end, level, wall type, height, and location-line values used by the commit command;
  - preview ghost is non-pickable and clears when switching tools, cancelling, blocking the work plane, or committing;
  - backend command schema persists `locationLine` on created wall elements;
  - seeded browser proof creates 3D walls before and after ViewCube rotation with `200 OK` responses;
  - seeded proof shows `previewMesh: true` on preview traces and no console warnings/errors.
- Implementation + evidence:
  - Replaced the 3D wall SVG polygon/arrow preview with a transient Three.js wall preview object built through `makeWallMesh`.
  - Added explicit preview cleanup on tool switches, blocked/hidden work-plane states, short segment reset, Escape, pointer cancel, unmount, and commit.
  - Kept the cursor path/endpoint overlay for screen-legibility while the actual wall body is now a real 3D ghost.
  - Added `locationLine` to `CreateWallCmd` and `WallElem`, and dispatch now copies it into newly created walls.
  - Added engine regression coverage proving `createWall.locationLine` persists and serializes by alias.
  - Seeded proof (`make seed name=target-house-3`, `make dev name=target-house-3`, reset with `make seed-clear && make seed name=target-house-3` before final capture):
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/01-front-elevation-initial.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/02-front-grid-mesh-preview-preview.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/02-front-grid-mesh-preview-commit.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/03-after-viewcube-rotate.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/04-rotated-grid-mesh-preview-preview.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/04-rotated-grid-mesh-preview-commit.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/05-after-escape-navigation-drag.png`
    - `packages/web/tmp/ux-wall-3d-mesh-preview-parity-20260514/summary.json`
      - `createWallCount: 2`
      - `commandResponses: [{ status: 200 }, { status: 200 }]`
      - `projectionModes: ["plane"]`
      - `previewMeshCount: 52`
      - `commitCount: 2`
      - `consoleWarnings: []`

## Reopened Tracker (2026-05-14, feedback round 18)

| Gap ID         | Problem Statement                                                                                                                                                              | Canonical Surfaces / Files                                                                                                            | Priority | Status |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT18-GAP-001 | Diagonal 3D walls could still commit as mirrored/off-line slabs because wall mesh yaw used the wrong Three.js Y-rotation sign for semantic plan +Y/world +Z mapping.           | `packages/web/src/viewport/meshBuilders.ts`, `packages/web/src/viewport/meshBuilders.layeredWall.ts`, `packages/web/src/Viewport.tsx` | P0       | Done   |
| NEXT18-GAP-002 | CSG-cut walls and typed/layered wall previews needed the same segment-orientation contract as regular walls so preview, commit, and aperture rendering do not diverge.         | `Viewport.tsx` CSG request yaw, layered/sloped/recessed/curtain wall builders, orientation unit tests                                 | P0       | Done   |
| NEXT18-GAP-003 | Seeded evidence needed a clean diagonal 3D wall case proving the visible authored path, mesh preview, and committed wall body agree in the real app after the orientation fix. | `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/*`                                                                              | P0       | Done   |

### WP-NEXT-36 — 3D Wall Segment Orientation Fidelity

- Priority: `P0`
- Status: `Done`
- Supersedes/extends: `WP-NEXT-35` mesh preview parity remains valid; this package fixes the root diagonal-yaw bug that made preview/commit geometry look detached from the blue authored line.
- Covers: `NEXT18-GAP-001`, `NEXT18-GAP-002`, `NEXT18-GAP-003`
- Goal: make every linear 3D wall body use the same canonical plan-segment orientation as the authored start/end line, including layered walls and CSG-cut wall rebuilds.
- Source ownership:
  - `packages/web/src/viewport/planSegmentOrientation.ts`
  - `packages/web/src/viewport/planSegmentOrientation.test.ts`
  - `packages/web/src/viewport/meshBuilders.ts`
  - `packages/web/src/viewport/meshBuilders.layeredWall.ts`
  - `packages/web/src/viewport/meshBuilders.locationLine.test.ts`
  - `packages/web/src/viewport/meshBuilders.layeredWall.test.ts`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/capture.mjs`
  - `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/summary.json`
- Acceptance:
  - diagonal wall mesh local +X maps to authored start-to-end vector, not the mirrored vector;
  - layered wall mesh local +X maps to the authored start-to-end vector;
  - sloped, recessed, curtain, balcony-attached, beam, and CSG wall paths use the same shared orientation helper where they depend on segment yaw;
  - seeded browser proof shows a diagonal 3D wall preview with visible cursor path/end and `previewMesh: true` traces;
  - seeded browser proof commits exactly one diagonal wall with `200 OK`, `projectionMode: "plane"`, and no console errors;
  - seed model is reset after evidence capture so local validation starts from canonical `target-house-3` again.
- Implementation + evidence:
  - Added `yawForPlanSegment(dx, dz)` documenting the Three.js Y-rotation sign convention for BIM plan +Y/world +Z mapping.
  - Added `localPlanOffsetToWorld` for recessed wall segment positioning so local offsets and mesh rotation use one transform convention.
  - Replaced the old `Math.atan2(dz, dx)` wall yaw in plain, layered, sloped, recessed, curtain, balcony-attached, beam, and CSG wall paths with the shared helper.
  - Added regression tests proving diagonal plain and layered walls align local +X with `(dx, dz)` and local +Z with the left normal.
  - Seeded proof (`make seed-clear && make seed name=target-house-3`, `make dev name=target-house-3`, reset again after capture):
    - `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/01-rear-axo-initial.png`
    - `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/02-diagonal-wall-preview.png`
    - `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/03-diagonal-wall-commit.png`
    - `packages/web/tmp/ux-wall-3d-yaw-fidelity-20260514-v2/summary.json`
      - `health: { ok: true, status: 200 }`
      - `createWallCount: 1`
      - `commandResponses: [{ status: 200, ok: true }]`
      - `previewMeshCount: 58`
      - `commitCount: 1`
      - `cursorPathVisible: true`
      - `cursorEndVisible: true`
      - `projectionMode: "plane"`
      - `consoleErrors: []`

## Reopened Tracker (2026-05-14, feedback round 19)

| Gap ID         | Problem Statement                                                                                                                                                                   | Canonical Surfaces / Files                                                                                                      | Priority | Status |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT19-GAP-001 | 3D hosted door/window placement still felt like a refresh because semantic commands hydrated the full returned model snapshot instead of applying the returned delta incrementally. | `packages/web/src/workspace/Workspace.tsx`, `packages/web/src/workspace/useWorkspaceSnapshot.ts`, `packages/web/src/lib/api.ts` | P0       | Done   |
| NEXT19-GAP-002 | The 3D hosted placement click selected the host wall, opening the element inspector and changing the canvas layout while the user was still in a placement command.                 | `packages/web/src/Viewport.tsx` hosted placement path                                                                           | P0       | Done   |
| NEXT19-GAP-003 | Seeded proof needed to cover wall + door + window placement through the actual 3D ribbon without main-frame navigation, canvas-width jumps, or selection-sidebar takeover.          | `packages/web/tmp/ux-host-placement-no-refresh-20260514/*`, seeded browser                                                      | P0       | Done   |

### WP-NEXT-37 — 3D Hosted Placement No-Refresh Flow

- Priority: `P0`
- Status: `Done`
- Supersedes/extends: `WP-NEXT-36` segment orientation remains valid; this package closes the follow-up UX regression where hosted placement worked geometrically but still disrupted the active 3D work surface.
- Covers: `NEXT19-GAP-001`, `NEXT19-GAP-002`, `NEXT19-GAP-003`
- Goal: make 3D wall, door, and window authoring stay in the same active 3D canvas without full snapshot rebuilds, right-sidebar selection takeover, or page/frame navigation.
- Source ownership:
  - `packages/web/src/lib/api.ts`
  - `packages/web/src/workspace/useWorkspaceSnapshot.ts`
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/src/workspace/Workspace.semanticCommand.test.tsx`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-host-placement-no-refresh-20260514/summary.json`
- Acceptance:
  - semantic command responses with `delta` use `applyDelta` instead of full `hydrateFromSnapshot`;
  - local websocket echo deltas with the same `clientOpId` are ignored to avoid duplicate UI churn;
  - 3D door/window placement does not select the host wall or open the selected-element inspector while the tool remains active;
  - seeded browser proof emits `createWall`, `insertDoorOnWall`, and `insertWindowOnWall` on `target-house-3`;
  - seeded proof records no main-frame navigation, stable canvas bounds after each placement, no selected-element actions takeover, and no console errors.
- Implementation + evidence:
  - Typed `ApplyCommandResp.delta` as `ModelDelta` and generated a `clientOpId` per local semantic command.
  - Registered local client ops in `useWorkspaceSnapshot` and consumed matching websocket echo deltas before applying remote updates.
  - Applied the command response delta locally so unchanged elements keep their object identity and the 3D viewport rebuilds only dirty meshes.
  - Removed automatic host-wall selection from 3D hosted placement clicks so Door/Window can continue without shifting the canvas/sidebar contract.
  - Added regression coverage proving response deltas preserve unchanged element references.
  - Seeded proof (`make seed-clear && make seed name=target-house-3`, `make dev name=target-house-3`, reset again after capture):
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/00-initial-3d.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/01-wall-preview.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/02-wall-committed.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/03-door-preview.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/04-door-placed-no-refresh.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/05-window-preview.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/06-window-placed-no-refresh.png`
    - `packages/web/tmp/ux-host-placement-no-refresh-20260514/summary.json`
      - `commandTypes: ["createWall", "insertDoorOnWall", "insertWindowOnWall"]`
      - `commandModelIds: ["9bb9a145-d9ce-5a2f-a748-bb5be3301b30", "9bb9a145-d9ce-5a2f-a748-bb5be3301b30", "9bb9a145-d9ce-5a2f-a748-bb5be3301b30"]`
      - `mainFrameNavigations: 0`
      - `canvasBoxStable: true`
      - `selectedElementActionsVisible: false`
      - `consoleErrors: []`

## Reopened Tracker (2026-05-14, feedback round 20)

| Gap ID         | Problem Statement                                                                                                                                                               | Canonical Surfaces / Files                                                                                                             | Priority | Status |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| NEXT20-GAP-001 | 3D hosted door/window meshes on diagonal walls used the opposite signed yaw from wall bodies and CSG cuts, so the placed family could look detached or rotated off the opening. | `packages/web/src/viewport/meshBuilders.ts`, `packages/web/src/viewport/meshBuilders.locationLine.test.ts`                             | P0       | Done   |
| NEXT20-GAP-002 | Door/window placement still produced a visual wall refresh because the dirty host wall was removed and replaced by a solid placeholder while the CSG worker recalculated cuts.  | `packages/web/src/Viewport.tsx`                                                                                                        | P0       | Done   |
| NEXT20-GAP-003 | Seeded proof needed to cover a diagonal 3D wall with hosted door and window through the actual 3D ribbon, including stable canvas bounds and no navigation/console regressions. | `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/*`, seeded browser at `http://127.0.0.1:2000/` + `http://127.0.0.1:8500/api/*` | P0       | Done   |

### WP-NEXT-38 — 3D Hosted Diagonal Alignment + No-Flicker CSG

- Priority: `P0`
- Status: `Done`
- Supersedes/extends: `WP-NEXT-37` no-refresh flow remains valid; this package closes the follow-up geometry defect visible on diagonal 3D-hosted door/window placement.
- Covers: `NEXT20-GAP-001`, `NEXT20-GAP-002`, `NEXT20-GAP-003`
- Goal: make hosted doors/windows on diagonal 3D walls align exactly with the wall body and the CSG cut, while preserving a stable active 3D canvas during the worker cut update.
- Source ownership:
  - `packages/web/src/viewport/meshBuilders.ts`
  - `packages/web/src/viewport/meshBuilders.locationLine.test.ts`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/summary.json`
- Acceptance:
  - hosted door/window mesh rotation uses the same signed wall yaw as wall meshes and CSG wall bodies;
  - hosted door/window mesh positions include the same single-body location-line offset as the wall body;
  - host wall geometry is retained while a replacement CSG wall cut is pending, preventing a solid-wall placeholder flicker;
  - seeded browser proof emits `createWall`, `insertDoorOnWall`, and `insertWindowOnWall` from the actual 3D ribbon on `target-house-3`;
  - seeded proof records both hosted elements on the newly drawn wall, no main-frame navigation, stable canvas bounds, no selected-element sidebar takeover, and no console errors.
- Implementation + evidence:
  - Replaced the old positive `wallYaw` with the shared `yawForPlanSegment` convention.
  - Added `wallPlanOffsetM` so standard-wall body, hosted mesh, and CSG wall body share the same location-line offset.
  - Retained the existing wall object during pending CSG work and swapped it only when the worker returns a successful cut mesh.
  - Added a diagonal hosted alignment regression that verifies door/window local axes and positions against the host wall.
  - Seeded proof (`make seed-clear && make seed name=target-house-3`, `make dev name=target-house-3`):
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/00-initial-3d.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/01-wall-preview.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/02-wall-committed.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/03-door-preview.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/04-door-placed.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/05-window-preview.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/06-window-placed.png`
    - `packages/web/tmp/ux-hosted-diagonal-alignment-20260514/summary.json`
      - `commandTypes: ["createWall", "insertDoorOnWall", "insertWindowOnWall"]`
      - hosted door/window `wallId` equals the new diagonal wall id
      - `mainFrameNavigations: 0`
      - `canvasStable: true`
      - `selectedElementActionsVisible: false`
      - `consoleErrors: []`

## Reopened Tracker (2026-05-14, feedback round 21)

| Gap ID         | Problem Statement                                                                                                                                                               | Canonical Surfaces / Files                                                                                                                       | Priority | Status |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| NEXT21-GAP-001 | Clicking a primary-browser 3D view could update the left/secondary context while the focused canvas stayed on the previous plan pane, making tab/view creation feel unreliable. | `packages/web/src/workspace/Workspace.tsx`, `packages/web/src/workspace/Workspace.test.tsx`                                                      | P0       | Done   |
| NEXT21-GAP-002 | 3D hosted Window/Door/Opening placement allowed occupied spans to look placeable, then failed only as a backend 409 with no in-canvas explanation.                              | `packages/web/src/Viewport.tsx`, `packages/web/src/viewport/directAuthoringGuards.ts`, `packages/web/src/viewport/directAuthoringGuards.test.ts` | P0       | Done   |
| NEXT21-GAP-003 | Load Family built-in door/window rows activated the hosted tool but lost the built-in family type id and dimensions when dispatching the 3D hosted command.                     | `packages/web/src/families/hostedFamilySelection.ts`, `packages/web/src/families/hostedFamilySelection.test.ts`, `packages/web/src/Viewport.tsx` | P0       | Done   |
| NEXT21-GAP-004 | Seeded proof needed to cover the exact user-facing failure: blocked occupied window placement, valid free-span placement, Load Family reachability, and no page refresh.        | `packages/web/tmp/ux-ribbon-hosted-placement-20260514/*`, seeded browser at `http://127.0.0.1:2000/` + API at `http://127.0.0.1:8500/api/*`      | P0       | Done   |
| NEXT21-GAP-005 | `Cmd/Ctrl+R` could fall through into the roof/tool hotkey path instead of staying reserved for browser refresh.                                                                 | `packages/web/src/workspace/Workspace.tsx`, `packages/web/src/workspace/Workspace.test.tsx`                                                      | P0       | Done   |

### WP-NEXT-39 — 3D Hosted Placement Feedback + Load Family Command Fidelity

- Priority: `P0`
- Status: `Done`
- Supersedes/extends: `WP-NEXT-38` hosted geometry alignment remains valid; this package closes the follow-up usability and family-selection defects reported during 3D window placement.
- Covers: `NEXT21-GAP-001`, `NEXT21-GAP-002`, `NEXT21-GAP-003`, `NEXT21-GAP-004`, `NEXT21-GAP-005`
- Goal: make 3D hosted placement explain invalid wall spans before commit, preserve reliable pane/tab activation, and keep Load Family selections attached to 3D hosted commands.
- Source ownership:
  - `packages/web/src/workspace/Workspace.tsx`
  - `packages/web/src/workspace/Workspace.test.tsx`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/directAuthoringGuards.ts`
  - `packages/web/src/viewport/directAuthoringGuards.test.ts`
  - `packages/web/src/families/hostedFamilySelection.ts`
  - `packages/web/src/families/hostedFamilySelection.test.ts`
  - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/summary.json`
- Acceptance:
  - primary-browser tab/view activation assigns the opened tab to the focused pane so metadata and mounted canvas stay in sync;
  - hovering/clicking an occupied wall span renders invalid red hosted preview feedback and does not dispatch an `insert*OnWall` command;
  - valid hosted placement remains blue and dispatches exactly one command;
  - Load Family built-in window/door rows preserve the selected built-in type id and dimensions on hosted commands;
  - `Cmd/Ctrl+R` remains browser-owned and does not activate `Roof` or any other ribbon tool;
  - seeded proof records no main-frame navigation/page refresh and no console errors.
- Implementation + evidence:
  - Changed `openTabFromElement` so primary-browser view activation opens and assigns the tab into the focused pane instead of only updating global tab state.
  - Added `findHostedOpeningConflict` to preflight proposed hosted spans against existing doors, windows, and generic wall openings on the same wall.
  - Extended the 3D hosted overlay with invalid reasons; occupied spans now render red with the message: “This wall span already contains a door/window/opening. Move along the wall.”
  - Added `resolveHostedFamilyPlacement` so built-in and project `family_type` selections resolve to the correct hosted family id, width, height, and sill before preview, conflict checking, and command dispatch.
  - Guarded global tool hotkeys so app-owned modified shortcuts are handled explicitly, then remaining `Meta`/`Ctrl`/`Alt` combinations return to the browser before tool hotkeys/chords.
  - Focused regression validation:
    - `pnpm --filter @bim-ai/web typecheck`
    - `pnpm --filter @bim-ai/web exec vitest run src/families/hostedFamilySelection.test.ts src/viewport/directAuthoringGuards.test.ts src/workspace/Workspace.test.tsx`
  - Seeded proof (`make seed name=target-house-3`, existing `make dev name=target-house-3` at `http://127.0.0.1:2000/`):
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/00-rear-axo-ready.png`
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/01-load-family-window-filter.png`
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/02-window-occupied-span-invalid-preview.png`
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/03-window-occupied-span-click-blocked.png`
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/04-side-wall-window-valid-preview.png`
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/05-side-wall-window-placed.png`
    - `packages/web/tmp/ux-ribbon-hosted-placement-20260514/summary.json`
      - `activeRibbonAfterFamily: "true"`
      - `invalidClickSentCommand: false`
      - `commandTypes: ["insertWindowOnWall"]`
      - `commandBodies[0].command.familyTypeId: "builtin:window:casement:1200x1500"`
      - `responseStatuses: [200]`
      - `mainFrameNavigations: 0`
      - `consoleErrors: []`

## Reopened Tracker (2026-05-14, feedback round 22 — Structural Authoring UX)

This round is a deliberate reset from isolated tool fixes to a coherent BIM authoring model. The target is not "make every ribbon button clickable"; the target is that building a small structure feels predictable across plan and 3D:

- choose a command in the active view-type ribbon;
- set type/level/constraint/options in the ribbon modifier row;
- draw, pick, or host on the canvas with a preview that exactly matches the future committed element;
- finish/cancel explicitly for sketch commands;
- keep relationships visible: level, work plane, host, joins, top/base constraints, openings, and generated dependents;
- preserve `Select` as the default command after `Esc`, command completion, or invalid placement;
- keep Cmd+K as the searchable bridge with executable/disabled/opens-view reasons.

Revit behavior to emulate where it maps cleanly:

- Linear model tools (`Wall`, `Beam`, `Railing`) support chain placement, snap, temporary dimensions, flip side without reversing endpoints, automatic join cleanup, and explicit disallow-join handles.
- Sketch tools (`Floor`, `Roof`, `Ceiling`, `Shaft`, `Stair`) enter a bounded sketch mode with `Finish`, `Cancel`, boundary validation, pick-lines/pick-walls, and in-canvas invalid-loop feedback before commit.
- Host-based tools (`Door`, `Window`, `Opening`, hosted components) preview on the actual host face before placement, reject ambiguous/occupied hosts with a visible reason, and do not steal selection/layout while the command remains active.
- Relationship tools (`Attach Top/Base`, `Join/Unjoin`, `Align`, `Trim/Extend`, `Offset`, `Array`) are explicit modify commands, not hidden side effects.
- View type controls command validity: plan and 3D can author model elements where valid; sections mostly detail/annotate/modify visible elements; sheets/schedules never show dead model-authoring chrome.

### Structural Authoring Gap Inventory

| Gap ID         | Problem Statement                                                                                                                                      | Canonical Surfaces / Files                                                                                                                                              | Priority | Status  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| NEXT22-GAP-001 | Ribbon commands still lack one canonical executable lifecycle across plan/3D/sketch/hosted tools, making each tool feel custom and brittle.            | `packages/web/src/tools/toolRegistry.ts`, `packages/web/src/workspace/workspaceUtils.ts`, `packages/web/src/workspace/shell/RibbonBar.tsx`, command capability metadata | P0       | Partial |
| NEXT22-GAP-002 | The canvas lacks one shared "authoring transaction" state machine for start/preview/commit/cancel/error across line, sketch, host, and modify tools.   | `packages/web/src/plan/PlanCanvas.tsx`, `packages/web/src/Viewport.tsx`, `packages/web/src/workspace/authoring/*`, shared authoring state module                        | P0       | Partial |
| NEXT22-GAP-003 | Wall connections in 3D do not feel like BIM joins: endpoints, intersections, cleanup, flip side, and join/disallow-join handles are not unified.       | wall command path, `viewport/meshBuilders*`, `plan/planElementMeshBuilders.ts`, backend wall/join commands                                                              | P0       | Partial |
| NEXT22-GAP-004 | Wall joins in plan and 3D can diverge visually/semantically, so a trustworthy join in one view may not read correctly in the other.                    | plan projection, 3D mesh builders, wall join solver, wall join tests                                                                                                    | P0       | Partial |
| NEXT22-GAP-005 | Floor creation is still a standalone sketch command instead of a structural host workflow that can drive walls, rooms, shafts, ceilings, and roofs.    | floor sketch UI, backend floor/slab elements, plan/3D preview, command metadata                                                                                         | P0       | Open    |
| NEXT22-GAP-006 | There is no "build walls from this floor/boundary/room" workflow, so users redraw obvious geometry instead of deriving structure from existing loops.  | floor/room boundary extraction, wall creation command batch, ribbon create/modify groups                                                                                | P0       | Open    |
| NEXT22-GAP-007 | Roof and ceiling authoring are not connected to the wall/floor stack; attach/top constraints and roof-by-footprint behavior are not clear.             | roof/ceiling sketch tools, wall top constraints, attach top/base commands, 3D preview                                                                                   | P0       | Open    |
| NEXT22-GAP-008 | Work plane, level, host face, and pick mode are not visible enough during 3D structure creation, so users cannot predict where structure will land.    | `viewport/authoring3d.ts`, `Viewport.tsx`, secondary 3D level/work-plane controls, ribbon modifier row                                                                  | P0       | Partial |
| NEXT22-GAP-009 | `Floor`, `Roof`, `Ceiling`, `Column`, `Beam`, `Shaft`, `Stair`, and `Railing` need tool-specific 3D previews, not generic click acceptance.            | `Viewport.tsx`, mesh preview factories, backend commands/elements, ribbon command callbacks                                                                             | P0       | Open    |
| NEXT22-GAP-010 | Modify commands are not a coherent cross-view set, especially `Align`, `Offset`, `Trim/Extend`, `Split`, `Join/Unjoin`, `Attach`, `Move`, and `Copy`.  | ribbon modify group, canvas grips, selected-element sidebar actions, command palette                                                                                    | P1       | Partial |
| NEXT22-GAP-011 | Hosted placement is improved for doors/windows, but needs the same host-lock, preview, conflict, and family-type fidelity for openings and components. | `Viewport.tsx`, `families/hostedFamilySelection.ts`, hosted opening guards, family library                                                                              | P1       | Open    |
| NEXT22-GAP-012 | Load Family / component placement does not yet operate as a full authoring resource workflow across plan, 3D, sheet, and family-editor boundaries.     | `FamilyLibraryPanel`, `familyPlacementRuntime`, ribbon Insert tab, project asset catalog, command capabilities                                                          | P1       | Open    |
| NEXT22-GAP-013 | Sketch mode finish/cancel/error affordances are not standardized for floors, roofs, ceilings, shafts, stairs, areas, rooms, and detail boundaries.     | sketch canvases, `ToolModifierBar`, `OptionsBar`, Cmd+K, status footer                                                                                                  | P0       | Partial |
| NEXT22-GAP-014 | Temporary dimensions, snaps, constraints, and numeric entry are inconsistent across plan/3D, making precise construction hard.                         | snap engine, temp dimensions, plan/3D authoring overlays, numeric input components                                                                                      | P1       | Partial |
| NEXT22-GAP-015 | Selection and grips after placement do not expose the next obvious structural edits: stretch, flip, attach, join cleanup, type swap, and host repair.  | `viewport/grip3d*`, plan grip providers, element sidebar, contextual ribbon modify group                                                                                | P1       | Open    |
| NEXT22-GAP-016 | Structural validation is reactive/opaque; bad loops, orphan hosts, overlapping walls, detached doors/windows, and unattached tops need live feedback.  | advisor/violations pipeline, authoring guards, footer status, canvas transient notices                                                                                  | P1       | Open    |
| NEXT22-GAP-017 | The command registry does not yet prove every ribbon command is either executable in-view, disabled with a reason, or bridged through Cmd+K/open view. | `commandCapabilities.ts`, `defaultCommands.ts`, ribbon tests, Cmd+K tests                                                                                               | P0       | Partial |
| NEXT22-GAP-018 | Multi-pane tabs need per-pane authoring context: active command, lens, work plane, ribbon, and secondary sidebar must not bleed into another pane.     | `Workspace.tsx`, `tabsModel.ts`, `paneLayout.ts`, `CanvasMount.tsx`, per-pane state persistence                                                                         | P0       | Partial |
| NEXT22-GAP-019 | Seeded proof coverage is too command-specific; there is no end-to-end proof of "floor -> walls -> openings -> roof -> edits" in one stable session.    | Playwright evidence folder, seeded app capture scripts, `target-house-3`                                                                                                | P0       | Open    |
| NEXT22-GAP-020 | The current tracker lacks a command-by-command ribbon UX contract for every view type, including sheet/schedule non-model commands.                    | `RibbonBar.tsx`, view mode shells, sheet/schedule/concept commands, docs/tests                                                                                          | P1       | Open    |

### WP-NEXT-40 — Canonical Authoring Command Contract

- Priority: `P0`
- Status: `Partial`
- Covers: `NEXT22-GAP-001`, `NEXT22-GAP-002`, `NEXT22-GAP-013`, `NEXT22-GAP-017`
- Goal: define and implement one lifecycle contract for every active authoring command before adding more geometry-specific behavior.
- Source ownership:
  - `packages/web/src/tools/toolRegistry.ts`
  - `packages/web/src/workspace/workspaceUtils.ts`
  - `packages/web/src/workspace/shell/RibbonBar.tsx`
  - `packages/web/src/workspace/authoring/OptionsBar.tsx`
  - `packages/web/src/workspace/authoring/ToolModifierBar.tsx`
  - command capability metadata and Cmd+K registry/tests
  - new shared authoring lifecycle module if needed
- Required UX contract:
  - `Select` is always first in each model-authoring ribbon group and is the default after `Esc`, cancelled commands, and successful one-shot placement unless loop mode is explicitly on.
  - Each command declares `kind`: `line`, `sketch`, `hosted`, `point`, `modify`, `review`, `document`, or `resource`.
  - Each command declares valid view types, required context, disabled reason, Cmd+K reachability, active options, preview semantics, and completion behavior.
  - Every ribbon item has exactly one of: executable callback, disabled state with visible reason, or bridge action that opens the required view/context.
  - `Finish`, `Cancel`, `Back`, `Pick Lines`, `Pick Walls`, `Chain`, `Multiple`, `Flip`, `Lock Host`, and type/level fields use common modifier components.
- Acceptance:
  - unit tests fail if a visible ribbon command has no executable/disabled/bridge metadata;
  - Cmd+K exposes the same command with matching executable/disabled/bridge reason;
  - `Cmd/Ctrl+R`, browser-native shortcuts, text input shortcuts, and tab shortcuts are not captured by model tools;
  - active command state is pane-local when the workspace is split;
  - seeded screenshots cover plan wall, 3D wall, floor sketch, hosted window, and sheet command states;
  - old ad hoc active-command messages remain only where adapted into the new lifecycle.
- Evidence 2026-05-14:
  - `packages/web/src/tools/authoringCommandContract.ts` defines the first canonical command contract for every active `ToolId`: kind, valid modes, required context, options, preview semantics, and completion behavior.
  - `commandCapabilities.ts`, `defaultCommands.ts`, and `RibbonBar.tsx` now expose command lifecycle/preview metadata and direct bridge actions; tests fail if a visible ribbon command lacks executable, disabled, or bridge metadata.
  - `Workspace.tsx`, `CanvasMount.tsx`, `PlanCanvas.tsx`, and `Viewport.tsx` now carry pane-local active plan tools so split panes do not bleed authoring state into each other.
  - `Workspace.test.tsx` covers pane-local active command state and browser-native shortcut safety, including `Cmd/Ctrl+R` staying browser-owned instead of activating Roof.
  - Seeded screenshots captured under `packages/web/tmp/ux-next-wp40-20260514/`: plan wall, floor sketch, 3D wall, hosted window, and sheet command states on `target-house-3`.
  - Remaining before `Done`: migrate the canvas implementations onto one shared transaction state machine and replace the remaining tool-specific sketch/host/line prompt paths through the common lifecycle kernel in WP-NEXT-41+.
- Dependencies: none. This is the foundation for every following package.

### WP-NEXT-41 — Shared Work Plane, Snapping, Preview, And Numeric Input Kernel

- Priority: `P0`
- Status: `Partial`
- Covers: `NEXT22-GAP-002`, `NEXT22-GAP-008`, `NEXT22-GAP-014`, `NEXT22-GAP-018`
- Goal: make "where am I drawing?" and "what will be committed?" identical in plan and 3D.
- Source ownership:
  - `packages/web/src/plan/PlanCanvas.tsx`
  - `packages/web/src/Viewport.tsx`
  - `packages/web/src/viewport/authoring3d.ts`
  - snap engine and temporary dimension modules
  - secondary plan/3D level/work-plane controls
- Required UX:
  - visible active work plane with level/name badge in 3D and plan;
  - snap glyphs for endpoint, midpoint, intersection, perpendicular, parallel, nearest, face, host centerline, grid, and level plane;
  - numeric length/angle/offset entry at cursor or modifier row;
  - preview object uses the exact semantic command payload that will be committed;
  - invalid hover/click states explain the reason in the canvas overlay and footer command prompt;
  - camera orbit/pan never accidentally commits geometry; model tools use explicit click phases and `Alt`/middle-mouse navigation escape.
- Acceptance:
  - tests prove screen-to-model projection is stable after ViewCube rotation and pane resize;
  - preview payload equals committed payload for walls, beams, floors, and roof sketch segments;
  - seeded proof shows work-plane badge, snap glyph, numeric input, preview, commit, cancel, and no page refresh;
  - per-pane split proof shows each pane keeps its own work plane and active command.
- Evidence 2026-05-14:
  - `packages/web/src/viewport/authoring3d.ts` now provides the first shared 3D authoring helpers for active-level grid snapping, line/polygon preview payloads, semantic-command conversion, payload parity checks, and numeric line resizing.
  - `packages/web/src/Viewport.tsx` consumes that kernel for 3D line tools and floor/roof/ceiling/area sketch commits, including active work-plane badges, snap glyph feedback, numeric line input, and preview-to-command dispatch for committed geometry.
  - `packages/web/src/plan/PlanCanvas.tsx` exposes the active plan work plane as a testable badge so plan/3D both answer "where am I drawing?"
  - `packages/web/src/viewport/authoring3d.test.ts` covers snap tolerance, wall/beam/railing/grid/reference-plane preview-command parity, floor/roof polygon preview-command parity, and numeric length resizing.
  - Seeded proof captured under `packages/web/tmp/ux-next-wp41-20260514/` shows plan work-plane badge, 3D work-plane badge, snap glyph, numeric input, wall preview, wall commit, `Esc` cancel back to Select, and no full document reload during the commit flow.
  - Remaining before `Done`: migrate all plan/3D tools to one transaction state machine, add full snap families (endpoint, midpoint, intersection, perpendicular, parallel, nearest, face, host centerline), prove screen-to-model stability after ViewCube rotation and pane resize, prove per-pane persisted work planes, and add visible sketch-preview proof for floor/roof segments beyond payload parity.
- Dependencies: `WP-NEXT-40`.

### WP-NEXT-42 — Wall Connectivity, Joins, Cleanup, And Join Controls

- Priority: `P0`
- Status: `Partial`
- Covers: `NEXT22-GAP-003`, `NEXT22-GAP-004`, `NEXT22-GAP-010`, `NEXT22-GAP-015`, `NEXT22-GAP-016`
- Goal: make wall drawing feel like BIM topology rather than disconnected slabs.
- Revit-like behavior to emulate:
  - wall endpoints snap and auto-join at endpoints/intersections;
  - T/L/X joins clean up in plan and 3D consistently;
  - `Space` flips location-line side without reversing authored start/end;
  - selected wall exposes start/end join handles and `Disallow Join` toggles;
  - `Trim/Extend`, `Split`, `Join`, `Unjoin`, `Align`, and `Offset` work as modify commands, not hidden special cases.
- Source ownership:
  - wall creation/update backend commands;
  - wall join data model;
  - plan projection and wall hatch rendering;
  - 3D wall mesh builders and CSG cut refresh;
  - selected wall element sidebar and contextual ribbon modify group.
- Acceptance:
  - plan and 3D wall joins share the same topology model and tests;
  - drawing a rectangle in plan creates four joined walls with clean corners and no mirrored artifacts;
  - drawing the same in 3D creates the same semantic topology and clean 3D corners;
  - selecting a joined wall exposes join controls in element sidebar/contextual ribbon;
  - disallowing a join visibly separates the end in plan and 3D;
  - seeded proof covers endpoint join, T join, trim/extend, disallow join, flip side, and undo/redo.
- Evidence 2026-05-14:
  - `packages/web/src/geometry/wallConnectivity.ts` adds the first shared topology kernel for endpoint, T, and X wall joins plus endpoint/segment/intersection snap candidates and disallow-join metadata.
  - `wallConnectivityToPlanJoinRecords` now maps that shared topology into plan wall cleanup records, and `packages/web/src/plan/symbology.ts` uses it as a live fallback when the server projection has no `wallCornerJoinSummary_v1`; tests prove rectangle/T/disallow conversion and wire-plan cleanup from topology alone.
  - `packages/web/src/viewport/wallJoinDisplay.ts` applies the same topology to simple 3D wall rendering, creating visible render-only gaps at disallowed joined endpoints, including CSG wall jobs; tests cover allowed joins, disallowed endpoint shortening, short-wall safety, and rendered mesh dimensions.
  - Wall join controls are now reachable from the contextual ribbon: plan wall selection exposes the `Wall Join` tool directly, and 3D wall selection exposes a `Join Controls` action that opens the element sidebar controls while preserving Cmd+K metadata for the element sidebar route.
  - Plan wall selection now exposes a fuller contextual modify command set (`Offset`, `Split`, `Trim`, `Trim/Extend`, `Wall Join`) instead of hiding implemented modify tools behind Cmd+K only; `tool.offset` was added to the tool registry, Cmd+K command registry, and command lifecycle metadata.
  - `packages/web/src/plan/wallOffsetTool.ts` adds a signed perpendicular wall-offset helper that emits `moveElementsDelta` without reversing the authored wall endpoints, and `PlanCanvas` wires it to the new Offset modify tool.
  - `packages/web/src/plan/PlanCanvas.tsx` and `packages/web/src/Viewport.tsx` now both snap wall placement through that same kernel before generic grid snapping, so plan and 3D wall authoring use the same semantic join targets.
  - Wall side flipping now uses the shared `flipWallLocationLineSide` helper in plan and 3D and no longer reverses authored start/end points, preserving the user-drawn wall direction.
  - `packages/web/src/geometry/wallConnectivity.test.ts`, `packages/web/src/plan/PlanCanvas.toolDestubs.test.ts`, `packages/web/src/plan/wallOffsetTool.test.ts`, `packages/web/src/workspace/shell/TopBar.test.tsx`, and `packages/web/src/viewport/Viewport.authoringSource.test.ts` prove the shared join/snap kernel, modify command reachability, and offset payload are wired into plan and 3D authoring paths.
  - `packages/web/src/viewport/wallJoinDisplay.ts` and `packages/web/src/viewport/meshBuilders.ts` now render single-thickness 3D walls with cleaned join footprints for endpoint L corners, T-branch butt joins, and X-intersections instead of raw overlapping box slabs; tests prove mitered shared diagonals, branch trimming to the host wall face, and split/capped X crossings.
  - `packages/web/src/viewport/meshBuilders.layeredWall.ts` now routes typed/material-layer walls through the same disallow-gap and topology cleanup footprints, producing per-layer endpoint/T and X cleanup meshes instead of bypassing the 3D join renderer; `meshBuilders.layeredWall.test.ts` covers disallowed typed endpoints, typed L cleanup, and typed X splitting.
  - `packages/web/src/viewport/csgWallBaseGeometry.ts`, `csgWorker.ts`, and `Viewport.tsx` now pass cleaned local wall footprints into the wall-opening CSG worker so final door/window/opening-cut walls keep allowed endpoint/T/X cleanup instead of swapping back to a raw box after the worker response; `csgWorker.wallOpening.test.ts` covers cleaned footprint base geometry.
  - Baseline split-pane close behavior was restored by exporting and testing `removePaneLeaf`, because the current workspace shell imports it during typecheck.
  - Remaining before `Done`: rectangle semantic topology command proof, selected-wall join controls with seeded visible disallow separation in plan/3D, modify command completion for unjoin/attach and cross-view previews, seeded screenshots for endpoint join/T join/trim/disallow/flip/undo/redo.
- Dependencies: `WP-NEXT-40`, `WP-NEXT-41`.

### WP-NEXT-43 — Floor Sketch Lifecycle And Floor-As-Host Semantics

- Priority: `P0`
- Status: `Done`
- Covers: `NEXT22-GAP-005`, `NEXT22-GAP-013`, `NEXT22-GAP-014`, `NEXT22-GAP-016`
- Goal: make floors a trustworthy structural base for walls, rooms, shafts, ceilings, and roofs.
- Revit-like behavior to emulate:
  - `Floor` starts sketch mode with boundary line tools, pick-lines, pick-walls, and explicit `Finish`/`Cancel`;
  - boundary validation finds open loops, self-intersections, too-small edges, duplicate edges, and overlapping floor slabs before commit;
  - selected floor exposes boundary edit, thickness/type, level, slope, openings/shafts, and generate/host actions;
  - floor preview shows true thickness/elevation in 3D and true boundary/filled region in plan.
- Source ownership:
  - floor element/command model;
  - plan sketch canvas;
  - 3D floor/slab mesh preview;
  - element sidebar floor properties;
  - ribbon `Model/Create/Floor` and contextual `Modify/Floor` groups.
- Acceptance:
  - old one-click/ambiguous floor behavior is removed or bridged into sketch mode;
  - `Finish` is disabled with visible reasons until a valid closed loop exists;
  - seeded proof creates a floor from drawn boundary and from picked walls;
  - floor remains selected after commit with edit-boundary action available;
  - Cmd+K can start floor sketch and reports disabled reason in invalid view types.
- Evidence 2026-05-14:
  - `packages/web/src/workspace/workspaceUtils.ts` now centralizes structural tool routing: generic `floor`/`roof` resolve to `floor-sketch`/`roof-sketch` in plan and non-3D bridge contexts, while remaining direct `floor`/`roof` authoring tools in 3D.
  - Plan Sketch ribbon buttons now use the canonical sketch tool ids with the existing visible `Floor`/`Roof` labels, so clicking Floor/Roof opens the explicit sketch lifecycle instead of the old ambiguous plan tool. The Workspace hotkey path and Cmd+K `tool.floor`/`tool.roof` path use the same routing.
  - Floor sketch mode now keeps floor type and boundary-offset options visible in `OptionsBar`, and floor/roof tool metadata no longer requires an existing wall before a sketch can start. MEP lens gating was extended to `tool.floor-sketch` and `tool.roof-sketch`.
  - Tests cover Cmd+K routing, plan ribbon routing and active state, Workspace plan hotkey/ribbon routing, 3D direct Floor/Roof preservation, floor sketch options visibility, capability preconditions, MEP lens gating, and existing Cmd/Ctrl+R browser-shortcut preservation.
  - Floor sketch validation now blocks too-short edges, duplicate/reversed boundary edges, overlapping collinear boundary edges, and same-level floor slab overlap before `Finish`; live sketch-session responses and the finish route return the same concrete validation issue codes.
  - Backend tests cover the new topology validation and document-aware floor overlap/skipped-source-floor behavior in `app/tests/test_sketch_validation.py` and `app/tests/test_routes_sketch_validation.py`.
  - Selected floor properties now expose an explicit `Edit Boundary` action that returns to plan/select on the floor level so existing vertex grips are the boundary editor; the same action is reachable from selected-floor 3D actions. DOM tests cover both surfaces.
- Evidence 2026-05-15:
  - `packages/web/src/plan/SketchCanvas.tsx` keeps sketch-session open/hydration stable across parent callback rerenders and performs Pick Walls hit-testing in screen space before falling back to model-space distance, so visible walls can be picked reliably after pan/zoom and after seeded view changes.
  - `packages/web/src/plan/SketchCanvasPickWalls.tsx` adds a pure projected-wall hit-test helper with bounded pixel tolerance; `packages/web/src/plan/SketchCanvas.pickWalls.test.tsx` covers projected hit-testing, hover wall id fidelity, pick-wall API dispatch, and the no-reopen regression.
  - Seeded UI proof in `packages/web/tmp/ux-next-wp43-20260515/summary.json` confirms invalid open-loop, duplicate/reversed-edge, and existing-floor-overlap validation keep `Finish` disabled with visible reasons; drawn-boundary floor creation reaches `Ready to Finish`; picked-wall floor creation picks four proof walls, reaches `Ready to Finish`, and remains selected with `Edit Boundary`; Sketch ribbon and Cmd+K floor command reachability are preserved without main-frame reloads.
  - Screenshots captured for the seeded proof:
    - `packages/web/tmp/ux-next-wp43-20260515/01-invalid-open-loop-finish-disabled.png`
    - `packages/web/tmp/ux-next-wp43-20260515/02-duplicate-reversed-edge-validation.png`
    - `packages/web/tmp/ux-next-wp43-20260515/03-existing-floor-overlap-validation.png`
    - `packages/web/tmp/ux-next-wp43-20260515/04-drawn-boundary-ready-to-finish.png`
    - `packages/web/tmp/ux-next-wp43-20260515/05-drawn-boundary-floor-selected-edit-boundary.png`
    - `packages/web/tmp/ux-next-wp43-20260515/06-picked-walls-ready-to-finish.png`
    - `packages/web/tmp/ux-next-wp43-20260515/07-picked-wall-floor-selected-edit-boundary.png`
    - `packages/web/tmp/ux-next-wp43-20260515/08-cmd-k-floor-command-reachability.png`
- Dependencies: `WP-NEXT-40`, `WP-NEXT-41`.

### WP-NEXT-44 — Generate Walls From Floors, Rooms, And Picked Boundaries

- Priority: `P0`
- Status: `Open`
- Covers: `NEXT22-GAP-006`, `NEXT22-GAP-003`, `NEXT22-GAP-005`, `NEXT22-GAP-016`
- Goal: allow users to build obvious vertical structure from existing horizontal/room boundaries instead of redrawing geometry.
- Required workflows:
  - `Create Walls from Floor Boundary`;
  - `Create Walls from Room Boundary`;
  - `Pick Floor Edge` while Wall command is active;
  - `Pick Lines` from imported CAD/reference geometry;
  - options for wall type, height/top constraint, location line, exterior/interior side, chain, and skip existing overlapping wall.
- Acceptance:
  - generated walls are joined and have deterministic ids/undo grouping;
  - preview shows every wall segment before commit with conflict markers where a wall already exists;
  - command produces a single undoable batch command;
  - seeded proof starts with a floor and generates walls, then inserts a door/window into the generated walls without layout refresh;
  - overlapping/duplicate walls are not silently created.
- Dependencies: `WP-NEXT-42`, `WP-NEXT-43`.

### WP-NEXT-45 — Roof, Ceiling, Shaft, And Structural Stack Completion

- Priority: `P0`
- Status: `Open`
- Covers: `NEXT22-GAP-007`, `NEXT22-GAP-009`, `NEXT22-GAP-013`, `NEXT22-GAP-016`
- Goal: complete the vertical building stack: floor -> walls -> ceiling/roof/shaft with explicit constraints and previews.
- Required workflows:
  - `Roof by Footprint` from selected walls/floor boundary with overhang and slope arrows;
  - `Ceiling by Room/Boundary`;
  - `Shaft Opening` through floors/roofs;
  - `Attach Top/Base` walls to roof/floor/level;
  - selected roof/ceiling/floor exposes edit-boundary and attach/detach actions.
- Acceptance:
  - roof/ceiling/shaft use shared sketch lifecycle and validation;
  - selected walls can attach top to roof and update if the roof changes;
  - roof preview shows slope/overhang before commit;
  - shaft preview shows affected floors/roof and blocks invalid partial spans;
  - seeded proof builds floor, generated walls, roof, ceiling, shaft, and validates no orphaned top/base constraints.
- Dependencies: `WP-NEXT-43`, `WP-NEXT-44`.

### WP-NEXT-46 — Full 3D Direct Authoring Parity For Model Ribbon Tools

- Priority: `P0`
- Status: `Open`
- Covers: `NEXT22-GAP-008`, `NEXT22-GAP-009`, `NEXT22-GAP-011`, `NEXT22-GAP-012`, `NEXT22-GAP-017`
- Goal: every model-building command visible in the 3D ribbon must have a specific 3D interaction model or be hidden/disabled with a reason.
- Tool contracts:
  - `Wall`: active work-plane line tool with joined endpoints.
  - `Floor`: sketch on level plane or pick visible wall loop/floor face.
  - `Roof`: pick wall loop/floor footprint; show slope/overhang preview.
  - `Ceiling`: pick room/closed wall loop at active level.
  - `Column`: point placement on level/work plane with height/top constraint preview.
  - `Beam`: line placement between supports/levels with snap and roll/offset.
  - `Door/Window/Opening`: host-face preview, host lock, conflict guard, type dimensions.
  - `Shaft`: sketch footprint plus vertical extent.
  - `Stair/Railing`: sketch/path mode with finish/cancel and generated dependencies.
  - `Load Family/Component`: category-specific placement adapter with host requirements.
- Acceptance:
  - no 3D ribbon command is visually clickable without executable behavior or disabled reason;
  - each 3D model command has a unit/DOM test for activation and a seeded screenshot for preview state;
  - active 3D model commands do not trigger page refresh, full canvas width jump, or selection-sidebar takeover;
  - invalid hosts/work planes show red preview and explanation before click;
  - Cmd+K mirrors all 3D command states.
- Dependencies: `WP-NEXT-40`, `WP-NEXT-41`, then tool-specific dependencies above.

### WP-NEXT-47 — Universal Modify Toolkit Across View Types

- Priority: `P1`
- Status: `Open`
- Covers: `NEXT22-GAP-010`, `NEXT22-GAP-015`, `NEXT22-GAP-017`
- Goal: provide the basic editing verbs users expect after creating structure.
- Commands:
  - `Move`, `Copy`, `Rotate`, `Mirror`, `Align`, `Offset`, `Trim/Extend`, `Split`, `Join/Unjoin`, `Attach/Detach`, `Pin/Unpin`, `Delete`, `Array`;
  - view-aware availability in plan, 3D, section, sheet, and schedule;
  - common preview + numeric input + constraints.
- Acceptance:
  - selected element contextual ribbon shows supported modify commands with disabled reasons for unsupported categories;
  - plan and 3D previews match the committed transform;
  - `Esc` cancels modify preview and returns to `Select`;
  - multi-select batch operations work where semantically valid;
  - seeded proof edits the generated floor/wall/roof stack without orphaning hosted elements.
- Dependencies: `WP-NEXT-42` through `WP-NEXT-46` for structural targets.

### WP-NEXT-48 — Ribbon Command Matrix Completion Across All View Types

- Priority: `P1`
- Status: `Open`
- Covers: `NEXT22-GAP-017`, `NEXT22-GAP-020`, `NEXT22-GAP-012`
- Goal: make the whole ribbon feel intentionally complete, not sparse or fake, for every active view type.
- Required matrix:
  - Plan: Select, Wall, Door, Window, Opening, Floor, Roof, Ceiling, Column, Beam, Room/Area, Shaft, Stair, Railing, Component/Load Family, Annotate, Dimension, Tag, Measure, Modify.
  - 3D: Select, Wall, Door, Window, Opening, Floor, Roof, Ceiling, Column, Beam, Shaft, Stair, Railing, Component/Load Family, Measure/Review, Section/Elevation, Modify.
  - Section: Detail Line, Dimension, Tag, Text, Component/Detail Item, Crop/Far Clip, Place on Sheet, Modify visible element.
  - Sheet: Place Views, Edit Viewports, Titleblock, Revisions, Publish, Markup/Review.
  - Schedule: Rows, Columns, Fields, Filters, Sort/Group, Formatting, Place on Sheet, Export/Publish.
  - Concept: Board, Place, Arrange, Markup, Attachments.
- Acceptance:
  - every visible command has command capability metadata, Cmd+K parity, keyboard shortcut policy, and tests;
  - commands that bridge to another view clearly say so and open/focus the right tab/pane;
  - commands invalid in a view are not persistent dead chrome;
  - seeded screenshots capture each view type ribbon with no fake/inert commands.
- Dependencies: can run after `WP-NEXT-40`, but model commands should close only after `WP-NEXT-46`.

### WP-NEXT-49 — Live Structural Validation And Repair UX

- Priority: `P1`
- Status: `Open`
- Covers: `NEXT22-GAP-016`, `NEXT22-GAP-015`
- Goal: make bad structural states understandable and repairable while authoring, not after a mysterious backend rejection.
- Required checks:
  - open sketch loops;
  - self-intersecting floor/roof boundaries;
  - overlapping duplicate walls;
  - joined-wall cleanup failures;
  - orphaned hosted elements;
  - door/window outside host span;
  - unattached wall tops below/through roofs;
  - shaft/floor/roof conflicts;
  - invalid level/work-plane constraints.
- Acceptance:
  - live canvas notice appears before commit where possible;
  - footer/advisor records persisted model problems after commit;
  - repair actions are available through contextual ribbon, element sidebar, and Cmd+K;
  - seeded proof creates, detects, and fixes at least one problem per category group.
- Dependencies: `WP-NEXT-42` through `WP-NEXT-47`.

### WP-NEXT-50 — End-To-End Structure Builder Proof Suite

- Priority: `P0`
- Status: `Open`
- Covers: `NEXT22-GAP-019`
- Goal: prove the authoring system works as a workflow, not only as independent commands.
- Required seeded scenarios:
  - Plan workflow: draw floor boundary -> finish floor -> generate walls from floor -> insert door/window -> roof by footprint -> attach walls -> place on sheet.
  - 3D workflow: open 3D -> set level/work plane -> draw/join walls -> add floor/roof/hosted elements -> modify/attach -> no refresh/sidebar takeover.
  - Split-pane workflow: plan and 3D side by side with independent ribbons/secondary sidebars but shared model updates.
  - Invalid workflow: try open floor loop, duplicate wall, occupied window span, invalid roof footprint, and verify readable blocking feedback.
  - Cmd+K workflow: start/bridge/disable every major structural command with correct reason.
- Evidence requirements:
  - Playwright screenshots for each stage;
  - command trace summary with command types, payloads, response statuses, navigation count, canvas bounds stability, active command state, and console errors;
  - tests for core geometry/lifecycle helpers;
  - `pnpm --filter @bim-ai/web typecheck`;
  - relevant web tests;
  - prettier check for changed files;
  - `git diff --check`.
- Done gate:
  - no row in this feedback round can be marked `Done` unless the seeded workflow proves the canonical behavior and the old dead/inert behavior is removed.
- Dependencies: all preceding P0 packages, then selected P1 packages as needed.

### Recommended Execution Order

1. `WP-NEXT-40` first: without a canonical command lifecycle, later tool work will keep producing one-off fixes.
2. `WP-NEXT-41` second: shared work-plane/snap/preview fidelity is the base for reliable 3D and plan structure tools.
3. `WP-NEXT-42` third: walls are the trust anchor for everything the user called out.
4. `WP-NEXT-43` and `WP-NEXT-44`: floor sketch and wall generation from floor/boundaries.
5. `WP-NEXT-45`: roof/ceiling/shaft and attach top/base stack semantics.
6. `WP-NEXT-46`: complete 3D direct authoring parity for visible model commands.
7. `WP-NEXT-47` and `WP-NEXT-49`: modify toolkit plus validation/repair.
8. `WP-NEXT-48`: full cross-view ribbon command matrix completion, closing sheet/schedule/concept parity at the same quality bar.
9. `WP-NEXT-50`: end-to-end seeded proof suite and closeout.

### Non-Negotiable Completion Rule For This Round

Do not mark any `NEXT22-*` row or `WP-NEXT-40+` workpackage as `Done` unless all of these are true:

- the old inert/dead/fake command path is removed or disabled with a visible reason;
- the new canonical behavior works in the seeded app;
- the command is reachable through the correct ribbon surface and Cmd+K;
- `Esc`/Select/default command behavior is correct;
- plan and 3D behavior match where both views support the command;
- tests cover lifecycle/geometry/capability metadata;
- Playwright screenshots prove the affected states;
- command trace proves no main-frame navigation, no full refresh, and no selected-element/sidebar takeover unless selection is intentional.
