# Open tasks — BIM AI UI

Living to-do for the redesigned UI. Anything that's *still open* lives here so it doesn't get buried in commit messages or a 1200-line spec. When a task closes, move it to spec/ui-ux-redesign-v1-spec.md §6 (Sprint Ledger) and delete its row here.

**Counterpart docs**:
- `spec/ui-ux-redesign-v1-spec.md` §32 — fuller-context visual-fidelity audit (V01–V15).
- `spec/ui-ux-redesign-v1-spec.md` §28 — WP-UI-* table (every row is `partial`; this file enumerates the *concrete next moves*, not the WP roll-up).
- `spec/ui-ux-redesign-v1-spec.md` §6 — sprint ledger of what already closed.

Last updated: 2026-05-06.

---

## High-impact (user-visible, blocks daily use)

---

## Medium (deferred from earlier WPs, called out in commits but not in spec)

---

## §28 WP-UI rows — table-level audit

40 of 43 rows are now `done` (2026-05-06 sweep). Three rows remain `partial`:

- **WP-UI-B01** (2D Plan canvas — drafting visuals): `planCanvasState.draftingPaintFor` not directly used in PlanCanvas.tsx; canvas achieves token-driven paint via symbology.ts but scale-dependent line weights and hatch visibility are not yet wired.
- **WP-UI-B02** (2D Plan canvas — pointer + snap grammar): `planCanvasState.classifyPointerStart` not used; PlanCanvas has its own pointer classification.
- **WP-UI-B03** (2D Plan canvas — zoom/pan/level/empty state): `planCanvasState.PlanCamera` not used; PlanCanvas has its own zoom/pan/camera. Anchor-toward-cursor zoom and strict 1:5–1:5000 bounds not applied.

Next sweep: wire `PlanCamera`, `SnapEngine`, and `draftingPaintFor` into `PlanCanvas.tsx` to close B01–B03.

---

## Feature parity gaps — old Workspace vs. redesign

These features existed in `Workspace.tsx` (now at `/legacy`) and are not yet wired into `RedesignedWorkspace.tsx`. The §5 parity dashboard did not track these because the WP-UI work packages only measured whether the *new chrome components* were built, not whether every old-workspace feature was ported.

---

### T-10 · Collaboration conflict queue readout

**WP target:** WP-UI-A06 (StatusBar) · **Source:** `Workspace.tsx` lines 1019–1071 · **Status:** `open`

The collision infrastructure is complete but dark in the redesign. `packages/web/src/lib/collaborationConflictQueue.ts` detects `merge_id_collision` events from the WebSocket; `collaborationConflictStatus.ts` formats them. `RedesignedWorkspace.tsx` never subscribes to the conflict queue, so merge conflicts surface only as a generic `seedError`.

**Next moves:**
- Subscribe to `collaborationConflictQueueV1` in `RedesignedWorkspace.tsx` (mirror old lines 185–186, 337–347, 459–465)
- Add a conflict pill / expandable row to `StatusBar.tsx` that shows `inspectionReadout`, `retryAdvice`, `reason`, `blockingCommandType`
- Add vitest for the new StatusBar conflict slot
- Update §5 + §28 WP-UI-A06 when done

---

### T-11 · 3D layer visibility panel

**WP target:** WP-UI-B04/B08 (3D viewport) · **Source:** `Workspace.tsx` lines 1173–1240 · **Status:** `open`

The per-category visibility state is fully implemented (`viewerCategoryHidden`, `toggleViewerCategoryHidden`, `viewerClipElevMm`, `viewerClipFloorElevMm`, `setViewerClipElevMm`, `setViewerClipFloorElevMm` in the store) but has no UI surface in the redesign. The old workspace had a "3D layers" panel exposing category toggles (wall/floor/roof/stair/door/window/room) and section-box clip elevation sliders.

**Next moves:**
- Author a `Viewport3DLayersPanel.tsx` component (or add a collapsible section to Inspector) with per-category toggle rows + clip-elevation numeric inputs
- Wire into `RedesignedWorkspace.tsx` as a side panel or Inspector tab when the active view is 3D/Plan+3D
- Vitest for panel render + dispatch
- Update §5 + §28 WP-UI-B04/B08 when done

---

### T-13 · Authoring workbenches

**WP target:** WP-UI-C (tools) · **Source:** `Workspace.tsx` lines 1812–1860 · **Status:** `open`

Six specialized authoring panels exist in the codebase but are not mounted in the redesign:

| Panel | File | Purpose |
|---|---|---|
| Room separation | `workspace/RoomSeparationAuthoringWorkbench.tsx` | Draw/edit room separation lines |
| Level datum stack | `workspace/LevelDatumStackWorkbench.tsx` | Level elevation constraints + datum chains |
| Roof authoring | `workspace/RoofAuthoringWorkbench.tsx` | Roof footprint, slopes, overhangs |
| Material layer stack | `workspace/MaterialLayerStackWorkbench.tsx` | Wall/floor/roof layer + material assignment |
| Site authoring | `workspace/SiteAuthoringPanel.tsx` | Project settings, site boundary, north arrow |
| Room color scheme | `workspace/RoomColorSchemePanel.tsx` | Per-room color schemes by department/finish |

**Next moves:**
- Decide surface: context-sensitive Inspector tab (activates when the right element kind is selected) or dedicated mode-shell panels
- Mount each panel in `RedesignedWorkspace.tsx` wired to the same store props as old `Workspace.tsx`
- Vitest smoke for each mount
- Update §5 + §28 WP-UI-C rows when done

---

### T-14 · Plan view graphics matrix + saved-view overrides

**WP target:** WP-UI-B01 (drafting visuals) · **Source:** `workspace/PlanViewGraphicsMatrix.tsx`, `SavedViewTagGraphicsAuthoring.tsx`, `SavedViewTemplateGraphicsAuthoring.tsx` · **Status:** `open`

Per-category line weight / pattern / color overrides per plan view exist in the old workspace but have no UI in the redesign. Users cannot currently inspect or change how categories render per view.

**Next moves:**
- Mount `PlanViewGraphicsMatrix.tsx` in the redesign (likely as an Inspector tab or settings panel when a plan view is active)
- Mount `SavedViewTagGraphicsAuthoring` and `SavedViewTemplateGraphicsAuthoring` for per-view template overrides
- Wire to `activePlanViewId` + `planPresentationPreset` from store
- Update §5 + §28 WP-UI-B01 when done

---

### T-15 · Sheet canvas + section pane

**WP target:** WP-UI-A12 (view tabs) · **Source:** `workspace/SheetCanvas.tsx`, `workspace/SectionPlaceholderPane.tsx` · **Status:** `open`

Sheet mode and Section mode have placeholder shells in the redesign (`SheetModeShell`, `SectionModeShell` in `workspace/ModeShells.tsx`). The actual rendering components exist:
- `SheetCanvas.tsx` — titleblock, placed views, viewports
- `SectionPlaceholderPane.tsx` — section/elevation view

**Next moves:**
- Swap `SheetModeShell` placeholder for `<SheetCanvas>` wired to the active sheet id from `tabsModel`
- Swap `SectionModeShell` placeholder for `<SectionPlaceholderPane>`
- Vitest smoke for canvas mount
- Update §5 + §28 WP-UI-A12 when done

---

### T-16 · Collaboration presence + comments

**WP target:** WP-UI-A (app shell) · **Source:** `Workspace.tsx` lines 987–995, 1896–1960 · **Status:** `open`

User presence (peer avatars, `presencePeers`, `userDisplayName`, `userId`) and the comment thread UI are wired in the old workspace but absent from the redesign. The store keys exist (`comments`, `mergeComment`, `setComments`, `presencePeers`, `setPresencePeers`, `setIdentity`).

**Next moves:**
- Add peer-avatar row to TopBar right region (wired to `presencePeers`)
- Mount comments panel (sidebar or popover) in `RedesignedWorkspace.tsx`
- Wire identity (`userDisplayName`, `userId`) into TopBar avatar tile
- Vitest for presence + comment render
- Update §5 when done

---

## How to add a new task

1. Append a new `### T-NN · Title` heading at the end of the relevant section.
2. Fill: WP target / Source / Status, then a 1-paragraph "what" + a "Next moves" sub-list.
3. If it's user-visible, also add a row in spec §32. Otherwise just here.
4. Once closed, **delete the heading from this file** and add a row in spec §6 (Sprint Ledger) with the closing commit.
