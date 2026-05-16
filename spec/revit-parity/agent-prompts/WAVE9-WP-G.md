# Wave 9 — WP-G: Schedule Sort, Filter + CSV Export (§13.3.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/schedules/                              — all schedule infrastructure
packages/web/src/schedules/SchedulePanel.tsx             — main schedule panel component
packages/web/src/schedules/scheduleDefinitionPresets.ts  — preset definitions
packages/web/src/schedules/doorSchedule.ts               — door schedule builder (wave 8 WP-G)
packages/web/src/schedules/windowSchedule.ts             — window schedule builder (wave 8 WP-G)
packages/web/src/schedules/columnSchedule.ts             — column schedule builder (wave 8 WP-G)
packages/web/src/schedules/ScheduleTable.tsx             — generic table component (wave 8 WP-G)
packages/web/src/workspace/shells/ScheduleModeShell.tsx  — schedule mode shell
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `doorSchedule.ts`, `windowSchedule.ts`, `columnSchedule.ts` — wave 8 builders. Read their row types and return values.
- `ScheduleTable.tsx` — wave 8 generic table. Read its props interface before extending.
- `SchedulePanel.tsx` — read the full component. Understand how it currently renders rows.
- `FloorAreaReportPanel.tsx` — has an "Export CSV" button already wired. Use it as the exact pattern.

---

## Tasks

### A — Sort state in ScheduleTable

Extend `ScheduleTable` to support click-to-sort column headers:

```tsx
// Add to ScheduleTableProps
sortKey?: string;        // currently sorted column key
sortDir?: 'asc' | 'desc';
onSort?: (key: string) => void;
```

- Column header `<th>` gets `onClick={() => onSort?.(col.key)}` and a sort indicator arrow (↑ or ↓) when active
- `data-testid="schedule-col-header-{key}"` on each header
- The actual sort is managed by the parent component using `useState<{ key, dir }>`; `ScheduleTable` just shows the indicator and fires the callback

### B — Sort in ScheduleModeShell / SchedulePanel

For each schedule tab (doors, windows, columns, floor areas):
- Add `useState<{ key: string; dir: 'asc' | 'desc' } | null>` sort state
- Before rendering rows, sort by the active key
- Pass `sortKey`, `sortDir`, `onSort` to `ScheduleTable`

### C — Text filter bar

Add a search/filter input above each schedule table:
- `data-testid="schedule-filter-{tabId}"` (e.g. `schedule-filter-doors`)
- Filters rows where ANY string column contains the filter text (case-insensitive)
- Show a row count: `data-testid="schedule-row-count-{tabId}"` — `"Showing N of M rows"`

### D — CSV export

Add a "Export CSV" button (`data-testid="schedule-export-csv-{tabId}"`) to each tab:

Create `packages/web/src/schedules/scheduleCsvExport.ts`:
```ts
export function rowsToCsv<T extends object>(
  rows: T[],
  columns: { key: keyof T; label: string; format?: (v: unknown) => string }[],
): string
```

- Header row: column labels separated by commas
- Data rows: each cell value, string-escaped (wrap in quotes if contains comma or newline)
- Return the CSV string

In the button handler:
```ts
const csv = rowsToCsv(rows, columns);
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = `${tabId}-schedule.csv`; a.click();
URL.revokeObjectURL(url);
```

### E — Floor area schedule: add sort + filter + export

Apply the same sort/filter/export to the `FloorAreaReportPanel` tab:
- Sort by level name or area (m²)
- Filter by level name
- `data-testid="floor-area-export-csv"` already exists — wire the CSV logic to it

### F — Tests

Write `packages/web/src/schedules/scheduleCsvExport.test.ts`:
```ts
describe('rowsToCsv — §13.3.1', () => {
  it('produces correct header row', () => { ... });
  it('produces correct data rows', () => { ... });
  it('wraps cells containing commas in quotes', () => { ... });
  it('handles empty rows array (header only)', () => { ... });
  it('applies format function to cell value', () => { ... });
});
```

Write `packages/web/src/schedules/scheduleSort.test.ts`:
```ts
describe('schedule sort and filter — §13.3.1', () => {
  it('sorts rows ascending by string key', () => { ... });
  it('sorts rows descending', () => { ... });
  it('filter returns only rows matching the search string (case-insensitive)', () => { ... });
  it('filter on empty string returns all rows', () => { ... });
});
```

---

## Commit and push

After all tasks are done and tests pass (`pnpm test --filter @bim-ai/web`), commit:
```
git add -p
git commit -m "feat(wave9/G): schedule sort, filter + CSV export (§13.3.1)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
