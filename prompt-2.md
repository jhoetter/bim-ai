# Prompt 2 — Advanced Schedule Filter Rules Slice

## Role and Scope

You are the implementing agent for a focused Revit production parity slice in `/Users/jhoetter/repos/bim-ai`.

Your job is to extend schedule parity by one safe, reviewable increment beyond the current `gt`/`lt` numeric width filter behavior. Keep the work narrow, production-minded, and aligned with the existing architecture. Do not turn this into a general schedule engine rewrite.

## Required Git Workflow

- Start from the current mainline state.
- Create and work on a dedicated branch for this slice.
- Commit your finished changes.
- Push the branch to the remote.
- Do not create a PR.
- Do not force-push unless explicitly asked by the user.
- Do not rewrite unrelated history.

Before editing, inspect the working tree. If there are existing uncommitted changes, identify whether they are related to this slice. Do not overwrite or revert user changes. If unrelated dirty files exist, leave them alone.

## Workpackage Targets

This implementation must update the workpackage tracker and should advance only the following workpackages:

- `WP-D01 Server-derived schedules`
- `WP-D02 Schedule CSV/API/CLI export`
- `WP-D03 Schedule UI`
- `WP-D04 Family/type registry and propagation`
- `WP-X01 JSON snapshot and command replay`

Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation:

- Update `Current Workpackages` to reflect the selected schedule filter slice, actual files touched, and status.
- Add an entry to `Recent Sprint Ledger` summarizing what changed, why it matters for Revit parity, tests run, and any remaining follow-up.
- Keep tracker edits factual and scoped to this slice.

## Product Goal

Schedules should behave more like a production BIM schedule surface while remaining deterministic, auditable, and safe. The current implementation already supports numeric width filter behavior such as `gt` and `lt`. Add exactly one constrained increment that expands real schedule usefulness without introducing arbitrary evaluation or broad query-language complexity.

Choose one of these increments after inspecting the code and tests:

- Add `contains` and/or `isBlank` filter operators for schedule fields where they make sense.
- Add room numeric field filters such as `areaM2` and/or `targetAreaM2`, including registry support and export consistency.
- Stabilize grouped subtotal and CSV behavior when filtered schedules are exported or replayed.
- Add one constrained calculated-field helper using structured configuration.

If you choose the calculated-field helper, it must be explicit, typed, and allow-listed. Do not use arbitrary `eval`, JavaScript expression strings, Python expression strings, SQL fragments, or user-provided executable code.

Prefer the smallest option that creates visible parity progress across server derivation, export, UI, and replay behavior.

## Suggested Files

Start by inspecting these files and nearby tests:

- `app/bim_ai/schedule_derivation.py`
- `app/bim_ai/schedule_field_registry.py`
- `app/bim_ai/schedule_csv.py`
- `app/tests/test_schedule_row_filters.py`
- `app/tests/test_upsert_schedule_filters_grouping.py`
- `app/tests/test_kernel_schedule_exports.py`
- `packages/web/src/schedules/SchedulePanel.tsx`
- `packages/web/src/schedules/scheduleFilterWidthRules.ts`
- `packages/web/src/schedules/scheduleFilterRules.test.ts`

You may add a new helper under `packages/web/src/schedules/` if that matches the local pattern better than extending `scheduleFilterWidthRules.ts`.

## Implementation Guidance

Keep server behavior authoritative. UI helpers may guide users and validate obvious filter input, but schedule derivation, exported CSV/API output, CLI behavior, JSON snapshots, and command replay must agree on the same filtered rows and grouped totals.

When adding filter behavior:

- Use existing schedule filter structures and registries where possible.
- Keep filter semantics deterministic across app and web tests.
- Preserve stable output ordering unless the existing API intentionally sorts differently.
- Treat blank/null/missing values consistently and test that behavior if your slice touches blanks.
- Ensure grouped subtotals reflect filtered rows, not pre-filtered source rows.
- Ensure CSV export reflects the same visible schedule rows and totals as the server-derived schedule.
- Ensure command replay and JSON snapshot behavior preserve the new filter rule configuration.
- Keep any UI labels and option names consistent with existing naming conventions.

For room fields:

- Add fields through the schedule field registry rather than hard-coding isolated exceptions.
- Verify the fields are available to schedule derivation and exports.
- Include tests for room rows with matching and non-matching numeric values.

For string operators:

- Define case sensitivity intentionally and document the behavior in tests.
- Decide how non-string values are coerced, or reject unsupported field/operator combinations through existing validation paths.
- Make `isBlank` behavior explicit for empty string, whitespace-only string, `null`, and absent values if those states are represented in fixtures.

For grouped subtotal/CSV behavior:

- Cover at least one grouped schedule where filters remove some rows.
- Verify both displayed/grouped totals and CSV output.
- Avoid changing unrelated CSV formatting.

For a calculated-field helper:

- Use structured config such as an allow-listed operation and named operands.
- Keep supported operations narrow.
- Reject unknown operations and unsupported operand types.
- Add tests proving invalid config cannot execute arbitrary code.

## Non-Goals

Do not work on or refactor these areas for this slice:

- `plan_projection_wire.py`
- Sheet raster/export
- OpenBIM
- Room legend placement
- Geometry kernels
- General formula language support
- Arbitrary expression evaluation
- Broad schedule engine rewrites
- Unrelated UI redesign

If you discover a bug outside the schedule filter/export/replay path, note it in the tracker ledger as follow-up instead of fixing it in this branch.

## Acceptance Criteria

The slice is complete when all of the following are true:

- Exactly one advanced schedule filter/export/replay increment is implemented from the allowed options above.
- Server-derived schedules apply the new behavior deterministically.
- CSV/API/CLI export behavior matches server-derived schedule output for the new rule.
- The schedule UI can represent or preserve the new rule without losing configuration.
- Family/type registry or field registry behavior is updated if the selected slice requires new fields or field metadata.
- JSON snapshot and command replay preserve the new filter configuration and reproduce the same schedule output.
- Focused app tests cover the new server/export/replay behavior.
- Focused web schedule tests cover UI/helper behavior if web code changes.
- `spec/revit-production-parity-workpackage-tracker.md` is updated in `Current Workpackages` and `Recent Sprint Ledger`.
- The branch is committed and pushed.
- No PR is created.

## Validation Commands

Run focused validation first:

```bash
pytest app/tests/test_schedule_row_filters.py app/tests/test_upsert_schedule_filters_grouping.py app/tests/test_kernel_schedule_exports.py
```

Run focused web schedule tests if web code changes:

```bash
pnpm vitest packages/web/src/schedules/scheduleFilterRules.test.ts
```

If practical before committing, run the broader repo verification:

```bash
pnpm verify
```

If a command is unavailable, too slow, or fails for reasons outside this slice, capture the exact command and failure summary in your final handoff and in the tracker ledger when relevant.

## Conflict-Avoidance Rules

- Do not edit files unrelated to the selected slice.
- Do not reformat files wholesale.
- Do not reorder exports, fixtures, or snapshots unless required by the new behavior.
- Do not change public schedule schemas casually; if schema changes are needed, keep them backwards-compatible or add explicit migration/default handling.
- Do not introduce new dependencies unless there is no reasonable local alternative.
- Do not add inline imports; keep imports at the top of files.
- For TypeScript unions or enums, use exhaustive handling where applicable.
- Do not preserve compatibility with in-progress branch-only behavior by layering shims; choose the cleanest implementation for the current branch.
- Never use arbitrary evaluation for calculated fields or filters.

## Final Handoff Requirements

When finished, report:

- The branch name and pushed commit hash.
- Which single increment you chose and why.
- The key files changed.
- The tracker sections updated.
- Validation commands run and their results.
- Any follow-up risks or deferred work.

Remember: commit and push the branch, but do not create a PR.
