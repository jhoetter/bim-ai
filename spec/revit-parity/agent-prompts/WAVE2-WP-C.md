# Wave 2 — WP-C: Attach Top/Base Grammar + Curtain Wall Grid Editing

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/tools/toolGrammar.ts               — per-tool grammar state machines
packages/web/src/plan/PlanCanvas.tsx                — main plan interaction handler
packages/web/src/tools/toolRegistry.ts              — ToolId union + TOOL_REGISTRY
packages/core/src/index.ts                          — Element union + ElemKind
packages/web/src/plan/curtainWallPlanSymbol.ts      — curtain wall tick-mark plan symbol
packages/web/src/viewport/meshBuilders.ts           — 3D mesh dispatcher
packages/web/src/viewport/meshBuilders.attachWallTop.test.ts — expected attach behaviour
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.

---

## What wave 1 already built — DO NOT rebuild these

- `'attach'` and `'detach'` ToolIds in toolRegistry.ts with labels, tooltips, hotkeys
- `meshBuilders.attachWallTop.test.ts` — read this to understand expected attach behaviour
- `curtainWallData` compound on wall element in core:
  `{ hGridCount, vGridCount, panelType?, mullionType? }`
- `curtainWallPlanSymbol.ts` renders tick marks in plan; wired via `rebuildPlanMeshes`; 4 tests pass
- `isCurtainWall: boolean` flag on wall elements

---

## Tasks

### C1 — Attach Top/Base grammar + command handler

**C1a. Grammar** — Add `AttachState` / `reduceAttach` to `toolGrammar.ts`:
```
idle
  → click on a wall → picking-target (store wallId)
picking-target
  → click on a roof/floor/ceiling → done (emit effect)
  → Escape → idle
```
Effect on done: `{ kind: 'attachWallTop', wallId, targetId }`

Add a parallel `DetachState` / `reduceDetach` for the `'detach'` tool:
```
idle → click on an attached wall → done: { kind: 'detachWallTop', wallId }
```

**C1b. Command handlers**: In the command queue (search for where `attachWallTop` would go —
study `commandHandlers.ts` or equivalent):
- `attachWallTop`: find the wall element; find the target element's top Z at the wall's XY
  position; set `wall.topConstraint = { kind: 'attached', targetId, topZ }` (add this field
  to the wall element type in core/index.ts if it doesn't exist)
- `detachWallTop`: clear `wall.topConstraint`

**C1c. PlanCanvas wiring**: Add `case 'attach':` and `case 'detach':` in PlanCanvas.tsx
routing events through the grammars. Study `case 'scale':` as the pattern.

Read `meshBuilders.attachWallTop.test.ts` first — implement what the tests expect.

Tests: write at least these:
- Grammar sequence: idle → click wall (id=w1) → click roof (id=r1) → effect is
  `{ kind: 'attachWallTop', wallId: 'w1', targetId: 'r1' }`
- Detach sequence: idle → click wall → effect is `{ kind: 'detachWallTop', wallId: 'w1' }`

Update tracker §8.1.1: "Implemented — attach/detach grammar + command handlers done"

---

### C2 — Curtain wall interactive grid editing

**C2a. Inspector panel**: When a wall with `isCurtainWall: true` is selected, show:
- H grid count (number input) — updates `curtainWallData.hGridCount`
- V grid count (number input) — updates `curtainWallData.vGridCount`
- Panel type dropdown (options: "Glass", "Spandrel", "Solid") — updates `curtainWallData.panelType`
- Mullion type dropdown (options: "Rectangular", "Circular", "None") — updates `curtainWallData.mullionType`
- "Edit Grid…" button (opens edit mode — see C2b)

Dispatches `{ type: 'updateElement', id, patch: { curtainWallData: { ...patch } } }`.
Study existing wall inspector for how wall properties are edited.

**C2b. Edit Grid mode**: Clicking "Edit Grid…" activates a plan-view mode where:
- The selected curtain wall is highlighted
- User clicks along the wall face in plan to add a custom V-division line at that position
  (expressed as `t ∈ [0,1]` along the wall length)
- The division line appears immediately as a preview tick mark
- Escape or clicking "Finish Editing" exits the mode and persists via
  `{ type: 'updateElement', id, patch: { curtainWallData: { customVDivisions: [...t] } } }`

Add `customVDivisions?: number[]` to the `curtainWallData` type in core/index.ts if not present.
Update `curtainWallPlanSymbol.ts` to render custom division ticks alongside the uniform ones.

Tests:
- Inspector renders H/V count inputs for isCurtainWall walls
- Updating hGridCount dispatches the correct updateElement command
- customVDivisions=[] falls back to uniform vGridCount ticks; [0.3] adds a tick at 30%

Update tracker §8.1.4: "Implemented — inspector + custom grid editing done"

---

## Rules

- `git pull --rebase origin main` before editing `toolGrammar.ts` or `PlanCanvas.tsx`
  (WP-B and WP-E also touch these files — rebase is critical)
- Commit + push after each completed task (C1 and C2 separately)
- DO NOT touch group renderers, IFC export, annotation grips, sloped columns
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
