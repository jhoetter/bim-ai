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

Sampled with `pnpm js-lint:budget -- --json` on 2026-05-20:

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

## Workpackages

| ID          | Status  | Scope                       | Exit signal                                                                                 |
| ----------- | ------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| JSL-2026-01 | Done    | Fatal ESLint findings       | `fatal` budget is `0`.                                                                      |
| JSL-2026-02 | Partial | Mechanical unused variables | `@typescript-eslint/no-unused-vars` budget trends downward without behavior changes.        |
| JSL-2026-03 | Open    | Chrome hex literals         | `bim-ai/no-hex-in-chrome` budget trends downward through token migration.                   |
| JSL-2026-04 | Open    | Type escapes                | `@typescript-eslint/no-explicit-any` and type-escape budgets trend downward together.       |
| JSL-2026-05 | Open    | Hook dependency warnings    | `react-hooks/exhaustive-deps` budget trends downward with semantic review.                  |
| JSL-2026-06 | Open    | TS comments and unsafe HTML | `ban-ts-comment`, `react/no-danger`, and related security waivers are removed or isolated.  |
| JSL-2026-07 | Open    | Full gate retirement        | `pnpm lint` is green, `CQW-2026-001` is removed, and strict verification runs full JS lint. |

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
