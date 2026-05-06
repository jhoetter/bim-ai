# BIM AI — Master Workpackage Tracker

> **Single source of truth.** This document supersedes `spec/revit-production-parity-workpackage-tracker.md`, `OPEN_TASKS.md`, and `spec/ui-ux-redesign-v1-spec.md §28`. Those files remain for historical context but this tracker drives all new work.
>
> **Prompt files** for each active wave live in `spec/prompts/wave-NN/`. After a wave is fully merged, delete that directory and commit the deletion.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| `done` | Meets the done rule — tested, type-clean, merged to main |
| `partial` | Some slice exists; measurable progress; spec requirements unmet |
| `open` | Not started |
| `deferred` | Explicitly out of scope for current roadmap |

## Done Rule

A workpackage is `done` when all of: (a) TypeScript typechecks clean (`pnpm exec tsc --noEmit`); (b) all new logic has vitest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

---

## Wave Map — Overview

| Wave | Theme | Status |
|---|---|---|
| [Wave 0](#wave-0--meta--bootstrap) | Meta / Bootstrap — tracker, docs | `done` |
| [Wave 1](#wave-1--interaction-foundation--plan-canvas) | Interaction Foundation + Plan Canvas | **CURRENT** |
| [Wave 2](#wave-2--view-system--wall-depth--openings) | View System + Wall Depth + Openings | `open` |
| [Wave 3](#wave-3--element-depth) | Element Depth (Structural, Curtain Wall, Ceilings) | `open` |
| [Wave 4](#wave-4--data-layer) | Data Layer (Rooms V2, Parameters, Schedules) | `open` |
| [Wave 5](#wave-5--families--collaboration) | Families + Collaboration | `open` |
| [Wave 6](#wave-6--coordination--export) | Coordination + Export | `open` |

---

## Wave 0 — Meta / Bootstrap

| WP | Title | State |
|---|---|---|
| WP-000 | Locked implementation decisions | `done` |
| WP-001 | Workpackage tracker (this file) | `done` |
| WP-V2-T0 | Close stale R2 tasks — geometry R2-02 through R2-08 already implemented, OPEN_TASKS.md updated | `done` |

### Closed R2 audit (2026-05-06)

The following tasks listed as `open` in `OPEN_TASKS.md` were verified **already implemented** in the codebase and are hereby closed:

| R2 task | Implementation location | Status |
|---|---|---|
| R2-02 Door frame + panel geometry | `packages/web/src/families/geometryFns/doorGeometry.ts` — full frame (head/jamb-L/jamb-R) + panel + threshold | `done` |
| R2-03 Window frame + glazing | `packages/web/src/families/geometryFns/windowGeometry.ts` — 4-member frame + glazing pane + mullion for w>1.2m | `done` |
| R2-04 Stair treads + stringers | `Viewport.tsx:957` — per-tread `BoxGeometry` stepped loop + two side stringers | `done` |
| R2-05 Railing posts + balusters | `Viewport.tsx:1345` — square posts at each vertex + evenly spaced balusters + rail cap | `done` |
| R2-06 Roof from footprint polygon | `Viewport.tsx:890` — gable + hip + L-shape geometry with ridge axis + overhang offset | `done` |
| R2-07 Floor slab from boundary polygon | `Viewport.tsx:220` — `THREE.ExtrudeGeometry` from `floor.boundaryMm` + slab opening holes | `done` |
| R2-08 Site slab fixes | `Viewport.tsx:1463` — operator precedence fixed, `receiveShadow=true`, `aoMapIntensity:0` all applied | `done` |

R2-01 (CSG wall cuts for doors/windows) remains open — will be addressed in Wave 2 (WP-V2-04).

---

## Wave 1 — Interaction Foundation + Plan Canvas

**Goal:** Close the three partial WP-UI-B0x plan-canvas gaps; add the Options Bar UI strip; add Align / Split / Trim-Extend modify tools; wire selection direction and snap feedback.

**Prompt files:** `spec/prompts/wave-01/` — delete this directory after all WPs merge to main.

### Execution order

```
Batch A — run all three in parallel (separate branch each):
  WP-V2-01a   feat/wp-v2-01a-options-bar
  WP-V2-14    feat/wp-v2-14-plan-canvas

Batch B — run after Batch A is fully merged to main:
  WP-V2-01b   feat/wp-v2-01b-modify-tools
```

### WP table

| WP | Title | Prompt file | Branch | State | Depends on |
|---|---|---|---|---|---|
| WP-V2-01a | Options Bar context strip | `wave-01/WP-V2-01a-options-bar.md` | `feat/wp-v2-01a-options-bar` | `open` | — |
| WP-V2-14 | Plan Canvas — wire B01/B02/B03 | `wave-01/WP-V2-14-plan-canvas.md` | `feat/wp-v2-14-plan-canvas` | `open` | — |
| WP-V2-01b | Modify tools + selection direction | `wave-01/WP-V2-01b-modify-tools.md` | `feat/wp-v2-01b-modify-tools` | `open` | WP-V2-01a merged |

### WP-V2-01a — Options Bar context strip

**What:** A narrow bar between the TabBar and the plan canvas that changes based on the active tool. Revit equivalent: the options bar / ribbon context zone. For the Wall tool it shows the Location Line picker (already defined in `toolGrammar.ts`). For Floor it shows the boundary offset input. For other tools it is blank (zero-height).

**Files:**
- New: `packages/web/src/workspace/OptionsBar.tsx` + `OptionsBar.test.tsx`
- Modify: `packages/web/src/workspace/AppShell.tsx` (add `options-bar` row in grid)
- Modify: `packages/web/src/state/store.ts` (expose `wallLocationLine` if not already)

**Done when:** OptionsBar renders below TabBar, shows correct wall location line controls, vitest passes, typecheck clean.

---

### WP-V2-14 — Plan Canvas B01/B02/B03

**What:** Three spec gaps in `PlanCanvas.tsx`:
- B01: Wire `draftingPaintFor(plotScale)` so line weights and hatch visibility scale with zoom.
- B02: Replace inline pointer classification with `classifyPointerStart` from `planCanvasState.ts`; show a snap indicator pill when SnapEngine resolves a candidate.
- B03: Apply strict 1:5–1:5000 scale bounds (≈0.5 m to 500 m half-world) to the orthographic camera; anchor-toward-cursor zoom is already implemented — just clamp correctly.

**Files:**
- Modify: `packages/web/src/plan/PlanCanvas.tsx`
- Possibly modify: `packages/web/src/plan/planCanvasState.ts` (if helpers needed)

**Done when:** Line weight changes on zoom (thin at 1:200, thick at 1:50), snap pill appears, camera cannot zoom past bounds, vitest passes.

---

### WP-V2-01b — Modify tools + selection direction

**What:** Add three new modify tools and wire selection direction:
1. **Align (AL)** — click reference edge → click element to move → element snaps to reference edge. Two-click grammar.
2. **Split (SD)** — click on a wall/floor to split it at the clicked midpoint. One-click grammar.
3. **Trim/Extend (TR)** — click reference line → click segment to trim/extend to it. Two-click grammar.
4. **Selection direction** — when dragging a marquee in the Select tool, left→right = window (enclosed only), right→left = crossing (all touched). Determined by `dragDirection` on `classifyPointerStart`.

**Files:**
- Modify: `packages/web/src/tools/toolRegistry.ts` (add `align`, `split`, `trim` entries)
- Modify: `packages/web/src/tools/toolGrammar.ts` (add grammar types + reducers)
- Modify: `packages/web/src/plan/PlanCanvas.tsx` (dispatch new tool events, crossing-box logic)
- New: `packages/web/src/tools/toolGrammar.test.ts` additions

**Done when:** Three new tools appear in palette (Plan mode only), hotkeys AL/SD/TR work, crossing selection selects touched elements, vitest passes.

---

## Wave 2 — View System + Wall Depth + Openings

**Goal:** Add the Visibility/Graphics dialog (VV), View Filters, View Range, Underlay, Crop Region. Deepen wall location line into the backend. Add Wall Opening tool. Close R2-01 (CSG cuts).

**Prompt files:** `spec/prompts/wave-02/` — create when Wave 1 is fully merged.

| WP | Title | State | Notes |
|---|---|---|---|
| WP-V2-03 | View Control System (VV, Filters, Range, Underlay, Crop) | `open` | Largest WP in wave; can be split into 03a (VV + Filters) and 03b (Range + Underlay + Crop) |
| WP-V2-02 | Wall System Depth (layer editor, location line backend, joins) | `open` | Frontend already has locationLine type; backend schema needs layer editing |
| WP-V2-04 | Openings + Voids (Wall Opening, Shaft, R2-01 CSG) | `open` | R2-01 needs `three-bvh-csg` dep |

### WP-V2-03 — View Control System

**Scope:**
- **VV dialog (Visibility/Graphics):** Per-category line weight/color/pattern overrides; projection vs cut overrides independent; tabs for Model / Annotation / Imported categories.
- **View Filters:** Rule-based filter definitions (field + operator + value) → named override bundle (projection fill, cut fill, line color) → applied to views. UI: Filters tab in VV dialog.
- **View Range:** Cut Plane mm, Bottom mm, Underlay level dropdown — editable per view with live preview in plan.
- **Underlay:** Show a second level's plan as a ghosted layer beneath the active level.
- **Crop Region:** Interactive crop rectangle per plan view; show/hide toggle; tight to building button.
- **Reflected Ceiling Plan (RCP):** A distinct view type with `lookDown: false` rendering.

### WP-V2-02 — Wall System Depth

**Scope:**
- **Layer structure editor:** In-place table (function enum + material key + thickness mm + wraps checkbox) editable in Inspector → Edit Type → Structure. Backend stores layers as ordered array on `WallType`.
- **Location line backend application:** When `locationLine !== 'wall-centerline'`, offset wall geometry by half-thickness in the appropriate direction when generating plan wire and 3D mesh.
- **Wall Joins tool:** Modify-tab tool that lets user click a corner and cycle miter/butt/square variants via Next button. Grammar: click corner → show join variants → cycle with N key → accept with Enter.
- **Base/Top Offset deepening:** Ensure `baseOffsetMm` and `topConstraintOffsetMm` are editable in Inspector and applied in both plan and 3D.

### WP-V2-04 — Openings + Voids

**Scope:**
- **Wall Opening tool:** Click a wall → drag rectangle to define void cutout (distinct from door/window hosted opening). Backend: `wall_opening` element with `hostWallId`, `widthMm`, `heightMm`, `sillMm`.
- **Shaft Opening:** Multi-story vertical void — rectangle in plan, spans from base level to top level. Backend: `shaft_opening` element.
- **R2-01 CSG wall cuts:** Add `three-bvh-csg` dep. In `makeWallMesh`, subtract door/window cutter volumes. Gate behind `VITE_ENABLE_CSG=true`.

---

## Wave 3 — Element Depth

**Goal:** Add structural columns/beams, curtain wall system, ceilings.

**Prompt files:** `spec/prompts/wave-03/` — create when Wave 2 is fully merged.

| WP | Title | State |
|---|---|---|
| WP-V2-06 | Structural Elements (columns with b/h params, beams, structural discipline) | `open` |
| WP-V2-07 | Curtain Wall + Envelope (grid, panel types, TAB selection, mullions) | `open` |
| WP-V2-08 | Ceilings (sketch ceiling, RCP view type, layer type) | `open` |

### WP-V2-06 — Structural Elements

**Scope:** Structural columns with `b` (width mm) and `h` (height mm) type parameters editable in Edit Type dialog; placement from structural grid intersections; structural beam element (line-based, joins to columns); structural vs architectural wall discipline flag; Options Bar: Depth vs Height switch for column extent.

### WP-V2-07 — Curtain Wall + Envelope

**Scope:** `curtain_wall` element with grid definition (`gridMode: 'fixed-number' | 'fixed-distance' | 'flexible'`, `hCount`, `vCount`); panel type system (glass/opaque/door panel); TAB key cycling in select tool to pick panel face vs wall edge; Inspector allows panel type swap; pin/unpin panel flag; mullion elements on grid lines with type (rectangular/circular profile).

### WP-V2-08 — Ceilings

**Scope:** `ceiling` element with `levelId`, `boundaryMm[]`, `heightOffsetMm`, `typeId`; sketch-mode creation (same paradigm as floor: Pick Walls → Trim/Extend → green check); closed-loop validation error; ceiling display in plan view (below cut plane) vs RCP view (looking up). Ceiling types with layer buildup mirroring floor types.

---

## Wave 4 — Data Layer

**Goal:** Rooms V2, Shared Parameters, schedule depth (sorting/grouping/totals, Color Fill Legend).

**Prompt files:** `spec/prompts/wave-04/` — create when Wave 3 is fully merged.

| WP | Title | State |
|---|---|---|
| WP-V2-09 | Room + Area V2 (Room Bounding, Color Fill, separation lines, deletion via schedule) | `open` |
| WP-V2-10 | Parameters + Shared Parameters (Shared Params file, Project Params, Calculate Totals, Sorting/Grouping) | `open` |

### WP-V2-09 — Room + Area V2

**Scope:**
- **Room Bounding on linked elements:** Property on linked model instances; when `roomBounding: true`, room detection sees those walls as boundaries.
- **Room separation lines:** Virtual 2D line element that acts as a room boundary without physical geometry.
- **Room deletion via Schedule:** Deleting a room sticker on the canvas marks it hidden only; true deletion requires Schedule → delete row. UI warning on canvas delete.
- **Color Fill Legend:** `color_fill_legend` element placed on a plan view; scheme = field on `room` (e.g. `Zone Program`); floor plan fills rooms automatically. Legend box shows color ↔ value mapping.
- **Room upper limit + volume:** Room stores `upperLimitLevelId` + `upperLimitOffsetMm`; `volumeM3` derived from area × height.

### WP-V2-10 — Parameters + Shared Parameters

**Scope:**
- **Shared Parameters:** `SharedParamFile` model with `groups[]` → `parameters[]` (name, dataType, GUID); backend stores/serves as project resource. UI: Manage → Shared Parameters dialog.
- **Project Parameters:** Assign a shared param (or internal param) to one or more categories; result appears in Inspector and schedules for those elements.
- **Calculate Totals:** Schedule field `aggregation: 'sum' | 'average' | 'min' | 'max' | 'count' | null`; rendered as footer row in schedule table.
- **Schedule Sorting/Grouping:** `sortFields[]` with `ascending` flag; `groupFields[]` with `showHeader` and `showBlankLine` flags; backend orders schedule rows accordingly.

---

## Wave 5 — Families + Collaboration

**Goal:** Family Editor MVP, Worksets, Copy/Monitor.

**Prompt files:** `spec/prompts/wave-05/` — create when Wave 4 is fully merged.

| WP | Title | State |
|---|---|---|
| WP-V2-11 | Family Editor V2 (template env, parametric dims + EQ, type params, void geometry, profile family) | `open` |
| WP-V2-12 | Collaboration V2 (Worksets, Copy/Monitor, Synchronize, Purge Unused, Starting View) | `open` |

### WP-V2-11 — Family Editor V2

**Scope:** Dedicated family editor mode (separate route `/family-editor`); family template chooser (Generic Model, Door, Window, Profile); reference planes with parametric dimensions and EQ symmetry constraint; named type parameters with formula support (`Glass Thickness = Width * 0.05`); void extrusion with `cutHost: true` flag; Profile family for use in hosted sweeps; Load into Project button → injects family into project's family library.

### WP-V2-12 — Collaboration V2

**Scope:**
- **Worksets:** Named worksets per project; `worksetId` on each element; Inspector shows Workset field; Properties panel allows batch workset assignment via multi-select.
- **Copy/Monitor:** Select a linked model → copy level/grid elements into host model with `monitorSourceId` pointer; change detection marks monitored element with warning badge when source changes.
- **Purge Unused:** API endpoint that removes unreferenced types/materials/families; UI confirms list before deletion; runs 3 passes for nested objects.
- **Starting View:** Project setting — which view opens on file load.

---

## Wave 6 — Coordination + Export

**Goal:** Selection Sets, Clash Detection, NWC/coordination bundle export.

**Prompt files:** `spec/prompts/wave-06/` — create when Wave 5 is fully merged.

| WP | Title | State |
|---|---|---|
| WP-V2-13 | Coordination + Clash Detection (Selection Sets, Find Items by Rule, Clash Test, Viewpoints) | `open` |

### WP-V2-13 — Coordination + Clash Detection

**Scope:**
- **Selection Sets:** Named saved selections by filter rule (Category = X, Level = Y, TypeName contains Z); stored per-project; accessible from Project Browser.
- **Find Items by Rule:** Select Same Type / Select Same Level / Select Same Category from right-click context menu.
- **Clash Detection:** Clash test configuration (Set A vs Set B, tolerance mm); `POST /api/models/:id/clash-tests` runs server-side AABB + mesh proximity test; results list with element pair + distance; clicking a result flies the 3D camera to the clash location.
- **Viewpoints with saved visibility state:** Extend existing viewpoint schema to include `hiddenElementIds[]` and `isolatedElementIds[]`; restore on viewpoint activation.

---

## Consolidated Parity Dashboard

*Updated 2026-05-06. Percentages are directional, not release-gate claims.*

| Area | Wave 1 target | Current | After Wave 1 |
|---|---|---|---|
| Plan canvas (2D) | B01–B03 closed | ~75% | ~90% |
| Tool interaction grammar | Options bar, modify tools | ~35% | ~60% |
| Residential semantic kernel | — | ~42% | ~42% |
| View Control / documentation | Wave 2 | ~15% | ~15% |
| Wall system depth | Wave 2 | ~40% | ~40% |
| Structural elements | Wave 3 | ~20% | ~20% |
| Curtain wall | Wave 3 | ~10% | ~10% |
| Rooms + area | Wave 4 | ~30% | ~30% |
| Parameters + schedules | Wave 4 | ~50% | ~50% |
| Families | Wave 5 | ~5% | ~5% |
| Collaboration | Wave 5 | ~20% | ~20% |
| Coordination / clash | Wave 6 | ~5% | ~5% |

---

## Update Protocol

1. When a WP is completed: change `open` → `done` in the table, note the merge commit SHA and date.
2. When starting a wave: create `spec/prompts/wave-NN/` with one file per WP plus a `README.md`.
3. When a wave is fully merged: delete `spec/prompts/wave-NN/` and commit the deletion.
4. Do not edit closed-wave sections; the sprint ledger in `spec/revit-production-parity-workpackage-tracker.md` remains the audit trail for older work.
