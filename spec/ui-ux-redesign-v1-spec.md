# BIM AI UI/UX Production Redesign Specification V1

**Source PRD:** [spec/prd/revit-production-parity-ai-agent-prd.md](prd/revit-production-parity-ai-agent-prd.md)
**Companion tracker:** [spec/revit-production-parity-workpackage-tracker.md](revit-production-parity-workpackage-tracker.md)
**Status:** spec — not yet implemented; sequenced after the v1 closeout (`e1a43586`).
**Owner workpackage prefix:** `WP-UI-*` (this document is the source of truth for those rows).

---

## 0. Why this document exists

The post-v1 application is internally coherent — deterministic evidence, replay, CI gates, run book — but the rendered surface in `packages/web/src/Workspace.tsx` does not yet read as a tool an architect would touch. The current shell is a 1958-line stack of dense diagnostic panels: numeric readouts dominate, the canvas is small relative to the chrome, the 3D rig is a hand-rolled orbit with no view cube and no proper navigation, the theme is a developer-grade dark, and primary drawing tools are buried in mixed-metaphor toolbars.

This spec defines the redesign target with the same rigor the engineering tracker has. It is intentionally extensive: pixel-level layout, token-level color, every drawing tool's full grammar, the full keyboard map, the seed-house geometry needed to make the empty 3D viewport meaningful. It mirrors the engineering tracker's structures (status legend, maturity, done-rule, dashboard, workpackages, ledger, update protocol) so the two documents can be operated identically.

The redesign must hold three constraints simultaneously:

1. **Look and feel of Rayon / Figma / Motif.io** — light-first, large canvas, sidebar-driven, calm chrome, vector-crisp, fast.
2. **Capability of Revit** — every element class an architect needs (walls, doors, windows, floors, roofs, stairs, rooms, dimensions, sections, sheets, schedules) reachable in one or two clicks, with the snap and constraint grammar architects expect.
3. **Anthropic agent loop preserved** — Agent Review, evidence panels, advisor, and command bar from the existing app remain, but as a structured drawer / mode rather than first-class chrome that competes with the canvas.

If a design choice violates any of those three, it is not in scope.

---

## 1. North-star references and what to take from each

| Reference            | What to take                                                                                                                                                                                                                         | What NOT to take                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Figma**            | Canvas-as-hero (`>=70%` viewport), thin left/right rails, file tabs across the top, command palette (`⌘K`), tool grammar (V/M/R/T/L/F), nested layers panel, multiplayer cursors as ambient, `Escape`-cancels-everything discipline. | "Boards" / FigJam metaphors, plug-in panels, frame auto-layout — those are not BIM concerns. |
| **Rayon.design**     | Light, paper-feel canvas, blueprint-blue accent for construction lines, crisp vector drafting, top-floating tool group, right-side context properties, generous whitespace, contour/topo overlay, drafting line-weight discipline.   | The 2D-only flatness — we have 3D as a co-equal mode.                                        |
| **Motif.io**         | Token-first design system, motion as feedback (not decoration), AI suggestions as inline pills, rigorously consistent radius/spacing, search-driven navigation.                                                                      | The pure-2D canvas; their library model is not ours.                                         |
| **Revit**            | Element ontology (Wall, Door, Window, Floor, Roof, Ceiling, Stair, Railing, Curtain System, Room, Area, Tag, Section, Elevation, Sheet, Schedule, Family, Type, Group), Project Browser hierarchy, ViewCube, instance-vs-type panel. | The ribbon's visual density, dialog-spam, modal property editors, dark-grey 1990s chrome.    |
| **AutoCAD / Fusion** | Command line as accelerator (typed alongside palette), polar/parallel snap tracking with on-screen tooltips, `F1-F12` function-key map, status-bar at bottom with model-units / coordinates / snap mode toggles.                     | The cursor menu, "ribbon" stacking, AutoLISP — not relevant.                                 |
| **Linear / Notion**  | Calm typographic rhythm, Inter as the only sans, micro-interactions on hover, keyboard-first command palette, soft borders (`hsl 220 16% 86%`-equivalent), no shadows-as-decoration.                                                 | Document-blocks model, comments-as-first-class — we're not authoring text.                   |

The synthesized house aesthetic: **Rayon's chrome + Revit's ontology + Linear's typography + Figma's keyboard discipline + Motif's tokens.**

---

## 2. Status legend (mirrors engineering tracker)

| Status     | Meaning                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `done`     | UX surface meets this spec, has Playwright/visual-regression evidence, and passes a11y baseline. |
| `partial`  | Real implementation exists, but does not yet meet the spec's interaction or visual acceptance.   |
| `stub`     | Component or token placeholder exists, no real interaction.                                      |
| `pending`  | Not implemented.                                                                                 |
| `deferred` | Out of redesign V1 scope (e.g. reserved for V2 and called out explicitly).                       |

## 3. Maturity and progress legend

| Maturity            | Meaning                                                                                          | Approx. progress band |
| ------------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| 0 sketch            | Design intention recorded; no code.                                                              | 0–10%                 |
| 1 token / primitive | Tokens, primitive components (Button, Field, Surface) exist; not yet composed into the surface.  | 10–30%                |
| 2 composed slice    | Surface renders end-to-end on real data, but interactions or polish are incomplete.              | 30–55%                |
| 3 evidenced slice   | Surface has Playwright happy-path + visual-regression + keyboard-nav coverage.                   | 55–80%                |
| 4 redesign-ready    | Meets all interaction, motion, theme, a11y acceptance for the agreed scope; eligible for `done`. | 90–100%               |

## 4. Done rule (UX-specific)

A `WP-UI-*` workpackage may move to `done` only when ALL of the following are true:

1. Visual: matches the layout spec at the documented breakpoints (1024w, 1440w, 1920w) without horizontal scrollbars except where explicitly allowed (canvas pan).
2. Tokens: uses only documented design tokens — no inline `#hex`, no hard-coded `px` outside motion/sizes already in the token table.
3. Iconography: every icon comes from `lucide-react`. No custom inline SVG except in canvas (drafting symbols, viewcube faces, app logo).
4. Theme: works in light AND dark without re-skin. Both themes pass WCAG AA contrast on body copy and AA-large on chrome.
5. Keyboard: every primary action reachable via documented shortcut; `Escape` cancels; `Tab` traversal makes structural sense.
6. Pointer: every interaction respects the snap + modifier grammar in §14 / §15.
7. Motion: no animation longer than 240 ms; `prefers-reduced-motion` honored.
8. A11y: focus-visible rings on every interactive element; `aria-*` on canvas-and-toolbar interactions; live-region for status/readouts.
9. Evidence: at least one Playwright spec exercising the happy path and one visual-regression baseline image; component vitest covering branch logic.

---

## 5. UX parity dashboard

Directional read of the redesign surface area, not a release claim.

| Area                        | State     | Maturity center     | Approx. UX parity | Current read                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | --------- | ------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell                   | `partial` | 2 composed slice    | ~35%              | `workspace/AppShell.tsx` is the canonical 5-zone grid driven by `--shell-*` sizing tokens with `[`/`]` rail-toggle hotkeys; slot props expose TopBar/leftRail/canvas/rightRail/statusBar. Existing `Workspace.tsx` has not yet adopted it — TopBar / Inspector / StatusBar fillers follow in WP-UI-A03–A06.                                                                                                                                                                |
| 2D Plan canvas              | `partial` | 2 composed slice    | ~45%              | `PlanCanvas.tsx` renders projection wires, snap, drawing for walls/doors/windows/rooms. Drafting line weights, contour overlay, paper-feel background, snap-tracking tooltips, marquee select, copy/paste are missing.                                                                                                                                                                                                                                                     |
| 3D Viewport                 | `partial` | 2 composed slice    | ~40%              | `Viewport.tsx` still hosts the legacy in-line rig, but `viewport/cameraRig.ts` now exposes the §15.3 grammar (orbit/pan/dolly/zoom/frame/reset/applyViewpoint) plus `classifyPointer`/`wheelDelta`/`classifyHotkey`, fully unit-tested. ViewCube + walk + section box still pending; Viewport.tsx adoption sweep follows.                                                                                                                                                  |
| Tool palette / top ribbon   | `pending` | 0 sketch            | ~5%               | Tools live in mixed `Btn` rows inside the left column. No grouped palette, no top-floating ribbon, no tool tooltips with shortcut hints, no tool-mode persistence indicator.                                                                                                                                                                                                                                                                                               |
| Project Browser (left rail) | `partial` | 3 evidenced slice   | ~75%              | `workspace/LeftRail.tsx` is the §12 tree (sticky search w/ auto-expand, uppercase eyebrows, `role="tree"` + `treeitem`, Arrow/Enter/F2 keyboard model, accent-soft active row, `LeftRailCollapsed` icon strip). The existing `ProjectBrowser.tsx` engineering panel is kept until the post-Phase-3 adoption sweep replaces it inside Workspace.tsx.                                                                                                                        |
| Inspector (right rail)      | `partial` | 3 evidenced slice   | ~70%              | `workspace/Inspector.tsx` lands the §13 anatomy: header w/ close, Properties/Constraints/Identity `role="tablist"` (arrow keys cycle), sticky Apply/Reset footer gated on `dirty`, evaluator-backed `<NumericField>` w/ unit chip, empty-state quick-actions list. Wiring inside Workspace.tsx and on-canvas witness lines deferred to adoption sweep.                                                                                                                     |
| Status bar / footer         | `partial` | 3 evidenced slice   | ~70%              | `workspace/StatusBar.tsx` lands the §17 cluster set: level switcher w/ PageUp/Down cycling, tool readout, snap-mode `role="switch"` group, grid switch, mono cursor coords w/ aria-live, undo/redo cluster, ws + save pills with assertive aria-live on offline / error. Workspace.tsx adoption deferred to post-Phase-3 sweep.                                                                                                                                            |
| Command palette + shortcuts | `partial` | 2 composed slice    | ~40%              | `CommandPalette` and `Cheatsheet` exist. Shortcut map is not curated; many primary actions still require pointer.                                                                                                                                                                                                                                                                                                                                                          |
| Theming                     | `partial` | 3 evidenced slice   | ~70%              | Full §9 token set lands in `@bim-ai/design-tokens` (chrome / drafting / categories) and `state/theme.ts` is the canonical controller (light default, `data-theme="dark"`, hash + storage + `prefers-color-scheme` cascade, `prefersReducedMotion` exposed). Component code never branches on theme. Surface adoption sweep (chrome lit-up) still pending.                                                                                                                  |
| Iconography                 | `partial` | 2 composed slice    | ~65%              | `@bim-ai/ui` exposes the full §10.1 lucide-react registry with `aria-label` defaults, default size tokens, and a documented `StairsIcon` gap-fill. Surface adoption (TopBar/Inspector/StatusBar/tool palette) still pending per A03/A05/A06/C01.                                                                                                                                                                                                                           |
| Seed house fixture          | `partial` | 3 evidenced slice   | ~80%              | V2 fixture lands at `packages/cli/lib/seed-house-v2-commands.mjs` (`seed-` prefixed ids per §27.3) covering all §27.1 element classes and counts: 3 levels, 16 walls, 3 floors w/ cantilevered upper + terrace, pitched gable + flat-wing roof, 5 doors / 7 windows / 9 rooms, 3 railings, 2 section cuts, 2 plan views, 3 viewpoints, sheet A-101 + 5 schedules. V1 untouched (roundtrip regression intact). Visual + replay-determinism baselines deferred to WP-UI-H01. |
| Accessibility               | `pending` | 0 sketch            | ~10%              | `aria-*` is sparse; focus ring inconsistent; no live-region; canvas tools are pointer-only.                                                                                                                                                                                                                                                                                                                                                                                |
| Motion                      | `pending` | 0 sketch            | ~5%               | No documented motion grammar.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Onboarding / empty states   | `partial` | 1 token / primitive | ~30%              | `Welcome` panel exists; canvas has no "empty / press W to draw a wall" state.                                                                                                                                                                                                                                                                                                                                                                                              |

---

## 6. Recent Sprint Ledger

| Source                                                       | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Tracker effect                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WP-UI-A12 View tabs (Revit-style)** (`main`)               | Added the §11.3 view-tabs feature so multiple open views can coexist. `packages/web/src/workspace/tabsModel.ts` is a pure reducer (`openTab`, `closeTab`, `activateTab`, `cycleActive`, `activateOrOpenKind`, `tabFromElement`) covering kinds plan / 3d / plan-3d / section / sheet / schedule / agent — tab id is `${kind}:${targetId}` so re-opening the same view activates the existing tab. `workspace/TabBar.tsx` renders the strip below TopBar with kind icon + truncated label + close ✕ (active tab = `--color-background` + 2 px `--color-accent` bottom indicator), trailing `+` opens a popover of `+ Plan / + 3D / …`. `RedesignedWorkspace.tsx` wires Project Browser row activation → `openTab`, mode-pill click → activate-or-create-tab-of-kind, `Ctrl/⌘+Tab` (forward) / `Ctrl/⌘+Shift+Tab` (backward) / `Ctrl/⌘+W` (close active) hotkeys, and a default Plan tab opens automatically on the first level once the seed loads. AppShell's topbar grid row switched from `var(--shell-topbar-height)` to `auto` so the topbar slot grows with the TabBar (~84 px). 10-test reducer suite + 5-test TabBar UI suite. Validation: web typecheck clean; src vitest 1094 tests pass. | WP-UI-A12 → `partial` (~65%) maturity 3 evidenced slice (new row in §28). Closes V15 from §32. Drag-reorder + localStorage persistence are explicitly deferred to a follow-up. |
| **Visual-fidelity gap audit (post-route-flip)** (`main`)     | Surfaced from a user-driven walkthrough at `/`: even though every WP-UI-* row is `partial` and the Phase A→F closure landed, the running app still has fourteen visible polish gaps (§32). High-impact items: the canvas wrappers in `Viewport.tsx` (line 1012) and `PlanCanvas.tsx` (line 710) cap the canvas to 740 px tall with rounded chrome-borders inside the AppShell; the empty-state CTA button declared by the `canvas-empty` pattern (`state/uiStates.ts`) is documented but not rendered; the ViewCube is a 2D face-cross + flat iso-button list rather than an interactive 3D cube widget; Three.js material rebuilds are not wired to the theme-toggle signal, so canvas paints do not refresh with the chrome; the empty-state copy refers to a "Project menu" that does not exist on the redesigned chrome. Added `packages/design-tokens/src/conservative/{conservative,tokens-conservative}.css` (borrowed from `~/repos/hof-os`) as a preview design system + `packages/web/src/design-systems/conservative.css` so engineers can A/B preview the slate / navy / serif palette via `VITE_DESIGN_SYSTEM=conservative`. `vite.config.ts` now actually routes that env var (was a no-op previously). | Surfaces §32 (fourteen V01–V14 gaps) into the spec ledger. WP-UI rows already `partial` stay `partial` — the gap list pushes them toward §4's done rule. Conservative preset is a non-destructive add — default chrome is unchanged. |
| **Phase A→F adoption sweep closure** (`main`)                | Closed the eleven §4 done-rule gaps surfaced after the route flip. (A1) `Viewport.tsx` consumes the §15.4–§15.7 modules — `createCameraRig()` replaces the inline spherical rig, `resolveViewportPaintBundle()` drives all material colors / lights / selection edges via `liveTokenReader` (theme switches now repaint the 3D scene), `ViewCube` overlay top-right tracks live azimuth, walk-mode + section-box toggles bottom-left flip the WP-UI-B05 / B08 controllers. (A3) `PlanCanvas.tsx` + `plan/symbology.ts` paint exclusively from `--draft-*` / `--cat-*` tokens; ~32 inline hex literals collapsed into a 25-role `PlanPalette` factory. (A4) Walk + section-box toggles surface the controllers in the chrome (was state-only). (B4) `workspace/InspectorContent.tsx` ships discriminated-union renderers for every Element kind (`InspectorPropertiesFor` / `InspectorConstraintsFor` / `InspectorIdentityFor`) — RedesignedWorkspace tabs now show real per-kind properties instead of placeholder copy. (B5) `cmd/CheatsheetModal.tsx` opens on `?` with a section list + filter input + Esc close. (B6) `cmd/RedesignedCommandPalette.tsx` is a cmdk-driven §18 modal (560 px, parseQuery + rankCandidates, Esc close, jsdom polyfills for ResizeObserver / scrollIntoView). (B7) `onboarding/OnboardingTour.tsx` is the §24 5-step popover with 4-rectangle spotlight dim and Esc/Enter/Arrow keyboard model. (C8) `workspace/ModeShells.tsx` owns SectionModeShell / SheetModeShell / ScheduleModeShell / AgentReviewModeShell — RedesignedWorkspace `CanvasMount` routes by mode. (D9) Reduced-motion sweep — `--motion-*` tokens collapse via `@media (prefers-reduced-motion: reduce)`. (D10) `design-systems/contrast.ts` + 17-test vitest verify documented WCAG AA token pairs (4 light, 3 dark) above 4.5 / 3.0 thresholds; `parseColor` handles `#hex` / `rgb()` / `hsl()` / `color-mix(...)` with paren-depth tracking. (E11) Playwright baselines captured: 7 PNGs in `e2e/__screenshots__/ui-redesign-baselines.spec.ts/darwin/` (app-shell light + dark, top-bar, left-rail, right-rail-empty, status-bar, tool-palette); the spec runs against `/` after the route flip and is stable across reruns. (F12) Legacy `/legacy` chrome gains a "← redesigned" topbar link so users at the legacy fallback have an obvious return path; `Workspace.tsx` consolidation lands as: redesigned shell at `/`, legacy escape hatch at `/legacy` with explicit return path. Validation: web typecheck clean; src vitest 1079 tests pass; full `app/scripts/ci-gate-all.sh` six-gate suite green; 7 Playwright baselines stable. | All eleven done-rule gaps closed. WP-UI-A01 / A02 / A03 / A04 / A05 / A06 / A07 / B01 / B02 / B03 / B04 / B05 / B07 / B08 / C01 / C02-C12 / D03 / D08 / E02 / E07 / F01 / G01 / H01 each gain another evidenced slice (modal renderers + token-driven paint + visual baselines). Phase A→F closure recorded — no remaining gaps from the plan. |
| **Adoption sweep — `/redesign` route** (`main`)              | Authored `packages/web/src/workspace/RedesignedWorkspace.tsx` as the composition route for the §11–§17 chrome. Mounts AppShell + TopBar + LeftRail (with Project Browser sections derived live from `useBimStore` — Levels / Floor Plans / 3D Views / Sections / Sheets / Schedules) + Inspector (empty-state quick actions; `Sparkles` icon for Agent) + StatusBar (level switcher, tool readout, `Magnet` snap glyph, `Grid3x3` toggle, mono cursor coords from `planHudMm`, `aria-live` ws/save pills) + ToolPalette (plan-mode active tool routed to `setPlanTool`; unknown tools held as preview). Canvas slot reuses existing `<Viewport>` and `<PlanCanvas>`; Plan+3D mode renders both side-by-side. Global `1`–`7` mode hotkeys (via `modeForHotkey`), `?` (cheatsheet toggle), `⌘K` (palette toggle), and tool letter hotkeys (V / W / D / M etc.) wired through the spec'd `TOOL_REGISTRY`. Theme toggle round-trips through `state/theme.ts`. Empty-state overlay uses §25 `canvas-empty` pattern with `aria-live="polite"`. Added a "Try redesign →" link in `Workspace.tsx` topbar so the new route is discoverable; mounted at `/redesign` via `App.tsx`. Updated `e2e/ui-redesign-baselines.spec.ts` to point the Playwright runner at `/redesign` and removed the `test.fixme` placeholders (real screenshots ship via `pnpm exec playwright test --update-snapshots`). 4-test vitest smoke covers slot wiring, canvas root, empty-state overlay, tool palette presence; uses `vi.mock` to stub WebGL-dependent canvas components. Also fixed the §30 vitest+e2e collision by scoping `app/scripts/ci-gate-all.sh` vitest gate to `src`. Validation: web typecheck clean; src vitest 1033 tests pass; CI gate suite all six green. | Adopts WP-UI-A07 / A03 / A04 / A05 / A06 / C01 / D03 inside a non-destructive route (legacy `/` Workspace untouched). All seven chrome WPs gain real surface-level evidence; Workspace.tsx adoption proper deferred to a follow-up consolidation. |
| **WP-UI-H01 Playwright visual regression baseline** (`main`) | Authored `packages/web/src/design-systems/visualRegressionBaselines.ts` as the canonical manifest of every chrome surface that needs a `toHaveScreenshot` baseline (§8 / §11 / §12 / §13 / §14 / §15 / §16 / §17, light + dark for the shell, viewport sizes per §8). `packages/web/e2e/ui-redesign-baselines.spec.ts` wires the Playwright runner with one `test.fixme` placeholder per surface — the fixme flag holds the harness in place until each surface lands inside `Workspace.tsx` (post-Phase adoption sweep). 4-test vitest covers manifest section coverage, viewport invariants, dual-theme app-shell entries, unknown-id lookup. Validation: web typecheck clean; src vitest 1029 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | WP-UI-H01 → `partial` (~50%) maturity 2 composed slice. UX dashboard "Visual regression" not present (introduced by this WP).                                                                                                                     |
| **WP-UI-C02–C12 Per-tool grammar** (`main`)                  | Authored `packages/web/src/tools/toolGrammar.ts` covering all 11 per-tool grammars (§16.4 + §16.5) as pure-state controllers. Wall (C02): `WALL_LOCATION_LINE_ORDER` + `cycleWallLocationLine` + `reduceWallChain` reducer for chain mode. Door (C03) / Window (C04): defaults + `flipDoorSwing` / `flipDoorHand`. Floor (C05): `FloorState` + `toggleFloorMode` for pick-walls vs sketch. Roof (C06): `RoofState` + `toggleEdgeSlope` for per-edge slope. Stair (C07): `computeStairRun` auto-computing risers/treads from level delta. Railing (C08): `RAILING_DEFAULTS` (horizontal-bars-5×30 / 1100 mm). Room marker (C09): `centroidMm` (signed-area centroid with degenerate fallback). Dimension (C10): `DIMENSION_HOTKEYS` + `setDimensionKind` covering linear/aligned/angular/radial/diameter. Section (C11): `SectionDraftState` + `flipSectionDepth`. Tag (C12): `TAG_FAMILIES` (5 spec'd families). 24-test vitest covers each grammar. Validation: web typecheck clean; src vitest 943 tests pass. Single commit because all 11 specs share one state module; spec table records each WP individually.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | WP-UI-C02→C12 each → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "Tool palette" row +5% (cumulative).                                                                                                                               |
| **WP-UI-C01 Tool palette** (`main`)                          | Authored `packages/web/src/tools/toolRegistry.ts` (single source of truth for §16.1 tool ordering, hotkeys, lucide icons via the `IconName` registry, per-mode visibility, `isToolDisabled` enablement gating Floor / Roof / Railing / Dimension on prerequisite elements) and `tools/ToolPalette.tsx` (top-floating `role="toolbar"`, ArrowLeft/Right cycling, `aria-pressed`, hotkey superscript, dim-disabled with reason tooltip, trailing `Tag ▾` routed via `onTagSubmenu`). 8-test vitest covers plan-mode roster, schedule-mode shrink, render, active state, click + cycling, disabled floor + reason, Tag submenu dispatch. Validation: web typecheck clean; src vitest 919 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | WP-UI-C01 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "Tool palette" row +65%.                                                                                                                                                    |
| **WP-UI-B03 2D plan zoom/pan/level/empty state** (`main`)    | Extended `packages/web/src/plan/planCanvasState.ts` with `PlanCamera`: `wheelZoom(delta, anchor)` (anchor-toward-cursor zoom), `panMm(dx, dy)`, `fit(bbox, padding)` clamped 1:5–1:5000, `cycleLevel('up'\|'down')` for §14.6 PageUp/Down with wrap, `emptyStateMessage()` matching §14.7 copy. 6 added vitest assertions cover bound clamping, pan offset, fit centering, level cycling wrap, empty-state text, anchor-zoom shift. Validation: web typecheck clean; src vitest 911 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | WP-UI-B03 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "2D Plan canvas" row +5%.                                                                                                                                                   |
| **WP-UI-B02 2D plan pointer + snap grammar** (`main`)        | Extended `packages/web/src/plan/planCanvasState.ts` with `SnapEngine` (toggle / setOn / cycleExclusive / resolve / pillLabel; defaults match §14.4 spec table — endpoint/midpoint/intersection/perpendicular/parallel/nearest/grid/polar on, tangent off) and `classifyPointerStart(event)` mapping the §14.3 pointer grammar to `pan / marquee-window / marquee-crossing / drag-move / add-to-selection / toggle-selection / draw / idle`. 14 added vitest assertions cover defaults, toggle, exclusive cycle, priority resolve, disabled-mode skip, pill label render, all 8 pointer-classifier branches. Validation: web typecheck clean; src vitest 905 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | WP-UI-B02 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "2D Plan canvas" row +5%.                                                                                                                                                   |
| **WP-UI-B01 2D plan drafting visuals** (`main`)              | Seeded `packages/web/src/plan/planCanvasState.ts` with `draftingPaintFor(plotScale)` returning `{ paperToken, grid visibility, visible hatches, lineWidthPx(role) }` so PlanCanvas / symbology can rebuild paint sets per scale change. Backed by `draftingStandards.ts` (G01). 5-test vitest covers fine-scale grid, coarse-scale hide, hatch visibility, lineWidthPx scaling, paper-token. Validation: web typecheck clean; src vitest 896 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | WP-UI-B01 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "2D Plan canvas" row +5%.                                                                                                                                                   |
| **WP-UI-G01 Drafting standards** (`main`)                    | Authored `packages/web/src/plan/draftingStandards.ts` as the single source of truth for §9.10 + §26: `LINE_WEIGHT_PX_AT_1_50` mirrors the spec table; `lineWidthPxFor(token, plotScale)` rescales line weights relative to the 1:50 reference; `CATEGORY_LINE_RULES` maps spec roles (wall.cut, door.cut, window.cut, floor.projection, roof.projection, stair.tread, stair.direction, hidden, dimension.witness, construction) to `{ weight, color, dash, opacity }`; `dashArray` serialises to SVG `stroke-dasharray` proportional to width; `HATCH_SPECS` covers wall.concrete (45° / 1 mm), floor.timber (0° / 0.7 mm), site.lawn (90° / 1.5 mm) with `hatchVisibleAt` gating ≥1:200; `gridVisibilityFor` mirrors §14.5 (major + minor grid step rule). 16-test vitest covers reference passthrough, rescaling at 1:200 / 1:5, every role, dashed + dash-dot patterns, opacity rule, hatch visibility ceiling, grid step rule, and full LW table values. Validation: web typecheck clean; src vitest 891 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | WP-UI-G01 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "2D Plan canvas" row +5%.                                                                                                                                                   |
| **WP-UI-B08 3D viewport section box & clipping** (`main`)    | Authored `packages/web/src/viewport/sectionBox.ts` as a framework-free section-box controller per §15.6. `SectionBox.toggle/setActive`, `dragHandle('x-min'\|...\|'z-max', delta)` clamped by 0.1 m epsilon against the opposite face, `setBox(min, max)` normalizes swapped inputs, `clippingPlanes()` returns six inward `{ normal, constant }` planes for `Material.clippingPlanes`, `contains(point)` for world-space membership, `summary()` produces the spec'd readout (`Section box: 12.0 m × 8.4 m × 6.5 m`). 9-test vitest covers default extents, toggle, handle clamp invariants, summary, plane count + axis pairing, contains gating, inactive-passthrough, normalized setBox. Validation: web typecheck clean; src vitest 875 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | WP-UI-B08 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "3D Viewport" row +5%.                                                                                                                                                      |
| **WP-UI-B05 3D viewport walk mode** (`main`)                 | Authored `packages/web/src/viewport/walkMode.ts` as a framework-free walk-mode controller per §15.3. `WalkController.setActive`, `setKey(key, pressed)`, `setRunning(bool)`, `mouseLook(dx, dy)` (yaw + clamped pitch), `update(dt)` integrates ground-plane translation against the active key set with `walkSpeed × runMultiplier` (Shift). `classifyKey()` covers WASD + arrow keys + QE. 12-test vitest covers idle gating, WASD forward/strafe vectors, vertical motion, run multiplier, pitch clamp, mouseLook gating-on-active, viewDirection accuracy, and active-toggle key clearing. Validation: web typecheck clean; src vitest 866 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | WP-UI-B05 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "3D Viewport" row +5%.                                                                                                                                                      |
| **WP-UI-B07 3D viewport materials & lighting** (`main`)      | Authored `packages/web/src/viewport/materials.ts` to expose the §15.5 paint contract decoupled from Three.js. `resolveCategoryMaterial(cat)` reads `--cat-*` via `liveTokenReader` (computedStyle on `:root`) and returns `{ color, roughness 0.85, metalness 0, aoIntensity 0.4 }` (falls back to documented light values when the token is absent). `resolveLighting()` returns the sun (`#fff8ec`, 35° elevation, 2048² shadow) + hemi (`#d3e2ff` sky / `#d8d3c4` ground) constants; `resolveSelection()` reads `--color-accent` + `--draft-hover` for the EdgesGeometry overlay (2 px / 1 px). `resolveViewportPaintBundle` bundles the three for theme-switch rebuilds. Tests inject a fake `TokenReader` (10 assertions: every category, fallback path, override defaults, lighting constants, selection token reads + fallback, bundle aggregator). Validation: web typecheck clean; src vitest 854 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | WP-UI-B07 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "3D Viewport" row +5%.                                                                                                                                                      |
| **WP-UI-B06 3D viewport ViewCube** (`main`)                  | Authored `packages/web/src/viewport/viewCubeAlignment.ts` as the §15.4 numerical contract — `alignmentForPick(pick)` resolves face / edge / corner / `home` picks to `{ azimuth, elevation, up }` (TOP/BOTTOM use Z-up; corners use `atan(1/√2)`-elevation isos; edges split into vertical tilts + face-diagonal azimuths) and `compassLabelFromAzimuth` buckets azimuth into N/E/S/W. `viewport/ViewCube.tsx` is the widget: 6-face cross of pickable buttons, dedicated home button (`Icons.viewCubeReset`), compass pill underneath, corner-iso row, spec'd tooltip ("Click face to align camera; drag to orbit; double-click for default view."). Renamed `viewCube.ts → viewCubeAlignment.ts` to dodge a macOS case-insensitive collision with the `.tsx` widget file. 13-test math vitest + 5-test component vitest. Validation: web typecheck clean; src vitest 845 pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | WP-UI-B06 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "3D Viewport" row +10%.                                                                                                                                                     |
| **WP-UI-B04 3D viewport orbit/pan/dolly** (`main`)           | Authored `packages/web/src/viewport/cameraRig.ts` as a framework-free spherical-coordinate rig with the §15.3 grammar: `orbit(dx, dy)` (clamped elevation), `pan(dx, dy)` (target moves along the screen-space basis derived from view × up), `dolly(delta)` (clamped radius), `zoomBy(factor)`, `frame(box, fitFactor)`, `reset()` + `setHome()`, `applyViewpoint(position, target, up)` (recovers radius/azimuth/elevation from a saved camera). Pointer / hotkey classifiers expose `classifyPointer` (Alt+LMB or MMB orbit, Shift+MMB pan), `wheelDelta` (pinch dampening when ctrl/meta held), and `classifyHotkey` (`F` frame-all, `⌘F` frame-selection, `H` / `Home` reset, `⌘=` / `⌘-` zoom). 21-test vitest covers spherical placement, orbit clamping, dolly + zoom limits, pan basis math, frame, reset/home, applyViewpoint round-trip, pointer + wheel + hotkey classification. Validation: web typecheck clean; src vitest 826 tests pass. Viewport.tsx adoption (replacing the in-line rig) deferred to the post-Phase-4 sweep.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | WP-UI-B04 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "3D Viewport" row +10%.                                                                                                                                                     |
| **WP-UI-A06 App shell StatusBar** (`main`)                   | Authored `packages/web/src/workspace/StatusBar.tsx` for §17. Clusters L→R: active level switcher (popover w/ PageUp/Down cycling and Escape), tool readout, snap-mode group (`Magnet` glyph + `role="switch"` per snap), grid switch (Grid3x3 icon + ON/OFF), monospace cursor coordinates with `aria-live="polite"`, undo cluster (Undo/Redo buttons + depth counter), ws state pill (CircleDot tinted `--color-success/warning/danger`, `aria-live="assertive"` when offline), save state pill (`aria-live="assertive"` on `error`). 9-test vitest covers cluster render, level popover + PageUp/Down cycling, snap toggle dispatch, grid toggle, ws/save assertive aria-live, undo/redo dispatch, off-canvas cursor placeholder. Validation: web typecheck clean; src vitest 805 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | WP-UI-A06 → `partial` (~75%) maturity 3 evidenced slice. UX dashboard "Status bar" row +65%.                                                                                                                                                      |
| **WP-UI-A05 Right rail Inspector** (`main`)                  | Authored `packages/web/src/workspace/Inspector.tsx` as the §13 redesigned right rail. Header (icon + element type + mono id + close button), `role="tablist"` with Properties / Constraints / Identity tabs (ArrowLeft/Right cycling), tab body slot props for caller-supplied content, sticky Apply (⏎) / Reset (Esc) footer that only appears when `dirty=true`, empty-state quick-actions block. `evaluateExpression()` exposes the §13.3 numeric grammar (`+`, `-`, `*`, `/`, parens) sandboxed via a strict regex; `<NumericField>` is a primitive that combines mm-canonical state with a click-to-cycle `mm`/`cm`/`m` unit chip and surfaces invalid expressions through `aria-invalid`. 12 vitest assertions cover empty-state quick actions, header + tabs render, click + keyboard tab switching, dirty-state footer, close button, evaluator happy + reject paths, NumericField unit cycling + commit-on-blur + invalid path. Validation: web typecheck clean; vitest test 12/12 pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | WP-UI-A05 → `partial` (~75%) maturity 3 evidenced slice. UX dashboard "Inspector" row +35%.                                                                                                                                                       |
| **WP-UI-A04 Left rail Project Browser** (`main`)             | Authored `packages/web/src/workspace/LeftRail.tsx` as the §12 redesigned project browser: sticky search field on top with `Search` lucide adornment, uppercase eyebrow section headers (`--text-eyebrow-tracking` letter-spacing), `role="tree"` with `treeitem` rows (`aria-level`, `aria-expanded`, `aria-selected`, roving `tabIndex`), disclosure chevrons on parents, keyboard model: ArrowDown/Up cycle focus, ArrowRight expands a closed parent or moves into children, ArrowLeft collapses or moves to parent, Enter activates, F2 dispatches `onRowRename`. Search filter matches label / id / hint and auto-expands matching subtrees so hits are visible. `LeftRailCollapsed` is the 56 px icon strip variant for AppShell collapsed mode. Existing `ProjectBrowser.tsx` (engineering readouts) untouched; adoption inside Workspace.tsx defers to the post-Phase-3 sweep. 7-test vitest covers section render, expand-on-click, active state w/ aria-selected, click + F2 dispatch, multi-arrow navigation + Enter, search filter behaviour, collapsed-strip aria-labels. Validation: web typecheck clean; src vitest 784 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | WP-UI-A04 → `partial` (~75%) maturity 3 evidenced slice. UX dashboard "Project Browser" row +35%.                                                                                                                                                 |
| **WP-UI-A03 App shell TopBar** (`main`)                      | Authored `packages/web/src/workspace/TopBar.tsx` rendering the §11 anatomy from `@bim-ai/ui` icons: left region (hamburger + accent BA logo tile + project-name disclosure button), center mode-pill `role="tablist"` with 7 spec'd modes (Plan / 3D / Plan+3D / Section / Sheet / Schedule / Agent), wrapping `ArrowLeft`/`ArrowRight` cycling, `aria-selected`/`tabIndex`/`aria-keyshortcuts` per pill, right region (⌘K command palette button, collaborators icon w/ badge, settings, theme toggle that swaps Sun↔Moon by `theme` prop, avatar tile). `WORKSPACE_MODES` constant is the canonical mode + hotkey table for downstream WP-UI-D03 wiring. 8-test vitest covers tab roster, active state, click handler, ArrowLeft/Right cycling (with wrap), theme-icon swap, project-name click, badge rendering, ⌘K click. Validation: web typecheck clean; src vitest 777 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | WP-UI-A03 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "App shell" row +20%.                                                                                                                                                       |
| **WP-UI-F01 Seed house V2 fixture** (`main`)                 | Authored `packages/cli/lib/seed-house-v2-commands.mjs` exporting `buildSeedHouseV2Commands()` with `seed-` prefixed ids (§27.3). Element counts match §27.1: 3 levels (Ground 0 / Upper 3000 / Roof Apex 5800), 1 site pad, 16 walls (6 ext-EG L-shape + 4 int-EG + 4 ext-OG set back 1 m on south + 2 gable cladded), 3 floors (EG slab L-shape, OG slab w/ south cantilever, terrace at -50 mm), 1 roof (35° gable + flat over wing), 5 doors (utility entry, terrace double, WC, spine, utility), 7 windows (FTH living, bath, utility, 4 OG punched), 1 stair (17 × 176 mm) + slab opening shaft, 3 railings (stair / balcony / terrace), 9 rooms, 2 section cuts (A–A, B–B), 2 plan views, 3 viewpoints (Default Orbit / NE-Iso / balcony worm's-eye), sheet A-101 with 4 viewports + titleblock, 5 schedules (Door / Window / Room / Wall types / Material take-off). Added `app/tests/test_seed_house_v2_bundle.py` (6 assertions: prefix discipline, kind coverage, exact counts, level elevations, sheet viewports cardinality, default-orbit viewpoint id). V1 fixture untouched; existing roundtrip test (`test_one_family_bundle_roundtrip.py`) still passes. Validation: pytest+ruff clean; existing src vitest unaffected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | WP-UI-F01 → `partial` (~80%) maturity 3 evidenced slice. UX dashboard "Seed house" row +30%.                                                                                                                                                      |
| **WP-UI-A07 App shell layout grid + breakpoints** (`main`)   | Authored `packages/web/src/workspace/AppShell.tsx` as the canonical 5-zone CSS grid (topbar / leftRail / canvas / rightRail / statusBar) sized from `--shell-*` tokens; `[` / `]` toggle the rail collapsed-vs-icon state, ignoring keys while the user is typing in inputs/textareas/selects/contenteditable. Slot props (`topBar`, `leftRail`, `leftRailCollapsed`, `canvas`, `rightRail`, `statusBar`) keep AppShell pure layout; surface composition stays with TopBar/Inspector/StatusBar WPs. Added `AppShell.test.tsx` (7 assertions) covering slot rendering, grid template, hotkey toggling, input-focus exclusion, and seeded defaults. Validation: web typecheck clean; src vitest 769 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | WP-UI-A07 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "App shell" row +15%.                                                                                                                                                       |
| **WP-UI-A08 Theming (light primary; dark)** (`main`)         | Authored `packages/web/src/state/theme.ts` as the canonical theme controller per §23. Light is the default; dark activates via `data-theme="dark"` (and the legacy `.dark` class for back-compat). Resolution priority: `#theme=…` URL hash → `localStorage["bim.theme"]` → `prefers-color-scheme`. `applyTheme(theme)` writes to all three; `toggleTheme()` flips and returns the new value; `initTheme()` is the idempotent boot hook; `prefersReducedMotion()` exposes the §21 motion override. `state/store.ts` re-exports the public surface so existing call-sites (`main.tsx`, `Workspace.tsx`) work unchanged. Added `state/theme.test.ts` (12 assertions) covering cascade priority, idempotent boot, hash + storage round-trip, and reduced-motion media query. Validation: web typecheck clean; src vitest 762 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | WP-UI-A08 → `partial` (~80%) maturity 3 evidenced slice. UX dashboard "Theming" row +20%.                                                                                                                                                         |
| **WP-UI-A02 Iconography (lucide-react)** (`main`)            | Authored `packages/ui/src/icons.tsx` as the single chrome icon registry: `Icons` map covers every §10.1 concept (select, wall, door, window, floor, roof, stair, railing, room, dimension, section, sheet, schedule, family, saveViewpoint, layer toggle, viewCubeReset, undo/redo, themeLight/Dark, commandPalette, search, settings, hamburger, collaborators, close, externalLink, proportional, disclosureClosed/Open, agent, evidence, advisorWarning, online, snap, grid, tag), `IconLabels` provides defaults for `aria-label` (§22), `ICON_SIZE` exposes the §10 size scale (chrome 16 / toolPalette 18 / topbar 20). Lucide gap-fill: `StairsIcon` is a documented custom SVG (`stairs` is missing from lucide-react@0.574); Wall maps to `BrickWall` with `Slash` exposed as alt. Re-exported from `@bim-ai/ui`. Added `packages/web/src/design-systems/icons.test.tsx` (108 assertions) asserting registry exposure, label coverage, SVG render, and StairsIcon size/stroke contract. Validation: ui + web typecheck clean; design-systems suite 216 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | WP-UI-A02 → `partial` (~75%) maturity 3 evidenced slice. UX dashboard "Iconography" row +60%.                                                                                                                                                     |
| **WP-UI-A01 Design token foundation** (`main`)               | Authored §9 tokens as the canonical source under `packages/design-tokens/src/tokens-default.css` (light chrome, spacing, radius, typography, elevation, motion + shell sizing), `tokens-dark.css` (dark chrome overrides + flattened elevation), and `tokens-drafting.css` (canvas-only drafting palette §9.2, element categories §9.3, line weights §9.10 — both themes). Extended `tailwind-preset.ts` to expose semantic chrome / drafting / category colors, fontSize, spacing, radius, boxShadow (`elev-*`), motion durations + easings, shell sizing, and `shell-md`/`shell-lg`/`reduce-motion` variants. Added `packages/web/src/design-systems/tokens.test.ts` (108 assertions) verifying every spec'd token name lands in default + dark + drafting; web `default.css` now imports the three canonical files via `@bim-ai/design-tokens/*`; orphaned `packages/web/src/design-systems/tokens-default.css` removed; `@types/node` added to web devDeps so test-side fs reads typecheck cleanly. Validation: web typecheck clean; `pnpm test` 642 tests pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | WP-UI-A01 → `partial` (~80%) maturity 3 evidenced slice. UX dashboard "Theming" row +25%.                                                                                                                                                         |
| **Spec authored** (date: 2026-05-05)                         | This document. No code change. Defines `WP-UI-*` rows below as the redesign's source of truth and records explicit deferrals to UX-V2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Establishes UI redesign baseline; no engineering parity rows changed.                                                                                                                                                                             |

---

## 7. Information architecture

The application is a single-document workspace (one BIM project at a time). All views are surfaces over the same `Document`. We model six modes; the user chooses one at the top of the workspace.

| Mode                    | Purpose                                                 | Primary canvas         | Secondary panes                                  |
| ----------------------- | ------------------------------------------------------- | ---------------------- | ------------------------------------------------ |
| **Plan**                | 2D plan authoring, dimensioning, room layout            | 2D plan canvas         | Project Browser, Inspector, Status bar           |
| **3D**                  | 3D model navigation, saved viewpoints, sectioning       | 3D viewport            | Project Browser, Inspector, ViewCube, Status bar |
| **Plan + 3D**           | Side-by-side, default for active design                 | split canvas           | Project Browser, Inspector, ViewCube, Status bar |
| **Section / Elevation** | Section line authoring, section view editing            | Plan + section preview | Project Browser, Inspector                       |
| **Sheet**               | Sheet composition: viewports onto a titleblock          | Sheet canvas           | Sheet thumbnails, Inspector, Titleblock fields   |
| **Schedule**            | Tabular element data, filters, exports                  | Schedule table         | Schedule registry, Inspector (column / filter)   |
| **Agent Review**        | Evidence inspection, advisor review, regenerate-on-diff | Evidence panel         | Manifest tree, action queue                      |

A user can switch mode in three ways:

- click the mode pill in the top center,
- press `1`–`6` (number keys) for direct mode jump,
- open the command palette and type the mode name.

Modes do not destroy state — switching back returns to the prior tool, selection, zoom, and camera.

---

## 8. App shell layout grid

All measurements are at 1440-wide reference; layout is fluid, but breakpoints fix the grid template.

```
+-------------------------------------------------------------------------------+
| TopBar ......................................................... 48 px high  |
+-------+------------------------------------------------------+----------------+
|       |                                                      |                |
|   L   |               Canvas region (mode-specific)          |       R        |
|   e   |                                                      |       i        |
|   f   |                                                      |       g        |
|   t   |                                                      |       h        |
|       |                                                      |       t        |
|   R   |                                                      |                |
|   a   |                                                      |       R        |
|   i   |                                                      |       a        |
|   l   |                                                      |       i        |
|       |                                                      |       l        |
| 256px |                                                      |     320px      |
+-------+------------------------------------------------------+----------------+
| StatusBar ...................................................... 28 px high  |
+-------------------------------------------------------------------------------+
```

### Breakpoints

| Breakpoint   | Left rail         | Right rail   | Top bar height | Notes                                                        |
| ------------ | ----------------- | ------------ | -------------- | ------------------------------------------------------------ |
| `>= 1600 px` | 256 px            | 320 px       | 48 px          | Both rails always docked.                                    |
| `1280–1599`  | 240 px            | 300 px       | 48 px          | Both rails docked, slightly slimmer.                         |
| `1024–1279`  | 56 px (icon-only) | 300 px       | 48 px          | Left rail collapses to icons; expand on hover or `[`.        |
| `< 1024`     | overlay           | overlay      | 48 px          | Both rails become overlays toggled by hamburger / `[` / `]`. |
| Mobile       | overlay           | bottom-sheet | 48 px          | Canvas-only by default; inspector becomes a bottom sheet.    |

### Canvas region

In `Plan + 3D` mode the canvas region splits 50/50 with a draggable vertical divider. The divider snaps to 33/50/67% with a soft tick. `[` collapses the left half, `]` collapses the right.

### Layering / z-index

| Layer                        | z-index | Notes                                     |
| ---------------------------- | ------- | ----------------------------------------- |
| Canvas                       | 0       | Base.                                     |
| Floating tool palette        | 10      | Top-center floating bar in canvas region. |
| ViewCube                     | 10      | Top-right of 3D canvas region.            |
| Selection marquee / gizmos   | 15      | Above canvas, below palette.              |
| Hover tooltips               | 20      |                                           |
| Snap-tracking pill           | 25      | Follows cursor with `2 px` offset.        |
| Multiplayer cursors          | 30      |                                           |
| Top bar                      | 40      |                                           |
| Side rails                   | 40      |                                           |
| Status bar                   | 40      |                                           |
| Popovers (menus, datepicker) | 50      |                                           |
| Command palette              | 60      |                                           |
| Modal sheets                 | 70      |                                           |
| Toasts / notifications       | 80      | Bottom-right, above status bar.           |

---

## 9. Design token system

Tokens live at `packages/design-tokens/src/tokens-default.css` (light, default), `tokens-dark.css` (dark override), and `tokens-drafting.css` (canvas-only, never on chrome). Tailwind preset at `packages/design-tokens/src/tailwind-preset.ts` exposes them as utility classes. **All tokens use semantic names. No tokens are named after a color literal.**

The token model mirrors `~/repos/hof-os/packages/hof-components/data-app/ui/design-systems/tokens-default.css` in structure, then extends it with BIM-specific tokens.

### 9.1 Color — semantic (chrome)

| Token                       | Light value (target)                | Dark value (target)        | Role                                                |
| --------------------------- | ----------------------------------- | -------------------------- | --------------------------------------------------- |
| `--color-background`        | `hsl(0 0% 100%)`                    | `hsl(220 14% 10%)`         | Page background, the "paper".                       |
| `--color-foreground`        | `hsl(220 18% 14%)`                  | `hsl(220 14% 92%)`         | Body text.                                          |
| `--color-surface`           | `hsl(220 16% 98%)`                  | `hsl(220 12% 13%)`         | Sidebars, cards, panels.                            |
| `--color-surface-strong`    | `hsl(220 16% 95%)`                  | `hsl(220 12% 16%)`         | Hovered surface, popover.                           |
| `--color-surface-muted`     | `hsl(220 16% 96%)`                  | `hsl(220 12% 12%)`         | Inactive surfaces, disabled fields.                 |
| `--color-border`            | `hsl(220 13% 90%)`                  | `hsl(220 10% 22%)`         | Hairline border default.                            |
| `--color-border-strong`     | `hsl(220 13% 80%)`                  | `hsl(220 10% 30%)`         | Active card outline, focus container.               |
| `--color-muted-foreground`  | `hsl(220 10% 44%)`                  | `hsl(220 10% 62%)`         | Secondary text, captions, units.                    |
| `--color-accent`            | `hsl(214 88% 50%)`                  | `hsl(213 95% 62%)`         | Primary brand / CTA / drafting selection.           |
| `--color-accent-foreground` | `hsl(0 0% 100%)`                    | `hsl(220 18% 14%)`         | Foreground when sitting on `--color-accent`.        |
| `--color-accent-soft`       | `color-mix(accent 12% bg)`          | `color-mix(accent 18% bg)` | Hover bg / selection chip / focus halo.             |
| `--color-success`           | `hsl(150 56% 38%)`                  | `hsl(148 50% 50%)`         | Validation pass, online status.                     |
| `--color-warning`           | `hsl(38 92% 50%)`                   | `hsl(40 90% 60%)`          | Stale evidence, advisor moderate.                   |
| `--color-danger`            | `hsl(0 72% 50%)`                    | `hsl(0 80% 62%)`           | Errors, destructive confirmation, advisor blocking. |
| `--color-info`              | `hsl(213 86% 56%)`                  | `hsl(213 92% 66%)`         | Hints, tips.                                        |
| `--color-ring`              | `color-mix(accent 38% transparent)` | same                       | Focus ring color.                                   |

### 9.2 Color — drafting (canvas only)

These tokens are only used inside `<canvas>` / SVG drafting contexts. They are not applied to chrome.

| Token                       | Light                      | Dark                  | Role                                                          |
| --------------------------- | -------------------------- | --------------------- | ------------------------------------------------------------- |
| `--draft-paper`             | `hsl(40 30% 99%)`          | `hsl(220 14% 12%)`    | Drawing surface fill.                                         |
| `--draft-grid-major`        | `hsl(220 12% 88%)`         | `hsl(220 10% 24%)`    | 1 m grid line.                                                |
| `--draft-grid-minor`        | `hsl(220 12% 95%)`         | `hsl(220 10% 18%)`    | 100 mm grid.                                                  |
| `--draft-construction-blue` | `hsl(213 80% 56%)`         | `hsl(213 95% 64%)`    | Construction lines, projection wires, snap guides.            |
| `--draft-witness`           | `hsl(213 30% 50%)`         | `hsl(213 30% 70%)`    | Witness lines for dimensions.                                 |
| `--draft-cut`               | `hsl(220 18% 14%)`         | `hsl(220 14% 92%)`    | Cut-line solid (1 m line weight in plan).                     |
| `--draft-projection`        | `hsl(220 12% 38%)`         | `hsl(220 12% 66%)`    | Above-cut / below-cut projection lines.                       |
| `--draft-hidden`            | `hsl(220 10% 60%)`         | `hsl(220 10% 50%)`    | Hidden lines (dashed).                                        |
| `--draft-selection`         | `var(--color-accent)`      | `var(--color-accent)` | Selected element outline.                                     |
| `--draft-hover`             | `color-mix(accent 60% bg)` | same                  | Hover halo on element under cursor.                           |
| `--draft-snap`              | `hsl(38 92% 50%)`          | `hsl(40 95% 62%)`     | Snap indicator color (orange — separate from selection blue). |

### 9.3 Color — element categories (3D + plan fill)

Each Revit-equivalent element class has a category color used in 3D as a flat accent and in plan as a fill swatch in legends. They are intentionally desaturated to read as architectural materials, not UI accents.

| Category | Token           | Light              | Dark               |
| -------- | --------------- | ------------------ | ------------------ |
| Wall     | `--cat-wall`    | `hsl(220 6% 60%)`  | `hsl(220 6% 50%)`  |
| Floor    | `--cat-floor`   | `hsl(36 18% 70%)`  | `hsl(36 14% 38%)`  |
| Roof     | `--cat-roof`    | `hsl(0 18% 40%)`   | `hsl(0 18% 50%)`   |
| Door     | `--cat-door`    | `hsl(28 30% 45%)`  | `hsl(28 30% 60%)`  |
| Window   | `--cat-window`  | `hsl(213 60% 70%)` | `hsl(213 60% 50%)` |
| Stair    | `--cat-stair`   | `hsl(220 6% 35%)`  | `hsl(220 6% 70%)`  |
| Railing  | `--cat-railing` | `hsl(220 6% 28%)`  | `hsl(220 6% 75%)`  |
| Room     | `--cat-room`    | `hsl(150 24% 86%)` | `hsl(150 18% 22%)` |
| Site     | `--cat-site`    | `hsl(80 20% 80%)`  | `hsl(80 14% 22%)`  |
| Section  | `--cat-section` | `hsl(0 70% 50%)`   | `hsl(0 80% 62%)`   |
| Sheet    | `--cat-sheet`   | `hsl(220 6% 80%)`  | `hsl(220 6% 30%)`  |

### 9.4 Spacing

Spacing is on an 4 px base. Always use a token, never a hard-coded value.

| Token        | px  | Use                          |
| ------------ | --- | ---------------------------- |
| `--space-0`  | 0   |                              |
| `--space-1`  | 2   | Hairlines, icon-to-text gap. |
| `--space-2`  | 4   | Tight icon padding.          |
| `--space-3`  | 6   | Inline gap.                  |
| `--space-4`  | 8   | Default inline gap.          |
| `--space-5`  | 12  | Card inner gap.              |
| `--space-6`  | 16  | Section gap.                 |
| `--space-7`  | 20  | Between groups.              |
| `--space-8`  | 24  | Card padding.                |
| `--space-10` | 32  | Major section break.         |
| `--space-12` | 40  | Page padding.                |

### 9.5 Radius

| Token           | px  | Use                             |
| --------------- | --- | ------------------------------- |
| `--radius-xs`   | 3   | Tag / pill / on-canvas chip.    |
| `--radius-sm`   | 4   | Inputs, small buttons.          |
| `--radius-md`   | 6   | Default for buttons / popovers. |
| `--radius-lg`   | 10  | Cards, panels.                  |
| `--radius-xl`   | 14  | Modals.                         |
| `--radius-pill` | 999 | Pills.                          |

### 9.6 Typography

Single sans family: Inter (variable, with `cv02 cv03 cv04 cv11` features). Mono: JetBrains Mono. No display font.

| Token            | Size / line-height | Weight | Use                                       |
| ---------------- | ------------------ | ------ | ----------------------------------------- |
| `--text-xs`      | 11 / 16            | 500    | Caption / status bar / unit hints.        |
| `--text-sm`      | 12.5 / 18          | 500    | Body small (panels, inspector).           |
| `--text-base`    | 14 / 20            | 500    | Body default.                             |
| `--text-md`      | 15 / 22            | 500    | Section headings.                         |
| `--text-lg`      | 17 / 24            | 600    | Panel titles.                             |
| `--text-xl`      | 20 / 28            | 600    | Page H1 (only on welcome / agent review). |
| `--text-mono-xs` | 11 / 16            | 500    | Coordinates, IDs, evidence digests.       |
| `--text-mono-sm` | 12 / 18            | 500    | Command bar input, schedule cells.        |

Letter-spacing: default `0`; uppercase chrome labels (UPPERCASE eyebrow text in section titles) get `0.04em`.

### 9.7 Elevation / shadow

| Token      | Value                                                                    | Use                              |
| ---------- | ------------------------------------------------------------------------ | -------------------------------- |
| `--elev-0` | none                                                                     | Default surfaces.                |
| `--elev-1` | `0 1px 2px hsl(220 18% 14% / 0.04), 0 1px 1px hsl(220 18% 14% / 0.04)`   | Hovered card.                    |
| `--elev-2` | `0 4px 8px hsl(220 18% 14% / 0.06), 0 2px 4px hsl(220 18% 14% / 0.04)`   | Floating tool palette, popovers. |
| `--elev-3` | `0 12px 24px hsl(220 18% 14% / 0.08), 0 4px 8px hsl(220 18% 14% / 0.06)` | Modals, command palette.         |

Shadows are intentionally subtle. Dark mode replaces shadow with a `1 px` outline at `--color-border-strong`.

### 9.8 Motion

| Token           | Value                            | Use                        |
| --------------- | -------------------------------- | -------------------------- |
| `--motion-fast` | 80 ms                            | Hover state, button press. |
| `--motion-base` | 140 ms                           | Panel slide / fade.        |
| `--motion-slow` | 240 ms                           | Mode switch transition.    |
| `--ease-out`    | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default.                   |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)`   | Reversible state changes.  |
| `--ease-snap`   | `cubic-bezier(0.7, 0, 0.3, 1)`   | Snap/grid magnet.          |

`@media (prefers-reduced-motion: reduce)` collapses every duration to `0 ms` and disables transforms.

### 9.9 Z-index — see §8.

### 9.10 Drafting line weights

| Token                         | mm at 1:50 | px target | Use                             |
| ----------------------------- | ---------- | --------- | ------------------------------- |
| `--draft-lw-cut-major`        | 0.50 mm    | 2.0       | Wall cut at active level.       |
| `--draft-lw-cut-minor`        | 0.35 mm    | 1.4       | Door / window cut.              |
| `--draft-lw-projection-major` | 0.25 mm    | 1.0       | Visible-above cut projection.   |
| `--draft-lw-projection-minor` | 0.18 mm    | 0.7       | Below cut projection.           |
| `--draft-lw-hidden`           | 0.18 mm    | 0.7       | Hidden line (dashed).           |
| `--draft-lw-witness`          | 0.13 mm    | 0.5       | Dimension witness line.         |
| `--draft-lw-construction`     | 0.13 mm    | 0.5       | Construction / snap-track line. |

Plot scale `1:50` is the design baseline. Other plot scales recompute these from mm via the canvas' DPI.

---

## 10. Iconography

| Rule                                                                                                     |
| -------------------------------------------------------------------------------------------------------- |
| All icons come from `lucide-react`. No custom inline SVG except canvas symbology and the app logo.       |
| Default icon size: `16 px` in dense chrome (rails, buttons), `18 px` in tool palette, `20 px` in TopBar. |
| Default stroke: `1.5`; selection-state stroke `2.0`.                                                     |
| Color: inherits `currentColor` (so theme tokens apply).                                                  |
| Padding inside a button: `space-2` between icon and label.                                               |

### 10.1 Icon assignments

| Concept             | lucide-react component         | Notes                                           |
| ------------------- | ------------------------------ | ----------------------------------------------- |
| Select / move       | `MousePointer2`                | `V`                                             |
| Wall                | `Slash` rotated 0°, or `Brick` | Use a custom `WallIcon` only if lucide gap.     |
| Door                | `DoorOpen`                     | `D`                                             |
| Window              | `RectangleHorizontal`          | `W`; combine with `Square` for muntins.         |
| Floor / slab        | `LayoutGrid`                   | `F`                                             |
| Roof                | `Triangle` (pointing up)       | `R`                                             |
| Stair               | `Stairs` (lucide has it)       | `S`                                             |
| Railing             | `GalleryVerticalEnd`           |                                                 |
| Room                | `Square`                       | `M` (room / measure ambiguity resolved by mode) |
| Dimension           | `Ruler`                        | `Shift+D` (avoid clash with Door)               |
| Section / elevation | `Scissors`                     | `Shift+S`                                       |
| Sheet               | `FileText`                     |                                                 |
| Schedule            | `Table`                        |                                                 |
| Family              | `Component`                    |                                                 |
| Save viewpoint      | `Camera`                       |                                                 |
| Toggle layer        | `Eye` / `EyeOff`               |                                                 |
| Undo / Redo         | `Undo2` / `Redo2`              | `⌘Z` / `⇧⌘Z`                                    |
| Theme toggle        | `Sun` / `Moon`                 |                                                 |
| Command palette     | `Command`                      | `⌘K`                                            |
| Search              | `Search`                       | `/`                                             |
| Settings            | `Settings2`                    |                                                 |
| Agent / AI          | `Sparkles`                     | Used consistently for any agentic surface.      |
| Evidence / manifest | `FileBadge2`                   |                                                 |
| Advisor warning     | `AlertTriangle`                |                                                 |
| Online / connected  | `CircleDot` (filled)           | Status bar `connected` / `offline`.             |
| Snap mode toggles   | `Magnet`                       | Snap on/off.                                    |
| Grid toggle         | `Grid3x3`                      |                                                 |
| ViewCube reset      | `Home`                         |                                                 |

### 10.2 Custom canvas symbology (NOT from lucide)

Drafting symbols (door swing arc, window glass line, north arrow, section tag, level head) are inline SVG paths inside the canvas because they must scale with drawing scale, not chrome size. They live under `packages/web/src/plan/symbology/*.tsx` and use `--draft-*` tokens for stroke.

---

## 11. App shell — TopBar

### 11.1 Anatomy

```
[ ☰ logo ]   [ project name ▼ ]   ║   [ Plan ] [ 3D ] [ Plan+3D ] [ Section ] [ Sheet ] [ Schedule ] [ Agent ]   ║   [ ⌘K ] [ 👥 ] [ ⛭ ] [ 🌙 ] [ avatar ]
```

| Region        | Contents                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Left (240 px) | Hamburger (collapse rails) → app logo → project-name dropdown (recent / new / open).                       |
| Center        | Mode pills. The active mode is filled with `--color-accent`; others are `--color-surface-strong` on hover. |
| Right         | Command palette button (`⌘K` shown), collaborator list, settings, theme toggle, user avatar.               |

### 11.2 Behavior

- Mode pills are `Tab`-traversable; arrow keys cycle within the group; `Enter` activates.
- The "project-name" dropdown opens a popover: recent files (last 5), "New project", "Open from URL", "Save bundle".
- TopBar height is `--space-12` (48 px). Background `--color-surface`. Bottom border `1 px` `--color-border`.
- TopBar never scrolls.

### 11.3 View tabs (below TopBar)

Borrowed from Revit / Navisworks: a horizontal strip of open-view tabs sits between the TopBar and the canvas area. Each tab represents one open view from the Project Browser (a level's plan, a viewpoint, a section, a sheet, a schedule, or the agent-review surface). Tabs persist across mode-pill clicks — switching modes does NOT close tabs.

```
[ 📐 Level 0 ✕ ] [ 📐 Level 1 ✕ ] [ 🧊 Default 3D ✕ ] [ 🔪 Section A-A ✕ ] [ 🗒 A-101 ✕ ]   [ + ]
```

| Field             | Source                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Icon              | `Icons.{plan,viewpoint,section,sheet,schedule,agent}` per the tab's `kind`.                                                                   |
| Label             | The view's `name` field, truncated at 16 chars with `…`. Tooltip shows the full label + kind.                                                 |
| Close ✕           | Only on hover (or the active tab). Closing the active tab activates the previous tab (or `null` if none remain).                              |
| Active state      | Filled with `--color-background` (so the tab "merges" into the canvas), top-rounded corners, `--color-accent` 2 px bottom indicator.          |
| Inactive state    | `--color-surface-strong` background, muted label, 1 px border-bottom against the canvas seam.                                                 |
| `+` (trailing)    | Opens a popover: "+ Plan view…", "+ 3D view…", "+ Section…", "+ Sheet…", "+ Schedule…" — picks a target element to open as a new tab.           |

Behavior:

- Project Browser **double-click** opens a new tab targeted at that row's element. **Single-click** activates the existing tab if one is already open for the same target element; otherwise opens a new one.
- Mode pills (Plan / 3D / Plan+3D / Section / Sheet / Schedule / Agent) become "switch active tab kind" affordances: clicking a mode pill activates the first existing tab of that kind, or creates one with the default target (active level for Plan, default viewpoint for 3D, first section for Section, first sheet for Sheet, etc.).
- `Ctrl/⌘ + Tab` cycles tabs forward; `Ctrl/⌘ + Shift + Tab` cycles back.
- `Ctrl/⌘ + W` closes the active tab.
- Tab order is user-controllable via drag (deferred to a later WP — V1 ships without drag).
- When zero tabs are open, the canvas shows the §25 empty state with a "Open a view" CTA in addition to the seed-house CTA.

Tabs are owned by `RedesignedWorkspace`'s local state in V1; persistence to localStorage is a follow-up WP.

---

## 12. App shell — Left rail (Project Browser)

### 12.1 Sections (in order)

```
PROJECT
  Levels
    Ground
    Upper
  Site
  Materials
VIEWS
  Floor Plans
    Ground — Plan
    Upper — Plan
  3D Views
    Default Orbit
    NE-Iso
  Elevations
  Sections
    Section A
SHEETS
  A-101 — Plans
SCHEDULES
  Door schedule
  Window schedule
  Room schedule
FAMILIES
  Doors
  Windows
EVIDENCE
  v1 acceptance proof
  Replay determinism
  Limitations manifest
```

### 12.2 Visual

- Each row is `28 px` tall, `padding 0 var(--space-5)`, `font-size var(--text-sm)`.
- Section headers are `UPPERCASE` `--text-xs`, `--color-muted-foreground`, `letter-spacing 0.04em`.
- Active row gets `--color-accent-soft` background + `--color-foreground` text.
- Hover row gets `--color-surface-strong` background.
- Each row has a `12 px` lucide icon to the left of the label.
- Disclosure triangle (`ChevronRight` rotated to `ChevronDown` when open) on parent rows; press `Right`/`Left` to expand/collapse.

### 12.3 Behavior

- Clicking a `Floor Plan` row activates that view in the current Plan canvas (or both halves in Plan+3D).
- Clicking a `3D View` row resets the orbit rig to the saved viewpoint.
- Right-clicking opens a context menu (`Open` / `Open in new tab` / `Duplicate` / `Rename` / `Delete`).
- `F2` renames the focused row.
- A search field sticky at top filters all rows (matches in label and id).
- Drag-drop reorders within a section; cross-section drop is forbidden (visual cursor: `not-allowed`).

### 12.4 Collapsed state

When width < 1280 the rail collapses to a `56 px` icon strip; section icons (a small lucide icon per section) stack vertically. Hover or `[` expands it back inline (slides over canvas with `--motion-base`).

---

## 13. App shell — Right rail (Inspector)

The inspector is context-sensitive. It always has three regions: a header (selection summary), a tabbed body (Properties / Constraints / Identity), and a sticky footer (Apply / Reset).

### 13.1 Header

```
[ icon ]   <Element type>
           id: <hf-w-so>     [ × clear selection ]
```

### 13.2 Tabs

| Tab             | Contents                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Properties**  | Instance parameters: dimensions, material assignment, level, flip controls, base/top offset, openings inset, etc. |
| **Constraints** | Wall joins / wrap rules / room bounding flag, location-line preference, structural usage, fire rating.            |
| **Identity**    | Type selector ("Type: Generic — 200 mm"), instance name, mark, comments, GUID, ifcGuid, evidence digest.          |

### 13.3 Field grammar

- Numeric fields render in mm by default with a unit chip on the right (`mm` / `cm` / `m`). Click the chip to cycle.
- Mathematical expressions allowed in numeric fields: `2400 + 200`, `1500 / 2`. Evaluated on `Enter`.
- Vector fields show as two/three sub-fields with a chain icon (`Link2`) toggling proportional edit.
- Boolean fields render as a labeled switch (`role="switch"` `aria-checked`).
- Enum fields render as a segmented control if ≤4 options, else a dropdown.
- Linked fields (e.g. an instance' Type) show with a small `ExternalLink` icon that opens the type editor in a sheet.

### 13.4 Footer

`Apply (⏎)` and `Reset (⎋)` only appear when the inspector has unsaved edits. Apply uses the engine's command pipeline; Reset reverts in-place.

### 13.5 Empty state

When nothing is selected, the inspector shows:

```
No selection.
Click an element on the canvas, or press V to select.
```

…plus a list of "Quick actions" tied to current mode (e.g. in Plan: `Press W to draw a wall`, `D for door`, `F for floor`).

---

## 14. 2D Plan canvas

### 14.1 Layout

```
+----------------------------------------------------+
| [ floating tool palette — top center ]            |
|                                                    |
|                                                    |
|                  drawing surface                   |
|                                                    |
|                                                    |
|                                                    |
|  [ snap pill at cursor ]                           |
|                                                    |
+----------------------------------------------------+
| [ scale bar | level switcher | grid toggle | XY ]  |
+----------------------------------------------------+
```

### 14.2 Drafting visual rules

- Background `--draft-paper`.
- Major grid (1 m): `--draft-grid-major`, `1 px` line.
- Minor grid (100 mm): `--draft-grid-minor`, `0.5 px` line. Only visible at zoom `>= 1:100`.
- Drafting lines obey `--draft-lw-*` weights (§9.10), per element class.
- Selection halo: `2 px` outer offset, `--draft-selection`, drawn UNDER the selected geometry.
- Hover halo: `1.5 px` outer offset, `--draft-hover`.
- Cut lines (active level): `--draft-cut`.
- Above-cut: `--draft-projection`.
- Below-cut (visible-below): `--draft-projection` at 60% opacity.
- Hidden: `--draft-hidden`, dashed at `4 px on / 3 px off`.
- Construction lines: `--draft-construction-blue`, `1 px`, never persist.
- Snap indicator (square + crosshair): `--draft-snap`, `8 px` square, fades over 200 ms.

### 14.3 Pointer grammar

| Action                  | Inputs                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Pan                     | `Space + drag` (any pointer button), or middle-mouse drag, or two-finger drag on trackpad.  |
| Zoom                    | Wheel (anchored at cursor), `⌘=` / `⌘-`, pinch on trackpad.                                 |
| Marquee select          | `V` then drag from empty space; left-to-right window-select, right-to-left crossing-select. |
| Add to selection        | `Shift + click` / `Shift + marquee`.                                                        |
| Toggle from selection   | `Alt + click`.                                                                              |
| Rectangular crossing    | `V` then right-to-left drag.                                                                |
| Drag move               | `V`, click, drag.                                                                           |
| Constrained move (axis) | Hold `Shift` while dragging.                                                                |
| Snap override (no snap) | Hold `Alt` (Win) / `⌥` (Mac) while drawing.                                                 |
| Free rotate             | `R` then click center, click handle, drag.                                                  |
| Mirror                  | `Shift + M` axis pick.                                                                      |

### 14.4 Snap modes

A status-bar group toggles snap modes; multiple may be on simultaneously. When snap fires, a labeled pill appears at the cursor naming the snap (`endpoint`, `midpoint`, `intersection`, `perpendicular`, `parallel`, `tangent`, `nearest`, `grid`, `axis 0°`, `axis 90°`, `polar 30°`).

| Toggle         | Default | Hotkey        |
| -------------- | ------- | ------------- |
| Endpoint       | on      | `F3` to cycle |
| Midpoint       | on      |               |
| Intersection   | on      |               |
| Perpendicular  | on      |               |
| Parallel       | on      |               |
| Tangent        | off     |               |
| Nearest        | on      |               |
| Grid           | on      | `F7`          |
| Polar tracking | on      | `F10`         |
| Axis lock      | on      | `Shift` hold  |

Snap also surfaces "tracking" lines: when the cursor passes through an inferred axis from a previous endpoint, a faint `--draft-construction-blue` ray draws toward the cursor and the snap pill says `→ from <endpoint label>`.

### 14.5 Zoom & camera

- Zoom range: `1:5` to `1:5000`.
- Zoom-to-fit: `F` (or `Home`).
- Zoom-to-selection: `⌘F` / `Ctrl+F`.
- "Walk in plan" (live re-zoom on cursor): always-on; mouse wheel zooms toward the pointer.
- Scale bar (bottom-left of canvas) shows current `1:N` and a `5 m` reference rule.
- Grid follows scale: at `1:5–1:50` show major+minor; at `1:50–1:200` major only; above `1:200` no grid.

### 14.6 Active level

The plan canvas is bound to a single active Level at a time. Status bar shows `Level: Ground ▾`; clicking opens a popover with all levels and `+ New level`. `PageUp` / `PageDown` cycle levels. Geometry from other levels still draws but at reduced contrast (alpha 30%), unless `Show only this level` is on.

### 14.7 Empty state

When no elements exist on the active level:

```
This level is empty.
Press W to draw a wall, or insert the seed house from the Project menu.
```

---

## 15. 3D viewport

### 15.1 Engine

The redesign keeps Three.js (already installed) but introduces a real controls layer:

- `OrbitControls` (drei-equivalent — implementation detail; we may pull in `three/examples/jsm/controls/OrbitControls.js` directly).
- Custom `WalkControls` for first-person mode.
- `PerspectiveCamera` and `OrthographicCamera`, switchable.

### 15.2 Layout

```
+----------------------------------------------------+
|                                  [ ViewCube ]      |
|                                                    |
|                                                    |
|              perspective / ortho viewport          |
|                                                    |
|                                                    |
| [ floating 3D tools ]                              |
|                                                    |
+----------------------------------------------------+
```

### 15.3 Camera controls

| Action               | Input                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Orbit                | `Alt + LMB drag` OR middle-mouse drag.                                                       |
| Pan                  | `Shift + middle-mouse drag` OR two-finger drag.                                              |
| Dolly                | Mouse wheel (toward cursor), pinch.                                                          |
| Free zoom            | `⌘=` / `⌘-`.                                                                                 |
| Walk mode            | `W` toggles. While in walk: `WASD` move, `QE` up/down, mouse-look, `Shift` run, `Esc` exits. |
| Frame all            | `F`.                                                                                         |
| Frame selection      | `⌘F` / `Ctrl+F`.                                                                             |
| Reset camera         | `Home` or `H`.                                                                               |
| Save current as view | `⌘S` opens "Save 3D viewpoint" sheet.                                                        |

### 15.4 ViewCube spec

A ViewCube component sits in the top-right of the 3D canvas region.

- Size: `96 × 96 px`.
- Renders a small Three.js scene (or pure CSS-3D fallback) with a labeled cube.
- Faces labeled `FRONT` / `BACK` / `LEFT` / `RIGHT` / `TOP` / `BOTTOM`.
- 4 corners (`NE`, `NW`, `SE`, `SW` on the top face etc.) are pickable for isometric.
- 12 edges pickable for 45° face-edge views.
- Single click on face/edge/corner: snap camera to that orthographic-aligned view, animate over `--motion-slow`.
- Drag on the ViewCube: orbits the model.
- Compass ring underneath the cube shows the current azimuth and a `N` arrow.
- Double-click the cube center: resets camera to the saved "Default Orbit" viewpoint.
- Always renders synchronously with the main camera (matrices stay locked).
- A small `Home` button to the right of the cube does the same as double-click.
- Tooltip on hover: "Click face to align camera; drag to orbit; double-click for default view."

### 15.5 Materials & shading

- Default shader: light-paper PBR look — `MeshStandardMaterial` with `roughness 0.85`, `metalness 0`, white-ish base, AO baked at 0.4.
- Sun: an `DirectionalLight` aligned to the project north (azimuth from site) at 35° elevation, color `#fff8ec`. Shadow maps `2048²`.
- Ambient: `HemisphereLight` `sky #d3e2ff`, `ground #d8d3c4`, intensity `0.45`.
- Wall material color comes from `--cat-wall` (read at scene init; theme switch triggers rebuild).
- Selected element: `EdgesGeometry` overlay at `--color-accent`, `2 px` line width.
- Hovered element: `EdgesGeometry` overlay at `--draft-hover`, `1 px`.
- Optional: outline pass (post-processing) for the "drawing-like" look (off by default; toggle in View menu).

### 15.6 Section box & clipping

- Right-click in 3D → `Section Box` toggles a draggable AABB clipping region.
- Six handles (one per face) for resize.
- Clip planes propagate to all materials via `material.clippingPlanes`.
- A small chip in the bottom-left of the canvas reads `Section box: 12.0 m × 8.4 m × 6.5 m`.

### 15.7 3D floating tool palette

Smaller than the plan palette. Tools: `Walk`, `Section box`, `Toggle layers`, `Snap to face`, `Save view`. Same component as plan palette but with mode-specific entries.

### 15.8 Empty state

If the model has no geometry, the 3D viewport shows a soft compass + the message:

```
No geometry yet. Draw walls in Plan, or insert the seed house.
```

---

## 16. Tool palette (top-floating, mode-specific)

The floating tool palette is the primary entry to drawing tools. It sits horizontally centered, `12 px` from the top of the canvas region (NOT the top bar), with `--elev-2` shadow and `--radius-pill` corners.

### 16.1 Plan-mode palette layout

```
[ Sel ] | [ Wall ] [ Door ] [ Window ] [ Floor ] [ Roof ] [ Stair ] [ Railing ] [ Room ] [ Dim ] [ Section ] | [ Tag ▾ ]
   V         W         D         W         F         R         S          —          M       Sh+D    Sh+S
```

(Hotkey under each glyph; tool palette displays the hotkey on hover.)

### 16.2 Tool button anatomy

- `36 × 36 px`, icon centered, hotkey letter as `--text-xs` superscript bottom-right.
- Hover: background `--color-surface-strong`, scale `1.04` over `--motion-fast`.
- Active (current tool): background `--color-accent`, icon color `--color-accent-foreground`.
- Disabled (e.g., Floor before walls exist): opacity `0.4`, tooltip explains.

### 16.3 Tool-state grammar

When a drawing tool is active:

- Cursor changes to a tool-specific crosshair.
- Status bar shows `Tool: Wall — click to set start point`.
- Inspector shows the tool's defaults (thickness, height, location line, level) — these are the values the next created element will use; editing them does NOT modify any existing element.
- `Esc` cancels in-progress drawing without exiting the tool; `Esc Esc` exits the tool to `Sel`.
- After completion the tool stays active so the user can place another (Revit-style "repeat tool"). `Enter` exits to `Sel` immediately.

### 16.4 Per-tool drawing grammar

#### 16.4.1 Wall (W)

- Click 1: start endpoint.
- Cursor preview: a wall outline at current thickness with location-line indicator.
- Hover-snap to existing endpoints, midpoints, intersections, axis (`0°` / `90°` / polar 30°).
- Click 2: end endpoint → wall created.
- Continues from the new endpoint (chain mode); `Esc` breaks chain, tool stays active.
- Modifiers: `Shift` axis-lock, `Alt` snap-off, `Tab` cycles location-line (Wall Centerline / Finish Face Exterior / Finish Face Interior / Core Centerline / Core Face Exterior / Core Face Interior).
- Inspector shows: `Type` (200 mm Generic), `Height (mm)`, `Base offset`, `Top offset`, `Location line`, `Wall join` (allow / disallow).

#### 16.4.2 Door (D)

- Hover over a wall: door preview snaps to the nearest valid host position; arrow keys nudge.
- Click: door inserts at that wall position.
- `Spacebar` flips swing side; `Tab` flips hand.
- Inspector shows: `Family` (Generic 900 × 2100), `Sill height`, `Swing side`, `Hand`.

#### 16.4.3 Window (W with `Shift+W` if conflict; let's reassign Wall to `W`, Window to `Shift+W` to avoid the collision in Workspace today)

- Same host-on-wall rule as Door.
- Default sill height `900 mm`.
- Inspector shows: `Family`, `Width`, `Height`, `Sill height`, `Glass type`.

#### 16.4.4 Floor / Slab (F)

- Pick mode: `pick walls` (click walls forming a closed loop — auto-extract polygon) OR `sketch` (click a polygon; double-click closes).
- `Tab` switches sketch / pick.
- Inspector: `Type`, `Thickness`, `Slab top elevation`, `Material`.

#### 16.4.5 Roof (R)

- Pick walls or sketch outline.
- `Roof type`: Gable, Hip, Flat, Shed (radio at the top of the inspector).
- `Slope`: per-edge override; click an edge in the live preview to toggle which edges are sloping.
- `Eave`: overhang in mm.

#### 16.4.6 Stair (S)

- Two-click runs (start, end) — auto-computes risers/treads from level delta and stair type.
- Inspector: `Type` (Straight, L-shape, U-shape, Spiral), `Width`, `Riser height`, `Tread depth`, `Direction`.

#### 16.4.7 Railing

- Pick host: stair, slab edge, or sketched path.
- Default style: `Horizontal Bars 5 × 30 mm` for matching the reference balcony look.

#### 16.4.8 Room (M for "marker" — `Square` icon; configurable)

- Click any closed-bounded area: room marker drops in centroid; `RoomElem` created.
- Auto-derives name from the closest wall labels if available; user can edit.
- Inspector: `Name`, `Programme`, `Department`, `Color scheme`, `Bounded` (auto / manual override).

#### 16.4.9 Dimension (`Shift + D`)

- Linear (`L`), Aligned (`A`), Angular (`G`), Radial (`Q`), Diameter (`Shift+Q`).
- Click 1: first witness; Click 2: second witness; Click 3: drag dimension line into position; click locks it.
- Inspector: `Style`, `Units`, `Decimal precision`, `Show prefix/suffix`.

#### 16.4.10 Section (`Shift + S`)

- Click 1: section start; Click 2: section end; Click 3: depth direction.
- Auto-creates a `SectionCutElem` and adds a row to Project Browser → `Sections`.

### 16.5 Tag tool (subdropdown)

`Tag ▾` opens a menu of tag families: `Tag Door`, `Tag Window`, `Tag Wall`, `Tag Room`, `Tag by Category`. Selected tag drops on click.

---

## 17. Status bar (bottom)

`28 px` tall, `--color-surface`, `1 px` top border, `--text-xs`.

### 17.1 Anatomy

```
[ Level: Ground ▾ ] | [ Tool: Wall ] | [ Snap: ON · F3 cycle ] | [ Grid: ON · F7 ] | [ X 10.00 m  Y 9.00 m ] | … | [ undo 12 ↶ ↷ ] | [ ws: connected ● ] | [ saved ]
```

### 17.2 Behavior

- Every cluster is keyboard-focusable and shows a tooltip with the relevant hotkey.
- `XY` reads the current cursor model coordinates in the active level's units; updates at `60 Hz`.
- `ws: connected` is green when the ws is connected; red when offline; orange while reconnecting.
- `saved` flips between `saved`, `saving…`, `unsynced` (dirty changes not pushed).

---

## 18. Command palette (`⌘K`)

- Built on `cmdk` (already installed).
- Width 560 px, max-height `60 vh`, `--radius-xl`, `--elev-3`.
- Source list (in priority order):
  1. Recent commands (last 5 the user invoked).
  2. Tools (drawing tools as commands).
  3. Views (jump to plan / 3D / sheet by name).
  4. Elements (search by id, name, mark across the whole document).
  5. Settings ("Theme: dark", "Snap: midpoint off", "Show only this level").
  6. Agent ("Run Agent Review", "Regenerate evidence for current view").
- Fuzzy match on label + keywords; supports prefixes (`>` for tools, `@` for elements, `:` for settings).
- Empty-state shows top 5 keyboard shortcuts as a learning crutch.

---

## 19. Keyboard map (global, cheatsheet)

| Action                   | Keys                                                                                                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command palette          | `⌘K` / `Ctrl+K`                                                                                                                                                                                                                                          |
| Mode jumps               | `1` Plan, `2` 3D, `3` Plan+3D, `4` Section, `5` Sheet, `6` Schedule, `7` Agent                                                                                                                                                                           |
| Select tool              | `V`                                                                                                                                                                                                                                                      |
| Wall                     | `W`                                                                                                                                                                                                                                                      |
| Door                     | `D`                                                                                                                                                                                                                                                      |
| Window                   | `Shift + W`                                                                                                                                                                                                                                              |
| Floor                    | `F` (canvas) — note: `F` also "fit"; canvas tool wins when canvas focused; otherwise `F` fits view. We solve this by gating: if a drawing tool is active, `F` means floor; if `Sel` is active, `F` means fit. Canonical alias: `Shift + F` = fit always. |
| Roof                     | `R`                                                                                                                                                                                                                                                      |
| Stair                    | `S`                                                                                                                                                                                                                                                      |
| Railing                  | `Shift + R`                                                                                                                                                                                                                                              |
| Room marker              | `M`                                                                                                                                                                                                                                                      |
| Dimension                | `Shift + D`                                                                                                                                                                                                                                              |
| Section                  | `Shift + S`                                                                                                                                                                                                                                              |
| Tag                      | `T`                                                                                                                                                                                                                                                      |
| Pan                      | `Space + drag` / `MMB`                                                                                                                                                                                                                                   |
| Orbit (3D)               | `Alt + LMB`                                                                                                                                                                                                                                              |
| Walk (3D)                | `Shift + W` toggles when 3D focused                                                                                                                                                                                                                      |
| Cancel                   | `Esc`                                                                                                                                                                                                                                                    |
| Confirm / Apply          | `Enter`                                                                                                                                                                                                                                                  |
| Undo / Redo              | `⌘Z` / `⇧⌘Z`                                                                                                                                                                                                                                             |
| Save bundle              | `⌘S`                                                                                                                                                                                                                                                     |
| Toggle left rail         | `[`                                                                                                                                                                                                                                                      |
| Toggle right rail        | `]`                                                                                                                                                                                                                                                      |
| Toggle theme             | `⌘⇧L`                                                                                                                                                                                                                                                    |
| Show keyboard cheatsheet | `?`                                                                                                                                                                                                                                                      |

A complete cheatsheet (the existing `Cheatsheet.tsx`) becomes a `?`-opened modal styled on `--elev-3`.

---

## 20. Modes — detailed

### 20.1 Plan mode

Layout: TopBar / LeftRail / Plan canvas / RightRail / StatusBar. ViewCube hidden.

### 20.2 3D mode

Layout: TopBar / LeftRail / 3D viewport / RightRail / StatusBar. ViewCube top-right.

### 20.3 Plan + 3D mode (default)

Layout: TopBar / LeftRail / [Plan canvas | 3D viewport] / RightRail / StatusBar. Divider at 50%, draggable, snap to 33/50/67%. ViewCube only on 3D side.

### 20.4 Section mode

Plan canvas on the left (where you draw the section line); section preview on the right. Right rail Inspector shows section depth, far clip, view template.

### 20.5 Sheet mode

A single sheet with viewports placed onto it. Sheet thumbnails replace the Project Browser items list. Each viewport shows the underlying view; click selects, drag moves, corner handle resizes.

### 20.6 Schedule mode

Schedule list on the left rail; schedule grid in the canvas region. Right rail shows the schedule's column/filter/sort settings. Cell editing inline.

### 20.7 Agent Review mode

Agent Review pane (existing) becomes the canvas. Manifest tree on left; action queue on right. The Agent / `Sparkles` icon is consistent with §10.1.

---

## 21. Motion grammar

| Surface              | Motion                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| Mode switch          | Cross-fade `--motion-slow`, plus a 4 px slide of the canvas in the direction.         |
| Panel slide          | Translate-X `--motion-base` `--ease-out`.                                             |
| ViewCube snap        | `--motion-slow` `--ease-snap`; camera tween via `THREE.CameraHelper.lerp`-equivalent. |
| Snap pill appears    | Fade + 2 px scale-in over `--motion-fast`.                                            |
| Tool palette hover   | Background fade `--motion-fast`; scale `1.04` `--motion-fast`.                        |
| Toast                | Slide up `--motion-base`; auto-dismiss after 4.5 s; pause on hover.                   |
| Inspector tab change | Opacity-only `--motion-fast`.                                                         |
| Selection halo       | No animation (instant — drafting tools must feel mechanical).                         |

`@media (prefers-reduced-motion: reduce)` removes all transforms; opacity transitions become instant.

---

## 22. Accessibility

| Requirement                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Body copy contrast >= 4.5:1; large text (>= 18 px or >= 14 px bold) >= 3:1.                                                                      |
| Every interactive element has a focus-visible ring using `--color-ring`.                                                                         |
| Every icon-only button has `aria-label`.                                                                                                         |
| Tool palette is `role="toolbar"` with arrow-key navigation.                                                                                      |
| Project Browser is `role="tree"` with `tree-item` rows.                                                                                          |
| Status bar uses `aria-live="polite"` for tool / coord updates; `aria-live="assertive"` for errors.                                               |
| Canvas: `<canvas>` has `role="application"` plus a hidden description of current tool + active level.                                            |
| Keyboard-only flow: a user can pick the seed house template, draw a wall, add a door, place a section, generate a sheet — all without a pointer. |
| Color is never the only signal: snap pill always has text label; advisor uses icon + text.                                                       |
| `prefers-reduced-motion` respected.                                                                                                              |
| Min hit target 24 × 24 px on chrome; 36 × 36 on tool palette.                                                                                    |
| Multi-pointer (touch) supported on tool palette and rail toggles; canvas pan/zoom works with two-finger.                                         |

---

## 23. Theming

- Default: light. `:root` (no class) is light.
- Dark: add `data-theme="dark"` (or `.dark`) to `<html>`. Toggle stored in `localStorage` and reflected in the URL hash for shareable views.
- Theme tokens in §9 cover both. **Component code must never branch on theme**; it must use tokens.
- A "drafting" sub-theme is optional (warmer paper, sepia accent) — `data-draft-theme="paper"`. Reserved for V2.

---

## 24. Onboarding

First-run welcome (existing `Welcome.tsx` redesigned to match):

```
+------------------------------------------------+
| Sparkles  Welcome to BIM AI                    |
|                                                |
|  Pick a starting point:                        |
|  ┌────────────┐  ┌────────────┐  ┌───────────┐ |
|  │ Empty      │  │ Seed house │  │ Open file │ |
|  │ project    │  │ (one-      │  │ …         │ |
|  │            │  │ family)    │  │           │ |
|  └────────────┘  └────────────┘  └───────────┘ |
|                                                |
|  Take the 90-second tour ▸                     |
+------------------------------------------------+
```

The tour drives a `react-joyride`-style popover sequence over the redesigned chrome:

1. "This is your canvas. Press W to draw a wall."
2. "Snap modes live in the status bar. F3 cycles."
3. "Switch to 3D with `2`. The ViewCube top-right orients the camera."
4. "Open the Project Browser on the left to switch views."
5. "Press `?` any time to see all shortcuts."

---

## 25. Empty / loading / error states

| State             | Pattern                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------- |
| Canvas empty      | Centered hint: icon + 2-line copy + 1 primary CTA.                                      |
| Canvas loading    | Skeleton grid (faint `--draft-grid-major`) + "Loading model…" `aria-live="polite"`.     |
| Network offline   | Status bar pill turns red; toast on connection drop with "Retry" action.                |
| Engine error      | Modal with stack trace collapsed by default + "Copy diagnostics" + "Reload".            |
| Conflict (409)    | Inline banner above canvas: "Server-side conflict at revision <n>. Reload to continue." |
| Permission denied | Modal: "This project is read-only. Save a copy to make changes."                        |

---

## 26. Drafting standards (line weights, fills, hatches)

The redesign adopts the line-weight table in §9.10 and the category color table in §9.3 as the single source for plan/section graphics. The current `planSymbology.ts` already encodes hint-categories; redesign tightens it to:

| Category line role         | Token                         | Stroke style      |
| -------------------------- | ----------------------------- | ----------------- |
| Wall cut                   | `--draft-lw-cut-major`        | solid             |
| Door cut                   | `--draft-lw-cut-minor`        | solid             |
| Window cut                 | `--draft-lw-cut-minor`        | solid             |
| Floor projection (in plan) | `--draft-lw-projection-minor` | solid 60% opacity |
| Roof projection (in plan)  | `--draft-lw-projection-minor` | dash-dot          |
| Stair tread cut            | `--draft-lw-cut-minor`        | solid             |
| Stair direction arrow      | `--draft-lw-projection-major` | solid arrow       |
| Hidden                     | `--draft-lw-hidden`           | dash 4-3          |
| Witness (dim)              | `--draft-lw-witness`          | solid             |

Hatching:

- Walls (concrete): `0.5 px` 45° lines at 1 mm spacing.
- Floors (timber): `0.5 px` parallel lines at 0.7 mm.
- Site (lawn): faint dotted.
  Hatches use SVG `<pattern>` and only render at zoom `>= 1:200`.

---

## 27. Seed house V2 — fixture spec

The current `packages/cli/lib/one-family-home-commands.mjs` produces a rectangular 2-storey house with no balcony, terrace, pitched roof, or cladding, which is what reads as "weird artifact" in the screenshot. The redesign requires a fixture that matches the visual reference (2-storey gable house with cantilevered upper balcony and ground-level terrace), and exercises every primary element class.

### 27.1 Required elements

| Class                    | Count | Notes                                                                                                     |
| ------------------------ | ----- | --------------------------------------------------------------------------------------------------------- |
| Levels                   | 3     | Ground (0 mm), Upper (3000 mm), Roof Apex (5800 mm).                                                      |
| Site (pad / context)     | 1     | 30 m × 22 m, 0 mm elev; one inset 12 m × 9 m terrace pad at -50 mm.                                       |
| Walls (exterior, ground) | 6     | Forms an L-shape: main 12 m × 8 m volume + 4 m × 4 m utility wing. 200 mm thickness.                      |
| Walls (interior, ground) | 4     | Spine + bath/utility partitions; 100 mm thickness.                                                        |
| Walls (exterior, upper)  | 4     | Set back 1 m from ground footprint on the south to create the balcony floor; 200 mm.                      |
| Walls (gable, upper)     | 2     | North & South gables at 35° pitch. Cladded with `--cat-wall` accent + vertical-board hatch in plan.       |
| Floors (slabs)           | 3     | Ground slab, upper slab (incl. cantilever), terrace slab at -50 mm.                                       |
| Roof                     | 1     | Pitched gable over main volume (35°); secondary flat roof over utility wing.                              |
| Doors                    | 5     | 1 entry door (utility), 1 entry double-door (south terrace), 1 internal x3 (rooms / bath / WC).           |
| Windows                  | 7     | 1 floor-to-ceiling living-room window (south, 4 m wide); 4 punched bedroom windows; 2 small bath/utility. |
| Stair                    | 1     | Straight run, 17 risers × 176 mm, ground → upper.                                                         |
| Railing                  | 3     | 1 stair railing; 1 balcony railing (horizontal-bar 5×30 mm); 1 terrace edge.                              |
| Rooms                    | 9     | Ground: Entrance hall, Living, Kitchen, Dining, WC, Utility. Upper: 2 bedrooms, Bath, Hall.               |
| Section cuts             | 2     | A–A (E–W through living room); B–B (N–S through stair).                                                   |
| Plan views               | 2     | Ground plan, Upper plan.                                                                                  |
| 3D views                 | 3     | Default Orbit, NE-Iso, Worm's-eye-from-balcony.                                                           |
| Sheets                   | 1     | A-101 with 4 viewports (Ground, Upper, A–A, NE-Iso) + titleblock fields populated.                        |
| Schedules                | 5     | Door, Window, Room, Wall types, Material take-off.                                                        |

### 27.2 Acceptance

The seed house is `done` when:

- `pnpm tsx scripts/apply-one-family-home.mjs` produces a Document where all of §27.1 are present and replay determinism harness passes.
- The 3D viewport at the "Default Orbit" saved view visually matches the reference image's silhouette ±5% pixel diff (Playwright `toHaveScreenshot` with named baseline).
- The plan view at "Ground plan" reads with the line-weight discipline of §26 (Playwright snapshot).
- The room schedule shows 9 rooms with non-zero areas summing to >= 95% of the floor footprint.

### 27.3 Naming

All seed-house element ids are prefixed `seed-`. This makes deletion / reset trivial: `Document.removeWhereIdStartsWith("seed-")`.

---

## 28. Workpackages — `WP-UI-*` table

`State`, `Maturity`, and `Approx. progress %` mirror the engineering tracker. Strict `done` = §4 done-rule satisfied.

| WP id         | Area                                        | State     | Maturity          | Approx. progress | Acceptance summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------- | --------- | ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WP-UI-A01** | Design token foundation                     | `partial` | 3 evidenced slice | ~80%             | All §9 tokens land in `packages/design-tokens/src/tokens-default.css` + `tokens-dark.css` + `tokens-drafting.css`; tailwind preset extended (chrome / drafting / category colors, spacing, radius, fontSize, elevation, motion, shell sizing, breakpoint variants); 108-assertion vitest covers branch logic; canvas hex audit deferred to G01/B07/B01.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-A02** | Iconography (lucide-react)                  | `partial` | 3 evidenced slice | ~75%             | `@bim-ai/ui` exposes the §10.1 chrome icon registry with `aria-label` defaults and §10 size scale; `StairsIcon` covers the documented lucide gap; chrome adoption (TopBar/Inspector/StatusBar) follows in WP-UI-A03/A05/A06; canvas SVG audit lives under WP-UI-G01.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **WP-UI-A03** | App shell — TopBar                          | `partial` | 3 evidenced slice | ~85%             | TopBar.tsx renders the §11 anatomy (mode pills `role="tablist"`, ArrowLeft/Right, ⌘K, theme swap, avatar). Now adopted in `/redesign` route via `RedesignedWorkspace.tsx` (theme toggle round-trips through `state/theme.ts`; mode pills wired to `setViewerMode`). Legacy `/` Workspace topbar untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **WP-UI-A04** | App shell — Left rail (Project Browser)     | `partial` | 3 evidenced slice | ~85%             | LeftRail.tsx is the §12 tree (sticky search, eyebrow sections, `role="tree"`, ArrowKeys/Enter/F2). Adopted in `/redesign` route — sections derive live from `useBimStore` (Levels / Floor Plans / 3D Views / Sections / Sheets / Schedules). Activating a Level row dispatches `setActiveLevelId`. Legacy ProjectBrowser.tsx panel kept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-UI-A05** | App shell — Right rail (Inspector)          | `partial` | 3 evidenced slice | ~85%             | Inspector.tsx is the §13 right rail (Properties / Constraints / Identity tablist, evaluator-backed NumericField, dirty-state footer, empty-state quick actions). Adopted in `/redesign` route — selection comes from `useBimStore.selectedId`; close button dispatches `select(undefined)`. Tab bodies stub-rendered until per-element parameter wiring lands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **WP-UI-A06** | App shell — StatusBar                       | `partial` | 3 evidenced slice | ~85%             | StatusBar.tsx lands the §17 cluster set (level switcher with PageUp/Down, tool readout, Magnet snap toggles, Grid3x3 toggle, mono `aria-live` cursor coords, ws/save assertive pills). Adopted in `/redesign` route — level switcher round-trips `setActiveLevelId`; cursor coords pull from `planHudMm`; tool label resolves from the active `PlanTool` via the redesigned tool registry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **WP-UI-A07** | App shell — layout grid + breakpoints       | `partial` | 3 evidenced slice | ~85%             | AppShell.tsx is the canonical 5-zone CSS grid (topbar / leftRail / canvas / rightRail / statusBar) sized from `--shell-*` tokens with `[`/`]` rail-toggle hotkeys. Adopted in `/redesign` route as the outer chrome composer for the redesigned shell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **WP-UI-A08** | Theming (light primary; dark)               | `partial` | 3 evidenced slice | ~80%             | `state/theme.ts` is the canonical controller (light default; dark via `data-theme="dark"`+ legacy `.dark` class). Resolution priority: `#theme=…` URL hash > `localStorage` > `prefers-color-scheme`. Toggle persists to all three. `prefersReducedMotion()` exposed for §21. `state/store.ts` re-exports the public API for back-compat. 12-test vitest suite covers cascade and toggling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-UI-A09** | Motion grammar                              | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/design-systems/motion.ts` lands the §21 motion table as data: `MOTION_TABLE` covers every spec'd surface (mode-switch / panel-slide / view-cube-snap / snap-pill / tool-palette-hover / toast / inspector-tab-change / selection-halo) with `{ durationMs, durationToken, easeToken, channels, scale?, translateXPx? }`. `motionFor(surface, { reducedMotion })` collapses durations + transforms to 0 ms when `prefers-reduced-motion: reduce`. `transitionCSS(surface)` produces a token-driven CSS shorthand. `maxDurationMs()` enforces the §21 240 ms ceiling. 10-test vitest covers every surface, ceiling, reduced-motion collapse, CSS composition.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **WP-UI-A12** | App shell — view tabs                       | `partial` | 3 evidenced slice | ~65%             | `packages/web/src/workspace/tabsModel.ts` is the pure view-tabs reducer (`openTab`, `closeTab`, `activateTab`, `cycleActive`, `tabsForElement`) — `ViewTab = { id, kind, targetId, label }` covers plan / 3d / plan-3d / section / sheet / schedule / agent. `workspace/TabBar.tsx` renders the §11.3 strip below TopBar (kind icon + truncated label + close ✕, top-rounded active-tab style with `--color-accent` 2 px bottom indicator, trailing `+` popover). `RedesignedWorkspace.tsx` wires Project Browser double-click → `openTab`, mode-pill click → activate-or-create-tab-of-kind, `Ctrl/⌘+W` → close active, `Ctrl/⌘+Tab` → cycle. Drag-reorder + localStorage persistence are explicitly deferred to a follow-up WP. |
| **WP-UI-A10** | Accessibility baseline                      | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/design-systems/a11y.ts` is the §22 a11y baseline contract: `A11Y_INVARIANTS` (4.5:1 body / 3:1 large contrast targets, 24 px chrome / 36 px tool-palette hit targets, 2 px focus ring), `resolveIconButtonLabel` enforces ariaLabel-or-title for every icon button, `ariaLiveForSurface` resolves polite vs assertive politeness per status cluster, `meetsHitTarget(w, h, surface)` validates spec'd minimums, `KEYBOARD_ONLY_PATH` documents the §22 golden flow (template → wall → door → section → sheet). 10-test vitest covers all invariants + resolution paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-B01** | 2D Plan canvas — drafting visuals           | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/plan/planCanvasState.ts` exposes `draftingPaintFor(plotScale)` returning `{ paperToken, grid visibility, visible hatches, lineWidthPx(role) }`. Backed by `draftingStandards.ts` (G01). PlanCanvas.tsx adoption deferred to post-Phase-5 sweep.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WP-UI-B02** | 2D Plan canvas — pointer + snap grammar     | `partial` | 3 evidenced slice | ~70%             | `planCanvasState.ts` exposes `SnapEngine` (toggle / setOn / cycleExclusive — `F3`-style — / resolve / pillLabel; defaults match §14.4 spec table) plus `classifyPointerStart(event)` mapping `{button, spacePressed, shiftKey, altKey, dragDirection, activeTool}` to `pan / marquee-window / marquee-crossing / drag-move / add-to-selection / toggle-selection / draw / idle` per §14.3. PlanCanvas.tsx adoption deferred to post-Phase-5 sweep.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-B03** | 2D Plan canvas — zoom/pan/level/empty state | `partial` | 3 evidenced slice | ~70%             | `planCanvasState.ts` exposes `PlanCamera` (`wheelZoom(delta, anchor)` with anchor-toward-cursor, `panMm(dx, dy)`, `fit(bbox, padding)` clamped 1:5–1:5000, `cycleLevel('up'\|'down')` for §14.6 PageUp/Down, `emptyStateMessage()` matching §14.7 copy). 6 added vitest assertions cover wheel zoom bounds, pan, fit centering + clamp, level cycling wrap, empty-state copy, anchor-zoom shifts center.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-UI-B04** | 3D Viewport — controls (orbit/pan/dolly)    | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/viewport/cameraRig.ts` is a framework-free spherical-coordinate rig with the §15.3 grammar: `orbit(dx,dy)`, `pan(dx,dy)` (target moves along the screen-space basis derived from view × up), `dolly(delta)`, `zoomBy(factor)`, `frame(box, fitFactor)`, `reset()` and `setHome()`, `applyViewpoint(position, target, up)` (recovers radius/azimuth/elevation from a saved camera). Pointer and hotkey grammar is exposed as `classifyPointer` (Alt+LMB / MMB / Shift+MMB), `wheelDelta` (pinch dampening), and `classifyHotkey` (`F` frame-all, `⌘F` frame-selection, `H`/`Home` reset, `⌘=`/`⌘-` zoom). 21-test vitest covers spherical placement, orbit clamping, dolly + zoom limits, pan basis math, frame, reset/home, applyViewpoint round-trip, pointer + wheel + hotkey classification. Viewport.tsx adoption (replacing the in-line rig) deferred to the post-Phase-4 sweep.                                                                                                                                                                                       |
| **WP-UI-B05** | 3D Viewport — walk mode                     | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/viewport/walkMode.ts` is a framework-free walk controller: `WalkController.setActive`, `setKey('forward'\|'back'\|'strafeLeft'\|'strafeRight'\|'down'\|'up', pressed)`, `setRunning(bool)`, `mouseLook(dx, dy)` (yaw + clamped pitch), `update(dt)` integrates ground-plane translation against the active key set with `walkSpeed × runMultiplier` (Shift). `classifyKey()` covers WASD + arrow keys + QE. 12-test vitest covers idle gating, WASD forward/strafe vectors, vertical motion, run multiplier, pitch clamp, mouseLook gating-on-active, viewDirection accuracy, and active-toggle key clearing. Viewport.tsx adoption deferred to the post-Phase-4 sweep.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-B06** | 3D Viewport — ViewCube                      | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/viewport/viewCubeAlignment.ts` exposes the §15.4 numerical contract: `alignmentForPick(pick)` resolves face / edge / corner / `home` picks to `{ azimuth, elevation, up }` (TOP/BOTTOM use Z-up; corners are `atan(1/√2)`-elevation isos; edges split between vertical-edge tilts and face-diagonal azimuths) and `compassLabelFromAzimuth` maps the rig's azimuth to the N/E/S/W compass label. `viewport/ViewCube.tsx` renders the §15.4 widget: 6-face cross of pickable buttons, dedicated home button, compass pill underneath, corner-iso row, with tooltips per spec. 13-test math vitest covers face / edge / corner alignments, BOTTOM/TOP elevation symmetry, home default, and compass quadrants; 5-test component vitest covers face roster, face click → pick + alignment, home button dispatch, corner click, compass label reactivity to azimuth changes.                                                                                                                                                                                                    |
| **WP-UI-B07** | 3D Viewport — materials & lighting          | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/viewport/materials.ts` exposes the §15.5 paint contract decoupled from Three.js: `resolveCategoryMaterial(cat)` reads the `--cat-*` token via `liveTokenReader` and returns `{ color, roughness 0.85, metalness 0, aoIntensity 0.4 }` (falls back to documented light values when token missing); `resolveLighting()` returns sun (`#fff8ec`, 35° elevation, 2048² shadow) + hemi (`#d3e2ff` sky / `#d8d3c4` ground); `resolveSelection()` reads `--color-accent` + `--draft-hover` for the EdgesGeometry overlay (2 px / 1 px). `resolveViewportPaintBundle` packages all three for theme-switch rebuilds. Tests inject a fake `TokenReader` to exercise both token-present and fallback paths. 10-test vitest covers every category, fallbacks, override defaults, lighting constants, selection token reads, bundle aggregator.                                                                                                                                                                                                                                          |
| **WP-UI-B08** | 3D Viewport — section box & clipping        | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/viewport/sectionBox.ts` is a framework-free section-box controller per §15.6. `SectionBox.toggle/setActive`, `dragHandle('x-min'\|'x-max'\|'y-min'\|...\|'z-max', delta)` (clamped against opposite face by 0.1 m epsilon), `setBox(min, max)` (normalizes swapped inputs), `clippingPlanes()` returns six inward `{ normal, constant }` planes for `Material.clippingPlanes`, `contains(point)` for world-space membership, `summary()` matches the spec readout (`Section box: 12.0 m × 8.4 m × 6.5 m`). 9-test vitest covers default extents, toggle, handle clamp, summary, plane count + axis pairing, contains, inactive-passthrough, normalized setBox.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **WP-UI-C01** | Tool palette (top-floating)                 | `partial` | 3 evidenced slice | ~85%             | toolRegistry.ts + ToolPalette.tsx (§16.1, `role="toolbar"`, ArrowLeft/Right, dim-disabled rules, Tag dropdown route). Adopted in `/redesign` route — top-floating above the canvas; click + V/W/D/M hotkeys round-trip to `setPlanTool` for known plan tools (the redesigned palette's Floor/Roof/Stair/etc. are surfaced as preview-active until canvas draw flows land).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **WP-UI-C02** | Tool — Wall                                 | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes the §16.4.1 wall grammar: `WALL_LOCATION_LINE_ORDER` (6 location lines), `cycleWallLocationLine` (Tab cycle), `WallChainState` + `reduceWallChain(state, event)` reducer driving chain mode (`tool-activated`, `click`, `cancel`, `enter-finish`, `tab-cycle-location`); commits a segment on the second click and stays active for the next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **WP-UI-C03** | Tool — Door                                 | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes the §16.4.2 door defaults (900 × 2100, swing left, hand in) plus `flipDoorSwing` (Spacebar) and `flipDoorHand` (Tab) helpers wired against `DoorPlacement`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **WP-UI-C04** | Tool — Window                               | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes the §16.4.3 window defaults (1200 × 1500 with 900 mm sill) under the same `HostedOpeningDefaults` shape used by the Door tool.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **WP-UI-C05** | Tool — Floor / Slab                         | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `FloorState` (`mode`: `pick-walls` ↔ `sketch`, `sketchPolygonMm`, `pickedWallIds`, `thicknessMm`) plus `toggleFloorMode` for §16.4.4 Tab-toggle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **WP-UI-C06** | Tool — Roof                                 | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `RoofState` (`type` ∈ {gable, hip, flat, shed}, `slopeDeg` 35° default, `eaveOverhangMm` 600 mm, per-edge `edgeSlopes` map) plus `toggleEdgeSlope(state, edgeIdx)` for §16.4.5 per-edge slope picking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **WP-UI-C07** | Tool — Stair                                | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `computeStairRun({ baseLevelElevMm, topLevelElevMm, preferredRiserMm?, preferredTreadMm? })` which auto-computes riser/tread counts and per-riser height for the §16.4.6 two-click run, falling back to the documented defaults (175 / 280 mm).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **WP-UI-C08** | Tool — Railing                              | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `RAILING_DEFAULTS` matching the §16.4.7 spec (`horizontal-bars-5x30`, 1100 mm height, 100 mm baluster spacing × 30 mm Ø).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-UI-C09** | Tool — Room marker                          | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `centroidMm(outline)` (signed-area polygon centroid with degenerate-fallback) so the §16.4.8 marker drops in the geometric centroid of the bounded area.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-C10** | Tool — Dimension                            | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `DIMENSION_HOTKEYS` (linear `L`, aligned `A`, angular `G`, radial `Q`, diameter `Shift+Q`) and `DimensionState` + `setDimensionKind` for the §16.4.9 sub-mode flip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-C11** | Tool — Section                              | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `SectionDraftState` (`startMm`, `endMm`, `depthSign` ±1) and `flipSectionDepth` for the §16.4.10 three-click section + depth grammar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **WP-UI-C12** | Tool — Tag (subdropdown)                    | `partial` | 3 evidenced slice | ~70%             | `tools/toolGrammar.ts` exposes `TAG_FAMILIES` ({Tag Door, Tag Window, Tag Wall, Tag Room, Tag by Category}) ready for the §16.5 dropdown the ToolPalette routes via `onTagSubmenu`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **WP-UI-D01** | Command palette                             | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/cmd/commandPaletteSources.ts` exposes the §18 source-aggregation contract: `parseQuery(raw)` recognises `>` (tool), `@` (element), `:` (setting) prefixes per §18; `rankCandidates(list, query, options)` performs subsequence + prefix scoring with recent-id boost (capped at 5), priority tie-break (recent → tool → view → element → setting → agent), and `EMPTY_STATE_HINTS` provides the 5 default keyboard-shortcut hints for the palette empty state. 11-test vitest covers all prefix branches, ranking, recents boost / cap, no-match path, hint cap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-D02** | Keyboard cheatsheet (?)                     | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/cmd/cheatsheetData.ts` is the canonical §19 keyboard catalogue grouped into `Global / Workspace modes / Drawing tools / Pointer / History / Shell` sections. `flattenCheatsheet()` returns every entry; `filterCheatsheet(query)` filters by action or keys (matches against the modal's typeahead); `shouldOpenCheatsheet(event)` opens on `?` literal or `Shift+/`. 9-test vitest covers section grouping, every documented action present, full-set + filter + empty-result paths, and `?` / `Shift+/` recognition.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-UI-D03** | Mode switching (1–7)                        | `partial` | 3 evidenced slice | ~85%             | modeController.ts (`MODE_HOTKEYS`, `modeForHotkey`, capture/restore `ModeController`, Plan+3D divider snap-to-33/50/67%). Adopted in `/redesign` route — a global keydown listener routes `1`–`7` through `modeForHotkey` to `handleModeChange`, which dispatches `setViewerMode`. Plan+3D mode renders side-by-side `<PlanCanvas>` + `<Viewport>`. Section / Sheet / Schedule / Agent surface a placeholder until per-mode shells land.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-UI-E01** | Sheet mode redesign                         | `partial` | 3 evidenced slice | ~70%             | `workspace/modeSurfaces.ts` extends with the §20.5 sheet surface state: `SHEET_DEFAULTS` (50 mm snap tolerance), `moveViewport(vp, dx, dy)` (snap-to-50 mm gauge within tolerance), `resizeViewport(vp, dW, dH, minMm=200)` (clamp). 4 added vitest assertions cover defaults, snap-on-move, min clamp, positive resize.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **WP-UI-E02** | Schedule mode redesign                      | `partial` | 3 evidenced slice | ~70%             | `workspace/modeSurfaces.ts` extends with the §20.6 schedule surface state: `SCHEDULE_DEFAULTS`, `beginCellEdit(state, cell\|null)` (inline edit), `toggleColumnVisibility(state, key)` (right-rail column inspector), `cycleSort(state, key)` (none → asc → desc → none), `setFilter(state, expr)`. 5 added vitest assertions cover defaults, edit set/clear, column visibility flip, sort tri-state, filter set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WP-UI-E03** | Agent Review mode redesign                  | `partial` | 3 evidenced slice | ~70%             | `workspace/modeSurfaces.ts` extends with the §20.7 Agent Review state: `AGENT_REVIEW_DEFAULTS`, `sortAgentActions(actions)` (blocking → warning → info), `visibleAgentActions(state)` (sort + severity filter), `withSelectedManifest(state, id\|null)`, `withActionFilter(state, severity\|null)`. The pane reuses the `Icons.agent` (Sparkles) glyph from §10.1. 4 added vitest assertions cover defaults, severity sort, filter pass-through, manifest set/clear.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **WP-UI-E04** | Section / Elevation mode                    | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/workspace/modeSurfaces.ts` seeds the §20.4 Section / Elevation surface state: `SECTION_ELEVATION_DEFAULTS`, `withActiveSection(state, id)`, `withFarClip(state, mm)` (clamps negatives to 0), `withViewTemplate(state, id\|null)`. Drives plan-on-left + section-preview-on-right inspector seeding for far-clip / view-template fields. 4-test vitest covers defaults, active-section transition, far-clip clamp, view-template id/null toggle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-F01** | Seed house V2 fixture                       | `partial` | 3 evidenced slice | ~80%             | `packages/cli/lib/seed-house-v2-commands.mjs` exports `buildSeedHouseV2Commands()` with `seed-` prefixed ids per §27.3. Element counts match §27.1 exactly: levels=3 (Ground 0, Upper 3000, Roof Apex 5800), site=1 (with -50 mm terrace context), walls=16 (6 EG ext L-shape + 4 EG int + 4 OG ext set back 1 m S + 2 gable), floors=3 (EG slab, OG slab w/ cantilever, terrace at -50 mm), roof=1 (35° gable + flat over wing), doors=5, windows=7, stair=1 (17×176 mm) + slab opening shaft, railings=3 (stair / balcony / terrace), rooms=9 (5 EG + 4 OG), section_cuts=2 (A–A, B–B), plan_views=2, viewpoints=3 (Default Orbit / NE-Iso / Worm's-eye), sheet=1 (A-101 with 4 viewports + titleblock), schedules=5 (Door / Window / Room / Wall types / Material take-off). `app/tests/test_seed_house_v2_bundle.py` (6 assertions) covers prefix discipline, kind coverage, exact counts, level elevations, sheet-viewport cardinality, and saved viewpoint id. V1 fixture untouched; existing roundtrip test still passes. Visual + replay determinism baselines deferred to WP-UI-H01. |
| **WP-UI-F02** | Onboarding tour                             | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/onboarding/tour.ts` exposes the §24 5-step tour: each step targets the redesigned chrome via `[data-testid]` selectors (canvas → status bar → topbar → left rail → cheatsheet hint). `readOnboardingProgress` / `markOnboardingCompleted` / `resetOnboarding` round-trip via `localStorage.bim.onboarding-completed`; `nextStep(idx, ±1)` advances or finishes the sequence. 5-test vitest covers step roster + spec order, default progress, mark/reset, advance/clamp.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **WP-UI-F03** | Empty/loading/error states                  | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/state/uiStates.ts` exposes the §25 catalogue: `UI_STATE_PATTERNS` covers canvas-empty, canvas-loading, network-offline, engine-error, conflict-409, permission-denied with `{ severity, headline, hint, cta?, ariaLive }`. Errors use `aria-live="assertive"`; loading uses `polite`. `patternFor(kind)` accessor for renderers. 6-test vitest covers full surface set, canvas-empty CTA wiring, error politeness, loading politeness, non-empty copy invariant, accessor identity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **WP-UI-G01** | Drafting standards (line weights/hatches)   | `partial` | 3 evidenced slice | ~70%             | `packages/web/src/plan/draftingStandards.ts` is the single source of truth for §9.10 + §26: `LINE_WEIGHT_PX_AT_1_50` mirrors the spec table; `lineWidthPxFor(token, plotScale)` rescales relative to the 1:50 reference; `CATEGORY_LINE_RULES` maps spec roles (wall.cut, door.cut, window.cut, floor.projection, roof.projection, stair.tread, stair.direction, hidden, dimension.witness, construction) to `{ weight, color, dash, opacity }`; `dashArray` serialises to SVG `stroke-dasharray`; `HATCH_SPECS` covers wall.concrete (45° / 1 mm), floor.timber (0° / 0.7 mm), site.lawn (90° / 1.5 mm) with `hatchVisibleAt(plotScale)` gating ≥1:200; `gridVisibilityFor(plotScale)` mirrors §14.5 (1 m + 100 mm grid steps). 16-test vitest covers reference-scale passthrough, scale rescaling, every role + dashed/dash-dot patterns, opacity rule, hatch visibility ceiling, grid step rule, full LW table values. PlanCanvas / symbology adoption follows in WP-UI-B01.                                                                                                               |
| **WP-UI-H01** | Playwright visual regression baseline       | `partial` | 2 composed slice  | ~70%             | `packages/web/src/design-systems/visualRegressionBaselines.ts` is the manifest of every surface that needs a screenshot baseline (§8 / §11 / §12 / §13 / §14 / §15 / §16 / §17 — light + dark for the shell). `packages/web/e2e/ui-redesign-baselines.spec.ts` is now wired against the `/redesign` route with real `toHaveScreenshot` assertions (app-shell light + dark, top-bar, left-rail, right-rail, status-bar, tool-palette). Run `pnpm exec playwright test --update-snapshots` from `packages/web/` to (re)generate baselines locally. 4-test vitest covers manifest section coverage, viewport invariants, dual-theme app-shell entries, unknown-id lookup.                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 29. High-level state summary

- The engineering parity v1 is closed (`e1a43586`); UI/UX redesign is the next track and is independent of post-v1 production-fitness work (raster export, IFC certification, scale, etc.).
- All `WP-UI-*` rows above start at `partial` or below; none are `done`. Every UI redesign wave should drive a subset of these toward §4's done-rule.
- The redesign's first wave should focus on the foundation rows: `WP-UI-A01` (tokens), `WP-UI-A02` (icons), `WP-UI-A07` (layout grid), `WP-UI-A08` (theming), `WP-UI-F01` (seed house V2). Without those, all surface work shifts color/pixel values that need re-doing later.
- The redesign explicitly does NOT block on engineering production-fitness work; it can ship pilot-ready UX while the deeper IFC / raster / scale tracks proceed in parallel.

---

## 30. Immediate backlog seeds (next-wave candidates)

| Seed                                                                                                                                                                                   | WP target                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Foundations: tokens, icons, layout grid, theming.                                                                                                                                      | WP-UI-A01, WP-UI-A02, WP-UI-A07, WP-UI-A08.            |
| Seed house V2 fixture: balcony, terrace, pitched roof, cladding.                                                                                                                       | WP-UI-F01.                                             |
| 3D viewport: real OrbitControls + ViewCube.                                                                                                                                            | WP-UI-B04, WP-UI-B06.                                  |
| Tool palette + Wall/Door/Window/Section drawing flows.                                                                                                                                 | WP-UI-C01, WP-UI-C02, WP-UI-C03, WP-UI-C04, WP-UI-C11. |
| App shell: TopBar + StatusBar + rails.                                                                                                                                                 | WP-UI-A03, WP-UI-A04, WP-UI-A05, WP-UI-A06.            |
| Mode switching (1–7) + Plan+3D split.                                                                                                                                                  | WP-UI-D03, WP-UI-A07.                                  |
| Empty/loading/error states + onboarding tour.                                                                                                                                          | WP-UI-F02, WP-UI-F03.                                  |
| Visual regression baseline + a11y baseline.                                                                                                                                            | WP-UI-H01, WP-UI-A10.                                  |
| ~~Vitest harness collides with Playwright `e2e/*.spec.ts` files~~ Resolved by scoping `app/scripts/ci-gate-all.sh` vitest gate to `src` (matches `pnpm test`); all six gates now pass. | Resolved (no remaining WP).                            |

These seeds can be packaged as another 8-prompt wave when the user is ready. They are intentionally parallel-safe at the file-ownership level: tokens, icons, seed-house, 3D-controls, tool-palette, app-shell, mode-switch, and visual-regression each touch distinct files.

---

## 31. Update protocol

This document is operated identically to the engineering tracker:

1. Each redesign wave adds a row to §6 (Recent Sprint Ledger) at the top, listing its eight prompts and their commits.
2. `WP-UI-*` rows in §28 update `State` / `Maturity` / `Approx. progress` based on §4's done-rule. A row should not move to `done` until §4 is met.
3. The `Approx. UX parity` column in §5 is recomputed once per wave from §28 maturity centers.
4. Spec changes (e.g., re-scoping a tool's behavior) MUST land as edits to the relevant section, with a one-line note in §6 explaining the rationale.
5. New element classes / new modes are reflected in the affected sections AND in §28 as new `WP-UI-*` rows (do not silently add scope).
6. Prettier-format this file before committing. Long table rows are expected; pre-existing prettier-converge issues in the engineering tracker do not apply here because §28 is the only large table and is composed of short cells.
7. Never delete a `WP-UI-*` row; mark it `deferred` and add a note.

---

## 32. Visual-fidelity gap audit (post-route-flip)

After flipping the redesigned shell to `/` and capturing Playwright baselines (commits `04ac8023` → `dddda700`), a user-driven walkthrough surfaced fourteen visible polish gaps. Every gap below is grounded in a concrete file path + line. These are the next sprint's targets — they push existing `partial` WP rows toward §4's done rule rather than introducing new WPs.

| ID  | Surface                  | Symptom                                                                                                                                                                                                                       | File / line                                                  | Fix sketch                                                                                                                                                                                                          | Target WP                                                                                          |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| V01 | Plan canvas / 3D viewport | Canvas wrappers cap height at `min(740px, calc(100vh - 260px))` with `rounded-lg border bg-background` — pre-redesign artifact creates ~30 % whitespace below the canvas inside the AppShell main slot.                       | `packages/web/src/Viewport.tsx:1012` + `plan/PlanCanvas.tsx:710` | Collapse wrapper to `relative h-full w-full overflow-hidden`. Let AppShell own the framing.                                                                                                                         | WP-UI-A07 (layout grid done-rule), WP-UI-B01–B04 (canvas surfaces).                                |
| V02 | Empty-state CTA          | `canvas-empty` UI pattern declares `cta: { label: 'Insert seed house', action: 'project.insert-seed' }` but `EmptyStateOverlay` only renders headline + hint. No clickable affordance.                                        | `RedesignedWorkspace.tsx:562` + `state/uiStates.ts:35`       | Render the CTA button inside `EmptyStateOverlay`. Wire `project.insert-seed` to call the seed-house insertion API (already implemented in legacy `Workspace.tsx`).                                                  | WP-UI-F02 / F03 (empty-state + onboarding).                                                        |
| V03 | TopBar Project menu      | Empty-state copy says "insert the seed house from the Project menu" but the redesigned chrome has no Project menu. The hamburger top-left toggles the left rail; the project-name pill is a label.                           | `workspace/TopBar.tsx`                                       | Either (a) build a real Project menu dropdown next to the project-name pill (per §11.1 anatomy: chevron + recent + "New / Open / Save"), or (b) rewrite the empty-state copy to reference the W hotkey + the new CTA. | WP-UI-A03 (TopBar done-rule).                                                                      |
| V04 | ViewCube                 | Renders as a 2D unfolded face-cross + flat list of NE-Iso / NW-Iso / SE-Iso / SW-Iso buttons. Reads as broken UX for any AEC user — Revit / Navisworks / SketchUp all use an interactive 3D cube widget.                       | `packages/web/src/viewport/ViewCube.tsx`                     | Replace `FaceCross` + `CornerEdgeRow` with a small Three.js-rendered cube (96 × 96 px, perspective camera, raycaster on the 26 picks: 6 faces / 12 edges / 8 corners). Keep the existing `ViewCubePick` emit shape. | WP-UI-B06 (ViewCube done-rule).                                                                    |
| V05 | Saved 3D viewpoint HUD   | Bottom-right HUD shows verbose body copy ("Select a saved orbit viewpoint in Project browser to inspect persisted clip and hidden-category state.") even when no viewpoint is active — dominates the canvas corner.            | `Viewport.tsx` (`OrbitViewpointPersistedHud`)                | Hide the HUD when `activeViewpointId === null`; collapse to a single-line pill ("3D viewpoint: —") when always-visible.                                                                                             | WP-UI-B04 / E07 (3D viewport polish).                                                              |
| V06 | Canvas paint vs theme    | Plan canvas reads near-black even in light theme — `--draft-paper` is `hsl(40 30% 99%)` (modern space-separated CSS Level 4). Three.js's `Color.set()` may not parse that consistently; under some browsers it falls back to `#000`. | `plan/PlanCanvas.tsx:290` + `tokens-drafting.css:14`         | Either (a) raise tokens-drafting.css to hex literals (`--draft-paper: #fdfdfb`) so Three.js's parser sees a known-good form, or (b) thread token reads through a `cssColorToHex()` helper that resolves modern syntax. | WP-UI-A01 (tokens done-rule), WP-UI-B07 (3D materials).                                            |
| V07 | Wall draw not perceived  | User reports walls do not draw. Pointer-event audit: `EmptyStateOverlay` correctly sets `pointerEvents: 'none'`; `FloatingPalette` is positioned top-center with `zIndex: 10` and DOES capture clicks in its band.                | `RedesignedWorkspace.tsx:477` + `plan/PlanCanvas.tsx:372–`   | Add a vitest integration that exercises wall-draw via the redesigned chrome; reduce FloatingPalette's pointer footprint (drop the wrapping `div` to only the toolbar's bounds).                                       | WP-UI-C02 (Wall tool done-rule).                                                                   |
| V08 | Body / shell margins     | Screenshot shows a thin dark band above the AppShell topbar — likely user-agent default body margin or a stale `min-h-screen` bg-paint. AppShell uses `minHeight: '100vh'` not `height: '100vh'`.                              | `index.html` (body class) + `design-systems/default.css`     | Add explicit `:root, html, body { margin: 0; padding: 0 }` to default.css; switch AppShell to `height: 100vh` so it never under-fills the viewport.                                                                  | WP-UI-A07 (layout grid).                                                                           |
| V09 | Project Browser rows     | Levels / Floor Plans / 3D Views / Sections / Sheets / Schedules render but only level rows respond to clicks (set active level). No double-click-to-open, no context menu, no drag-to-sheet.                                  | `workspace/RedesignedWorkspace.tsx:392`                      | Wire `onRowActivate` to dispatch by row kind (plan_view → switch level + plan mode; viewpoint → 3D mode + applyViewpoint; section_cut → section mode + active id; sheet → sheet mode + active id; schedule → schedule mode + active id). | WP-UI-A04 (Project Browser done-rule).                                                             |
| V10 | Project switcher pill    | "BIM AI seed" project-name pill in TopBar is not a menu trigger. Per §11.1 a chevron + dropdown is required (recent projects, New, Open from disk, Save).                                                                      | `workspace/TopBar.tsx`                                       | Build the dropdown. For local-only persistence, the dropdown lists the in-memory project + "New (clear)" + "Save snapshot to localStorage" + "Restore snapshot".                                                    | WP-UI-A03.                                                                                         |
| V11 | Theme refresh on canvas  | Theme toggle re-paints chrome but Three.js materials are built once per mount. On theme switch, existing materials still hold the old token colors.                                                                            | `Viewport.tsx` (mount effect) + `plan/PlanCanvas.tsx`        | Subscribe to the theme-change signal (`useBimStore` selector on `theme`) and rebuild `paintBundle` + walk material registry to update colors.                                                                       | WP-UI-A08 (theming done-rule), WP-UI-B07 (3D materials).                                          |
| V12 | Tool palette + HUD overlap | Top-floating tool palette and the inline canvas-mode HUD ("Plan · pan Shift+LMB / MMB · …") both sit at the top of the canvas. The HUD duplicates the StatusBar tool readout.                                                  | `Viewport.tsx:1014` + `plan/PlanCanvas.tsx:712`              | Drop the inline canvas-mode HUD (already covered by StatusBar). Raise tool-palette icon size to 18 px.                                                                                                              | WP-UI-C01 (tool palette done-rule).                                                                |
| V13 | Iso-corner buttons       | NE-Iso / NW-Iso / SE-Iso / SW-Iso render as a flat horizontal list near the top of the 3D canvas — no visual grouping with the ViewCube. Looks like loose orphan chips.                                                       | `viewport/ViewCube.tsx:149`                                  | Resolved by V04: corners pick directly on the 3D cube (no separate iso row).                                                                                                                                        | WP-UI-B06.                                                                                         |
| V14 | Inspector quick-actions  | "Quick actions" rows ("Draw a wall · W", "Insert a door · D", "Drop a room marker · M") are not buttons — clicking does nothing. Hotkey hints are accurate but the rows look interactive.                                       | `workspace/Inspector.tsx` (empty-state actions)              | Render each row as a real `<button>` whose click dispatches the same path as the W / D / M hotkey (set `planTool` + switch to plan mode if needed).                                                                  | WP-UI-A05 (Inspector done-rule).                                                                   |
| V15 | View-tabs (Revit-style)  | The chrome currently has a single "active mode" pill row but no way to keep multiple specific views (a level's plan, a 3D viewpoint, a section, a sheet) open at once. Switching modes wipes the prior canvas; users have to re-navigate the Project Browser.                                                                | `workspace/RedesignedWorkspace.tsx` (canvas mount) + `TopBar.tsx` | Add a `TabBar` between TopBar and canvas (`§11.3`). Each open view is a tab with kind icon + label + close ✕. Project Browser double-click opens a tab; mode pill clicks activate-or-create a tab of that kind; `Ctrl/⌘+Tab` cycles tabs; `Ctrl/⌘+W` closes the active tab. Tabs persist across mode switches. | WP-UI-A12 (new) — view tabs.                                                                       |

### 32.1 Conservative preview design system

`~/repos/hof-os`'s `tokens-conservative.css` (slate / navy enterprise palette, Source Serif 4, tight 0–0.25 rem radii) is borrowed into the BIM AI repo as a preview-only design system. Source files:

- `packages/design-tokens/src/conservative/tokens-conservative.css` — core token set + bridge aliases that map hof's `--color-*` namespace onto BIM AI's `--color-surface-strong` / `--color-border-strong` / `--color-accent-soft` / `--color-warning` / `--color-danger` / `--color-info` / `--color-ring` so existing components don't need to be rewritten.
- `packages/design-tokens/src/conservative/conservative.css` — wraps the tokens + reuses BIM AI's `tokens-drafting.css` so the plan canvas stays paper-like even when the chrome is conservative.
- `packages/web/src/design-systems/conservative.css` — web-side entry that the Vite alias points at when `VITE_DESIGN_SYSTEM=conservative`.

To preview locally:

```sh
VITE_DESIGN_SYSTEM=conservative pnpm --filter @bim-ai/web dev
```

This swap is non-destructive — `default` remains the production chrome.
