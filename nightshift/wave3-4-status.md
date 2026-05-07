# wave3-4 — Sketch downstream + propagation — status

**Branch:** `wave3-4` (merged to `main` at 9384eef5)

**Owner:** Agent 4

**Themes shipped:** Pick Walls (SKT-02), validation feedback (SKT-03), SKT-01 propagation to roof + room_separation.

---

## What landed

### SKT-02 — Pick Walls sub-tool — `done`

- `PickedWall` model + `pick_walls_offset_mode` ('interior_face' default vs 'centerline') on `SketchSession`.
- `/api/sketch-sessions/{id}/pick-wall` toggles a wall in/out of the session; `/.../pick-walls-offset-mode` flips offset mode and re-derives all picked-wall lines.
- `app/bim_ai/sketch_pick_walls.py` (new): `derive_wall_sketch_line` (half-thickness offset toward picked-cluster centroid), `trim_corners` (line-line intersection with 1m extension limit), `rebuild_picked_walls_lines` (preserves freehand lines, re-pins indices on every rebuild).
- `packages/web/src/plan/SketchCanvasPickWalls.tsx` (new): pure 2D wall hit-test + `OffsetModeChip` toggle.
- SketchCanvas: 'pick' tool mode + P shortcut + green hover highlight + inline offset chip.
- PlanCanvas wires the active level's walls into `wallsForPicking`.
- **Tests:** 7 backend (offset modes, 4-wall closed loop after trim, freehand preservation, corner snap, unknown-wall skip), 5 frontend (Pick Walls button visibility, hover highlight, click → pick-wall API).

### SKT-03 — Sketch validation feedback — `done`

- Multi-row status panel listing every issue with a counter and Tab-to-cycle hint.
- Active issue tracked via `data-active`; Tab cycles forward.
- Open vertices marked with red ring overlays; error-flagged lines re-stroked red.
- "Auto-close" one-click fix appears when there's exactly one missing segment between two open endpoints.
- Finish disabled while errors remain (tooltip lists count).
- **Tests:** 3 frontend (closed-loop disables Finish + highlights vertex, Auto-close visibility, Tab cycles active row).

### SKT-01 propagation — `partial`

- `SketchElementKind` extended to `floor | roof | room_separation` (pydantic schema + TS type).
- Validation branches: `room_separation` drops the closed-loop check (line-set authoring) and fails on empty-sketch.
- `_build_finish_commands` dispatches to `createFloor` / `createRoof` (default `mass_box`) / one `createRoomSeparation` per line.
- Finish response carries kind-specific id (`roofId` / `roomSeparationId`) plus `createdElementIds[]`; `floorId` preserved for back-compat.
- New tools: `roof-sketch` (Shift+O), `room-separation-sketch` (RS) wired through `toolRegistry`, `PlanTool` union, palette ordering, perspective-filtered tool list.
- Tracker updated.
- **Tests:** 6 backend (roof closed-loop validation + finish, room_separation line-set validation, empty/zero-length rejection, multi-line commit).

### Deferred

- **`ceiling`** — gated on a kernel WP that adds `CeilingElem` + `createCeiling` to elements/commands/engine. The HTTP route currently rejects `elementKind='ceiling'` with a clear message; no schema rot.
- **`in_place_mass`**, **`void_cut`**, **`detail_region`** — same deferral list as wave2-3.

---

## Test summary

- **Backend:** 1344 tests pass (full suite); 27 sketch-related tests pass (incl. 13 new this WP).
- **Frontend:** 319 plan tests pass (incl. 11 SketchCanvas/PickWalls/validation tests, 8 of them new).

## Quality gates

- Type check (`tsc --noEmit`): no errors in `src/plan`, `src/tools`, `src/state`, `src/workspace`.
- Pre-commit hook (prettier + python format) applied via the worktree's installed hook.
- Rebased cleanly onto `c878fee7` (wave3-6 + FED-02 + KRN-08 had landed before me).

## Files touched

- `app/bim_ai/sketch_session.py` (extended)
- `app/bim_ai/sketch_validation.py` (extended)
- `app/bim_ai/sketch_pick_walls.py` (new)
- `app/bim_ai/routes_sketch.py` (extended)
- `app/tests/test_sketch_session_pick_walls.py` (new)
- `app/tests/test_sketch_session_other_kinds.py` (new)
- `packages/web/src/plan/SketchCanvas.tsx` (extended)
- `packages/web/src/plan/SketchCanvasPickWalls.tsx` (new)
- `packages/web/src/plan/sketchApi.ts` (extended)
- `packages/web/src/plan/SketchCanvas.pickWalls.test.tsx` (new)
- `packages/web/src/plan/SketchCanvas.validation.test.tsx` (new)
- `packages/web/src/plan/PlanCanvas.tsx` (sketch-overlay mounting + wallsForPicking)
- `packages/web/src/state/storeTypes.ts` (PlanTool union)
- `packages/web/src/tools/toolRegistry.ts` (new tool entries + palette ordering)
- `packages/web/src/workspace/planToolsByPerspective.ts` (perspective tool list)
- `packages/web/src/workspace/workspaceUtils.ts` (LegacyPlanTool + KNOWN_PLAN_TOOLS)
- `spec/workpackage-master-tracker.md` (SKT-01/02/03 status notes)

## Notes for next waves

- Ceiling sketch propagation is the obvious next step — requires `CeilingElem` (boundaryMm + level + thickness) and `createCeiling` engine handler. A 4-hour kernel WP unblocks ceiling sketches with the same Finish-dispatch path I built here.
- `Pick Walls` currently runs against *every* wall on the active level. For very large floor plates this is fine (O(n) hit-test on hand-picked input), but a level-bounded spatial index could be added if performance surfaces.
- The `_build_finish_commands` helper is shaped so adding new element kinds (in_place_mass / void_cut) is a pure-additive change — no further refactor of routes_sketch.py needed.
