# Wave 25 — WP-C: Project Browser "By Level" View Organization Preset (§1.6.11)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.11 "Projektbrowser" is Partial. The project browser (ProjectBrowserV3) shows plan views grouped by discipline. Revit's browser supports multiple organization presets — most importantly "By Level" which groups plan views by their associated level rather than by discipline.

This task adds a **"By Level" view organization preset** to the plan views section of the project browser — a small `<select>` dropdown that toggles between "By Discipline" (current default) and "By Level" grouping.

---

## Repo orientation

```
packages/web/src/workspace/project/ProjectBrowser.tsx   — ProjectBrowserV3 component, find where plan views are grouped
packages/web/src/workspace/project/projectBrowserCameraViews.test.tsx — existing test pattern
```

Run before editing:
- `grep -n "viewOrgPreset\|By Discipline\|By Level\|discipline\|levelId" packages/web/src/workspace/project/ProjectBrowser.tsx | head -20`
- `grep -n "plan_view\|planViews\|groupBy\|discipline" packages/web/src/workspace/project/ProjectBrowser.tsx | head -20`
- `grep -n "PbCollapsibleSection\|browser-floor-plans\|Floor Plans\|Grundrisse" packages/web/src/workspace/project/ProjectBrowser.tsx | head -10`

Read the floor plans section rendering in ProjectBrowserV3 carefully — find how plan views are currently grouped (by discipline) and where to inject the org preset dropdown + conditional re-grouping.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Understand current plan view grouping

Read `ProjectBrowserV3` and find:
1. Where plan views are filtered from `elements` (search for `plan_view`)
2. How they're currently grouped by discipline
3. The level name resolution (how levelId maps to a level name)

### B — Add viewOrgPreset state and dropdown

In the floor plans section of `ProjectBrowserV3`, find where plan views are listed. Near the section header, add:

1. State variable:
```tsx
const [viewOrgPreset, setViewOrgPreset] = React.useState<'discipline' | 'level'>('discipline');
```

2. Dropdown in the section header (alongside the chevron toggle and section title):
```tsx
<select
  data-testid="browser-view-org-preset"
  value={viewOrgPreset}
  onChange={(e) => setViewOrgPreset(e.target.value as 'discipline' | 'level')}
  className="text-xs border border-border/30 rounded px-1 ml-auto"
  onClick={(e) => e.stopPropagation()}
>
  <option value="discipline">By Discipline</option>
  <option value="level">By Level</option>
</select>
```

### C — Implement "By Level" grouping

When `viewOrgPreset === 'level'`, instead of grouping plan views by discipline, group them by `levelId`:

```tsx
// Compute level-grouped plan views when preset is 'level'
const levelGroupedViews = React.useMemo(() => {
  if (viewOrgPreset !== 'level') return null;
  const planViews = elements.filter((el): el is Extract<Element, { kind: 'plan_view' }> =>
    el.kind === 'plan_view',
  );
  const byLevel: Record<string, typeof planViews> = {};
  for (const pv of planViews) {
    const levelId = (pv as any).levelId ?? 'unassigned';
    if (!byLevel[levelId]) byLevel[levelId] = [];
    byLevel[levelId].push(pv);
  }
  return byLevel;
}, [elements, viewOrgPreset]);
```

Then resolve level names:
```tsx
// Helper to get level name from levelId
const getLevelName = (levelId: string): string => {
  if (levelId === 'unassigned') return 'Unassigned';
  const lvl = elements.find((el) => el.id === levelId && el.kind === 'level');
  return lvl ? (lvl as any).name ?? levelId : levelId;
};
```

Render when `viewOrgPreset === 'level'`:
```tsx
{viewOrgPreset === 'level' && levelGroupedViews
  ? Object.entries(levelGroupedViews)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([levelId, views]) => (
        <div key={levelId} data-testid={`browser-level-group-${levelId}`}>
          <div className="px-4 py-0.5 text-xs font-semibold text-muted">
            {getLevelName(levelId)}
          </div>
          {views.map((pv) => (
            <div
              key={pv.id}
              data-testid={`browser-view-row-${pv.id}`}
              className="px-6 py-0.5 text-xs cursor-pointer hover:bg-muted/30"
              onClick={() => onActivateView(pv.id)}
            >
              {(pv as any).name ?? pv.id}
            </div>
          ))}
        </div>
      ))
  : /* existing discipline-grouped rendering */}
```

**Important**: Read the actual component code carefully before editing. The prop names, className patterns, and how views are currently rendered may differ. Adapt to what's in the file.

### D — commandCapabilities.ts entry

Add to `packages/web/src/workspace/commandCapabilities.ts`:

```ts
{
  id: 'view.browser-org-preset',
  label: 'Browser View Organization',
  owner: 'workspace/ProjectBrowser',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan', '3d'],
  surfaces: ['project-browser'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.11: toggles plan view grouping in project browser between By Discipline and By Level.',
},
```

### E — Tests

Create `packages/web/src/workspace/project/projectBrowserOrgPreset.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => { cleanup(); });

function makeProps(elements: any[] = []) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: () => {},
    onRenameView: () => {},
    onDeleteView: () => {},
    onDuplicateView: () => {},
  };
}

const level1 = { kind: 'level', id: 'l1', name: 'Ground Floor', elevationMm: 0 };
const level2 = { kind: 'level', id: 'l2', name: 'First Floor', elevationMm: 3000 };
const pv1 = { kind: 'plan_view', id: 'pv1', name: 'Ground Floor Plan', levelId: 'l1', viewType: 'floor_plan', disciplineKey: 'architectural' };
const pv2 = { kind: 'plan_view', id: 'pv2', name: 'First Floor Plan', levelId: 'l2', viewType: 'floor_plan', disciplineKey: 'architectural' };

describe('ProjectBrowser org preset — §1.6.11', () => {
  it('renders the view org preset select', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    expect(getByTestId('browser-view-org-preset')).toBeTruthy();
  });

  it('defaults to discipline grouping', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    const select = getByTestId('browser-view-org-preset') as HTMLSelectElement;
    expect(select.value).toBe('discipline');
  });

  it('switching to "level" changes the select value', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2, level1, level2])} />);
    const select = getByTestId('browser-view-org-preset');
    fireEvent.change(select, { target: { value: 'level' } });
    expect((select as HTMLSelectElement).value).toBe('level');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave25/C): project browser 'By Level' org preset — viewOrgPreset dropdown + level-grouped plan view rendering (§1.6.11)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 3 tests.
