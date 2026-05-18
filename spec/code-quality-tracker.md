# BIM AI - Code Quality Tracker

Last updated: 2026-05-18

Purpose: track the current code-quality risks that block the repository from
being a healthy production-grade codebase. This is the active successor to the
completed historical tracker in `spec/archive/code-quality-tracker.md`.

This tracker is intentionally limited to engineering quality: type safety,
maintainability, test signal, tooling reliability, repository hygiene, and
operational correctness of the developer gates. Product parity, feature scope,
and sketch-to-BIM readiness remain in their dedicated trackers.

## Current Rating

Current assessment: **6/10**.

The project has strong ingredients: a real monorepo structure, strict TypeScript
configuration, many frontend tests, Python ruff/pytest coverage gates, lockfiles,
architecture checks, and good evidence of domain-level test coverage. The score
is held down by a failing frontend typecheck, very large central modules, noisy
test output, a few broken or inconsistent local verification commands, and
tracked generated/local artifacts.

The practical target is:

- **7/10** when strict verification is green and the largest active source files
  have clear extraction plans with the first high-churn slices landed.
- **8/10** when noisy tests are quiet by default, `any`/`unknown` escape hatches
  are shrinking in tracked hotspots, and route/store/rendering boundaries are
  visibly easier to change.
- **9/10** only when architectural guardrails prevent new monolith growth and
  CI catches the current classes of regression before they land.

## Baseline Snapshot

Commands sampled on 2026-05-18:

```sh
pnpm architecture
pnpm format:check
pnpm --filter @bim-ai/web typecheck
pnpm --filter @bim-ai/web test -- --run src/plan/terraceFromFloor.test.ts
cd app && uv run ruff check bim_ai tests scripts
cd app && uv run pytest tests/api/test_activity_route.py -q
```

Observed results:

| Gate                      | Result                                 | Notes                                                                                                          |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Package architecture      | Pass                                   | `scripts/check-architecture.mjs` reports `Architecture check OK`.                                              |
| Prettier check            | Pass                                   | Matched configured TS/JS/JSON/YAML set. Markdown is not included.                                              |
| Python ruff via `uv run`  | Pass                                   | `uv run ruff check bim_ai tests scripts` is green.                                                             |
| Frontend unit tests       | Pass                                   | `669` test files / `5462` tests passed in the sampled run, with noisy stderr warnings.                         |
| Frontend typecheck        | Fail                                   | `@bim-ai/web` has real source type errors.                                                                     |
| Narrow backend test       | Assertions pass, command exits nonzero | Project-wide coverage gate applies to narrow test runs, so a focused route test exits with coverage below 65%. |
| Makefile Python ruff path | Broken in this checkout                | `app/.venv/bin/ruff` is missing, while `uv run ruff` works.                                                    |

Code scale snapshot:

| Area                     | Approximate size                         |
| ------------------------ | ---------------------------------------- |
| Backend source           | `app/bim_ai`: about 92k Python LOC.      |
| Frontend/packages source | `packages`: about 280k TS/TSX LOC.       |
| Frontend tests           | 669 Vitest files in `packages/web/src`.  |
| Backend tests            | 285 Python test files under `app/tests`. |

Largest current source files observed:

| File                                                        | Approx LOC | Concern                                    |
| ----------------------------------------------------------- | ---------- | ------------------------------------------ |
| `packages/web/src/plan/PlanCanvas.tsx`                      | 9.4k       | High-churn plan interaction monolith.      |
| `packages/web/src/workspace/Workspace.tsx`                  | 6.7k       | Shell/workflow orchestration monolith.     |
| `packages/core/src/index.ts`                                | 6.0k       | Central type and command registry surface. |
| `app/bim_ai/api/registry.py`                                | 5.9k       | Central API descriptor registry.           |
| `packages/web/src/workspace/inspector/InspectorContent.tsx` | 7.8k       | Inspector rendering and editing monolith.  |
| `packages/web/src/Viewport.tsx`                             | 6.1k       | 3D viewport orchestration monolith.        |

## Status Model

| Status    | Meaning                                                                   |
| --------- | ------------------------------------------------------------------------- |
| `Open`    | No committed fix yet.                                                     |
| `Partial` | Some foundation exists, but the acceptance criteria are not met.          |
| `Done`    | Acceptance criteria are met and protected by a passing verification gate. |
| `Blocked` | Cannot proceed without an upstream decision or dependency.                |

| Priority | Meaning                                                            |
| -------- | ------------------------------------------------------------------ |
| `P0`     | Required to restore trustworthy default verification.              |
| `P1`     | Required for maintainable feature work at current project scale.   |
| `P2`     | Important quality improvement, but not an immediate merge blocker. |
| `P3`     | Cleanup or policy hardening after the main risks are addressed.    |

## Summary Board

| ID         | Priority | Status  | Theme                                     | Exit signal                                                                              |
| ---------- | -------- | ------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| CQ-2026-01 | P0       | Open    | Frontend typecheck                        | `pnpm --filter @bim-ai/web typecheck` passes.                                            |
| CQ-2026-02 | P0       | Open    | Verification command consistency          | `make verify` and `pnpm verify:strict` are both reliable or clearly documented.          |
| CQ-2026-03 | P0       | Open    | Test noise and hidden warnings            | Default test runs do not emit repeated React/jsdom/fetch warnings.                       |
| CQ-2026-04 | P1       | Open    | Source monolith reduction                 | Active extraction plans and first slices landed for the top churn files.                 |
| CQ-2026-05 | P1       | Open    | Core type model hygiene                   | Shared element/command types compile without stale aliases or unreachable discriminants. |
| CQ-2026-06 | P1       | Open    | Runtime data coercion boundary            | Backend-to-frontend coercion is localized, typed, and tested.                            |
| CQ-2026-07 | P1       | Open    | Python route and registry maintainability | Route/registry surfaces split into generated or thematic modules.                        |
| CQ-2026-08 | P1       | Partial | Backend testing signal                    | Full backend suite is strong, but narrow test workflows need usable coverage behavior.   |
| CQ-2026-09 | P2       | Open    | Repository hygiene                        | Generated/local artifacts are untracked or intentionally documented.                     |
| CQ-2026-10 | P2       | Open    | `any`/`unknown` escape hatch reduction    | Hotspot count trends down with CI-visible budgets.                                       |
| CQ-2026-11 | P2       | Open    | Frontend integration test environment     | jsdom/browser gaps are mocked or isolated intentionally.                                 |
| CQ-2026-12 | P2       | Open    | CI quality budget reporting               | Type/test/coverage/noise budgets are visible in CI artifacts.                            |

---

## CQ-2026-01 - Restore Frontend Typecheck

Priority: P0
Status: Open
Owner area: `packages/web`, `packages/core`

### Problem

`pnpm --filter @bim-ai/web typecheck` currently fails. This makes the strict
TypeScript configuration much less valuable because the repo can have passing
unit tests while the application source is not type-correct.

Observed examples:

- `packages/web/src/plan/terraceFromFloor.ts` imports `FloorElem` and
  `RailingElem` from `@bim-ai/core`, but those names are not exported.
- `packages/web/src/plan/PlanCanvas.tsx` calls `setPlanTool(null)` even though
  the parameter is typed as `PlanTool`.
- `PlanCanvas.tsx` passes `ToolId` values such as `family-swept-blend` into a
  narrower `PlanTool` API.
- `packages/web/src/workspace/inspector/InspectorContent.tsx` references
  `onSemanticCommand` in several places where it is not in scope.
- `InspectorContent.tsx` includes a `family_extrusion` switch branch that the
  current `Element` discriminated union considers unreachable.
- `packages/web/src/viewport/meshBuilders.windowFrame.ts` and related tests hit
  `never` types around family extrusion/window frame helpers.

### Acceptance Criteria

- `pnpm --filter @bim-ai/web typecheck` passes locally.
- `pnpm verify:strict` reaches the frontend typecheck step without these errors.
- Any compatibility aliases added to `@bim-ai/core` are intentional and covered
  by a small type-focused test or compile-time fixture.
- Plan tool APIs distinguish nullable UI state from non-null active tool values.
- Inspector semantic-command callbacks are passed through explicit typed options
  rather than free variables.

### Suggested Sequence

1. Fix stale type exports or update imports to use the canonical current type
   names.
2. Normalize `ToolId` versus `PlanTool` boundaries.
3. Repair `InspectorContent` option typing and unreachable discriminants.
4. Re-run `pnpm --filter @bim-ai/web typecheck`.

---

## CQ-2026-02 - Make Verification Commands Reliable

Priority: P0
Status: Open
Owner area: root scripts, Makefile, Python environment

### Problem

The repository has multiple verification entrypoints with inconsistent behavior.
The Makefile assumes `app/.venv/bin/ruff`, but this checkout's `app/.venv` does
not contain `ruff`; `uv run ruff` works. This means the documented `make lint`,
`make format`, `make python-format-check`, and `make verify` path can fail for
environment-shape reasons rather than code reasons.

There is also a difference between root `pnpm verify`, Makefile `verify`, and
`verify:strict`. That is acceptable only if the distinction is documented and
CI chooses one canonical quality gate.

### Acceptance Criteria

- The Makefile uses `uv run ruff ...` or guarantees `ruff` is installed in
  `app/.venv` through `uv sync --extra dev` / dependency groups.
- `make verify` works from a fresh `make install` checkout.
- Root `pnpm verify`, `pnpm verify:strict`, and Makefile `verify` have documented
  scope differences.
- CI invokes the same canonical strict gate that maintainers are expected to run
  before merging.

### Suggested Files

- `Makefile`
- `package.json`
- `.github/workflows/*` if present or added
- `README.md`

---

## CQ-2026-03 - Reduce Test Noise to Actionable Signal

Priority: P0
Status: Open
Owner area: test setup, React/jsdom harness, API mocks

### Problem

The frontend test suite passes but emits repeated warnings and runtime errors to
stderr. Passing tests with noisy output train developers to ignore warnings that
may later indicate real regressions.

Observed classes:

- `react-i18next` warnings about missing `initReactI18next` in tests.
- `Failed to parse URL from /api/...` fetch errors in workspace tests.
- `HTMLCanvasElement.prototype.getContext` not implemented in jsdom for tests
  that create text sprites or canvas-backed materials.
- React warning: `Cannot update a component while rendering a different
component`.
- Duplicate React keys such as `tool.conical-roof`, `tool.dome-roof`,
  `tool.spire-roof`, `tool.graded-region`, and `tool.terrain-split`.

### Acceptance Criteria

- Default frontend test run is quiet except for explicitly allowed warnings.
- A test setup file installs i18n, fetch, and canvas mocks where jsdom is the
  intended environment.
- Browser-only rendering tests are moved to Playwright or guarded behind
  explicit mocks.
- React duplicate-key and setState-during-render warnings are fixed, not
  suppressed.
- CI fails on new unexpected `console.error` / `console.warn` output for selected
  smoke suites.

### Suggested Files

- `packages/web/vite.config.ts`
- `packages/web/src/test*` setup files, if introduced
- `packages/web/src/workspace/Workspace.test.tsx`
- `packages/web/src/workspace/useWorkspaceSnapshot.ts`
- `packages/web/src/lib/api.ts`
- relevant tool/ribbon command registries

---

## CQ-2026-04 - Split Current Frontend Monoliths

Priority: P1
Status: Open
Owner area: frontend architecture

### Problem

The previous code-quality tracker successfully split several old backend and
store monoliths. The current frontend still has large files that combine too
many reasons to change:

- `PlanCanvas.tsx`: input handling, command activation, rendering orchestration,
  snapping, selection, gesture state, keyboard shortcuts, tool lifecycle.
- `Workspace.tsx`: layout, command routing, modal ownership, pane composition,
  workspace hydration, tool dispatch, browser/inspector coordination.
- `InspectorContent.tsx`: property rendering/editing for many unrelated element
  families.
- `Viewport.tsx`: Three.js scene lifecycle, mesh orchestration, interactions,
  controls, overlays, selection, render-state policies.

Large files are not automatically bad, but these are high-churn ownership
surfaces. They increase merge conflicts and make it hard to reason about the
impact of small changes.

### Acceptance Criteria

- Each top file has a documented extraction map before code movement begins.
- First extraction slices land for at least `PlanCanvas.tsx` and
  `InspectorContent.tsx`.
- Extracted modules own cohesive concerns and have unit tests where practical.
- Public component APIs are stable and smaller after extraction.
- No extracted slice depends back on the original file through circular imports.

### Suggested Slices

`PlanCanvas.tsx`:

- `plan/interaction/keyboardShortcuts.ts`
- `plan/interaction/pointerGestureState.ts`
- `plan/tools/planToolState.ts`
- `plan/tools/createSimilar.ts`
- `plan/selection/planSelectionController.ts`

`InspectorContent.tsx`:

- one renderer module per major element family
- shared typed `InspectorCommandOptions`
- registry-driven `kind -> renderer` mapping

`Workspace.tsx`:

- command routing module
- modal ownership controller
- split-pane composition controller
- project/resource dialog controller

`Viewport.tsx`:

- scene lifecycle hook
- selection/picking hook
- render policy module
- overlay/HUD modules

---

## CQ-2026-05 - Repair Core Type Model Hygiene

Priority: P1
Status: Open
Owner area: `packages/core`

### Problem

`packages/core/src/index.ts` is the central type surface for many element and
command kinds. The current typecheck failures suggest stale aliases, missing
exports, and discriminated-union drift between `packages/core` and
`packages/web`.

When the core model drifts, downstream code uses `as any` or unreachable switch
branches to keep moving. That masks real schema disagreements between backend,
frontend, command grammar, and rendering.

### Acceptance Criteria

- Core element and command exports reflect the public names consumed by
  frontend modules.
- Deprecated aliases, if needed, are explicitly exported and marked with a
  migration note.
- Element-kind additions require tests covering:
  - type union membership
  - store coercion
  - inspector/rendering fallback behavior
  - command capability visibility when relevant
- `packages/core/src/index.ts` has an extraction plan for thematic type modules.

### Suggested Direction

Split `packages/core/src/index.ts` into thematic modules and keep `index.ts` as
a public re-export facade:

- `elements/site.ts`
- `elements/building.ts`
- `elements/family.ts`
- `elements/documentation.ts`
- `commands/building.ts`
- `commands/viewsheets.ts`
- `commands/site.ts`
- `commands/family.ts`

---

## CQ-2026-06 - Strengthen Runtime Data Coercion Boundaries

Priority: P1
Status: Open
Owner area: frontend state/API boundary

### Problem

`packages/web/src/state/storeCoercion.ts` is doing important compatibility work
between backend wire data and frontend element types. That is a good boundary,
but it is large and still leans on broad `unknown` and object casting.

Coercion should be intentionally permissive at the edge, but the rest of the app
should receive validated, typed values. When coercion logic grows without
schemas or focused tests, downstream rendering and inspector code tends to add
more defensive `as any` logic.

### Acceptance Criteria

- Coercion functions are grouped by element domain.
- Each major element family has focused tests for snake_case/camelCase input,
  invalid input, and defaulting behavior.
- Invalid or incomplete wire objects are either rejected predictably or coerced
  with explicit defaults.
- Rendering and inspector modules do not duplicate wire-shape coercion.

### Suggested Files

- `packages/web/src/state/storeCoercion.ts`
- `packages/web/src/state/storeCoercion*.test.ts`
- `packages/web/src/lib/api.ts`
- `packages/core/src/*`

---

## CQ-2026-07 - Split Backend API Registry and Route Surfaces

Priority: P1
Status: Open
Owner area: backend API

### Problem

`app/bim_ai/api/registry.py` is approximately 5.9k lines and centralizes a large
tool descriptor registry. `routes_api.py` remains another large application
surface. These files are not necessarily failing today, but they are high-risk
for merge conflicts and stale descriptor drift.

### Acceptance Criteria

- Registry data is split by thematic domain or generated from structured source
  files.
- Descriptor tests verify unique names, command mappings, resource groups, and
  schema refs across all registry slices.
- Route modules are grouped by product surface rather than accumulating in
  `routes_api.py`.
- Existing public API paths remain stable.

### Suggested Direction

- `app/bim_ai/api/registry_core.py`
- `app/bim_ai/api/registry_site.py`
- `app/bim_ai/api/registry_family.py`
- `app/bim_ai/api/registry_sketch.py`
- `app/bim_ai/api/registry_exchange.py`
- `app/bim_ai/routes_models.py`
- `app/bim_ai/routes_catalogs.py`
- `app/bim_ai/routes_viewsheets.py`

---

## CQ-2026-08 - Improve Backend Test Workflow Signal

Priority: P1
Status: Partial
Owner area: backend test configuration

### Problem

The full backend coverage gate is useful, but it makes narrow focused test runs
exit nonzero because total project coverage is below the global threshold for a
small test subset. For day-to-day development, engineers need a fast focused
command that answers "did my tests pass?" without fighting the full coverage
gate.

The repository already has broad backend testing and a separate hardening plan
in `spec/backend-testing-hardening.md`; this item is about workflow clarity.

### Acceptance Criteria

- Full backend gate still enforces coverage.
- Focused backend runs have a documented no-coverage command.
- Makefile exposes both:
  - full backend gate
  - focused developer test path
- CI continues to run the full gate.

### Suggested Commands

```sh
cd app && uv run pytest -q -m 'not integration'
cd app && uv run pytest -q -m 'not integration' --no-cov
```

---

## CQ-2026-09 - Clean Repository Hygiene

Priority: P2
Status: Open
Owner area: repository policy

### Problem

Generated or local-environment artifacts appear to be tracked, including
`.coverage`, `.DS_Store`, and many `tmp/ux-*` screenshots. Some screenshots may
be intentional evidence artifacts, but storing them under `tmp/` makes intent
ambiguous and increases noise in code review and search.

### Acceptance Criteria

- Tracked local-only files are removed from the index:
  - `.coverage`
  - `.DS_Store`
  - `spec/.DS_Store`
- Any intentionally versioned evidence image lives under an explicitly named
  evidence or baseline directory, not generic `tmp/`.
- `.gitignore` and docs explain which generated artifacts are versioned and why.
- `git ls-files | rg '(^tmp/|__pycache__|\\.venv|\\.coverage|\\.DS_Store)'`
  returns only intentionally documented files.

### Suggested Direction

Move long-lived visual baselines into one of:

- `spec/generated/visual-evidence/`
- `packages/web/e2e/__screenshots__/`
- `seed-artifacts/<seed>/evidence/`

---

## CQ-2026-10 - Reduce `any` / `unknown` Hotspots

Priority: P2
Status: Open
Owner area: frontend and backend type safety

### Problem

Some broad `unknown` usage is correct at IO boundaries. But repeated `as any`
inside renderers, exporters, command palette actions, and inspector code weakens
the value of strict TypeScript.

Observed hotspot examples:

- `packages/web/src/export/dxfExporter.ts`
- `packages/web/src/cmdPalette/defaultCommands.ts`
- `packages/web/src/Viewport.tsx`
- `packages/web/src/plan/stairComponentList.ts`
- `packages/web/src/workspace/inspector/InspectorContent.tsx`

### Acceptance Criteria

- Establish a baseline count for `as any`, `: any`, and
  `Record<string, any>` in non-test frontend source.
- Add a lightweight script or documented query for checking the count.
- Reduce the top five hotspots by replacing casts with discriminated-union
  helpers, type guards, or core type exports.
- Do not block legitimate test fixture use of `any`.

### Suggested Query

```sh
find packages/web/src -type f \( -name '*.ts' -o -name '*.tsx' \) \
  | grep -v test \
  | xargs rg -n "as any|: any|Record<string, any>|@ts-ignore|@ts-expect-error"
```

---

## CQ-2026-11 - Separate Browser Rendering Tests from jsdom Tests

Priority: P2
Status: Open
Owner area: frontend tests

### Problem

Several unit tests exercise canvas/Three.js behavior in jsdom, which lacks real
canvas APIs unless mocked. The tests may still pass, but they emit
`HTMLCanvasElement.prototype.getContext` errors and risk testing a different
environment than production rendering.

### Acceptance Criteria

- Pure geometry and scene-object tests stay in Vitest/jsdom with explicit canvas
  mocks where needed.
- Real rendering, pixels, screenshots, and browser interaction move to
  Playwright.
- Test names clearly indicate whether they are pure construction tests or
  browser rendering tests.
- No default test run emits jsdom "not implemented" errors.

### Suggested Files

- `packages/web/src/viewport/*test.ts`
- `packages/web/src/plan/*PlanThree*.test.ts`
- `packages/web/e2e/*`
- shared Vitest setup file

---

## CQ-2026-12 - Add CI Quality Budget Reporting

Priority: P2
Status: Open
Owner area: CI, scripts

### Problem

The repo has many individual quality tools, but no single quality-budget report
that summarizes trends in file size, type escapes, test warnings, coverage, and
tracked generated artifacts.

### Acceptance Criteria

- A script emits a small JSON/Markdown code-quality report.
- Report includes:
  - largest files
  - frontend typecheck status
  - backend coverage summary
  - non-test `any`/`unknown` hotspot count
  - test warning budget status
  - tracked generated artifact count
- CI uploads or prints the report.
- The report is informational at first; selected budgets become blocking after
  the baseline is green.

### Suggested Script

`scripts/code-quality-report.mjs`

---

## Recommended Execution Order

1. CQ-2026-01: restore frontend typecheck.
2. CQ-2026-02: make verification commands consistent.
3. CQ-2026-03: quiet the default frontend test run.
4. CQ-2026-08: document and expose focused backend test commands.
5. CQ-2026-04 and CQ-2026-05: start structural extraction with the active type
   model as the anchor.
6. CQ-2026-09 through CQ-2026-12: add hygiene and reporting budgets so the
   improvements stay visible.

## Definition of Done for This Tracker

This tracker can be archived when:

- `pnpm verify:strict` and `make verify` both pass from a fresh install.
- Frontend tests are quiet by default.
- Backend focused and full test workflows are documented and reliable.
- The top frontend monoliths have been reduced or have accepted ownership
  boundaries enforced by tests.
- Core type exports and frontend element discriminants are aligned.
- Repository hygiene policy is explicit and enforced.
- CI emits a code-quality report with no P0/P1 open items.
