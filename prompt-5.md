# Prompt 5 — Section Documentation Dimensions And Material Hints Slice

You are a future implementation agent working in `/Users/jhoetter/repos/bim-ai`.

Your job is to implement one small, deterministic production documentation slice that improves section/elevation documentation and carries the same tokens through server primitives, web rendering, and export surfaces. This prompt is intentionally scoped: make a narrow, reviewable implementation, update the workpackage tracker, commit it, and push the branch. Do not open a PR.

## Required Workflow

1. Start from the latest `main`.
2. Create a dedicated branch for this work. Use a descriptive name such as `prompt-5-section-doc-dimensions-material-hints`.
3. Inspect the existing code and tests before editing. Preserve local conventions and naming patterns.
4. Implement the slice.
5. Update `spec/revit-production-parity-workpackage-tracker.md`, including both:
   - `Current Workpackages`
   - `Recent Sprint Ledger`
6. Run focused validation commands. Run broader verification only if practical.
7. Commit the changes with a clear message.
8. Push the branch.
9. Never create a PR.

## Product Goal

Add one deterministic production section documentation feature that makes BIM AI closer to a sheet-ready Revit-style documentation environment without broadening into unrelated modeling work.

Choose one coherent feature from this family:

- Dimension witness tokens for section/elevation documentation.
- Elevation, door, or window tags visible in section/elevation documentation.
- Material cut-pattern hints for cut walls/floors/openings.
- Scale-aware section annotation tokens.
- Layer/material labels for section cuts.

The chosen feature must be deterministic and evidence-friendly. Server section primitives, web section rendering, and SVG/PDF export tokens must agree on the same canonical values. The feature should be easy to test with stable token names and stable ordering.

## Target Workpackages

Update tracker status and evidence for these workpackages:

- `WP-E04` Section/elevation views.
- `WP-C03` Plan symbology and graphics.
- `WP-E05` Sheet canvas and titleblock.
- `WP-E06` SVG/PNG/PDF export.
- Light `WP-D05` Materials/layer catalogs.

Do not mark any workpackage complete unless the implementation genuinely closes the remaining scope. This slice should normally add evidence and move rows incrementally, not overclaim parity.

## Suggested Implementation Shape

Prefer a narrow server-first token model and render/export it in the browser. A good implementation could look like this:

- Add deterministic section documentation tokens in `app/bim_ai/section_projection_primitives.py`.
- Include only the minimal material/layer metadata needed for the chosen hint. If using material hints, derive labels or cut-pattern names from existing material/type/layer catalog data where available, and provide stable fallback strings only where the current model lacks production catalogs.
- Surface the same tokens in section sheet/export output. If section export tokens are emitted through sheet SVG paths, touch `app/bim_ai/sheet_preview_svg.py` only for section export token support.
- Render the tokens in `packages/web/src/workspace/SectionViewportSvg.tsx`.
- Document or normalize client token semantics in `packages/web/src/workspace/sectionViewportDoc.ts` if that file owns section viewport documentation types/helpers.
- Reuse or extend plan symbology constants in `packages/web/src/plan/symbology.ts` only if the feature needs shared annotation/material styling.
- Add or update focused tests:
  - `app/tests/test_plan_projection_and_evidence_slices.py` or a section-specific app test file for server primitives.
  - `app/tests/test_kernel_schedule_exports.py` only if sheet export listing tests already live there.
  - `packages/web/src/workspace/sectionViewportSvg.test.ts` for browser rendering tokens.

Keep the server contract explicit. Avoid hidden coupling where the web client recomputes values that the server already decided. The browser should mostly render the documented tokens it receives.

## Concrete Feature Requirements

The selected feature must satisfy all of these:

- It is visible or inspectable in section/elevation documentation, not just stored silently.
- It has stable token IDs or names suitable for tests and export evidence.
- It is deterministic across repeated runs for the same model.
- It is derived from canonical model/section primitive data, not from viewport pixels.
- It appears in server primitive output.
- It appears in web section rendering output.
- It appears in SVG/PDF-oriented export tokens or sheet preview SVG output when a section viewport is exported.
- It degrades gracefully for sparse seed/demo models without inventing broad new catalogs.

Examples of acceptable narrow slices:

- For each cut wall span in a section primitive, emit a `sectionDocMaterialHint` token with material label, cut-pattern hint, and stable anchor; render a subtle hatch/label in `SectionViewportSvg`; include a matching `data-section-doc-token` or SVG text token in sheet export.
- For each relevant section opening, emit deterministic door/window tag tokens; render tags in the browser; include matching export text tokens.
- For one section extent, emit scale-aware dimension witness tokens with start/end anchors and measured value; render a witness bracket; include matching export tokens.

Do not implement more than one of these unless the first one is already tiny and naturally shares the same data path.

## Non-Goals

Do not work on:

- Plan projection.
- Room legends.
- Schedule filters.
- OpenBIM or IFC behavior.
- Sheet raster internals.
- Hosted-opening geometry or cut-kernel geometry changes.
- Broad material catalogs or family/type authoring.
- New UI panels unrelated to section documentation.
- Large refactors, file moves, or formatting-only churn.

## Suggested Files

Start by inspecting these files and then edit only the ones needed:

- `app/bim_ai/section_projection_primitives.py`
- `app/bim_ai/sheet_preview_svg.py` only for section export tokens
- `app/tests/test_kernel_schedule_exports.py` if sheet export listing tests live there
- `app/tests/test_plan_projection_and_evidence_slices.py` or section-specific tests
- `packages/web/src/workspace/SectionViewportSvg.tsx`
- `packages/web/src/workspace/sectionViewportDoc.ts`
- `packages/web/src/workspace/sectionViewportSvg.test.ts`
- `packages/web/src/plan/symbology.ts`
- `spec/revit-production-parity-workpackage-tracker.md`

## Tracker Update Requirements

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation.

In `Current Workpackages`:

- Add concise evidence for `WP-E04` describing the new section/elevation documentation token and rendering behavior.
- Add concise evidence for `WP-C03` if shared symbology, line style, hatch, tag, or annotation styling was added.
- Add concise evidence for `WP-E05` if the token appears on sheet viewports or sheet SVG preview.
- Add concise evidence for `WP-E06` if the token is present in SVG/PDF/export-oriented output.
- Add light evidence for `WP-D05` only if material/layer names, labels, or cut-pattern hints are actually derived from catalog/type/layer metadata.

In `Recent Sprint Ledger`:

- Add a new row for this prompt, including branch or commit context if known.
- Mention the exact primitive/export/render token names introduced.
- Mention focused tests added or updated.
- Mention remaining blockers honestly, such as no true per-layer cut solids, no hosted-opening geometry change, or no full production dimension system.

## Validation Commands

Run focused commands first. Adjust exact command names to the repository scripts after inspecting `package.json`, `pyproject.toml`, or existing test instructions.

Recommended focused validation:

```bash
pytest app/tests/test_plan_projection_and_evidence_slices.py
pytest app/tests/test_kernel_schedule_exports.py
pnpm vitest packages/web/src/workspace/sectionViewportSvg.test.ts
pnpm vitest packages/web/src/workspace packages/web/src/plan
```

If the repository uses different invocations, use the nearest existing focused test command.

Run this if practical after focused tests pass:

```bash
pnpm verify
```

If a broad verification command is too slow or fails for unrelated pre-existing reasons, report that clearly in the final handoff and keep focused evidence strong.

## Acceptance Criteria

The implementation is acceptable when:

- A dedicated branch exists and is pushed.
- A commit exists on that branch.
- No PR is created.
- The chosen section documentation feature has one clearly named token family.
- Server section primitives emit the token family with deterministic ordering.
- Browser section viewport rendering consumes the token family without recomputing canonical values.
- SVG/PDF-oriented sheet/export output includes matching token evidence for section viewports.
- Focused server and web tests cover the token values and rendering/export evidence.
- `spec/revit-production-parity-workpackage-tracker.md` is updated in both required sections.
- Non-goals remain untouched except for incidental imports/types required by the chosen slice.

## Conflict-Avoidance Rules

- Before editing, check `git status` and inspect any existing changes. Do not overwrite user or teammate changes.
- If unrelated files are dirty, leave them alone.
- If a target file already has unrelated edits, work around them carefully and preserve those edits.
- Do not use destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly instructed by the user.
- Keep imports at the top of files. Do not add inline imports.
- For TypeScript unions or enums, use exhaustive switch handling where applicable.
- Keep naming stable and boring. Prefer explicit token names over clever abstractions.
- Do not introduce broad compatibility shims for unshipped branch-only code. Keep the slice direct and minimal.
- Avoid changing generated files unless the repository workflow requires it.
- Do not reformat unrelated code.

## Final Handoff Expected From The Future Agent

At the end, report:

- Branch name and pushed commit hash.
- The selected feature and token names.
- Tests run and results.
- Tracker sections updated.
- Any known limitations or follow-up work.

Remember: commit and push the implementation branch, but do not create a PR.
