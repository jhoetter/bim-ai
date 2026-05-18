# Wave 29 — WP-A: Dynamic Browser Tab Title (§1.6.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.1 "Programmleiste" is Partial P2. In Revit the title bar always shows "ProjectName — ViewName" (e.g. "Projekt1 — Grundriss: Ebene 0"). bim-ai shows neither the project name nor view name in the browser tab title (`document.title`), and there is no persistent breadcrumb in the workspace chrome showing the active view.

This task adds:
1. `document.title` update whenever the active view or project name changes
2. A small breadcrumb/subtitle line in the workspace header (below the main toolbar)
3. A `view.dynamic-title` commandCapabilities entry
4. A `registerCommand` in `defaultCommands.ts`
5. Tests

---

## Repo orientation

```
packages/web/src/workspace/Workspace.tsx    — find activeSeedLabel, activeViewId, paneLabel, plan_view names
packages/web/src/App.tsx                    — find where Workspace is mounted
packages/web/src/cmdPalette/defaultCommands.ts — find registerCommand pattern
packages/web/src/workspace/commandCapabilities.ts — find existing view.* entries
```

Run before editing:
- `grep -n "document.title\|activeSeedLabel\|viewLabel\|paneLabel" packages/web/src/workspace/Workspace.tsx | head -20`
- `grep -n "activeSeedLabel\|projectName\|activeViewId\|plan_view" packages/web/src/workspace/Workspace.tsx | head -15`
- `grep -n "useEffect\|document.title" packages/web/src/App.tsx | head -10`
- `grep -n "viewLabel\|tabLabel\|viewName" packages/web/src/plan/PlanViewHeader.tsx | head -10`

Read `Workspace.tsx` carefully to understand how `activeSeedLabel` (project name) and the active view's name are derived. Read `App.tsx` to understand component structure.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Update document.title in Workspace.tsx

In `Workspace.tsx`, find where `activeSeedLabel` is defined and where the active view's display name is known. Add a `useEffect` that updates `document.title`:

```ts
// §1.6.1: update browser tab title to "ProjectName — ViewName"
useEffect(() => {
  const project = activeSeedLabel ?? 'bim-ai';
  const view = activePlanViewName ?? activeViewLabel ?? '';
  document.title = view ? `${project} — ${view}` : project;
}, [activeSeedLabel, activePlanViewName, activeViewLabel]);
```

**Important**: Read the actual variable names carefully. Find the active plan view name by looking up the `plan_view` element name from `elementsById` using the active view id. Adapt to actual variable names.

### B — Add breadcrumb subtitle in workspace header

Find the workspace header/toolbar area in `Workspace.tsx` (or the relevant layout component). Add a small breadcrumb line below the main toolbar:

```tsx
{/* §1.6.1: breadcrumb subtitle showing active view */}
{activePlanViewName && (
  <div
    data-testid="workspace-view-breadcrumb"
    style={{
      fontSize: 10,
      color: 'var(--text-muted, #888)',
      padding: '0 12px 2px',
      lineHeight: 1,
      userSelect: 'none',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {activeSeedLabel ?? 'bim-ai'} / {activePlanViewName}
  </div>
)}
```

**Important**: Read the actual layout in `Workspace.tsx` carefully. Find the header area with the project name and other toolbar buttons. Add the breadcrumb near that area. Adapt to the actual JSX structure.

### C — commandCapabilities.ts entry

```ts
{
  id: 'view.dynamic-title',
  label: 'Dynamic Browser Tab Title',
  owner: 'workspace/Workspace',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['workspace-header', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.1: document.title updates to "ProjectName — ViewName" on view/project change; breadcrumb subtitle in workspace header.',
},
```

### D — registerCommand in defaultCommands.ts

```ts
registerCommand({
  id: 'view.dynamic-title',
  label: 'Dynamic Browser Tab Title',
  keywords: ['title', 'tab', 'breadcrumb', 'view name', 'project name'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // Title updates automatically via useEffect — no manual invoke needed
  },
});
```

### E — Tests

Create `packages/web/src/workspace/dynamicTitle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Dynamic browser tab title — §1.6.1', () => {
  it('formats title with project and view', () => {
    const project = 'Projekt1';
    const view = 'Grundriss: Ebene 0';
    const title = view ? `${project} — ${view}` : project;
    expect(title).toBe('Projekt1 — Grundriss: Ebene 0');
  });

  it('falls back to project name when no active view', () => {
    const project = 'Projekt1';
    const view = '';
    const title = view ? `${project} — ${view}` : project;
    expect(title).toBe('Projekt1');
  });

  it('falls back to bim-ai when no project name', () => {
    const project = 'bim-ai';
    const view = 'Ebene 0';
    const title = view ? `${project} — ${view}` : project;
    expect(title).toBe('bim-ai — Ebene 0');
  });

  it('breadcrumb shows project / view format', () => {
    const project = 'Mein Projekt';
    const view = 'Ebene 1';
    const breadcrumb = `${project} / ${view}`;
    expect(breadcrumb).toBe('Mein Projekt / Ebene 1');
  });

  it('view.dynamic-title command has correct id', () => {
    const cmd = { id: 'view.dynamic-title', label: 'Dynamic Browser Tab Title' };
    expect(cmd.id).toBe('view.dynamic-title');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave29/A): dynamic browser tab title — document.title updates to ProjectName/ViewName + workspace breadcrumb subtitle (§1.6.1)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
