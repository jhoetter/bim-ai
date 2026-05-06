# BIM AI — Master Workpackage Tracker

> **Prompt files** for each active wave live in `spec/prompts/wave-NN/`. After a wave is fully merged, delete that directory and commit the deletion.

---

## Status Legend

| Symbol     | Meaning                                                         |
| ---------- | --------------------------------------------------------------- |
| `done`     | Meets the done rule — tested, type-clean, merged to main        |
| `partial`  | Some slice exists; measurable progress; spec requirements unmet |
| `open`     | Not started                                                     |
| `deferred` | Explicitly out of scope for current roadmap                     |

## Done Rule

A workpackage is `done` when all of: (a) TypeScript typechecks clean (`pnpm exec tsc --noEmit`); (b) all new logic has vitest unit coverage; (c) `make verify` passes; (d) merged to main and pushed.

---

## Wave Map — Overview

| Wave                                       | Theme                                              | Status      |
| ------------------------------------------ | -------------------------------------------------- | ----------- |
| Wave 0                                     | Meta / Bootstrap — tracker, docs                   | `done`      |
| Wave 1                                     | Interaction Foundation + Plan Canvas               | `done`      |
| Wave 2                                     | View System + Wall Depth + Openings                | `done`      |
| [Wave 3](#wave-3--element-depth)           | Element Depth (Structural, Curtain Wall, Ceilings) | `done`      |
| [Wave 4](#wave-4--data-layer)              | Data Layer (Rooms V2, Parameters, Schedules)       | `done`      |
| [Wave 5](#wave-5--families--collaboration) | Families + Collaboration                           | **CURRENT** |
| [Wave 6](#wave-6--coordination--export)    | Coordination + Export                              | `open`      |

_Waves 0–2 fully merged to main. Prompt files deleted._

---

## Wave 3 — Element Depth

**Goal:** Add structural columns/beams, curtain wall grid config, and ceilings.

**Prompt files:** `spec/prompts/wave-03/`

### Execution order

```
Batch A (parallel — changes in different file sections):
  WP-V2-07    feat/wp-v2-07-curtain-wall    core/index.ts wall block, meshBuilders inner, i18n inspector.fields
  WP-V2-06    feat/wp-v2-06-structural      core/index.ts ElemKind+union, tool chain, meshBuilders end, i18n tools

Batch B (after A merged):
  WP-V2-08    feat/wp-v2-08-ceilings        depends on column/beam entries added by WP-V2-06
```

| WP       | Title                                                            | Branch                       | State  | Depends on      |
| -------- | ---------------------------------------------------------------- | ---------------------------- | ------ | --------------- |
| WP-V2-07 | Curtain Wall grid params + Inspector (vCount/hCount fields)      | `feat/wp-v2-07-curtain-wall` | `done` | —               |
| WP-V2-06 | Structural Elements (column + beam: types, tools, mesh builders) | `feat/wp-v2-06-structural`   | `done` | —               |
| WP-V2-08 | Ceilings (sketch ceiling, plan outline, 3D slab)                 | `feat/wp-v2-08-ceilings`     | `done` | WP-V2-06 merged |

---

## Wave 4 — Data Layer

**Goal:** Rooms V2, Shared Parameters, schedule depth (sorting/grouping/totals, Color Fill Legend).

**Prompt files:** `spec/prompts/wave-04/`

| WP       | Title                                                                                                   | State  |
| -------- | ------------------------------------------------------------------------------------------------------- | ------ |
| WP-V2-09 | Room + Area V2 (Room Bounding, Color Fill, separation lines, deletion via schedule)                     | `done` |
| WP-V2-10 | Parameters + Shared Parameters (Shared Params file, Project Params, Calculate Totals, Sorting/Grouping) | `done` |

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

**Prompt files:** `spec/prompts/wave-05/` — ready. Both WPs run in parallel (Batch A).

| WP       | Title                                                                                             | State  |
| -------- | ------------------------------------------------------------------------------------------------- | ------ |
| WP-V2-11 | Family Editor V2 (template env, parametric dims + EQ, type params, void geometry, profile family) | `open` |
| WP-V2-12 | Collaboration V2 (Worksets, Copy/Monitor, Synchronize, Purge Unused, Starting View)               | `open` |

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

| WP       | Title                                                                                       | State  |
| -------- | ------------------------------------------------------------------------------------------- | ------ |
| WP-V2-13 | Coordination + Clash Detection (Selection Sets, Find Items by Rule, Clash Test, Viewpoints) | `open` |

### WP-V2-13 — Coordination + Clash Detection

**Scope:**

- **Selection Sets:** Named saved selections by filter rule (Category = X, Level = Y, TypeName contains Z); stored per-project; accessible from Project Browser.
- **Find Items by Rule:** Select Same Type / Select Same Level / Select Same Category from right-click context menu.
- **Clash Detection:** Clash test configuration (Set A vs Set B, tolerance mm); `POST /api/models/:id/clash-tests` runs server-side AABB + mesh proximity test; results list with element pair + distance; clicking a result flies the 3D camera to the clash location.
- **Viewpoints with saved visibility state:** Extend existing viewpoint schema to include `hiddenElementIds[]` and `isolatedElementIds[]`; restore on viewpoint activation.

---

## Update Protocol

1. When a WP is completed: change `open` → `done` in the table.
2. When starting a wave: create `spec/prompts/wave-NN/` with one file per WP plus a `README.md`.
3. When a wave is fully merged: delete `spec/prompts/wave-NN/` and commit the deletion.
