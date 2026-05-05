# Prompt 6: Section Workbench Preview Slice

## Mission

You are the future implementation agent for the **Section Workbench Preview Slice** in `/Users/jhoetter/repos/bim-ai`.

Create a dedicated branch from the current `main`, for example:

```bash
git checkout main
git pull --ff-only
git checkout -b prompt-6-section-workbench-preview
```

Implement a focused browser-facing slice that replaces or enhances placeholder section UI with a useful live preview and deep links into existing section/sheet/export evidence. The goal is to make the section workbench feel connected to the model and documentation system without attempting a new cut-solid engine.

Do not create a pull request.

## Target workpackages

Update and advance these workpackages in `spec/revit-production-parity-workpackage-tracker.md`:

- `WP-E04` Section/elevation views
- `WP-E06` SVG/PNG/PDF export
- `WP-C03` Plan symbology and graphics
- `WP-C05` Project browser hierarchy

Use `spec/prd/revit-production-parity-ai-agent-prd.md` as requirements context. The most relevant PRD areas are the production documentation workspace, section/detail viewport requirements, sheet placement, section/elevation rendering, deterministic export evidence, and project browser hierarchy.

## Ownership boundaries

Stay in the preview/workbench layer unless a small contract adjustment is required to surface already-derived evidence.

Likely files include:

- `packages/web/src/workspace/SectionPlaceholderPane.tsx`
- `packages/web/src/workspace/SectionViewportSvg.tsx`, if present
- `packages/web/src/Workspace.tsx` for minimal wiring only
- Section-related Vitest tests near the touched components

Acceptable work:

- Replace a static placeholder with a live section preview using existing section primitives, sheet viewport metadata, or documented evidence strings.
- Add deep links or click targets from the section workbench to relevant section views, sheet viewports, export artifacts, or project browser entries.
- Surface existing `secDoc[...]`, callout, material hint, level span, `uGeomSpanMm`, export segment, or sheet viewport evidence when already available.
- Improve empty states so they explain what model/view/sheet state is missing and where to navigate next.
- Add lightweight UI tests for preview rendering, empty states, and deep-link behavior.

## Non-goals

Do not implement per-layer cut solids, CSG, new wall/floor/roof solid generation, or a replacement section projection engine.

Do not broaden into sheet canvas editing, titleblock editing, PDF raster infrastructure, schedule engine changes, IFC/OpenBIM replay, or general Project Browser refactors.

Do not make unrelated visual restyles. Keep styling consistent with the surrounding workspace components.

Do not create a pull request.

## Implementation checklist

1. Start from current `main` and create a dedicated branch such as `prompt-6-section-workbench-preview`.
2. Inspect the current section placeholder/workbench path and identify the smallest live-data path already available in web state.
3. If `SectionPlaceholderPane.tsx` exists, replace or enhance the placeholder with a live preview panel that can render selected/active section information.
4. If `SectionViewportSvg.tsx` exists, reuse it rather than creating a parallel renderer. Add only small props/helpers if needed for embedding in the workbench.
5. Add deep links or actions that make section preview rows navigable. Prefer existing workspace selection/view activation patterns over new routing.
6. Keep `Workspace.tsx` changes minimal: wire active section, selected section, sheet viewport, or project browser selection state into the preview only as needed.
7. Preserve existing evidence tokens and deterministic formatting. If new captions are added, make them stable and testable.
8. Add or update focused Vitest tests for the changed section UI and link behavior.
9. Update the tracker rows for `WP-E04`, `WP-E06`, `WP-C03`, and `WP-C05`.
10. Add a Recent Sprint Ledger entry summarizing the implemented slice, validation commands, and explicit limitations.

## Validation

Run focused web validation before committing:

```bash
cd packages/web && pnpm test
```

Targeted Vitest is acceptable if the full web suite is too broad for the edit, for example the section/workspace tests that cover the touched files.

Run backend section pytest only if you change section contracts, server-derived section primitives, export evidence payloads, or API behavior. If backend contracts are unchanged, do not spend time on unrelated backend validation.

Before finishing, check lint/type/test feedback for touched files and fix issues introduced by this work.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same branch and commit.

Required tracker updates:

- In **Current Workpackages**, update the rows for `WP-E04`, `WP-E06`, `WP-C03`, and `WP-C05` to mention the section workbench preview/deep-link slice.
- Keep percentages conservative. Advance only where the completed work genuinely improves evidenced or usable behavior.
- In **Recent Sprint Ledger**, add a new row for this prompt, for example `Prompt-6 section workbench preview`.
- The ledger row must include the main files changed, the validation run, and the remaining limitation that this does not implement per-layer cut solids or a new cut-solid engine.
- Preserve the existing markdown table style and dense tracker wording.

## Commit/push requirements

After implementation and validation:

1. Review the diff and ensure only intended files changed.
2. Commit the implementation and tracker update on the dedicated branch.
3. Push the branch to origin.
4. Do not create a pull request.

Suggested commit message:

```text
Add section workbench preview slice
```

Final response should include the branch name, commit SHA, pushed remote branch, validation command results, and a short note that no PR was created.
