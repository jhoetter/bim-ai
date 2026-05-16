# Wave 8 — WP-G: Element Schedule Panel — Door/Window/Column Schedules (§13.3.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                               — door, window, column element types
packages/web/src/schedules/                              — existing schedule infrastructure
packages/web/src/workspace/shells/ScheduleModeShell.tsx  — schedule view shell
packages/web/src/schedules/scheduleDefinitionPresets.ts  — existing schedule presets (read carefully)
packages/web/src/schedules/SchedulePanel.tsx             — existing schedule panel renderer
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

Read ALL of these before writing anything:

- `scheduleDefinitionPresets.ts` — read the FULL file. It already has schedule preset definitions. Find the existing door/window/column presets (if any) or understand the preset shape before adding.
- `SchedulePanel.tsx` — read the full component. Understand how rows are built from `elementsById` using a preset definition.
- `ScheduleModeShell.tsx` — read how tabs/presets are wired. Find where new tabs need to be registered.
- `FloorAreaReportPanel.tsx` — a working reference for a simple schedule panel.
- door element in `core/index.ts` — has `widthMm`, `heightMm`, `typeId`, `wallId`, etc.
- window element in `core/index.ts` — has `widthMm`, `heightMm`, `sillHeightMm`, `typeId`, etc.
- column element in `core/index.ts` — has `widthMm`, `depthMm`, `heightMm`, `levelId`, etc.

---

## Tasks

### A — Schedule preset definitions

In `scheduleDefinitionPresets.ts`, add or extend presets for:

**Door schedule** (`id: 'doors'`):
- Columns: Mark (sequential door number), Type (typeId or "Generic"), Width (widthMm in mm), Height (heightMm in mm), Level (levelId → level name), Count
- Group by typeId, sort by mark

**Window schedule** (`id: 'windows'`):
- Columns: Mark, Type (typeId), Width (widthMm), Height (heightMm), Sill Height (sillHeightMm), Level, Count
- Group by typeId

**Column schedule** (`id: 'columns'`):
- Columns: Mark, Type, Width (widthMm), Depth (depthMm), Height (heightMm), Level, Count
- Group by levelId

Each preset must conform to the existing preset interface — read `scheduleDefinitionPresets.ts` first.

### B — Schedule data builders

Create `packages/web/src/schedules/doorSchedule.ts`:
```ts
export interface DoorScheduleRow {
  mark: string;
  typeId: string;
  widthMm: number;
  heightMm: number;
  levelName: string;
  count: number;
}

export function buildDoorSchedule(
  elementsById: Record<string, Element>,
): DoorScheduleRow[]
```

- Collect all door elements from `elementsById`
- Group by typeId (or "Generic" if none)
- Assign sequential mark numbers (D1, D2, ...)
- Resolve levelName from the door's `wallId` → wall → `levelId` → level element `name`
- Return sorted rows

Create similar `windowSchedule.ts` and `columnSchedule.ts`.

### C — Wire tabs into ScheduleModeShell

In `ScheduleModeShell.tsx`, add tabs for "Doors", "Windows", "Columns":
- `data-testid="schedule-tab-doors"`, `data-testid="schedule-tab-windows"`, `data-testid="schedule-tab-columns"`
- Each tab renders its respective schedule table

### D — Schedule table component

If a generic `ScheduleTable` component doesn't already exist, create `packages/web/src/schedules/ScheduleTable.tsx`:
```tsx
interface ScheduleTableProps<T extends object> {
  rows: T[];
  columns: { key: keyof T; label: string; format?: (v: unknown) => string }[];
  'data-testid'?: string;
  emptyMessage?: string;
}
export function ScheduleTable<T extends object>({ rows, columns, ... }: ScheduleTableProps<T>): JSX.Element
```

Use a plain `<table>` with thead/tbody. Row `data-testid="schedule-row-{i}"`.

### E — Tests

Write `packages/web/src/schedules/doorSchedule.test.ts`:
```ts
describe('buildDoorSchedule — §13.3.1', () => {
  it('returns empty array when no doors', () => { ... });
  it('groups doors by typeId', () => { ... });
  it('assigns sequential mark numbers D1, D2, ...', () => { ... });
  it('counts doors correctly within each type group', () => { ... });
  it('resolves level name from wall levelId', () => { ... });
});
```

Write `packages/web/src/schedules/schedulePanel.test.tsx`:
```ts
describe('schedule panel — §13.3.1', () => {
  it('renders schedule-tab-doors', () => { ... });
  it('renders schedule-tab-windows', () => { ... });
  it('renders schedule-tab-columns', () => { ... });
  it('door tab shows widthMm and heightMm columns', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
