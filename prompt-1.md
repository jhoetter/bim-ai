# Prompt 1 — View Template Tag Style Catalog Slice

Workspace: `/Users/jhoetter/repos/bim-ai`

You are the future implementation agent for a focused Revit production parity slice. Implement code, tests, documentation tracker updates, and git operations exactly as described here.

## Operating Rules

- Work on a dedicated branch from the current `main`. Suggested branch name: `prompt-1-view-template-tag-style-catalog`.
- Commit your completed changes and push the branch to the remote.
- Do not create a PR.
- Before editing, inspect `git status`, the relevant diffs, and the files listed below. Preserve unrelated user or agent changes.
- Keep the implementation focused on the tag-style/catalog slice. Do not perform broad workspace rewrites, UI redesigns, or unrelated refactors.
- Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation. You must update both `## Current Workpackages` and `## Recent Sprint Ledger`.
- Keep imports at the top of files. Do not introduce inline imports.
- For TypeScript unions/enums touched by this work, keep switch handling exhaustive.

## Target Workpackages

Primary workpackages:

- `WP-C01` First-class plan views
- `WP-C02` Plan projection engine
- `WP-C03` Plan symbology and graphics
- `WP-C05` Project browser hierarchy

Light touch:

- `WP-X01` JSON snapshot and command replay

Current tracker context to preserve:

- `WP-C01` is already `partial`, `3 evidenced slice`, about `62%`, with persisted plan/view-template graphics and annotation toggles.
- `WP-C02` is already `partial`, `3 evidenced slice`, about `73%`, with `planGraphicHints`, `planAnnotationHints`, and `planTagLabel` support.
- `WP-C03` is already `partial`, `2 usable slice`, about `56%`, with web symbology overlays and deterministic graphics/readout plumbing.
- `WP-C05` is already `partial`, `2-3 usable/evidenced slice`, about `54%`, with Project Browser grouping and view/template evidence lines.
- `WP-X01` is already `partial`, `3 evidenced slice`, about `74%`, with replay evidence for several persisted command paths.

Do not mark these workpackages `done`. This slice should make incremental progress and leave rows `partial` unless the codebase has independently reached full parity acceptance.

## Problem To Solve

The previous view-template graphics work added persisted plan detail/fill/annotation controls, projection hints, web symbology, Project Browser readouts, and Inspector authoring. It missed the tag-style/catalog dimension.

Implement a replayable tag style catalog for plan views and view templates so tags are not just on/off labels. The system should let a model persist named tag style definitions, assign them to plan views or view templates, resolve effective styles deterministically, reflect the result in server plan projection hints/labels, expose the same result in web readouts, and cover the behavior with focused backend and frontend tests.

You may choose the exact data model after inspecting current patterns. Acceptable designs include:

- A first-class `plan_tag_style` / tag-style catalog element, referenced by `plan_view` and `view_template`.
- A `planTagStyle`-style catalog embedded in an existing catalog/template mechanism, if that better matches current architecture.

Whichever design you choose must be replayable, persisted in snapshots, editable through existing command/update paths, and deterministic in server and web readouts.

## Suggested Files

Inspect and update only the files needed from this list and any tightly related test/helper files you discover:

- `app/bim_ai/elements.py`
- `app/bim_ai/commands.py`
- `app/bim_ai/engine.py`
- `app/bim_ai/plan_projection_wire.py`
- `app/tests/test_update_element_property_plan_view.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`
- `packages/core/src/index.ts`
- `packages/web/src/state/store.ts`
- `packages/web/src/workspace/savedViewTagGraphicsAuthoring.tsx`
- `packages/web/src/workspace/PlanViewGraphicsMatrix.tsx`
- `packages/web/src/workspace/ProjectBrowser.tsx`
- `packages/web/src/plan/planProjection.ts`
- `packages/web/src/plan/symbology.ts`

## Functional Requirements

### 1. Persisted Tag Style Catalog

Add a minimal but real tag-style catalog that can express production-plan label behavior. The shape should be small and deterministic. Include enough fields to make the slice visible and testable, for example:

- `id`
- `name`
- applicable tag target/category, such as `opening`, `room`, or a limited union that matches existing plan tag behavior
- label format or ordered label fields, such as type mark, element id, room name, room area, or opening width/height
- visual style knobs, such as text size, leader visibility, shape/badge style, or color token
- optional sort/order metadata for deterministic catalogs

Keep the first implementation narrow. It does not need a full Revit annotation family system.

### 2. Replayable Authoring

Make the catalog and assignments editable and replayable.

At minimum, support one deterministic path for each:

- Creating or upserting a tag style definition.
- Updating a tag style definition through the existing command/update machinery.
- Assigning a tag style to a `plan_view`.
- Assigning a default tag style to a `view_template`.
- Clearing a `plan_view` override so the view falls back to its template default.

Prefer extending existing commands and `updateElementProperty` behavior over inventing a parallel mutation surface, unless the current command architecture clearly points to a dedicated upsert command.

Snapshot and replay must preserve catalog definitions and view/template assignments without lossy normalization.

### 3. Effective Resolution

Implement a single deterministic resolver for effective tag style, with precedence matching the existing graphics/annotation pattern:

1. `plan_view` explicit override.
2. assigned `view_template` default.
3. stable built-in fallback.

Handle missing catalog references deterministically. Prefer a structured warning/readout and fallback over silent failure. Keep behavior stable across backend and frontend.

### 4. Server Plan Projection Wire

Reflect effective tag style in server plan projection output.

Extend the existing `planAnnotationHints` / `planTagLabel` path or adjacent projection hint shape so the server output can show:

- which tag style id/name was resolved,
- whether the value came from the plan view, template, or fallback,
- enough label-format information to explain why a tag label appears the way it does,
- deterministic warnings for missing or incompatible styles.

The projection should still only emit tag labels when the existing plan annotation toggles permit it. This slice is about tag style/catalog resolution, not making every tag always visible.

### 5. Web Readouts And Authoring

Surface the effective tag style in deterministic web UI/readouts.

Minimum expected web surface:

- `SavedViewTagGraphicsAuthoring` (or the existing relevant authoring component) can display and edit plan view/template tag style fields.
- `PlanViewGraphicsMatrix` shows stored vs template vs effective tag style details in a stable text format.
- `ProjectBrowser` shows a compact evidence line or subtitle for plan views/templates that makes the tag style catalog state inspectable.
- `packages/web/src/plan/planProjection.ts` and `packages/web/src/plan/symbology.ts` parse and apply the new projection hints/readouts consistently.

Do not redesign the workspace. Add small controls/readouts consistent with the current Inspector/Project Browser style.

### 6. Tests

Add focused backend and frontend tests.

Backend coverage should include:

- Tag style catalog definition persists through command application and snapshot/replay.
- `updateElementProperty` or the chosen command path can assign, update, and clear plan view/template tag styles.
- Effective resolver precedence: plan view override, template default, fallback.
- `resolve_plan_projection_wire` emits deterministic tag style hints/labels.
- Missing style references produce deterministic fallback/warning evidence.

Frontend coverage should include:

- Core TypeScript types accept the new element/hint shape.
- Store/update logic persists assignments without dropping existing plan view/template graphics fields.
- `PlanViewGraphicsMatrix` or `planProjection` readouts show effective tag style source and label details deterministically.
- Symbology uses the parsed hint data without breaking existing annotation overlays.

Prefer extending existing focused tests:

- `app/tests/test_update_element_property_plan_view.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`
- Existing Vitest files near `planProjection`, `symbology`, `ProjectBrowser`, `PlanViewGraphicsMatrix`, or saved-view tag graphics authoring.

## Acceptance Criteria

The implementation is acceptable when:

- A model can persist at least one named plan tag style catalog definition.
- A plan view can reference a tag style override.
- A view template can provide a default tag style.
- Clearing the plan view override falls back to the template default; missing template/default falls back to a stable built-in style.
- Command replay and JSON snapshots preserve catalog definitions, assignments, clears, and updates.
- Server plan projection includes deterministic effective tag style hints and labels for enabled room/opening tags.
- Web readouts expose stored/template/effective tag style state without relying on screenshots or non-deterministic DOM order.
- Project Browser and/or the graphics matrix make the catalog assignment visible enough for an implementation reviewer to inspect.
- Focused backend pytest and web Vitest coverage pass.
- `spec/revit-production-parity-workpackage-tracker.md` records the work in both `Current Workpackages` and `Recent Sprint Ledger`.
- The branch is committed and pushed.
- No PR is created.

## Non-Goals

Do not implement:

- sheet export/raster work,
- schedules,
- room derivation,
- OpenBIM/IFC changes,
- geometry kernels,
- broad `Workspace.tsx` rewrites,
- full annotation family editing,
- drag placement for tags,
- PDF/SVG export styling changes unless a tiny deterministic readout hook is already part of existing plan projection evidence.

## Conflict-Avoidance Rules

- Start from a clean understanding of current `main`; do not assume this prompt reflects every recent commit.
- If files have unrelated modifications, do not revert them. Work around them or ask for direction if they block the slice.
- Keep changes local to the tag-style/catalog behavior and the tracker.
- Do not rename public fields that existing tests or fixtures use unless you migrate all direct uses in the same focused change.
- Preserve existing `planGraphicHints`, `planAnnotationHints`, `planTagLabel`, `planDetailLevel`, `planRoomFillOpacityScale`, `planShowOpeningTags`, and `planShowRoomLabels` behavior.
- If adding new union values in TypeScript or Python literal-like structures, update all exhaustive handling and tests.
- Prefer additive fields and explicit resolver helpers over scattered conditional logic.
- Keep deterministic ordering for catalog rows, projection hint arrays, evidence strings, and test assertions.

## Suggested Validation Commands

Run focused validation first:

```bash
cd /Users/jhoetter/repos/bim-ai
python -m ruff check app/bim_ai app/tests/test_update_element_property_plan_view.py app/tests/test_plan_projection_and_evidence_slices.py
python -m pytest app/tests/test_update_element_property_plan_view.py app/tests/test_plan_projection_and_evidence_slices.py
pnpm vitest run packages/web/src/plan packages/web/src/workspace packages/web/src/state packages/core/src
```

Then run broader validation if practical:

```bash
pnpm verify
```

If a broad command is too slow or fails due to a known unrelated issue, document the exact focused commands that passed and the blocker for the broader command in your final response.

## Tracker Update Guidance

In `spec/revit-production-parity-workpackage-tracker.md`:

- Update `WP-C01` to mention persisted plan tag style/catalog assignment on `plan_view` and `view_template`.
- Update `WP-C02` to mention effective tag style resolution in `plan_projection_wire` hints/labels.
- Update `WP-C03` to mention symbology/readout support for tag style hints.
- Update `WP-C05` to mention Project Browser or matrix evidence lines for tag style catalog state.
- Update `WP-X01` lightly to mention replay/snapshot coverage for tag style catalog definitions and assignments.
- Add a `Recent Sprint Ledger` row named something like `Prompt-1 view template tag style catalog` with concise scope, tests, and tracker effect.

Keep the tracker concise and consistent with the existing long-table style. Do not overstate maturity or claim full parity.
