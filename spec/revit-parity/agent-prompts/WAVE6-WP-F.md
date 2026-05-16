# Wave 6 — WP-F: Massing → BIM End-to-End (§11.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — mass_box, mass_extrusion, mass_revolution element types
packages/web/src/tools/massByFace.ts                     — getMassFaceCount, getMassFaceCorners, isMassFaceVertical, getMassFloorBoundaryAtElevation
packages/web/src/tools/massFloorsByLevel.ts              — computeFloorsByLevel (works on old 'mass' kind — read carefully)
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/workspace/Workspace.tsx                 — command dispatch
packages/core/src/index.ts                               — CreateFloorCmd, CreateWallCmd shapes
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these files before writing anything:
- `tools/massByFace.ts` — `getMassFaceCount(mass)`, `getMassFaceCorners(mass, faceIndex)`,
  `isMassFaceVertical(corners)`, `getMassFloorBoundaryAtElevation(mass, elev, baseElev)`
  These work on the old `kind: 'mass'` type. The new types are `mass_box`, `mass_extrusion`,
  `mass_revolution` — you'll need adapter logic.
- `tools/massFloorsByLevel.ts` — `computeFloorsByLevel(mass, levels, baseElevationMm)` — works
  on old `kind: 'mass'`. Read its logic; adapt for new types.
- `mass_box`, `mass_extrusion`, `mass_revolution` element shapes in `core/index.ts` (lines ~2968–3011)
- `CreateFloorCmd` shape in `core/index.ts` — read its exact fields before dispatching
- `CreateWallCmd` shape in `core/index.ts` — read its exact fields before dispatching

---

## Tasks

### A — Mass-to-floors helper

Create `packages/web/src/tools/massToFloors.ts`:

```ts
export type MassNewElem =
  | Extract<Element, { kind: 'mass_box' }>
  | Extract<Element, { kind: 'mass_extrusion' }>
  | Extract<Element, { kind: 'mass_revolution' }>;

export interface FloorCmd {
  levelId: string;
  boundary: { xMm: number; yMm: number }[];
  elevationMm: number;
}

export function massToFloorCmds(
  mass: MassNewElem,
  levels: Extract<Element, { kind: 'level' }>[],
): FloorCmd[]
```

Implementation:
- For `mass_box`: footprint = rectangle `[{xMm: insertionXMm, yMm: insertionYMm}, {xMm: insertionXMm + widthMm, ...}, ...]`; height range = `[baseElevationMm, baseElevationMm + heightMm]`
- For `mass_extrusion`: footprint = `profilePoints`; height range = `[baseElevationMm, baseElevationMm + heightMm]`
- For `mass_revolution`: footprint = bounding box of `profilePoints` revolved (approximate as circle with radius = max distance from axis); height range from `baseElevationMm` to max y in profilePoints
- For each level in range: yield a `FloorCmd` with the footprint as boundary

### B — Mass-to-curtain-wall helper

Create `packages/web/src/tools/massToCurtainWall.ts`:

```ts
export interface CurtainWallCmd {
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  heightMm: number;
  levelId: string;
}

export function massToCurtainWallCmds(
  mass: MassNewElem,
  baseLevel: Extract<Element, { kind: 'level' }>,
): CurtainWallCmd[]
```

- For `mass_box`: 4 vertical faces → 4 wall commands (each side of the rectangle)
- For `mass_extrusion`: N sides of `profilePoints` polygon → N wall commands
- For `mass_revolution`: simplify — return 4 walls forming bounding box (same as mass_box approximation)
- Each wall command: `startMm` and `endMm` are the bottom edge of the vertical face; `heightMm = mass.heightMm`; `levelId = baseLevel.id`

### C — Inspector panel buttons

In `InspectorContent.tsx`, detect `el.kind === 'mass_box' || el.kind === 'mass_extrusion' || el.kind === 'mass_revolution'` and add a "Generate from Mass" section:

- `data-testid="mass-gen-floors-btn"` button — label "Generate Floors by Level"
  - On click: dispatch a custom action `{ type: 'generate_floors_from_mass'; massId: el.id }` via command queue
- `data-testid="mass-apply-curtain-btn"` button — label "Apply Curtain System"
  - On click: dispatch `{ type: 'apply_curtain_to_mass'; massId: el.id }` via command queue

### D — Workspace.tsx handlers

In `Workspace.tsx`, handle the two custom commands:

```ts
case 'generate_floors_from_mass': {
  const mass = elementsById[cmd.massId];
  if (!mass) break;
  const levels = Object.values(elementsById).filter(e => e.kind === 'level');
  const cmds = massToFloorCmds(mass as MassNewElem, levels);
  for (const fc of cmds) {
    dispatch({ type: 'create_floor', levelId: fc.levelId, boundaryMm: fc.boundary, ... });
  }
  break;
}
case 'apply_curtain_to_mass': {
  const mass = elementsById[cmd.massId];
  if (!mass) break;
  const baseLevel = Object.values(elementsById).find(e => e.kind === 'level') ?? null;
  if (!baseLevel) break;
  const wallCmds = massToCurtainWallCmds(mass as MassNewElem, baseLevel);
  for (const wc of wallCmds) {
    dispatch({ type: 'create_wall', ..., curtainWallData: { hCount: 3, vCount: 4 } });
  }
  break;
}
```

Read the exact `create_floor` and `create_wall` command shapes from `core/index.ts` before writing.

### E — Tests

Write `packages/web/src/tools/massToFloors.test.ts`:
```ts
describe('massToFloorCmds — §11.5', () => {
  it('mass_box with 2 levels in range returns 2 FloorCmds', () => { ... });
  it('mass_box footprint has 4 corners', () => { ... });
  it('mass_extrusion uses profilePoints as boundary', () => { ... });
  it('level below base elevation is excluded', () => { ... });
  it('level above top is excluded', () => { ... });
});
```

Write `packages/web/src/tools/massToCurtainWall.test.ts`:
```ts
describe('massToCurtainWallCmds — §11.5', () => {
  it('mass_box returns 4 CurtainWallCmds', () => { ... });
  it('mass_extrusion with 4-point profile returns 4 CurtainWallCmds', () => { ... });
  it('each cmd has correct heightMm', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
