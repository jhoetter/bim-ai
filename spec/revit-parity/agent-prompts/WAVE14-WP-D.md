# Wave 14 — WP-D: Massing → BIM Workflow (§11.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/tools/massByFace.ts          — getMassFaceCorners, getMassFaceCount, isMassFaceVertical, isMassFaceHorizontal
packages/web/src/tools/massFloorsByLevel.ts   — computeFloorsByLevel
packages/web/src/cmdPalette/defaultCommands.ts — palette commands
packages/web/src/workspace/Workspace.tsx       — semantic command handlers
packages/core/src/index.ts                     — mass_box, mass_extrusion, mass_revolution element types
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `massByFace.ts` — read `getMassFaceCount`, `getMassFaceCorners`, `isMassFaceVertical`, `isMassFaceHorizontal`, `getMassFloorBoundaryAtElevation`. Understand how face indices map to geometry.
- `massFloorsByLevel.ts` — read `computeFloorsByLevel`. It takes a mass element and an array of levels, and returns floor boundary polygons at each level elevation. Understand the return type.
- `core/index.ts` — find `mass_box`, `mass_extrusion`, `mass_revolution` types. Note their bounding-box geometry fields. Find `CreateWallCmd`, `CreateFloorCmd`, `CreateRoofCmd` (or equivalent) command shapes.
- `Workspace.tsx` — find how semantic commands (`createWall`, `createFloor`, etc.) are dispatched from the client side. Find how `selectedElementIds` is accessed from the workspace context.
- `defaultCommands.ts` — find how palette commands with `invoke` callbacks work. Find the existing `mass.*` commands if any.

---

## Tasks

### A — `mass.generate-walls` palette command

In `defaultCommands.ts`, register:

```ts
registerCommand({
  id: 'mass.generate-walls',
  label: 'Generate Walls from Mass',
  keywords: ['mass', 'wall', 'generate', 'face'],
  category: 'command',
  invoke: (ctx) => { ctx.dispatch?.({ type: 'mass_generate_walls', massId: ctx.selectedElementIds?.[0] ?? '' }); },
});
```

In `Workspace.tsx`, handle `'mass_generate_walls'`:

1. Find the selected element with the given `massId` — it must be `kind: 'mass_box' | 'mass_extrusion' | 'mass_revolution'`.
2. For each vertical face (use `isMassFaceVertical`), get its corner points (`getMassFaceCorners`).
3. Compute start/end points of the wall from the bottom two corners of the face.
4. Dispatch a `createWall` command (using the pattern already in Workspace.tsx) for each vertical face. Set `levelId` to the project's lowest level, `heightMm` to the face height, `widthMm` to 200 (default wall thickness).
5. Do NOT dispatch if `massId` is empty or the element is not a mass.

### B — `mass.generate-floors` palette command

Register:
```ts
registerCommand({
  id: 'mass.generate-floors',
  label: 'Generate Floors from Mass',
  keywords: ['mass', 'floor', 'slab', 'level', 'generate'],
  category: 'command',
  invoke: (ctx) => { ctx.dispatch?.({ type: 'mass_generate_floors', massId: ctx.selectedElementIds?.[0] ?? '' }); },
});
```

Handle `'mass_generate_floors'` in `Workspace.tsx`:

1. Get all `level` elements from `elementsById`, sorted by elevation.
2. Call `computeFloorsByLevel(massElement, levels)` from `massFloorsByLevel.ts`.
3. For each floor boundary returned, dispatch a `createFloor` command with `levelId`, `boundaryMm` set to the polygon.

### C — `mass.generate-roof` palette command

Register:
```ts
registerCommand({
  id: 'mass.generate-roof',
  label: 'Generate Roof from Mass',
  keywords: ['mass', 'roof', 'generate', 'top'],
  category: 'command',
  invoke: (ctx) => { ctx.dispatch?.({ type: 'mass_generate_roof', massId: ctx.selectedElementIds?.[0] ?? '' }); },
});
```

Handle `'mass_generate_roof'` in `Workspace.tsx`:

1. Find the top horizontal face of the mass (use `isMassFaceHorizontal`, take the face with the highest Z centroid).
2. Get its corners (`getMassFaceCorners`).
3. Dispatch a `createRoof` command (or equivalent) with `boundaryMm` set to the XY projection of those corners, and `baseElevationMm` set to the face's Z elevation.

### D — `mass.generate-all` convenience command

Register a single compound command that runs A+B+C in sequence on the same selected mass:

```ts
registerCommand({
  id: 'mass.generate-all',
  label: 'Generate All (Walls + Floors + Roof) from Mass',
  keywords: ['mass', 'generate', 'all', 'bim'],
  category: 'command',
  invoke: (ctx) => {
    ctx.dispatch?.({ type: 'mass_generate_walls', massId: ctx.selectedElementIds?.[0] ?? '' });
    ctx.dispatch?.({ type: 'mass_generate_floors', massId: ctx.selectedElementIds?.[0] ?? '' });
    ctx.dispatch?.({ type: 'mass_generate_roof', massId: ctx.selectedElementIds?.[0] ?? '' });
  },
});
```

### E — Tests

`packages/web/src/tools/massGenerateBim.test.ts`:
```ts
describe('massing → BIM workflow — §11.5', () => {
  it('generate walls dispatches createWall for each vertical face', () => { ... });
  it('generate floors dispatches createFloor per level', () => { ... });
  it('generate roof dispatches createRoof with top face boundary', () => { ... });
  it('noop when massId is empty string', () => { ... });
  it('noop when element is not a mass kind', () => { ... });
});
```

Extract the command handler logic into a pure helper file `packages/web/src/tools/massGenerateBim.ts` — functions like `generateWallsFromMass(mass, elementsById): CreateWallCmd[]`, `generateFloorsFromMass(mass, levels): CreateFloorCmd[]`, `generateRoofFromMass(mass): CreateRoofCmd | null` — so they can be tested without mounting Workspace.tsx.

---

## Commit and push

After tests pass (`pnpm test --filter @bim-ai/web`):
```
git add -p
git commit -m "feat(wave14/D): massing→BIM — generate walls/floors/roof from mass (§11.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
