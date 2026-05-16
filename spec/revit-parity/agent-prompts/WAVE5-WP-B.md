# Wave 5 — WP-B: Curtain Wall Interactive Grid Editing (§8.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — WallElem + curtainWallData field
packages/web/src/plan/planElementMeshBuilders.ts        — planWallMesh renders curtain panels
packages/web/src/viewport/meshBuilders.ts               — makeCurtainWallMesh (3D)
packages/web/src/workspace/inspector/InspectorContent.tsx — element inspector panels
packages/web/src/workspace/Workspace.tsx                — command queue / dispatch
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `curtainWallData?: { hGridCount?: number; vGridCount?: number; ... }` on WallElem — read
  `core/index.ts` for exact shape
- `planWallMesh` already renders curtain panel tick marks in plan view — read before editing
- `makeCurtainWallMesh` in `meshBuilders.ts` already renders the 3D grid + glass + mullions
- Inspector already shows a "Curtain Wall" section — grep `InspectorContent.tsx` for `isCurtainWall`

---

## Tasks

### A — Inspector: H/V grid count controls

In the `InspectorContent.tsx` curtain wall section, add editable number inputs:
- `data-testid="inspector-curtain-h-grid-count"` — horizontal grid divisions (integer ≥ 1)
- `data-testid="inspector-curtain-v-grid-count"` — vertical grid divisions (integer ≥ 1)

On change, dispatch an `update_curtain_grid` command:
```ts
{ type: 'update_curtain_grid'; wallId: string; hGridCount?: number; vGridCount?: number; }
```

Add `update_curtain_grid` to the command union in `core/index.ts` and handle it in `Workspace.tsx`
by patching `curtainWallData` on the wall.

### B — Inspector: panel type + mullion type dropdowns

Add two `<select>` elements to the curtain wall inspector section:
- `data-testid="inspector-curtain-panel-type"` — options: `'glass'`, `'solid'`, `'empty'`
- `data-testid="inspector-curtain-mullion-type"` — options: `'rectangular'`, `'circular'`, `'none'`

Dispatch `update_curtain_grid` with `panelType` / `mullionType` fields when changed.
Add those fields to `curtainWallData` in `core/index.ts`.

### C — Tests

Write `packages/web/src/workspace/inspector/curtainWallGrid.test.ts`:

```ts
describe('curtain wall grid inspector controls', () => {
  it('hGridCount input dispatches update_curtain_grid with correct count', () => { ... });
  it('vGridCount input dispatches update_curtain_grid', () => { ... });
  it('panel type dropdown dispatches update_curtain_grid with panelType', () => { ... });
  it('mullion type dropdown dispatches update_curtain_grid with mullionType', () => { ... });
  it('curtain grid re-renders in plan after hGridCount change', () => { ... });
});
```

Test by rendering the inspector with a curtain wall element in store, firing change events on the
inputs, and asserting the emitted command shape.

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
