# Wave 5 — WP-C: Interior Elevation Inspector + Revision Table (§6.1.5 + §6.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                     — interior_elevation_marker + revision types
packages/web/src/workspace/inspector/InspectorContent.tsx      — element inspector panels
packages/web/src/workspace/sheets/SheetCanvas.tsx              — sheet rendering + viewport layout
packages/web/src/workspace/sheets/sheetTitleblockAuthoring.tsx — title block layout / revision area
packages/web/src/plan/planElementMeshBuilders.ts              — interior elevation plan symbol (existing)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `interior_elevation_marker` element type in `core/index.ts` — read its exact shape
- The 4-quadrant plan symbol for interior elevation markers already renders in `planElementMeshBuilders.ts`
- `ManageRevisionsDialog.tsx` exists; `revision` and `sheet_revision` element types exist — read them
- `SheetCanvas.tsx` already renders viewports on sheets

---

## Tasks

### A — Interior elevation marker inspector (§6.1.5)

In `InspectorContent.tsx`, detect `el.kind === 'interior_elevation_marker'` and render:
- `data-testid="inspector-iel-radius"` — numeric input for sweep radius (mm). Read the element's
  `radiusMm` field; on change dispatch `update_element_property` with key `radiusMm`.
- `data-testid="inspector-iel-level"` — `<select>` listing all level elements in `elementsById`.
  Current value = `el.levelId`. On change dispatch `update_element_property` with key `levelId`.
- `data-testid="inspector-iel-quadrants"` — four checkboxes (N/S/E/W) for which elevation views
  are active. Read `el.activeQuadrants?: ('N'|'S'|'E'|'W')[]`; on change dispatch
  `update_element_property` with key `activeQuadrants`.

Add `radiusMm` and `activeQuadrants` to the `interior_elevation_marker` type in `core/index.ts`
if not already present.

### B — Sheet revision table (§6.3)

In `SheetCanvas.tsx` (or `sheetTitleblockAuthoring.tsx`), render a revision table in the title
block area of each sheet. The table should:
- Query all `sheet_revision` elements whose `sheetId === sheet.id`
- Render rows with columns: **Rev** (sequence number), **Date**, **Description**, **By**
- Use `data-testid="sheet-revision-table"` on the table container
- Each row `data-testid="sheet-revision-row-{revId}"`

The table must appear only when there are revisions for the sheet. Position it in the lower-right
corner of the title block area (the same region used by the existing title block).

### C — Tests

Write `packages/web/src/workspace/inspector/interiorElevationInspector.test.tsx`:
```ts
describe('interior elevation marker inspector — §6.1.5', () => {
  it('renders radius input with current radiusMm value', () => { ... });
  it('changing radius dispatches update_element_property for radiusMm', () => { ... });
  it('level select lists all levels from elementsById', () => { ... });
  it('quadrant checkboxes reflect activeQuadrants array', () => { ... });
});
```

Write `packages/web/src/workspace/sheets/sheetRevisionTable.test.tsx`:
```ts
describe('sheet revision table — §6.3', () => {
  it('renders sheet-revision-table when revisions exist for sheet', () => { ... });
  it('does not render table when no revisions for sheet', () => { ... });
  it('renders a row for each sheet_revision element matching sheetId', () => { ... });
  it('row contains sequence, date, description, by fields', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
