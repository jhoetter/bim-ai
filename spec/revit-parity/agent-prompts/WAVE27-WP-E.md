# Wave 27 — WP-E: Project Browser Search/Filter + Sort (§1.6.11)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.11 "Projektbrowser" is Partial P1. The project browser has plan views, sections, elevations, 3D views, sheets, families, groups, links, schedules — all organized in collapsible sections. Wave 25 WP-C added the "By Level" view organization preset.

What's still missing is a **search/filter input** and **sort controls** — in Revit's project browser, there's a filter box at the top that narrows which views appear, and you can sort views by name.

This task adds:

1. A search input at the top of `ProjectBrowserV3` that filters all views/sheets/families/groups by name
2. A sort toggle button (A-Z / Z-A) for plan views within the "Floor Plans" section
3. Matching text highlight (bold the matched substring) in view rows
4. Tests

---

## Repo orientation

```
packages/web/src/workspace/project/ProjectBrowser.tsx  — find ProjectBrowserV3, plan view section, search/filter state
```

Run before editing:

- `grep -n "search\|filter\|sort\|browserSearch" packages/web/src/workspace/project/ProjectBrowser.tsx | head -15`
- `grep -n "PbCollapsibleSection\|browserSearch\|viewFilter\|searchTerm" packages/web/src/workspace/project/ProjectBrowser.tsx | head -10`
- `grep -n "plan_view\|Floor Plans\|Grundrisse\|planViews" packages/web/src/workspace/project/ProjectBrowser.tsx | head -10`

Read the `ProjectBrowserV3` component carefully to understand how plan views are currently listed before adding search.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add browser search input at the top of ProjectBrowserV3

In `ProjectBrowserV3`, find the outermost container. At the very top (before the collapsible sections), add:

```tsx
const [browserSearch, setBrowserSearch] = React.useState('');
const [planViewSort, setPlanViewSort] = React.useState<'az' | 'za'>('az');

// At the top of the returned JSX:
<div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border, #333)' }}>
  <input
    data-testid="browser-search-input"
    type="text"
    value={browserSearch}
    onChange={(e) => setBrowserSearch(e.target.value)}
    placeholder="Search views…"
    style={{
      width: '100%',
      fontSize: 11,
      padding: '3px 6px',
      border: '1px solid var(--border, #444)',
      borderRadius: 3,
      background: 'transparent',
      color: 'inherit',
      boxSizing: 'border-box',
    }}
  />
</div>;
```

### B — Filter plan views by search term

Find where plan views are listed in the "Floor Plans" section. Before rendering, apply the filter:

```tsx
const filteredPlanViews = React.useMemo(() => {
  const planViews = elements.filter(
    (el): el is Extract<typeof el, { kind: 'plan_view' }> => el.kind === 'plan_view',
  );
  const term = browserSearch.trim().toLowerCase();
  const filtered = term
    ? planViews.filter((pv) => ((pv as any).name ?? pv.id).toLowerCase().includes(term))
    : planViews;
  return planViewSort === 'az'
    ? [...filtered].sort((a, b) => ((a as any).name ?? a.id).localeCompare((b as any).name ?? b.id))
    : [...filtered].sort((a, b) =>
        ((b as any).name ?? b.id).localeCompare((a as any).name ?? a.id),
      );
}, [elements, browserSearch, planViewSort]);
```

Use `filteredPlanViews` instead of the unfiltered list in the "Floor Plans" / discipline-grouped rendering.

### C — Sort toggle button in the Floor Plans section header

In the "Floor Plans" section header (where the section toggle chevron is), add a sort button:

```tsx
<button
  data-testid="browser-plan-views-sort-btn"
  onClick={(e) => {
    e.stopPropagation();
    setPlanViewSort((s) => (s === 'az' ? 'za' : 'az'));
  }}
  title={planViewSort === 'az' ? 'Sort Z→A' : 'Sort A→Z'}
  style={{
    fontSize: 9,
    padding: '1px 4px',
    border: '1px solid var(--border, #444)',
    borderRadius: 2,
    background: 'transparent',
    cursor: 'pointer',
    marginLeft: 4,
    color: 'inherit',
  }}
>
  {planViewSort === 'az' ? 'A↑' : 'Z↑'}
</button>
```

**Important**: Read the actual `ProjectBrowserV3` code carefully before editing. The "Floor Plans" section header may be inside a `PbCollapsibleSection` component — add the sort button inside that component's header slot or adjacent to the section title. Adapt to the actual structure.

### D — Apply search to sections beyond plan views

Also filter sheets and schedules by `browserSearch`:

```tsx
const filteredSheets = React.useMemo(() => {
  const sheets = elements.filter((el) => el.kind === 'sheet');
  if (!browserSearch.trim()) return sheets;
  const term = browserSearch.toLowerCase();
  return sheets.filter((s) => ((s as any).name ?? s.id).toLowerCase().includes(term));
}, [elements, browserSearch]);
```

Use `filteredSheets` in the sheets section rendering (if the sheets section exists in ProjectBrowserV3).

### E — commandCapabilities.ts entry

Check if a `view.browser-search` capability exists. If not, add:

```ts
{
  id: 'view.browser-search',
  label: 'Browser Search/Filter',
  owner: 'workspace/ProjectBrowser',
  group: 'view',
  scope: 'canvas',
  intendedModes: ['plan', '3d'],
  surfaces: ['project-browser'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.11: search input at top of ProjectBrowser filters all views/sheets by name; sort toggle for plan views.',
},
```

Note: `surfaces` does NOT include `'cmd-k'` so no `registerCommand` is needed.

### F — Tests

Create `packages/web/src/workspace/project/projectBrowserSearch.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

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

const pv1 = {
  kind: 'plan_view',
  id: 'pv1',
  name: 'Ground Floor Plan',
  levelId: 'l1',
  viewType: 'floor_plan',
  disciplineKey: 'architectural',
};
const pv2 = {
  kind: 'plan_view',
  id: 'pv2',
  name: 'Roof Plan',
  levelId: 'l2',
  viewType: 'floor_plan',
  disciplineKey: 'architectural',
};

describe('ProjectBrowser search/filter — §1.6.11', () => {
  it('renders the browser search input', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    expect(getByTestId('browser-search-input')).toBeTruthy();
  });

  it('renders sort button for plan views', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    expect(getByTestId('browser-plan-views-sort-btn')).toBeTruthy();
  });

  it('typing in search input changes its value', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    const input = getByTestId('browser-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ground' } });
    expect(input.value).toBe('Ground');
  });

  it('sort button toggles label on click', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    const btn = getByTestId('browser-plan-views-sort-btn');
    const initialText = btn.textContent;
    fireEvent.click(btn);
    expect(btn.textContent).not.toBe(initialText);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave27/E): project browser search/filter + sort — browserSearch input + filteredPlanViews memo + planViewSort toggle + sheet filter (§1.6.11)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 4 tests.
