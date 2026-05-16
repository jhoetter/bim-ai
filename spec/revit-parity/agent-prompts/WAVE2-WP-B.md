# Wave 2 — WP-B: Array PlanCanvas Wiring + Group Renderers

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/PlanCanvas.tsx                — main plan interaction handler
packages/web/src/tools/toolGrammar.ts               — per-tool grammar state machines
packages/web/src/plan/planElementMeshBuilders.ts    — dispatches plan symbols per element
packages/web/src/groups/groupCommands.ts            — applyCreateGroup, applyPlaceGroup etc.
packages/web/src/groups/groupTypes.ts               — GroupDefinition, GroupInstance types
packages/web/src/state/                             — Zustand store slices
packages/web/src/workspace/project/ProjectBrowser.tsx — project browser tree
packages/web/src/viewport/meshBuilders.ts           — 3D mesh dispatcher
packages/web/src/tools/toolRegistry.ts              — ToolId union + TOOL_REGISTRY
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `ArrayState` / `reduceArray` grammar in `toolGrammar.ts` — 14 tests, linear + radial
- `'array'` ToolId in toolRegistry.ts
- `GroupRegistry` (definitions + instances) in Zustand store (`StoreState.groupRegistry`)
- `CreateGroupDialog.tsx` wired to `model.create-group` palette command (Cmd+K)
- `applyCreateGroup`, `applyPlaceGroup`, `applyUngroupElements` in `groupCommands.ts` — 21 tests
- `'place-group'` ToolId in toolRegistry.ts
- Scale tool PlanCanvas wiring is DONE — **study `case 'scale':` in PlanCanvas.tsx as the pattern**

---

## Tasks

### B1 — Array tool PlanCanvas wiring

The grammar (`ArrayState`/`reduceArray`) is complete but not dispatched from PlanCanvas.
Find `case 'scale':` in PlanCanvas.tsx and add a parallel `case 'array':` block that:
- Routes mousedown/mouseup/mousemove/keydown events through `reduceArray`
- Passes `activeTool === 'array'` to the relevant sections (copy exactly how scale does it)
- On the grammar's `effect.kind === 'createLinearArray'` or `'createRadialArray'`, dispatch
  the corresponding semantic command through the command queue

Also wire the options bar for array: show "Count" number input and "Linear / Radial" toggle.
Study how the scale tool's options bar works.

Tests: confirm `pnpm test --filter @bim-ai/web -- arrayTool` still passes after wiring.

Update tracker §3.3.6 Array: "Implemented (WP-B wave 2)"

---

### B2 — Group plan renderer

Create `packages/web/src/plan/groupInstanceRender.ts`:
- For each `group_instance` element in the current view, compute the bounding rectangle
  of all definition-member elements at their transformed positions
- Render a dashed rectangle in plan at the group instance position
- When the instance is selected, render with selection highlight colour
- Export a function `buildGroupInstancePlanMesh(instance, registry, scene)` following
  the same pattern as other plan symbol builders

Call this from `planElementMeshBuilders.ts` for elements with `kind === 'group_instance'`.

Tests:
- Given a GroupInstance and a GroupDefinition with two walls, buildGroupInstancePlanMesh
  returns a dashed rectangle geometry at the correct position

---

### B3 — Group 3D renderer

Create `packages/web/src/viewport/groupInstance3d.ts`:
- For each `group_instance` element, retrieve its `GroupDefinition` from the registry
- Apply the instance's insertion point + rotation as a Three.js Matrix4
- For each element in the definition, call the existing mesh builder for that element type
  at the transformed position
- Return a Three.js Group containing all child meshes

Dispatch this from `meshBuilders.ts` for `kind === 'group_instance'`.

---

### B4 — Place-group grammar

Add `PlaceGroupState` / `reducePlaceGroup` to `toolGrammar.ts`:
- `idle` → user clicks in plan → `{ type: 'placeGroup', definitionId, positionMm }`
- The options bar shows a dropdown of available group definitions from `groupRegistry`
  (pass registry into the grammar or read from store in PlanCanvas handler)
- Wire in PlanCanvas.tsx `case 'place-group':` following the scale/array pattern

---

### B5 — Groups subtree in ProjectBrowser

In `ProjectBrowser.tsx` (or `ProjectBrowserV3.tsx`), add a "Groups" tree node:
- Lists all `GroupDefinition` entries from `groupRegistry` by name
- Shows instance count as a badge: "Wall Cluster (3)"
- Right-click context menu: "Rename", "Select All Instances", "Delete"
- Study the "Families" subtree as the exact pattern to follow

---

## Rules

- `git pull --rebase origin main` before editing `toolGrammar.ts` or `PlanCanvas.tsx`
  (other wave-2 agents also touch these files)
- Commit + push after each completed task
- DO NOT touch IFC export, curtain wall, attach grammar, annotation grips, or core/index.ts
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
