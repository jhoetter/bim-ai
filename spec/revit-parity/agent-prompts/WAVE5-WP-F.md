# Wave 5 — WP-F: DWG Export + Floor Area Report Toolbar (§12.4.3 + §13.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                                    — Element union
packages/web/src/schedules/scheduleLevelDatumEvidenceReadout.ts — buildLevelAreaReport (exists)
packages/web/src/schedules/ScheduleDefinitionToolbar.tsx      — schedule toolbar (reference pattern)
packages/web/src/workspace/ModeShells.tsx                     — schedule mode shell + export button
packages/web/src/viewport/viewportCapture.ts                  — captureViewport3D (may exist)
```

Tests: co-located `*.test.ts` — run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically after every Edit/Write.
**Shared-file rule**: before editing `toolGrammar.ts`, `toolRegistry.ts`, `core/index.ts`, or
`PlanCanvas.tsx`, run `git pull --rebase origin main` first.

---

## What already exists — DO NOT rebuild

- `buildLevelAreaReport(elementsById)` in `scheduleLevelDatumEvidenceReadout.ts` — already
  implemented and tested. Returns `LevelAreaRow[]` with `levelId`, `levelName`, `grossAreaM2`, `netAreaM2`.
- DXF underlay export (E2) — already done in `dxfUnderlay.ts`; read it for the export pattern
- `ScheduleDefinitionToolbar.tsx` has an Export CSV button — use same pattern

---

## Tasks

### A — DWG export (§12.4.3)

Create `packages/web/src/viewport/dwgExport.ts`:

```ts
export function exportSceneToDwg(elementsById: Record<string, Element>): void;
```

Implementation:
- Build a minimal DXF string (same as DXF export but with `AC1015` (R2000) header to claim DWG
  compatibility — real DWG is binary-only, but for test purposes a text file with `.dwg` extension
  and correct HEADER section is sufficient)
- Actually produce a valid DXF string (reuse existing DXF helpers if any), then trigger a
  browser download with filename `export.dwg` and MIME type `application/acad`

Add "Export DWG" action to the export menu / ribbon. Add `data-testid="export-dwg-button"` to
wherever the export actions live (check `ModeShells.tsx` or the ribbon Annotate/Review tabs).

### B — Floor area report panel (§13.2)

Create `packages/web/src/schedules/FloorAreaReportPanel.tsx`:

```tsx
export function FloorAreaReportPanel({ elementsById }: { elementsById: Record<string, Element> }): JSX.Element
```

The panel:
- Calls `buildLevelAreaReport(elementsById)` to get rows
- Renders a table with columns: Level, Gross Area (m²), Net Area (m²)
- `data-testid="floor-area-report-panel"` on the container
- `data-testid="floor-area-row-{levelId}"` on each row
- Shows "No levels with floor areas" when rows is empty
- Has an "Export CSV" button (`data-testid="floor-area-export-csv"`) that downloads the table

Wire the panel into the schedule mode shell (`ModeShells.tsx`) as a tab option or sidebar section.
Show it when `activeTab === 'floor-area'` (or similar). Add a "Floor Areas" tab/button.

### C — Tests

Write `packages/web/src/viewport/dwgExport.test.ts`:
```ts
describe('DWG export — §12.4.3', () => {
  it('exportSceneToDwg produces output without throwing', () => { ... });
  it('returned string starts with "0\\nSECTION" (DXF/DWG format header)', () => { ... });
});
```

Write `packages/web/src/schedules/FloorAreaReportPanel.test.tsx`:
```ts
describe('FloorAreaReportPanel — §13.2', () => {
  it('renders floor-area-report-panel', () => { ... });
  it('shows one row per level that has floors', () => { ... });
  it('shows "No levels" message when no floors exist', () => { ... });
  it('gross area and net area are formatted to 2 decimal places', () => { ... });
  it('Export CSV button exists', () => { ... });
});
```

---

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new ones.
