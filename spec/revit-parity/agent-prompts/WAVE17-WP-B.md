# Wave 17 — WP-B: True North Rotation + Project Elevation Offset (§5.3, §5.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                         — project_settings element + plan_view element
packages/web/src/plan/PlanCanvas.tsx               — plan canvas (rotation rendering)
packages/web/src/plan/PlanViewHeader.tsx           — plan view header controls
packages/web/src/cmdPalette/defaultCommands.ts     — palette commands
packages/web/src/workspace/commandCapabilities.ts  — capability graph
packages/web/src/workspace/Workspace.tsx            — handlers
```

Search for `trueNorth`, `true_north`, `angleToNorth`, `projectNorth`, `elevationOffset`, `realWorldElevation` in the codebase first.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: find `project_settings` element — read ALL fields, especially any angle or north-related fields and elevation fields.
2. `core/index.ts`: find `plan_view` element — look for `planViewAngleDeg` or rotation fields.
3. Search `PlanCanvas.tsx` for canvas rotation — find where the plan view group transform is applied.
4. Search `PlanViewHeader.tsx` for existing north arrow or angle controls.

---

## Tasks

### A — `project_settings` extension in `core/index.ts`

Add fields to `project_settings` element (if not already present):

```ts
// In project_settings:
angleToTrueNorthDeg?: number;   // clockwise degrees from project north to true north
projectElevationMm?: number;    // real-world elevation of project base point (mm)
```

Add command types:
```ts
| { type: 'setAngleToTrueNorth'; angleDeg: number }
| { type: 'setProjectElevation'; elevationMm: number }
```

Add `planViewAngleDeg?: number` to `plan_view` element (the per-view rotation for displaying true north).

---

### B — Palette commands

In `defaultCommands.ts`:

```ts
{
  id: 'view.rotate-to-true-north',
  label: 'Rotate View to True North',
  keywords: ['north', 'rotate', 'true north', 'orientation'],
  category: 'command',
  invoke: (ctx) => ctx.rotateToTrueNorth?.(),
},
{
  id: 'project.set-true-north',
  label: 'Set True North Angle…',
  keywords: ['north', 'angle', 'project', 'orientation', 'georef'],
  category: 'command',
  invoke: (ctx) => ctx.setTrueNorthAngle?.(),
},
{
  id: 'project.set-elevation',
  label: 'Set Project Elevation…',
  keywords: ['elevation', 'height', 'real world', 'offset'],
  category: 'command',
  invoke: (ctx) => ctx.setProjectElevation?.(),
},
```

---

### C — Workspace handlers

In `Workspace.tsx`:

```ts
rotateToTrueNorth: () => {
  const ps = Object.values(elementsById).find(e => e?.kind === 'project_settings');
  const angleDeg = (ps as any)?.angleToTrueNorthDeg ?? 0;
  const activeView = /* get active plan_view element */;
  if (!activeView) return;
  void onSemanticCommand({
    type: 'updateElementProperty',
    elementId: activeView.id,
    key: 'planViewAngleDeg',
    value: -angleDeg,  // rotate view opposite to true north offset
  });
},

setTrueNorthAngle: () => {
  const angleDeg = parseFloat(prompt('Angle from project north to true north (degrees clockwise):') ?? '0');
  if (isNaN(angleDeg)) return;
  const ps = Object.values(elementsById).find(e => e?.kind === 'project_settings');
  if (!ps) return;
  void onSemanticCommand({
    type: 'updateElementProperty',
    elementId: ps.id,
    key: 'angleToTrueNorthDeg',
    value: angleDeg,
  });
},

setProjectElevation: () => {
  const elevMm = parseFloat(prompt('Project real-world elevation (mm):') ?? '0');
  if (isNaN(elevMm)) return;
  const ps = Object.values(elementsById).find(e => e?.kind === 'project_settings');
  if (!ps) return;
  void onSemanticCommand({
    type: 'updateElementProperty',
    elementId: ps.id,
    key: 'projectElevationMm',
    value: elevMm,
  });
},
```

---

### D — Plan canvas rotation

In `PlanCanvas.tsx`, apply `planViewAngleDeg` to the root group:

Find where the plan view group transform is applied (look for `group.rotation` or a CSS transform on the canvas element). Apply the rotation:

```ts
const angleDeg = activeView?.planViewAngleDeg ?? 0;
planGroup.rotation.y = (angleDeg * Math.PI) / 180;
// OR for SVG/CSS canvas:
// style={{ transform: `rotate(${angleDeg}deg)` }}
```

---

### E — PlanViewHeader indicator

In `PlanViewHeader.tsx`, add a north indicator when `planViewAngleDeg !== 0`:

```tsx
{(activeView?.planViewAngleDeg ?? 0) !== 0 && (
  <span
    data-testid="plan-view-north-angle"
    title="View rotated to true north"
    style={{ fontSize: 11, color: '#666' }}
  >
    ↑{(activeView?.planViewAngleDeg ?? 0).toFixed(1)}°
  </span>
)}
```

---

### F — Capability graph

In `commandCapabilities.ts`:
```ts
{ id: 'view.rotate-to-true-north', scope: 'document', intendedModes: ['plan'], precondition: null },
{ id: 'project.set-true-north', scope: 'document', intendedModes: ['plan', '3d'], precondition: null },
{ id: 'project.set-elevation', scope: 'document', intendedModes: ['plan', '3d'], precondition: null },
```

---

### G — Tests

`packages/web/src/plan/trueNorth.test.ts`:
```ts
describe('true north rotation — §5.4.2', () => {
  it('rotateToTrueNorth sets planViewAngleDeg to negative of angleToTrueNorthDeg', () => { ... });
  it('planViewAngleDeg defaults to 0 when not set', () => { ... });
});

describe('project elevation — §5.3', () => {
  it('setProjectElevation stores elevationMm on project_settings', () => { ... });
  it('projectElevationMm defaults to 0 when not set', () => { ... });
});
```

`packages/web/src/plan/PlanViewHeader.trueNorth.test.tsx`:
```ts
describe('PlanViewHeader north indicator — §5.4.2', () => {
  it('renders plan-view-north-angle when planViewAngleDeg is non-zero', () => { ... });
  it('does not render plan-view-north-angle when planViewAngleDeg is 0', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave17/B): true north rotation + project elevation offset (§5.3, §5.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new true north tests.
