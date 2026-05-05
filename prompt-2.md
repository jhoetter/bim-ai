# Site Authoring UI V0 Slice

## Mission

You are a future implementation agent working in `/Users/jhoetter/repos/bim-ai`.

Create and work on a dedicated branch based on the current `main`, for example:

```sh
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b prompt-2-site-authoring-ui-v0
```

Deliver a bounded UI authoring slice for the existing `site` / `upsertSite` semantics. The goal is to make the already-supported site context command path authorable from the web workspace, with clear evidence in the UI and tests, without expanding into full terrain modeling.

Commit and push the branch when complete. Never create a pull request.

## Target workpackages

- `WP-B01` / `WP-E03`: site/topography context and browser-facing evidence for the existing semantic model.
- `WP-C05`: command-driven authoring UX that preserves replayable kernel semantics.
- `WP-X01`: focused evidence, validation, and tracker hygiene for the slice.

## Ownership boundaries

- Keep the implementation centered on web authoring for existing `upsertSite` payloads.
- Likely files include `packages/web/src/Workspace.tsx`, a focused site authoring component near the existing web component patterns, and `packages/core/src/index.ts` only if the frontend type surface is missing an already-supported command shape.
- Touch `app/tests/test_site_context.py` only if UI work reveals that command payload assumptions or site evidence contracts need backend regression coverage.
- Keep imports at the top of files; do not add inline imports.
- Preserve the canonical command-driven model: the UI should emit existing commands rather than inventing a parallel site state.

## Non-goals

- Do not implement full grading, contours, topo triangulation, cut/fill, roads, property-line legal workflows, vegetation libraries, or survey import.
- Do not alter unrelated plan, sheet, IFC, schedule, room, roof, stair, or collaboration behavior.
- Do not introduce a new backend command if the existing `upsertSite` semantics can support the slice.
- Do not create a pull request.

## Implementation checklist

- Inspect the current `site` / `upsertSite` implementation and existing web command authoring patterns before editing.
- Add a small Site Authoring UI V0 surface in the workspace that can author or update the current model's site element.
- Support the existing useful fields only, such as `id`, `name`, `boundaryMm`, `referenceLevelId`, `padThicknessMm`, `baseOffsetMm`, `northDegCwFromPlanX`, `uniformSetbackMm`, and deterministic `contextObjects` if already supported by the command contract.
- Keep the UI intentionally simple: deterministic defaults, clear labels, and no promise of contour/grading behavior.
- Route submit/apply through the same command application path as other authoring controls so replay, undo, API, and validation stay aligned.
- Add focused web tests around payload construction, validation/copy, and any helper logic. Prefer testing the new component directly if practical.
- Update backend tests only if the command payload shape or site evidence assumptions change.

## Validation

Run focused validation before committing:

- Web tests for the new UI/component and any touched helpers.
- Web typecheck for `packages/web`.
- Focused backend site tests if command payload assumptions change, especially `cd app && .venv/bin/pytest tests/test_site_context.py`.
- If `packages/core/src/index.ts` changes, run the relevant core typecheck/test command as well.

Record the exact commands and outcomes in the tracker ledger entry.

## Tracker update requirements

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation branch.

- Update the Current Workpackages rows for `WP-B01` / `WP-E03`, `WP-C05`, and `WP-X01` to reflect the Site Authoring UI V0 slice.
- Add a `Recent Sprint Ledger` entry named for this branch or slice, for example `Prompt-2 site authoring UI V0`.
- In the ledger entry, summarize the exact UI surface, command path, tests, and remaining blockers.
- Explicitly state that the slice remains bounded to existing `upsertSite` semantics and that full grading/contours remain deferred.
- Include the validation commands and pass/fail outcomes.

## Commit/push requirements

- Commit only the implementation, tests, and tracker updates required for this slice.
- Use a concise commit message such as `Add site authoring UI v0`.
- Push the branch to origin:

```sh
git push -u origin prompt-2-site-authoring-ui-v0
```

- Do not create a pull request.
