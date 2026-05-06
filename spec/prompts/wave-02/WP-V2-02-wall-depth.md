# WP-V2-02 — Wall System Depth

**Status: IMPLEMENTED — committed to `main` on 2026-05-06 (not via feature branch).**

All changes are present on `main`. No further work needed. Mark as `done` in the tracker.

## What was implemented

- `locationLineOffsetFrac()` helper in `packages/web/src/viewport/meshBuilders.ts` (line 14)
- `makeWallMesh` applies perpendicular offset based on `wall.locationLine` (line 1126–1141)
- `makeWallMesh` uses `baseConstraintOffsetMm` and `topConstraintLevelId` for height (line 1114–1125)
- `planLocationLineOffsetFrac()` and wall mesh position offset in `packages/web/src/plan/planElementMeshBuilders.ts` (line 22–53)
- `WallJoinState`, `reduceWallJoin`, `initialWallJoinState` in `packages/web/src/tools/toolGrammar.ts` (line 584–652)
- `'wall-join'` added to `ToolId`, `MODIFY_TOOL_IDS`, `PALETTE_ORDER`, `getToolRegistry` in `toolRegistry.ts`
- `'wall-join'` added to `PlanTool` in `storeTypes.ts`
- Wall-join dispatch (`wallJoinStateRef`, `reduceWallJoin`, N-key cycle, Enter accept) in `PlanCanvas.tsx`
- `'wall-join': GitMerge` in `packages/ui/src/icons.tsx`
- Tests in `toolGrammar.test.ts` (WallJoin describe block, 7 tests)
- `packages/web/src/viewport/meshBuilders.locationLine.test.ts` (4 tests)

## Tracker update

Change `spec/workpackage-master-tracker.md` WP-V2-02 → `done`.
