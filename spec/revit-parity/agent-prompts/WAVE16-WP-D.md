# Wave 16 — WP-D: Scale Tool (§3.3.6 — P0 gap)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/tools/toolRegistry.ts          — ToolId union
packages/web/src/tools/toolGrammar.ts           — tool state machines
packages/web/src/plan/PlanCanvas.tsx            — click/keyboard dispatch
packages/web/src/workspace/Workspace.tsx         — semantic command handlers
packages/web/src/cmdPalette/defaultCommands.ts  — palette commands
packages/core/src/index.ts                       — element/command types
```

Read the rotate tool (`rotateTool.ts` or similar) and mirror tool as patterns for transform tools.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `toolRegistry.ts`: find existing transform tools (`'move'`, `'rotate'`, `'mirror'`). Note the convention.
2. Search `toolGrammar.ts` for `RotateState` or `MirrorState` — read the pattern for transform grammars.
3. `core/index.ts`: find `ScaleElementCmd` or similar — if it exists, read it; if not, add it.
4. Check if `'scale'` ToolId already exists in toolRegistry.ts. If so, note what hotkey it has. **Use `'SZ'` as the hotkey** (not `SC` which is steel connection).

---

## Tasks

### A — ToolId + command type

In `toolRegistry.ts`, add `'scale'` to the ToolId union. Register:
```ts
{ id: 'scale', hotkey: 'SZ', label: 'Scale', mode: 'plan' }
```
Add to `MODIFY_TOOL_IDS` set (or equivalent group) and `PALETTE_ORDER`.

In `core/index.ts`, add (if not present):
```ts
| { type: 'scaleElements'; elementIds: string[]; basePtMm: { xMm: number; yMm: number }; scaleFactor: number }
```

---

### B — Grammar `toolGrammar.ts`

Add `ScaleState`, `ScaleEvent`, `ScaleEffect`, `initialScaleState`, `reduceScale`:

States: `idle → picking-base → picking-reference → scaling`

Flow:
1. **idle**: tool is selected (selection must be non-empty)
2. **picking-base**: user clicks to set the base point (`basePtMm`)
3. **picking-reference**: user clicks to set the reference point (`refPtMm`); the reference distance = `dist(basePt, refPt)`
4. **scaling**: user types a scale factor in the OptionsBar numeric input and presses Enter, OR clicks a second point and the scale = `newDist / refDist`; emit `{ kind: 'scaleElements', basePtMm, scaleFactor }`

Escape from any state → idle.

For the numeric-input shortcut: if in `picking-reference` state, allow user to type a number (e.g. `2`) and press Enter to apply that scale factor directly.

---

### C — PlanCanvas wiring

Wire `reduceScale` into `PlanCanvas.tsx`:
- On tool activate → `scaleState = initialScaleState`
- On click → `reduceScale(scaleState, { type: 'click', ptMm })` → update state
- On Escape → reset
- On Enter with numeric value from OptionsBar → emit scale effect
- On effect `scaleElements` → `onSemanticCommand({ type: 'scaleElements', ... })`

---

### D — Workspace handler

In `Workspace.tsx`, handle `type: 'scaleElements'`:
```ts
if (cmd.type === 'scaleElements') {
  const { elementIds, basePtMm, scaleFactor } = cmd;
  for (const id of elementIds) {
    const el = elementsById[id];
    if (!el || !('positionMm' in el)) continue;
    // Scale positionMm relative to basePtMm
    const dx = (el.positionMm.xMm - basePtMm.xMm) * scaleFactor;
    const dy = (el.positionMm.yMm - basePtMm.yMm) * scaleFactor;
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: id,
      key: 'positionMm',
      value: { xMm: basePtMm.xMm + dx, yMm: basePtMm.yMm + dy },
    });
    // Also scale dimension fields if present (lengthMm, widthMm, heightMm, radiusMm)
    for (const field of ['lengthMm', 'widthMm', 'radiusMm'] as const) {
      if (field in el) {
        void onSemanticCommand({
          type: 'updateElementProperty',
          elementId: id,
          key: field,
          value: (el as Record<string, unknown>)[field] as number * scaleFactor,
        });
      }
    }
  }
}
```

---

### E — Palette command

In `defaultCommands.ts`:
```ts
{ id: 'tool.scale', label: 'Scale', keywords: ['scale', 'resize', 'transform'], category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'scale') }
```

---

### F — Tests

`packages/web/src/plan/scaleTool.test.ts`:
```ts
describe('scale tool grammar — §3.3.6', () => {
  it('starts in idle state', () => { ... });
  it('first click sets base point → picking-reference state', () => { ... });
  it('second click emits scaleElements effect with correct scaleFactor', () => { ... });
  it('numeric factor input emits scaleElements with that factor', () => { ... });
  it('Escape from picking-base returns to idle', () => { ... });
});
```

`packages/web/src/plan/scaleElements.test.ts`:
```ts
describe('scaleElements handler', () => {
  it('scales positionMm relative to basePt', () => {
    const basePt = { xMm: 0, yMm: 0 };
    const el = { positionMm: { xMm: 1000, yMm: 0 }, lengthMm: 500 };
    // After scaleFactor=2: positionMm = { xMm: 2000, yMm: 0 }, lengthMm = 1000
    ...
  });
  it('uniform scale preserves direction', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/D): scale tool — pick-base + pick-ref + numeric input (§3.3.6)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new scale tool tests.
