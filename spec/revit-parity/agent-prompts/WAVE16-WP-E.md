# Wave 16 — WP-E: Curtain Wall from Mass Face (§11.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/tools/massGenerateBim.ts        — generateWallsFromMass, generateFloorsFromMass, generateRoofFromMass
packages/web/src/plan/massByFace.ts              — isMassFaceVertical, getMassFaceCorners
packages/web/src/workspace/Workspace.tsx          — mass.generate-* handlers
packages/web/src/cmdPalette/defaultCommands.ts   — palette commands
packages/core/src/index.ts                        — wall element type (curtainWallData field)
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`massGenerateBim.ts`**: read `generateWallsFromMass` fully — understand how it iterates mass faces, computes wall position/length/height.
2. **`massByFace.ts`**: read `isMassFaceVertical`, `getMassFaceCorners`, `getMassFaceBoundingBox` (or similar). Understand the face data structure.
3. **`core/index.ts`**: find the `wall` element type — look for `curtainWallData` or `wallType` field. Find `CurtainWallData` or similar. Understand what makes a wall a curtain wall.
4. Search for `'curtain'` in `Workspace.tsx` to understand existing curtain wall handling.

---

## Tasks

### A — `generateCurtainWallsFromMass` in `massGenerateBim.ts`

Add a new exported function:

```ts
export function generateCurtainWallsFromMass(
  mass: Extract<Element, { kind: 'mass_box' | 'mass_extrusion' | 'mass_revolution' }>,
  elementsById: Record<string, Element | undefined>,
): Element[] {
  // 1. Get all vertical faces of the mass using massByFace.ts utilities
  // 2. For each vertical face, create a wall element with curtainWallData:
  //    - type: 'curtain' (or however curtain walls are typed in this codebase)
  //    - positionMm at the face centre
  //    - lengthMm = face width
  //    - heightMm = face height
  //    - Set wallTypeId to a default curtain wall type or leave null
  //    - Set curtainWallData: { gridH: 2, gridV: 3, panelType: 'glass', mullionType: 'rectangular' }
  // 3. Return the array of new wall elements
}
```

Use the same pattern as `generateWallsFromMass` but set `curtainWallData` on each wall.

---

### B — Palette command

In `defaultCommands.ts`:

```ts
{
  id: 'mass.generate-curtain-walls',
  label: 'Generate Curtain Walls from Mass',
  keywords: ['curtain', 'mass', 'generate', 'facade'],
  category: 'command',
  invoke: (ctx) => ctx.massGenerateCurtainWalls?.(),
}
```

---

### C — Workspace handler

In `Workspace.tsx`, add handler (alongside existing `mass.generate-walls`):

```ts
massGenerateCurtainWalls: () => {
  const selected = /* get selected mass element */;
  if (!selected || !['mass_box', 'mass_extrusion', 'mass_revolution'].includes(selected.kind)) return;
  const newWalls = generateCurtainWallsFromMass(selected as any, elementsById);
  newWalls.forEach(w => void onSemanticCommand({ type: 'createElement', element: w }));
},
```

---

### D — Register in capability graph

In `commandCapabilities.ts` (wherever `MASS_CAPABILITIES` is defined), add:

```ts
{ id: 'mass.generate-curtain-walls', scope: 'selection', intendedModes: ['plan', '3d'], precondition: 'selected-mass' }
```

---

### E — Tests

`packages/web/src/tools/massGenerateCurtainWalls.test.ts`:

```ts
describe('generateCurtainWallsFromMass — §11.5', () => {
  it('returns walls for each vertical face of a mass_box', () => { ... });
  it('each generated wall has curtainWallData set', () => { ... });
  it('generated wall lengthMm matches face width', () => { ... });
  it('returns empty array for zero-volume mass', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/E): curtain wall from mass face — generate-curtain-walls command (§11.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new curtain wall generation tests.
