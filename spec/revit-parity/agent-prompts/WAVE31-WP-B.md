# Wave 31 — WP-B: Options Bar Door/Window/Grid Sections (§1.6.6)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.6 "Benutzung der Werkzeuge" is Partial P1. The options bar in `packages/web/src/workspace/authoring/OptionsBar.tsx` (1112 lines) already has sections for:

- wall (location line, chain, offset, radius)
- floor (type, level, offset)
- column (level, height, width, depth)
- stair (base/top level, width, run width)
- room (name, number, upper level)
- roof (base offset, slope angle)
- ramp (width, slope percent)
- railing (height, follow-slope)

Missing: door and window tools have NO options bar sections. In Revit, when you place a door/window, the options bar shows: tag on placement toggle + door/window type selector. Grid tool shows: spacing input + name input.

This task adds:

1. Module-level vars for door/window/grid options bar state
2. `planTool === 'door'` section (tag-on-place toggle + host-wall hint)
3. `planTool === 'window'` section (sill height input + tag-on-place toggle)
4. `planTool === 'grid'` section (spacing input + grid name prefix)
5. `view.options-bar-door-window` capability + `registerCommand`
6. Tests

---

## Repo orientation

```
packages/web/src/workspace/authoring/OptionsBar.tsx      — main file to edit (1112 lines)
packages/web/src/workspace/authoring/OptionsBar.test.tsx — existing test file
packages/web/src/workspace/authoring/optionsBarRoofRampRailing.test.tsx — pattern for new tests
```

Run before editing:

- `grep -n "planTool === 'roof'\|planTool === 'ramp'\|planTool === 'railing'\|planTool === 'door'\|planTool === 'window'\|planTool === 'grid'" packages/web/src/workspace/authoring/OptionsBar.tsx | head -20`
- `grep -n "export let\|export function set" packages/web/src/workspace/authoring/OptionsBar.tsx | head -20`
- `grep -n "data-testid.*options-roo\|data-testid.*options-ramp\|data-testid.*options-rail" packages/web/src/workspace/authoring/OptionsBar.tsx | head -15`

Read the file at the roof/ramp/railing section to understand the exact pattern (module-level var + setter + JSX block). Follow it precisely for door, window, grid.

---

## Tasks

### A — Module-level vars in OptionsBar.tsx

Find the section with `export let roofBaseOffsetMm` and similar exports. After those, add:

```ts
// §1.6.6: door options bar state
export let doorTagOnPlace = false;
export function setDoorTagOnPlace(v: boolean) {
  doorTagOnPlace = v;
}

// §1.6.6: window options bar state
export let windowSillHeightMm = 900;
export function setWindowSillHeightMm(v: number) {
  windowSillHeightMm = v;
}
export let windowTagOnPlace = false;
export function setWindowTagOnPlace(v: boolean) {
  windowTagOnPlace = v;
}

// §1.6.6: grid options bar state
export let gridSpacingMm = 6000;
export function setGridSpacingMm(v: number) {
  gridSpacingMm = v;
}
export let gridNamePrefix = 'A';
export function setGridNamePrefix(v: string) {
  gridNamePrefix = v;
}
```

**Important**: Read the actual file before editing to find the exact location where roof/ramp/railing vars are defined. Insert these immediately after.

### B — Door section JSX

Find where the railing section ends in the OptionsBar JSX render (search for `planTool === 'railing'` JSX). After the railing block, add a door section:

```tsx
{
  /* §1.6.6: door options bar */
}
{
  planTool === 'door' && (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="checkbox"
          data-testid="options-door-tag-on-place"
          defaultChecked={doorTagOnPlace}
          onChange={(ev) => setDoorTagOnPlace(ev.currentTarget.checked)}
        />
        <span>Tag on Placement</span>
      </label>
    </div>
  );
}
```

### C — Window section JSX

After the door block, add:

```tsx
{
  /* §1.6.6: window options bar */
}
{
  planTool === 'window' && (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span>Sill Height (mm):</span>
        <input
          type="number"
          data-testid="options-window-sill-height"
          defaultValue={windowSillHeightMm}
          step={50}
          min={0}
          onChange={(ev) => setWindowSillHeightMm(Number(ev.currentTarget.value))}
          style={{ width: 72 }}
        />
      </label>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="checkbox"
          data-testid="options-window-tag-on-place"
          defaultChecked={windowTagOnPlace}
          onChange={(ev) => setWindowTagOnPlace(ev.currentTarget.checked)}
        />
        <span>Tag on Placement</span>
      </label>
    </div>
  );
}
```

### D — Grid section JSX

After the window block, add:

```tsx
{
  /* §1.6.6: grid options bar */
}
{
  planTool === 'grid' && (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span>Spacing (mm):</span>
        <input
          type="number"
          data-testid="options-grid-spacing"
          defaultValue={gridSpacingMm}
          step={500}
          min={100}
          onChange={(ev) => setGridSpacingMm(Number(ev.currentTarget.value))}
          style={{ width: 80 }}
        />
      </label>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span>Prefix:</span>
        <input
          type="text"
          data-testid="options-grid-name-prefix"
          defaultValue={gridNamePrefix}
          maxLength={4}
          onChange={(ev) => setGridNamePrefix(ev.currentTarget.value)}
          style={{ width: 48 }}
        />
      </label>
    </div>
  );
}
```

### E — commandCapabilities.ts entry

In `packages/web/src/workspace/commandCapabilities.ts`, add:

```ts
{
  id: 'view.options-bar-door-window',
  label: 'Options Bar — Door / Window / Grid',
  owner: 'workspace/authoring/OptionsBar',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['plan-canvas', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.6: door (tag-on-place), window (sill height + tag-on-place), grid (spacing + name prefix) options bar sections added; module-level vars doorTagOnPlace/windowSillHeightMm/gridSpacingMm.',
},
```

Add matching `registerCommand` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.options-bar-door-window',
  label: 'Options Bar (Door / Window / Grid)',
  keywords: ['options bar', 'door', 'window', 'grid', 'sill height', 'tag on place', 'spacing'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // Options bar appears automatically when door/window/grid tool is active
  },
});
```

### F — Tests

Create `packages/web/src/workspace/authoring/optionsBarDoorWindowGrid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  doorTagOnPlace,
  setDoorTagOnPlace,
  windowSillHeightMm,
  setWindowSillHeightMm,
  windowTagOnPlace,
  setWindowTagOnPlace,
  gridSpacingMm,
  setGridSpacingMm,
  gridNamePrefix,
  setGridNamePrefix,
} from './OptionsBar';

describe('Options bar door/window/grid — §1.6.6', () => {
  it('doorTagOnPlace defaults to false', () => {
    expect(doorTagOnPlace).toBe(false);
  });

  it('setDoorTagOnPlace updates module var', () => {
    setDoorTagOnPlace(true);
    expect(doorTagOnPlace).toBe(true);
    setDoorTagOnPlace(false); // reset
  });

  it('windowSillHeightMm defaults to 900', () => {
    expect(windowSillHeightMm).toBe(900);
  });

  it('setWindowSillHeightMm updates module var', () => {
    setWindowSillHeightMm(1200);
    expect(windowSillHeightMm).toBe(1200);
    setWindowSillHeightMm(900); // reset
  });

  it('gridSpacingMm defaults to 6000', () => {
    expect(gridSpacingMm).toBe(6000);
  });

  it('setGridSpacingMm updates module var', () => {
    setGridSpacingMm(8000);
    expect(gridSpacingMm).toBe(8000);
    setGridSpacingMm(6000); // reset
  });

  it('gridNamePrefix defaults to A', () => {
    expect(gridNamePrefix).toBe('A');
  });

  it('setGridNamePrefix updates module var', () => {
    setGridNamePrefix('1');
    expect(gridNamePrefix).toBe('1');
    setGridNamePrefix('A'); // reset
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave31/B): options bar door/window/grid sections — tag-on-place, sill height, grid spacing/prefix + view.options-bar-door-window capability (§1.6.6)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 8 tests.
