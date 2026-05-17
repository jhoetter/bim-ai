# Wave 15 — WP-D: Schedule Sort / Filter / Group-By (all tables) (§13.3 polish)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/schedules/scheduleSortFilter.ts        — sortRows + filterRows helpers (ALREADY EXIST)
packages/web/src/schedules/ScheduleTable.tsx            — sortKey/sortDir/onSort props (partially wired)
packages/web/src/schedules/SchedulePanel.tsx            — main schedule panel (door/window/column sort wired)
packages/web/src/schedules/ScheduleView.tsx             — wrapper shell
packages/web/src/schedules/scheduleDefinitionPresets.ts — preset definitions
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `scheduleSortFilter.ts`: `sortRows<T>(rows, key, dir)` and `filterRows<T>(rows, filter)` — these work correctly. Do NOT rewrite them.
2. `ScheduleTable.tsx`: accepts `sortKey?: string`, `sortDir?: 'asc' | 'desc'`, `onSort?: (key: string) => void`. Clicking a header calls `onSort(key)`. Sort indicators `↑`/`↓` already shown.
3. `SchedulePanel.tsx`: already wires sort for door, window, and column tables. Other tables (room, beam, stair, furniture, steel_connections) likely do not have sort/filter wired. Check each one.

---

## Tasks

### A — Complete sort wiring in SchedulePanel.tsx

For every `<ScheduleTable>` or equivalent table component that does NOT yet have sort wired:
1. Add `const [xSort, setXSort] = useState<{key:string; dir:'asc'|'desc'} | null>(null)` for each table type.
2. Pass `sortKey={xSort?.key}`, `sortDir={xSort?.dir}`, and `onSort={(key) => setXSort(s => s?.key === key && s.dir === 'asc' ? {key, dir:'desc'} : {key, dir:'asc'})}` to each `<ScheduleTable>`.
3. Apply `sortRows(rows, xSort.key, xSort.dir)` before rendering.

Cover: rooms, beams, stairs, furniture, steel connections — all schedule tables that are missing sort.

---

### B — Filter text input

At the top of each schedule section (or a single shared one at the top of the panel), add a filter input:

```tsx
<input
  type="search"
  placeholder="Filter…"
  data-testid="schedule-filter-input"
  value={filterText}
  onChange={(e) => setFilterText(e.currentTarget.value)}
  style={{ fontSize: 11, padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: 3, width: '100%', marginBottom: 4 }}
/>
```

Apply `filterRows(rows, filterText)` before sort. A single `filterText` state can span all tables (filtering whichever is currently visible), or per-table — use whichever is simpler.

---

### C — Group-By field

Add a "Group by" dropdown to the schedule toolbar (near the sort). It should show the available field keys for the current preset (read them from `scheduleDefinitionPresets.ts`).

When a `groupByKey` is set:
1. Group the rows by unique values of `row[groupByKey]`.
2. Render each group with a subheading `<tr>` spanning all columns showing the group value and row count.
3. Within each group, apply normal sort/filter.

```tsx
// Example structure:
// | --- Group: "Ebene 1" (5 rows) --- |
// | door rows ...                      |
// | --- Group: "Ebene 2" (3 rows) --- |
// | door rows ...                      |
```

The subheading `<tr>` should have `data-testid="schedule-group-header-{value}"`.

A "Clear Group" option (empty `<option>`) resets groupByKey to null.

---

### D — "Clear Sort" button

Add a small `× Clear` button (shown only when sort is active) next to the sort indicator in the schedule toolbar:
```tsx
{sortKey && (
  <button data-testid="schedule-clear-sort" onClick={() => setSort(null)} style={...}>× Clear</button>
)}
```

---

### E — Tests

`packages/web/src/schedules/scheduleFilterGroup.test.ts`:
```ts
import { sortRows, filterRows } from './scheduleSortFilter';

describe('schedule sort/filter/group — §13.3', () => {
  it('sortRows sorts strings ascending', () => { ... });
  it('sortRows sorts numbers descending', () => { ... });
  it('filterRows returns only matching rows', () => { ... });
  it('filterRows returns all rows for empty filter', () => { ... });
  it('grouping rows by key produces correct group structure', () => {
    const rows = [{ name: 'Door 1', level: 'L1' }, { name: 'Door 2', level: 'L2' }, { name: 'Door 3', level: 'L1' }];
    // Group by 'level': L1 group has 2 rows, L2 has 1.
    const groups = groupByKey(rows, 'level');
    expect(groups['L1']).toHaveLength(2);
    expect(groups['L2']).toHaveLength(1);
  });
});
```

Also add a `groupByKey<T>(rows: T[], key: keyof T): Record<string, T[]>` pure helper to `scheduleSortFilter.ts` (export it) and test it.

`packages/web/src/schedules/SchedulePanel.filterInput.test.tsx`:
```ts
describe('SchedulePanel filter input', () => {
  it('renders schedule-filter-input', () => { ... });
  it('filtering hides non-matching rows', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/D): schedule sort/filter/group-by for all tables (§13.3)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new schedule tests.
