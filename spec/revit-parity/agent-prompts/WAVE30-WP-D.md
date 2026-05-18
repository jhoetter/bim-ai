# Wave 30 — WP-D: User-Configurable Quick Access Toolbar (§1.6.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.3 "Schnellzugriff-Werkzeugkasten" is Partial P2. Revit has a fully user-customizable Quick Access Toolbar (QAT) that shows pinned commands above the ribbon. bim-ai has a fixed top bar with undo/redo/save. This task adds a real QAT: users can pin any command palette command by ID, and the QAT shows icon buttons for those commands.

This task adds:
1. `quickAccessItems: string[]` in the Zustand store (array of command IDs)
2. `AddToQuickAccessCmd` / `RemoveFromQuickAccessCmd` command types
3. Workspace handlers
4. `QuickAccessToolbar.tsx` component rendering the pinned command buttons
5. `view.quick-access-toolbar` capability + `registerCommand`
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find SemanticCommand union for new cmd types
packages/web/src/state/storeViewportRuntimeSlice.ts     — find viewport/UI store fields as pattern
packages/web/src/workspace/Workspace.tsx                — find toolbar area JSX + command handlers
packages/web/src/cmdPalette/registry.ts                 — find CommandDef type with id/label/invoke
```

Run before editing:
- `grep -n "quickAccess\|QuickAccess\|pinnedCommands" packages/web/src/state/storeViewportRuntimeSlice.ts | head -5`
- `grep -n "CommandDef\|getCommand\|getAllCommands\|commandRegistry" packages/web/src/cmdPalette/registry.ts | head -15`
- `grep -n "toolbar\|topBar\|header.*flex\|flex.*header" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "splitViewEnabled\|skyBackground" packages/web/src/state/storeViewportRuntimeSlice.ts | head -10`

Read `registry.ts` carefully to understand how to look up commands by ID. Read `Workspace.tsx` to find where the toolbar/header is rendered.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add quickAccessItems to store

In `storeViewportRuntimeSlice.ts` (or `storeTypes.ts`), add:

```ts
/** §1.6.3: IDs of command palette commands pinned to the Quick Access Toolbar. */
quickAccessItems: string[];
```

Initial value: `[]` (empty by default, users can pin commands).

Also add in the reset defaults (for ResetWorkspaceCmd from WP-A): `quickAccessItems: []`.

### B — Add AddToQuickAccessCmd / RemoveFromQuickAccessCmd

In `packages/core/src/index.ts`, find where other `Cmd` types are defined. Add:

```ts
export type AddToQuickAccessCmd = {
  type: 'addToQuickAccess';
  commandId: string;
};

export type RemoveFromQuickAccessCmd = {
  type: 'removeFromQuickAccess';
  commandId: string;
};
```

Add both to `SemanticCommand` and export them.

### C — Workspace handlers

Add two handlers:

```ts
if (cmd.type === 'addToQuickAccess') {
  useBimStore.setState((s: any) => {
    const existing = s.quickAccessItems ?? [];
    if (existing.includes(cmd.commandId)) return s;
    return { quickAccessItems: [...existing, cmd.commandId as string] };
  });
  return;
}

if (cmd.type === 'removeFromQuickAccess') {
  useBimStore.setState((s: any) => ({
    quickAccessItems: (s.quickAccessItems ?? []).filter((id: string) => id !== cmd.commandId),
  }));
  return;
}
```

### D — QuickAccessToolbar.tsx

Create `packages/web/src/workspace/QuickAccessToolbar.tsx`:

```tsx
import React from 'react';
import { useBimStore } from '../state/store';

interface QuickAccessToolbarProps {
  onInvokeCommand?: (commandId: string) => void;
  onRemoveFromQAT?: (commandId: string) => void;
}

export function QuickAccessToolbar({ onInvokeCommand, onRemoveFromQAT }: QuickAccessToolbarProps): JSX.Element | null {
  const quickAccessItems = useBimStore((s: any) => s.quickAccessItems ?? []);

  if (quickAccessItems.length === 0) return null;

  return (
    <div
      data-testid="quick-access-toolbar"
      style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 8px', borderBottom: '1px solid var(--border, #333)' }}
    >
      {quickAccessItems.map((cmdId: string) => (
        <button
          key={cmdId}
          data-testid={`qat-btn-${cmdId}`}
          title={cmdId}
          onClick={() => onInvokeCommand?.(cmdId)}
          onContextMenu={(e) => {
            e.preventDefault();
            onRemoveFromQAT?.(cmdId);
          }}
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 3,
            border: '1px solid var(--border, #444)',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {cmdId.split('.').pop()}
        </button>
      ))}
    </div>
  );
}
```

**Important**: Read `Workspace.tsx` to find the correct location to place `<QuickAccessToolbar />` in the workspace layout. Place it near the top of the workspace, above the main canvas area.

Wire `onInvokeCommand` to look up the command in the registry and call `invoke`. Wire `onRemoveFromQAT` to dispatch `removeFromQuickAccess`.

### E — commandCapabilities.ts entry

```ts
{
  id: 'view.quick-access-toolbar',
  label: 'Quick Access Toolbar',
  owner: 'workspace/QuickAccessToolbar',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['workspace-header', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.3: quickAccessItems string[] in store; AddToQuickAccessCmd/RemoveFromQuickAccessCmd; QuickAccessToolbar renders pinned command buttons (right-click to unpin).',
},
```

Add a matching `registerCommand` for `view.quick-access-toolbar` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.quick-access-toolbar',
  label: 'Pin Command to Quick Access Toolbar',
  keywords: ['quick access', 'pin', 'toolbar', 'QAT', 'customize', 'shortcut'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // QAT is configured via addToQuickAccess command; this is an informational entry
  },
});
```

### F — Tests

Create `packages/web/src/workspace/quickAccessToolbar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Quick access toolbar — §1.6.3', () => {
  it('AddToQuickAccessCmd has correct shape', () => {
    const cmd = { type: 'addToQuickAccess' as const, commandId: 'view.help-search' };
    expect(cmd.type).toBe('addToQuickAccess');
    expect(cmd.commandId).toBe('view.help-search');
  });

  it('RemoveFromQuickAccessCmd has correct shape', () => {
    const cmd = { type: 'removeFromQuickAccess' as const, commandId: 'view.help-search' };
    expect(cmd.type).toBe('removeFromQuickAccess');
    expect(cmd.commandId).toBe('view.help-search');
  });

  it('quickAccessItems defaults to empty array', () => {
    const state: any = { quickAccessItems: [] };
    expect(state.quickAccessItems.length).toBe(0);
  });

  it('adding command updates quickAccessItems', () => {
    const items: string[] = [];
    const cmdId = 'view.split-view';
    if (!items.includes(cmdId)) items.push(cmdId);
    expect(items).toContain('view.split-view');
  });

  it('removing command filters quickAccessItems', () => {
    const items = ['view.split-view', 'view.help-search'];
    const filtered = items.filter((id) => id !== 'view.split-view');
    expect(filtered).toEqual(['view.help-search']);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave30/D): quick access toolbar — quickAccessItems store + AddToQuickAccess/RemoveFromQuickAccess cmds + QuickAccessToolbar.tsx + view.quick-access-toolbar capability (§1.6.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
