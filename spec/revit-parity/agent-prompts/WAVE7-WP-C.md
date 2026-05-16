# Wave 7 — WP-C: Terrain Height Point Placement + Grip Editing (§5.1.1 + §5.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — toposolid element, HeightSample { xMm, yMm, zMm }
packages/web/src/viewport/meshBuilders.ts               — makeToposolidMesh, toposolidHeightMmAtPoint
packages/web/src/tools/toolRegistry.ts                  — tool registration
packages/web/src/tools/toolGrammar.ts                   — grammar state machines
packages/web/src/plan/planElementMeshBuilders.ts        — plan symbols
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `HeightSample = { xMm: number; yMm: number; zMm: number }` in `core/index.ts` (line 9)
- `toposolid` element has `heightSamples?: HeightSample[]`
- `makeToposolidMesh` in `meshBuilders.ts` calls `toposolidHeightMmAtPoint` which uses heightSamples for nearest-neighbour interpolation — the 3D mesh already updates when heightSamples change
- Check `core/index.ts` for existing toposolid update commands — there is `update_toposolid_subdivision` but the base toposolid may have no update command yet

---

## Tasks

### A — update_toposolid command

Add to `core/index.ts` (if not already present):
```ts
export type UpdateToposolidCmd = {
  type: 'update_toposolid';
  id: string;
  patch: Partial<Pick<Extract<Element, { kind: 'toposolid' }>, 'heightSamples' | 'thicknessMm' | 'baseElevationMm'>>;
};
```
Add to Command union. Handle in `Workspace.tsx`:
```ts
case 'update_toposolid':
  setElementsById({ ...elementsById, [cmd.id]: { ...elementsById[cmd.id], ...cmd.patch } });
  break;
```

### B — Tool registration

In `toolRegistry.ts`, add:
```ts
'terrain-point': {
  id: 'terrain-point',
  hotkey: 'TP',
  modes: ['plan'],
  category: 'site',
}
```

Add `'terrain-point'` to `TOOL_CAPABILITIES` in `commandCapabilities.ts` (surfaces include `'cmd-k'`).

### C — Grammar state machine

In `toolGrammar.ts`, add `TerrainPointState` and `reduceTerrainPoint`:

```ts
type TerrainPointState =
  | { phase: 'idle' }
  | { phase: 'active'; toposolidId: string; pendingSamples: HeightSample[] };
```

Events:
- `activate` with `toposolidId: string` → moves to `active` with empty pendingSamples
- `click` with `xMm, yMm` in `active` → appends `{ xMm, yMm, zMm: 0 }` to pendingSamples; emits `previewTerrainPoints` effect (for plan display)
- `commit` (Enter) in `active` → emits `addTerrainPoints` effect with `toposolidId` + `pendingSamples`; returns to `idle`
- `cancel` / `deactivate` → idle

Wire into `PlanCanvas.tsx` (follow the same pattern as other site tools):
- `case 'terrain-point'`: dispatch `click` with world coordinates on canvas click; Enter dispatches `commit`; Escape dispatches `cancel`
- On `addTerrainPoints` effect: dispatch `{ type: 'update_toposolid', id, patch: { heightSamples: [...existingSamples, ...newSamples] } }`

### D — Plan symbol: control point dots

Create `packages/web/src/plan/terrainPointSymbol.ts`:

```ts
export function terrainControlPointsPlanThree(
  topo: Extract<Element, { kind: 'toposolid' }>,
): THREE.Group
```

- Return empty Group if no heightSamples
- For each HeightSample: render a small filled circle (radius 150 mm) at `(xMm/1000, PLAN_Y + 0.01, yMm/1000)`
- Color: `#8B6914` (brown), `userData.bimPickId = topo.id`, `userData.heightSampleIndex = i`
- Label each dot with its `zMm` value as a sprite

Wire into `symbology.ts` toposolid loop.

### E — Inspector panel

In `InspectorContent.tsx` for `el.kind === 'toposolid'`, add a "Control Points" section:
- `data-testid="inspector-topo-point-count"` — read-only: `"${el.heightSamples?.length ?? 0} control points"`
- `data-testid="inspector-topo-clear-points"` button — dispatches `update_toposolid` with `patch: { heightSamples: [] }`
- List of height samples with `data-testid="inspector-topo-point-{i}-z"` — number input (mm) for each sample's `zMm`; on change dispatch `update_toposolid` with updated heightSamples array

### F — Tests

Write `packages/web/src/tools/terrainPointTool.test.ts`:
```ts
describe('terrain point grammar — §5.1.1 + §5.1.2', () => {
  it('activate transitions from idle to active', () => { ... });
  it('click appends a sample to pendingSamples', () => { ... });
  it('commit emits addTerrainPoints with accumulated samples', () => { ... });
  it('cancel from active returns to idle', () => { ... });
  it('multiple clicks accumulate multiple samples', () => { ... });
});
```

Write `packages/web/src/plan/terrainPointSymbol.test.ts`:
```ts
describe('terrainControlPointsPlanThree — §5.1.1', () => {
  it('returns empty Group when no heightSamples', () => { ... });
  it('returns one child per height sample', () => { ... });
  it('userData.heightSampleIndex matches array index', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
