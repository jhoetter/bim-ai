# Nightshift Agent 5 — End-of-shift status

Branch: `nightshift-5` → merged to `main`.

## Shipped WPs

| WP     | State on tracker | Merge commit  | Notes                                                                                                                |
| ------ | ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| VIE-05 | `done`           | `c024c234`    | `CreateLevelCmd.alsoCreatePlanView` (default true) + companion `plan_view` in same engine step. Pytest covers default-on, explicit `planViewId`, and opt-out. Seed-house v2 updated to keep its 2-plan-view assertion.    |
| VIE-07 | `done`           | `8e5fad05`    | `pinned: bool` on 16 element kinds (Python + TS), `pinElement` / `unpinElement` cmds, engine refuses `move*`, `updateElementProperty`, `deleteElement` on pinned targets unless `forcePinOverride: true`. Inspector ships `InspectorPinToggle` (vitest). |
| VIE-04 | `done`           | `4c9f7caa`    | `temporaryVisibility` slice in Zustand + setter / clear, PlanCanvas filters `elementsById` through the override, `activatePlanView` / `setActiveViewpointId` clear on view change, `TemporaryVisibilityChip` status bar component, `isElementVisibleUnderTemporaryVisibility` pure helper. Right-click menu + HI/HC/HR keyboard shortcuts deferred. |
| VIE-03 | `partial`        | `7c7efda5`    | `ElevationViewElem` (kind `elevation_view`), `CreateElevationViewCmd`, `elevation_view_to_section_cut` helper that maps direction → section-line for the existing projection pipeline, `Elevations` group in Project Browser. Plan-canvas marker rendering + double-click-to-open + ribbon Elevation tool still pending. |
| ANN-02 | `partial`        | `b3c0e20b`    | `sectionCutFromWall` and `elevationFromWall` helpers (5° cardinal-snap, custom-angle fallback) ready for VIE-03 to consume. Right-click "Generate Section / Elevation" menu hookup pending. |
| VIE-01 | helpers landed   | `a0883092`    | `wallPlanLinesForDetailLevel` (1 / 2 / 4 lines for coarse / medium / fine), door / window / stair feature gates, curtain grid + mullion gating, presentational `PlanDetailLevelToolbar`. Wiring into `planProjection.ts` / `planElementMeshBuilders.ts` to reach on-screen pixels still pending. |

## Blocked / deferred work

- None hard-blocked. Three WPs (VIE-03, ANN-02, VIE-01) shipped the kernel /
  pure-helper half of the spec; the renderer / right-click / shortcut layers
  were skipped to keep the shift on time. Each follow-up is straightforward
  glue against the helpers that did land.
- Pre-existing failure in `tests/test_room_rectangle.py::test_room_rectangle_bundle_matches_single`
  reproduced on `origin/main` *before* any of my changes — `try_commit` calls
  `ensure_internal_origin` (KRN-06) and `try_commit_bundle` doesn't, so they
  diverge by one element. Not from this shift.

## Observations

- Multiple agents racing on `app/bim_ai/commands.py`, `app/bim_ai/elements.py`,
  `app/bim_ai/engine.py`, and `packages/core/src/index.ts` made the
  rebase-and-ff-merge loop the dominant time cost. Three of my six commits
  needed manual conflict resolution; in every case both sides were additive
  (different `case` branches, different `Element` union members) and merging
  was mechanical.
- Symlinking `node_modules` and `.venv` from the parent repo into a fresh
  worktree breaks two ways: pip's editable `.pth` keeps pointing at the
  parent, and pnpm's relative `node_modules/@bim-ai/core` symlink resolves
  through the parent worktree. Cleanest fix is `pnpm install` and a real
  `.venv` per worktree; spent ~5 minutes here before that clicked.
- The spec asked for `pinned` on a "base element shape", but `link_model`
  doesn't exist in this codebase. Falling back to per-kind opt-in via
  `pinned: bool = False` was easier than refactoring the discriminated union.

## Total commits

15 commits on `nightshift-5` across the shift (10 feature + 5 tracker).
