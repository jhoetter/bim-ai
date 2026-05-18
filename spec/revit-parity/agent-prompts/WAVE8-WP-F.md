# Wave 8 — WP-F: Terrain Pad / Subregion (§5.1.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — toposolid element, Element union, Command union
packages/web/src/viewport/meshBuilders.ts               — makeToposolidMesh, toposolidHeightMmAtPoint
packages/web/src/tools/toolRegistry.ts                   — tool registration
packages/web/src/tools/toolGrammar.ts                    — grammar state machines (see toposolid_subdivision pattern)
packages/web/src/tools/authoringCommandContract.ts       — required authoring contracts
packages/web/src/plan/planElementMeshBuilders.ts        — plan symbol helpers
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/cmdPalette/defaultCommands.ts           — palette commands
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `toposolid` element in `core/index.ts`: `{ boundaryMm, heightSamples?, thicknessMm, baseElevationMm?, contourIntervalMm? }`.
- `toposolid_subdivision` tool (hotkey TS) — use it as the exact pattern for the new terrain-pad tool: grammar, PlanCanvas wiring, plan symbol, authoringCommandContract.
- `toposolidHeightMmAtPoint` in `meshBuilders.ts` — the existing nearest-neighbour height lookup from heightSamples.
- `makeToposolidMesh` — read how it builds the 3D surface to understand where a pad cap would be added.
- `update_toposolid` command (added in wave 7 WP-C) in `core/index.ts` and `Workspace.tsx` — do NOT rebuild it.

---

## Tasks

### A — toposolid_pad element type

In `core/index.ts`, add:

```ts
/** §5.1.4: a flattened sub-area of a toposolid surface, placed at a fixed elevation. */
export type ToposolidPadElement = {
  kind: 'toposolid_pad';
  id: string;
  /** Parent toposolid this pad is cut into. */
  toposolidId: string;
  /** Boundary polygon of the pad in plan (mm). */
  boundaryMm: BoundaryPoint[];
  /** Fixed elevation of the pad surface (mm above project datum). */
  elevationMm: number;
};
```

Add `'toposolid_pad'` to `ElemKind` union and `Element` union. Add to `elemCategory`:

```ts
toposolid_pad: 'site',
```

### B — create_toposolid_pad command

In `core/index.ts`:

```ts
export type CreateToposolidPadCmd = {
  type: 'create_toposolid_pad';
  id: string;
  toposolidId: string;
  boundaryMm: BoundaryPoint[];
  elevationMm: number;
};
```

Handle in `Workspace.tsx` — same pattern as other create commands (add to `elementsById`).

### C — Tool registration

In `toolRegistry.ts`, add to ToolId union and registry:

```ts
'terrain-pad': {
  id: 'terrain-pad',
  label: 'Terrain Pad',
  icon: 'detailLine',
  hotkey: 'TPD',
  shortcut: 'TPD',
  modes: ['plan'],
  category: 'site',
  tooltip: 'Sketch a flattened pad area on a toposolid (T → P → D).',
}
```

Add authoring contract in `authoringCommandContract.ts` (kind: 'sketch', completionBehavior: 'explicit-finish'). Add palette entry in `defaultCommands.ts`.

### D — Grammar state machine

In `toolGrammar.ts`, add `TerrainPadState` and `reduceTerrainPad`:

```ts
type TerrainPadState =
  | { phase: 'idle' }
  | { phase: 'sketching'; toposolidId: string; points: BoundaryPoint[]; elevationMm: number };
```

Events:

- `activate(toposolidId, elevationMm)` → sketching with empty points
- `click(xMm, yMm)` → appends `{ xMm, yMm }` to points
- `commit` (Enter or double-click with ≥3 points) → emits `createTerrainPad` effect; returns to idle
- `cancel` (Escape) → idle

Wire into `PlanCanvas.tsx`:

- `case 'terrain-pad'`: on click dispatch `click`; Enter dispatches `commit`; Escape → `cancel`
- On `createTerrainPad` effect: dispatch `create_toposolid_pad`
- Draw preview polygon outline while sketching

### E — 3D mesh: pad cap

In `meshBuilders.ts`, after building the main toposolid mesh, check `elementsById` for any `toposolid_pad` elements whose `toposolidId` matches:

- For each pad: build a flat `THREE.ShapeGeometry` from `boundaryMm` at Y = `elevationMm / 1000`
- Material: `MeshStandardMaterial({ color: '#c8a882' })` (warm tan for gravel/concrete pad)
- Add as a child of the toposolid mesh group with `userData.bimPickId = pad.id`

### F — Plan symbol

Create `packages/web/src/plan/terrainPadPlanThree.ts`:

```ts
export function terrainPadPlanThree(pad: Extract<Element, { kind: 'toposolid_pad' }>): THREE.Group;
```

- Draw the pad boundary as a dashed closed polygon at `PLAN_Y + 0.003`
- Fill with a semi-transparent tan rectangle using ShapeGeometry
- Label with elevation: `"${pad.elevationMm} mm"` as a sprite

Wire into `symbology.ts` toposolid loop: after toposolid boundary, add any pads whose `toposolidId` matches.

### G — Inspector panel

In `InspectorContent.tsx`, for `el.kind === 'toposolid_pad'`:

- `data-testid="inspector-pad-elevation"` — number input (mm), value = `el.elevationMm`, on change dispatch `update_element_property` for `elevationMm`
- `data-testid="inspector-pad-area"` — read-only shoelace area: `"${shoelaceM2.toFixed(1)} m²"`

### H — Tests

Write `packages/web/src/tools/terrainPadTool.test.ts`:

```ts
describe('terrain pad grammar — §5.1.4', () => {
  it('activate moves to sketching phase', () => { ... });
  it('click appends boundary points', () => { ... });
  it('commit with ≥3 points emits createTerrainPad', () => { ... });
  it('commit with <3 points does nothing', () => { ... });
  it('cancel returns to idle', () => { ... });
});
```

Write `packages/web/src/plan/terrainPadPlan.test.ts`:

```ts
describe('terrainPadPlanThree — §5.1.4', () => {
  it('returns Group with children for a valid pad', () => { ... });
  it('returns empty Group for pad with <3 boundary points', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
