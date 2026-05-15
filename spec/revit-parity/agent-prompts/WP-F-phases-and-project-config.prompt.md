# WP-F — Phases, Project Configuration & Templates

## Context

You are an orchestrating engineer on the bim-ai repository (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

Repo layout (critical paths):
- `packages/web/src/viewport/phaseFilter.ts` — existing phase filter logic (start here)
- `packages/web/src/plan/PhaseDropdown.tsx` — existing phase selector in plan header
- `packages/web/src/plan/PlanViewHeader.tsx` — plan header (add view range, phase graphic buttons)
- `packages/web/src/plan/planProjection.ts` — plan rendering (wire phase graphic overrides here)
- `packages/web/src/viewport/renderStyles.ts` — 3D render styles (wire phase colours here)
- `packages/web/src/workspace/Workspace.tsx` — top-level workspace (add project info dialog trigger)
- `packages/web/src/workspace/project/` — check what project settings UI exists
- `packages/web/src/osm/project.ts` — georef / project settings
- `packages/web/src/onboarding/` — project setup onboarding steps (add units step)
- `packages/core/src/` — shared types

Architecture patterns:
- Project-level settings (like units, project info) live as special model elements or in a project settings object. Study how `osm/project.ts` stores georef data to understand the pattern.
- Phase filter: `phaseFilter.ts` defines `PhaseFilter` type. Elements have `phaseId?: string`. The filter controls what renders.
- Semantic commands: `{ type: 'createPhase', name }`, `{ type: 'setElementPhase', elementId, phaseId }`, etc.
- Prettier runs automatically. Tests: `pnpm test --filter @bim-ai/web`.

## Safe Parallel Work Rules

1. `git pull --rebase origin main` before starting each sub-task.
2. Commit + push after every completed sub-feature.
3. `git pull --rebase origin main && git push origin main` after each push.
4. Do NOT touch: stair/ramp files, annotation tools, export pipeline, structural/massing, groups, view/sheet rendering systems. Those belong to other WPs.
5. `toolRegistry.ts` is NOT modified by this WP.

## Your Mission

Implement full phase management, project information dialog, project units, and project template selection. These cover tracker Chapters 2.8, 1.5, parts of 1.6, and the "Verwalten" register from Chapter 1.

---

### Sub-task F1: Full Phase Management Dialog

Currently phases can filter what renders, but phases cannot be created, deleted, or renamed by the user. Implement a complete phase management system.

Data model additions:
- `phase` model element: `{ id, name, sequenceNumber, description }`
- Default project phases: `[{ id: 'existing', name: 'Bestand', sequenceNumber: 1 }, { id: 'demo', name: 'Abriss', sequenceNumber: 2 }, { id: 'new', name: 'Neubau', sequenceNumber: 3 }]`
- Each element already has `phaseId?: string` — elements without a phaseId are treated as `'new'`.

New semantic commands:
- `{ type: 'createPhase', name, sequenceNumber }` — adds a new phase
- `{ type: 'deletePhase', phaseId }` — removes a phase; elements of that phase are re-assigned to the adjacent phase
- `{ type: 'renamePhase', phaseId, name }` — renames
- `{ type: 'reorderPhase', phaseId, newSequenceNumber }` — change sequence
- `{ type: 'setElementPhase', elementId, phaseId }` — assign element to phase

UI — "Manage Phases" dialog (`packages/web/src/phases/PhaseManagerDialog.tsx`):
- Opened from: workspace settings menu or "Verwalten → Phasen" equivalent.
- Shows a table of phases with columns: Sequence, Name, Description.
- Rows can be added, deleted, renamed, reordered via drag-and-drop.
- Warning when deleting a phase that has elements: "N elements will be moved to [previous phase]".

Phase assignment in inspector:
- When any element is selected, the inspector shows a "Phase" dropdown (all available phases).
- Changing it dispatches `setElementPhase`.

Phase assignment in plan view:
- The existing `PhaseDropdown.tsx` controls which phase is "active" (new elements placed go into this phase).
- The active phase is shown in the plan header.

### Sub-task F2: Phase Graphic Overrides

Revit shows elements from different phases in different graphic styles in the same view:
- **Existing** (Bestand): shown in grey halftone lines, no fill
- **Demolished** (Abriss): shown as dashed, with a cross-hatch fill in demolition views
- **New Construction** (Neubau): shown in normal black lines with material fills

This is controlled by the active "phase filter" on the view (e.g. "New Construction" view shows Bestand elements as grey, Abriss elements as dashed, Neubau as normal).

Implementation:

Per-view phase filter settings (add to `plan_view` element):
```ts
phaseFilterMode: 'new_construction' | 'demolition' | 'existing' | 'all'
phaseGraphicOverrides: {
  existing: { lineStyle: 'solid' | 'dashed', opacity: number, fillColor: string | null },
  demo: { lineStyle: 'solid' | 'dashed', opacity: number, fillColor: string | null, showCrossHatch: boolean },
  new: { lineStyle: 'solid', opacity: 1, fillColor: null },
}
```

Plan projection: pass `phaseGraphicOverrides` to `planProjection.ts`. When rendering a wall/floor, look up its phase override and apply the corresponding line style and opacity.

3D viewport: pass phase overrides to the material system. Existing elements get a grey material override; demolished elements get a semi-transparent dashed material (use a custom `proceduralMaterials.ts` variant).

Preset phase filter modes:
- "New Construction": Bestand=grey/thin, Abriss=not shown, Neubau=normal
- "Demolition Plan": Bestand=grey, Abriss=dashed+crosshatch, Neubau=not shown
- "As Built": all phases shown in their normal graphic
- "Existing": only Bestand shown in normal graphic

UI: add "Phase Filter" dropdown to `PlanViewHeader.tsx` (next to the existing phase selector). Each view can have its own phase filter mode.

Tests:
- `phaseFilter.graphicOverrides.test.ts`: apply "Demolition Plan" filter, verify a demo-phase wall gets dashed line style
- `planProjection.phaseFilter.test.ts`: verify existing-phase walls render with reduced opacity

### Sub-task F3: Project Information Dialog

Revit's Projektinformationen dialog stores metadata: project number, project name, project address, project status, client name, author, check date, issue date.

This data feeds title blocks on sheets.

Data model — project settings object (extend what `osm/project.ts` already stores):
```ts
projectInfo: {
  projectNumber: string,
  projectName: string,
  projectAddress: string,
  projectStatus: string,
  clientName: string,
  authorName: string,
  issueDate: string,       // ISO date
  checkDate: string,       // ISO date
  description: string,
}
```

Semantic command: `{ type: 'updateProjectInfo', patch: Partial<ProjectInfo> }`

UI — `packages/web/src/workspace/project/ProjectInfoDialog.tsx`:
- Opened from workspace settings or a "Project Info…" menu item.
- Form with all fields above (text inputs + date pickers for dates).
- Save button dispatches `updateProjectInfo`.

Sheet title block integration:
- The sheet canvas's title block area (bottom right of each sheet) renders project info fields.
- Specifically: project name, project number, client, author, issue date, sheet number, sheet name, revision info.
- Update `workspace/sheets/SheetCanvas.tsx` to read from the project info store and render these fields.
- If a field is empty, show a greyed-out placeholder text.

Tests:
- `projectInfoDialog.test.tsx`: fill in project name + number, verify the store updates
- `sheetTitleBlock.test.tsx`: verify project name appears in the sheet footer area

### Sub-task F4: Project Units Dialog

Currently bim-ai uses a default unit system. Implement user-configurable units.

Data model — `projectUnits` in project settings:
```ts
projectUnits: {
  lengthUnit: 'mm' | 'm' | 'cm' | 'ft' | 'in' | 'ft-in',
  areaUnit: 'm2' | 'ft2',
  volumeUnit: 'm3' | 'ft3',
  angleUnit: 'degrees' | 'radians',
  decimalSymbol: '.' | ',',
  numberGrouping: 'space' | 'comma' | 'none',
}
```

UI — `packages/web/src/workspace/project/ProjectUnitsDialog.tsx`:
- Dropdown for each unit category.
- Live preview showing how a sample value (e.g. 3500mm) would display in the selected format.
- On Save: dispatches `{ type: 'updateProjectUnits', units: ProjectUnits }`.

Apply units everywhere:
- All dimension text values: reformat from internal mm storage to the display unit.
- Property inspector numeric values: display in project units.
- Temp dimension tooltips: display in project units.
- Create `packages/web/src/lib/formatUnit.ts`: a pure function `formatLength(valueInMm: number, units: ProjectUnits): string` — use this everywhere. Tests required.

Tests:
- `formatUnit.test.ts`: 3500mm → "3500 mm" (metric), "3.500 m" (meters), "11'-5 13/16\"" (ft-in)
- `projectUnitsDialog.test.tsx`: switch to feet, verify inspector shows ft values

### Sub-task F5: Project Templates at Project Creation

When creating a new project, Revit asks for a template: None / BIM Architektur und Ingenieurbau (vereinfacht) / BIM Architektur und Ingenieurbau / BIM Gebäudetechnik.

Templates pre-populate the project with:
- Level structure (EG, OG1, OG2, Dach for residential)
- View structure (plan views per level, 3D view, 4 elevation views)
- Phase structure (Bestand, Abriss, Neubau)
- Wall type catalog entries
- Default dimension styles

Implement:
- `packages/web/src/onboarding/projectTemplates.ts`: define template definitions as static data objects.
- Template: `'minimal'` (1 level, basic views), `'residential'` (4 levels, full view set, 3 phases), `'commercial'` (multi-level, MEP-ready).
- Project creation dialog: add a template picker (step 1 of the new project wizard).
- On project creation with a template: dispatch a batch of `createLevel`, `createView`, `createPhase`, `createWallType` commands from the template definition.

Tests:
- `projectTemplates.test.ts`: apply "residential" template, verify 4 levels + plan views + phases are created

### Sub-task F6: Project Position / True North

Complete the project position workflow from the tracker (partially done in OSM):

- Revit's "Project Position" lets you set the angle between "Project North" (the drawing's up direction) and "True North" (geographic north).
- This offset is stored as `projectNorthAngleDeg` in project settings.
- When printing/exporting, views can be set to "True North" or "Project North" orientation.
- In plan view header: a "True North" toggle that rotates the view by `projectNorthAngleDeg`.
- Update `sunStore.ts` to use `projectNorthAngleDeg` when computing sun position (already wired for geographic bearing — make sure project north offset is applied).
- UI: in project settings, a numeric input "True North angle" (degrees clockwise from project north).

### Sub-task F7: Visibility / Graphics Override Dialog (V/G)

Revit's "Visibility/Graphics Overrides" (keyboard shortcut VV or VG) is the primary per-view override system.

Create a simplified version:

UI — `packages/web/src/workspace/visibilityGraphicsDialog/VisibilityGraphicsDialog.tsx`:
- Shortcut `VV` opens it from any plan/section view.
- Shows a table of model categories (Walls, Doors, Windows, Floors, Roofs, Stairs, Columns, Grids, Reference Planes, Rooms, etc.).
- Each row: category name, checkbox (Visible), Line Colour button, Line Weight dropdown, Fill Pattern dropdown, Halftone checkbox.
- Overrides stored in the view element: `visibilityOverrides: { [category: string]: { visible: boolean, lineColor: string, lineWeight: number, fillPattern: string | null, halftone: boolean } }`.

Plan projection: thread `visibilityOverrides` through `planProjection.ts`. For each element, look up its category override and apply to the Canvas 2D drawing calls.

Start with just: Visible toggle (most important), Line Colour, Halftone. Pattern and weight overrides are bonus.

Tests:
- `visibilityGraphicsDialog.test.tsx`: hide the "Grids" category, verify grid elements are not rendered
- `planProjection.visibilityOverrides.test.ts`: apply halftone override to walls, verify opacity

---

## Definition of Done

For each sub-task:
- TypeScript compiles without errors
- ≥2 unit tests per new module
- Feature is accessible from the workspace UI
- No regressions in existing phase/plan projection tests
- Tracker entry updated in `spec/revit-parity/revit2026-parity-tracker.md`
