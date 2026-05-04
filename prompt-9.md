# Prompt 9 — Validation Advisor Replay Diagnostics UX Slice

You are a senior implementation agent working in `/Users/jhoetter/repos/bim-ai`.

Your task is to implement one focused, low-conflict validation/performance/collaboration improvement that advances the Revit production parity tracker without expanding into unrelated product surface.

## Operating Rules

- Start from the latest `main`.
- Create and work on a dedicated branch for this prompt.
- Commit your changes and push the branch.
- Do not create a pull request.
- Do not make broad refactors.
- Do not rewrite unrelated UI, validation, export, geometry, scheduling, or collaboration systems.
- Preserve user or teammate changes already present in the working tree. If unrelated dirty files exist, leave them alone.
- Keep imports at the top of files. Do not add inline imports.
- Follow existing project patterns, naming, tests, and error handling style.

## Target Workpackages

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation. Touch both:

- `Current Workpackages`
- `Recent Sprint Ledger`

The tracker update should describe the actual shipped slice and keep statuses conservative. This prompt targets:

- `WP-V01` Validation/advisor expansion
- `WP-P02` Collaboration model
- `WP-X01` JSON snapshot and command replay
- light `WP-A04` CI verification gates

## Chosen Slice

Implement this focused slice:

> Preserve structured `409` `ApiHttpError.detail` for `applyCommand` and `applyCommandBundle`, then surface the replay diagnostics in the workspace UX so failed command replay matches the existing undo/redo diagnostic readout.

The intent is to make constraint or collaboration conflicts more debuggable during command replay without changing modeling semantics. Today, undo/redo conflict paths already expose useful diagnostic detail. The replay/apply-command path should not collapse a structured backend `409` body into an opaque message when `detail` includes fields such as `replayDiagnostics`, step hints, constraint failures, or advisory metadata.

Keep the implementation small. A good outcome is:

- `packages/web/src/lib/api.ts` preserves parsed structured error detail on `ApiHttpError` for `applyCommand` and `applyCommandBundle`.
- `packages/web/src/Workspace.tsx` only adds a small catch/readout path if needed so apply-command replay diagnostics are visible in the same spirit as undo/redo diagnostics.
- Tests prove the structured `409` detail survives and is rendered or read out where users can act on it.

Do not implement the other suggested slices in this prompt. Do not add exchange discipline advisor filters or degenerate grid/dimension quick-fix commands unless you discover the selected slice is already fully complete and tested. If it is already complete, add the smallest missing test or UX parity improvement in the same selected area.

## Suggested Files

Likely files for this slice:

- `packages/web/src/lib/api.ts`
- `packages/web/src/Workspace.tsx`
- existing focused Vitest coverage for API/workspace command errors, or a new nearby test following current test conventions

Only touch backend files if the backend currently discards the structured `409` payload before the web client can consume it. If backend work is truly necessary, keep it constrained to replay diagnostics preservation and add focused tests. Possible backend files:

- `app/tests/test_undo_replay_constraint.py`
- a narrow command/replay test near existing constraint replay coverage

Possible but not expected files:

- `.github/workflows/ci.yml`, only if adding deterministic hint output to an existing CI verification step is clearly useful and very low-risk

Do not touch these unless choosing a different slice becomes unavoidable:

- `packages/web/src/advisor/perspectiveFilter.ts`
- `packages/web/src/advisor/perspectiveFilter.test.ts`
- `app/bim_ai/constraints.py`
- `app/tests/test_constraints_discipline.py`

## Implementation Guidance

First inspect the current error handling flow before editing:

- Find the `ApiHttpError` class and how it parses response bodies.
- Find `applyCommand`, `applyCommandBundle`, undo, redo, and any replay diagnostics UI/readout in `Workspace.tsx`.
- Identify existing tests for API errors, command application, undo/redo conflict diagnostics, toast/readout text, or replay diagnostics.

Then implement the smallest useful parity fix:

- Ensure `409` responses from `applyCommand` and `applyCommandBundle` retain the structured JSON `detail` object on `ApiHttpError`.
- Preserve backward-compatible behavior for plain string errors and non-JSON responses.
- Avoid double-consuming response bodies. Parse once using the project’s existing response/error helper if one exists.
- Do not invent a new error envelope if the repo already has one.
- Reuse existing diagnostic formatting helpers if present.
- If `Workspace.tsx` needs a UI change, keep it to a small catch/readout branch that recognizes `ApiHttpError.detail.replayDiagnostics` or the existing structured equivalent.
- Match undo/redo wording and behavior where practical, but do not redesign the error panel, advisor pane, or command system.

The UX does not need to be fancy. It should make a replay/apply failure actionable by showing the structured diagnostic hint or failed step instead of only a generic `409` message.

## Tracker Update Requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same commit.

In `Current Workpackages`, reflect the added evidence conservatively. Good language should mention:

- structured `409` replay diagnostics preserved for command apply/bundle failures
- workspace readout parity with undo/redo conflict diagnostics
- focused tests covering the selected path

In `Recent Sprint Ledger`, add a new row for Prompt 9 that includes:

- branch or prompt label
- concise scope summary
- tracker effect across `WP-V01`, `WP-P02`, `WP-X01`, and light `WP-A04`
- explicit blocker/non-goal note that this does not solve full multiplayer scale, OpenBIM replay, or production geometry constraints

Do not overstate completion. Keep rows marked `partial` unless existing tracker conventions clearly justify otherwise.

## Tests and Validation

Run focused validation first:

- focused web Vitest for `api.ts` and/or `Workspace.tsx` command error handling
- focused advisor/workspace Vitest if the test lives under advisor or workspace suites

If backend files are touched, also run:

- backend `ruff` for touched Python files
- focused `pytest` for replay/constraint diagnostics tests

Run broader verification if practical:

- `pnpm verify`

If a full verify is too slow or blocked by unrelated failures, report that clearly in the final response and include the focused commands that passed.

## Acceptance Criteria

- A dedicated branch is created, committed, and pushed.
- No PR is created.
- `applyCommand` and `applyCommandBundle` preserve structured `409` `ApiHttpError.detail` when the server returns JSON diagnostic detail.
- Replay/apply-command diagnostics are visible to the user in a workspace readout path comparable to undo/redo conflict diagnostics.
- Existing behavior for non-409, string-detail, and non-JSON errors is not regressed.
- Focused tests cover the selected structured replay diagnostics path.
- `spec/revit-production-parity-workpackage-tracker.md` is updated in both `Current Workpackages` and `Recent Sprint Ledger`.
- The implementation remains narrowly scoped to the selected validation/performance/collaboration improvement.

## Non-Goals

Do not implement or refactor:

- schedule derivation
- sheet raster or print surrogate work
- OpenBIM replay
- geometry kernels
- room legends
- full multiplayer conflict resolution
- broad advisor taxonomy rewrites
- broad CI pipeline restructuring

## Conflict-Avoidance Rules

- Prefer adding or adjusting focused tests near existing coverage instead of creating large new harnesses.
- Avoid changing backend schemas unless required to preserve an already-returned diagnostic payload.
- Avoid snapshots or brittle UI assertions unless the existing test suite already uses them for this area.
- Do not touch generated artifacts unless the project requires them and you can explain why.
- Do not reformat whole files.
- If you encounter unrelated failing tests, do not chase them. Record the failure and keep this slice focused.
- If the tracker has moved since this prompt was written, update the nearest equivalent workpackage rows and ledger entry without duplicating existing Prompt 9 notes.

## Final Response Requirements

When finished, report:

- branch name
- commit hash
- push status
- files changed
- tests run and results
- confirmation that no PR was created
