# Wave 16 — WP-J: Ramp Tool (§8.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — Element union, command types
packages/web/src/tools/toolRegistry.ts              — ToolId union
packages/web/src/tools/toolGrammar.ts               — tool state machines
packages/web/src/plan/PlanCanvas.tsx                — click/keyboard dispatch
packages/web/src/plan/symbology.ts                  — plan symbols
packages/web/src/viewport/meshBuilders.ts           — mesh builder switch
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/cmdPalette/defaultCommands.ts      — palette commands
packages/web/src/workspace/commandCapabilities.ts   — capability graph
```

Read the stair tool (search for `stair` in toolGrammar.ts and meshBuilders\*.ts) as a pattern for a 2-point placement tool.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: search for `ramp` — does it already exist? If so, read all its fields. If not, you will add it.
2. `toolRegistry.ts`: search for `'ramp'` — does it exist? Read what hotkeys are available (avoid conflicts).
3. `toolGrammar.ts`: read the stair grammar (or the closest 2-point tool) as the pattern.
4. `meshBuilders.ts`: find the `case 'stair':` entry — read it. You will create a parallel `case 'ramp':`.
5. `InspectorContent.tsx`: search for `case 'ramp':` — if already present, read it; if not, you will add it.

---

## Tasks

### A — Element type in `core/index.ts`

If `ramp` element kind does not exist, add it:

```ts
| {
    kind: 'ramp';
    id: string;
    /** Start point of the ramp (bottom end). */
    startMm: { xMm: number; yMm: number };
    /** End point of the ramp (top end). */
    endMm: { xMm: number; yMm: number };
    /** Width of the ramp perpendicular to travel direction. */
    widthMm: number;
    /** Rise over run ratio (e.g. 1/12 = 0.0833). */
    slopeRatio: number;
    /** Optional handrail on left, right, or both sides. */
    handrails?: 'left' | 'right' | 'both' | 'none';
    levelId?: string | null;
    materialId?: string | null;
  }
```

Add command type:

```ts
| { type: 'createRamp'; ramp: Extract<Element, { kind: 'ramp' }> }
```

---

### B — ToolId + registration

In `toolRegistry.ts`:

- Add `'ramp'` to the ToolId union.
- Register: `{ id: 'ramp', hotkey: 'RM', label: 'Ramp', mode: 'plan' }`
- Add to `MODIFY_TOOL_IDS` (or whatever group floor/stair tools are in) and `PALETTE_ORDER`.

---

### C — Grammar in `toolGrammar.ts`

Add `RampState`, `RampEvent`, `RampEffect`, `initialRampState`, `reduceRamp`:

States: `idle → placing-start → placing-end`

```ts
type RampState =
  | { phase: 'idle' }
  | { phase: 'placing-start' }
  | { phase: 'placing-end'; startMm: { xMm: number; yMm: number } };

type RampEffect = {
  kind: 'createRamp';
  startMm: { xMm: number; yMm: number };
  endMm: { xMm: number; yMm: number };
  widthMm: number;
  slopeRatio: number;
};
```

Flow:

1. **idle → placing-start**: tool is activated
2. **placing-start → placing-end**: first click sets `startMm`
3. **placing-end → idle**: second click sets `endMm`, emits `createRamp` effect with default `widthMm: 1200` and `slopeRatio: 1/12`
4. Escape from any state → idle

---

### D — PlanCanvas wiring

Wire `reduceRamp` into `PlanCanvas.tsx` following the same pattern as the stair tool:

- On tool activate → `rampState = initialRampState`
- On click → `reduceRamp(rampState, { type: 'click', ptMm })` → update state
- On Escape → reset to idle
- On effect `createRamp` → `onSemanticCommand({ type: 'createElement', element: { kind: 'ramp', id: uuid(), ...effect } })`

---

### E — Plan symbol in `symbology.ts`

Add a plan symbol for `ramp` elements:

The ramp plan symbol is:

- A filled rectangle from `startMm` to `endMm` (accounting for `widthMm`)
- Diagonal lines across the rectangle (indicating slope) — 3-4 evenly-spaced parallel lines
- An arrow at the `endMm` end pointing in the direction of travel (up the ramp)
- A label "UP" at the `endMm` end

```ts
// Ramp rectangle (same approach as floor/slab plan symbols)
// Diagonal lines from corner to corner at equal spacing
// Arrow using a small triangle mesh or line arrow
```

---

### F — 3D mesh in `meshBuilders.ramp.ts`

Create `packages/web/src/viewport/meshBuilders.ramp.ts`:

```ts
import * as THREE from 'three';
type RampEl = Extract<Element, { kind: 'ramp' }>;

export function buildRampMesh(el: RampEl): THREE.Mesh {
  // Compute ramp geometry:
  // - Length along XY plane: dist(startMm, endMm)
  // - Rise height: length * slopeRatio (e.g. 4000mm long × 1/12 slope = 333mm rise)
  // - Width: widthMm
  //
  // Build a sloped box using ExtrudeGeometry or BufferGeometry:
  // 4 bottom vertices at z=0, 4 top vertices (start end at z=0, end at z=rise)
  // Actually simpler: use BoxGeometry then apply a shear transform, or build manual BufferGeometry.
  //
  // Manual approach:
  // const length = Math.hypot(el.endMm.xMm - el.startMm.xMm, el.endMm.yMm - el.startMm.yMm) / 1000;
  // const rise = length * el.slopeRatio;
  // const width = el.widthMm / 1000;
  // vertices (in local frame, x = along ramp, y = across ramp, z = up):
  //   [0,0,0], [length,0,rise], [length,width,rise], [0,width,0] — top face (sloped)
  //   [0,0,-0.15], [length,0,rise-0.15], ... — bottom face (150mm thick slab)
  // Build indices for the 6 faces.

  const mat = new THREE.MeshStandardMaterial({ color: '#c4a882', roughness: 0.7 });
  const mesh = new THREE.Mesh(geometry, mat);

  // Position and orient
  const dx = (el.endMm.xMm - el.startMm.xMm) / 1000;
  const dy = (el.endMm.yMm - el.startMm.yMm) / 1000;
  const angle = Math.atan2(dy, dx);
  mesh.position.set(el.startMm.xMm / 1000, 0, el.startMm.yMm / 1000);
  mesh.rotation.y = -angle;

  mesh.userData.bimPickId = el.id;
  return mesh;
}
```

Wire into `meshBuilders.ts`:

```ts
case 'ramp':
  return buildRampMesh(el as Extract<Element, { kind: 'ramp' }>);
```

---

### G — Inspector panel

In `InspectorContent.tsx`, add `case 'ramp':`:

```tsx
case 'ramp': {
  const el = selectedElement as Extract<Element, { kind: 'ramp' }>;
  return (
    <div>
      <label>Width (mm)
        <input type="number" data-testid="inspector-ramp-width"
          value={el.widthMm} onChange={e => onPropertyChange('widthMm', +e.target.value)} />
      </label>
      <label>Slope (1:N)
        <input type="number" data-testid="inspector-ramp-slope"
          value={Math.round(1 / el.slopeRatio)}
          onChange={e => onPropertyChange('slopeRatio', 1 / +e.target.value)} />
      </label>
      <label>Handrails
        <select data-testid="inspector-ramp-handrails"
          value={el.handrails ?? 'both'}
          onChange={e => onPropertyChange('handrails', e.target.value)}>
          <option value="both">Both sides</option>
          <option value="left">Left only</option>
          <option value="right">Right only</option>
          <option value="none">None</option>
        </select>
      </label>
    </div>
  );
}
```

---

### H — Palette command + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'tool.ramp', label: 'Ramp', keywords: ['ramp', 'slope', 'accessibility'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'ramp') }
```

In `commandCapabilities.ts`:

```ts
{ id: 'tool.ramp', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### I — Tests

`packages/web/src/plan/rampTool.test.ts`:

```ts
describe('ramp tool grammar — §8.7', () => {
  it('starts in idle state', () => { ... });
  it('first click transitions to placing-end with startMm set', () => { ... });
  it('second click emits createRamp effect', () => { ... });
  it('emitted createRamp has default widthMm 1200 and slopeRatio 1/12', () => { ... });
  it('Escape resets to idle', () => { ... });
});
```

`packages/web/src/viewport/meshBuilders.ramp.test.ts`:

```ts
describe('buildRampMesh — §8.7', () => {
  it('returns a THREE.Mesh', () => { ... });
  it('mesh.userData.bimPickId equals el.id', () => { ... });
  it('mesh geometry has vertices', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/J): ramp tool — element type + grammar + 3D mesh + inspector (§8.7)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ramp tool tests.
