# Wave 33 — WP-B: Ribbon Capability + Cmd-K Metadata (§1.6.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other agents may be editing Wave 33 ribbon implementation and tests. Do not revert their work.

## Context

Wave 32 added `view.ribbon-steel-precast-tabs`. Wave 33 is completing the remaining §1.6.5 ribbon surface. Your job is the command metadata layer: `commandCapabilities.ts` and `defaultCommands.ts` should describe the completed ribbon coverage and remain consistent with command-palette tests.

## Ownership

Primary write scope:

- `packages/web/src/workspace/commandCapabilities.ts`
- `packages/web/src/cmdPalette/defaultCommands.ts`
- `packages/web/src/workspace/commandCapabilities.test.ts` or `packages/web/src/cmdPalette/defaultCommands.test.ts` only if tests need new expectations.

Avoid editing `RibbonBar.tsx`; WP-A owns it.

## Orientation

Run:

- `rg -n "view\\.ribbon|ribbon.*tabs|CommandSurface|CapabilityId|surfaces:" packages/web/src/workspace/commandCapabilities.ts`
- `rg -n "view\\.ribbon|registerCommand\\(|category:" packages/web/src/cmdPalette/defaultCommands.ts`
- `pnpm --filter @bim-ai/web exec vitest run src/workspace/commandCapabilities.test.ts src/cmdPalette/defaultCommands.test.ts`

## Required Work

1. Add or replace the Wave 32 narrow capability with a broader implemented capability, for example:
   - `view.ribbon-complete-tabs`
   - Label: `Ribbon Complete Tab Coverage`
   - Scope: `global`
   - Intended modes: plan and 3D if WP-A has coverage for both.
   - Surfaces must use valid `CommandSurface` values already supported by the type. Prefer `['ribbon', 'cmd-k']`.
   - Notes should mention Systems/MEP, Insert, Annotate, Analyze, Collaborate, View, Manage, Modify, Steel, Precast, and Massing/Site.

2. Keep `view.ribbon-steel-precast-tabs` if existing tests or tracker references rely on it, but make sure the new Wave 33 capability is the main completion marker.

3. Add a matching `registerCommand` entry in `defaultCommands.ts`.
   - Use a valid `PaletteCategory`; inspect the type before choosing.
   - The command can be a no-op because the ribbon tabs are always visible based on active mode.

4. Ensure every capability with `cmd-k` surface has a matching command-palette registration.

5. Ensure no new invalid surfaces like `menu`, `toolbar`, `plan-canvas`, or `family-library` are introduced unless the current `CommandSurface` type supports them.

## Acceptance

- `pnpm --filter @bim-ai/web exec vitest run src/workspace/commandCapabilities.test.ts src/cmdPalette/defaultCommands.test.ts` passes.
- Metadata truthfully reflects implemented ribbon surfaces, not aspirational work.
