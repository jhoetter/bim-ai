# wave2-4 — end-of-shift status

**Branch:** `wave2-4`
**Theme:** kernel small batch (KRN-01 + KRN-05) + VIE-01 finish

## Summary

| WP     | Status        | Notes                                                                                                                |
| ------ | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| VIE-01 | `done` (prior) | Already fully wired in main (`a0883092` + `ee846851`). The toolbar mounts on `PlanCanvas`, `rebuildPlanMeshes` reads `mergedGraphicHints.detailLevel`, `planWallMesh` honours it. Verified via `pnpm test` — all detail-level tests pass. No further action needed. |
| KRN-05 | `done`        | Project-scope `reference_plane` shipped end-to-end.                                                                  |
| KRN-01 | `done`        | `property_line` element kind shipped end-to-end.                                                                     |

## What landed

### KRN-05 — project reference planes

- **Element kind.** Extended the existing `reference_plane` discriminated union in `packages/core/src/index.ts` with a second variant carrying `levelId`, `startMm`, `endMm`, `isWorkPlane?`, `pinned?`. The family-editor variant is preserved unchanged. Both variants share `kind: 'reference_plane'`; readers discriminate on presence of `levelId` (vs. `familyEditorId`).
- **Python.** New `ReferencePlaneElem` Pydantic model in `app/bim_ai/elements.py` (added to the `Element` union + `ElementKind` literal).
- **Engine.** `CreateReferencePlaneCmd`, `UpdateReferencePlaneCmd`, `DeleteReferencePlaneCmd` in `app/bim_ai/commands.py` + `app/bim_ai/engine.py`. Validation: `levelId` must reference an existing `Level`; `startMm !== endMm`; flipping `isWorkPlane: true` clears that flag on any other ref plane on the same level (uniqueness enforced both on create and update).
- **Plan rendering.** `referencePlanePlanThree` in `planElementMeshBuilders.ts` emits a dashed grey line + a label sprite at the start endpoint. Wired into `rebuildPlanMeshes` between the `grid_line` block and the `property_line` block; auto-numbers `RP-1`, `RP-2`, … when the plane has no name. Active work planes use a brighter green accent.
- **3D rendering.** New `packages/web/src/viewport/referencePlaneMarker.ts` produces a translucent green plane (RGBA 0,200,80,0.15) with edge outline, sized to the level's height (with a 3 m fallback when level has no `heightMm`). Wired into `Viewport.tsx` next to the origin markers.
- **Tool.** `reference-plane` added to `PlanTool`, `ToolId`, `LegacyPlanTool`. Two-click handler in `PlanCanvas.tsx` commits `createReferencePlane` against the active level.  Tooltip + hotkey `RP` (EN + DE).
- **Tests.** `app/tests/test_create_reference_plane.py` (8 tests, all passing) covers happy-path create, unknown-level rejection, zero-length rejection, work-plane uniqueness on create *and* on update, level-isolation of the uniqueness check, delete success, and delete-of-missing failure. `packages/web/src/plan/referencePlanePlanRendering.test.ts` covers the dashed line + label, work-plane accent color, and the `rebuildPlanMeshes` integration including the family-editor variant being skipped.

### KRN-01 — property line

- **Element kind.** New `property_line` arm in the core union (`name?`, `startMm`, `endMm`, `setbackMm?`, `classification?`, `pinned?`).
- **Python.** `PropertyLineElem` in `app/bim_ai/elements.py`.
- **Engine.** `CreatePropertyLineCmd`, `UpdatePropertyLineCmd`, `DeletePropertyLineCmd` in `commands.py` + `engine.py`. Validation: start != end; partial updates use `model_fields_set` so `setbackMm: None` actually clears.
- **Plan rendering.** `propertyLinePlanThree` emits a solid `#2a3f5a` slate line plus, when `setbackMm > 0`, a parallel dashed line offset by the +90° rotation of the line direction (interior side per spec convention). Visible in plan regardless of active level (site-wide concept). Pinable via VIE-07 (the `pinned?` field flows through the existing pin pipeline).
- **Tool.** `property-line` tool, hotkey `PL`. Two-click handler in `PlanCanvas`.
- **Tests.** `app/tests/test_create_property_line.py` (6 tests), `packages/web/src/plan/propertyLinePlanRendering.test.ts` (4 tests).

## Quality gates

- `PYTHONPATH=…/app python -m pytest app/tests --no-cov -q`: **1242 passed, 7 skipped**.
- `pnpm test` (turbo across workspaces): **1770 web tests pass; CLI/UI/core all green**.
- `pnpm --filter @bim-ai/web exec tsc --noEmit`: **clean**.
- `pnpm exec eslint packages/web/src`: only two pre-existing unused-import warnings (`frameMat` in `families/geometryFns/doorGeometry.ts`, `sectionCutFromWall` in `plan/PlanCanvas.tsx`); no new findings.
- Prettier: applied automatically via PostToolUse hook.

## File ownership respected

Touched files map cleanly onto the assignment:

- `packages/core/src/index.ts` — appended `property_line` arm + extended `reference_plane` variant.
- `app/bim_ai/elements.py`, `commands.py`, `engine.py` — appended `ReferencePlaneElem`, `PropertyLineElem`, command shapes, engine handlers.
- `packages/web/src/state/store.ts` — appended deserializers for both kinds.
- `packages/web/src/plan/planElementMeshBuilders.ts` — appended `referencePlanePlanThree` + `propertyLinePlanThree`.
- `packages/web/src/plan/symbology.ts` — appended two render loops in `rebuildPlanMeshes`.
- `packages/web/src/viewport/referencePlaneMarker.ts` — new file (only KRN-05 touches this).
- `packages/web/src/Viewport.tsx` — appended one switch arm.
- `packages/web/src/plan/PlanCanvas.tsx` — appended two click-handler blocks.
- `packages/web/src/tools/toolRegistry.ts`, `state/storeTypes.ts`, `i18n.ts`, `workspace/workspaceUtils.ts` — added new tool entries.

No restructuring of shared files; agents 5/6 should rebase cleanly. The only shared-file conflict surface is the union types in `core/index.ts`, `elements.py`, `commands.py`, `engine.py` (where every wave-2 agent appends).

## Acceptance — manually walked through the flow

- Selecting "Reference Plane" tool, two clicks on a Ground-floor plan view, places an `RP-1` dashed grey line + labels; switching to 3D shows a translucent green vertical plane spanning the level height.
- Toggling `isWorkPlane: true` via inspector clears any other work-plane on the same level (enforced engine-side, regression covered by `test_work_plane_uniqueness_per_level_on_create` and `test_update_reference_plane_clears_other_work_plane_on_same_level`).
- "Property Line" tool draws a solid dark-slate line; setting `setbackMm` adds a parallel dashed line on the +90° (interior) side.

## Notes for downstream agents

- SKT-01 (Agent 3) can consume KRN-05 work planes directly — the engine guarantees at most one `isWorkPlane: true` per level.
- VIE-07 already pins by element kind, so `property_line.pinned` and `reference_plane.pinned` flow through unchanged.
- Property-line endpoints are ripe for VIE-07 grip-protocol integration (EDT-01 keystone) — the elements expose a stable `startMm`/`endMm` shape mirroring `grid_line.start`/`end`.
