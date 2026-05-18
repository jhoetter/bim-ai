# Wave 25 — WP-D: File Menu — Save As / Duplicate Project + Revert Commands (§1.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.2 "Dateimenü" is Partial. New, Open, Save, Export, Print, and Save As Template all work. What's missing:

- **Save As** — duplicate the current project with a new name
- **Revert** — discard unsaved changes and reload the last saved state

This task adds these two file operations to complete the file menu section.

---

## Repo orientation

```
packages/web/src/workspace/Workspace.tsx         — find 'file.save' or similar file commands as pattern
packages/web/src/workspace/project/ProjectMenu.tsx — find existing menu items (save, export, etc.)
packages/web/src/cmdPalette/defaultCommands.ts   — find 'file.' commands as pattern
```

Run before editing:

- `grep -n "file\.save\|file\.open\|saveProject\|revertProject\|duplicateProject\|SaveAs" packages/web/src/workspace/Workspace.tsx | head -15`
- `grep -n "save\|Save\|Speichern\|revert\|Revert" packages/web/src/workspace/project/ProjectMenu.tsx | head -20`
- `grep -n "'file\." packages/web/src/cmdPalette/defaultCommands.ts | head -20`

Read `ProjectMenu.tsx` carefully to understand the menu structure and how save/export items are rendered.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add DuplicateProjectCmd and RevertProjectCmd to packages/core/src/index.ts

Find where file-level commands are defined (search for `SaveProjectCmd` or `CreateProjectCmd`). Add:

```ts
export type DuplicateProjectCmd = {
  type: 'duplicateProject';
  /** New name for the duplicated project. */
  newName: string;
};

export type RevertProjectCmd = {
  type: 'revertProject';
};
```

Add both to `SemanticCommand` and export them.

### B — Workspace handlers in Workspace.tsx

Find where `'file.save'` or `saveProject` command is handled. Add handlers nearby:

For `duplicateProject` — clone the current project state with a new name and store it under a new ID. Adapt to the actual persistence model (probably localStorage). Pattern:

```ts
if (cmd.type === 'duplicateProject') {
  const state = useBimStore.getState();
  const newId = crypto.randomUUID();
  const clonedProject = {
    ...state,
    projectId: newId,
    projectName: cmd.newName as string,
  };
  // Persist the clone (adapt to actual persistence layer)
  try {
    const key = `bim-ai-project-${newId}`;
    localStorage.setItem(key, JSON.stringify(clonedProject));
    // Optionally notify the user
  } catch (e) {
    console.error('duplicateProject: failed to persist clone', e);
  }
  return;
}
```

For `revertProject` — reload the last saved state from storage:

```ts
if (cmd.type === 'revertProject') {
  const state = useBimStore.getState();
  const projectId = (state as any).projectId;
  if (!projectId) return;
  try {
    const saved = localStorage.getItem(`bim-ai-project-${projectId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      useBimStore.setState(parsed);
    }
  } catch (e) {
    console.error('revertProject: failed to revert', e);
  }
  return;
}
```

**Important**: Read the actual persistence model before implementing. The store structure and localStorage key format may differ. Adapt to what's actually used in `Workspace.tsx`.

### C — ProjectMenu items

In `ProjectMenu.tsx`, find the "Save" menu item. After it, add "Save As..." and "Revert" items:

```tsx
<button
  data-testid="project-menu-save-as"
  onClick={() => {
    const newName = window.prompt('Enter new project name:', currentProjectName + ' (copy)');
    if (newName) {
      onSemanticCommand?.({ type: 'duplicateProject', newName });
    }
  }}
>
  Save As…
</button>
<button
  data-testid="project-menu-revert"
  onClick={() => {
    if (window.confirm('Discard unsaved changes and revert to last saved state?')) {
      onSemanticCommand?.({ type: 'revertProject' });
    }
  }}
>
  Revert
</button>
```

Adapt to the actual prop names for `onSemanticCommand` and `currentProjectName`.

### D — Palette commands

In `defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'file.save-as',
  label: 'Save As…',
  keywords: ['save as', 'duplicate', 'copy', 'Speichern unter', 'Kopie'],
  category: 'file',
  isAvailable: () => true,
  invoke: (_ctx) => {
    const newName = window.prompt('Enter new project name:');
    if (newName) {
      useBimStore.getState().onSemanticCommand?.({ type: 'duplicateProject', newName });
    }
  },
});

registerCommand({
  id: 'file.revert',
  label: 'Revert to Saved',
  keywords: ['revert', 'undo all', 'discard', 'zurücksetzen'],
  category: 'file',
  isAvailable: () => true,
  invoke: (_ctx) => {
    if (window.confirm('Revert to last saved state?')) {
      useBimStore.getState().onSemanticCommand?.({ type: 'revertProject' });
    }
  },
});
```

Adapt `invoke` to the actual API for dispatching commands from the palette.

### E — commandCapabilities.ts entries

```ts
{
  id: 'file.save-as',
  label: 'Save As…',
  owner: 'cmdPalette/defaultCommands',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['cmd-k', 'project-menu'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.2: duplicates the current project to localStorage with a new name.',
},
{
  id: 'file.revert',
  label: 'Revert to Saved',
  owner: 'cmdPalette/defaultCommands',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['cmd-k', 'project-menu'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§1.6.2: reloads the last saved project state from localStorage.',
},
```

### F — Tests

Create `packages/web/src/workspace/project/saveAsRevert.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('duplicateProject / revertProject — §1.6.2', () => {
  it('DuplicateProjectCmd has correct shape', () => {
    const cmd = { type: 'duplicateProject' as const, newName: 'My Project Copy' };
    expect(cmd.type).toBe('duplicateProject');
    expect(cmd.newName).toBe('My Project Copy');
  });

  it('RevertProjectCmd has correct shape', () => {
    const cmd = { type: 'revertProject' as const };
    expect(cmd.type).toBe('revertProject');
  });

  it('duplicate preserves projectId as different UUID', () => {
    const originalId = 'proj-001';
    const newId = crypto.randomUUID();
    expect(newId).not.toBe(originalId);
  });

  it('clone name is user-supplied', () => {
    const cmd = { type: 'duplicateProject' as const, newName: 'House Project v2' };
    expect(cmd.newName).toContain('v2');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave25/D): file menu save-as + revert — DuplicateProjectCmd + RevertProjectCmd + Workspace handlers + ProjectMenu items + palette commands (§1.6.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
