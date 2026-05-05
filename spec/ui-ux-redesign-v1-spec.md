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

| Area                        | State     | Maturity center     | Approx. UX parity | Current read                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | --------- | ------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell                   | `partial` | 2 composed slice    | ~35%              | `workspace/AppShell.tsx` is the canonical 5-zone grid driven by `--shell-*` sizing tokens with `[`/`]` rail-toggle hotkeys; slot props expose TopBar/leftRail/canvas/rightRail/statusBar. Existing `Workspace.tsx` has not yet adopted it — TopBar / Inspector / StatusBar fillers follow in WP-UI-A03–A06.                                               |
| 2D Plan canvas              | `partial` | 2 composed slice    | ~45%              | `PlanCanvas.tsx` renders projection wires, snap, drawing for walls/doors/windows/rooms. Drafting line weights, contour overlay, paper-feel background, snap-tracking tooltips, marquee select, copy/paste are missing.                                                                                                                                    |
| 3D Viewport                 | `partial` | 2 composed slice    | ~30%              | `Viewport.tsx` is a hand-rolled spherical orbit rig over Three.js. No OrbitControls, no ViewCube, no zoom-to-cursor, no pan, no walk mode, no predefined orthographic views, no gizmo. Materials are flat colors.                                                                                                                                         |
| Tool palette / top ribbon   | `pending` | 0 sketch            | ~5%               | Tools live in mixed `Btn` rows inside the left column. No grouped palette, no top-floating ribbon, no tool tooltips with shortcut hints, no tool-mode persistence indicator.                                                                                                                                                                              |
| Project Browser (left rail) | `partial` | 2 composed slice    | ~40%              | `ProjectBrowser.tsx` renders a list with template/crop/range fields. Hierarchy (Floor Plans / Ceiling Plans / 3D Views / Elevations / Sections / Schedules / Sheets / Families) is flat; no expand/collapse, no icons.                                                                                                                                    |
| Inspector (right rail)      | `partial` | 2 composed slice    | ~35%              | Per-tool side-panels exist. Type-vs-instance distinction, parameter tabs, "Apply / Reset" affordance, on-canvas dimension witness lines for selected element are missing.                                                                                                                                                                                 |
| Status bar / footer         | `pending` | 0 sketch            | ~5%               | Coordinates `X 10.00m  Y 9.00m` print inside the canvas bottom-left. No bar with snap-mode toggles, current level, ws status, undo depth, save state.                                                                                                                                                                                                     |
| Command palette + shortcuts | `partial` | 2 composed slice    | ~40%              | `CommandPalette` and `Cheatsheet` exist. Shortcut map is not curated; many primary actions still require pointer.                                                                                                                                                                                                                                         |
| Theming                     | `partial` | 3 evidenced slice   | ~70%              | Full §9 token set lands in `@bim-ai/design-tokens` (chrome / drafting / categories) and `state/theme.ts` is the canonical controller (light default, `data-theme="dark"`, hash + storage + `prefers-color-scheme` cascade, `prefersReducedMotion` exposed). Component code never branches on theme. Surface adoption sweep (chrome lit-up) still pending. |
| Iconography                 | `partial` | 2 composed slice    | ~65%              | `@bim-ai/ui` exposes the full §10.1 lucide-react registry with `aria-label` defaults, default size tokens, and a documented `StairsIcon` gap-fill. Surface adoption (TopBar/Inspector/StatusBar/tool palette) still pending per A03/A05/A06/C01.                                                                                                          |
| Seed house fixture          | `partial` | 2 composed slice    | ~50%              | `packages/cli/lib/one-family-home-commands.mjs` produces a 2-storey rectangular volume with 15 walls, 7 doors, 5 windows, 1 stair, 1 roof, 8 rooms — but no balcony, no terrace, no pitched gable, no cladding distinctions.                                                                                                                              |
| Accessibility               | `pending` | 0 sketch            | ~10%              | `aria-*` is sparse; focus ring inconsistent; no live-region; canvas tools are pointer-only.                                                                                                                                                                                                                                                               |
| Motion                      | `pending` | 0 sketch            | ~5%               | No documented motion grammar.                                                                                                                                                                                                                                                                                                                             |
| Onboarding / empty states   | `partial` | 1 token / primitive | ~30%              | `Welcome` panel exists; canvas has no "empty / press W to draw a wall" state.                                                                                                                                                                                                                                                                             |

---

## 6. Recent Sprint Ledger

| Source                                                     | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Tracker effect                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **WP-UI-A07 App shell layout grid + breakpoints** (`main`) | Authored `packages/web/src/workspace/AppShell.tsx` as the canonical 5-zone CSS grid (topbar / leftRail / canvas / rightRail / statusBar) sized from `--shell-*` tokens; `[` / `]` toggle the rail collapsed-vs-icon state, ignoring keys while the user is typing in inputs/textareas/selects/contenteditable. Slot props (`topBar`, `leftRail`, `leftRailCollapsed`, `canvas`, `rightRail`, `statusBar`) keep AppShell pure layout; surface composition stays with TopBar/Inspector/StatusBar WPs. Added `AppShell.test.tsx` (7 assertions) covering slot rendering, grid template, hotkey toggling, input-focus exclusion, and seeded defaults. Validation: web typecheck clean; src vitest 769 tests pass.                                                                                                                                                                                                                                                                                                                                                               | WP-UI-A07 → `partial` (~70%) maturity 3 evidenced slice. UX dashboard "App shell" row +15%.   |
| **WP-UI-A08 Theming (light primary; dark)** (`main`)       | Authored `packages/web/src/state/theme.ts` as the canonical theme controller per §23. Light is the default; dark activates via `data-theme="dark"` (and the legacy `.dark` class for back-compat). Resolution priority: `#theme=…` URL hash → `localStorage["bim.theme"]` → `prefers-color-scheme`. `applyTheme(theme)` writes to all three; `toggleTheme()` flips and returns the new value; `initTheme()` is the idempotent boot hook; `prefersReducedMotion()` exposes the §21 motion override. `state/store.ts` re-exports the public surface so existing call-sites (`main.tsx`, `Workspace.tsx`) work unchanged. Added `state/theme.test.ts` (12 assertions) covering cascade priority, idempotent boot, hash + storage round-trip, and reduced-motion media query. Validation: web typecheck clean; src vitest 762 tests pass.                                                                                                                                                                                                                                       | WP-UI-A08 → `partial` (~80%) maturity 3 evidenced slice. UX dashboard "Theming" row +20%.     |
| **WP-UI-A02 Iconography (lucide-react)** (`main`)          | Authored `packages/ui/src/icons.tsx` as the single chrome icon registry: `Icons` map covers every §10.1 concept (select, wall, door, window, floor, roof, stair, railing, room, dimension, section, sheet, schedule, family, saveViewpoint, layer toggle, viewCubeReset, undo/redo, themeLight/Dark, commandPalette, search, settings, hamburger, collaborators, close, externalLink, proportional, disclosureClosed/Open, agent, evidence, advisorWarning, online, snap, grid, tag), `IconLabels` provides defaults for `aria-label` (§22), `ICON_SIZE` exposes the §10 size scale (chrome 16 / toolPalette 18 / topbar 20). Lucide gap-fill: `StairsIcon` is a documented custom SVG (`stairs` is missing from lucide-react@0.574); Wall maps to `BrickWall` with `Slash` exposed as alt. Re-exported from `@bim-ai/ui`. Added `packages/web/src/design-systems/icons.test.tsx` (108 assertions) asserting registry exposure, label coverage, SVG render, and StairsIcon size/stroke contract. Validation: ui + web typecheck clean; design-systems suite 216 tests pass. | WP-UI-A02 → `partial` (~75%) maturity 3 evidenced slice. UX dashboard "Iconography" row +60%. |
| **WP-UI-A01 Design token foundation** (`main`)             | Authored §9 tokens as the canonical source under `packages/design-tokens/src/tokens-default.css` (light chrome, spacing, radius, typography, elevation, motion + shell sizing), `tokens-dark.css` (dark chrome overrides + flattened elevation), and `tokens-drafting.css` (canvas-only drafting palette §9.2, element categories §9.3, line weights §9.10 — both themes). Extended `tailwind-preset.ts` to expose semantic chrome / drafting / category colors, fontSize, spacing, radius, boxShadow (`elev-*`), motion durations + easings, shell sizing, and `shell-md`/`shell-lg`/`reduce-motion` variants. Added `packages/web/src/design-systems/tokens.test.ts` (108 assertions) verifying every spec'd token name lands in default + dark + drafting; web `default.css` now imports the three canonical files via `@bim-ai/design-tokens/*`; orphaned `packages/web/src/design-systems/tokens-default.css` removed; `@types/node` added to web devDeps so test-side fs reads typecheck cleanly. Validation: web typecheck clean; `pnpm test` 642 tests pass.        | WP-UI-A01 → `partial` (~80%) maturity 3 evidenced slice. UX dashboard "Theming" row +25%.     |
| **Spec authored** (date: 2026-05-05)                       | This document. No code change. Defines `WP-UI-*` rows below as the redesign's source of truth and records explicit deferrals to UX-V2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Establishes UI redesign baseline; no engineering parity rows changed.                         |

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

| WP id         | Area                                        | State     | Maturity            | Approx. progress | Acceptance summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------- | --------- | ------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WP-UI-A01** | Design token foundation                     | `partial` | 3 evidenced slice   | ~80%             | All §9 tokens land in `packages/design-tokens/src/tokens-default.css` + `tokens-dark.css` + `tokens-drafting.css`; tailwind preset extended (chrome / drafting / category colors, spacing, radius, fontSize, elevation, motion, shell sizing, breakpoint variants); 108-assertion vitest covers branch logic; canvas hex audit deferred to G01/B07/B01.                                                                                                                                                                                                                                                    |
| **WP-UI-A02** | Iconography (lucide-react)                  | `partial` | 3 evidenced slice   | ~75%             | `@bim-ai/ui` exposes the §10.1 chrome icon registry with `aria-label` defaults and §10 size scale; `StairsIcon` covers the documented lucide gap; chrome adoption (TopBar/Inspector/StatusBar) follows in WP-UI-A03/A05/A06; canvas SVG audit lives under WP-UI-G01.                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-A03** | App shell — TopBar                          | `pending` | 0 sketch            | ~10%             | TopBar at §11 spec; mode pills keyboard-traversable; project-name dropdown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **WP-UI-A04** | App shell — Left rail (Project Browser)     | `partial` | 2 composed slice    | ~40%             | §12 hierarchy; tree role; F2-rename; collapsed icon strip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **WP-UI-A05** | App shell — Right rail (Inspector)          | `partial` | 2 composed slice    | ~35%             | §13 tabs; type-vs-instance; expression eval in numeric fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WP-UI-A06** | App shell — StatusBar                       | `pending` | 0 sketch            | ~5%              | §17 cluster set; aria-live; snap-mode toggles; level switcher.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WP-UI-A07** | App shell — layout grid + breakpoints       | `partial` | 3 evidenced slice   | ~70%             | `packages/web/src/workspace/AppShell.tsx` is the canonical 5-zone CSS grid (topbar / left rail / canvas / right rail / status bar) sized from `--shell-*` tokens. `[` toggles left rail collapsed-vs-icon-strip; `]` toggles right rail; both ignore key events while typing in inputs/textareas/selects. `defaultLeftCollapsed` + `defaultRightCollapsed` props let mode-specific surfaces seed the layout. 7-test vitest covers slot rendering, grid template, hotkey toggle, input-focus exclusion, and seeded defaults. Adoption inside `Workspace.tsx` follows in the TopBar/Inspector/StatusBar WPs. |
| **WP-UI-A08** | Theming (light primary; dark)               | `partial` | 3 evidenced slice   | ~80%             | `state/theme.ts` is the canonical controller (light default; dark via `data-theme="dark"`+ legacy `.dark` class). Resolution priority: `#theme=…` URL hash > `localStorage` > `prefers-color-scheme`. Toggle persists to all three. `prefersReducedMotion()` exposed for §21. `state/store.ts` re-exports the public API for back-compat. 12-test vitest suite covers cascade and toggling.                                                                                                                                                                                                                |
| **WP-UI-A09** | Motion grammar                              | `pending` | 0 sketch            | ~5%              | §21 motion tokens applied; reduced-motion honored.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **WP-UI-A10** | Accessibility baseline                      | `pending` | 0 sketch            | ~10%             | §22 acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-B01** | 2D Plan canvas — drafting visuals           | `partial` | 2 composed slice    | ~45%             | §14.2 line weights, paper, grid; cut/projection/hidden discipline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **WP-UI-B02** | 2D Plan canvas — pointer + snap grammar     | `partial` | 2 composed slice    | ~40%             | §14.3 + §14.4 pointer & snap modes; tracking lines & snap pill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-B03** | 2D Plan canvas — zoom/pan/level/empty state | `partial` | 2 composed slice    | ~40%             | §14.5 / §14.6 / §14.7.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-B04** | 3D Viewport — controls (orbit/pan/dolly)    | `partial` | 1 token / primitive | ~20%             | §15.3; introduce `OrbitControls`-equivalent; replace ad-hoc spherical rig.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **WP-UI-B05** | 3D Viewport — walk mode                     | `pending` | 0 sketch            | ~0%              | §15.3 walk grammar; `WASD + mouselook + shift-run + Esc`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **WP-UI-B06** | 3D Viewport — ViewCube                      | `pending` | 0 sketch            | ~0%              | §15.4 fully spec'd.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **WP-UI-B07** | 3D Viewport — materials & lighting          | `partial` | 1 token / primitive | ~20%             | §15.5 PBR-light; theme-aware material rebuild.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WP-UI-B08** | 3D Viewport — section box & clipping        | `pending` | 0 sketch            | ~0%              | §15.6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-C01** | Tool palette (top-floating)                 | `pending` | 0 sketch            | ~5%              | §16 layout; tool buttons; per-mode contents; hotkey overlays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **WP-UI-C02** | Tool — Wall                                 | `partial` | 2 composed slice    | ~50%             | §16.4.1 grammar; chain mode; location-line cycle; live preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-C03** | Tool — Door                                 | `partial` | 2 composed slice    | ~45%             | §16.4.2; spacebar flip; arrow-key nudge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-UI-C04** | Tool — Window                               | `partial` | 2 composed slice    | ~45%             | §16.4.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-UI-C05** | Tool — Floor / Slab                         | `partial` | 2 composed slice    | ~35%             | §16.4.4; pick-walls vs sketch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **WP-UI-C06** | Tool — Roof                                 | `partial` | 1 token / primitive | ~25%             | §16.4.5; per-edge slope picker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-C07** | Tool — Stair                                | `partial` | 1 token / primitive | ~20%             | §16.4.6; auto-compute risers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **WP-UI-C08** | Tool — Railing                              | `pending` | 0 sketch            | ~5%              | §16.4.7.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-UI-C09** | Tool — Room marker                          | `partial` | 2 composed slice    | ~50%             | §16.4.8.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-UI-C10** | Tool — Dimension                            | `partial` | 1 token / primitive | ~20%             | §16.4.9; angular/radial/diameter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **WP-UI-C11** | Tool — Section                              | `partial` | 2 composed slice    | ~40%             | §16.4.10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **WP-UI-C12** | Tool — Tag (subdropdown)                    | `pending` | 0 sketch            | ~5%              | §16.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-D01** | Command palette                             | `partial` | 2 composed slice    | ~40%             | §18; cmdk; recent + tools + views + elements + settings + agent sources.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **WP-UI-D02** | Keyboard cheatsheet (?)                     | `partial` | 1 token / primitive | ~30%             | §19; modal on `?`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **WP-UI-D03** | Mode switching (1–7)                        | `pending` | 0 sketch            | ~10%             | §7 modes; persisted state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **WP-UI-E01** | Sheet mode redesign                         | `partial` | 1 token / primitive | ~30%             | §20.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-E02** | Schedule mode redesign                      | `partial` | 1 token / primitive | ~25%             | §20.6; inline editing; column/filter inspector.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-E03** | Agent Review mode redesign                  | `partial` | 2 composed slice    | ~40%             | §20.7; pane uses Sparkles icon.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **WP-UI-E04** | Section / Elevation mode                    | `pending` | 0 sketch            | ~15%             | §20.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **WP-UI-F01** | Seed house V2 fixture                       | `partial` | 2 composed slice    | ~50%             | §27 element list + acceptance tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-F02** | Onboarding tour                             | `partial` | 1 token / primitive | ~25%             | §24.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-F03** | Empty/loading/error states                  | `pending` | 0 sketch            | ~10%             | §25.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-G01** | Drafting standards (line weights/hatches)   | `partial` | 1 token / primitive | ~25%             | §26.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **WP-UI-H01** | Playwright visual regression baseline       | `pending` | 0 sketch            | ~5%              | One baseline per surface (§14, §15, §16, §17, §11, §12, §13). Refresh on token changes via dedicated CI gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## 29. High-level state summary

- The engineering parity v1 is closed (`e1a43586`); UI/UX redesign is the next track and is independent of post-v1 production-fitness work (raster export, IFC certification, scale, etc.).
- All `WP-UI-*` rows above start at `partial` or below; none are `done`. Every UI redesign wave should drive a subset of these toward §4's done-rule.
- The redesign's first wave should focus on the foundation rows: `WP-UI-A01` (tokens), `WP-UI-A02` (icons), `WP-UI-A07` (layout grid), `WP-UI-A08` (theming), `WP-UI-F01` (seed house V2). Without those, all surface work shifts color/pixel values that need re-doing later.
- The redesign explicitly does NOT block on engineering production-fitness work; it can ship pilot-ready UX while the deeper IFC / raster / scale tracks proceed in parallel.

---

## 30. Immediate backlog seeds (next-wave candidates)

| Seed                                                                                                                                                                                                                                                                                                                | WP target                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Foundations: tokens, icons, layout grid, theming.                                                                                                                                                                                                                                                                   | WP-UI-A01, WP-UI-A02, WP-UI-A07, WP-UI-A08.            |
| Seed house V2 fixture: balcony, terrace, pitched roof, cladding.                                                                                                                                                                                                                                                    | WP-UI-F01.                                             |
| 3D viewport: real OrbitControls + ViewCube.                                                                                                                                                                                                                                                                         | WP-UI-B04, WP-UI-B06.                                  |
| Tool palette + Wall/Door/Window/Section drawing flows.                                                                                                                                                                                                                                                              | WP-UI-C01, WP-UI-C02, WP-UI-C03, WP-UI-C04, WP-UI-C11. |
| App shell: TopBar + StatusBar + rails.                                                                                                                                                                                                                                                                              | WP-UI-A03, WP-UI-A04, WP-UI-A05, WP-UI-A06.            |
| Mode switching (1–7) + Plan+3D split.                                                                                                                                                                                                                                                                               | WP-UI-D03, WP-UI-A07.                                  |
| Empty/loading/error states + onboarding tour.                                                                                                                                                                                                                                                                       | WP-UI-F02, WP-UI-F03.                                  |
| Visual regression baseline + a11y baseline.                                                                                                                                                                                                                                                                         | WP-UI-H01, WP-UI-A10.                                  |
| Vitest harness collides with Playwright `e2e/*.spec.ts` files (3 collected files fail when `vitest run` is invoked without the `src` filter). Pre-existing, surfaced by `app/scripts/ci-gate-all.sh`. Fix: scope the gate's vitest call to `src` (mirroring `pnpm test`) or add a vitest config exclude for `e2e/`. | WP-UI-H01.                                             |

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
