# Wave 18 — WP-I: 2D Detail View Drafting Elements (§6.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — Element union
packages/web/src/plan/detailComponentsRender.ts     — (may exist) detail component rendering
packages/web/src/tools/toolRegistry.ts              — ToolId union
packages/web/src/tools/toolGrammar.ts               — tool grammars
packages/web/src/plan/PlanCanvas.tsx                — plan canvas
packages/web/src/plan/symbology.ts                  — plan rendering
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Search for `detail_line`, `detailLine`, `DetailLine`, `detail_component`, `filled_region`, `detailComponentsRender`, `DetailView` in the codebase. Read EVERYTHING found before touching anything.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: search for `detail_line`, `detail_filled_region`, `detail_arc`, `model_line` — read all of them.
2. `detailComponentsRender.ts` (if exists): read fully — what detail types are already rendered?
3. `toolRegistry.ts`: find any `'detail-line'`, `'detail-arc'`, `'detail-filled-region'` tool IDs.
4. `symbology.ts`: find where `model_line` is rendered — use as pattern for `detail_line`.
5. `toolGrammar.ts`: find any detail line grammar — read if exists.

---

## Tasks

### A — Element types in `core/index.ts`

Add if not present:

```ts
| {
    kind: 'detail_line';
    id: string;
    /** Points forming the line segments (two or more). */
    pointsMm: { xMm: number; yMm: number }[];
    /** Line weight in screen pixels. */
    lineWeightPx?: number;
    /** Line color hex. */
    colorHex?: string;
    /** Line style: solid | dashed | dotted | center. */
    lineStyle?: 'solid' | 'dashed' | 'dotted' | 'center';
    /** Detail view this line belongs to (plan_view id). */
    viewId?: string | null;
    levelId?: string | null;
  }
| {
    kind: 'detail_arc';
    id: string;
    centerMm: { xMm: number; yMm: number };
    radiusMm: number;
    startAngleDeg: number;
    endAngleDeg: number;
    lineWeightPx?: number;
    colorHex?: string;
    viewId?: string | null;
    levelId?: string | null;
  }
| {
    kind: 'detail_filled_region';
    id: string;
    /** Closed polygon boundary. */
    perimeterMm: { xMm: number; yMm: number }[];
    /** Fill pattern: solid | hatch-45 | hatch-90 | cross | diagonal. */
    fillPattern?: 'solid' | 'hatch-45' | 'hatch-90' | 'cross' | 'diagonal';
    /** Fill color hex. */
    colorHex?: string;
    viewId?: string | null;
    levelId?: string | null;
  }
```

---

### B — Tool registration in `toolRegistry.ts`

Add:
```ts
{ id: 'detail-line', hotkey: 'DL', label: 'Detail Line', mode: 'plan' }
{ id: 'detail-arc', hotkey: 'DA', label: 'Detail Arc', mode: 'plan' }
{ id: 'detail-filled-region', hotkey: 'FR', label: 'Filled Region', mode: 'plan' }
```

Add all three to `PALETTE_ORDER` near annotation tools.

---

### C — Grammars in `toolGrammar.ts`

**DetailLine grammar** (polyline, commit on Enter or double-click):

```ts
export type DetailLineState =
  | { phase: 'idle' }
  | { phase: 'drawing'; points: { xMm: number; yMm: number }[] };

export type DetailLineEffect =
  | { kind: 'createDetailLine'; pointsMm: { xMm: number; yMm: number }[]; lineStyle: 'solid' };

export function initialDetailLineState(): DetailLineState { return { phase: 'idle' }; }

export function reduceDetailLine(state: DetailLineState, event: ToolEvent): { state: DetailLineState; effect?: DetailLineEffect } {
  // activate → drawing (empty points)
  // click → append point to drawing
  // Enter or double-click with ≥2 points → emit createDetailLine
  // Escape → idle
}
```

**DetailFilledRegion grammar** (polygon, commit on Enter):

```ts
export type DetailFilledRegionState =
  | { phase: 'idle' }
  | { phase: 'sketching'; points: { xMm: number; yMm: number }[] };

export type DetailFilledRegionEffect =
  | { kind: 'createDetailFilledRegion'; perimeterMm: { xMm: number; yMm: number }[]; fillPattern: 'solid' };
```

Export all state/reducer/initial functions.

---

### D — Plan rendering in `symbology.ts`

Add rendering for all three new element kinds in `rebuildPlanMeshes`:

**Detail lines**:
```ts
case 'detail_line': {
  const el = element as Extract<Element, { kind: 'detail_line' }>;
  if (!el.pointsMm || el.pointsMm.length < 2) break;
  const pts = el.pointsMm.map(p => new THREE.Vector3(p.xMm / 1000, p.yMm / 1000, 0.01));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const lw = el.lineWeightPx ?? 1;
  const color = el.colorHex ?? '#000000';
  let mat: THREE.LineBasicMaterial;
  // Use LineDashedMaterial for dashed/dotted
  mat = new THREE.LineBasicMaterial({ color, linewidth: lw });
  const line = new THREE.Line(geo, mat);
  line.userData.bimPickId = el.id;
  scene.add(line);
  break;
}
```

**Detail arcs**:
Build an arc curve and render as `THREE.Line`.

**Detail filled regions**:
```ts
case 'detail_filled_region': {
  const el = element as Extract<Element, { kind: 'detail_filled_region' }>;
  if (!el.perimeterMm || el.perimeterMm.length < 3) break;
  const shape = new THREE.Shape(el.perimeterMm.map(p => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000)));
  const geo = new THREE.ShapeGeometry(shape);
  const color = el.colorHex ?? '#cccccc';
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = 0.005;
  mesh.userData.bimPickId = el.id;
  scene.add(mesh);
  break;
}
```

---

### E — Inspector panels

`case 'detail_line':`:
```tsx
<div>
  <label>Line Weight (px)
    <input type="number" data-testid="inspector-detail-line-weight"
      value={el.lineWeightPx ?? 1}
      onChange={e => onPropertyChange('lineWeightPx', +e.target.value)} />
  </label>
  <label>Color
    <input type="color" data-testid="inspector-detail-line-color"
      value={el.colorHex ?? '#000000'}
      onChange={e => onPropertyChange('colorHex', e.target.value)} />
  </label>
  <label>Style
    <select data-testid="inspector-detail-line-style"
      value={el.lineStyle ?? 'solid'}
      onChange={e => onPropertyChange('lineStyle', e.target.value)}>
      <option value="solid">Solid</option>
      <option value="dashed">Dashed</option>
      <option value="dotted">Dotted</option>
    </select>
  </label>
  <span data-testid="inspector-detail-line-points">{(el.pointsMm ?? []).length} points</span>
</div>
```

`case 'detail_filled_region':`:
```tsx
<div>
  <label>Fill Pattern
    <select data-testid="inspector-detail-filled-region-pattern"
      value={el.fillPattern ?? 'solid'}
      onChange={e => onPropertyChange('fillPattern', e.target.value)}>
      <option value="solid">Solid</option>
      <option value="hatch-45">Hatch 45°</option>
      <option value="hatch-90">Hatch 90°</option>
      <option value="cross">Cross</option>
    </select>
  </label>
  <label>Color
    <input type="color" data-testid="inspector-detail-filled-region-color"
      value={el.colorHex ?? '#cccccc'}
      onChange={e => onPropertyChange('colorHex', e.target.value)} />
  </label>
  <span data-testid="inspector-detail-filled-region-points">{(el.perimeterMm ?? []).length} points</span>
</div>
```

---

### F — Palette commands + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'tool.detail-line', label: 'Detail Line', keywords: ['detail', 'line', 'draft'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'detail-line') }
{ id: 'tool.detail-arc', label: 'Detail Arc', keywords: ['detail', 'arc', 'draft'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'detail-arc') }
{ id: 'tool.detail-filled-region', label: 'Filled Region', keywords: ['detail', 'filled', 'region', 'hatch'], category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'detail-filled-region') }
```

In `commandCapabilities.ts`:
```ts
{ id: 'tool.detail-line', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'tool.detail-arc', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'tool.detail-filled-region', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### G — Tests

`packages/web/src/plan/detailDraftingElements.test.ts`:

```ts
describe('reduceDetailLine — §6.4.2', () => {
  it('starts in idle', () => { ... });
  it('activate moves to drawing', () => { ... });
  it('click appends points', () => { ... });
  it('Enter with 2+ points emits createDetailLine', () => { ... });
  it('Enter with 1 point does nothing', () => { ... });
  it('Escape returns to idle', () => { ... });
});

describe('reduceDetailFilledRegion — §6.4.2', () => {
  it('starts in idle', () => { ... });
  it('sketching phase accumulates points', () => { ... });
  it('Enter with 3+ points emits createDetailFilledRegion', () => { ... });
  it('Escape returns to idle', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/I): 2D detail view drafting — detail_line, detail_arc, detail_filled_region elements + grammars + rendering (§6.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new detail drafting tests.
