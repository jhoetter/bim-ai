# Dayshift VIE glue — End-of-shift status

Branch: `dayshift-vie-glue` → all merged to `main` via `git push origin dayshift-vie-glue:main`.

## Shipped WPs

| WP     | State      | Feature commit | Tracker commit | Notes                                                                                          |
| ------ | ---------- | -------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| VIE-03 | `done`     | `66584688`     | `f55f6080`     | Triangular elevation marker on the plan canvas, double-click activation, ribbon Elevation tool |
| ANN-02 | `done`     | `41d93b19`     | `4a934e7d`     | `WallContextMenu` wired into PlanCanvas + Viewport contextmenu                                 |
| VIE-01 | `done`     | `ee846851`     | `625eadfc`     | `planWallMesh` reads detail level; `PlanDetailLevelToolbar` mounted at bottom-center           |

Total: 6 commits on `dayshift-vie-glue` (3 feature + 3 tracker), all pushed to `origin/main`.

## What landed

### VIE-03 — Named elevation views (renderer + tool wiring)

- `modelXyBoundsMm` + `elevationMarkerAnchorMm` in `symbology.ts` derive a marker anchor from the bounding box of walls + floors + roofs.
- `elevationViewPlanThree` emits a triangular bubble (line + filled triangle) pointing at the model with a dashed callout line; the group carries `bimPickId` so it rides the existing selection raycast.
- `rebuildPlanMeshesLegacy` iterates `kind === 'elevation_view'` after the section-cut loop.
- `PlanCanvas` adds a `dblclick` handler that activates the `elevation_view` (or `plan_view`) it lands on via the new `activateElevationView` store action.
- New "elevation" plan tool (EL hotkey) drops a `createElevationView` centred on the click, auto-orienting from the nearest exterior wall via `elevationFromWall` when one is in range.
- `activateElevationView` mirrors `activatePlanView`: clears competing active views, drops `temporaryVisibility` on switch, preserves on re-entry.
- `LegacyPlanTool` + `PlanTool` + `ToolId` all extended; `getToolRegistry` + i18n add an Elevation entry next to Section in plan + plan-3d palettes.
- Vitest covers anchor math (N/S/E/W + custom angle), the activation action, and the registry surface.

### ANN-02 — Right-click wall menu

- `WallContextMenu` component renders two items: "Generate Section Cut" and "Generate Elevation". Each action computes parameters via `sectionCutFromWall` / `elevationFromWall`, attaches a fresh `crypto.randomUUID` id, and emits the assembled command (plus the new id) via `onCommand`.
- Closes on outside click or Escape.
- `PlanCanvas` and `Viewport` both register a `contextmenu` listener that raycasts for a wall pick and opens the menu at the cursor.
- Parent dispatches the command via `onSemanticCommand` and either activates the new `elevation_view` (so the user lands on the new view) or selects the new `section_cut` (Inspector focus).
- `CanvasMount` threads `onSemanticCommand` into `Viewport` so 3D right-click shares the plan flow.
- Vitest covers the menu's command emission, Escape close, and outside-click close.

### VIE-01 — Detail level binding

- `planWallMesh` accepts a `detailLevel` parameter; coarse drops the layer overlay (single solid bar), medium emits only structural-core boundaries (transitions between structure and non-structure layers, plus the outer faces), fine keeps the full layer stack.
- `resolvePlanWallAssembly` now plumbs the wall-type catalog's per-layer `function` so the medium gate has the right signal.
- `rebuildPlanMeshes` reads `mergedGraphicHints.detailLevel` and forwards it to legacy + wire-primitive paths.
- `PlanCanvas` mounts `PlanDetailLevelToolbar` at bottom-center (matches Revit's View Control Bar position) and dispatches `updateElementProperty(planDetailLevel)` against the active plan view.
- Engine already had the `planDetailLevel` `updateElementProperty` handler; round-trip closes naturally.
- Vitest covers wall line counts at coarse / medium / fine and the no-`wallTypeId` fallback.

## Quality gates

- `pnpm --filter @bim-ai/web typecheck` → clean after every commit
- `pnpm test` (web) → 1744 tests passing after VIE-01, up from 1729 at start
- Pre-existing failures in `packages/web/e2e/*` (Playwright suite) untouched — they fail on `pnpm exec vitest run` only because vitest tries to discover them; the actual `pnpm test` script scopes to `src` and skips e2e.

## Observations

- Direct push pattern (`git push origin dayshift-vie-glue:main`) worked cleanly — no merge conflicts on any of the three pushes since I held the only branch racing main this morning.
- The wire-primitive plan path (`rebuildPlanMeshesFromWire`) was a slightly hidden second call site for `planWallMesh`; I plumbed `detailLevel` through it too so the wire-driven render also honours the toolbar.
- `WallContextMenu` is shared between PlanCanvas and Viewport; `Viewport` needed an `elementsByIdRef` shadow ref so the long-lived contextmenu listener registered in the mount effect could see fresh elements without re-running that effect.
- Each WP shipped its own tests (5–9 vitests) — total of ~30 new test cases across the three.
