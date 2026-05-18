# Wave 31 — WP-A: Start Screen Vereinfacht Template + Recently-Used Projects (§1.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.5 "Revit starten" is Partial P2. Templates are already implemented (minimal, residential, commercial) in `packages/web/src/onboarding/projectTemplates.ts`. Still missing:
- No "BIM Architektur vereinfacht" template equivalent (simplified architectural template)
- No recently-used projects list on the start screen / project chooser

This task adds:
1. A 4th `vereinfacht` template in `projectTemplates.ts` (simplified architectural: 2 levels, EG+OG, standard phases)
2. `recentProjectIds: string[]` field in the Zustand store (append-on-open, max 10 items)
3. `OpenRecentProjectCmd` command type
4. A "Recently Used" section in `ProjectSetupDialog.tsx` (or the home/chooser screen)
5. `view.start-screen` commandCapabilities entry + `registerCommand`
6. Tests

---

## Repo orientation

```
packages/web/src/onboarding/projectTemplates.ts        — find PROJECT_TEMPLATES array, add 4th entry
packages/web/src/state/storeViewportRuntimeSlice.ts    — find store fields pattern, add recentProjectIds
packages/web/src/workspace/project/ProjectSetupDialog.tsx  — find template picker section, add recently-used
packages/core/src/index.ts                             — find SemanticCommand union, add OpenRecentProjectCmd
packages/web/src/workspace/Workspace.tsx               — find command handlers, add openRecentProject handler
```

Run before editing:
- `grep -n "PROJECT_TEMPLATES\|ProjectTemplate\|vereinfacht\|minimal\|residential\|commercial" packages/web/src/onboarding/projectTemplates.ts | head -20`
- `grep -n "recentProjectIds\|recentProjects\|quickAccessItems" packages/web/src/state/storeViewportRuntimeSlice.ts | head -10`
- `grep -n "template-option\|Templates\|PROJECT_TEMPLATES" packages/web/src/workspace/project/ProjectSetupDialog.tsx | head -15`

---

## Tasks

### A — Add vereinfacht template

In `packages/web/src/onboarding/projectTemplates.ts`, append a 4th template to `PROJECT_TEMPLATES`:

```ts
{
  id: 'vereinfacht',
  name: 'BIM Architektur vereinfacht',
  description: 'Simplified architectural template — 2 levels (EG/OG), standard phases, no MEP.',
  commands: [
    { type: 'createLevel', name: 'EG', elevationMm: 0 },
    { type: 'createLevel', name: 'OG', elevationMm: 3000 },
    { type: 'createPhase', name: 'Neubau' },
  ],
},
```

Read the file to understand the exact shape of `ProjectTemplate` and the existing entries, then append to the array.

### B — Add recentProjectIds to store

In `packages/web/src/state/storeViewportRuntimeSlice.ts`, add:

```ts
/** §1.5: IDs of recently opened projects (max 10, LRU order). */
recentProjectIds: string[];
```

Initial value: `[]`.

Also add a helper action:

```ts
addRecentProject: (id: string) => void;
```

Implementation appends `id` to the front, deduplicates, and slices to 10:

```ts
addRecentProject: (id: string) =>
  set((s: any) => ({
    recentProjectIds: [id, ...(s.recentProjectIds ?? []).filter((x: string) => x !== id)].slice(0, 10),
  })),
```

Read the file carefully to understand the exact store pattern before editing.

### C — Add OpenRecentProjectCmd in core

In `packages/core/src/index.ts`, find where other `Cmd` types are defined. Add:

```ts
export type OpenRecentProjectCmd = {
  type: 'openRecentProject';
  projectId: string;
};
```

Add `| OpenRecentProjectCmd` to `SemanticCommand` and export it.

### D — Workspace handler

In `packages/web/src/workspace/Workspace.tsx`, add:

```ts
if (cmd.type === 'openRecentProject') {
  useBimStore.setState((s: any) => ({
    recentProjectIds: [cmd.projectId as string, ...(s.recentProjectIds ?? []).filter((x: string) => x !== cmd.projectId)].slice(0, 10),
  }));
  return;
}
```

Read the workspace to find where other similar handlers live and insert it there.

### E — Recently-Used section in ProjectSetupDialog

In `packages/web/src/workspace/project/ProjectSetupDialog.tsx`, find the Templates section. Add a "Recently Opened" section that reads `recentProjectIds` from the store and renders a small list:

```tsx
{/* §1.5: recently opened projects */}
{recentProjectIds.length > 0 && (
  <div style={{ marginTop: 16 }}>
    <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#888', textTransform: 'uppercase' }}>Recently Opened</h4>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {recentProjectIds.slice(0, 5).map((id: string) => (
        <li key={id} data-testid={`recent-project-${id}`}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border, #444)', cursor: 'pointer' }}>
          {id}
        </li>
      ))}
    </ul>
  </div>
)}
```

Read the file carefully. Import `useBimStore` if not already present, and read `recentProjectIds` from the store. Adapt to the component's actual pattern (hooks, state, etc.).

### F — commandCapabilities.ts entry

In `packages/web/src/workspace/commandCapabilities.ts`, add:

```ts
{
  id: 'view.start-screen',
  label: 'Start Screen & Recent Projects',
  owner: 'workspace/project/ProjectSetupDialog',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['workspace-header', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.5: vereinfacht template added to PROJECT_TEMPLATES; recentProjectIds string[] in store (max 10 LRU); OpenRecentProjectCmd; Recently Opened list in ProjectSetupDialog.',
},
```

Add matching `registerCommand` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.start-screen',
  label: 'Start Screen / Recent Projects',
  keywords: ['start', 'recent', 'home', 'template', 'vereinfacht', 'new project'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // Start screen is shown at app launch; templates and recent projects are in ProjectSetupDialog
  },
});
```

### G — Tests

Create `packages/web/src/onboarding/startScreenRecentProjects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PROJECT_TEMPLATES } from './projectTemplates';

describe('Start screen — §1.5', () => {
  it('has at least 4 project templates', () => {
    expect(PROJECT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it('vereinfacht template exists', () => {
    const t = PROJECT_TEMPLATES.find((t) => t.id === 'vereinfacht');
    expect(t).toBeTruthy();
    expect(t?.name).toContain('vereinfacht');
  });

  it('vereinfacht template has EG and OG levels', () => {
    const t = PROJECT_TEMPLATES.find((t) => t.id === 'vereinfacht');
    const levelCmds = (t?.commands ?? []).filter((c: any) => c.type === 'createLevel');
    expect(levelCmds.some((c: any) => c.name === 'EG')).toBe(true);
    expect(levelCmds.some((c: any) => c.name === 'OG')).toBe(true);
  });

  it('recentProjectIds deduplicates on prepend', () => {
    const existing = ['p1', 'p2', 'p3'];
    const newId = 'p2';
    const result = [newId, ...existing.filter((x) => x !== newId)].slice(0, 10);
    expect(result).toEqual(['p2', 'p1', 'p3']);
    expect(result.filter((x) => x === 'p2').length).toBe(1);
  });

  it('recentProjectIds caps at 10', () => {
    const existing = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const result = existing.slice(0, 10);
    expect(result.length).toBe(10);
  });

  it('OpenRecentProjectCmd has correct shape', () => {
    const cmd = { type: 'openRecentProject' as const, projectId: 'proj-123' };
    expect(cmd.type).toBe('openRecentProject');
    expect(cmd.projectId).toBe('proj-123');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave31/A): start screen vereinfacht template + recently-used projects — 4th PROJECT_TEMPLATE + recentProjectIds store + OpenRecentProjectCmd + recently-opened list in ProjectSetupDialog (§1.5)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
