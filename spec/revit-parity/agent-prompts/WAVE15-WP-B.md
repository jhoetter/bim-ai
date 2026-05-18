# Wave 15 — WP-B: Steel Connection Inspector + Schedule Preset (§9.5.1 + §9.5.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — steel_connection element type (line ~2464)
packages/web/src/viewport/meshBuilders.ts               — buildSteelConnectionMesh (~line 3612)
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/schedules/scheduleDefinitionPresets.ts — schedule presets list
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts` at the `steel_connection` kind (around line 2464):
   - Fields: `connectionType: 'end_plate' | 'bolted_flange' | 'shear_tab'`, `hostElementId`, `targetElementId`, `positionT`, `plateSizeMm { width, height, thickness }`, `boltRows`, `boltCols`, `boltDiameterMm`.
2. `meshBuilders.ts` — `buildSteelConnectionMesh` builds a proper end-plate / bolted-flange / shear-tab mesh with bolt grid. It is already wired into the 3D renderer. **Do not change the mesh builder** — it is working.
3. `InspectorContent.tsx` — find where `kind === 'steel_connection'` is handled. If no section exists, create one in the structural elements area (near beam/column sections).
4. `scheduleDefinitionPresets.ts` — find the existing presets (door, window, wall, beam, etc.). The `furniture` preset was added recently. Add a `steel_connection` preset below it.

---

## Tasks

### A — Inspector panel for steel connections

In `InspectorContent.tsx`, find or create the section for `kind === 'steel_connection'`. If it already has some fields, extend it. If absent, add a collapsible section with:

```tsx
// data-testid="inspector-steel-connection"
<CollapsibleSection title="Steel Connection" data-testid="inspector-steel-connection">
  {/* Connection type */}
  <label>Type</label>
  <select
    data-testid="inspector-steel-conn-type"
    value={el.connectionType}
    onChange={(e) => onPropertyChange('connectionType', e.currentTarget.value)}
  >
    <option value="end_plate">End Plate</option>
    <option value="bolted_flange">Bolted Flange</option>
    <option value="shear_tab">Shear Tab</option>
  </select>

  {/* Plate dimensions */}
  <label>Plate Width (mm)</label>
  <input
    type="number"
    data-testid="inspector-steel-conn-plate-w"
    value={el.plateSizeMm?.width ?? 150}
    onChange={(e) =>
      onPropertyChange('plateSizeMm', { ...el.plateSizeMm, width: +e.currentTarget.value })
    }
  />
  <label>Plate Height (mm)</label>
  <input
    type="number"
    data-testid="inspector-steel-conn-plate-h"
    value={el.plateSizeMm?.height ?? 200}
    onChange={(e) =>
      onPropertyChange('plateSizeMm', { ...el.plateSizeMm, height: +e.currentTarget.value })
    }
  />
  <label>Plate Thickness (mm)</label>
  <input
    type="number"
    data-testid="inspector-steel-conn-plate-t"
    value={el.plateSizeMm?.thickness ?? 10}
    onChange={(e) =>
      onPropertyChange('plateSizeMm', { ...el.plateSizeMm, thickness: +e.currentTarget.value })
    }
  />

  {/* Bolt grid */}
  <label>Bolt Rows</label>
  <input
    type="number"
    min={1}
    max={10}
    data-testid="inspector-steel-conn-bolt-rows"
    value={el.boltRows ?? 2}
    onChange={(e) => onPropertyChange('boltRows', +e.currentTarget.value)}
  />
  <label>Bolt Columns</label>
  <input
    type="number"
    min={1}
    max={10}
    data-testid="inspector-steel-conn-bolt-cols"
    value={el.boltCols ?? 2}
    onChange={(e) => onPropertyChange('boltCols', +e.currentTarget.value)}
  />
  <label>Bolt Diameter (mm)</label>
  <input
    type="number"
    data-testid="inspector-steel-conn-bolt-diam"
    value={el.boltDiameterMm ?? 20}
    onChange={(e) => onPropertyChange('boltDiameterMm', +e.currentTarget.value)}
  />

  {/* Host element read-only */}
  <label>Host Element</label>
  <span data-testid="inspector-steel-conn-host">{el.hostElementId?.slice(0, 8) ?? '—'}</span>
</CollapsibleSection>
```

The `onPropertyChange` function should dispatch `updateElementProperty` or `update_steel_connection` patch command — use the same pattern as beam or column inspector sections.

---

### B — Steel connection schedule preset

In `scheduleDefinitionPresets.ts`, add a new preset after the furniture preset:

```ts
{
  id: 'steel_connections',
  name: 'Steel Connections',
  category: 'steel_connection',
  fields: [
    { fieldKey: 'connectionType', token: 'required', csvExportHint: 'Connection type' },
    { fieldKey: 'hostElementId', token: 'optional', csvExportHint: 'Host element id' },
    { fieldKey: 'targetElementId', token: 'optional', csvExportHint: 'Target element id' },
    { fieldKey: 'boltRows', token: 'optional', csvExportHint: 'Bolt rows' },
    { fieldKey: 'boltCols', token: 'optional', csvExportHint: 'Bolt cols' },
    { fieldKey: 'boltDiameterMm', token: 'optional', unitHint: 'mm' },
    { fieldKey: 'count', token: 'optional', aggregation: 'count' },
  ],
},
```

Also add `'steel_connection'` to the `SchedulePresetCategory` union type if it isn't there already.

---

### C — Tests

Create `packages/web/src/workspace/inspector/steelConnectionInspector.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// minimal mock of the inspector for steel_connection

describe('steel connection inspector — §9.5.1', () => {
  it('renders connection type select with end_plate/bolted_flange/shear_tab options', () => { ... });
  it('renders plate width/height/thickness inputs', () => { ... });
  it('renders bolt rows and cols inputs', () => { ... });
  it('renders bolt diameter input', () => { ... });
  it('shows host element id read-only', () => { ... });
});
```

Create `packages/web/src/schedules/steelConnectionSchedule.test.ts`:

```ts
describe('steel connection schedule preset — §9.5.2', () => {
  it('getSchedulePresets includes steel_connections preset', () => { ... });
  it('steel_connections preset has connectionType field', () => { ... });
  it('steel_connections preset has count aggregation field', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/B): steel connection inspector + schedule preset (§9.5.1-2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new inspector and schedule tests.
