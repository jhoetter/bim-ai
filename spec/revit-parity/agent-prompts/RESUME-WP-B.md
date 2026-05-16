# WP-B Resume — Modify Toolset Completion & Model Groups

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained.

---

## Repo orientation (WP-B relevant paths)

```
packages/web/src/tools/toolRegistry.ts     — ToolId union + TOOL_REGISTRY
packages/web/src/tools/toolGrammar.ts      — per-tool grammar
packages/web/src/plan/moveTool.ts          — reference pattern for tool grammar
packages/web/src/plan/arrayTool.ts         — array math helpers (already done)
packages/web/src/plan/createSimilar.ts     — already done
packages/web/src/plan/joinGeometry.ts      — command helpers already done
packages/web/src/plan/gripProtocol.ts      — grip interaction protocol
packages/web/src/plan/GripLayer.tsx        — grip rendering
packages/web/src/clipboard/copyToLevels.ts — paste-to-levels command (already done)
packages/web/src/clipboard/clipboardStore.ts — clipboard Zustand store
packages/web/src/groups/groupTypes.ts      — GroupDefinition, GroupInstance types (done)
packages/web/src/groups/groupCommands.ts   — pure group command logic (done)
packages/web/src/state/                    — Zustand store slices
```

Architecture patterns:
- **Semantic commands**: `onSemanticCommand({ type: 'moveElement', elementId, deltaXMm, deltaYMm })`.
  Study `moveTool.ts` for exact shape.
- **Store**: access project model via `useBimStore`. State mutations go through
  the command queue in `commandQueue.ts`.
- **Tests**: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically after every Edit/Write.

---

## What was done before the crash

| Sub-task | Status | Files |
|---|---|---|
| B4 Create Similar | **Done** | `plan/createSimilar.ts` + tests |
| B5 Array math | **Partial** | `plan/arrayTool.ts` + tests — math done, PlanCanvas wiring pending |
| B7 Join/Unjoin helpers | **Partial** | `plan/joinGeometry.ts` + tests — helpers done, toolbar UI pending |
| B2 Group types + commands | **Partial** | `groups/groupTypes.ts`, `groups/groupCommands.ts`, `groups/groupCommands.test.ts` — pure logic done, zero UI |
| B3 copyToLevels command | **Partial** | `clipboard/copyToLevels.ts` + `copyToLevels.test.ts` — command done, dialog UI pending |

ToolId scaffold committed: `'scale'`, `'array'`, `'place-group'` are already
in the `ToolId` union in `toolRegistry.ts`. Verify their registry entries
exist; if not, add them.

---

## What still needs to be done

### B1 — Scale Tool grammar + command handler

`'scale'` is in the ToolId union. Add the full implementation:

1. Grammar in `tools/scale.ts`:
   - After elements are selected, activate Scale
   - Step 1: pick origin point
   - Step 2: type a numeric factor + Enter, OR graphically pick a reference
     length (two clicks define from→to, scale = to/from)
   - Live canvas preview of scaled geometry during input

2. Command handler for `scaleElement`:
   - Walls: scale endpoint coordinates relative to origin
   - Family instances (door/window/column/beam): scale insertion point + size params

3. Tests: scale a wall from origin, verify endpoints; scale a door instance

### B2 — Model Groups UI wiring

Pure logic in `groups/` is done. Now wire it into the app:

1. **"Create Group" action** — appears in selection toolbar when ≥2 elements
   are selected. Prompts for group name. Dispatches `createGroup` command.

2. **`'place-group'` tool grammar** — options bar shows a dropdown of available
   group definitions (read from store). Click places a `group_instance`.

3. **Plan renderer** `plan/groupInstanceRender.ts` — renders grouped elements
   at their transformed positions. Dashed rectangle boundary when selected.

4. **3D renderer** `viewport/groupInstance3d.ts` — transforms definition
   element geometry by the instance insertion/rotation.

5. **Group edit mode** — when "Edit Group" button is clicked in inspector:
   all non-group elements ghost out, only group members are editable. On
   "Finish Editing", all instances update.

6. **Inspector** on `group_instance`: group name, rotation, "Edit Group" button,
   "Ungroup" button, "Select All Instances" button.

7. **Project browser** "Groups" subtree listing definitions + instance counts.

Tests: create group from 2 walls, place second instance, verify both render,
ungroup one, verify elements are independent.

### B3 — Paste to Levels dialog

`copyToLevels.ts` command exists. Wire the UI:
- "Copy to Levels…" button in the selection toolbar
- Opens a level picker dialog (list all project levels with checkboxes)
- On confirm, dispatches `copyToLevels` command
- Also wire `Ctrl+C` on selection → store element IDs in `clipboardStore`;
  verify `Ctrl+V` pastes at cursor (check `clipboard/copyPaste.ts`)

### B5 — Array tool PlanCanvas wiring

`arrayTool.ts` math helpers exist. Still needed:
- Full grammar in `tools/array.ts` (if not yet there — check first):
  - Linear: select → activate → pick start → pick end → type count → Enter
  - Radial: options bar toggle → pick centre → type angle + count → Enter
  - Options bar: Number field, "Move To: 2nd / Last" toggle
- Live canvas preview
- Tests: linear array of 3 columns at 5000mm, verify positions

### B6 — Selection Filter Dialog

Not started. Implement:
- `plan/selectionFilter.tsx`: modal listing category counts (Walls 6, Doors 3…),
  each row with a checkbox. Unchecking deselects those elements.
- "Filter" chip in the selection toolbar showing "N elements selected"
- `deselectByCategory` action dispatched from the dialog
- "Select All Instances in Project" context action: deselects all, then
  re-selects every element sharing the same `typeId`

### B7 — Join/Unjoin toolbar UI

`joinGeometry.ts` helpers exist. Still needed:
- "Join" selection action (appears when ≥2 solid elements selected):
  dispatches `{ type: 'joinGeometry', elementId1, elementId2 }`
- "Unjoin" selection action: clears the join
- Small "join" glyph rendered at the junction in plan view when joined

### B8 — Pin/Unpin toolbar

`pinUnpin.ts` command helpers + `PN` cheatsheet shortcut already exist.
Still needed:
- `PN` keyboard shortcut → pins all selected elements (currently in
  cheatsheet but not wired to an action)
- "Unpin All" button in selection toolbar
- Padlock icon glyph in plan canvas for pinned elements (check
  `PlanCanvas.padlock.test.tsx` for what's expected — complete the rendering)

---

## Rules

- `git pull --rebase origin main` before every major sub-task
- Commit + push after each completed sub-task
- Do NOT touch stair/ramp, annotation/dimension, export, phase, structural,
  or massing files
- `toolRegistry.ts` is shared — always rebase before editing
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
