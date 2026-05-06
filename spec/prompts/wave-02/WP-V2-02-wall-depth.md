# WP-V2-02 — Wall System Depth

**Branch:** `feat/wp-v2-02-wall-depth`
**Wave:** 2, Batch A (parallel with WP-V2-03a)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-02 → `done` when merged.

---

## Context

BIM AI is a browser-first BIM authoring tool. Stack: React 19 + Vite + TypeScript, Tailwind, Zustand, Three.js. Repo: pnpm workspace; web package is `packages/web/`.

This WP deepens two wall-system gaps and adds the Wall Joins modify tool.

---

## Gap 1 — Location line offset in geometry

### What's missing

`WallLocationLine` is a type in `toolGrammar.ts`:

```ts
export type WallLocationLine =
  | 'wall-centerline'
  | 'core-centerline'
  | 'finish-face-exterior'
  | 'finish-face-interior'
  | 'core-face-exterior'
  | 'core-face-interior';
```

Each wall element (`WallElem` in `store.ts`) stores `locationLine: WallLocationLine`. However:

- `makeWallMesh` in `packages/web/src/viewport/meshBuilders.ts` ignores `locationLine` — the mesh is always placed at the wall centerline.
- The plan wire builder (check `packages/web/src/plan/planElementMeshBuilders.ts` — the file that draws wall outlines in PlanCanvas) also ignores it.

The fix: when `locationLine !== 'wall-centerline'`, offset the wall geometry perpendicular to the wall direction by the appropriate fraction of `thicknessMm`.

### Offset table

```
wall-centerline      → 0 offset
core-centerline      → 0 offset (treat same as wall-centerline for now — layers not stored individually)
finish-face-exterior → +thicknessMm/2 (shift so exterior face aligns to start/end points)
finish-face-interior → -thicknessMm/2
core-face-exterior   → +thicknessMm/2 (approximate — no separate core thickness yet)
core-face-interior   → -thicknessMm/2
```

The perpendicular direction in 3D: if the wall runs along vector `(dx, 0, dz)` (XZ plane), the perpendicular is `(-dz, 0, dx)` normalised. Apply the offset to `mesh.position` before setting it.

In plan (2D): wall outlines in plan are drawn as a pair of parallel lines offset ±thick/2 from the wall axis. When `locationLine` is exterior/interior face, shift both lines by the full `offsetFrac` so the reference edge (one of the two outlines) sits on the element start/end points.

### Implementation

1. Add a pure helper function in `meshBuilders.ts`:

   ```ts
   function locationLineOffsetFrac(loc: WallLocationLine): number {
     switch (loc) {
       case 'finish-face-exterior':
       case 'core-face-exterior':
         return 0.5;
       case 'finish-face-interior':
       case 'core-face-interior':
         return -0.5;
       default:
         return 0;
     }
   }
   ```

2. In `makeWallMesh`, after computing `dx`, `dz`, `len`, `thick`:

   ```ts
   const locFrac = locationLineOffsetFrac(wall.locationLine ?? 'wall-centerline');
   const perpX = (-dz / len) * locFrac * thick;
   const perpZ = (dx / len) * locFrac * thick;
   // Then: mesh.position.set(sx + dx/2 + perpX, ..., sz + dz/2 + perpZ)
   ```

3. Apply the same offset in the plan wire builder. Find where wall outline pairs are computed in `planElementMeshBuilders.ts` and shift the pair by `locFrac * thick`.

### Test

Add a vitest test in a new `packages/web/src/viewport/meshBuilders.locationLine.test.ts`:
- Wall with `locationLine: 'wall-centerline'` → mesh position X/Z = midpoint of start/end.
- Wall with `locationLine: 'finish-face-exterior'` (thicknessMm=300, horizontal wall) → mesh X shifted +0.15 m from centerline midpoint.

---

## Gap 2 — Wall Joins modify tool

### What to build

A new `'wall-join'` tool that lets the user click a wall corner to inspect and cycle the join variant (miter → butt → square → miter…).

#### toolRegistry.ts

Add `'wall-join'` to the `ToolId` union. In `getToolRegistry`, add:

```ts
'wall-join': {
  id: 'wall-join',
  label: t('tool.wallJoin'),
  icon: 'git-merge',       // lucide icon
  hotkey: 'WJ',            // two-key sequence W then J
  modes: ['plan'],
},
```

Add it to `MODIFY_TOOL_IDS`. Add to `PALETTE_ORDER` in the Modify section after `'trim'`.

#### toolGrammar.ts

```ts
export interface WallJoinState {
  phase: 'idle' | 'selected';
  cornerMm: { xMm: number; yMm: number } | null;
  wallIds: string[];
  joinVariant: 'miter' | 'butt' | 'square';
}

export type WallJoinEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click-corner'; cornerMm: { xMm: number; yMm: number }; wallIds: string[] }
  | { kind: 'cycle' }        // N key
  | { kind: 'accept' }       // Enter key
  | { kind: 'cancel' };      // Esc

export interface WallJoinEffect {
  commitJoin?: { wallIds: string[]; variant: 'miter' | 'butt' | 'square' };
  stillActive: boolean;
}

export function initialWallJoinState(): WallJoinState {
  return { phase: 'idle', cornerMm: null, wallIds: [], joinVariant: 'miter' };
}

export function reduceWallJoin(
  state: WallJoinState,
  event: WallJoinEvent,
): { state: WallJoinState; effect: WallJoinEffect };
```

Phase logic:
- `idle` + `click-corner` → transition to `selected`, store corner + wallIds, default `joinVariant: 'miter'`.
- `selected` + `cycle` → rotate `joinVariant` through `miter → butt → square → miter`.
- `selected` + `accept` → emit `commitJoin` effect, return to `idle`.
- Any `cancel` or `deactivate` → return to `idle`, clear state.

#### PlanCanvas.tsx

In the pointer-down handler, add a case for `planTool === 'wall-join'`: find the closest wall corner within 12 px screen-space of the cursor world position using `elementsById`. If found, call `reduceWallJoin` with `click-corner`. On `keydown` while in `selected` phase: `N` key → `cycle`; `Enter` → `accept`.

Handle `commitJoin` effect with:
```ts
console.warn('stub: wall-join command not implemented', effect.commitJoin);
```

---

## Gap 3 — Base / Top offset deepening

### What to add

`WallElem.baseOffsetMm` and `WallElem.topConstraintOffsetMm` are already parsed in `store.ts`. In `makeWallMesh`, `elevM` is the level elevation. Ensure that `baseOffsetMm` is added to the mesh Y position and that `topConstraintOffsetMm` adjusts the wall height if `topConstraintLevelId` is set (look up the level elevation and compute total height as `topElevM + topOffsetMm/1000 - (baseElevM + baseOffsetMm/1000)`).

If `topConstraintLevelId` is `null`, just use `wall.heightMm` as before. This may already be partially handled — check `Viewport.tsx` for how `elevationMForLevel` is called and mirror that logic in the height calculation inside `makeWallMesh`.

---

## Key file locations

| Path | Role |
|---|---|
| `packages/web/src/viewport/meshBuilders.ts` | `makeWallMesh` — add location line offset |
| `packages/web/src/plan/planElementMeshBuilders.ts` | Plan wire outline — add location line offset |
| `packages/web/src/tools/toolRegistry.ts` | Add `'wall-join'` |
| `packages/web/src/tools/toolGrammar.ts` | `WallJoinState`, `reduceWallJoin` |
| `packages/web/src/plan/PlanCanvas.tsx` | Dispatch wall-join events |
| `packages/web/src/tools/toolGrammar.test.ts` | Add wall-join reducer tests |

---

## Tests

Extend `packages/web/src/tools/toolGrammar.test.ts`:

```ts
describe('WallJoin reducer', () => {
  it('transitions to selected on click-corner', ...)
  it('cycles miter → butt → square → miter on cycle events', ...)
  it('emits commitJoin on accept', ...)
  it('returns to idle on cancel', ...)
})
```

Add `packages/web/src/viewport/meshBuilders.locationLine.test.ts` as described above.

---

## Constraints

- Do not add `wall-join` to modes other than `plan`.
- Stub `commitJoin` with `console.warn` — no backend command exists yet.
- `make verify` must pass.

---

## Commit format

```
feat(walls): WP-V2-02 — location line offset geometry + Wall Join tool

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
