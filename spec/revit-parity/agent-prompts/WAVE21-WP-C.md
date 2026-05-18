# Wave 21 — WP-C: Select Linked Elements Toggle (§3.3.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.3.1 "Gruppe Auswählen" is Partial — "Link selection toggle is Not Started". In Revit, you can toggle whether clicks select linked model elements. bim-ai has `link_model` elements but no toggle to enable/disable their selection. This task adds a `selectLinkedEnabled` store field and wires it into PlanCanvas click handling and a toggle button.

---

## Repo orientation

```
packages/web/src/state/storeTypes.ts             — add selectLinkedEnabled: boolean
packages/web/src/state/storeViewportRuntimeSlice.ts — initialise + setter
packages/web/src/plan/PlanCanvas.tsx             — filter link_model elements when toggle is off
packages/web/src/plan/PlanViewHeader.tsx         — add toggle button
```

Read `storeTypes.ts` to understand the store shape — search for `thinLinesEnabled` as an example boolean store field. Read `storeViewportRuntimeSlice.ts` to see how store slices are structured. Read `PlanViewHeader.tsx` to see where toggle buttons (like thinLines, legend) are placed.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Store field

In `packages/web/src/state/storeTypes.ts`, add to `StoreState`:

```ts
selectLinkedEnabled: boolean;
setSelectLinkedEnabled: (enabled: boolean) => void;
```

In `packages/web/src/state/storeViewportRuntimeSlice.ts` (or whichever slice owns viewport UI booleans — grep for `thinLinesEnabled` to find the right file), initialise:

```ts
selectLinkedEnabled: false,
setSelectLinkedEnabled: (enabled) => set({ selectLinkedEnabled: enabled }),
```

### B — Filter linked elements in PlanCanvas.tsx

In `packages/web/src/plan/PlanCanvas.tsx`:

1. Subscribe to `selectLinkedEnabled`:

```ts
const selectLinkedEnabled = useBimStore((s) => s.selectLinkedEnabled);
```

2. Find the click / selection handling path (search for `bimPickId` or `setSelectedElementIds`) where element IDs are resolved from picks. Where the selected element is looked up in `elementsById`, add a filter:

```ts
// Skip link_model elements when selectLinkedEnabled is false
if (!selectLinkedEnabled && el?.kind === 'link_model') return;
```

Also apply to box selection (search for `crossingSelection` or `boxSelectIds`):

```ts
const ids = rawIds.filter((id) => {
  const el = elementsById[id];
  return selectLinkedEnabled || el?.kind !== 'link_model';
});
```

You may need to adapt the exact code path. Read the existing click and box-select handlers carefully before editing.

### C — Toggle button in PlanViewHeader.tsx

In `packages/web/src/plan/PlanViewHeader.tsx`:

1. Accept new props (or subscribe to store directly — follow the existing pattern for `thinLinesEnabled`):

```ts
const selectLinkedEnabled = useBimStore((s) => s.selectLinkedEnabled);
const setSelectLinkedEnabled = useBimStore((s) => s.setSelectLinkedEnabled);
```

2. Add a toggle button near other view control buttons (near TL / legend buttons):

```tsx
<button
  data-testid="plan-view-select-linked-toggle"
  title={selectLinkedEnabled ? 'Disable Linked Selection' : 'Enable Linked Selection'}
  onClick={() => setSelectLinkedEnabled(!selectLinkedEnabled)}
  style={{
    padding: '2px 6px',
    borderRadius: 4,
    background: selectLinkedEnabled ? '#2563eb' : 'transparent',
    color: selectLinkedEnabled ? '#fff' : '#aaa',
    border: '1px solid #555',
    fontSize: 11,
    cursor: 'pointer',
  }}
>
  LK
</button>
```

### D — Palette command

In `packages/web/src/cmdPalette/defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'selection.toggle-select-linked',
  label: 'Toggle Select Linked Elements',
  keywords: ['link', 'select linked', 'linked model', 'selection', 'toggle'],
  category: 'command',
  invoke: () => {
    const { selectLinkedEnabled, setSelectLinkedEnabled } = useBimStore.getState();
    setSelectLinkedEnabled(!selectLinkedEnabled);
  },
});
```

### E — commandCapabilities.ts

In `packages/web/src/workspace/commandCapabilities.ts`, add:

```ts
{
  id: 'selection.toggle-select-linked',
  label: 'Toggle Select Linked Elements',
  owner: 'cmdPalette/defaultCommands',
  group: 'selection',
  scope: 'global',
  intendedModes: ['plan'],
  surfaces: ['cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§3.3.1: toggles whether link_model elements are selectable in plan view.',
},
```

### F — Tests

Create `packages/web/src/plan/selectLinkedToggle.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useBimStore } from '../state/store';

beforeEach(() => {
  useBimStore.setState({ selectLinkedEnabled: false });
});

describe('Select linked toggle — §3.3.1', () => {
  it('selectLinkedEnabled defaults to false', () => {
    expect(useBimStore.getState().selectLinkedEnabled).toBe(false);
  });

  it('setSelectLinkedEnabled toggles the value', () => {
    useBimStore.getState().setSelectLinkedEnabled(true);
    expect(useBimStore.getState().selectLinkedEnabled).toBe(true);
    useBimStore.getState().setSelectLinkedEnabled(false);
    expect(useBimStore.getState().selectLinkedEnabled).toBe(false);
  });
});
```

Create `packages/web/src/plan/PlanViewSelectLinked.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useBimStore } from '../state/store';
import { PlanViewHeader } from './PlanViewHeader';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useBimStore.setState({ selectLinkedEnabled: false });
});

describe('PlanViewHeader select-linked toggle — §3.3.1', () => {
  it('renders LK toggle button', () => {
    render(
      <PlanViewHeader
        viewName="Level 0"
        scale={100}
        levelId="L1"
        planViewSubtype={undefined}
        cropRegionEnabled={false}
        thinLinesEnabled={false}
        colorScheme={undefined}
        legendVisible={false}
        onToggleCropRegion={() => {}}
        onToggleThinLines={() => {}}
        onToggleLegend={() => {}}
        onColorSchemeChange={() => {}}
        onOpenVG={() => {}}
        trueNorthActive={false}
        onTrueNorthToggle={() => {}}
        projectNorthAngleDeg={0}
        activeWorkPlaneId={undefined}
        onClearWorkPlane={() => {}}
        planViewAngleDeg={0}
      />,
    );
    expect(screen.getByTestId('plan-view-select-linked-toggle')).toBeTruthy();
  });

  it('clicking LK toggle enables select linked', () => {
    render(
      <PlanViewHeader
        viewName="Level 0"
        scale={100}
        levelId="L1"
        planViewSubtype={undefined}
        cropRegionEnabled={false}
        thinLinesEnabled={false}
        colorScheme={undefined}
        legendVisible={false}
        onToggleCropRegion={() => {}}
        onToggleThinLines={() => {}}
        onToggleLegend={() => {}}
        onColorSchemeChange={() => {}}
        onOpenVG={() => {}}
        trueNorthActive={false}
        onTrueNorthToggle={() => {}}
        projectNorthAngleDeg={0}
        activeWorkPlaneId={undefined}
        onClearWorkPlane={() => {}}
        planViewAngleDeg={0}
      />,
    );
    fireEvent.click(screen.getByTestId('plan-view-select-linked-toggle'));
    expect(useBimStore.getState().selectLinkedEnabled).toBe(true);
  });
});
```

Note: Adapt the `PlanViewHeader` props to match its actual signature — read the component definition first and use only the props it accepts. Do not guess props. If `PlanViewHeader` subscribes to the store directly for the new `selectLinkedEnabled` field, simplify the test to just render with minimal required props and test the button and store state.

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave21/C): select linked elements toggle — LK button in PlanViewHeader + store field + palette command (§3.3.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
