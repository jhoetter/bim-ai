# Wave 27 — WP-B: Work Plane Face Orientation + Grid (§7.3.2 + §7.3.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§7.3.2 "Arbeitsebene ausrichten" is Partial P2. Orienting the current work plane to an arbitrary element face is Not Started. In Revit, you can "Set Work Plane" to a face of a wall/floor/roof, so that subsequently placed elements snap to that tilted or offset surface.

§7.3.3 "Arbeitsebenenraster" is Partial P2. Grid display on the active work plane for snap reference is Not Started. In Revit, a work plane grid (dotted lines at regular intervals) is shown when a non-horizontal work plane is active.

This task adds:

1. `workPlaneNormalDeg?: number` field on the active plan view or a new `work_plane` element type
2. `setWorkPlaneFace` command — picks a wall/floor face and stores its normal as the active work plane
3. A "Set Work Plane" dialog / button in the inspector for wall elements
4. Work plane grid overlay in the 3D viewport (a grid of dots at the active work plane's elevation/orientation)
5. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find plan_view element, look for workPlane fields
packages/web/src/workspace/SetWorkPlaneDialog.tsx       — check if this already exists (grep for it)
packages/web/src/viewport/Viewport.tsx                  — find where grid/guides are rendered
packages/web/src/workspace/Workspace.tsx                — find setWorkPlane handler if any
```

Run before editing:

- `grep -n "workPlane\|work_plane\|SetWorkPlane\|WorkPlane" packages/core/src/index.ts | head -10`
- `grep -rn "workPlane\|work_plane\|SetWorkPlane" packages/web/src/workspace/ | head -15`
- `grep -rn "SetWorkPlane\|workPlane" packages/web/src/ | head -10`
- `grep -n "workPlane\|work_plane" packages/web/src/workspace/Workspace.tsx | head -10`

Read the existing work plane implementation carefully before adding anything.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Check existing SetWorkPlaneDialog

Check if `packages/web/src/workspace/SetWorkPlaneDialog.tsx` already exists. If it does, read it carefully before modifying. If it doesn't exist, create it (step D below).

Also check if `work_plane` element type or `workPlaneNormalDeg` already exists in `packages/core/src/index.ts`.

### B — Add work_plane element type or extend plan_view (if not already present)

If a `work_plane` element type or `activeWorkPlane` fields don't exist yet, add to `packages/core/src/index.ts`:

```ts
| {
    kind: 'work_plane';
    id: string;
    /** Display name for the work plane. */
    name: string;
    /** Host element ID (wall, floor, roof) whose face defines the plane. */
    hostElementId?: string;
    /** Elevation of the work plane in mm (for horizontal planes). */
    elevationMm: number;
    /** Normal vector in plan (degrees from +X axis). 0 = XY plane (horizontal). */
    normalDeg?: number;
    levelId: string;
  }
```

Add `'work_plane'` to the `ElemKind` union.

Also add `activeWorkPlaneId?: string` to the `plan_view` element type if not already present.

### C — Add SetWorkPlaneFaceCmd

Find where other `Cmd` types are defined. Add:

```ts
export type SetWorkPlaneFaceCmd = {
  type: 'setWorkPlaneFace';
  /** ID of the wall/floor element whose face to use as the work plane. */
  hostElementId: string;
  /** Which face: 'front' | 'back' | 'top' | 'bottom'. Default 'front'. */
  faceKey?: string;
  /** Display name. */
  name?: string;
};
```

Add `| SetWorkPlaneFaceCmd` to `SemanticCommand` and export it.

### D — Workspace handler in Workspace.tsx

Find where other element handlers are. Add:

```ts
if (cmd.type === 'setWorkPlaneFace') {
  const { elementsById: cur } = useBimStore.getState();
  const host = cur[cmd.hostElementId as string];
  if (!host) return;
  const newId = crypto.randomUUID();
  // Create the work plane element derived from the host element's face
  const normalDeg = host.kind === 'wall' ? (((host as any).angleDeg ?? 0) + 90) % 360 : 0;
  const elevationMm = host.kind === 'floor' ? ((host as any).baseElevationMm ?? 0) : 0;
  const wp = {
    kind: 'work_plane',
    id: newId,
    name: (cmd.name as string | undefined) ?? `Face of ${host.kind} ${host.id.slice(0, 6)}`,
    hostElementId: cmd.hostElementId as string,
    elevationMm,
    normalDeg,
    levelId: (host as any).levelId ?? '',
  };
  useBimStore.setState({
    elementsById: { ...cur, [newId]: wp as any },
  });
  return;
}
```

### E — SetWorkPlaneDialog (create or update)

If `SetWorkPlaneDialog.tsx` doesn't exist, create `packages/web/src/workspace/SetWorkPlaneDialog.tsx`:

```tsx
import * as React from 'react';
import type { Element } from '@bim-ai/core';

interface Props {
  elements: Element[];
  onSetWorkPlane: (hostElementId: string, name: string) => void;
  onClose: () => void;
}

export function SetWorkPlaneDialog({ elements, onSetWorkPlane, onClose }: Props) {
  const walls = elements.filter((el) => el.kind === 'wall');
  const floors = elements.filter((el) => el.kind === 'floor');
  const [selectedId, setSelectedId] = React.useState('');
  const [name, setName] = React.useState('Work Plane 1');

  return (
    <div data-testid="set-work-plane-dialog" style={{ padding: 16 }}>
      <div className="text-sm font-semibold mb-4">Set Work Plane</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Name:</label>
        <input
          data-testid="work-plane-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ fontSize: 12, marginLeft: 8, padding: '2px 4px' }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Host element:</label>
        <select
          data-testid="work-plane-host-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ fontSize: 12, marginLeft: 8 }}
        >
          <option value="">-- Level (horizontal) --</option>
          <optgroup label="Walls">
            {walls.map((w) => (
              <option key={w.id} value={w.id}>
                Wall {w.id.slice(0, 8)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Floors">
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                Floor {f.id.slice(0, 8)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          data-testid="work-plane-confirm-btn"
          onClick={() => {
            if (selectedId) onSetWorkPlane(selectedId, name);
            onClose();
          }}
          style={{ fontSize: 12, padding: '3px 12px' }}
        >
          OK
        </button>
        <button onClick={onClose} style={{ fontSize: 12, padding: '3px 12px' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

### F — commandCapabilities.ts entry

```ts
{
  id: 'view.set-work-plane-face',
  label: 'Set Work Plane to Face',
  owner: 'workspace/SetWorkPlaneDialog',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§7.3.2: creates a work_plane element from a selected wall/floor face normal; §7.3.3: dialog shows host element selector.',
},
```

Note: `surfaces` does NOT include `'cmd-k'` so no `registerCommand` is needed.

### G — Tests

Create `packages/web/src/workspace/workPlane.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Work plane face orientation — §7.3.2 §7.3.3', () => {
  it('SetWorkPlaneFaceCmd has correct shape', () => {
    const cmd = { type: 'setWorkPlaneFace' as const, hostElementId: 'wall-01' };
    expect(cmd.type).toBe('setWorkPlaneFace');
    expect(cmd.hostElementId).toBe('wall-01');
  });

  it('work_plane element has required fields', () => {
    const wp: any = {
      kind: 'work_plane',
      id: 'wp-01',
      name: 'Stair Wall Plane',
      hostElementId: 'wall-01',
      elevationMm: 0,
      normalDeg: 90,
      levelId: 'l1',
    };
    expect(wp.kind).toBe('work_plane');
    expect(wp.normalDeg).toBe(90);
  });

  it('wall face normal = wall angle + 90 degrees', () => {
    const wallAngleDeg = 45;
    const normalDeg = (wallAngleDeg + 90) % 360;
    expect(normalDeg).toBe(135);
  });

  it('horizontal floor has normalDeg = 0', () => {
    const floor: any = { kind: 'floor', angleDeg: 0 };
    const normalDeg = floor.kind === 'floor' ? 0 : ((floor.angleDeg ?? 0) + 90) % 360;
    expect(normalDeg).toBe(0);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave27/B): work plane face orientation — work_plane element type + SetWorkPlaneFaceCmd + Workspace handler + SetWorkPlaneDialog (§7.3.2 §7.3.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
