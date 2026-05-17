# Wave 15 — WP-C: Terrain Pad Tool Grammar + 3D Mesh (§5.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                   — ToposolidPadElement + CreateToposolidPadCmd (~line 169)
packages/web/src/plan/toolGrammar.ts         — tool state machines; read the excavation grammar as model
packages/web/src/plan/PlanCanvas.tsx         — click/keyboard dispatch
packages/web/src/plan/symbology.ts           — plan mesh loop (terrain pad already rendered ~line 1844)
packages/web/src/plan/terrainPadPlanThree.ts — plan symbol renderer (ALREADY EXISTS)
packages/web/src/cmdPalette/defaultCommands.ts — tool.terrain-pad ALREADY REGISTERED
packages/web/src/tools/toolRegistry.ts       — check for 'terrain-pad' ToolId
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: `ToposolidPadElement` (kind, id, toposolidId, boundaryMm, elevationMm) and `CreateToposolidPadCmd` already defined.
2. `terrainPadPlanThree.ts`: plan symbol renderer (dashed boundary + semi-transparent fill + elevation label) — already wired into `symbology.ts`.
3. `defaultCommands.ts`: palette command `tool.terrain-pad` is already registered.
4. The `tool.terrain-pad` ToolId may or may not be in `toolRegistry.ts` — check.

**What is MISSING:**
- A polygon-sketch grammar in `toolGrammar.ts` for placing `terrain-pad`.
- PlanCanvas.tsx wiring for the `'terrain-pad'` tool.
- A 3D mesh builder for the terrain pad (flattened surface in 3D).
- Inspector panel in `InspectorContent.tsx`.

---

## Tasks

### A — Confirm toolRegistry

In `toolRegistry.ts` (or wherever tools are registered), verify `'terrain-pad'` ToolId exists. If not, add it with hotkey `'TP'` (check for conflicts — terrain-point might use TP already; use `'PD'` for pad if so), plan mode.

---

### B — Grammar in `toolGrammar.ts`

Add a `TerrainPadState` / `reduceTerrainPad` grammar (follow the excavation grammar pattern exactly):

```ts
// States: idle → recording (accumulate polygon points on click) → confirm (Enter or double-click)
// Events: TerrainPadActivate | TerrainPadClick | TerrainPadCommit | TerrainPadCancel
// Effect on commit: { kind: 'createTerrainPad', points: BoundaryPoint[], elevationMm: number }
// Use the current plan elevation (active level elevationMm) as default elevationMm.
```

The grammar must produce a minimum of 3 points before commit is allowed.

---

### C — PlanCanvas.tsx wiring

Find where the excavation tool is handled in `PlanCanvas.tsx` and add analogous wiring for `'terrain-pad'`:

- Activate: `case 'terrain-pad': dispatch terrainPadActivate`
- Click: `case terrain-pad: dispatch terrainPadClick with planCoords`
- Enter / double-click: commit
- Escape: cancel
- Show point count in status bar / instruction chip

On commit: dispatch semantic command `create_toposolid_pad` with `{ id: uuid(), toposolidId: activeToposolidId, boundaryMm: points, elevationMm }`. Get the active toposolid id from `useBimStore` (look for elements with `kind === 'toposolid'`; use the first one, or null if none). Handle gracefully when no toposolid exists (show a toast/alert "Place a terrain first").

---

### D — 3D mesh builder

Create `packages/web/src/viewport/meshBuilders.terrainPad.ts`:

```ts
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

type ToposolidPadEl = Extract<Element, { kind: 'toposolid_pad' }>;

/** Flat polygon at the pad's elevation — represents the flattened terrain surface. */
export function buildTerrainPadMesh(pad: ToposolidPadEl): THREE.Mesh {
  const eM = pad.elevationMm / 1000;
  const pts = pad.boundaryMm;
  if (pts.length < 3) return new THREE.Mesh();

  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, eM, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: '#c8a882',
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.bimPickId = pad.id;
  return mesh;
}
```

Import and call this from `meshBuilders.ts` (add a case for `'toposolid_pad'` in the main element dispatch, similar to how excavation is handled).

---

### E — Inspector panel

In `InspectorContent.tsx`, find or add the case for `kind === 'toposolid_pad'`. Add:

```tsx
<CollapsibleSection title="Terrain Pad" data-testid="inspector-terrain-pad">
  <label>Elevation (mm)</label>
  <input type="number" data-testid="inspector-terrain-pad-elevation"
    value={el.elevationMm}
    onChange={(e) => onPropertyChange('elevationMm', +e.currentTarget.value)} />
  <label>Boundary Points</label>
  <span data-testid="inspector-terrain-pad-point-count">{el.boundaryMm.length} pts</span>
  <label>Parent Toposolid</label>
  <span data-testid="inspector-terrain-pad-toposolid">{el.toposolidId?.slice(0,8) ?? '—'}</span>
</CollapsibleSection>
```

---

### F — Tests

`packages/web/src/plan/terrainPad.test.ts`:
```ts
describe('terrain pad — §5.1.4', () => {
  it('grammar starts in idle state', () => { ... });
  it('click adds a boundary point', () => { ... });
  it('commit with <3 points is rejected', () => { ... });
  it('commit with 3+ points emits createTerrainPad effect', () => { ... });
  it('escape cancels and resets to idle', () => { ... });
});
```

`packages/web/src/viewport/meshBuilders.terrainPad.test.ts`:
```ts
describe('buildTerrainPadMesh — §5.1.4', () => {
  it('returns empty Mesh when fewer than 3 boundary points', () => { ... });
  it('returns a Mesh at the correct elevation', () => { ... });
  it('mesh has bimPickId userData', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/C): terrain pad tool grammar + 3D mesh + inspector (§5.1.4)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new terrain pad tests.
