# Wave 19 — WP-G: 2D Detail Drafting — Element Types + Rendering in Plan (§6.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-I created grammar functions in `packages/web/src/tools/toolGrammar.ts`:

- `DetailLineState`, `reduceDetailLine`, `initialDetailLineState`
- `DetailFilledRegionState`, `reduceDetailFilledRegion`, `initialDetailFilledRegionState`
- Test file `packages/web/src/plan/detailDraftingElements.test.ts` (11 tests — all pass)

**Still missing:**

- `detail_line` and `detail_filled_region` element types in `core/index.ts`
- Command types: `addDetailLine`, `addDetailFilledRegion`, `removeDetailElement`
- `Workspace.tsx` handlers
- Plan rendering in `symbology.ts` (dashed line + hatch fill)
- Inspector panels for detail_line and detail_filled_region
- `PlanCanvas.tsx` wiring for `detail-line` and `detail-filled-region` tools
- Palette commands + capability graph entries

---

## Repo orientation

```
packages/core/src/index.ts
packages/web/src/tools/toolGrammar.ts              — grammars already here
packages/web/src/plan/PlanCanvas.tsx               — tool handler patterns
packages/web/src/plan/symbology.ts                 — rebuildPlanMeshes elements loop
packages/web/src/workspace/Workspace.tsx
packages/web/src/workspace/inspector/InspectorContent.tsx
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `toolGrammar.ts` near the end for `reduceDetailLine` and `reduceDetailFilledRegion` — understand the effect shapes they emit. Read `symbology.ts` to find where plan mesh rendering is done per element kind — add `detail_line` and `detail_filled_region` cases there.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Element types in `core/index.ts`

Add if not present:

```ts
| {
    kind: 'detail_line';
    id: string;
    pointsMm: { xMm: number; yMm: number }[];
    lineStyle?: 'solid' | 'dashed' | 'dotted' | 'medium' | 'thin';
    colorHex?: string;
    levelId?: string | null;
    viewId?: string | null;
  }
| {
    kind: 'detail_filled_region';
    id: string;
    boundaryMm: { xMm: number; yMm: number }[];
    fillPatternId?: string | null;
    colorHex?: string;
    levelId?: string | null;
    viewId?: string | null;
  }
```

Add command types:

```ts
| { type: 'addDetailLine'; element: Extract<Element, { kind: 'detail_line' }> }
| { type: 'addDetailFilledRegion'; element: Extract<Element, { kind: 'detail_filled_region' }> }
| { type: 'removeDetailElement'; elementId: string }
```

---

### B — `Workspace.tsx` handlers

```ts
case 'addDetailLine':
  elementsById[cmd.element.id] = cmd.element;
  break;
case 'addDetailFilledRegion':
  elementsById[cmd.element.id] = cmd.element;
  break;
case 'removeDetailElement':
  delete elementsById[cmd.elementId];
  break;
```

---

### C — Plan rendering in `symbology.ts`

In `rebuildPlanMeshes`, add cases for `detail_line` and `detail_filled_region` in the main elements loop.

For `detail_line`:

```ts
case 'detail_line': {
  if ((el as any).pointsMm?.length < 2) break;
  const pts: THREE.Vector3[] = (el as any).pointsMm.map((p: any) =>
    new THREE.Vector3(p.xMm / 1000, p.yMm / 1000, 0.002),
  );
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const style = (el as any).lineStyle ?? 'solid';
  const color = (el as any).colorHex ?? '#000000';
  const mat = new THREE.LineBasicMaterial({ color });
  if (style === 'dashed') {
    // Use LineDashedMaterial for dashed style
    const dashedMat = new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.15 });
    const line = new THREE.Line(geom, dashedMat);
    line.computeLineDistances();
    line.userData.bimPickId = el.id;
    group.add(line);
  } else {
    const line = new THREE.Line(geom, mat);
    line.userData.bimPickId = el.id;
    group.add(line);
  }
  break;
}
```

For `detail_filled_region`:

```ts
case 'detail_filled_region': {
  const boundary: { xMm: number; yMm: number }[] = (el as any).boundaryMm ?? [];
  if (boundary.length < 3) break;
  const shape = new THREE.Shape(boundary.map(p => new THREE.Vector2(p.xMm / 1000, p.yMm / 1000)));
  const geom = new THREE.ShapeGeometry(shape);
  const color = (el as any).colorHex ?? '#cccccc';
  const mat = new THREE.MeshBasicMaterial({ color, opacity: 0.4, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.z = 0.001;
  mesh.userData.bimPickId = el.id;
  group.add(mesh);
  break;
}
```

---

### D — `PlanCanvas.tsx` wiring

Follow the pattern of an existing multi-point tool (e.g. the floor sketch tool). Import the grammar functions:

```ts
import {
  initialDetailLineState,
  reduceDetailLine,
  initialDetailFilledRegionState,
  reduceDetailFilledRegion,
} from '../tools/toolGrammar';
```

Add state:

```ts
const [detailLineState, setDetailLineState] = useState(initialDetailLineState());
const [detailFilledRegionState, setDetailFilledRegionState] = useState(
  initialDetailFilledRegionState(),
);
```

In the tool click handler:

```ts
case 'detail-line': {
  const { state: next, effect } = reduceDetailLine(detailLineState, { kind: 'click', pointMm: planMm });
  setDetailLineState(next);
  if (effect?.kind === 'addDetailLine') {
    void onSemanticCommand({
      type: 'addDetailLine',
      element: { ...effect.element, id: crypto.randomUUID(), kind: 'detail_line' },
    });
  }
  break;
}
case 'detail-filled-region': {
  const { state: next, effect } = reduceDetailFilledRegion(detailFilledRegionState, { kind: 'click', pointMm: planMm });
  setDetailFilledRegionState(next);
  if (effect?.kind === 'addDetailFilledRegion') {
    void onSemanticCommand({
      type: 'addDetailFilledRegion',
      element: { ...effect.element, id: crypto.randomUUID(), kind: 'detail_filled_region' },
    });
  }
  break;
}
```

Wire `Enter`/`commit` key → `{ kind: 'commit' }` for both tools.
Wire `Escape` → `{ kind: 'cancel' }` for both.
Wire `activate`/`deactivate` on tool change for both.

Also register the tools in `toolRegistry.ts` if not already present:

```ts
{ id: 'detail-line', hotkey: 'DL2', label: 'Detail Line', mode: 'plan' }
{ id: 'detail-filled-region', hotkey: 'FR', label: 'Detail Filled Region', mode: 'plan' }
```

(Use `DL2` to avoid collision with existing hotkeys.)

---

### E — Inspector panels in `InspectorContent.tsx`

`case 'detail_line':`:

```tsx
case 'detail_line': {
  const el = selectedElement as Extract<Element, { kind: 'detail_line' }>;
  return (
    <div>
      <label>Line Style
        <select data-testid="inspector-detail-line-style"
          value={(el as any).lineStyle ?? 'solid'}
          onChange={e => onPropertyChange('lineStyle', e.target.value)}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="medium">Medium</option>
          <option value="thin">Thin</option>
        </select>
      </label>
      <label>Color
        <input type="color" data-testid="inspector-detail-line-color"
          value={(el as any).colorHex ?? '#000000'}
          onChange={e => onPropertyChange('colorHex', e.target.value)} />
      </label>
      <span data-testid="inspector-detail-line-points">{el.pointsMm.length} points</span>
    </div>
  );
}
```

`case 'detail_filled_region':`:

```tsx
case 'detail_filled_region': {
  const el = selectedElement as Extract<Element, { kind: 'detail_filled_region' }>;
  return (
    <div>
      <label>Fill Color
        <input type="color" data-testid="inspector-detail-filled-region-color"
          value={(el as any).colorHex ?? '#cccccc'}
          onChange={e => onPropertyChange('colorHex', e.target.value)} />
      </label>
      <span data-testid="inspector-detail-filled-region-points">{el.boundaryMm.length} boundary points</span>
    </div>
  );
}
```

---

### F — Palette commands + capability graph

In `defaultCommands.ts`:

```ts
{ id: 'tool.detail-line', label: 'Detail Line',
  keywords: ['detail', 'line', '2d', 'draft', 'annotate'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'detail-line') }
{ id: 'tool.detail-filled-region', label: 'Detail Filled Region',
  keywords: ['detail', 'filled', 'region', 'hatch', 'pattern', '2d'],
  category: 'tool', invoke: (ctx) => startPlanTool(ctx, 'detail-filled-region') }
```

In `commandCapabilities.ts`:

```ts
{ id: 'tool.detail-line', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'tool.detail-filled-region', scope: 'document', intendedModes: ['plan'], precondition: null },
```

---

### G — Tests

`packages/web/src/workspace/inspector/detailDraftingInspector.test.tsx`:

```tsx
describe('detail_line inspector — §6.4.2', () => {
  it('renders line style selector', () => { ... });
  it('renders color input', () => { ... });
  it('shows point count', () => { ... });
});

describe('detail_filled_region inspector — §6.4.2', () => {
  it('renders fill color input', () => { ... });
  it('shows boundary point count', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/G): 2D detail drafting — detail_line/detail_filled_region element types + rendering + inspector (§6.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
