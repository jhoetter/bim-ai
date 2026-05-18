# Wave 23 — WP-D: Project Browser Groups Subtree (§1.6.11)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.11 "Projektbrowser" is Partial. The browser shows plan views, sheets, families, links, and saved views. What's still missing is a "Groups" subtree listing all model group definitions (from `groupRegistry`) with their instance counts, and a way to select all elements belonging to a group by clicking the group row.

---

## Repo orientation

```
packages/web/src/workspace/project/ProjectBrowser.tsx   — main browser component (ProjectBrowserV3 starts around line 2282)
packages/web/src/groups/groupTypes.ts                    — GroupDefinition, GroupInstance, GroupRegistry types
packages/web/src/workspace/project/projectBrowserCameraViews.test.tsx — existing tests pattern
```

Run:

- `cat packages/web/src/groups/groupTypes.ts` — read GroupDefinition/GroupInstance/GroupRegistry types
- `grep -n "groupRegistry\|Groups\|groupDef" packages/web/src/workspace/project/ProjectBrowser.tsx | head -20`
- `grep -n "ProjectBrowserV3\|export function" packages/web/src/workspace/project/ProjectBrowser.tsx | head -10`

Read the `ProjectBrowserV3` component carefully before editing. Understand how it renders sections like "Sheets", "Families", "Sections" — find the pattern used for each section (expandable rows with chevron toggle, item list, etc.).

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add Groups section to ProjectBrowserV3

In `packages/web/src/workspace/project/ProjectBrowser.tsx`, find `ProjectBrowserV3` and the section rendering the existing subtrees (Sheets, Families, Sections, Links, etc.).

Add a "Groups" section after the existing "Families" or "Links" section (read the file to find the best insertion point). The Groups section should:

1. List all `groupDefinitions` from `groupRegistry.definitions`
2. Show group name + instance count in parentheses
3. Clicking a group row calls `onSelectGroup?.(defId)` (a new optional prop or via the existing `onSemanticCommand` pattern)

The section header should use a `data-testid="browser-groups-section"` attribute.

Pattern to follow (adapt to the actual JSX pattern in the file):

```tsx
{
  /* Groups subtree */
}
<div data-testid="browser-groups-section">
  <div
    className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-muted/30 select-none"
    onClick={() => setGroupsOpen((v) => !v)}
  >
    <ChevronIcon open={groupsOpen} />
    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Groups</span>
  </div>
  {groupsOpen && (
    <div>
      {Object.entries(groupRegistry.definitions).map(([defId, def]) => {
        const instanceCount = Object.values(groupRegistry.instances).filter(
          (inst) => inst.groupDefinitionId === defId,
        ).length;
        return (
          <div
            key={defId}
            data-testid={`browser-group-row-${defId}`}
            className="flex items-center gap-2 px-4 py-0.5 cursor-pointer hover:bg-muted/30 text-sm"
            onClick={() =>
              onSemanticCommand?.({ type: 'selectGroupElements', groupDefinitionId: defId })
            }
          >
            <span>{def.name}</span>
            <span className="text-xs text-muted">({instanceCount})</span>
          </div>
        );
      })}
      {Object.keys(groupRegistry.definitions).length === 0 && (
        <div data-testid="browser-groups-empty" className="px-4 py-1 text-xs text-muted italic">
          No groups defined
        </div>
      )}
    </div>
  )}
</div>;
```

Add a `const [groupsOpen, setGroupsOpen] = useState(true);` state variable near the other section open states.

Make sure to read how `groupRegistry` is accessed in the component — it's probably already a prop or accessed via `useBimStore`.

### B — selectGroupElements command type in packages/core/src/index.ts

Find where `SemanticCommand` union is defined. Add:

```ts
export type SelectGroupElementsCmd = {
  type: 'selectGroupElements';
  groupDefinitionId: string;
};
```

Add `| SelectGroupElementsCmd` to `SemanticCommand`.
Export `SelectGroupElementsCmd` at the bottom of the file.

### C — Workspace handler in packages/web/src/workspace/Workspace.tsx

Find the section dispatching semantic commands. Add a handler for `selectGroupElements`:

```ts
if (cmd.type === 'selectGroupElements') {
  // Find the group definition and select all element IDs listed in it
  const def = useBimStore.getState().groupRegistry.definitions[cmd.groupDefinitionId];
  if (def) {
    useBimStore.setState({ selectedIds: new Set(def.elementIds) });
  }
}
```

Adapt to the actual store state shape — find how `selectedIds` is accessed and set in the store.

### D — commandCapabilities.ts entry

Find `packages/web/src/workspace/commandCapabilities.ts`. Add:

```ts
{
  id: 'view.select-group-elements',
  label: 'Select Group Elements',
  owner: 'workspace/ProjectBrowser',
  group: 'selection',
  scope: 'canvas',
  intendedModes: ['plan', '3d'],
  surfaces: ['project-browser'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.11: selects all elements in a model group from the project browser.',
},
```

### E — Tests

Create `packages/web/src/workspace/project/projectBrowserGroups.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectBrowserV3 } from './ProjectBrowser';

// Note: import the correct export name after reading the file

const mockGroupRegistry = {
  definitions: {
    gd1: {
      id: 'gd1',
      name: 'Furniture Group',
      elementIds: ['e1', 'e2'],
      originXMm: 0,
      originYMm: 0,
    },
    gd2: { id: 'gd2', name: 'Structural Frame', elementIds: ['e3'], originXMm: 0, originYMm: 0 },
  },
  instances: {
    gi1: { id: 'gi1', groupDefinitionId: 'gd1', insertionXMm: 0, insertionYMm: 0, rotationDeg: 0 },
    gi2: {
      id: 'gi2',
      groupDefinitionId: 'gd1',
      insertionXMm: 1000,
      insertionYMm: 0,
      rotationDeg: 0,
    },
    gi3: { id: 'gi3', groupDefinitionId: 'gd2', insertionXMm: 0, insertionYMm: 0, rotationDeg: 0 },
  },
};

// Adapt the component props to match the actual ProjectBrowserV3 signature by reading the file first.
// The test structure below is a pattern — adjust props to match the real component.

describe('ProjectBrowser Groups subtree — §1.6.11', () => {
  it('renders the Groups section header', () => {
    // Render with minimal props that include groupRegistry
    // Adapt to actual component API
    expect(true).toBe(true); // placeholder — replace with real render test
  });

  it('shows group name and instance count', () => {
    expect(true).toBe(true); // placeholder
  });
});
```

**Important**: Before writing tests, read the actual `ProjectBrowserV3` component signature to understand what props it accepts. The tests above are stubs — replace the placeholders with real render assertions using the actual prop names. The key testids to verify: `browser-groups-section`, `browser-group-row-gd1`, `browser-groups-empty`.

If `ProjectBrowserV3` requires many complex store dependencies, write simpler unit tests for just the utility logic instead (e.g., a function that computes instance counts per group definition).

### F — Browser organization preset (bonus, if time permits)

Add a "View by Level" option to the plan view grouping in `ProjectBrowserV3`. This is a selector that changes how plan views are grouped in the browser (by discipline vs by level). Add a small `<select>` dropdown near the floor plans section header:

```tsx
<select
  data-testid="browser-view-org-preset"
  value={viewOrgPreset}
  onChange={(e) => setViewOrgPreset(e.target.value as 'discipline' | 'level')}
  className="text-xs border border-border/30 rounded px-1"
>
  <option value="discipline">By Discipline</option>
  <option value="level">By Level</option>
</select>
```

When `viewOrgPreset === 'level'`, group plan views by `levelId` rather than by discipline. This is optional — implement if time allows after the Groups subtree is complete and tests pass.

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave23/D): project browser Groups subtree — list group definitions + instance counts + selectGroupElements command (§1.6.11)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
