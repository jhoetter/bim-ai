# WP-B — Modify Toolset Completion & Model Groups

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/tools/toolRegistry.ts` — ToolId union + TOOL_REGISTRY array
- `packages/web/src/tools/toolGrammar.ts` — per-tool grammar logic
- `packages/web/src/plan/moveTool.ts` — existing Move tool (use as reference pattern)
- `packages/web/src/plan/rotateTool.ts` — existing Rotate tool (use as reference pattern)
- `packages/web/src/plan/wallOffsetTool.ts` — existing Offset tool (use as reference)
- `packages/web/src/plan/wallChainSelection.ts` — chain selection helper
- `packages/web/src/plan/gripProtocol.ts` — grip interaction protocol
- `packages/web/src/plan/GripLayer.tsx` — grip rendering in plan
- `packages/web/src/viewport/grip3d.ts` — grip logic in 3D
- `packages/web/src/plan/autoDimension.ts` — see how semantic commands are shaped
- `packages/core/src/` — Element types, XY, etc.
- `packages/web/src/clipboard/` — existing clipboard directory (check what exists)

Architecture patterns:
- Semantic commands: `{ type: 'moveElement', elementId, deltaXMm, deltaYMm }` dispatched via `onSemanticCommand`. Study moveTool.ts for exact shape.
- All tools: add ToolId → toolRegistry.ts, grammar in tools/<name>.ts, renderers in plan/<name>*.ts.
- Tests co-located as `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically after every Edit/Write.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before starting each sub-task.
2. Commit + push after every completed sub-feature.
3. `git pull --rebase origin main && git push origin main` after each commit.
4. Do NOT touch: stair/ramp files, annotation/dimension tools, export code, phase dialogs, structural files, massing files. Those belong to other WPs.
5. `toolRegistry.ts` is a shared file — always rebase before editing it.

## Your Mission

Implement the modify-toolset completion items and model groups system. These cover tracker entries from Chapters 3, 8.9, and parts of 2. Work through all sub-tasks below, spawning sub-agents for parallel implementation where the sub-tasks are independent.

---

### Sub-task B1: Scale Tool

New ToolId: `'scale'`

Revit's Scale command resizes one or more selected elements about a defined origin point, either numerically or graphically.

- Add `'scale'` to ToolId and TOOL_REGISTRY (hotkey: `RE`, icon: `scale`)
- Grammar: user selects elements first (existing select tool), then activates Scale. Step 1: pick origin point. Step 2: either type a numeric scale factor (e.g. `2.0`) and press Enter, OR pick a reference length and then a new length graphically (two clicks define "from → to" distance, scale = to/from ratio).
- The tool emits a batch of semantic commands: for each selected element, `{ type: 'scaleElement', elementId, originXMm, originYMm, factor }`.
- Implement the `scaleElement` command handler: for walls, scale endpoint coordinates relative to origin; for family instances, scale the insertion point + any explicit width/height/depth parameters.
- Plan renderer: show a live preview of the scaled geometry while the user is picking.
- Tests: scale a wall from origin, verify endpoints; scale a door/window instance.

### Sub-task B2: Model Groups (Create, Place, Edit, Ungroup)

Model groups are named collections of elements that can be instanced multiple times (like AutoCAD blocks or Revit groups). This is a substantial feature.

Data model:
- New element type `group_definition`: `{ id, name, elementIds: string[], originXMm, originYMm }` — defines the group geometry relative to its local origin.
- New element type `group_instance`: `{ id, groupDefinitionId, insertionXMm, insertionYMm, rotationDeg }` — a placed reference to a definition.
- Store group definitions in the project model alongside regular elements.

Commands needed (implement handlers for all):
- `{ type: 'createGroup', name, elementIds, originXMm, originYMm }` → creates a `group_definition` and converts the source elements into the first `group_instance` at origin offset 0,0.
- `{ type: 'placeGroup', groupDefinitionId, insertionXMm, insertionYMm, rotationDeg }` → creates a new `group_instance`.
- `{ type: 'ungroupElements', groupInstanceId }` → explodes the instance into individual unlinked elements at the current insertion position/rotation.
- `{ type: 'editGroup', groupDefinitionId }` → enters "group edit mode" (see below).
- `{ type: 'finishEditGroup' }` → exits group edit mode.
- `{ type: 'renameGroup', groupDefinitionId, name }` → renames the definition.

Group edit mode: when active, only the elements of the currently edited group definition are shown and editable. All other elements are ghosted. Moving/deleting elements in edit mode modifies the `group_definition.elementIds` and the relative positions of those elements. On `finishEditGroup`, all other instances update to reflect the changes.

UI:
- "Create Group" appears in the selection context when ≥2 elements are selected (toolbar button or right-click menu). Prompts for a group name.
- Tool `'place-group'` in toolRegistry — activates a picker mode where the user clicks to place group instances. The options bar shows a dropdown of available group definitions.
- When a `group_instance` is selected: inspector shows group name, rotation, a "Edit Group" button, an "Ungroup" button, and a "Select All Instances" button.
- Plan renderer: `plan/groupInstanceRender.ts` — renders grouped elements at their transformed positions. Group boundary shown as dashed rectangle when selected.
- 3D: `viewport/groupInstance3d.ts` — renders group instances in 3D by transforming the definition element geometry.
- Project browser: a "Groups" subtree showing all defined groups and their instance count.

Tests: create a group from 2 walls, place a second instance, verify both render, ungroup one instance, verify elements are independent.

### Sub-task B3: Clipboard Paste Aligned to Selected Levels

Revit's "Paste Aligned to Selected Levels" copies a selection from one level to multiple target levels in a single operation.

- Implement a `copyToLevels` command: `{ type: 'copyElementsToLevels', elementIds: string[], sourceLevelId: string, targetLevelIds: string[] }`. The command replicates each element at the same plan X/Y position but rebased to each target level's elevation.
- UI: in the selection toolbar (or clipboard menu) add a "Copy to Levels…" button that opens a level picker dialog listing all project levels with checkboxes. On confirm, dispatch `copyToLevels`.
- For walls: new copies get `baseLevelId = targetLevelId` and inherit the same height constraint. For floors: `levelId` is updated. For doors/windows: `hostId` updated to the wall copy on that level.

### Sub-task B4: Create Similar

When an element is selected, "Create Similar" activates the appropriate placement tool pre-loaded with the same type as the selected element.

- Add a "Create Similar" action to the selection toolbar and inspector.
- Pressing `CS` (Revit default shortcut) while an element is selected triggers this.
- Implementation: read `selectedElement.typeId`, activate the matching tool (wall → wall tool, door → door tool, etc.), pre-select that type in the options bar.
- Add `'CS'` to cheatsheetData.ts.

### Sub-task B5: Array Tool (Linear and Radial) in Project Environment

The ArrayTool already exists in `familyEditor/ArrayTool.test.tsx` context. Bring it to the main project environment.

New ToolId: `'array'` (hotkey `AR`)

Linear array:
- Grammar: select elements → activate array → pick start point → pick end point (defines array direction + spacing from element-to-element) → type number of copies → Enter.
- Emits N copies of each selected element offset by the vector × index.
- Options bar: "Number" field, "Move To: 2nd / Last" toggle (whether the distance is to the 2nd copy or the last).

Radial array:
- Grammar: select elements → array → switch to Radial in options bar → pick rotation centre → type angle and count → Enter.
- Emits N copies rotated around the centre.

Both modes:
- Live preview on canvas during input.
- Result elements are independent (not grouped unless the user also groups).
- Tests: linear array of 3 columns at 5000mm spacing, verify positions; radial array of 6 windows around a centre.

### Sub-task B6: Selection Filter Dialog

Revit's selection filter lets the user narrow box-selection by category (walls only, doors only, etc.).

- When multiple elements are selected, a "Filter" chip appears in the selection toolbar showing e.g. "14 elements selected".
- Clicking it opens a dialog listing category counts: Walls (6), Doors (3), Windows (2), Floors (1), Other (2) — each with a checkbox. Unchecking a category deselects those elements.
- Implementation: `plan/selectionFilter.tsx` — a modal dialog driven by the current selection set.
- State: selection is held in a Zustand slice; the filter dialog dispatches `deselectByCategory` to narrow it.
- "Select All Instances" context action: when one element is selected, a "Select All Instances in Project" button deselects everything and re-selects every element sharing the same `typeId`.

### Sub-task B7: "Join Geometry" and "Unjoin Geometry" as Explicit Tools

Currently join/unjoin happens automatically. Expose them as user commands.

- Selection action "Join" (appears when ≥2 solid elements are selected): dispatches `{ type: 'joinGeometry', elementId1, elementId2 }` which sets `joinedTo: [id2]` on element1. The wall/floor CSG system already handles joined geometry rendering — this task just makes the join/unjoin user-accessible.
- Selection action "Unjoin": clears the join.
- When elements are joined, a small "join" glyph appears at the junction in plan view.

### Sub-task B8: Pin and Unpin via Selection Toolbar

Pinning already exists in the inspector. Also expose it as a toolbar shortcut `PN` and add an unpin-all command.

- Keyboard shortcut `PN` → pins all selected elements.
- "Unpin All" in selection toolbar unpins the selection.
- Pinned elements show a padlock icon glyph in the plan canvas (already partially in PlanCanvas.padlock.test.tsx — complete the rendering).

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors
- ≥2 unit tests per new module
- Feature visible and functional in the plan view
- No regressions in existing tests
- Tracker entry updated in `spec/revit-parity/revit2026-parity-tracker.md`
