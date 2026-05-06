# Handover — BIM AI UI redesign

This file is the briefing pack for the next AI agent (or human) picking up the BIM AI UI redesign work. It is self-contained: read this top-to-bottom, then open the linked specs.

**Last updated**: 2026-05-06 (commit `e13b1926`).

---

## 1. Where you are

- **Repo**: `/Users/jhoetter/repos/bim-ai`
- **Branch**: `main` (commit directly to main, push after each WP — that's the established cadence)
- **Stack**: pnpm workspaces · React 19 + Vite 6 + TypeScript · Tailwind · Three.js (3D) · cmdk (palette) · zustand (state) · React Router · vitest · Playwright · FastAPI + SQLAlchemy 2 + Postgres
- **Routes**: `/` mounts the redesigned chrome (`packages/web/src/workspace/RedesignedWorkspace.tsx`); `/legacy` mounts the old panel-stack (`packages/web/src/Workspace.tsx`, ~1975 lines).

---

## 2. Read these first, in order

1. **`OPEN_TASKS.md`** (repo root) — the active to-do list. Currently empty in both action sections; only `## §28 WP-UI rows — table-level audit` and the protocol footer remain. **This is the canonical place to track new tasks.**
2. **`spec/ui-ux-redesign-v1-spec.md`** — the UI/UX bible. Long but well-sectioned. Hot sections:
   - §4 — *done rule* (token-only, lucide-only, WCAG AA, reduced-motion, Playwright baseline, a11y, real surface adoption)
   - §6 — sprint ledger of closed work (newest entries on top)
   - §11.3 — view tabs spec (the most recent feature)
   - §28 — WP-UI-* table (every row is `partial`; sweep candidate)
   - §30 — backlog seeds (foundations re-verification, real OrbitControls, drawing flows)
   - §32 — visual-fidelity gap audit (V01–V15, all closed by commits in §6)
3. **`spec/revit-production-parity-workpackage-tracker.md`** — engineering parity (separate track, mostly closed at commit `e15acf55`). Touch only when a UI WP requires a kernel command.
4. **`spec/prd.md`** — product scope.
5. **`README.md`** — repo entry, quickstart commands.

---

## 3. Recent work — last 13 commits (`git log --oneline -13`)

```
e13b1926 test(ui): T-04 re-capture Playwright baselines after chrome refresh
4b918c73 feat(ui): T-03 TopBar project menu — recent / save / open / new
993a7eec feat(ui): T-07 per-tab viewport state — orbit camera snapshots
85a0fd13 feat(ui): T-06 tab localStorage persistence
6addd46a feat(ui): T-05 tab drag-reorder
0cba3995 fix(ui): T-01 wall draw — wire onSemanticCommand to applyCommand
16b5998d fix(ui): T-02 theme refresh on canvas — Three.js scenes rebuild on toggle
e3f51f6d docs: OPEN_TASKS.md as the canonical active UI to-do
34b6120d feat(ui): WP-UI-A12 view tabs (Revit-style) — multi-view tab strip
f3961d7d fix(ui): close visual-fidelity gaps V01–V14 (canvas full-bleed, 3D cube, seed CTA)
f406f8f1 docs(spec): §32 visual-fidelity gap audit + conservative.css preview preset
7164895a feat(ui): legacy chrome gets back-to-redesigned link + Phase A→F closure
dddda700 feat(ui): capture Playwright visual regression baselines for /redesign
```

The full §6 sprint ledger in `spec/ui-ux-redesign-v1-spec.md` summarizes each closed wave.

---

## 4. Key source paths

### Frontend (`packages/web/src`)

| Path | Role |
|---|---|
| `App.tsx` | Router. `/` → `RedesignedWorkspace`, `/legacy` → `Workspace`. |
| `workspace/RedesignedWorkspace.tsx` | Main chrome — composes AppShell + TopBar + TabBar + LeftRail + Inspector + StatusBar. ~700 lines. |
| `workspace/AppShell.tsx` | 5-zone CSS grid (topbar / leftRail / canvas / rightRail / statusBar). Topbar row is `auto` so the TabBar fits below TopBar. |
| `workspace/TopBar.tsx` | §11 anatomy + mode pills. Project-name pill exposes `projectNameRef` for `<ProjectMenu>` to anchor. |
| `workspace/TabBar.tsx` | §11.3 view-tabs strip below TopBar. HTML5 drag-reorder. |
| `workspace/tabsModel.ts` | Pure reducer for tabs. `openTab`/`closeTab`/`activateTab`/`cycleActive`/`reorderTab`/`snapshotViewport`/`activateOrOpenKind`/`tabFromElement`. |
| `workspace/tabsPersistence.ts` | localStorage save / restore / prune for `TabsState` (key `bim-ai:tabs-v1`). |
| `workspace/ProjectMenu.tsx` | Dropdown anchored under the project-name pill. |
| `workspace/projectSnapshots.ts` | Save/restore JSON snapshot bundles + recent-projects list (key `bim-ai:recent-projects-v1`). |
| `workspace/Inspector.tsx` | §13 right rail. Tabs: Properties / Constraints / Identity. Empty-state quick actions are real `<button>`s. |
| `workspace/InspectorContent.tsx` | Discriminated-union renderers for every Element kind. |
| `workspace/LeftRail.tsx` | §12 Project Browser tree. |
| `workspace/StatusBar.tsx` | §17 status clusters. |
| `workspace/ModeShells.tsx` | Mode-specific shells (Section / Sheet / Schedule / AgentReview). |
| `Viewport.tsx` | 3D canvas. CameraRig + materials + ViewCube + walk-mode + section-box. ~1000 lines. |
| `viewport/ViewCube.tsx` | CSS-3D cube widget (`transform-style: preserve-3d`, ~25° tilt, rotates with camera azimuth). |
| `viewport/cameraRig.ts` | Pure spherical-coordinate orbit/pan/dolly/frame/reset/applyViewpoint. |
| `viewport/materials.ts` | Token-driven Three.js material/lighting paint bundle. |
| `viewport/walkMode.ts` | WASD + mouse-look controller. |
| `viewport/sectionBox.ts` | Six-plane clipping controller. |
| `plan/PlanCanvas.tsx` | 2D plan canvas (Three.js orthographic). ~750 lines. |
| `plan/symbology.ts` | Drafting paint/palette factory (`getPlanPalette()`). |
| `plan/draftingStandards.ts` | §9.10 + §26 line weights, hatches, grid visibility. |
| `cmd/RedesignedCommandPalette.tsx` | cmdk modal (`⌘K`, 560 px, parseQuery + rankCandidates). |
| `cmd/CheatsheetModal.tsx` | `?` keyboard hint modal. |
| `onboarding/OnboardingTour.tsx` | §24 5-step popover with 4-rectangle spotlight. |
| `tools/ToolPalette.tsx` | §16 floating top-center toolbar. |
| `tools/toolRegistry.ts` | §16.1 tool ordering / hotkeys / icons / disabled rules. |
| `tools/toolGrammar.ts` | §16.4–16.5 per-tool grammars (Wall chain, Door swing/hand, Floor pick-walls, etc.). |
| `state/store.ts` | Zustand store — model state, selection, viewer mode, tools, theme alias, etc. |
| `state/theme.ts` | Theme controller — `data-theme` attribute + `.dark` class + localStorage + URL hash. |
| `state/useTheme.ts` | Hook subscribing canvas components to theme changes via MutationObserver. |
| `state/uiStates.ts` | §25 empty/loading/error pattern table. |
| `state/modeController.ts` | `1`–`7` hotkey → mode mapping. |
| `lib/api.ts` | `bootstrap`, `applyCommand`, `fetchActivity`, `fetchComments`, etc. Thin fetch wrappers. |
| `design-systems/default.css` | Web-side design system entry. Imports tokens-default + tokens-dark + tokens-drafting. |
| `design-systems/conservative.css` | Preview design system (slate / navy / serif from `~/repos/hof-os`). Activate with `VITE_DESIGN_SYSTEM=conservative`. |
| `design-systems/contrast.ts` | WCAG 2.1 luminance + contrast ratio + `parseColor`. |
| `design-systems/a11y.ts` | §22 a11y baseline contract (hit-targets, focus ring, aria-live). |
| `design-systems/motion.ts` | §21 motion table + reduced-motion collapse. |
| `design-systems/visualRegressionBaselines.ts` | Canonical manifest of Playwright baseline surfaces. |

### Design tokens (`packages/design-tokens/src`)

| Path | Role |
|---|---|
| `tokens-default.css` | Light chrome (`:root`, `:root[data-theme='light']`). |
| `tokens-dark.css` | Dark chrome (`:root[data-theme='dark']`, `:root.dark`). |
| `tokens-drafting.css` | Canvas-only drafting tokens (`--draft-*`, `--cat-*`, line weights). Hex literals — Three.js's `Color.set()` parses hex consistently. |
| `conservative/conservative.css` | Borrowed from `~/repos/hof-os` (slate/navy enterprise palette). |
| `tailwind-preset.ts` | Tailwind preset exposing tokens. |

### Other packages

| Path | Role |
|---|---|
| `packages/ui/src/icons.tsx` | `Icons` registry (lucide-react). `IconLabels` for aria-labels. `ICON_SIZE` for size scale. |
| `packages/ui/src/index.tsx` | `Btn`, `Panel` primitives. |
| `packages/cli/lib/seed-house-v2-commands.mjs` | Seed-house V2 command builder. |
| `packages/core/src/index.ts` | Shared TS types: `Element`, `Snapshot`, `ModelDelta`, `Violation`, etc. |

### Backend (`app/bim_ai/`)

Python FastAPI. Out of scope for most UI WPs unless a kernel command is needed (e.g. `WP-UI-F01` may add a railing variant). Tests in `app/tests/`. Already has the seeded model used by `make seed` (project id, model id served via `/api/bootstrap`).

### Tests

| Path | Tooling |
|---|---|
| `packages/web/src/**/*.test.{ts,tsx}` | vitest (1122 tests at last run). |
| `packages/web/e2e/ui-redesign-baselines.spec.ts` | Playwright visual regression (7 baselines under `e2e/__screenshots__/`). |
| `app/tests/` | pytest. |

---

## 5. Conventions

These are non-negotiable rules from the spec. Violating them creates cleanup work later.

- **Tokens, not hex** in chrome: read CSS custom properties via `var(--color-*)` or `liveTokenReader().read('--color-foreground')`. Drafting tokens (`--draft-paper`, `--cat-wall`) are hex literals so Three.js's `Color.set()` parses them reliably across browsers.
- **Lucide-only icons** in chrome — pull from `@bim-ai/ui` (`Icons`, `IconLabels`, `ICON_SIZE`). Custom canvas symbology lives under `packages/web/src/plan/symbology.ts`, NOT in lucide.
- **Light theme default**, dark via `data-theme="dark"` or `.dark` class on `<html>`.
- **240 ms motion budget** (§21). Reduced-motion media query collapses durations to 0.
- **A11y baseline** (§22): every icon button has `aria-label` or `title`; chrome hit targets ≥ 24 px; tool palette ≥ 36 px; focus ring 2 px `--color-ring`.
- **Per-WP commits**: one workpackage per commit, `feat/fix/docs/test/refactor(scope): subject` format, push after each. Co-author trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
- **Always check `OPEN_TASKS.md`** before adding new code. Add new tasks there as `T-NN`. When a task closes, delete its row + add an entry in spec §6.
- **No `// removed` comments, no rotting JSDoc**, no half-finished implementations. Remove the code; commit history is the audit trail.

---

## 6. Build / test / verify commands

Run from `packages/web/` unless noted. Equivalent commands at repo root use `pnpm --filter @bim-ai/web …`.

| Command | What it does |
|---|---|
| `pnpm install` | Install deps (run once, or after package.json changes). |
| `make dev` | Bring up Postgres + FastAPI :8500 + Vite :2000. |
| `make seed` | Seed the DB with the demo project + model. |
| `pnpm exec tsc --noEmit` | Frontend typecheck. |
| `pnpm exec vitest run src` | Frontend unit tests (~1122 currently). |
| `pnpm exec vitest run src/workspace` | Targeted vitest by directory. |
| `pnpm exec playwright test e2e/ui-redesign-baselines` | Visual regression (needs `make dev` running). |
| `pnpm exec playwright test --update-snapshots` | Re-capture baselines after a deliberate visual change. |
| `make verify` | Full CI gate: format-check, lint, architecture, typecheck, pytest, vite build. |
| `app/scripts/ci-gate-all.sh` | Six-gate CI runner used in pipelines. |

`VITE_DESIGN_SYSTEM=conservative pnpm dev` previews the alternative design system.

---

## 7. State of play

### Closed
- All `T-NN` tasks from the previous wave (T-01 through T-07) — see commits above.
- All §32 V-rows (V01–V15).
- Phase A→F adoption sweep (commit `7164895a`).
- 1122 vitest pass, 7 Playwright baselines stable, web typecheck clean.
- Backend was already running with seeded data when baselines were re-captured. `/api/bootstrap` returns `projects[0].models[0]` and `/api/models/<id>/snapshot` returns the seeded `Snapshot`.

### Open candidates (no T-NN row yet — pick one if you want to drive a sweep)

A) **§28 WP-UI partial → done sweep**. Every row in §28 is `partial`. The §4 done-rule isn't met for any. A focused sweep would target one row at a time: confirm a11y, contrast, reduced-motion, Playwright coverage, lucide-only, tokens-only, and that the surface is actually adopted in `RedesignedWorkspace.tsx`. List the rows you target under a new `## Sweep: <name>` heading in `OPEN_TASKS.md`.

B) **§30 backlog seeds**. Concrete unstarted-but-scoped work:
- Foundations re-verification (`WP-UI-A01`, `A02`, `A07`, `A08`).
- Seed house V2 polish (`WP-UI-F01` — balcony, terrace, pitched roof, cladding).
- Real `OrbitControls` instead of the hand-rolled spherical rig (`WP-UI-B04`, `B06`).
- Tool drawing flows beyond Wall (`WP-UI-C03–C12`) — Door / Window / Floor / Roof / Stair / Railing / Room / Dimension / Section / Tag.
- Onboarding tour content (`WP-UI-F02`, `F03`).

C) **Plan-camera per-tab snapshot** (T-07 follow-up). Currently scaffolded in `tabsModel.ts` (`viewportState.planCamera`) but not wired. PlanCanvas's camera ref is component-local; to expose the zoom/pan position to the host you need either (a) a `cameraRef` callback prop, or (b) a `usePlanCamera` zustand slice.

### Things to know about the legacy `/legacy` route
- ~1975 lines, panel-heavy. Has its own tests pinned to its DOM.
- Real bootstrap path lives there (`Workspace.tsx:498` — fetches `/api/bootstrap`, hydrates, opens WS, etc.). The redesigned chrome runs a minimal version.
- `/legacy` is a safety net. Consolidating it (deleting / redirecting / inlining) is not on the roadmap. If a user asks for it, raise a new task.

---

## 8. Risk notes

- **Three.js material rebuild** on theme toggle (commit `16b5998d`) unmount-remounts the renderer (~50ms blink). Acceptable for now; the alternative is walking the material registry and calling `.color.set(...)` in place — bigger code change.
- **PlanCanvas pointer events** (T-01 fix `0cba3995`): the FloatingPalette wrapper is positioned `top: 12, left: 50%` and DOES capture pointer events in its band. Spec §11.3 keeps it; if a future user reports clicks lost in that strip, reduce the wrapper to the toolbar's actual bounds.
- **Tabs share the global `activeLevelId`** for plan tabs (T-07). Switching tabs mutates the store. If you need fully independent tab viewport state (e.g. two plan tabs at different zoom levels simultaneously), see §7C above.
- **`packages/web/vite.config.ts`** routes `VITE_DESIGN_SYSTEM=conservative` to the conservative preset. The default is unchanged.

---

## 9. How to ask for help / signal you got stuck

- If a backend endpoint is missing for a WP, check `app/bim_ai/api/` first; if genuinely missing, you have authorization to add it (see commit message patterns of past full-stack WPs).
- If a `partial → done` sweep is blocked because a §4 invariant can't be met, mark the row `deferred` and add a one-line `Why deferred` note. Never silently leave it `partial`.
- If a user's screenshot reveals a new visual gap, add a new `V` row in spec §32 + a `T-NN` in `OPEN_TASKS.md` so the gap doesn't drift back into commit-message-only purgatory.

---

## 10. One-line summary

The redesigned chrome at `/` is shippable; recent waves closed every `T-NN` task and every `V` row; the next coherent push is either a `partial → done` sweep on §28 WP rows or a focused §30 backlog seed (e.g. real `OrbitControls`).
