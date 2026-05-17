# Wave 21 — WP-D: Terrace Preset Workflow — Floor + Railing in One Step (§2.9.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§2.9.1 "Terrasse" is Partial — bim-ai has floors and railings but lacks "terrace-specific templates or workflow shortcuts". Revit architects quickly model a terrace by selecting a floor boundary and auto-creating a perimeter railing. This task adds:
- A `modify.create-terrace-from-floor` palette command that, when a floor is selected, auto-creates a perimeter railing along all floor boundary edges
- A `TerracePresetDialog.tsx` to configure railing height before applying

---

## Repo orientation

```
packages/core/src/index.ts                        — railing element shape (find RailingElem)
packages/web/src/cmdPalette/defaultCommands.ts    — register palette command
packages/web/src/workspace/Workspace.tsx          — handler that creates the railing
packages/web/src/workspace/commandCapabilities.ts — add capability entry
```

Read `packages/core/src/index.ts` — search for `kind: 'railing'` to understand the railing element shape (fields: `pathMm`, `heightMm`, `levelId`, etc.).

Read `packages/web/src/cmdPalette/defaultCommands.ts` to see how palette commands are registered.

Read `packages/web/src/workspace/Workspace.tsx` to see how semantic commands are dispatched (search for `case 'createRailing'` or the handler where railings are created).

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — terraceFromFloor.ts utility

Create `packages/web/src/plan/terraceFromFloor.ts`:

```ts
import type { FloorElem, RailingElem } from '@bim-ai/core';

/**
 * Builds a railing element that traces the perimeter of a floor boundary.
 * Returns null if the floor has no boundary.
 */
export function buildTerraceRailing(
  floor: FloorElem,
  railingHeightMm: number,
): RailingElem | null {
  const pts = floor.boundaryMm;
  if (!pts || pts.length < 3) return null;

  // Close the path by repeating the first point
  const path = [...pts, pts[0]];

  return {
    id: crypto.randomUUID(),
    kind: 'railing',
    levelId: floor.levelId,
    pathMm: path,
    heightMm: railingHeightMm,
  } as RailingElem;
}
```

Note: Adjust fields to match the actual `RailingElem` type — read `packages/core/src/index.ts` first and only use fields that actually exist on `RailingElem`. Omit any fields that are optional or don't exist.

### B — TerracePresetDialog.tsx

Create `packages/web/src/workspace/TerracePresetDialog.tsx`:

```tsx
import { useState } from 'react';

interface TerracePresetDialogProps {
  floorId: string;
  onApply: (railingHeightMm: number) => void;
  onClose: () => void;
}

export function TerracePresetDialog({ floorId, onApply, onClose }: TerracePresetDialogProps) {
  const [railingHeightMm, setRailingHeightMm] = useState(1100);

  return (
    <div data-testid="terrace-preset-dialog"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#1a1a2e', color: '#eee', padding: 24, borderRadius: 8, width: 320 }}>
        <h3 style={{ marginTop: 0 }}>Create Terrace</h3>
        <p style={{ fontSize: 13, color: '#aaa' }}>
          A perimeter railing will be added along all edges of the selected floor boundary.
        </p>
        <label style={{ display: 'block', marginBottom: 16 }}>
          Railing Height (mm)
          <input
            type="number"
            data-testid="terrace-railing-height-input"
            value={railingHeightMm}
            min={800}
            max={2000}
            step={50}
            onChange={e => setRailingHeightMm(+e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button data-testid="terrace-preset-cancel" onClick={onClose}>
            Cancel
          </button>
          <button data-testid="terrace-preset-apply"
            onClick={() => { onApply(railingHeightMm); onClose(); }}>
            Create Terrace
          </button>
        </div>
      </div>
    </div>
  );
}
```

### C — Palette command + Workspace handler

In `packages/web/src/cmdPalette/defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'modify.create-terrace-from-floor',
  label: 'Create Terrace from Floor',
  keywords: ['terrace', 'balcony', 'railing', 'perimeter', 'floor', 'create terrace'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some(e => e.kind === 'floor') ?? false,
  invoke: (ctx) => {
    ctx.openTerracePreset?.();
  },
});
```

Add `openTerracePreset?: () => void` to the `PaletteContext` interface (grep for `PaletteContext` to find its definition).

In `Workspace.tsx`:
1. Import `TerracePresetDialog` and `buildTerraceRailing`
2. Add `const [terraceFloorId, setTerraceFloorId] = useState<string | null>(null);`
3. Wire `openTerracePreset: () => { const sel = selectedElements?.[0]; if (sel?.kind === 'floor') setTerraceFloorId(sel.id); }` into the palette context
4. In JSX:
```tsx
{terraceFloorId && (
  <TerracePresetDialog
    floorId={terraceFloorId}
    onApply={(railingHeightMm) => {
      const floor = elementsById[terraceFloorId];
      if (floor?.kind === 'floor') {
        const railing = buildTerraceRailing(floor, railingHeightMm);
        if (railing) {
          useBimStore.setState({
            elementsById: { ...elementsById, [railing.id]: railing },
          });
        }
      }
      setTerraceFloorId(null);
    }}
    onClose={() => setTerraceFloorId(null)}
  />
)}
```

### D — commandCapabilities.ts

In `packages/web/src/workspace/commandCapabilities.ts`, add:

```ts
{
  id: 'modify.create-terrace-from-floor',
  label: 'Create Terrace from Floor',
  owner: 'cmdPalette/defaultCommands',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['cmd-k'],
  executionSurface: 'dialog',
  preconditions: ['selected-floor'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§2.9.1: auto-creates a perimeter railing along the selected floor boundary.',
},
```

### E — Tests

Create `packages/web/src/plan/terraceFromFloor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTerraceRailing } from './terraceFromFloor';

describe('terraceFromFloor — §2.9.1', () => {
  const floor: any = {
    id: 'f1', kind: 'floor', levelId: 'L1',
    boundaryMm: [{ xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }, { xMm: 5000, yMm: 4000 }, { xMm: 0, yMm: 4000 }],
    thicknessMm: 200,
  };

  it('returns null for floor with no boundary', () => {
    expect(buildTerraceRailing({ ...floor, boundaryMm: [] }, 1100)).toBeNull();
  });

  it('returns null for floor with fewer than 3 boundary points', () => {
    expect(buildTerraceRailing({ ...floor, boundaryMm: [{ xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }] }, 1100)).toBeNull();
  });

  it('returns a railing element for a valid floor', () => {
    const railing = buildTerraceRailing(floor, 1100);
    expect(railing).not.toBeNull();
    expect(railing?.kind).toBe('railing');
    expect(railing?.heightMm).toBe(1100);
    expect(railing?.levelId).toBe('L1');
  });

  it('railing path closes the boundary (first point repeated)', () => {
    const railing = buildTerraceRailing(floor, 1100);
    const path = railing?.pathMm ?? [];
    expect(path.length).toBe(floor.boundaryMm.length + 1);
    expect(path[path.length - 1]).toEqual(path[0]);
  });

  it('uses specified railing height', () => {
    const railing = buildTerraceRailing(floor, 900);
    expect(railing?.heightMm).toBe(900);
  });
});
```

Create `packages/web/src/workspace/TerracePresetDialog.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TerracePresetDialog } from './TerracePresetDialog';

afterEach(() => { cleanup(); });

describe('TerracePresetDialog — §2.9.1', () => {
  it('renders dialog', () => {
    render(<TerracePresetDialog floorId="f1" onApply={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('terrace-preset-dialog')).toBeTruthy();
  });

  it('calls onApply with railing height', () => {
    const onApply = vi.fn();
    render(<TerracePresetDialog floorId="f1" onApply={onApply} onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('terrace-railing-height-input'), { target: { value: '900' } });
    fireEvent.click(screen.getByTestId('terrace-preset-apply'));
    expect(onApply).toHaveBeenCalledWith(900);
  });

  it('calls onClose on cancel', () => {
    const onClose = vi.fn();
    render(<TerracePresetDialog floorId="f1" onApply={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('terrace-preset-cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave21/D): terrace preset — create-terrace-from-floor palette command + perimeter railing builder (§2.9.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
