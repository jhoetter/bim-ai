# WP-F Resume — Phases, Project Configuration & Templates

You are resuming a crashed agent session on the **bim-ai** repo
(`/Users/jhoetter/repos/bim-ai`). bim-ai is a browser-based BIM authoring
tool (React + TypeScript + Three.js, Vite, Vitest). This prompt is
self-contained.

---

## Repo orientation (WP-F relevant paths)

```
packages/web/src/viewport/phaseFilter.ts              — existing phase filter logic
packages/web/src/plan/PhaseDropdown.tsx               — phase selector in plan header
packages/web/src/plan/PlanViewHeader.tsx              — plan header (add F2 phase filter dropdown)
packages/web/src/plan/planProjection.ts               — plan rendering (wire phase overrides)
packages/web/src/viewport/renderStyles.ts             — 3D render styles (wire phase colours)
packages/web/src/workspace/project/VVDialog.tsx       — V/G overrides dialog (1400 lines, DONE)
packages/web/src/workspace/project/VVDialog.test.tsx  — V/G tests (done)
packages/web/src/workspace/project/ProjectSetupDialog.tsx — project setup (has projectInfo fields)
packages/web/src/workspace/sheets/sheetTitleblockAuthoring.tsx — title block rendering
packages/web/src/workspace/sheets/sheetTitleblockAuthoring.test.ts — title block tests
packages/web/src/osm/project.ts                       — project settings store
packages/web/src/onboarding/projectTemplates.ts       — project templates (DONE)
packages/core/src/index.ts                            — shared types
```

Architecture patterns:
- Project-level settings are stored in a dedicated settings object accessible
  via `useBimStore`. Study `osm/project.ts` to see how georef is stored — use
  the same pattern for new settings.
- Phase filter: `phaseFilter.ts` defines `PhaseFilter` type. Elements have
  `phaseId?: string`. The filter controls what renders per view.
- Semantic commands: `{ type: 'createPhase', name }`, etc.
- Tests: co-located `*.test.ts`, run with `pnpm test --filter @bim-ai/web`.
- Prettier runs automatically.

---

## What was done before the crash

| Sub-task | Status | Notes |
|---|---|---|
| F5 Project Templates | **Done** | `onboarding/projectTemplates.ts` + picker in project creation flow |
| F7 V/G Overrides Dialog | **Done** | `workspace/project/VVDialog.tsx` (~1400 lines) — full implementation with category visibility, line colour, halftone. Shortcut VV is wired. |
| F3 Project Info (partial) | **Partial** | `ProjectSetupDialog.tsx` has some `projectInfo` fields; `sheetTitleblockAuthoring.tsx` renders title block data — verify how much is done |

No committed work found for F1, F2, F4, F6.

---

## Step 0 — audit what F3 actually covers

Before writing new code:
```bash
pnpm test --filter @bim-ai/web -- sheetTitleblock
```

Read `workspace/project/ProjectSetupDialog.tsx` — search for `projectInfo`,
`clientName`, `issueDate`, `authorName`. Read `sheetTitleblockAuthoring.tsx`.
Determine: does a standalone "Project Information" dialog exist? Does the
title block pull all required fields? Then decide what gap remains for F3.

---

## What still needs to be done

### F1 — Full Phase Management Dialog (highest priority)

Currently phases filter rendering but users can't create/delete/rename them.

1. **Data model** — `phase` element type in `core/index.ts`:
   `{ kind: 'phase', id, name, sequenceNumber, description }`
   Default phases: Bestand (1), Abriss (2), Neubau (3). Elements without
   `phaseId` are treated as `'new'` (Neubau).

2. **Semantic commands**:
   - `createPhase`, `deletePhase` (re-assign elements to adjacent phase),
     `renamePhase`, `reorderPhase`, `setElementPhase`

3. **UI** — `packages/web/src/phases/PhaseManagerDialog.tsx`:
   - Table with Sequence, Name, Description columns
   - Add row, delete row (with warning if phase has elements), rename inline,
     drag-and-drop reorder
   - Accessible from workspace settings menu

4. **Inspector integration**: every selected element shows a "Phase" dropdown.
   Changing it dispatches `setElementPhase`.

5. **PhaseDropdown**: the active phase in `PhaseDropdown.tsx` controls which
   phase new elements are assigned to.

Tests: create/rename/delete phase; verify element phase changes via inspector.

### F2 — Phase Graphic Overrides

Add per-view graphic styles for each phase:

1. Add to `plan_view` element in `core/index.ts`:
```ts
phaseFilterMode: 'new_construction' | 'demolition' | 'existing' | 'all'
phaseGraphicOverrides: {
  existing: { lineStyle: 'solid' | 'dashed', opacity: number, fillColor: string | null },
  demo: { lineStyle: 'solid' | 'dashed', opacity: number, fillColor: string | null, showCrossHatch: boolean },
  new: { lineStyle: 'solid', opacity: 1, fillColor: null },
}
```

2. **Plan projection**: thread `phaseGraphicOverrides` through `planProjection.ts`.
   Look up each element's phase and apply the override (line style, opacity).

3. **3D viewport**: existing-phase elements get grey material override.
   Demolished elements get semi-transparent with dashed shader.

4. **Preset modes**: "New Construction" (Bestand=grey/thin, Abriss=hidden,
   Neubau=normal), "Demolition Plan" (Bestand=grey, Abriss=dashed+crosshatch,
   Neubau=hidden), "As Built" (all normal), "Existing" (only Bestand).

5. **UI**: "Phase Filter" dropdown in `PlanViewHeader.tsx` (next to the phase
   selector). Each view can have its own mode.

Tests: Demolition Plan filter → demo wall gets dashed; existing wall gets
reduced opacity.

### F3 — Project Information Dialog (complete any gaps)

Based on your Step 0 audit, implement what's missing:

If a standalone `ProjectInfoDialog.tsx` does not exist, create it at
`packages/web/src/workspace/project/ProjectInfoDialog.tsx` with fields:
projectNumber, projectName, projectAddress, projectStatus, clientName,
authorName, issueDate, checkDate, description.

Semantic command: `{ type: 'updateProjectInfo', patch: Partial<ProjectInfo> }`.

**Sheet title block integration**: the title block in
`sheetTitleblockAuthoring.tsx` must render: project name, project number,
client, author, issue date, sheet number/name, revision info. Empty fields
show greyed-out placeholder text.

### F4 — Project Units Dialog

Not started. Add `projectUnits` to the project settings:
```ts
projectUnits: {
  lengthUnit: 'mm' | 'm' | 'cm' | 'ft' | 'ft-in',
  areaUnit: 'm2' | 'ft2',
  volumeUnit: 'm3' | 'ft3',
  angleUnit: 'degrees' | 'radians',
  decimalSymbol: '.' | ',',
}
```

1. **`packages/web/src/lib/formatUnit.ts`** — pure function
   `formatLength(valueInMm: number, units: ProjectUnits): string`.
   Tests: 3500mm → "3500 mm" / "3.500 m" / "11'-5 13/16\"".

2. **`packages/web/src/workspace/project/ProjectUnitsDialog.tsx`** — dropdowns
   per category + live preview showing sample value in chosen format.
   Dispatches `{ type: 'updateProjectUnits', units }`.

3. **Apply everywhere**: all dimension text values, inspector numeric fields,
   and temp dimension tooltips should call `formatLength` instead of raw mm.

### F6 — Project Position / True North

Not started:
1. Add `projectNorthAngleDeg: number` to project settings (angle clockwise
   from project north to true north).
2. "True North" toggle in plan view header (`PlanViewHeader.tsx`) rotates the
   canvas by `projectNorthAngleDeg` when active.
3. Update `sunStore.ts` to apply the project north offset to sun position
   (it currently uses compass bearing — apply the offset there).
4. UI in project settings: a numeric input "True North angle (°)".

---

## Rules

- `git pull --rebase origin main` before every sub-task
- Commit + push after each completed sub-task
- Do NOT touch stair/ramp, annotation tools, export pipeline, structural,
  massing, groups, or view/sheet rendering systems
- `toolRegistry.ts` is NOT modified by this WP
- `pnpm test --filter @bim-ai/web` before each push
- Update `spec/revit-parity/revit2026-parity-tracker.md` as you complete items
