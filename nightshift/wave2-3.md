# Wave-2 Agent 3 — Sketch Mode Keystone (SKT-01 floor-only) + SKT-04 floor overlap

You are **Agent 3** of eight wave-2 agents, plus the seed-fidelity sprint running concurrently. Your theme is **closed-loop sketch authoring** — the load-bearing slice of SKT-01 (floor only) plus SKT-04 floor-overlap warning. You own branch `wave2-3`. Do not stop until your WPs are done.

---

## 0. Pre-flight

### Repo + worktree

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-3 wave2-3
cd /Users/jhoetter/repos/bim-ai-wave2-3
```

Read `spec/workpackage-master-tracker.md` → P3 Sketch Mode → SKT-01 + SKT-04 detail blocks; `nightshift/wave2-README.md`.

### Concurrent agents

Agent 2 (`wave2-2`, EDT-01 grip protocol) also touches `PlanCanvas.tsx`. **Coordinate by surface area:** EDT-01 owns the grip layer; you own a separate `SketchCanvas` overlay that only activates when `sketchSession.status === 'open'`. Keep your `PlanCanvas.tsx` edits small (just a delegation hook).

Standard rebase conflicts on `core/index.ts`, `commands.py`, etc.

### Quality gates, branch protocol, tracker update, anti-laziness

Same as Agent 1. Branch `wave2-3`. End-of-shift `nightshift/wave2-3-status.md`.

Visual verification: after SKT-01 ships, **start the dev server and try drawing an L-shaped floor via the sketch session** before declaring done.

---

## 1. Your assigned workpackages

Two WPs. SKT-04 is XS (1 day) and depends on SKT-01 — ship SKT-01 first.

### 1.1 — SKT-01: Sketch session state machine (floor-only slice)

**Tracker entry:** `spec/workpackage-master-tracker.md` → P3 → SKT-01 detail block.

**Reality check.** Full SKT-01 is XL (4 weeks for floor + ceiling + roof + room separation + in-place mass + void cut + detail region). Ship the **floor-only load-bearing slice**. Other element kinds explicitly deferred.

**MUST ship (load-bearing — mark `partial`):**

1. **SketchSession data model.** Server-side transient (NOT persisted in snapshot):

   ```python
   # app/bim_ai/sketch_session.py (new)
   @dataclass
   class SketchSession:
       session_id: str
       element_kind: Literal['floor']   # extend later for ceiling/roof/etc.
       level_id: str
       lines: list[SketchLine]
       status: Literal['open', 'finished', 'cancelled']
   ```

   Track sessions in an in-memory dict keyed by session_id (no DB persistence — they're transient until Finish commits a real `CreateFloor`).

2. **Engine commands** in `app/bim_ai/commands.py` + `engine.py`:
   - `OpenSketchSessionCmd { elementKind, levelId }` → returns sessionId
   - `AddSketchLineCmd { sessionId, fromMm, toMm }` → appends line; recomputes validation
   - `RemoveSketchLineCmd { sessionId, lineIndex }` → removes line
   - `MoveSketchVertexCmd { sessionId, vertexId, toMm }` → moves shared vertex
   - `FinishSketchSessionCmd { sessionId }` → if validation passes, emits a `CreateFloor` with `boundaryMm` derived from the closed loop; closes session; returns the new floor's id
   - `CancelSketchSessionCmd { sessionId }` → discards

3. **Validation rules** (run continuously):
   - All lines coplanar — for floor, that's z=0 in level-local space
   - Lines form one or more closed loops — each vertex has exactly 2 incident edges
   - No self-intersection — segment-pair intersection test
   - Return validation state alongside session reads (`{ valid: boolean, issues: [{code, lineIndex}] }`)

4. **API endpoints:**
   - `GET /api/sketch-sessions/:id` returns session state + validation
   - `POST` for each command (or route through existing `/commands` endpoint)

5. **Canvas UI.** New `packages/web/src/plan/SketchCanvas.tsx`:
   - When sketch mode is active, overlay on top of plan canvas
   - Hides everything except the active level
   - Toolbar: `Line`, `Rectangle`, Finish ✓, Cancel ✗
   - Renders in-progress sketch as turquoise lines (matches Revit convention — use `#3fc5d3` or similar)
   - Esc cancels session
   - Top bar shows current validation state ("Lines form an open loop" / "Self-intersection at line 3" / "Ready to Finish")

6. **Plan canvas hookup** — in `PlanCanvas.tsx`, when active sketch session exists, render the `SketchCanvas` component as an overlay and disable normal element interactions.

7. **Tool entry** — add a "Floor (Sketch)" tool to the tools registry/ribbon. Activating it opens a sketch session with `elementKind: 'floor'`, asking for the level first.

8. **Tests:**
   - `app/tests/test_sketch_session.py` — session lifecycle (open → add line → finish commits CreateFloor)
   - `app/tests/test_sketch_validation.py` — closed-loop check, self-intersection check, planarity
   - `packages/web/src/plan/SketchCanvas.test.tsx` — UI flow (turquoise rendering, Finish disabled when invalid)

**MAY defer (mark in tracker note):**
- Other element kinds: ceiling, roof, room separation, in-place mass, void cut, detail region
- Pick Walls sub-tool (SKT-02 — separate WP, future)
- Validation feedback polish (SKT-03 — separate WP, future)
- Polygon / circle drawing tools — Line + Rectangle is enough for the load-bearing slice

After this WP ships, mark SKT-01 in tracker as: `partial in <hash> — session state machine + floor authoring + validation (closed loop, self-intersect, planarity) + SketchCanvas overlay shipped; ceiling/roof/room separation/in-place mass/void/detail region deferred (each ~1d of follow-up using the same protocol)`.

**Acceptance.** Click "Floor (Sketch)" tool → enters sketch mode with turquoise rendering, hides irrelevant elements; draw a closed L-shape via Line tool (3+ segments forming a closed polygon); Finish ✓ commits a single `CreateFloor` command with the L-boundary; the floor renders correctly in 3D with a non-rectangular footprint. **Visually verify in the dev server before declaring done.**

**Effort:** 7-9 hours.

---

### 1.2 — SKT-04: Floor / slab overlap warning

**Tracker entry:** `spec/workpackage-master-tracker.md` → P3 → SKT-04.

**Concrete scope:**

1. New constraint rule in `app/bim_ai/constraints.py`: `floor_overlap` (severity `warning`, not blocking).
2. Algorithm: pairwise polygon-intersection test among all floors on the same level. Use Shapely (`from shapely.geometry import Polygon`) — already a dependency. For each pair, compute intersection area; if > 1 sq mm, emit `floor_overlap` advisory listing both floor ids.
3. Performance: O(n²) bounded by floors on same level. Acceptable up to ~500 floors per model.

**Tests:** extend `app/tests/test_constraints.py` (or new file): authoring two overlapping floors → `floor_overlap` advisory; non-overlapping floors → no advisory.

**Acceptance.** Authoring two floors that overlap by ≥1 m² emits a `floor_overlap` advisory; clicking the advisory in the violations panel selects both floors.

**Effort:** 2-3 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `app/bim_ai/sketch_session.py` (new)
- `app/bim_ai/sketch_validation.py` (new helper for closed-loop / self-intersect checks)
- `packages/web/src/plan/SketchCanvas.tsx` (new)
- `app/bim_ai/constraints.py` `floor_overlap` rule (append)
- Tool entry for "Floor (Sketch)" in `tools/toolRegistry.ts`

**Shared territory:**
- `PlanCanvas.tsx` — small delegation hook only (when sketch active, render SketchCanvas)
- `app/bim_ai/commands.py`, `engine.py` — append your sketch-session commands
- `core/index.ts` — no element-kind addition needed (sessions are transient; only `CreateFloor` is committed)
- `spec/workpackage-master-tracker.md` — only SKT-01, SKT-04 rows

**Avoid:**
- `packages/web/src/plan/gripProtocol.ts` (Agent 2)
- `packages/web/src/plan/snapEngine.ts` (Agent 2)
- Other agents' files

---

## 3. Go

Spawn worktree, ship SKT-01 floor-only first, then SKT-04. **Visually verify SKT-01** in the dev server before marking done.
