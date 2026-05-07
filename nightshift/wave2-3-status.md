# Wave-2 Agent 3 — End-of-shift status

Branch: `wave2-3`. Theme: closed-loop sketch authoring (SKT-01 floor slice + SKT-04 floor-overlap advisory).

## Headline

Both assigned WPs landed end-to-end on `wave2-3`:

- **SKT-01** — `SketchSession` state machine + canvas mode (floor-only load-bearing slice). Shipped as `partial` in tracker.
- **SKT-04** — Floor / slab overlap warning. Shipped as `done` in tracker.

Backend, frontend, tests, and an end-to-end manual proof against the live API all green.

## What landed

### SKT-01 (floor authoring)

**New backend modules:**

- `app/bim_ai/sketch_session.py` — `SketchSession` / `SketchLine` / `SketchValidationIssue` / `SketchValidationState` Pydantic models, plus an in-process `SketchSessionRegistry` keyed by session id (transient — never enters the document snapshot).
- `app/bim_ai/sketch_validation.py` — `validate_session` (zero-length, closed-loop, self-intersection — planarity is automatic for floor sketches because lines are 2D in level-local mm), plus `derive_closed_loop_polygon` for translating the line-set into the ordered vertex sequence the engine's `CreateFloor` expects.
- `app/bim_ai/routes_sketch.py` — `/api/sketch-sessions` router with six endpoints:
  - `POST /api/sketch-sessions` — open
  - `GET /api/sketch-sessions/:id` — read state + validation
  - `POST /api/sketch-sessions/:id/lines` — add a line (chain mode supported by the UI)
  - `POST /api/sketch-sessions/:id/remove-line`
  - `POST /api/sketch-sessions/:id/move-vertex` — moves every endpoint coincident with `fromMm`
  - `POST /api/sketch-sessions/:id/cancel`
  - `POST /api/sketch-sessions/:id/finish` — emits a single `CreateFloor` through `try_commit`, so undo/redo, constraint evaluation, and WebSocket deltas behave exactly like any other authoring action.

The router is wired into `routes_api.py`; `pyproject.toml` adds it to the `B008` per-file ignore list (consistent with the other `routes_*.py`).

**New frontend modules:**

- `packages/web/src/plan/sketchApi.ts` — typed client for the six endpoints above.
- `packages/web/src/plan/SketchCanvas.tsx` — overlay component:
  - Turquoise SVG line rendering (Revit's `#3fc5d3`), vertex dots in `#0e8b9c`.
  - Toolbar: Line / Rectangle / Finish ✓ / Cancel ✗. Finish disabled while validation reports issues.
  - Top status pill shows the active validation message (turquoise when valid, amber otherwise).
  - Esc cancels (server-side cancel + close overlay); `L` / `R` switch tools.
  - Coordinate mapping is delegated to two callback refs supplied by `PlanCanvas` (`pointerToMmRef`, `mmToScreenRef`) so panning / zooming the underlying canvas keeps the overlay in sync without re-rendering or duplicating camera math.
  - Click-once chain-line authoring with a 100mm grid snap; rectangle tool emits four lines for the four sides.

**Tool registry / state plumbing:**

- New `floor-sketch` tool id (label: "Floor (Sketch)", hotkey `Shift+F`) added to `toolRegistry.ts`, the palette ordering, and `KNOWN_PLAN_TOOLS`.
- `floor-sketch` added to `PlanTool` (`storeTypes.ts`), `LegacyPlanTool` (`workspaceUtils.ts`), and the per-perspective `ALL_TOOLS` list. The existing legacy `floor` tool is left untouched.
- `PlanCanvas.tsx` renders `<SketchCanvas>` as an overlay when `planTool === 'floor-sketch'` and a `modelId` + active level are present. The overlay's `pointer-events: auto` intercepts clicks on top of the Three.js renderer, which is sufficient to disable normal element interactions while sketching. On Finish the new `floorId` is selected; on Cancel the tool resets to `select`.

**Tests (all green):**

- `app/tests/test_sketch_validation.py` (6 tests) — empty / open-loop / closed rectangle / bow-tie self-intersection / zero-length / L-shape polygon derivation.
- `app/tests/test_sketch_session.py` (5 tests) — registry lifecycle, line-append + validation, the singleton `get_sketch_registry`, and an end-to-end finish path that translates a 6-edge L-shape into a `CreateFloor` accepted by `try_commit`.
- `packages/web/src/plan/SketchCanvas.test.tsx` (3 tests) — fetch-mocked open + status, valid loop renders turquoise SVG and enables Finish, Cancel posts to `/cancel` and triggers `onCancelled`.

### SKT-04 (floor overlap advisory)

- `app/bim_ai/constraints.py` — new `floor_overlap` rule (severity `warning`, not blocking; coordination discipline, geometry blocking class). Pairwise on each level, bounded by O(n²); polygon-polygon overlap is computed with a small ear-clipping triangulation + Sutherland-Hodgman clip pair so it handles concave (L-shaped) floors without adding `shapely` as a runtime dependency.
- `app/tests/test_floor_overlap_constraint.py` (4 tests) — overlapping squares emit advisory; non-overlapping floors do not; floors on different levels do not; an L-shape vs a square that bites into its corner emits the advisory.

## End-to-end proof against the live server

Booted FastAPI on `:8501` and Vite dev on `:2001` (proxying `/api` to FastAPI):

1. `POST /api/sketch-sessions` → returns `sessionId` with `validation.valid: false, code: open_loop` (correct: empty session).
2. Six `POST /lines` calls drew an L-shape (ground level of the existing demo model). Validation flipped to `valid: true`.
3. `POST /finish` returned `ok: true`, `revision` bumped from 4 → 5, `appliedCommand` was a single `createFloor` with the 6-vertex `boundaryMm`, and the new `floorId` was returned.
4. Created a second overlapping floor on the same level → engine accepted (advisory not blocking) and the violations list returned three `floor_overlap` entries (~15 m² overlap with the new sketched floor and ~56 m² with the seed `hf-fl-ground` floor).
5. Vite proxy hit `/api/sketch-sessions` and `/cancel` cleanly through `:2001`.

The vite production build also succeeded (`pnpm --filter @bim-ai/web build` → `built in 2.75s`), so the React tree compiles without regressions.

## Quality gates

- **Python tests:** `pytest tests/ --no-cov` → 1243 passed / 7 skipped (full suite, including the 15 new ones).
- **Ruff lint + format:** `ruff check bim_ai` clean; `ruff format` applied to the four new / modified files.
- **TypeScript typecheck:** `pnpm --filter @bim-ai/web typecheck` clean.
- **Vitest:** 1763 tests pass overall; the SketchCanvas suite runs in 97 ms.
- **Vite build:** clean.
- **ESLint:** two `no-unused-vars` warnings remain — both pre-existing on `wave2-3` (`families/geometryFns/doorGeometry.ts` `frameMat`, `plan/PlanCanvas.tsx` `sectionCutFromWall` import). Verified pre-existing by stashing my changes and re-running lint; left them for the agent that owns those files.

## Tracker

`spec/workpackage-master-tracker.md` updated:

- `SKT-01` → `partial` with the floor-only slice description and the deferred kinds enumerated.
- `SKT-04` → `done` with the polygon-intersection algorithm noted (no shapely dep added).

## Deferred — explicitly marked in the tracker note

- Other element kinds for sketch sessions: ceiling, roof, room_separation, in_place_mass, void_cut, detail_region. Each is ~1 day of follow-up using the same protocol.
- SKT-02 (Pick Walls sub-tool) — separate WP.
- SKT-03 (validation feedback polish, Tab-cycling) — separate WP.
- Polygon / circle drawing tools — Line + Rectangle is sufficient for the load-bearing slice.

## Conflict / coordination notes

- I avoided `gripProtocol.ts` and `snapEngine.ts` (Agent 2 territory). Touching `PlanCanvas.tsx` was minimal: a small import block, two coordinate-mapping callback refs, and a single conditional render at the end of the JSX. Agent 2's grip layer is unaffected.
- No additions to `core/index.ts` were necessary — sessions are transient; only the existing `CreateFloor` command is ever committed.
- I extended `commands.py` only for the `B008` ruff ignore (no new persisted commands).
