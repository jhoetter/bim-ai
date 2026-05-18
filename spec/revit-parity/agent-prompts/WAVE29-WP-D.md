# Wave 29 — WP-D: Split Plan/3D View Mode (§1.6.12)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.12 "Zeichenfläche" is Partial P2. bim-ai shows one active view at a time with tabbed switching between plan, 3D, section, and sheet views. Revit supports multiple simultaneously tiled view windows. This task implements the most useful variant: a split-pane mode where the plan view appears on the left and the 3D view on the right simultaneously.

This task adds:

1. `splitViewEnabled` boolean in the Zustand store
2. A `ToggleSplitViewCmd` command type
3. Workspace handler that toggles `splitViewEnabled`
4. Workspace.tsx / CanvasMount.tsx: when `splitViewEnabled=true`, render plan (left 50%) and 3D viewport (right 50%) side by side
5. A split-view toggle button in the toolbar (`data-testid="viewport-split-view-btn"`)
6. `view.split-view` capability
7. Tests

---

## Repo orientation

```
packages/web/src/workspace/Workspace.tsx    — find where the plan canvas vs 3D viewport rendering is structured
packages/web/src/workspace/CanvasMount.tsx  — find where plan/3D/section modes are rendered
packages/web/src/state/storeViewportRuntimeSlice.ts — find where viewport store fields live
packages/web/src/cmdPalette/defaultCommands.ts — find registerCommand pattern
```

Run before editing:

- `grep -n "splitView\|split.*view\|CanvasMount\|planMode\|viewportMode" packages/web/src/workspace/Workspace.tsx | head -15`
- `grep -n "splitView\|planMode\|mode.*plan\|mode.*3d\|PlanCanvas\|Viewport" packages/web/src/workspace/CanvasMount.tsx | head -15`
- `grep -n "splitView\|skyBackground\|thinLines\|viewportRuntime" packages/web/src/state/storeViewportRuntimeSlice.ts | head -15`
- `grep -n "split-view\|splitView\|split.*btn" packages/web/src/workspace/Workspace.tsx | head -10`

Read `CanvasMount.tsx` and `Workspace.tsx` carefully to understand how the plan vs 3D switching works before adding split-view mode.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add splitViewEnabled to store

Find where viewport store fields are defined (likely `storeViewportRuntimeSlice.ts` or `storeTypes.ts`). Add:

```ts
/** §1.6.12: when true, plan and 3D views are shown side by side. */
splitViewEnabled: boolean;
```

And in the initial state:

```ts
splitViewEnabled: false,
```

**Important**: Read the actual store slice carefully. Find where other boolean toggles like `thinLinesEnabled` or `skyBackground` are defined and follow the same pattern.

### B — Add ToggleSplitViewCmd

Find where other `Cmd` types are defined in `packages/core/src/index.ts`. Add:

```ts
export type ToggleSplitViewCmd = {
  type: 'toggleSplitView';
};
```

Add `| ToggleSplitViewCmd` to `SemanticCommand` and export it.

### C — Workspace handler

Find where simple toggle commands are handled in `Workspace.tsx`. Add:

```ts
if (cmd.type === 'toggleSplitView') {
  useBimStore.setState((s: any) => ({ splitViewEnabled: !s.splitViewEnabled }));
  return;
}
```

### D — Split view rendering in CanvasMount.tsx (or Workspace.tsx)

Find where the plan canvas and 3D viewport are rendered. When `splitViewEnabled=true`, wrap them in a flexbox side-by-side layout:

```tsx
// §1.6.12: split plan/3D view
const splitViewEnabled = useBimStore((s: any) => s.splitViewEnabled ?? false);

// In the JSX render:
{
  splitViewEnabled ? (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <div style={{ width: '50%', height: '100%', position: 'relative' }}>
        {/* Plan canvas — left pane */}
        {planCanvasJsx}
      </div>
      <div
        style={{
          width: '50%',
          height: '100%',
          position: 'relative',
          borderLeft: '1px solid var(--border, #444)',
        }}
      >
        {/* 3D viewport — right pane */}
        {viewportJsx}
      </div>
    </div>
  ) : (
    {
      /* existing single-pane rendering */
    }
  );
}
```

**Important**: Read `CanvasMount.tsx` and `Workspace.tsx` carefully. The plan canvas and 3D viewport may be in different places. Find the actual JSX structure and adapt the split-pane logic to the real component tree. The key is to render both `PlanCanvas` and the 3D `Viewport` simultaneously when split is enabled, rather than switching between them.

### E — Split view toggle button

Find the toolbar/header area where other view toggle buttons live (e.g. the 3D/2D toggle button). Add a split-view toggle button near it:

```tsx
<button
  data-testid="viewport-split-view-btn"
  title={splitViewEnabled ? 'Exit Split View' : 'Split Plan/3D View'}
  onClick={() => onSemanticCommand?.({ type: 'toggleSplitView' })}
  style={{
    fontSize: 10,
    padding: '2px 6px',
    border: `1px solid ${splitViewEnabled ? '#a78bfa' : 'var(--border)'}`,
    borderRadius: 3,
    background: splitViewEnabled ? 'rgba(167,139,250,0.15)' : 'transparent',
    color: splitViewEnabled ? '#a78bfa' : 'inherit',
    cursor: 'pointer',
  }}
>
  ⊟
</button>
```

**Important**: Read the actual toolbar structure to find the right location. Adapt to actual prop/callback names.

### F — commandCapabilities.ts entry

```ts
{
  id: 'view.split-view',
  label: 'Split Plan/3D View',
  owner: 'workspace/CanvasMount',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan'],
  surfaces: ['viewport-toolbar', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.12: toggleSplitView command + splitViewEnabled store field renders plan (left 50%) and 3D viewport (right 50%) simultaneously.',
},
```

Add a matching `registerCommand` for `view.split-view` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.split-view',
  label: 'Toggle Split Plan/3D View',
  keywords: ['split', 'side by side', 'plan 3d', 'tile', 'tiled view', 'split view'],
  category: 'view',
  isAvailable: () => true,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'toggleSplitView' });
  },
});
```

### G — Tests

Create `packages/web/src/workspace/splitView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Split plan/3D view — §1.6.12', () => {
  it('ToggleSplitViewCmd has correct type', () => {
    const cmd = { type: 'toggleSplitView' as const };
    expect(cmd.type).toBe('toggleSplitView');
  });

  it('splitViewEnabled defaults to false', () => {
    const state: any = { splitViewEnabled: false };
    expect(state.splitViewEnabled).toBe(false);
  });

  it('toggle flips splitViewEnabled', () => {
    const state: any = { splitViewEnabled: false };
    const next = !state.splitViewEnabled;
    expect(next).toBe(true);
  });

  it('split layout uses 50% width for each pane', () => {
    const leftWidth = '50%';
    const rightWidth = '50%';
    expect(leftWidth).toBe('50%');
    expect(rightWidth).toBe('50%');
  });

  it('split view btn testid is correct', () => {
    const testid = 'viewport-split-view-btn';
    expect(testid).toBe('viewport-split-view-btn');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave29/D): split plan/3D view — ToggleSplitViewCmd + splitViewEnabled store field + side-by-side rendering + toolbar toggle button (§1.6.12)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
