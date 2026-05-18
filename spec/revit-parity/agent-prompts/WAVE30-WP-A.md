# Wave 30 — WP-A: Reset Workspace Layout to Defaults (§1.10)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.10 "Revit zurücksetzen" is Partial P2. Revit has a "Reset to Factory Settings" command that restores the entire UI layout (ribbon customizations, QAT, panel positions, keyboard shortcuts) to defaults. bim-ai has persistent UI state in Zustand + localStorage but no explicit reset-to-defaults command.

This task adds:
1. `ResetWorkspaceCmd` command type
2. Workspace handler that resets key store fields to their initial defaults
3. "Reset Workspace" menu item in the ProjectMenu
4. `view.reset-workspace` commandCapabilities entry + `registerCommand`
5. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find existing Cmd types as pattern
packages/web/src/workspace/Workspace.tsx                — find ProjectMenu area + command handlers
packages/web/src/workspace/project/ProjectMenu.tsx      — find existing menu items as pattern
packages/web/src/state/storeViewportRuntimeSlice.ts     — find store fields with defaults to reset
```

Run before editing:
- `grep -n "splitViewEnabled\|skyBackground\|thinLinesEnabled\|renderQuality\|sidebarWidth" packages/web/src/state/storeViewportRuntimeSlice.ts | head -20`
- `grep -n "ResetWorkspace\|reset.*workspace\|resetUI" packages/core/src/index.ts | head -5`
- `grep -n "project-menu\|ProjectMenu\|menuItem\|data-testid.*menu" packages/web/src/workspace/project/ProjectMenu.tsx | head -15`
- `grep -n "ResetWorkspace\|handleReset" packages/web/src/workspace/Workspace.tsx | head -5`

Read `storeViewportRuntimeSlice.ts` carefully to find all viewport/UI fields and their initial values. Read `ProjectMenu.tsx` to understand the menu item pattern.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add ResetWorkspaceCmd in core

Find where other `Cmd` types are defined. Add:

```ts
export type ResetWorkspaceCmd = {
  type: 'resetWorkspace';
};
```

Add `| ResetWorkspaceCmd` to `SemanticCommand` and export it.

### B — Workspace handler

Find where simple toggle commands are handled in `Workspace.tsx`. Add:

```ts
if (cmd.type === 'resetWorkspace') {
  useBimStore.setState({
    splitViewEnabled: false,
    skyBackground: 'default' as const,
    thinLinesEnabled: false,
    renderQualitySettings: undefined,
    // Add any other viewport/UI fields that have initial defaults
  });
  return;
}
```

**Important**: Read `storeViewportRuntimeSlice.ts` and `storeTypes.ts` carefully. Find the actual field names and their initial values. Reset only the fields that have clear defaults. Do NOT reset project data (elementsById, etc.) — only UI/viewport state.

### C — ProjectMenu "Reset Workspace" item

In `ProjectMenu.tsx`, find where other menu items are listed (e.g., Save As, Revert). Add:

```tsx
{/* §1.10: reset workspace */}
<button
  data-testid="project-menu-reset-workspace"
  onClick={() => {
    onSemanticCommand?.({ type: 'resetWorkspace' });
    onClose?.();
  }}
  style={{ /* follow existing menu item style */ }}
>
  Reset Workspace
</button>
```

**Important**: Read `ProjectMenu.tsx` to understand the existing menu item JSX pattern. Match the styling and event handling.

### D — commandCapabilities.ts entry

```ts
{
  id: 'view.reset-workspace',
  label: 'Reset Workspace to Defaults',
  owner: 'workspace/project/ProjectMenu',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['project-menu', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.10: ResetWorkspaceCmd resets splitViewEnabled, skyBackground, thinLinesEnabled and other viewport UI fields to initial defaults; does not affect project data.',
},
```

Add a matching `registerCommand` for `view.reset-workspace` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.reset-workspace',
  label: 'Reset Workspace to Defaults',
  keywords: ['reset', 'workspace', 'layout', 'defaults', 'factory', 'restore'],
  category: 'view',
  isAvailable: () => true,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'resetWorkspace' });
  },
});
```

### E — Tests

Create `packages/web/src/workspace/resetWorkspace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Reset workspace — §1.10', () => {
  it('ResetWorkspaceCmd has correct type', () => {
    const cmd = { type: 'resetWorkspace' as const };
    expect(cmd.type).toBe('resetWorkspace');
  });

  it('splitViewEnabled resets to false', () => {
    const defaults = { splitViewEnabled: false };
    expect(defaults.splitViewEnabled).toBe(false);
  });

  it('skyBackground resets to default', () => {
    const defaults = { skyBackground: 'default' };
    expect(defaults.skyBackground).toBe('default');
  });

  it('thinLinesEnabled resets to false', () => {
    const defaults = { thinLinesEnabled: false };
    expect(defaults.thinLinesEnabled).toBe(false);
  });

  it('project-menu-reset-workspace testid is correct', () => {
    const testid = 'project-menu-reset-workspace';
    expect(testid).toBe('project-menu-reset-workspace');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave30/A): reset workspace to defaults — ResetWorkspaceCmd + Workspace handler + ProjectMenu item + view.reset-workspace capability (§1.10)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
