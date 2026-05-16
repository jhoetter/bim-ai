# Wave 3 — WP-F: Floor Area Report + Schedule Table Export (§13.2 + §13.3.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                        — Element union + ElemKind
packages/web/src/schedules/ScheduleDefinitionToolbar.tsx          — schedule toolbar
packages/web/src/schedules/scheduleDefinitionPresets.ts           — ScheduleDefinitionPreset + PRESETS
packages/web/src/schedules/scheduleUtils.ts                       — schedule data helpers
packages/web/src/schedules/scheduleLevelDatumEvidenceReadout.ts   — level area totals (§13.2)
packages/web/src/workspace/ModeShells.tsx                         — mounts SchedulePanel
packages/web/src/workspace/viewport/CanvasMount.tsx               — ErrorBoundary wrapping SchedulePanel
```

Tests: co-located `*.test.ts` / `*.test.tsx` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What wave 1 + 2 already built — DO NOT rebuild these

- `ScheduleDefinitionPreset` + `PRESETS` array in `scheduleDefinitionPresets.ts` with furniture,
  room, door, window, wall presets + `getSchedulePresets()` / `presetById()` helpers
- `scheduleUtils.ts` — data aggregation helpers (study this file for the aggregation pattern)
- `scheduleLevelDatumEvidenceReadout.ts` — level-based area totals exist; output format Partial
- `ScheduleDefinitionToolbar.tsx` — toolbar above the schedule panel
- SchedulePanel is mounted inside `CanvasMount.tsx` / `ModeShells.tsx`

---

## Tasks — §13.2 Floor Area Report

### A — Level area totals output

`scheduleLevelDatumEvidenceReadout.ts` computes gross floor areas by level. It currently produces
partial output. Complete it so it returns a structured report:

```ts
export type LevelAreaRow = {
  levelId: string;
  levelName: string;
  grossAreaM2: number;    // sum of floor element areas on this level
  netAreaM2: number;      // gross minus structural openings (columns + walls)
};

export function buildLevelAreaReport(
  elementsById: Record<string, Element>,
): LevelAreaRow[];
```

Algorithm:
1. Collect all `floor` elements grouped by `levelId`.
2. For each group, sum `floor.areaMm2` (gross) and subtract column/wall footprints on that level
   (same approximation as WP-D task C — point-in-polygon for columns, midpoint check for walls).
3. Return sorted by level elevation (ascending) or by `levelName` alphabetically.

If `floor.areaMm2` is not pre-computed, approximate from the floor boundary polygon area using
the shoelace formula (a helper may already exist — search for `polygonArea` or `shoelace`).

---

### B — Floor area schedule panel section

In the SchedulePanel (or a new `FloorAreaSchedulePanel.tsx` — follow the file structure of
`scheduleLevelDatumEvidenceReadout.ts`):

Render a simple table:

| Level | Gross Area | Net Area |
|-------|-----------|---------|
| Level 1 | 245.3 m² | 231.0 m² |
| Level 2 | 190.8 m² | 178.4 m² |
| **Total** | **436.1 m²** | **409.4 m²** |

This table should be accessible from the Schedule panel (add a "Floor Areas" preset/category or
a dedicated tab). Match the styling of the existing schedule table (study existing SchedulePanel
rendering).

---

## Tasks — §13.3.1 Schedule Table Export

### C — CSV export

In `ScheduleDefinitionToolbar.tsx` (or the SchedulePanel header area), add an **Export CSV**
button (data-testid: `"schedule-export-csv"`). When clicked:

1. Take the currently displayed schedule rows (from the active `ScheduleDefinitionPreset`).
2. Build a CSV string:
   - First row: column headers from `preset.fields.map(f => f.label)` joined by `,`
   - Subsequent rows: one row per element, field values joined by `,` (escape commas in values
     with double-quotes)
3. Trigger a browser download: `URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))` +
   a synthetic `<a>` click (study any existing download patterns in the repo).
4. Filename: `schedule-${preset.id}-${Date.now()}.csv`

---

### D — Level filter in schedule toolbar

In `ScheduleDefinitionToolbar.tsx`, add a **Level** dropdown (data-testid: `"schedule-level-filter"`):
- Options: "All Levels" (default) + one entry per level in the project
- When a level is selected, filter the schedule rows to elements where `el.levelId === selectedLevelId`
- The filter applies before aggregation and display

Study how `elementsById` / project levels are accessed in existing schedule code. The level list
can come from `elementsById` filtered to `el.kind === 'level'`.

---

## Tests

Add to `packages/web/src/schedules/levelAreaReport.test.ts` (new file):
1. Empty project → `buildLevelAreaReport()` returns `[]`
2. Two floors on different levels → two rows with correct grossAreaM2
3. Column inside floor boundary → net area < gross area
4. Rows sorted ascending by level name

Add to `packages/web/src/schedules/scheduleExport.test.ts` (new file):
5. CSV string has correct header row matching preset field labels
6. Values containing commas are double-quoted in CSV output
7. Empty schedule rows → header only (no crash)

Add to toolbar tests (wherever ScheduleDefinitionToolbar is tested):
8. "Export CSV" button is present (data-testid="schedule-export-csv")
9. Level filter dropdown shows "All Levels" + project levels
10. Selecting a level filters rows to that level's elements

---

## Tracker update

Edit `spec/revit-parity/revit2026-parity-tracker.md`:

Update §13.2 description — append:
```
`buildLevelAreaReport()` computes gross + net floor area per level (column/wall footprint
subtraction). Rendered as a table in the Schedule panel ("Floor Areas" category). 4 tests.
```
Change §13.2 status to `Done — P1`.

Update §13.3.1 description — append:
```
ScheduleDefinitionToolbar: Export CSV button (data-testid="schedule-export-csv") downloads current
schedule as CSV. Level filter dropdown (data-testid="schedule-level-filter") filters rows to one
level. 6 tests.
```
Change §13.3.1 status to `Done — P1`.

Update summary table row for Chapter 13.
