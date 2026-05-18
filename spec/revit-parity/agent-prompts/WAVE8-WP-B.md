# Wave 8 — WP-B: Split Element Tool (§3.3.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — wall element type, Element union, Command union
packages/web/src/tools/toolRegistry.ts                   — tool registration
packages/web/src/tools/toolGrammar.ts                    — grammar state machines
packages/web/src/plan/PlanCanvas.tsx                     — canvas wiring
packages/web/src/plan/wallGeometry.ts                    — wall geometry helpers (read for splitWall logic)
packages/web/src/workspace/commandCapabilities.ts        — capability registration
packages/web/src/cmdPalette/defaultCommands.ts           — palette command
packages/web/src/tools/authoringCommandContract.ts       — authoring contract (required)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `wall` element in `core/index.ts` — has `startMm: XY`, `endMm: XY`, `levelId`, `heightMm`, `typeId`, `thicknessMm` and many optional fields. Note all existing fields so the split clone preserves them.
- `wallGeometry.ts` — helper functions for wall geometry. Use `closestPointOnSegment` or similar to find the split point.
- Tool registration pattern: every new ToolId requires entry in `toolRegistry.ts` (ToolId union + registry entry), `authoringCommandContract.ts` (`AUTHORING_COMMAND_CONTRACTS`), and `defaultCommands.ts` (palette entry). All three or the capability test fails.

---

## Tasks

### A — split_wall command

In `core/index.ts`:

```ts
export type SplitWallCmd = {
  type: 'split_wall';
  wallId: string;
  /** The point on the wall centreline where the split occurs, in mm. */
  splitPointMm: XY;
};
```

Handle in `Workspace.tsx`:

- Find the wall by `wallId` in `elementsById`
- Project `splitPointMm` onto the wall centreline (startMm→endMm segment)
- Create two new walls: wallA (startMm → splitPoint) and wallB (splitPoint → endMm)
- Copy all other fields from the original wall to both halves
- Delete the original wall, add wallA and wallB to `elementsById`
- Both new walls get new `nanoid()` ids

### B — Tool registration

In `toolRegistry.ts`, add:

```ts
'split-wall': {
  id: 'split-wall',
  label: 'Split Wall',
  icon: 'split',
  hotkey: 'SL',
  shortcut: 'SL',
  modes: ['plan'],
  tooltip: 'Click on a wall to split it at that point (S → L).',
}
```

Add `'split-wall'` to the `ToolId` union. Add authoring contract in `authoringCommandContract.ts` (kind: 'place', completionBehavior: 'stay-active'). Add palette entry in `defaultCommands.ts`.

### C — Grammar state machine

In `toolGrammar.ts`, add `SplitWallState` and `reduceSplitWall`:

```ts
type SplitWallState =
  | { phase: 'idle' }
  | { phase: 'active'; hoverWallId: string | null; hoverPointMm: XY | null };
```

Events:

- `activate` → `active` with null hover
- `hoverWall(wallId, pointMm)` → updates hover state; emits `previewSplitPoint` effect
- `click(wallId, pointMm)` in `active` → emits `splitWall` effect with `{ wallId, splitPointMm: pointMm }`; stays in active (tool stays on for repeated splits)
- `cancel` / `deactivate` → idle

Wire into `PlanCanvas.tsx`:

- `case 'split-wall'`: on canvas mousemove, raycast to find the nearest wall under cursor → dispatch `hoverWall`; on canvas click dispatch `click`; Escape → `cancel`
- On `splitWall` effect: dispatch `{ type: 'split_wall', wallId, splitPointMm }`
- Draw a small cross/marker at `hoverPointMm` as preview

### D — Plan symbol: split indicator

When `planTool === 'split-wall'` and `hoverWallId` is set, draw a small vertical line (scissors indicator) crossing the wall at `hoverPointMm`. Use a dashed `THREE.Line` with red material, height = wall thickness + 200 mm. Clean up on each move.

### E — Tests

Write `packages/web/src/tools/splitWallTool.test.ts`:

```ts
describe('split wall grammar — §3.3.6', () => {
  it('activate moves to active phase', () => { ... });
  it('hoverWall updates hoverWallId and hoverPointMm', () => { ... });
  it('click emits splitWall effect with wallId and splitPointMm', () => { ... });
  it('cancel returns to idle', () => { ... });
  it('stays active after click (repeated-use tool)', () => { ... });
});
```

Write `packages/web/src/tools/splitWallLogic.test.ts`:

```ts
describe('split_wall command logic — §3.3.6', () => {
  it('projects split point onto wall segment', () => { ... });
  it('produces two walls with combined length matching original', () => { ... });
  it('split at midpoint yields two equal-length walls', () => { ... });
  it('preserves heightMm and typeId on both halves', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
