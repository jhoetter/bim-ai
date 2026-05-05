# Project Browser Hierarchy V1 Slice

## Mission

Implement a bounded Project Browser hierarchy V1 slice for BIM AI. The outcome should make the existing browser feel more like a production documentation navigator by grouping and surfacing useful readouts for:

- plans,
- sheets,
- schedules,
- sections,
- 3D views,
- sites.

This is a navigation and evidence-readout slice, not a model architecture rewrite. Preserve the existing command-driven semantic model invariant from the PRD: browser, CLI, and API mutate one canonical model; views, schedules, sheets, and browser readouts are projections of that model.

Start from current `main`, create a dedicated branch, work there, commit the finished slice, and push the branch. Suggested branch name:

```sh
prompt-7-project-browser-hierarchy-v1
```

Do not create a pull request.

## Target workpackages

Update implementation and tracker evidence for these workpackages:

- `WP-C05` Project browser hierarchy
- `WP-D03` Schedule UI
- `WP-E02` 3D clipping / cutaways
- `WP-E04` Section/elevation views
- `WP-E05` Sheet canvas and titleblock
- `WP-X01` JSON snapshot and command replay

The main ownership target is `WP-C05`. The other workpackages should receive only narrow evidence/readout updates where the Project Browser hierarchy exposes their already-existing artifacts.

## Ownership boundaries

Expected implementation area:

- `packages/web/src/workspace/ProjectBrowser.tsx`
- pure browser grouping/readout helpers and focused tests, if extracting helpers improves clarity
- `packages/web/src/plan/planProjection.ts` only if existing evidence-line helpers need small, local additions for browser subtitles/readouts
- nearby workspace tests for Project Browser grouping and navigation behavior

Use existing patterns in the web workspace. Prefer pure deterministic helpers for grouping, sorting, labels, and evidence subtitles so the behavior is easy to test without broad UI setup.

The browser hierarchy should remain a view of existing model/store data. It may organize, label, sort, and link to artifacts, but should not introduce a global Workspace/store refactor.

## Non-goals

- Do not build a global Workspace/store refactor.
- Do not redesign the whole shell, inspector, schedule panel, sheet canvas, section workbench, or 3D viewport.
- Do not add new kernel commands unless a tiny existing-command readout requires type coverage; prefer no core/kernel changes.
- Do not implement full Revit browser parity, families, groups, links, ceiling plans, legends, print/export, or real CSG sectioning.
- Do not create a pull request.
- Do not leave prompt files or temporary notes beyond normal source/test/tracker edits needed for this slice.

## Implementation checklist

- Create and switch to a dedicated branch from current `main`.
- Inspect `spec/revit-production-parity-workpackage-tracker.md` and `spec/prd/revit-production-parity-ai-agent-prd.md` for the current Project Browser, views, schedules, sheets, sections, 3D, and site context.
- In `ProjectBrowser`, organize artifacts into clear hierarchy groups for:
  - plan views,
  - sheets,
  - schedules,
  - sections/elevations,
  - saved 3D/orbit views,
  - sites.
- Preserve existing selection/deep-link behavior. Browser rows should continue to call the same select/navigation pathways currently used for plans, sheets, schedules, sections, viewpoints, and sites.
- Add concise readouts where the data already exists, for example:
  - plan level/template/category graphic/tag evidence,
  - sheet viewport/titleblock status,
  - schedule sort/group/filter/placement hints,
  - section sheet-host/navigation hints,
  - saved 3D clip/cutaway/hidden-kind hints,
  - site boundary/context/reference-level hints.
- Keep grouping deterministic and stable. Use predictable group order, row order, and empty-state copy.
- Add or update focused tests for grouping, labels/readouts, ordering, and navigation hooks.
- If helper functions are extracted, keep them pure and colocated near `ProjectBrowser` unless the repo already has a better local convention.

## Validation

Run focused validation before committing:

```sh
cd packages/web && pnpm typecheck
cd packages/web && pnpm exec vitest run src/workspace src/plan
```

If the focused Vitest path is too broad or slow for the final edit, run the narrow Project Browser/workspace tests you added or touched, plus any existing `src/plan` tests affected by evidence-line helper changes. Record the exact validation commands and results in the tracker ledger.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation.

Required tracker changes:

- Update the Current Workpackages rows for `WP-C05`, `WP-D03`, `WP-E02`, `WP-E04`, `WP-E05`, and `WP-X01` with concise evidence from this slice.
- Add a Recent Sprint Ledger entry for `Project Browser Hierarchy V1 Slice`.
- Include files touched, tests added/updated, validation commands, and explicit limitations.
- Preserve tracker table integrity.
- In particular, preserve the Recent Sprint Ledger as a 3-column markdown table. Do not add or remove columns from that table, and keep every new ledger row to exactly three cells.

The tracker update should state that scope was intentionally bounded to grouping and navigation readouts for plans, sheets, schedules, sections, 3D views, and sites, with no global Workspace/store refactor.

## Commit/push requirements

- Commit all implementation, tests, and tracker updates on the dedicated branch.
- Push the branch to the remote.
- Do not create a pull request.
- In the final response, report:
  - branch name,
  - commit hash,
  - push status,
  - validation commands and outcomes,
  - confirmation that no PR was created.
