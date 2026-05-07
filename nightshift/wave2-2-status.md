# Wave-2 Agent 2 — End-of-shift status

**Branch:** `wave2-2`
**Theme:** in-place editing keystone (EDT-01 walls-only) + EDT-05 snap-engine upgrade
**Worktree:** `/Users/jhoetter/repos/bim-ai-wave2-2`

## Shipped

### EDT-05 — Snap-engine upgrade (`partial`)

Built on the cherry-picked WIP from `eabe0eb2` (nightshift-7). Closed out the load-bearing slice:

- **Producers** for `intersection` / `perpendicular` / `extension` are wired into `snapPlanCandidates({ lines })`. Tolerance honoured; ranking is `endpoint > intersection > perpendicular > extension > grid`. `tangent` kind reserved (no curved elements yet — glyph hookup ready for when arcs land).
- **`SnapGlyphLayer`** — new HTML/SVG overlay above the canvas. Renders `endpoint` square, `intersection` ×, `perpendicular` ⊥, `extension` dot + dashed line back to source segment. Lower-left label channel drives the active-kind readout and the Tab-cycle hint (`1/3 · Tab`).
- **`snapTabCycle`** — pure controller. Tab during draw advances the active candidate; signature-based resync resets the index when the candidate set changes underneath the cursor.
- **`snapSettings` + `SnapSettingsToolbar`** — per-kind toggles (`endpoint`/`midpoint`/`intersection`/`perpendicular`/`extension`/`grid`), persisted to `localStorage` under `bim-ai.plan.snapSettings.v1`. Filter applied before the glyph layer renders. Reset-to-defaults button.
- **PlanCanvas integration** — parallel pipeline runs alongside the legacy `SnapEngine`-class torus: while a draw tool is active, `snapPlanCandidates({ lines: collectSnapLines(...) })` produces the candidate list, the active candidate's screen position drives the new glyph layer, Tab cycles, settings filter, and the layer hides when no draw tool is active.

### EDT-01 — Universal grip + temp-dimension protocol (`partial`, walls-only)

- **`gripProtocol.ts`** — `GripDescriptor` + `ElementGripProvider` shape from spec §EDT-01. `wallGripProvider` emits four grips per wall:
  - `:start` square (endpoint, free axis) → `moveWallEndpoints`
  - `:end` square (endpoint, free axis) → `moveWallEndpoints`
  - `:move` circle (midpoint, free axis) → `moveWallDelta`
  - `:thickness` arrow on the cut edge (`normal_to_element`) → `updateElementProperty thicknessMm` (clamped ≥ 20 mm)
  - Each grip exposes `onDrag` (returns a draft mutation for live preview), `onCommit` (engine command), `onNumericOverride` (typed-value commit; for endpoints this snaps to exact wall length anchored at the other endpoint).
- **`tempDimensions.ts`** — `wallNeighbours` finds nearest wall per cardinal direction (left/right/above/below); `wallTempDimensions` emits up to four `TempDimTarget`s per selected wall. `onClick` commits `createDimension` against the active level. `onLockToggle` returns the EDT-02 placeholder `tempDimLockToggleNoop` so the canvas can render the lock chip + "Constraint locks land in EDT-02" tooltip without silently swallowing the click.
- **`GripLayer.tsx` + `TempDimLayer.tsx`** — HTML/SVG overlays. Grip handles are absolute-positioned divs with `pointerEvents: 'auto'` so they take hover priority before the Three.js raycast. Temp-dim layer paints faint blue dashed lines + a clickable distance readout button + a lock chip with the EDT-02 tooltip.
- **PlanCanvas integration**:
  - Pointer-down on a grip sets `gripDragRef`, captures the start world-mm, calls `onDrag({0,0})` to seed the draft preview.
  - `onMove` while in grip-drag mode computes delta (cursor world-mm − start), updates `draftMutation` for live preview.
  - `onUpWindow` commits via `onCommit(delta)` (or `onNumericOverride(parsedNumber)` if the user typed a number) and dispatches through `onSemanticCommand`. Drags shorter than 1 mm are ignored.
  - `onKey` while in grip-drag mode: Esc cancels (no command fires), digits/`.` build a numeric input shown at the cursor, Backspace edits, Enter commits via `onNumericOverride`.
  - Grip layer renders above the canvas; temp-dim layer renders when the selection is exactly one wall.

### Deferred (mark in tracker note as `partial`)

- Door / window / floor / column / beam / section / dimension / reference-plane grips — each ≈ 0.5 d of follow-up using the same protocol.
- Lock toggle on temp dimensions — EDT-02 territory; the icon renders today but the click no-ops with the "Constraint locks land in EDT-02" tooltip.
- 3D viewport grip support — EDT-03 territory.
- Tool grammar polish (chain / multiple / tag-on-place) — EDT-06 territory.
- Snap kinds beyond intersection / perpendicular / extension (parallel ∥, workplane cube glyph) — out of EDT-05 load-bearing slice.

## Tests

- New: `gripProtocol.test.ts`, `GripLayer.test.tsx`, `tempDimensions.test.ts`, `SnapGlyphLayer.test.tsx`, `SnapSettingsToolbar.test.tsx`, `snapTabCycle.test.ts`, `snapSettings.test.ts`, plus EDT-05 producer tests appended to `snapEngine.test.ts`.
- All web vitest pass: 163 files / 1833 tests (was 162 / 1800 on main).
- `pnpm typecheck` clean. `pnpm lint` shows the same 2 pre-existing warnings as `main` (pre-existing `sectionCutFromWall` import, unrelated `frameMat`); no new warnings.

## Visual verification

`pnpm dev` boots cleanly; `vite` transforms `PlanCanvas.tsx`, `SnapGlyphLayer.tsx`, `GripLayer.tsx`, `SnapSettingsToolbar.tsx` without errors and the workspace HTML serves HTTP 200. Interactive drag of a wall endpoint in a real browser was not exercised end-to-end (no Playwright run on this WP) — the unit-level coverage of the grip-drag flow lives in `GripLayer.test.tsx` (`endpoint drag → onCommit fires moveWallEndpoints`, numeric override, Esc cancel contract).

## Files touched

New:
- `packages/web/src/plan/gripProtocol.ts` + `gripProtocol.test.ts`
- `packages/web/src/plan/tempDimensions.ts` + `tempDimensions.test.ts`
- `packages/web/src/plan/GripLayer.tsx` + `GripLayer.test.tsx`
- `packages/web/src/plan/SnapGlyphLayer.tsx` + `SnapGlyphLayer.test.tsx`
- `packages/web/src/plan/SnapSettingsToolbar.tsx` + `SnapSettingsToolbar.test.tsx`
- `packages/web/src/plan/snapSettings.ts` + `snapSettings.test.ts`
- `packages/web/src/plan/snapTabCycle.ts` + `snapTabCycle.test.ts`

Modified:
- `packages/web/src/plan/snapEngine.ts` (cherry-picked WIP from `eabe0eb2`; producers were already inline in the WIP; tests extended)
- `packages/web/src/plan/snapEngine.test.ts` (extended)
- `packages/web/src/plan/PlanCanvas.tsx` (grip layer + temp-dim layer + snap glyph layer + settings toolbar + numeric input + Tab-cycle wiring; legacy SnapEngine torus path preserved)
- `spec/workpackage-master-tracker.md` (EDT-01 + EDT-05 rows → `partial`)

## Notes for the next agent

- The grip layer takes hover priority via `pointerEvents: 'auto'` on the grip divs. Other agents touching `PlanCanvas.tsx` (Agent 3 sketch overlay, Agent 5 crop region) should likewise put their interactive overlays inside absolute-positioned divs above the canvas and stop event propagation, otherwise the existing pan / marquee / draft logic will fight them.
- The legacy `SnapEngine` class in `planCanvasState.ts` is untouched and the torus indicator still ships — the new SnapGlyphLayer runs in parallel. EDT-05 follow-up can rip the legacy path out once the full snap-kind set is migrated. I left it in place to avoid changing snapshot/golden-bundle behaviour during this WP.
- `tempDimLockToggleNoop` is a sentinel command type the engine won't recognise. The PlanCanvas-side handler intentionally drops it on the floor; if the workspace's `onSemanticCommand` ever logs unknown command types, gate that log on `cmd.type !== 'tempDimLockToggleNoop'` until EDT-02 lands.
