# Wave-3 Agent 2 — Editing constraints + 3D handles (EDT-02 + EDT-03)

You are **Agent 2** of eight wave-3 agents. Theme: **constraint locks + 3D direct-manipulation handles** — both build on EDT-01 walls-only slice (already on main at `e83b3ecd`). Branch `wave3-2`.

---

## 0. Pre-flight

```bash
cd /Users/jhoetter/repos/bim-ai
git fetch origin --quiet
git worktree add /Users/jhoetter/repos/bim-ai-wave3-2 -b wave3-2 origin/main
cd /Users/jhoetter/repos/bim-ai-wave3-2
```

Read:
- `spec/workpackage-master-tracker.md` → P2 → EDT-02, EDT-03 detail blocks
- The EDT-01 commit `e83b3ecd` to understand the grip + temp-dim protocol you're extending
- `nightshift/wave3-README.md`

### Quality gates / branch protocol / tracker / anti-laziness

Same pattern. Branch `wave3-2`, status `nightshift/wave3-2-status.md`.

**Visual verification mandatory:** after EDT-03 ships, start the dev server, click a wall in 3D, drag the top edge to change height. The Revit-feel mantra: tests passing isn't enough.

---

## 1. Your assigned workpackages

Order: EDT-02 (M, smaller) → EDT-03 (L, biggest).

### 1.1 — EDT-02: Constraint locks via padlock UI

**Tracker:** P2 → EDT-02 detail block.

**Concrete scope:**

1. **New element kind** `constraint` in `packages/core/src/index.ts`:

   ```ts
   {
     kind: 'constraint';
     id: string;
     rule: 'equal_distance' | 'equal_length' | 'parallel' | 'perpendicular' | 'collinear';
     refsA: { elementId: string; anchor: 'start' | 'end' | 'mid' | 'center' }[];
     refsB: { elementId: string; anchor: 'start' | 'end' | 'mid' | 'center' }[];
     lockedValueMm?: number;
   }
   ```

   Mirror in `app/bim_ai/elements.py`.

2. **Engine validation** in `app/bim_ai/engine.py`: after each command apply, recompute constraints. If a command would violate a `constraint` of severity `error`, reject the command with a new `constraint_violation` advisory (blocking).

3. **Per-rule evaluators** in `app/bim_ai/constraints.py`:
   - `equal_distance`: distance between refsA centroid and refsB centroid equals `lockedValueMm` (within tolerance 1mm)
   - `equal_length`: refsA and refsB are walls; their lengths are equal
   - `parallel`: refsA and refsB are walls; their direction vectors are parallel
   - `perpendicular`: refsA and refsB are walls; direction vectors perpendicular
   - `collinear`: refsA and refsB are walls; on the same infinite line

4. **Padlock UI on temp dimensions** (extend the EDT-01 temp-dimension layer in `packages/web/src/plan/tempDimensions.ts`):
   - Render a small padlock icon at the midpoint of each temp dimension
   - Click padlock → emits `CreateConstraint` with `rule: 'equal_distance'`, refs from the temp dim's two ends, `lockedValueMm` from the current measured distance
   - Locked dimensions render with a closed padlock; unlocked render with an open padlock

5. **Constraint browsing:** new "Constraints" group in the project browser left rail listing all `constraint` elements; right-click → Delete

6. **EQ symmetry port from family editor (V2-11):** the family editor already has EQ for parametric dims. Port the same constraint code into the project-level constraint engine — when you click two parallel walls + click an EQ button (new, in modify ribbon), commit a `parallel` constraint.

7. **Tests:**
   - `app/tests/test_constraint_engine.py` — each rule type rejects violating commands
   - `packages/web/src/plan/tempDimensions.padlock.test.ts` — padlock click commits constraint

**Acceptance.** Lock the distance between two parallel walls at 4000mm; moving one wall pulls the other along to maintain 4000mm; explicit conflict raises an error advisory.

**Effort:** 5-6 hours.

---

### 1.2 — EDT-03: 3D direct-manipulation handles

**Tracker:** P2 → EDT-03 detail block.

**Concrete scope:**

1. **New module** `packages/web/src/viewport/grip3d.ts` — same protocol shape as the plan-canvas `gripProtocol.ts` (EDT-01) but in 3D. Each registered provider returns `{ position, axis, onDrag, onCommit, onNumericOverride }` with positions in 3D world coordinates.

2. **Wire into `Viewport.tsx`:**
   - Handles drawn via Three.js LineSegments + Sprite
   - Raycast handles before element pick (handles take priority on hover)
   - Glowing axis (red/green/blue per direction) shown during drag
   - Esc cancels drag (revert draft)

3. **Element kinds wired in this WP:**
   - **Wall:** top-edge handle → drag-up changes `topConstraintOffsetMm` (or `heightMm` if no top constraint); drag-down → `baseConstraintOffsetMm`
   - **Floor:** edge handle drags vertex on its boundary polygon
   - **Roof:** ridge handle drags ridge height
   - **Section box** (already partly there via `SectionBox.tsx`): six face handles already wired — extend with corner handles for free-form cuts

4. **Wall face radial menu:** click a wall face (not the edge) → small radial menu offering "Insert Door" / "Insert Window" / "Insert Opening", placing the resulting hosted element at the click point.

5. **Tests:**
   - `packages/web/src/viewport/grip3d.test.ts` — protocol shape + provider registration
   - `packages/web/src/viewport/grip3d.wall.test.ts` — wall top-edge drag commits correct command
   - `packages/web/src/viewport/grip3d.floor.test.ts` — floor edge drag

**MAY defer (mark `partial` in tracker if needed):**
- Door/window in elevation view (width/height handles)
- Column / beam endpoint handles
- Roof eave handle (in addition to ridge)

**Acceptance.** From the seeded demo SSW viewpoint: clicking a wall reveals top + bottom handles; dragging the top handle commits `UpdateElementProperty` on `topConstraintOffsetMm` and the wall visibly grows in real time; the floor above (constrained to top of wall) follows. Clicking a face of a wall opens a small radial menu.

**Effort:** 7-8 hours. Visual verify in the dev server before declaring done.

---

## 2. File ownership and conflict avoidance

**You own:**
- `packages/web/src/viewport/grip3d.ts` (new)
- `packages/web/src/viewport/grip3d.providers.ts` (new — wall/floor/roof providers)
- `app/bim_ai/constraints.py` constraint-engine extensions
- `constraint` element kind + commands
- Padlock UI in `tempDimensions.ts`

**Shared territory:**
- `Viewport.tsx` — Agents 1 (federation ghosting), 7 (other element grips) also touch; keep your handle-layer additions in a separate effect block
- `core/index.ts`, `elements.py`, `commands.py`, `engine.py` — append additions
- `tempDimensions.ts` (EDT-01) — extend with padlock UI; don't restructure
- `spec/workpackage-master-tracker.md` — only EDT-02, EDT-03

**Avoid:**
- `PlanCanvas.tsx` (Agents 3, 4)
- `meshBuilders.ts` outside the handle hookup (Agent 5)
- `familyEditor/*` (Agent 7)

---

## 3. Go

Spawn worktree. Ship EDT-02 → EDT-03. **Visually verify EDT-03 in the dev server before declaring done.**
