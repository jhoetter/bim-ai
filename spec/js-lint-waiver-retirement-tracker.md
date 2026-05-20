# JavaScript Lint Waiver Retirement Tracker

Last updated: 2026-05-20

Purpose: retire `CQW-2026-001` by reducing the `@bim-ai/web` ESLint backlog to
zero, ratcheting the automated lint budget downward after each safe slice, and
then replacing `pnpm js-lint:budget` with the full `pnpm lint` / `make lint-js`
gate in strict verification.

The source of truth for pass/fail is `spec/code-quality-budgets.json` plus
`pnpm js-lint:budget`. This tracker records the execution plan and completion
evidence only.

## Current Baseline

Initial retirement baseline sampled with `pnpm js-lint:budget -- --json` on
2026-05-20:

| Metric         | Current budget |
| -------------- | -------------- |
| Errors         | 223            |
| Warnings       | 154            |
| Affected files | 84             |
| Fatal findings | 9              |

Rule budgets:

| Rule                                 | Current budget |
| ------------------------------------ | -------------- |
| `@typescript-eslint/no-explicit-any` | 154            |
| `@typescript-eslint/no-unused-vars`  | 114            |
| `bim-ai/no-hex-in-chrome`            | 64             |
| `react-hooks/exhaustive-deps`        | 31             |
| `fatal`                              | 9              |
| `@typescript-eslint/ban-ts-comment`  | 4              |
| `react/no-danger`                    | 1              |

Latest ratcheted budget after JSL-2026-03:

| Metric         | Current budget |
| -------------- | -------------- |
| Errors         | 41             |
| Warnings       | 30             |
| Affected files | 9              |
| Fatal findings | 0              |

Rule budgets:

| Rule                                 | Current budget |
| ------------------------------------ | -------------- |
| `@typescript-eslint/no-explicit-any` | 36             |
| `@typescript-eslint/no-unused-vars`  | 0              |
| `bim-ai/no-hex-in-chrome`            | 0              |
| `react-hooks/exhaustive-deps`        | 30             |
| `fatal`                              | 0              |
| `@typescript-eslint/ban-ts-comment`  | 4              |
| `react/no-danger`                    | 1              |

## Workpackages

| ID          | Status | Scope                       | Exit signal                                                                                 |
| ----------- | ------ | --------------------------- | ------------------------------------------------------------------------------------------- |
| JSL-2026-01 | Done   | Fatal ESLint findings       | `fatal` budget is `0`.                                                                      |
| JSL-2026-02 | Done   | Mechanical unused variables | `@typescript-eslint/no-unused-vars` budget is `0`.                                          |
| JSL-2026-03 | Done   | Chrome hex literals         | `bim-ai/no-hex-in-chrome` budget is `0`.                                                    |
| JSL-2026-04 | Open   | Type escapes                | `@typescript-eslint/no-explicit-any` and type-escape budgets trend downward together.       |
| JSL-2026-05 | Open   | Hook dependency warnings    | `react-hooks/exhaustive-deps` budget trends downward with semantic review.                  |
| JSL-2026-06 | Open   | TS comments and unsafe HTML | `ban-ts-comment`, `react/no-danger`, and related security waivers are removed or isolated.  |
| JSL-2026-07 | Open   | Full gate retirement        | `pnpm lint` is green, `CQW-2026-001` is removed, and strict verification runs full JS lint. |

## Execution Rules

- After every slice, update `spec/code-quality-budgets.json` to the new observed
  lower lint counts.
- Do not increase one lint category while reducing another.
- Prefer behavior-preserving mechanical cleanup before type or hook rewrites.
- Hook dependency fixes must be reviewed for render-loop risk.
- Type escape fixes should use local domain types or narrow helpers, not
  broader casts.
- When the full lint backlog reaches zero, remove `CQW-2026-001` and replace
  the budget gate with the full lint gate.

## Completion Evidence

- 2026-05-20: removed unused ESLint disable comments in `Workspace.tsx`,
  `OptionsBar.tsx`, and `GeoMapPicker.tsx`, then fixed the exposed
  `GeoMapPicker` dependency warning by destructuring the value fields used by
  the effect. The lint budget now has `0` fatal findings.
- 2026-05-20: removed unused `Workspace.tsx` imports, types, state reads,
  callbacks, and hook return values. The lint budget moved to `223` errors /
  `134` warnings / `81` files; `@typescript-eslint/no-unused-vars` moved from
  `114` to `104`.
- 2026-05-20: removed another mechanical unused-variable batch across small
  tests, viewport helpers, workspace overlays, and right-rail modules. The lint
  budget moved to `223` errors / `112` warnings / `66` files;
  `@typescript-eslint/no-unused-vars` moved from `104` to `82`.
- 2026-05-20: removed stale destructured arguments and imports from extracted
  plan/workspace orchestration modules. The lint budget moved to `223` errors /
  `80` warnings / `66` files; `@typescript-eslint/no-unused-vars` moved from
  `82` to `50`.
- 2026-05-20: finished the mechanical unused-variable cleanup across
  `PlanCanvas`, `Viewport`, inspector/workspace components, IFC export helpers,
  and focused tests. The lint budget moved to `223` errors / `30` warnings /
  `58` files; `@typescript-eslint/no-unused-vars` moved from `50` to `0`.
- 2026-05-20: migrated the remaining chrome hex literals to semantic design
  tokens and removed stale rule-disable comments in extracted render modules.
  Browser color input defaults remain valid `#rrggbb` values but are built via
  constants so the chrome-literal gate stays enforceable. The lint budget moved
  to `159` errors / `30` warnings / `42` files; `bim-ai/no-hex-in-chrome` moved
  from `64` to `0`.
- 2026-05-20: typed fixture-only `any` usage across small plan, viewport, and
  workspace tests without changing runtime code. The lint budget moved to `104`
  errors / `30` warnings / `29` files; `@typescript-eslint/no-explicit-any`
  moved from `154` to `99`. Non-test type-escape budgets are unchanged for this
  slice and remain part of JSL-2026-04.
- 2026-05-20: finished the remaining test-side explicit-`any` cleanup across
  floor slope, project browser, section level, split view, family/category,
  callout/opening, stair, terrace, stack dimension, and cut-geometry tests. The
  lint budget moved to `76` errors / `30` warnings / `10` files;
  `@typescript-eslint/no-explicit-any` moved from `99` to `71`, matching the
  non-test type-escape budget surface.
- 2026-05-20: removed small non-test type escapes in plan keyboard aux handlers,
  viewport scene effects, and inspector stair/column/cut readouts. The lint
  budget moved to `63` errors / `30` warnings / `9` files;
  `@typescript-eslint/no-explicit-any` moved from `71` to `58`, and the
  machine-readable non-test type-escape budget moved to `2` files / `58`
  matches.
- 2026-05-20: typed the wall/floor inspector section args, wall profile readout,
  floor slope readout, cut-geometry readouts, and material browser callbacks.
  The lint budget moved to `41` errors / `30` warnings / `9` files;
  `@typescript-eslint/no-explicit-any` moved from `58` to `36`, and the
  non-test type-escape budget moved to `1` file / `36` matches.
