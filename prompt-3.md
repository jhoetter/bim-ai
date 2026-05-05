# Prompt 3: Plan Category Graphics Floor Roof Outline Slice

## Mission

Implement a focused production-plan-view slice for floor and roof outline graphics in BIM AI.

Start from the current `main`, create a dedicated implementation branch such as `prompt-3-plan-category-floor-roof-outlines`, do all work there, commit the finished slice, and push that branch. Never create a pull request.

The goal is to make floor and roof elements participate in plan projection/category graphics with deterministic cut/projection outline hints that the server and web plan canvas can render and test. This should build on the existing plan category graphics work, including `planCategoryGraphics`, `planCategoryGraphicHints_v0`, effective template/view overrides, line weights, line patterns, and plan wire evidence.

Use the PRD and tracker as requirements context:

- `spec/prd/revit-production-parity-ai-agent-prd.md`
- `spec/revit-production-parity-workpackage-tracker.md`

The relevant PRD direction is documentation-grade plan projection: semantic model elements project into view primitives with category visibility, cut/projection state, line weights, patterns, view range, and deterministic evidence. This slice should improve plan readability for floors and roofs without taking over adjacent door/window, sheet, or viewport work.

## Target workpackages

Update these workpackages through the implementation and tracker entry:

- `WP-C02`: Plan projection/category graphics for semantic building categories.
- `WP-C03`: Browser plan rendering/symbology for production plan evidence.
- `WP-D05`: Floor/roof documentation and material/category graphics evidence.
- `WP-X02`: Validation/evidence coverage for production-parity plan slices.

Treat this as a small, reviewable slice across these WPs, not a broad rewrite.

## Ownership boundaries

Own the floor/roof outline path end to end:

- Server-side plan projection wire output for floor and roof plan primitives.
- Category graphics resolution for floor and roof outline categories.
- Stable evidence/readout fields that prove the floor/roof outline rules were applied.
- Web plan rendering of those primitives with existing symbology helpers.
- Focused tests for server projection/category hints and web plan/symbology behavior.
- Tracker updates documenting what shipped, what remains simplified, and validation run.

Likely files include:

- `app/bim_ai/plan_projection_wire.py`
- `app/bim_ai/plan_category_graphics.py`
- `packages/web/src/plan/PlanCanvas.tsx`
- `packages/web/src/plan/symbology.ts`
- Related plan projection/category graphics tests under `app/tests` and `packages/web/src/plan`.

Follow existing local patterns before adding new abstractions. Keep imports at the top of files; do not add inline imports. In TypeScript, use exhaustive handling for unions/enums where relevant.

## Non-goals

Do not implement, refactor, or claim ownership of:

- Door/window swing arcs, tags, hosted opening tag behavior, or tag-style catalog work.
- Sheet viewport crop projection, sheet print/raster, sheet manifest, or viewport placement work.
- Full Revit template parity or a complete visibility/graphics matrix.
- New floor or roof authoring commands unless a tiny fixture helper is already required by tests.
- 3D roof/floor geometry, IFC replay/export behavior, or material takeoff changes.
- A second drawing-only source of truth. Plan output must derive from semantic floor/roof elements and existing view/category settings.
- A pull request.

If you notice adjacent bugs in door/window tags or sheet crop projection while working, leave them alone unless they directly break this slice's tests. Record blockers or follow-ups in the tracker instead.

## Implementation checklist

1. Branch setup
   - Ensure the workspace is on `main` and up to date with the current local/remote baseline.
   - Create a dedicated branch, for example:

     ```bash
     git switch main
     git pull --ff-only
     git switch -c prompt-3-plan-category-floor-roof-outlines
     ```

2. Inspect current behavior
   - Read the current plan projection and category graphics code before editing.
   - Identify how `planCategoryGraphicHints_v0`, line weights, line patterns, digest/readout fields, and primitive rendering are already represented.
   - Find existing floor and roof semantic element shapes and test fixtures.

3. Server projection
   - Add or extend deterministic floor and roof outline primitives in `plan_projection_wire`.
   - Respect active plan view level/view range semantics where existing code supports them.
   - Distinguish category identity clearly enough for category graphics, for example `floors`, `floorOutlines`, `roofs`, or `roofOutlines`, matching existing naming conventions.
   - Include stable evidence/hints that show which effective category graphics row influenced the primitive.
   - Keep ordering deterministic.

4. Category graphics
   - Extend `plan_category_graphics` resolution only as far as needed for floor and roof outline categories.
   - Reuse existing defaults and override mechanics.
   - Preserve current behavior for walls, grids, room separations, rooms, annotations, doors, and windows.
   - Avoid broad schema churn unless the current schema already expects these categories.

5. Web rendering
   - Render floor and roof outline primitives in `PlanCanvas.tsx` using existing symbology helpers.
   - Extend `symbology.ts` only where it naturally owns line weight/pattern conversion or primitive styling.
   - Keep the visual result lightweight and documentation-oriented: deterministic outlines, category-specific weights/patterns, and no fake UI panels.
   - Ensure roof outlines do not obscure wall/room/annotation layers unexpectedly; follow existing primitive ordering conventions.

6. Tests
   - Add or extend Python tests proving plan wire output contains floor/roof outline primitives and category hints.
   - Add or extend tests for JSON roundtrip/update paths only if category rows require it.
   - Add or extend Vitest coverage under `packages/web/src/plan` for extraction/resolution/rendering/symbology of floor and roof outline primitives.
   - Prefer focused tests over broad snapshots.

7. Documentation/tracker
   - Update `spec/revit-production-parity-workpackage-tracker.md` as described below.

## Validation

Run focused validation before committing:

```bash
cd app && .venv/bin/ruff check bim_ai tests
cd app && .venv/bin/pytest tests/test_plan_projection_and_evidence_slices.py tests/test_update_element_property_plan_view.py
cd packages/web && pnpm exec vitest run src/plan
```

If test names have changed, run the nearest current equivalents for:

- plan projection wire output,
- plan category graphics/category hints,
- plan canvas or symbology rendering under `src/plan`.

If a command cannot run because dependencies or environment are missing, document the exact failure in the final handoff and in the tracker ledger entry.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same branch and commit.

Required tracker changes:

- Update the Current Workpackages rows for the affected product areas, especially production plan views and any row that currently owns residential floor/roof plan evidence.
- Mention the target WPs explicitly: `WP-C02`, `WP-C03`, `WP-D05`, and `WP-X02`.
- Add a new Recent Sprint Ledger row for this prompt, for example `Prompt-3 plan floor/roof outline graphics`.
- The ledger row must summarize:
  - the semantic categories covered,
  - the server evidence/hints added,
  - the web rendering/symbology changes,
  - the tests added or updated,
  - the validation commands and pass/fail status,
  - remaining limitations, especially any simplified view-range, roof-shape, material, or layer behavior.
- Keep the tracker concise and consistent with existing ledger style.

Do not update the PRD unless the implementation discovers a real requirement correction. The tracker is the required operational status document.

## Commit/push requirements

When implementation and validation are complete:

1. Review the diff and ensure unrelated files were not edited.
2. Commit the code and tracker updates on the dedicated branch.
3. Push the branch to the remote.
4. Do not create a pull request.

Use a concise commit message that reflects the shipped slice, for example:

```text
Add floor and roof outline plan graphics
```

Final response should include:

- branch name,
- commit hash,
- pushed remote branch,
- validation commands run and results,
- any known limitations or skipped validation.
