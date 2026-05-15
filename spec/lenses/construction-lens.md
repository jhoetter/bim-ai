# Construction Lens for Cloud-Native BIM Platform
## Requirements and Implementation Prompt

## Context

You are working on a cloud-native, AI-native BIM platform with shared model elements, phases, saved views, schedules, sheets, collaboration, versioning, comments, and cloud APIs.

The Construction Lens supports execution planning, site coordination, progress, temporary works, and field QA. In German product language, this lens is **Bauausfuehrung**.

## Lens Identity

- Lens ID: `construction`
- English name: Construction / Execution
- German name: Bauausfuehrung
- Alternate German labels: Ausfuehrung, Baustelle
- Primary users: contractors, site managers, construction coordinators, project managers
- Implementation status: implemented as execution metadata, schedule, viewport, command, and API layer

## Design Principle

Construction data should attach to the design model as phase, package, progress, and QA metadata. The lens should make the model useful on site without corrupting design intent or consultant property sets.

## Workpackages

1. Lens identity and overlay behavior
   - Status: `Done`
   - Add Construction / Bauausfuehrung lens identity across shared core types, workspace lens controls,
     command palette navigation, and lens-aware viewport filtering.
   - Foreground construction package, logistics, QA, and progress-bearing design elements without
     changing architectural, structural, or MEP discipline tags.

2. Phasing, sequencing, and package metadata
   - Status: `Done`
   - Attach construction metadata under element `props.construction` for package membership,
     planned/actual dates, sequence, dependencies, responsible company, evidence, issues, and punch items.
   - Add construction package elements that reference phases and expose planned/actual execution windows.
   - Preserve design intent by mutating only construction metadata and explicit phase fields.

3. Temporary works and logistics
   - Status: `Done`
   - Add logistics elements for scaffolding, cranes, laydown areas, access routes, site safety zones,
     temporary partitions, and lifts.
   - Validate phase and package references before logistics elements are created.

4. Progress, QA, schedules, views, sheets, and API payload
   - Status: `Done`
   - Support not-started, in-progress, installed, inspected, accepted, blocked, and rejected progress states.
   - Add QA checklist elements with checklist status, inspector, evidence, issues, and responsible company.
   - Provide schedule defaults for construction packages, phases, progress, punch items, logistics,
     and QA checklist reports.
   - Publish construction view and sheet defaults for 4D phase review, package coloring, progress coloring,
     site logistics, field review, punch, and logistics sheets.
   - Expose a read-only `/api/models/{model_id}/construction-lens` payload and registered
     `construction-lens-report` / `set-element-construction` tool contracts for field apps and
     contractor integrations.

## Verification

- `PYTHONPATH=app PYTEST_ADDOPTS=--no-cov python -m pytest app/tests/test_construction_lens.py app/tests/test_api_v3_registry.py app/tests/test_phase_filter_lens.py`
- `pnpm --filter @bim-ai/web exec vitest run src/viewport/useLensFilter.test.ts src/cmdPalette/defaultCommands.test.ts src/workspace/shell/LensDropdown.test.tsx`
- `pnpm --filter @bim-ai/web typecheck`

## Non-Goals

- Do not turn design elements into temporary site elements without explicit classification.
- Do not replace detailed scheduling tools; integrate with them.
- Do not hide design changes that affect execution status.

## Implementation Prompt

Implement the Construction Lens as the Bauausfuehrung workflow layer for phasing, packages, progress, logistics, and QA. It should be usable by site teams while preserving the design model and producing traceable status data for project management tools.
