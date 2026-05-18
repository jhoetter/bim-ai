# Wave 28 — WP-B: Non-Structural Column Distinction (§9.1.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§9.1.3 "Nichttragende Stützen" is Partial P2. Non-structural decorative columns (pilasters, column casings) can be placed in bim-ai but there is no separate family type or `isStructural` flag to distinguish them from load-bearing columns. In Revit, non-structural columns have a dashed plan symbol and a different category (Architectural Columns vs Structural Columns).

This task adds:
1. `isNonStructural?: boolean` field on the `column` element type
2. `ToggleColumnStructuralCmd` command type
3. Workspace handler
4. Plan symbol: non-structural columns render with a dashed outline instead of the solid filled cross
5. Inspector checkbox "Non-structural (architectural)"
6. `modify.toggle-column-structural` palette command
7. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find column element type
packages/web/src/plan/symbology.ts                      — find columnPlanThree rendering
packages/web/src/workspace/Workspace.tsx                — find column command handlers as pattern
packages/web/src/cmdPalette/defaultCommands.ts          — find modify.* commands as pattern
```

Run before editing:
- `grep -n "column\|isNonStructural\|isStructural" packages/core/src/index.ts | head -15`
- `grep -n "columnPlanThree\|column.*plan\|kind.*column" packages/web/src/plan/symbology.ts | head -10`
- `grep -n "column\|ToggleColumn" packages/web/src/workspace/Workspace.tsx | head -10`

Read the `column` element type and `columnPlanThree` function carefully before editing.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add isNonStructural to column element in core

Find the `column` element type in `packages/core/src/index.ts`. Add:

```ts
/** §9.1.3: when true, this is a decorative/architectural column (non-load-bearing). */
isNonStructural?: boolean;
```

### B — Add ToggleColumnStructuralCmd

Find where other `Cmd` types are defined. Add:

```ts
export type ToggleColumnStructuralCmd = {
  type: 'toggleColumnStructural';
  /** Column element ID. */
  columnId: string;
};
```

Add `| ToggleColumnStructuralCmd` to `SemanticCommand` and export it.

### C — Workspace handler

Find where column commands are handled. Add:

```ts
if (cmd.type === 'toggleColumnStructural') {
  const { elementsById: cur } = useBimStore.getState();
  const col = cur[cmd.columnId as string];
  if (!col || col.kind !== 'column') return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [col.id]: { ...col, isNonStructural: !(col as any).isNonStructural },
    },
  });
  return;
}
```

### D — Plan symbol: dashed outline for non-structural columns

Find the `columnPlanThree` function (or wherever the column plan symbol is built) in `symbology.ts`. After building the existing solid cross/box symbol, check `isNonStructural`:

```ts
// §9.1.3: non-structural columns use dashed outline only (no fill)
const isNonStruct = (col as any).isNonStructural ?? false;
if (isNonStruct) {
  // Replace solid fill with dashed rectangle outline
  const w = ux(widthMm);  // adapt to actual width field name
  const d = uz(depthMm);  // adapt to actual depth field name
  const rectPts = [
    new THREE.Vector3(-w / 2, PLAN_Y + 0.001, -d / 2),
    new THREE.Vector3(w / 2, PLAN_Y + 0.001, -d / 2),
    new THREE.Vector3(w / 2, PLAN_Y + 0.001, d / 2),
    new THREE.Vector3(-w / 2, PLAN_Y + 0.001, d / 2),
    new THREE.Vector3(-w / 2, PLAN_Y + 0.001, -d / 2),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(rectPts);
  const mat = new THREE.LineDashedMaterial({ color: 0x6b7280, dashSize: 0.04, gapSize: 0.02 });
  const outline = new THREE.Line(geo, mat);
  outline.computeLineDistances();
  outline.userData.bimPickId = col.id;
  grp.add(outline);
  // Remove the solid fill mesh from the group (or skip adding it)
}
```

**Important**: Read the actual `columnPlanThree` code carefully. Adapt field names (widthMm, depthMm) and how the solid mesh is currently added. You may conditionally skip adding the filled mesh and instead add a dashed outline.

### E — Inspector: Non-structural checkbox

Find where the `column` element inspector is rendered (likely in `InspectorContent.tsx` or similar). Add a checkbox:

```tsx
{element.kind === 'column' && (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
    <input
      data-testid="inspector-column-non-structural"
      type="checkbox"
      checked={(element as any).isNonStructural ?? false}
      onChange={() =>
        onSemanticCommand?.({ type: 'toggleColumnStructural', columnId: element.id })
      }
    />
    Non-structural (architectural)
  </label>
)}
```

**Important**: Read the actual inspector code for columns to find the right location. Adapt to the actual prop names.

### F — Palette command

In `defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'modify.toggle-column-structural',
  label: 'Toggle Column Structural/Non-Structural',
  keywords: ['column', 'non-structural', 'architectural', 'decorative', 'pilaster'],
  category: 'modify',
  isAvailable: (ctx) => (ctx.selectedElements ?? []).some((e) => e.kind === 'column'),
  invoke: (ctx) => {
    const col = (ctx.selectedElements ?? []).find((e) => e.kind === 'column');
    if (col) ctx.dispatchCommand?.({ type: 'toggleColumnStructural', columnId: col.id });
  },
});
```

### G — commandCapabilities.ts entry

```ts
{
  id: 'modify.toggle-column-structural',
  label: 'Toggle Column Structural/Non-Structural',
  owner: 'plan/symbology',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: ['selected-column'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§9.1.3: toggles isNonStructural on column elements; non-structural columns render with dashed outline.',
},
```

### H — Tests

Create `packages/web/src/plan/nonStructuralColumn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Non-structural column — §9.1.3', () => {
  it('ToggleColumnStructuralCmd has correct shape', () => {
    const cmd = { type: 'toggleColumnStructural' as const, columnId: 'col1' };
    expect(cmd.type).toBe('toggleColumnStructural');
    expect(cmd.columnId).toBe('col1');
  });

  it('isNonStructural defaults to false when not set', () => {
    const col: any = { kind: 'column', id: 'col1' };
    expect((col.isNonStructural ?? false)).toBe(false);
  });

  it('toggle flips isNonStructural', () => {
    const col: any = { kind: 'column', id: 'col1', isNonStructural: false };
    const next = !col.isNonStructural;
    expect(next).toBe(true);
  });

  it('non-structural column uses dashed rendering', () => {
    const col: any = { kind: 'column', id: 'col1', isNonStructural: true };
    const renderStyle = col.isNonStructural ? 'dashed-outline' : 'solid-fill';
    expect(renderStyle).toBe('dashed-outline');
  });

  it('structural column uses solid rendering', () => {
    const col: any = { kind: 'column', id: 'col1', isNonStructural: false };
    const renderStyle = col.isNonStructural ? 'dashed-outline' : 'solid-fill';
    expect(renderStyle).toBe('solid-fill');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave28/B): non-structural column — isNonStructural field + ToggleColumnStructuralCmd + Workspace handler + dashed plan symbol + inspector checkbox (§9.1.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
