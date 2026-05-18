# Wave 27 — WP-D: Show Constraints Toggle + Constraint Lock Symbols (§3.3.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.3.5 "Gruppe Steuerelemente" is Partial P2. Pin element is available. "Show/hide dimension constraints on canvas is Partial." In Revit, clicking "Show Constraints" in the ribbon shows EQ (equality) constraint markers and lock symbols on constrained dimensions directly on the canvas.

This task adds:
1. A `showConstraints` boolean field on `plan_view` (or a viewport store slice)
2. A "Show Constraints" toggle button in `PlanViewHeader.tsx`
3. `ToggleShowConstraintsCmd` command
4. When `showConstraints = true`, dimension elements with `isEqualityDimension?: boolean` render an "EQ" marker, and dimensions with `isLocked?: boolean` render a padlock icon
5. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find permanent_dimension, plan_view element types
packages/web/src/plan/PlanViewHeader.tsx                — find existing toggle buttons (thin lines, crop region, etc.) as pattern
packages/web/src/viewport/symbology.ts                  — find permanent_dimension rendering as pattern for adding EQ marker
packages/web/src/workspace/Workspace.tsx                — find toggleCropRegion or similar as pattern
```

Run before editing:
- `grep -n "showConstraints\|isLocked\|isEqualityDim\|ToggleConstraints" packages/core/src/index.ts | head -10`
- `grep -n "showConstraints\|thin.*lines\|toggleThinLines" packages/web/src/plan/PlanViewHeader.tsx | head -10`
- `grep -n "permanent_dimension\|isLocked\|isEquality" packages/web/src/viewport/symbology.ts | head -10`
- `grep -n "toggleThinLines\|thinLines\|cropRegionEnabled" packages/web/src/workspace/Workspace.tsx | head -10`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add isLocked, isEqualityDimension to permanent_dimension in core

Find the `permanent_dimension` element type. Add:

```ts
/** When true, this dimension drives an equality constraint (EQ). */
isEqualityDimension?: boolean;
/** When true, the dimension is locked (cannot be changed by moving elements). */
isLocked?: boolean;
```

Also add `showConstraints?: boolean` to the `plan_view` element type if not already present.

### B — Add ToggleShowConstraintsCmd

Find where other `Cmd` types are defined. Add:

```ts
export type ToggleShowConstraintsCmd = {
  type: 'toggleShowConstraints';
  /** plan_view element ID. */
  viewId: string;
};
```

Add `| ToggleShowConstraintsCmd` to `SemanticCommand` and export it.

### C — Workspace handler

Find the `toggleCropRegion` or `toggleThinLines` handler as pattern. Add:

```ts
if (cmd.type === 'toggleShowConstraints') {
  const { elementsById: cur } = useBimStore.getState();
  const view = cur[cmd.viewId as string];
  if (!view || view.kind !== 'plan_view') return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [view.id]: { ...view, showConstraints: !(view as any).showConstraints },
    },
  });
  return;
}
```

### D — PlanViewHeader toggle button

In `PlanViewHeader.tsx`, find the existing toggle buttons (thin lines, crop region). Add nearby:

```tsx
<button
  data-testid="plan-view-show-constraints-btn"
  title={showConstraints ? 'Hide Constraints' : 'Show Constraints'}
  onClick={() => onSemanticCommand?.({ type: 'toggleShowConstraints', viewId: activePlanView.id })}
  style={{
    fontSize: 10,
    padding: '1px 5px',
    border: `1px solid ${showConstraints ? '#22c55e' : 'var(--border)'}`,
    borderRadius: 3,
    background: showConstraints ? 'rgba(34,197,94,0.15)' : 'transparent',
    color: showConstraints ? '#22c55e' : 'inherit',
    cursor: 'pointer',
  }}
>
  EQ
</button>
```

Where `showConstraints = (activePlanView as any).showConstraints ?? false`.

**Important**: Read `PlanViewHeader.tsx` carefully to understand the `activePlanView` prop shape and how other toggle buttons (like thin lines) are rendered. Adapt to the actual prop names.

### E — Plan rendering: EQ marker and lock symbol for constrained dims

In `symbology.ts` (or wherever `permanent_dimension` elements are rendered), after building the dim label, check `showConstraints`:

Find the rendering logic for `permanent_dimension`. When `showConstraints` is true AND `isEqualityDimension` is true, replace the numeric text with "EQ". When `isLocked` is true, append a 🔒 symbol to the label (or render a separate CSS2DObject with the padlock character).

If the rendering uses `CSS2DObject` for the label, you can do:
```ts
const label = showConstraints && dim.isEqualityDimension ? 'EQ' : formatDimLabel(dim);
const lockSuffix = showConstraints && dim.isLocked ? ' 🔒' : '';
css2dObject.element.textContent = label + lockSuffix;
```

**Important**: Read the actual dim rendering in `symbology.ts` or `detailComponentsRender.ts` before editing. Adapt to the actual rendering approach. If the label is not a CSS2DObject but rendered differently, adjust accordingly.

### F — commandCapabilities.ts entry

```ts
{
  id: 'view.toggle-show-constraints',
  label: 'Show Constraints',
  owner: 'plan/PlanViewHeader',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['plan-header'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§3.3.5: toggles visibility of EQ equality constraint markers and lock symbols on permanent_dimension elements.',
},
```

Note: `surfaces` does NOT include `'cmd-k'` so no `registerCommand` is needed.

### G — Tests

Create `packages/web/src/plan/showConstraints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Show constraints toggle — §3.3.5', () => {
  it('ToggleShowConstraintsCmd has correct shape', () => {
    const cmd = { type: 'toggleShowConstraints' as const, viewId: 'pv1' };
    expect(cmd.type).toBe('toggleShowConstraints');
    expect(cmd.viewId).toBe('pv1');
  });

  it('showConstraints defaults to false when not set', () => {
    const view: any = { kind: 'plan_view', id: 'pv1' };
    expect((view.showConstraints ?? false)).toBe(false);
  });

  it('toggle flips showConstraints', () => {
    const view: any = { kind: 'plan_view', id: 'pv1', showConstraints: false };
    const next = !view.showConstraints;
    expect(next).toBe(true);
  });

  it('isEqualityDimension causes EQ label when showConstraints is true', () => {
    const dim: any = { kind: 'permanent_dimension', id: 'd1', isEqualityDimension: true };
    const showConstraints = true;
    const label = showConstraints && dim.isEqualityDimension ? 'EQ' : '1200 mm';
    expect(label).toBe('EQ');
  });

  it('isLocked appends lock indicator when showConstraints is true', () => {
    const dim: any = { kind: 'permanent_dimension', id: 'd1', isLocked: true };
    const showConstraints = true;
    const lockSuffix = showConstraints && dim.isLocked ? ' 🔒' : '';
    expect(lockSuffix).toBe(' 🔒');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave27/D): show constraints toggle — ToggleShowConstraintsCmd + showConstraints on plan_view + EQ marker + lock symbol on dims + PlanViewHeader EQ button (§3.3.5)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
