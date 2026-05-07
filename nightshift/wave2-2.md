# Wave-2 Agent 2 — In-Place Editing Keystone (EDT-01 walls-only) + EDT-05 snap upgrade

You are **Agent 2** of eight wave-2 agents, plus the seed-fidelity sprint running concurrently. Your theme is **on-canvas direct-manipulation editing** — the load-bearing slice of EDT-01 (walls only) plus the standalone EDT-05 snap-engine upgrade. You own branch `wave2-2`. Do not stop until your WPs are done.

---

## 0. Pre-flight (read every word)

### Repo + worktree

`/Users/jhoetter/repos/bim-ai`. **Spawn a per-agent worktree first:**

```bash
git worktree add /Users/jhoetter/repos/bim-ai-wave2-2 wave2-2
cd /Users/jhoetter/repos/bim-ai-wave2-2
```

Read `spec/workpackage-master-tracker.md` → P2 In-Place Editing → EDT-01 + EDT-05 detail blocks; also `nightshift/wave2-README.md`.

**EDT-05 starting point:** Agent 7 of the nightshift had a WIP commit on EDT-05 at `origin/nightshift-7` head `eabe0eb2`. It adds `intersection`, `perpendicular`, `extension`, `tangent` snap kinds + `collectSnapLines` + `infiniteLineIntersection` helpers in `packages/web/src/plan/snapEngine.ts`. **Cherry-pick this onto your branch first**, then build from there:

```bash
git cherry-pick eabe0eb2
# resolve conflicts if any (unlikely — file is mostly snap-engine-local)
```

### Concurrent agents

Agent 3 (`wave2-3`, sketch keystone) will heavily touch `PlanCanvas.tsx`. **Coordinate by surface area:** you own the grip layer + temp-dim layer; Agent 3 owns the sketch-mode overlay. Both attach to PlanCanvas via small additions; the bulk of your code lives in new files (`gripProtocol.ts`, `tempDimensions.ts`).

Standard rebase conflicts on `core/index.ts`, `commands.py`, etc. — additive merges.

### Quality gates, branch protocol, tracker update, anti-laziness

Same as Agent 1 — see `wave2-1.md` for the boilerplate. Branch is `wave2-2`. End-of-shift status to `nightshift/wave2-2-status.md`.

Visual verification: after EDT-01 ships, **start the dev server and try dragging a wall endpoint in plan view** before declaring done. Tests passing isn't enough.

---

## 1. Your assigned workpackages

Two WPs — order them so EDT-05 (smaller, cherry-picked from the WIP) ships first to build velocity, then EDT-01.

### 1.1 — EDT-05: Snap-engine upgrade (~complete the WIP slice)

**Tracker entry:** `spec/workpackage-master-tracker.md` → P2 → EDT-05 detail block.

**Starting state (from cherry-picked `eabe0eb2`):**
- Snap kinds extended: `intersection`, `perpendicular`, `extension`, `tangent` (declared)
- Helpers: `collectSnapLines(els, levelId)`, `infiniteLineIntersection(a, b)` 
- Tangent kind reserved but no producer

**What you need to add to close out EDT-05:**

1. **Producers for each new snap kind** in `snapEngine.ts`:
   - `snapIntersection(cursor, lines)`: for each pair of non-parallel lines, compute intersection point; if within tolerance of cursor (e.g. 50px in screen-space), return as candidate
   - `snapPerpendicular(cursor, lines)`: drop a perpendicular from cursor onto each line; closest foot within tolerance is a candidate
   - `snapExtension(cursor, lines)`: closest point on each line's *infinite* extension beyond its endpoints; visualize with a dashed line back to source
   - Skip tangent (no curved elements yet — keep the kind reserved)

2. **Glyph rendering** in `PlanCanvas.tsx` (or a new `packages/web/src/plan/SnapGlyphLayer.tsx`):
   - Endpoint: square (existing)
   - Midpoint: triangle (existing)
   - Intersection: × glyph
   - Perpendicular: ⊥ glyph
   - Extension: small dot + dashed line back to source segment
   - Active snap label in lower-left (e.g. "endpoint", "perpendicular")

3. **Tab-cycle**: when multiple candidates are within tolerance, Tab cycles through them. Track the currently-selected candidate index in the canvas state.

4. **Per-snap-type toggle UI** — extend an existing settings panel (find via grep for snap settings; if absent, add a small dropdown to the canvas toolbar). Booleans for endpoint/midpoint/intersection/perpendicular/extension; persist to localStorage.

5. **Tests:**
   - `packages/web/src/plan/snapEngine.test.ts` — extend with cases for each new snap kind
   - `packages/web/src/plan/SnapGlyphLayer.test.tsx` — verify glyphs render at correct positions

**Acceptance.** Drawing a wall, the cursor visibly snaps to perpendicular onto the nearest existing wall when within tolerance; snap glyphs render at correct positions; Tab cycles between competing snaps at a corner; the settings panel toggles each snap type globally.

**Effort:** 3-4 hours (most of the heavy lifting is in `eabe0eb2`).

---

### 1.2 — EDT-01: Universal grip + temp-dimension protocol (walls-only slice)

**Tracker entry:** `spec/workpackage-master-tracker.md` → P2 → EDT-01 detail block.

**Reality check.** Full EDT-01 is XL (4 weeks for full infra + walls + 6 other element kinds). You will ship the **walls-only load-bearing slice**. Other element kinds explicitly deferred.

**MUST ship (load-bearing — mark `partial`):**

1. **Grip protocol** in new file `packages/web/src/plan/gripProtocol.ts`:

   ```ts
   export type GripDescriptor = {
     id: string;
     positionMm: { xMm: number; yMm: number };
     shape: 'square' | 'circle' | 'arrow';
     axis: 'x' | 'y' | 'free' | 'normal_to_element';
     hint?: string;
     onDrag: (deltaMm: { xMm: number; yMm: number }) => DraftMutation;
     onCommit: (deltaMm: { xMm: number; yMm: number }) => Command;
     onNumericOverride: (absoluteMm: number) => Command;
   };

   export interface ElementGripProvider<E> {
     grips(element: E, context: PlanContext): GripDescriptor[];
   }
   ```

2. **Wall grip provider** — for a selected wall: emit endpoint grips (squares at start/end), a midpoint move grip (circle at midpoint), and a thickness handle (arrow on the cut edge).

3. **Temp-dimension protocol** in new file `packages/web/src/plan/tempDimensions.ts`:

   ```ts
   export type TempDimTarget = {
     id: string;
     fromMm: { xMm: number; yMm: number };
     toMm: { xMm: number; yMm: number };
     direction: 'x' | 'y';
     onClick: () => Command;          // converts to persistent dimension
     onLockToggle: () => Command;     // adds a `constraint` element
   };
   ```

   For a selected wall, emit temp-dim targets to the nearest neighbouring wall in each cardinal direction. Defer the lock toggle implementation (EDT-02 territory) — render the lock icon but make clicks no-op with a tooltip "Constraint locks land in EDT-02".

4. **Plan canvas integration** in `PlanCanvas.tsx`:
   - New `GripLayer` rendered above existing element layer
   - Raycast grips before element pick so grips take priority on hover
   - On grip drag-start: clone the element into a draft, call `onDrag(delta)` for each frame
   - On grip release: call `onCommit(delta)` to commit a real `MoveWallEndpoints` (or other) command
   - Esc cancels drag (revert draft)
   - Numeric override: while dragging, typing a digit pops a small input field at cursor; Enter commits via `onNumericOverride`; Tab switches axis

5. **Element kinds wired in this WP: walls only.** Doors, windows, floors, columns, beams, sections — all deferred.

6. **Tests:**
   - `packages/web/src/plan/gripProtocol.test.ts` — wall grip emission for sample wall
   - `packages/web/src/plan/PlanCanvas.gripDrag.test.tsx` — drag fires `MoveWallEndpoints` with correct delta; Esc cancels
   - `packages/web/src/plan/tempDimensions.test.ts` — neighbour detection in each direction

**MAY defer (mark in tracker note as `partial`):**
- Door/window/floor/column/beam/section/dimension/reference-plane grips — each is roughly 0.5 days of follow-up work using the protocol you ship
- Lock toggle on temp dimensions (EDT-02 territory; render the icon but make it no-op)
- 3D viewport grip support (EDT-03 territory)
- Tool grammar polish (EDT-06)

After this WP ships, mark EDT-01 in tracker as: `partial in <hash> — protocol + walls-only + temp-dimensions w/o locks shipped; door/window/floor/column/beam/section grips deferred (each ~0.5d of follow-up using the protocol)`.

**Acceptance.** Selecting a wall in plan view shows two endpoint squares + midpoint circle + thickness arrow. Hovering shows blue temp dimensions to the nearest neighbours. Dragging the endpoint emits a live preview at 60fps; releasing commits `MoveWallEndpoints`. Typing "5000" while dragging snaps to exactly 5000mm from the start point. **Visually verify in the dev server before declaring done.**

**Effort:** 6-8 hours.

---

## 2. File ownership and conflict avoidance

**You own:**
- `packages/web/src/plan/gripProtocol.ts` (new)
- `packages/web/src/plan/tempDimensions.ts` (new)
- `packages/web/src/plan/SnapGlyphLayer.tsx` (new — for EDT-05)
- `packages/web/src/plan/snapEngine.ts` (you finished it; was started by nightshift Agent 7)
- The grip-layer + temp-dim-layer additions in `PlanCanvas.tsx`

**Shared territory:**
- `PlanCanvas.tsx` — Agents 3 (sketch overlay) and 5 (crop region UI) also touch this. Keep your additions to small, well-isolated handlers; reference your own modules for logic
- `app/bim_ai/commands.py`, `engine.py` — append `MoveWallEndpoints` extensions if needed (it should already exist; you mostly use it as-is)
- `spec/workpackage-master-tracker.md` — only EDT-01, EDT-05 rows

**Avoid:**
- `packages/web/src/Viewport.tsx` (other agents)
- `packages/web/src/viewport/meshBuilders.ts` (seed-fidelity)
- `packages/web/src/familyEditor/*` (Agent 6)

---

## 3. Go

Spawn worktree, cherry-pick `eabe0eb2`, ship EDT-05 first, then EDT-01 walls-only. **Visually verify EDT-01** in the dev server before marking done.
