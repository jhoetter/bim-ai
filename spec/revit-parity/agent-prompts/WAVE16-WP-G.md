# Wave 16 — WP-G: Auto-Dimension + Tag All Rooms (§4.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/plan/autoDimension.ts           — auto-dimension logic (may exist)
packages/web/src/plan/PlanCanvas.tsx             — plan canvas
packages/web/src/cmdPalette/defaultCommands.ts   — palette commands
packages/web/src/workspace/Workspace.tsx          — semantic command handlers
packages/web/src/workspace/commandCapabilities.ts — capability graph
packages/core/src/index.ts                        — element types (dimension, room, text_tag)
```

Search for `autoDimension`, `auto-dim`, `annotate.auto`, `text_tag`, `room_tag` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `dimension` element kind — read its fields (startMm, endMm, offsetMm, label). Find `room` kind. Find any `text_tag` or `room_tag` kind.
2. Search `defaultCommands.ts` for `annotate` — read all annotation commands already present.
3. Search `Workspace.tsx` for `createDimension` or `autoDimension` — read what's wired.
4. Search `commandCapabilities.ts` for `annotate` — read what's already registered.
5. If `autoDimension.ts` exists, read it fully.

---

## Tasks

### A — `autoDimensionWalls` in `autoDimension.ts`

Create or extend `packages/web/src/plan/autoDimension.ts`:

```ts
import type { Element } from '@bim-ai/core';

/**
 * Auto-dimensions all walls on a given level.
 * Returns an array of new dimension elements.
 */
export function autoDimensionWalls(
  levelId: string,
  elementsById: Record<string, Element | undefined>,
): Extract<Element, { kind: 'dimension' }>[] {
  // 1. Collect all walls on the level (el.kind === 'wall' && el.levelId === levelId)
  // 2. Group walls by orientation (horizontal vs vertical, based on angleDeg or startMm/endMm)
  // 3. For each group, create a dimension chain:
  //    - Horizontal walls: dimension along the X axis (horizontal dimension string)
  //    - Vertical walls: dimension along the Y axis (vertical dimension string)
  // 4. Each dimension: startMm = wall start, endMm = wall end, offsetMm = 1200 (above/beside)
  // 5. Return dimension elements (generate IDs with crypto.randomUUID())
}
```

If the `dimension` element kind doesn't have the fields you need (startMm, endMm, offsetMm), add minimal fields to `core/index.ts`. Do not remove existing fields.

---

### B — `tagAllRooms` in `autoDimension.ts`

```ts
/**
 * Creates a text_tag (room tag) at the centroid of every room on the level.
 * Returns an array of new tag elements.
 */
export function tagAllRooms(
  levelId: string,
  elementsById: Record<string, Element | undefined>,
): Element[] {
  // 1. Collect all rooms on the level (el.kind === 'room' && el.levelId === levelId)
  // 2. For each room, compute centroid: average of el.perimeterMm points (or el.positionMm)
  // 3. Create a tag element at the centroid:
  //    - If 'room_tag' kind exists: use it
  //    - Otherwise use 'text_tag' with label = room.name or 'Room'
  // 4. Return tag elements
}
```

If `room_tag` or `text_tag` element kinds don't exist in `core/index.ts`, add:

```ts
| {
    kind: 'text_tag';
    id: string;
    positionMm: { xMm: number; yMm: number };
    label: string;
    fontSizePt?: number;
    levelId?: string | null;
  }
```

---

### C — Palette commands

In `defaultCommands.ts`, add (only if not already present):

```ts
{
  id: 'annotate.auto-dim-walls',
  label: 'Auto-Dimension Walls',
  keywords: ['auto', 'dimension', 'walls', 'annotate'],
  category: 'command',
  invoke: (ctx) => ctx.autoDimWalls?.(),
},
{
  id: 'annotate.tag-all-rooms',
  label: 'Tag All Rooms',
  keywords: ['tag', 'room', 'annotate', 'label'],
  category: 'command',
  invoke: (ctx) => ctx.tagAllRooms?.(),
},
```

---

### D — Workspace handlers

In `Workspace.tsx`, add handlers (alongside existing annotation handlers):

```ts
autoDimWalls: () => {
  const activeLevel = /* get active level ID from store */;
  const dims = autoDimensionWalls(activeLevel, elementsById);
  dims.forEach(d => void onSemanticCommand({ type: 'createElement', element: d }));
},
tagAllRooms: () => {
  const activeLevel = /* get active level ID from store */;
  const tags = tagAllRooms(activeLevel, elementsById);
  tags.forEach(t => void onSemanticCommand({ type: 'createElement', element: t }));
},
```

---

### E — Capability graph

In `commandCapabilities.ts`, add (if not already present):

```ts
{ id: 'annotate.auto-dim-walls', scope: 'document', intendedModes: ['plan'], precondition: 'has-walls' },
{ id: 'annotate.tag-all-rooms', scope: 'document', intendedModes: ['plan'], precondition: 'has-rooms' },
```

---

### F — Tests

`packages/web/src/plan/autoDimension.test.ts`:

```ts
describe('autoDimensionWalls — §4.1', () => {
  it('returns empty array when no walls on level', () => { ... });
  it('creates one dimension per wall', () => { ... });
  it('each dimension has kind === "dimension"', () => { ... });
  it('dimension offsetMm is positive', () => { ... });
});

describe('tagAllRooms — §4.1', () => {
  it('returns empty array when no rooms on level', () => { ... });
  it('creates one tag per room', () => { ... });
  it('tag positionMm is within room bounds', () => { ... });
  it('tag label matches room name', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/G): auto-dimension walls + tag all rooms palette commands (§4.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new auto-dimension tests.
