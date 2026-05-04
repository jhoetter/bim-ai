# Prompt 3 — Room Color Scheme Workbench Slice

You are a future implementation agent working in `/Users/jhoetter/repos/bim-ai`.

## Operating Rules

- Create and work on a dedicated branch for this task.
- Commit your completed changes and push the branch.
- Do **not** create a pull request.
- Keep the work tightly scoped to the room color scheme workbench slice described here.
- Update `spec/revit-production-parity-workpackage-tracker.md` as part of the implementation, including both:
  - `## Recent Sprint Ledger`
  - `## Current Workpackages`
- Do not leave prompt files or temporary planning artifacts behind unless they are intentionally part of the repository workflow.
- Preserve existing user or agent changes. If the working tree is dirty, inspect it first and avoid reverting unrelated edits.

## Goal

Add a minimal room color scheme authoring/readout workflow in the web workbench now that the backend/core `room_color_scheme` model, replayable command support, and plan evidence fields have landed.

The slice should let a user:

1. Inspect the active room color scheme state.
2. Edit programme/department color rows or select/use the singleton `room_color_scheme`.
3. Dispatch replayable commands for changes instead of mutating client state ad hoc.
4. See deterministic legend digest and scheme override evidence from the plan projection wire.
5. Confirm that sheets with plan viewports expose the same deterministic scheme/legend evidence hints where those hooks already exist.

This is a usable workbench authoring/readout slice, not a broad room, schedule, or sheet rewrite.

## Target Workpackages

Advance these workpackages and keep their tracker rows accurate:

- `WP-B06` Rooms and room separation
- `WP-C04` Room color schemes and legends
- `WP-D01` Server-derived schedules
- `WP-D03` Schedule UI
- `WP-E05` Sheet canvas and titleblock
- light `WP-X01` JSON snapshot and command replay

All touched rows should remain honest about remaining parity blockers. Do not mark a row `done` unless the entire row's parity scope is actually complete.

## Current Context To Assume

Backend/core room color scheme support may already exist. Before coding, verify the current implementation instead of duplicating it. Expected landed pieces may include:

- `RoomColorSchemeElem`
- `RoomColorSchemeRow`
- `UpsertRoomColorSchemeCmd`
- canonical singleton id such as `bim-room-color-scheme`
- document hydration for `room_color_scheme`
- plan projection `roomColorLegend`
- deterministic `roomProgrammeLegendEvidence_v0`
- optional evidence fields such as `schemeOverridesSource` and `schemeOverrideRowCount`

If any backend/core command path is missing, add only the smallest missing piece required to make the workbench command replayable.

## Suggested Files

Start by inspecting these files and their nearby tests:

- `packages/core/src/index.ts`
- `packages/web/src/state/store.ts`
- `packages/web/src/Workspace.tsx`
- `packages/web/src/workspace/`
- `packages/web/src/workspace/ProjectBrowser.tsx`
- `packages/web/src/plan/planProjectionWire.ts`
- `packages/web/src/plan/planProjectionWire.legend.test.ts`
- `packages/web/src/plan/roomSchemeColor.ts`
- `app/bim_ai/commands.py`
- `app/bim_ai/engine.py`
- `app/tests/test_plan_projection_and_evidence_slices.py`

Only touch `app/bim_ai/commands.py` and `app/bim_ai/engine.py` if replayable command dispatch is missing or incompatible with the web workbench.

Only touch `app/tests/test_plan_projection_and_evidence_slices.py` if backend evidence behavior changes.

Prefer an isolated web child component under `packages/web/src/workspace/` if `Workspace.tsx` is already large.

## Implementation Requirements

### 1. Workbench Authoring UI

Add a compact room color scheme panel to the web workbench. It may live in the Inspector, Project Browser, schedules/workspace side panel, or an isolated child mounted by `Workspace.tsx`, whichever best matches existing patterns.

The panel should support the minimal useful flow:

- Show whether the document has a singleton `room_color_scheme`.
- Show the current scheme rows sorted deterministically.
- Allow editing rows keyed by programme and/or department.
- Allow editing `schemeColorHex`.
- Allow adding a row.
- Allow removing a row if the existing command/model supports replacing the full row list.
- Persist changes through the replayable command path, preferably `upsertRoomColorScheme`.
- Use existing command dispatch/store APIs rather than direct local-only mutation.

Keep the UX simple. A table or compact form is enough. Avoid a full style manager, drag-and-drop palette editor, or visual design system expansion.

### 2. Singleton Behavior

Use the established singleton room color scheme if one exists. If no row exists yet, the UI should be able to create/use the singleton through the replayable command.

The command payload should be deterministic:

- stable singleton id
- stable row ordering
- normalized color casing if the existing model does that
- no random ids for rows unless the existing model requires ids

### 3. Legend and Evidence Readout

Surface the plan projection evidence already produced by the server/client wire:

- current `roomColorLegend` row count
- deterministic legend digest from `roomProgrammeLegendEvidence_v0`
- `schemeOverridesSource` when present
- `schemeOverrideRowCount` when present
- a concise indication that scheme override evidence is orthogonal to derived room boundary evidence, if that language already appears in the payload

This readout should make it obvious when authored scheme rows are driving room fills instead of programme hash defaults.

Do not rename existing evidence fields unless there is a compelling compatibility reason. If you must change payload shape, update backend and web tests together.

### 4. Schedule and Sheet Touchpoints

Keep schedule and sheet work lightweight:

- If schedules already expose room programme fields, do not build a new schedule filter engine.
- If a sheet evidence manifest already carries plan room programme legend hints for `plan:` viewports, show or preserve the readout path; do not build a sheet raster service.
- If the workbench already has a schedule/sheet evidence area, include a small readout that links the active scheme to deterministic schedule/sheet evidence.

The purpose is to prove command replay and deterministic evidence across room plan, schedule, and sheet surfaces, not to broaden schedule or sheet authoring.

### 5. Command Replay

Make the authoring workflow replayable from JSON snapshot/commands.

Expected behavior:

- User edits scheme rows in the web UI.
- Web dispatches a command.
- Store/server applies it to the canonical document.
- Reload/re-hydration preserves the `room_color_scheme`.
- Plan projection legend and evidence reflect the authored override rows deterministically.

If command replay already works, add web tests around the dispatch payload and hydrated readout. If it does not, add the minimal backend/core support and focused backend tests.

## Non-Goals

Do not implement or refactor:

- room boundary algorithm rewrites
- room separation geometry algorithm rewrites beyond what is necessary to read existing evidence
- sheet raster or print service work
- schedule filter engine expansion
- OpenBIM / IFC work
- geometry kernels
- broad model regeneration architecture
- visual parity with Revit beyond a minimal room color scheme workbench panel
- full palette/theme management

## Tests and Validation

Add or update focused tests proportional to the files you touch.

Suggested web tests:

- `packages/web/src/plan/planProjectionWire.legend.test.ts`
- tests near `packages/web/src/plan/roomSchemeColor.ts`
- workspace/component tests for the new room color scheme authoring/readout UI
- schedule/workspace tests only if you touch those surfaces

Suggested backend tests only if backend evidence or command behavior changes:

- `app/tests/test_plan_projection_and_evidence_slices.py`

Run focused validation first:

```bash
pnpm vitest --run packages/web/src/plan/planProjectionWire.legend.test.ts
```

Also run relevant focused web Vitest files for workspace/schedules if touched.

If backend files are touched, run:

```bash
ruff check app/bim_ai app/tests
pytest app/tests/test_plan_projection_and_evidence_slices.py
```

Run `pnpm verify` if practical before committing and pushing. If it is too slow or blocked, document exactly which focused commands passed and why full verification was skipped.

## Tracker Update Requirements

Update `spec/revit-production-parity-workpackage-tracker.md` in the same commit.

In `## Recent Sprint Ledger`, add one concise row for this branch. Include:

- branch or prompt name
- the concrete implementation surface
- command replay behavior
- plan legend/evidence fields surfaced
- tests run
- affected workpackages
- note that rows remain `partial` unless full parity blockers are closed

In `## Current Workpackages`, update the `Recent sprint delta` and/or `Implemented / evidence` cells for:

- `WP-B06`
- `WP-C04`
- `WP-D01`
- `WP-D03`
- `WP-E05`
- `WP-X01`

Keep the existing table structure intact. Long cells are normal in this tracker. Do not add accidental extra columns.

Do not erase existing evidence history. Append or tighten the current row text while preserving important prior evidence and blockers.

## Acceptance Criteria

The task is complete when:

- A dedicated branch exists and is pushed.
- No PR has been created.
- The web workbench has a minimal room color scheme authoring/readout workflow.
- The workflow can create/use the singleton `room_color_scheme`.
- Editing programme/department color rows dispatches replayable commands.
- Hydration preserves the authored scheme rows.
- The plan legend uses authored scheme rows when applicable.
- The UI surfaces deterministic legend digest/readout evidence, including scheme override source/count when present.
- Schedule/sheet evidence touchpoints are preserved or lightly surfaced without expanding into non-goal work.
- Focused web tests cover the new UI/readout or projection helpers.
- Backend tests are added/updated only if backend behavior changes.
- The tracker ledger and current workpackage rows are updated accurately.
- Validation commands are run and recorded in the final response.

## Conflict-Avoidance Rules

- Before editing, run `git status` and inspect relevant diffs.
- Do not overwrite unrelated user changes.
- Do not reformat large files opportunistically.
- Do not rename established evidence fields unless all producers and consumers are updated.
- Do not change digest semantics casually. Determinism and backwards compatibility matter for evidence packages.
- Keep imports at the top of files; avoid inline imports.
- Follow existing TypeScript exhaustive switch patterns for unions/enums.
- If a file has concurrent edits, make the smallest compatible patch and call out any risky overlap in the final response.
- If the implementation reveals that backend/core support is already complete, do not duplicate it. Spend the slice on the web workbench authoring/readout and tests.

## Final Response Expectations

When done, report:

- branch name
- pushed commit SHA
- high-level changes
- tracker update summary
- validation commands and results
- confirmation that no PR was created
