# Wave 33 — WP-C: Ribbon Schema Regression Tests (§1.6.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).

You are not alone in the codebase. Other agents may update `RibbonBar.tsx` and metadata while you work. Do not revert their changes.

## Context

The ribbon is the last explicit P1 partial in the tracker. Wave 33 needs durable regression tests so future waves do not accidentally remove tabs, expose disabled commands, or break mode-specific schemas.

## Ownership

Primary write scope:
- `packages/web/src/workspace/shell/ribbonCompleteTabs.test.tsx` (new)
- `packages/web/src/workspace/shell/TopBar.test.tsx` only if extending existing tests is clearly cleaner.

Avoid changing production code unless a test exposes a small obvious bug and no other agent owns it.

## Orientation

Run:
- `sed -n '340,640p' packages/web/src/workspace/shell/TopBar.test.tsx`
- `rg -n "ribbonCommandReachabilityForMode|ribbon-tab-|ribbon-command-" packages/web/src/workspace/shell`
- `rg -n "function buildRibbonTabs|function buildPlanRibbonTabs|function build3dRibbonTabs" packages/web/src/workspace/shell/RibbonBar.tsx`

## Required Tests

Add tests that render `RibbonBar` directly and verify:

1. Plan mode exposes all professional tabs expected after Wave 33:
   - Create, Systems, Insert, Annotate, Analyze/Review, Collaborate, View, Manage, Steel, Precast, Massing & Site.
   - Use actual labels/IDs from `RibbonBar.tsx`; do not force labels that the product does not use.

2. Each new/completed tab opens and shows at least one command or action.

3. 3D mode keeps direct model tools and also exposes the relevant View/Insert/Analyze/Collaborate/Manage coverage.

4. Contextual Modify remains available only when `selectedElementKind` is passed, and does not hide the ordinary tabs.

5. `ribbonCommandReachabilityForMode()` still has no disabled rows for plan, 3D, section, sheet, and schedule.

## Acceptance

- `pnpm --filter @bim-ai/web exec vitest run src/workspace/shell/TopBar.test.tsx src/workspace/shell/ribbonCompleteTabs.test.tsx` passes.
- Tests assert user-visible behavior, not implementation-private arrays.

