# Wave 33 — WP-E: Ribbon QA Fix Pass (§1.6.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other agents may be editing ribbon implementation, metadata, and tests. Do not revert their changes.

## Context

Wave 33 completes the remaining ribbon coverage. Your role is the QA/fix pass: catch invalid IDs, broken icons, disabled ribbon commands, duplicate test IDs, and metadata/test mismatches after the implementation agents make changes.

## Ownership

Primary write scope:
- Minimal fixes wherever QA finds a Wave 33 issue.
- Prefer targeted changes in `RibbonBar.tsx`, `commandCapabilities.ts`, `defaultCommands.ts`, or ribbon tests.

Do not perform broad refactors.

## Orientation

Run after WP-A/WP-B/WP-C have produced changes if possible:
- `pnpm --filter @bim-ai/web exec vitest run src/workspace/shell/TopBar.test.tsx src/workspace/shell/ribbonCompleteTabs.test.tsx src/workspace/commandCapabilities.test.ts src/cmdPalette/defaultCommands.test.ts`
- `pnpm --filter @bim-ai/web exec tsc --noEmit --pretty false` only if the repo has a working typecheck baseline; otherwise report baseline failures separately from Wave 33 issues.
- `rg -n "view\\.ribbon|ribbon-tab-|ribbon-command-|behavior === 'disabled'|missing-metadata" packages/web/src/workspace packages/web/src/cmdPalette`

## Required Work

1. Verify every new ribbon tool ID exists in `packages/web/src/tools/toolRegistry.ts`.

2. Verify every new action ID is included in `RibbonActionId` and handled in the existing action invocation path.

3. Verify every new icon exists in `@bim-ai/ui` icon names already accepted by `RibbonBar.tsx`.

4. Verify new capabilities with `cmd-k` have matching command registrations and valid surfaces.

5. Fix only concrete issues uncovered by tests or type errors.

6. Report any remaining failures clearly, separating pre-existing baseline failures from Wave 33 regressions.

## Acceptance

- Targeted ribbon/command metadata tests pass.
- Any remaining failure has a concrete file/test/error summary.

