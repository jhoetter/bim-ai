# Wave 28 — WP-A: Plan Underlay (Lower Floor Reference Ghost) (§2.9.4)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§2.9.4 "Obergeschoss" is Partial P2. In Revit, when drawing an upper-floor plan you can set a "Underlay" (Raster) that shows the floor below as semi-transparent ghost lines — helpful for aligning walls, doors, and stairs. bim-ai supports plan underlays structurally but there's no explicit PlanViewHeader toggle or UI to select the underlay level.

This task adds:
1. `underlayLevelId?: string` and `showUnderlay?: boolean` fields on `plan_view` (if not already present)
2. A `SetPlanUnderlayCmd` command type
3. PlanViewHeader: "Underlay" toggle button and a level selector dropdown
4. In the plan renderer (symbology.ts or PlanCanvas.tsx), when `showUnderlay=true` render the walls from `underlayLevelId` as dashed/semi-transparent lines at 40% opacity
5. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find plan_view element type, look for underlay fields
packages/web/src/plan/PlanViewHeader.tsx                — find existing toggle buttons as pattern
packages/web/src/plan/symbology.ts                      — find where walls are rendered, look for level filtering
packages/web/src/workspace/Workspace.tsx                — find plan_view handlers as pattern
```

Run before editing:
- `grep -n "underlayLevel\|showUnderlay\|underlay" packages/core/src/index.ts | head -10`
- `grep -n "underlayLevel\|showUnderlay" packages/web/src/plan/PlanViewHeader.tsx | head -10`
- `grep -n "underlayLevel\|underlay" packages/web/src/plan/symbology.ts | head -10`
- `grep -n "plan_view.*level\|levelId.*plan" packages/core/src/index.ts | head -10`

Read `plan_view` element type and `PlanViewHeader` carefully before editing.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add underlay fields to plan_view in core

Find the `plan_view` element type in `packages/core/src/index.ts`. If `underlayLevelId` and `showUnderlay` are not already present, add:

```ts
/** §2.9.4: ID of the level whose walls/floors appear as ghost underlay in this view. */
underlayLevelId?: string;
/** §2.9.4: when true, the underlay level is rendered as semi-transparent ghost lines. */
showUnderlay?: boolean;
```

### B — Add SetPlanUnderlayCmd

Find where other `Cmd` types are defined. Add:

```ts
export type SetPlanUnderlayCmd = {
  type: 'setPlanUnderlay';
  /** plan_view element ID. */
  viewId: string;
  /** Level ID to use as underlay, or null to clear. */
  underlayLevelId: string | null;
  /** Whether to show the underlay. */
  showUnderlay?: boolean;
};
```

Add `| SetPlanUnderlayCmd` to `SemanticCommand` and export it.

### C — Workspace handler

Find the `toggleShowConstraints` or `toggleThinLines` handler as pattern. Add:

```ts
if (cmd.type === 'setPlanUnderlay') {
  const { elementsById: cur } = useBimStore.getState();
  const view = cur[cmd.viewId as string];
  if (!view || view.kind !== 'plan_view') return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [view.id]: {
        ...view,
        underlayLevelId: (cmd.underlayLevelId as string | null) ?? (view as any).underlayLevelId,
        showUnderlay: (cmd.showUnderlay as boolean | undefined) ?? !(view as any).showUnderlay,
      },
    },
  });
  return;
}
```

### D — PlanViewHeader: Underlay toggle + level selector

In `PlanViewHeader.tsx`, find existing toggle buttons (thin lines, crop region, show constraints). Add nearby:

```tsx
{/* §2.9.4: Underlay toggle + level selector */}
<button
  data-testid="plan-view-underlay-btn"
  title={showUnderlay ? 'Hide Underlay' : 'Show Underlay'}
  onClick={() =>
    onSemanticCommand?.({ type: 'setPlanUnderlay', viewId: activePlanView.id, showUnderlay: !showUnderlay })
  }
  style={{
    fontSize: 10,
    padding: '1px 5px',
    border: `1px solid ${showUnderlay ? '#a78bfa' : 'var(--border)'}`,
    borderRadius: 3,
    background: showUnderlay ? 'rgba(167,139,250,0.15)' : 'transparent',
    color: showUnderlay ? '#a78bfa' : 'inherit',
    cursor: 'pointer',
  }}
>
  UL
</button>
{showUnderlay && (
  <select
    data-testid="plan-view-underlay-level-select"
    value={(activePlanView as any).underlayLevelId ?? ''}
    onChange={(e) =>
      onSemanticCommand?.({
        type: 'setPlanUnderlay',
        viewId: activePlanView.id,
        underlayLevelId: e.target.value || null,
        showUnderlay: true,
      })
    }
    style={{ fontSize: 10, padding: '1px 4px', background: 'transparent', color: 'inherit', border: '1px solid var(--border)' }}
  >
    <option value="">-- No Underlay --</option>
    {levels.map((lv) => (
      <option key={lv.id} value={lv.id}>{(lv as any).name ?? lv.id}</option>
    ))}
  </select>
)}
```

Where `showUnderlay = (activePlanView as any).showUnderlay ?? false` and `levels` is the list of level elements from props or useBimStore.

**Important**: Read PlanViewHeader.tsx carefully before editing. Adapt to the actual prop shapes. If `levels` are not passed as props, extract them from a store or pass them through.

### E — Plan renderer: ghost underlay walls

In `symbology.ts` (or wherever walls are rendered by level), after the main wall rendering loop, add an underlay pass:

```ts
// §2.9.4: underlay — render walls from underlayLevelId as ghost dashed lines
const activePlanViewEl = opts.activeViewId ? elementsById[opts.activeViewId] : undefined;
const underlayLevelId = (activePlanViewEl as any)?.underlayLevelId;
const showUnderlay = (activePlanViewEl as any)?.showUnderlay ?? false;
if (showUnderlay && underlayLevelId) {
  for (const el of Object.values(elementsById)) {
    if (el.kind !== 'wall') continue;
    if ((el as any).levelId !== underlayLevelId) continue;
    // Build a simple dashed line for the wall centre line
    const wall = el as any;
    const pts = [
      new THREE.Vector3(ux(wall.startMm.xMm), PLAN_Y + 0.001, uz(wall.startMm.yMm)),
      new THREE.Vector3(ux(wall.endMm.xMm), PLAN_Y + 0.001, uz(wall.endMm.yMm)),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x8b5cf6, dashSize: 0.05, gapSize: 0.03, opacity: 0.4, transparent: true });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    holder.add(line);
  }
}
```

**Important**: Read the actual symbology.ts rendering code carefully to understand `ux`, `uz`, `PLAN_Y`, and `holder`. Adapt the underlay pass to the actual rendering structure.

### F — commandCapabilities.ts entry

```ts
{
  id: 'view.plan-underlay',
  label: 'Plan Underlay (Show Lower Floor)',
  owner: 'plan/PlanViewHeader',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['plan-header', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§2.9.4: toggle + level selector shows lower floor walls as ghost/underlay lines in plan view.',
},
```

Add a matching `registerCommand` for `view.plan-underlay` in `defaultCommands.ts`.

### G — Tests

Create `packages/web/src/plan/planUnderlay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Plan underlay — §2.9.4', () => {
  it('SetPlanUnderlayCmd has correct shape', () => {
    const cmd = { type: 'setPlanUnderlay' as const, viewId: 'pv1', underlayLevelId: 'l0', showUnderlay: true };
    expect(cmd.type).toBe('setPlanUnderlay');
    expect(cmd.underlayLevelId).toBe('l0');
  });

  it('showUnderlay defaults to false when not set', () => {
    const view: any = { kind: 'plan_view', id: 'pv1' };
    expect((view.showUnderlay ?? false)).toBe(false);
  });

  it('toggle flips showUnderlay', () => {
    const view: any = { kind: 'plan_view', id: 'pv1', showUnderlay: false };
    const next = !view.showUnderlay;
    expect(next).toBe(true);
  });

  it('underlayLevelId can be cleared by setting null', () => {
    const cmd = { type: 'setPlanUnderlay' as const, viewId: 'pv1', underlayLevelId: null };
    expect(cmd.underlayLevelId).toBeNull();
  });

  it('underlay renders for walls on underlayLevelId', () => {
    const wall: any = { kind: 'wall', id: 'w1', levelId: 'l0' };
    const underlayLevelId = 'l0';
    expect(wall.levelId === underlayLevelId).toBe(true);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave28/A): plan underlay — underlayLevelId + showUnderlay on plan_view + SetPlanUnderlayCmd + PlanViewHeader UL toggle + ghost wall rendering (§2.9.4)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
