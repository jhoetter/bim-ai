# Wave 26 — WP-B: Canvas Right-Click Context Menu (§1.7.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.7.1 "Ohne aktive Befehle" is Partial. bim-ai has a wall face radial menu (`wallFaceRadialMenu.tsx`) but no general canvas right-click context menu. Revit shows a context menu on right-click with: Zoom In, Zoom Out, Zoom to Fit, Previous Scroll/Zoom, Pan Active View, Steering Wheels, View Properties, etc.

This task adds a **canvas context menu** (right-click with nothing selected, or Escape key menu) in the plan canvas and the 3D viewport with common navigation commands.

---

## Repo orientation

```
packages/web/src/plan/PlanCanvas.tsx             — find onContextMenu handler, wallFaceRadialMenu usage
packages/web/src/workspace/contextMenuItems.ts   — existing context menu items (element right-click)
packages/web/src/viewport/Viewport.tsx           — find 3D viewport context menu handling
```

Run before editing:
- `grep -n "contextMenu\|onContextMenu\|radialMenu\|ContextMenu" packages/web/src/plan/PlanCanvas.tsx | head -15`
- `grep -n "contextMenu\|ContextMenu\|onContextMenu" packages/web/src/workspace/contextMenuItems.ts | head -10`
- `grep -n "contextMenu\|onContextMenu" packages/web/src/viewport/Viewport.tsx | head -10`
- `grep -rn "CanvasContextMenu\|canvas-context-menu" packages/web/src/ | head -5`

Read `PlanCanvas.tsx` context menu handling carefully to understand where to add the canvas-level context menu.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Create CanvasContextMenu component

Create `packages/web/src/plan/CanvasContextMenu.tsx`:

```tsx
import * as React from 'react';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onProperties?: () => void;
}

export function CanvasContextMenu({ x, y, onClose, onZoomIn, onZoomOut, onZoomFit, onProperties }: CanvasContextMenuProps) {
  React.useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); }, { once: true });
    return () => window.removeEventListener('click', handler);
  }, [onClose]);

  return (
    <div
      data-testid="canvas-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: 'var(--background, #1e1e1e)',
        border: '1px solid var(--border, #444)',
        borderRadius: 4,
        padding: '2px 0',
        minWidth: 160,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        data-testid="canvas-ctx-zoom-in"
        onClick={() => { onZoomIn(); onClose(); }}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        Zoom In
      </button>
      <button
        data-testid="canvas-ctx-zoom-out"
        onClick={() => { onZoomOut(); onClose(); }}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        Zoom Out
      </button>
      <button
        data-testid="canvas-ctx-zoom-fit"
        onClick={() => { onZoomFit(); onClose(); }}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        Zoom to Fit
      </button>
      {onProperties && (
        <>
          <div style={{ borderTop: '1px solid var(--border, #444)', margin: '2px 0' }} />
          <button
            data-testid="canvas-ctx-properties"
            onClick={() => { onProperties(); onClose(); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            View Properties
          </button>
        </>
      )}
    </div>
  );
}
```

### B — Wire into PlanCanvas.tsx

In `PlanCanvas.tsx`, find where the existing context menu / radial menu is handled. Add canvas-level right-click:

1. Add state:
```tsx
const [canvasCtxMenu, setCanvasCtxMenu] = React.useState<{ x: number; y: number } | null>(null);
```

2. In the canvas `onContextMenu` handler — if no element was clicked (no `bimPickId`), show the canvas context menu:
```tsx
// When right-clicking on empty canvas space (no element pick):
if (!pickedId) {
  e.preventDefault();
  setCanvasCtxMenu({ x: e.clientX, y: e.clientY });
}
```

3. Render the context menu:
```tsx
{canvasCtxMenu && (
  <CanvasContextMenu
    x={canvasCtxMenu.x}
    y={canvasCtxMenu.y}
    onClose={() => setCanvasCtxMenu(null)}
    onZoomIn={() => { /* call existing zoom in handler */ }}
    onZoomOut={() => { /* call existing zoom out handler */ }}
    onZoomFit={() => { /* call existing zoom to fit handler */ }}
  />
)}
```

**Important**: Read the actual PlanCanvas.tsx carefully to understand the existing context menu pattern and how zoom/pan are controlled. Adapt to the actual zoom handler names. If the canvas uses a ref-based camera or an explicit zoom function, wire those in. If there's no existing zoom API, dispatch a `zoomIn`/`zoomOut`/`zoomFit` command to the store.

### C — commandCapabilities.ts entry

```ts
{
  id: 'view.canvas-context-menu',
  label: 'Canvas Context Menu',
  owner: 'plan/CanvasContextMenu',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan', '3d'],
  surfaces: ['canvas-right-click'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.7.1: right-click context menu on empty canvas with Zoom In/Out/Fit and View Properties.',
},
```

Note: `surfaces` does NOT include `'cmd-k'` so no `registerCommand` is needed.

### D — Tests

Create `packages/web/src/plan/canvasContextMenu.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { CanvasContextMenu } from './CanvasContextMenu';

afterEach(() => { cleanup(); });

describe('CanvasContextMenu — §1.7.1', () => {
  it('renders the context menu at given position', () => {
    const { getByTestId } = render(
      <CanvasContextMenu
        x={100} y={200}
        onClose={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomFit={() => {}}
      />
    );
    expect(getByTestId('canvas-context-menu')).toBeTruthy();
  });

  it('renders zoom in, out, fit buttons', () => {
    const { getByTestId } = render(
      <CanvasContextMenu x={0} y={0} onClose={() => {}} onZoomIn={() => {}} onZoomOut={() => {}} onZoomFit={() => {}} />
    );
    expect(getByTestId('canvas-ctx-zoom-in')).toBeTruthy();
    expect(getByTestId('canvas-ctx-zoom-out')).toBeTruthy();
    expect(getByTestId('canvas-ctx-zoom-fit')).toBeTruthy();
  });

  it('clicking zoom in calls onZoomIn', () => {
    const onZoomIn = vi.fn();
    const { getByTestId } = render(
      <CanvasContextMenu x={0} y={0} onClose={() => {}} onZoomIn={onZoomIn} onZoomOut={() => {}} onZoomFit={() => {}} />
    );
    fireEvent.click(getByTestId('canvas-ctx-zoom-in'));
    expect(onZoomIn).toHaveBeenCalled();
  });

  it('renders properties button when onProperties is provided', () => {
    const { getByTestId } = render(
      <CanvasContextMenu x={0} y={0} onClose={() => {}} onZoomIn={() => {}} onZoomOut={() => {}} onZoomFit={() => {}} onProperties={() => {}} />
    );
    expect(getByTestId('canvas-ctx-properties')).toBeTruthy();
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave26/B): canvas right-click context menu — CanvasContextMenu component + PlanCanvas wiring + Zoom In/Out/Fit + View Properties (§1.7.1)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
